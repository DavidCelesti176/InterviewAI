import assert from "node:assert/strict";
import test from "node:test";

import {
  chooseFullMockSource,
  closeLiveSegment,
  consumeReservation,
  decideStart,
  emptyBilling,
  failReconnect,
  freeQuickAvailable,
  legacyResultsReadable,
  markSessionLiveStart,
  projectBilling,
  releaseReservation,
  releaseStaleReservations,
  grantPurchasedCredit,
  markPastDue,
  reverseUnusedPurchasedCredit,
  scheduleCancellation,
  sessionClassForMinutes,
  startPlusPeriod,
  syncPlusSubscriptionState,
} from "./decide";
import { billingBypassEnabled } from "./enforcement";
import { BILLING_LAUNCH_AT, products } from "./products";
import type { SessionGrant } from "./types";

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

test("a new account can start one quick practice", () => {
  const account = emptyBilling(now);
  assert.equal(freeQuickAvailable(account), true);
  assert.equal(sessionClassForMinutes(10), "quick_practice");
  const decision = decideStart({
    account,
    reservations: [],
    request: { kind: "interview", session: grant({ sessionClass: "quick_practice", analysisTier: "basic", targetMinutes: 10, maxMinutes: 10 }) },
    reservationId: "hold-1",
    sessionId: "session-1",
    now,
  });
  assert.equal(decision.ok, true);
  if (!decision.ok) return;
  assert.equal(decision.reservation.source, "free_quick");
  const consumed = consumeReservation(decision.account, decision.reservation, now, "live-1");
  assert.equal(consumed?.account.freeQuickUsedAt, now);
  assert.equal(freeQuickAvailable(consumed!.account), false);
});

test("a second quick practice is refused", () => {
  const account = { ...emptyBilling(now), freeQuickUsedAt: now - 1000 };
  const decision = decideStart({
    account,
    reservations: [],
    request: { kind: "interview", session: grant({ sessionClass: "quick_practice", analysisTier: "basic", entitlementSource: "free_quick" }) },
    reservationId: "hold-2",
    sessionId: "session-1",
    now,
  });
  assert.equal(decision.ok, false);
  if (decision.ok) return;
  assert.equal(decision.code, "PAYMENT_REQUIRED");
});

test("plus grants three mocks from the catalog and spends one", () => {
  const account = startPlusPeriod(emptyBilling(now), now - 1000, now + 86_400_000, now);
  assert.equal(account.mockGrant, products.plus.grants.mockCredits);
  const decision = decideStart({
    account,
    reservations: [],
    request: { kind: "interview", session: grant() },
    reservationId: "hold-1",
    sessionId: "session-1",
    now,
  });
  assert.equal(decision.ok, true);
  if (!decision.ok) return;
  const consumed = consumeReservation(decision.account, decision.reservation, now, "live-1");
  assert.equal(consumed?.account.mockConsumed, 1);
  assert.equal(projectBilling(consumed!.account, now).mockCreditsAvailable, 2);
});

test("two holds cannot spend one mock credit", () => {
  const account = startPlusPeriod(emptyBilling(now), now - 1000, now + 86_400_000, now);
  account.mockGrant = 1;
  const first = decideStart({
    account,
    reservations: [],
    request: { kind: "interview", session: grant() },
    reservationId: "hold-1",
    sessionId: "session-1",
    now,
  });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const second = decideStart({
    account: first.account,
    reservations: [first.reservation],
    request: { kind: "interview", session: grant() },
    reservationId: "hold-2",
    sessionId: "session-1",
    now,
  });
  assert.equal(second.ok, false);
  if (second.ok) return;
  assert.equal(second.code, "CREDIT_RESERVED");
});

test("a failed live start returns the hold", () => {
  const account = startPlusPeriod(emptyBilling(now), now - 1000, now + 86_400_000, now);
  const decision = decideStart({
    account,
    reservations: [],
    request: { kind: "interview", session: grant() },
    reservationId: "hold-1",
    sessionId: "session-1",
    now,
  });
  assert.equal(decision.ok, true);
  if (!decision.ok) return;
  const released = releaseReservation(decision.account, decision.reservation, now);
  assert.equal(released?.reservation.status, "released");
  assert.equal(projectBilling(released!.account, now).mockCreditsAvailable, 3);
});

test("a stale hold is released on the next attempt", () => {
  const account = startPlusPeriod(emptyBilling(now), now - 10 * 60 * 1000, now + 86_400_000, now);
  const held = decideStart({
    account,
    reservations: [],
    request: { kind: "interview", session: grant() },
    reservationId: "hold-1",
    sessionId: "session-1",
    now: now - 4 * 60 * 1000,
  });
  assert.equal(held.ok, true);
  if (!held.ok) return;
  const stale = { ...held.reservation, expiresAt: now - 1000 };
  const recovered = releaseStaleReservations({ ...held.account, openReservationIds: [stale.reservationId] }, [stale], now);
  assert.equal(recovered.reservations[0]?.status, "released");
  assert.equal(projectBilling(recovered.account, now).mockCreditsAvailable, 3);
});

test("purchased credit works and monthly credit is spent first", () => {
  const plus = { ...startPlusPeriod(emptyBilling(now), now - 1000, now + 86_400_000, now), purchasedRemaining: 1 };
  assert.equal(chooseFullMockSource(plus, now), "plus_mock");
  const freeWithPurchase = { ...emptyBilling(now), purchasedRemaining: 1, freeQuickUsedAt: now };
  assert.equal(chooseFullMockSource(freeWithPurchase, now), "purchased_mock");
  const decision = decideStart({
    account: freeWithPurchase,
    reservations: [],
    request: { kind: "interview", session: grant() },
    reservationId: "hold-1",
    sessionId: "session-1",
    now,
  });
  assert.equal(decision.ok, true);
  if (!decision.ok) return;
  assert.equal(decision.reservation.source, "purchased_mock");
});

test("nothing left refuses a full mock", () => {
  const decision = decideStart({
    account: { ...emptyBilling(now), freeQuickUsedAt: now },
    reservations: [],
    request: { kind: "interview", session: grant() },
    reservationId: "hold-1",
    sessionId: "session-1",
    now,
  });
  assert.equal(decision.ok, false);
  if (decision.ok) return;
  assert.equal(decision.code, "PAYMENT_REQUIRED");
});

test("story practice and weak-answer practice share the plus practice pool", () => {
  const account = startPlusPeriod(emptyBilling(now), now - 1000, now + 86_400_000, now);
  assert.equal(account.practiceGrant, 3);
  const story = decideStart({
    account,
    reservations: [],
    request: { kind: "story" },
    reservationId: "hold-1",
    sessionId: "story-1",
    now,
  });
  assert.equal(story.ok, true);
  if (!story.ok) return;
  assert.equal(story.session.practiceKind, "story");
  assert.equal(story.session.targetMinutes, 5);
  assert.equal(story.session.maxMinutes, 10);
  assert.equal(story.session.interviewId, null);
  const weak = decideStart({
    account: { ...account, practiceReserved: 3 },
    reservations: [],
    request: { kind: "interview", session: grant({ sessionClass: "voice_practice", practiceKind: "weak_answer", analysisTier: "basic", targetMinutes: 10, maxMinutes: 10 }) },
    reservationId: "hold-2",
    sessionId: "session-2",
    now,
  });
  assert.equal(weak.ok, false);
});

test("scheduling cancellation keeps paid-period credits", () => {
  const plus = startPlusPeriod(emptyBilling(now), now - 1000, now + 86_400_000, now);
  const canceled = scheduleCancellation(plus, now);
  assert.equal(canceled.subscriptionStatus, "active");
  assert.equal(canceled.cancelAtPeriodEnd, true);
  assert.equal(projectBilling(canceled, now).mockCreditsAvailable, 3);
});

test("a purchased credit grant increments remaining and a refund cannot go below zero", () => {
  const granted = grantPurchasedCredit(emptyBilling(now), now);
  assert.equal(granted.purchasedRemaining, 1);
  const unused = reverseUnusedPurchasedCredit(granted, now);
  assert.equal(unused.reversed, true);
  assert.equal(unused.account.purchasedRemaining, 0);
  const reserved = reverseUnusedPurchasedCredit({ ...granted, purchasedReserved: 1 }, now);
  assert.equal(reserved.reversed, false);
  assert.equal(reserved.needsReview, true);
  const empty = reverseUnusedPurchasedCredit(emptyBilling(now), now);
  assert.equal(empty.reversed, false);
  assert.equal(empty.needsReview, true);
});

test("past due does not reset period grants", () => {
  const plus = { ...startPlusPeriod(emptyBilling(now), now - 1000, now + 86_400_000, now), mockConsumed: 1 };
  const due = markPastDue(plus, now);
  assert.equal(due.subscriptionStatus, "past_due");
  assert.equal(due.mockGrant, 3);
  assert.equal(due.mockConsumed, 1);
});

test("cancel at period end stays plus until the subscription is deleted", () => {
  const plus = startPlusPeriod(emptyBilling(now), now - 1000, now + 86_400_000, now);
  const scheduled = syncPlusSubscriptionState(
    plus,
    {
      subscriptionId: "sub_1",
      customerId: "cus_1",
      status: "active",
      cancelAtPeriodEnd: true,
      periodStart: plus.periodStart,
      periodEnd: plus.periodEnd,
    },
    now,
  );
  assert.equal(scheduled.plan, "plus");
  assert.equal(scheduled.cancelAtPeriodEnd, true);
  assert.equal(projectBilling(scheduled, now).mockCreditsAvailable, 3);
  const ended = syncPlusSubscriptionState(
    scheduled,
    {
      subscriptionId: "sub_1",
      customerId: "cus_1",
      status: "canceled",
      cancelAtPeriodEnd: false,
    },
    now,
  );
  assert.equal(ended.plan, "free");
  assert.equal(ended.subscriptionStatus, "canceled");
  assert.equal(ended.purchasedRemaining, 0);
});

test("45 minutes is not a launch product", () => {
  assert.equal(sessionClassForMinutes(45), null);
  assert.equal(sessionClassForMinutes(15), null);
  assert.equal(sessionClassForMinutes(30), "full_mock");
});

test("one reconnect is restored when live create fails", () => {
  const session = grant({
    entitlementSource: "plus_mock",
    firstLiveStartedAt: now - 30_000,
  });
  const decision = decideStart({
    account: emptyBilling(now),
    reservations: [],
    request: { kind: "interview", session },
    reservationId: "reconnect-1",
    sessionId: session.sessionId,
    now,
  });
  assert.equal(decision.ok, true);
  if (!decision.ok) return;
  assert.equal(decision.reconnect, true);
  assert.equal(decision.reservation.source, "reconnect");
  const restored = failReconnect(decision.session);
  assert.equal(restored.reconnectClaimExpiresAt, null);
  assert.equal(restored.reconnectCount, 0);
  const started = markSessionLiveStart(decision.session, "reconnect", now);
  assert.equal(started.reconnectCount, 1);
  const again = decideStart({
    account: emptyBilling(now),
    reservations: [],
    request: { kind: "interview", session: started },
    reservationId: "reconnect-2",
    sessionId: session.sessionId,
    now,
  });
  assert.equal(again.ok, false);
});

test("wall clock includes the open segment when it closes", () => {
  const started = markSessionLiveStart(grant(), "plus_mock", now);
  const closed = closeLiveSegment(started, now + 125_000, 130);
  assert.equal(closed.liveWallClockSeconds, 125);
  assert.equal(closed.reportedUsageSeconds, 130);
  assert.equal(closed.liveSegments[0]?.liveEndedAt, now + 125_000);
});

test("legacy completed interviews stay readable and production cannot bypass billing", () => {
  assert.equal(legacyResultsReadable(BILLING_LAUNCH_AT - 1, "complete"), true);
  assert.equal(legacyResultsReadable(BILLING_LAUNCH_AT - 1, "ready"), false);
  assert.equal(legacyResultsReadable(BILLING_LAUNCH_AT + 1, "complete"), false);
  assert.equal(billingBypassEnabled({ NODE_ENV: "production", DEV_BILLING_BYPASS: "1" }), false);
  assert.equal(billingBypassEnabled({ NODE_ENV: "development", DEV_BILLING_BYPASS: "1" }), true);
  assert.equal(billingBypassEnabled({ NODE_ENV: "development" }), false);
});
