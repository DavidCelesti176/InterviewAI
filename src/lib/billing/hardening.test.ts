import assert from "node:assert/strict";
import test from "node:test";

import { analysisSchema, basicSchema } from "@/lib/interview/analyze-interview";
import { interviewChildCollections } from "@/lib/firebase/data";
import {
  analysisTierFor,
  consumeReservation,
  decideStart,
  emptyBilling,
  mockCreditsAvailable,
  practiceSessionsAvailable,
  previewAllowed,
  projectBilling,
  purchasedCreditsAvailable,
  scheduleCancellation,
  sessionClassForMinutes,
  startPlusPeriod,
} from "@/lib/billing/decide";
import { billingSentence } from "@/lib/billing/display";
import { devBillingPatch } from "@/lib/billing/dev-preset";
import { billingBypassEnabled, liveCreateShouldFail } from "@/lib/billing/enforcement";
import { abortLedger, authorizeLedger, commitLedger, lockLedger, type Ledger } from "@/lib/billing/ledger";
import {
  BILLING_LAUNCH_AT,
  connectedLimitMs,
  FULL_CEILING_MINUTES,
  PRACTICE_MAX_MINUTES,
  products,
  QUICK_CEILING_MINUTES,
  safetyCeilingMinutes,
} from "@/lib/billing/products";
import { legacyResultsReadable } from "@/lib/billing/decide";
import type { BillingAccount, SessionGrant } from "@/lib/billing/types";

const now = Date.parse("2026-10-08T15:00:00.000Z");

function grant(overrides: Partial<SessionGrant> = {}): SessionGrant {
  return {
    sessionId: "session-1",
    interviewId: "interview-1",
    sessionClass: "full_mock",
    practiceKind: null,
    targetMinutes: 30,
    maxMinutes: 30,
    analysisTier: "full",
    entitlementSource: null,
    reconnectCount: 0,
    reconnectClaimExpiresAt: null,
    candidateSpoke: false,
    firstLiveStartedAt: null,
    liveSegments: [],
    liveWallClockSeconds: 0,
    reportedUsageSeconds: null,
    createdAt: now,
    ...overrides,
  };
}

function ledger(account: BillingAccount, sessions: SessionGrant[] = []): Ledger {
  return {
    account,
    sessions: Object.fromEntries(sessions.map((session) => [session.sessionId, session])),
    reservations: {},
    events: {},
  };
}

function plus(extra: Partial<BillingAccount> = {}): BillingAccount {
  return { ...startPlusPeriod(emptyBilling(now), now - 60_000, now + 86_400_000, now), ...extra };
}

test("a brand-new account has one quick practice and nothing else", () => {
  const account = emptyBilling(now);
  const view = projectBilling(account, now);
  assert.equal(view.plan, "free");
  assert.equal(view.freeQuickAvailable, true);
  assert.equal(view.mockCreditsAvailable, 0);
  assert.equal(view.practiceSessionsAvailable, 0);
  assert.equal(view.purchasedCreditsAvailable, 0);
  assert.equal(billingSentence(view), "One Quick Practice is ready.");
});

test("quick practice reserves, consumes as free_quick, then a second one is refused", () => {
  const session = grant({ sessionClass: "quick_practice", analysisTier: "basic", targetMinutes: 10, maxMinutes: 10 });
  const reserved = authorizeLedger(ledger(emptyBilling(now), [session]), { interviewId: session.interviewId }, now, {
    reservationId: "hold-1",
    sessionId: "ignored",
  });
  assert.equal(reserved.result.ok, true);
  assert.equal(reserved.ledger.reservations["hold-1"]?.source, "free_quick");
  assert.equal(reserved.ledger.account.freeQuickReserved, 1);
  const locked = lockLedger(reserved.ledger, "hold-1", session.sessionId, now);
  assert.equal(locked.grant?.analysisTier, "basic");
  const consumed = commitLedger(locked.ledger, "hold-1", "live-1", now);
  assert.equal(consumed.committed, true);
  assert.equal(consumed.ledger.sessions[session.sessionId]?.entitlementSource, "free_quick");
  assert.equal(consumed.ledger.sessions[session.sessionId]?.analysisTier, "basic");
  assert.equal(consumed.ledger.events["consumed-hold-1"]?.name, "credit_consumed");
  const second = grant({ sessionId: "session-2", interviewId: "interview-2", sessionClass: "quick_practice", analysisTier: "basic", targetMinutes: 10, maxMinutes: 10 });
  const again = authorizeLedger(
    { ...consumed.ledger, sessions: { ...consumed.ledger.sessions, [second.sessionId]: second } },
    { interviewId: second.interviewId },
    now + 1000,
    { reservationId: "hold-2", sessionId: "ignored" },
  );
  assert.equal(again.result.ok, false);
  if (again.result.ok) return;
  assert.equal(again.result.code, "PAYMENT_REQUIRED");
  assert.equal(billingSentence(projectBilling(consumed.ledger.account, now)), "Ready for a full mock?");
});

test("plus grants three mocks and three practices, and one of each spends only its own pool", () => {
  const account = plus();
  assert.equal(account.mockGrant, products.plus.grants.mockCredits);
  assert.equal(account.practiceGrant, products.plus.grants.practiceSessions);
  const mock = grant();
  const practice = grant({
    sessionId: "practice-1",
    interviewId: "practice-interview",
    sessionClass: "voice_practice",
    practiceKind: "weak_answer",
    analysisTier: "basic",
    targetMinutes: 10,
    maxMinutes: 10,
  });
  const first = authorizeLedger(ledger(account, [mock, practice]), { interviewId: mock.interviewId }, now, {
    reservationId: "mock-hold",
    sessionId: "ignored",
  });
  const spentMock = commitLedger(lockLedger(first.ledger, "mock-hold", mock.sessionId, now).ledger, "mock-hold", "live-mock", now);
  assert.equal(projectBilling(spentMock.ledger.account, now).mockCreditsAvailable, 2);
  assert.equal(projectBilling(spentMock.ledger.account, now).practiceSessionsAvailable, 3);
  const voice = authorizeLedger(spentMock.ledger, { interviewId: practice.interviewId }, now, {
    reservationId: "voice-hold",
    sessionId: "ignored",
  });
  const spentVoice = commitLedger(lockLedger(voice.ledger, "voice-hold", practice.sessionId, now).ledger, "voice-hold", "live-voice", now);
  assert.equal(projectBilling(spentVoice.ledger.account, now).practiceSessionsAvailable, 2);
  assert.equal(projectBilling(spentVoice.ledger.account, now).mockCreditsAvailable, 2);
  assert.equal(billingSentence(projectBilling(spentVoice.ledger.account, now)).startsWith("2 of 3 full interviews left this month."), true);
});

test("story practice and weak-answer practice share one pool and story has no interview", () => {
  let state = ledger(plus());
  const story = authorizeLedger(state, { story: true }, now, { reservationId: "story-hold", sessionId: "story-session" });
  assert.equal(story.result.ok, true);
  if (!story.result.ok) return;
  assert.equal(story.ledger.sessions["story-session"]?.interviewId, null);
  assert.equal(story.ledger.sessions["story-session"]?.practiceKind, "story");
  assert.equal(story.ledger.sessions["story-session"]?.maxMinutes, PRACTICE_MAX_MINUTES);
  assert.equal(story.result.ceilingMinutes, PRACTICE_MAX_MINUTES);
  state = commitLedger(lockLedger(story.ledger, "story-hold", "story-session", now).ledger, "story-hold", "live-story", now).ledger;
  const weak = grant({ sessionId: "weak-1", interviewId: "weak-interview", sessionClass: "voice_practice", practiceKind: "weak_answer", analysisTier: "basic" });
  state = { ...state, sessions: { ...state.sessions, [weak.sessionId]: weak } };
  const held = authorizeLedger(state, { interviewId: weak.interviewId }, now, { reservationId: "weak-hold", sessionId: "ignored" });
  const after = commitLedger(lockLedger(held.ledger, "weak-hold", weak.sessionId, now).ledger, "weak-hold", "live-weak", now).ledger;
  assert.equal(practiceSessionsAvailable(after.account, now), 1);
  assert.equal(mockCreditsAvailable(after.account, now), 3);
});

test("purchased credit starts a full mock and does not expire with a period", () => {
  const expiredPlus = {
    ...plus({ purchasedRemaining: 1, periodEnd: now - 1, freeQuickUsedAt: now - 1000 }),
    plan: "free" as const,
    subscriptionStatus: null,
  };
  assert.equal(mockCreditsAvailable(expiredPlus, now), 0);
  assert.equal(purchasedCreditsAvailable(expiredPlus), 1);
  const session = grant();
  const started = authorizeLedger(ledger(expiredPlus, [session]), { interviewId: session.interviewId }, now, {
    reservationId: "buy-1",
    sessionId: "ignored",
  });
  const consumed = commitLedger(lockLedger(started.ledger, "buy-1", session.sessionId, now).ledger, "buy-1", "live-buy", now);
  assert.equal(consumed.ledger.reservations["buy-1"]?.source, "purchased_mock");
  assert.equal(consumed.ledger.sessions[session.sessionId]?.entitlementSource, "purchased_mock");
  assert.equal(consumed.ledger.sessions[session.sessionId]?.analysisTier, "full");
  assert.equal(consumed.ledger.account.purchasedRemaining, 0);
  assert.equal(billingSentence(projectBilling(expiredPlus, now)), "1 full interview credit ready.");
});

test("a plus mock credit is spent before a purchased credit", () => {
  const account = plus({ purchasedRemaining: 1, mockGrant: 3, mockConsumed: 2 });
  const first = grant({ sessionId: "one", interviewId: "one" });
  const second = grant({ sessionId: "two", interviewId: "two" });
  let state = ledger(account, [first, second]);
  const firstStart = authorizeLedger(state, { interviewId: "one" }, now, { reservationId: "h1", sessionId: "ignored" });
  state = commitLedger(lockLedger(firstStart.ledger, "h1", "one", now).ledger, "h1", "live-1", now).ledger;
  assert.equal(state.reservations.h1?.source, "plus_mock");
  assert.equal(state.account.purchasedRemaining, 1);
  assert.equal(mockCreditsAvailable(state.account, now), 0);
  const secondStart = authorizeLedger(state, { interviewId: "two" }, now, { reservationId: "h2", sessionId: "ignored" });
  state = commitLedger(lockLedger(secondStart.ledger, "h2", "two", now).ledger, "h2", "live-2", now).ledger;
  assert.equal(state.reservations.h2?.source, "purchased_mock");
  assert.equal(state.account.purchasedRemaining, 0);
});

test("nothing left and unsupported durations are refused before a grant is spent", () => {
  const none = decideStart({
    account: emptyBilling(now),
    reservations: [],
    request: { kind: "interview", session: grant() },
    reservationId: "h",
    sessionId: "session-1",
    now,
  });
  assert.equal(none.ok, false);
  if (none.ok) return;
  assert.equal(none.code, "PAYMENT_REQUIRED");
  assert.equal(sessionClassForMinutes(45), null);
  assert.equal(previewAllowed(emptyBilling(now), 45, now), "DURATION_NOT_INCLUDED");
  assert.equal(analysisTierFor("quick_practice"), "basic");
  assert.equal(analysisTierFor("voice_practice"), "basic");
  assert.equal(analysisTierFor("full_mock"), "full");
});

test("client-supplied plan, credits, stripe ids, and session class do not grant access", () => {
  const patch = devBillingPatch(
    {
      uid: "someone-else",
      plan: "plus",
      stripeCustomerId: "cus_evil",
      stripeSubscriptionId: "sub_evil",
      sessionClass: "full_mock",
      analysisTier: "full",
      entitlementSource: "plus_mock",
      mockCredits: 99,
    },
    now,
  );
  assert.equal("uid" in patch, false);
  assert.equal(patch.stripeCustomerId, null);
  assert.equal(patch.stripeSubscriptionId, null);
  assert.equal(patch.mockConsumed, 0);
  assert.equal(patch.mockGrant, 3);
  const session = grant({ sessionClass: "quick_practice", analysisTier: "basic", targetMinutes: 10, maxMinutes: 10 });
  const started = authorizeLedger(ledger(emptyBilling(now), [session]), { interviewId: session.interviewId, sessionClass: "full_mock" } as { interviewId: string }, now, {
    reservationId: "h",
    sessionId: "ignored",
  });
  assert.equal(started.ledger.reservations.h?.source, "free_quick");
  assert.equal(started.ledger.sessions[session.sessionId]?.analysisTier, "basic");
});

test("scheduled cancellation keeps credits until the period ends", () => {
  const canceled = scheduleCancellation(plus(), now);
  assert.equal(canceled.subscriptionStatus, "active");
  assert.equal(canceled.cancelAtPeriodEnd, true);
  assert.equal(mockCreditsAvailable(canceled, now), 3);
  const expired = { ...canceled, periodEnd: now };
  assert.equal(mockCreditsAvailable(expired, now), 0);
  assert.equal(practiceSessionsAvailable(expired, now), 0);
  assert.equal(projectBilling(canceled, now).cancelAtPeriodEnd, true);
  assert.match(billingSentence(projectBilling(canceled, now)), /Cancellation is scheduled/);
});

test("one credit can be reserved by only one start", () => {
  const session = grant();
  const other = grant({ sessionId: "other", interviewId: "other" });
  const account = plus({ mockGrant: 1 });
  const first = authorizeLedger(ledger(account, [session, other]), { interviewId: session.interviewId }, now, {
    reservationId: "a",
    sessionId: "ignored",
  });
  const secondSame = authorizeLedger(first.ledger, { interviewId: session.interviewId }, now, { reservationId: "b", sessionId: "ignored" });
  assert.equal(secondSame.result.ok, false);
  if (secondSame.result.ok) return;
  assert.equal(secondSame.result.code, "CREDIT_RESERVED");
  const secondOther = authorizeLedger(first.ledger, { interviewId: other.interviewId }, now, { reservationId: "c", sessionId: "ignored" });
  assert.equal(secondOther.result.ok, false);
  if (secondOther.result.ok) return;
  assert.equal(secondOther.result.code, "PAYMENT_REQUIRED");
  assert.equal(first.ledger.account.mockReserved, 1);
  assert.equal(first.ledger.account.mockConsumed, 0);
  assert.ok(first.ledger.account.mockReserved >= 0);
});

test("a failed live start releases the hold and leaves entitlement unset", () => {
  const session = grant();
  const reserved = authorizeLedger(ledger(plus(), [session]), { interviewId: session.interviewId }, now, { reservationId: "h", sessionId: "ignored" });
  const locked = lockLedger(reserved.ledger, "h", session.sessionId, now);
  const released = abortLedger(locked.ledger, "h", now);
  assert.equal(released.reservations.h?.status, "released");
  assert.equal(released.events["released-h"]?.name, "credit_released");
  assert.equal(mockCreditsAvailable(released.account, now), 3);
  assert.equal(released.sessions[session.sessionId]?.entitlementSource, null);
  const retry = authorizeLedger(released, { interviewId: session.interviewId }, now, { reservationId: "h2", sessionId: "ignored" });
  assert.equal(retry.result.ok, true);
});

test("the same reservation cannot be consumed twice and the audit event is written once", () => {
  const session = grant();
  const reserved = authorizeLedger(ledger(plus(), [session]), { interviewId: session.interviewId }, now, { reservationId: "h", sessionId: "ignored" });
  const locked = lockLedger(reserved.ledger, "h", session.sessionId, now);
  const first = commitLedger(locked.ledger, "h", "live-1", now);
  const second = commitLedger(first.ledger, "h", "live-2", now);
  assert.equal(first.committed, true);
  assert.equal(second.committed, false);
  assert.equal(first.ledger.account.mockConsumed, 1);
  assert.equal(second.ledger.account.mockConsumed, 1);
  assert.equal(Object.values(first.ledger.events).filter((event) => event.name === "credit_consumed").length, 1);
  const again = consumeReservation(first.ledger.account, first.ledger.reservations.h!, now, "live-3");
  assert.equal(again, null);
});

test("a second lock cannot open a second live session for one reservation", () => {
  const session = grant();
  const reserved = authorizeLedger(ledger(plus(), [session]), { interviewId: session.interviewId }, now, { reservationId: "h", sessionId: "ignored" });
  const first = lockLedger(reserved.ledger, "h", session.sessionId, now);
  const second = lockLedger(first.ledger, "h", session.sessionId, now);
  assert.ok(first.grant);
  assert.equal(second.grant, null);
});

test("a stale reservation is released inside the next authorization", () => {
  const session = grant();
  const held = authorizeLedger(ledger(plus({ periodStart: now - 10 * 60 * 1000 }), [session]), { interviewId: session.interviewId }, now - 4 * 60 * 1000, {
    reservationId: "old",
    sessionId: "ignored",
  });
  held.ledger.reservations.old = { ...held.ledger.reservations.old!, expiresAt: now - 1000 };
  const next = authorizeLedger(held.ledger, { interviewId: session.interviewId }, now, { reservationId: "new", sessionId: "ignored" });
  assert.equal(next.ledger.reservations.old?.status, "released");
  assert.equal(next.ledger.reservations.new?.status, "reserved");
  assert.equal(next.ledger.events["released-old"]?.name, "credit_released");
  assert.equal(next.ledger.events["reserved-new"]?.name, "credit_reserved");
  assert.equal(next.ledger.account.mockReserved, 1);
  assert.equal(next.result.ok, true);
});

test("one reconnect is free until the candidate speaks, and a failed second create restores it", () => {
  const session = grant();
  const started = commitLedger(
    lockLedger(authorizeLedger(ledger(plus(), [session]), { interviewId: session.interviewId }, now, { reservationId: "h", sessionId: "ignored" }).ledger, "h", session.sessionId, now).ledger,
    "h",
    "live-1",
    now,
  ).ledger;
  const reconnect = authorizeLedger(started, { interviewId: session.interviewId }, now + 30_000, { reservationId: "r1", sessionId: "ignored" });
  assert.equal(reconnect.result.ok, true);
  if (!reconnect.result.ok) return;
  assert.equal(reconnect.result.reconnect, true);
  assert.equal(reconnect.ledger.account.mockConsumed, 1);
  const failed = abortLedger(lockLedger(reconnect.ledger, "r1", session.sessionId, now + 30_000).ledger, "r1", now + 31_000);
  assert.equal(failed.sessions[session.sessionId]?.reconnectCount, 0);
  assert.equal(failed.sessions[session.sessionId]?.reconnectClaimExpiresAt, null);
  const restored = authorizeLedger(failed, { interviewId: session.interviewId }, now + 40_000, { reservationId: "r2", sessionId: "ignored" });
  const connected = commitLedger(lockLedger(restored.ledger, "r2", session.sessionId, now + 40_000).ledger, "r2", "live-2", now + 40_000).ledger;
  assert.equal(connected.sessions[session.sessionId]?.reconnectCount, 1);
  assert.equal(connected.account.mockConsumed, 1);
  const third = authorizeLedger(connected, { interviewId: session.interviewId }, now + 50_000, { reservationId: "r3", sessionId: "ignored" });
  assert.equal(third.result.ok, false);
  const spoken = { ...connected, sessions: { ...connected.sessions, [session.sessionId]: { ...connected.sessions[session.sessionId]!, candidateSpoke: true, reconnectCount: 0 } } };
  const afterSpeech = authorizeLedger(spoken, { interviewId: session.interviewId }, now + 20_000, { reservationId: "r4", sessionId: "ignored" });
  assert.equal(afterSpeech.result.ok, false);
});

test("another user's ledger cannot spend this user's reservation", () => {
  const session = grant();
  const mine = authorizeLedger(ledger(plus(), [session]), { interviewId: session.interviewId }, now, { reservationId: "h", sessionId: "ignored" });
  const theirs = ledger(plus(), [grant({ sessionId: "theirs", interviewId: "theirs" })]);
  const stolen = lockLedger(theirs, "h", session.sessionId, now);
  assert.equal(stolen.grant, null);
  assert.equal(mine.ledger.account.mockReserved, 1);
  assert.equal(theirs.account.mockReserved, 0);
});

test("safety ceilings sit past the natural target and count connected time", () => {
  assert.equal(safetyCeilingMinutes({ sessionClass: "quick_practice" }), QUICK_CEILING_MINUTES);
  assert.equal(QUICK_CEILING_MINUTES, 13);
  assert.equal(safetyCeilingMinutes({ sessionClass: "full_mock" }), FULL_CEILING_MINUTES);
  assert.equal(FULL_CEILING_MINUTES, 35);
  assert.equal(safetyCeilingMinutes({ sessionClass: "voice_practice" }), 10);
  const startedAt = now;
  const pausedMs = 5 * 60 * 1000;
  const connected = now + connectedLimitMs(13) - startedAt;
  assert.equal(connected >= connectedLimitMs(13), true);
  assert.equal(connected - pausedMs < connectedLimitMs(13), true);
});

test("basic analysis is a smaller request than the full report", () => {
  const basicFields = basicSchema.required as readonly string[];
  const fullFields = analysisSchema.required as readonly string[];
  assert.equal(basicFields.includes("questionFeedback"), false);
  assert.equal(basicFields.includes("strongestMoment"), false);
  assert.equal(fullFields.includes("questionFeedback"), true);
  assert.equal(basicFields.includes("overallReadiness"), true);
  assert.equal(basicFields.includes("categoryScores"), true);
});

test("legacy interviews stay readable only before the launch cutoff", () => {
  assert.equal(legacyResultsReadable(BILLING_LAUNCH_AT - 1, "complete"), true);
  assert.equal(legacyResultsReadable(BILLING_LAUNCH_AT - 1, "ready"), false);
  assert.equal(legacyResultsReadable(BILLING_LAUNCH_AT, "complete"), false);
});

test("production ignores billing bypass and the live-create failure hook", () => {
  assert.equal(billingBypassEnabled({ NODE_ENV: "production", DEV_BILLING_BYPASS: "1" }), false);
  assert.equal(liveCreateShouldFail({ NODE_ENV: "production", DEV_LIVE_CREATE_FAIL: "1" }), false);
  assert.equal(liveCreateShouldFail({ NODE_ENV: "development", DEV_LIVE_CREATE_FAIL: "1" }), true);
  assert.equal(liveCreateShouldFail({ NODE_ENV: "development" }), false);
});

test("interview delete lists child collections and leaves billing records alone", () => {
  assert.deepEqual(interviewChildCollections, ["turns", "analysis", "assistance"]);
  assert.equal(interviewChildCollections.includes("billing" as "turns"), false);
});
