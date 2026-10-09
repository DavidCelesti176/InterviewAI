import {
  BILLING_LAUNCH_AT,
  products,
  PRACTICE_MAX_MINUTES,
  QUICK_MINUTES,
  FULL_MINUTES,
  RECONNECT_WINDOW_MS,
  RESERVATION_TTL_MS,
  STORY_TARGET_MINUTES,
  WEAK_ANSWER_TARGET_MINUTES,
} from "@/lib/billing/products";
import type {
  BillingAccount,
  BillingProjection,
  EntitlementCode,
  EntitlementSource,
  PracticeKind,
  Reservation,
  SessionClass,
  SessionGrant,
} from "@/lib/billing/types";

export function emptyBilling(now: number): BillingAccount {
  return {
    plan: "free",
    subscriptionStatus: null,
    cancelAtPeriodEnd: false,
    periodStart: null,
    periodEnd: null,
    mockGrant: 0,
    mockConsumed: 0,
    mockReserved: 0,
    practiceGrant: 0,
    practiceConsumed: 0,
    practiceReserved: 0,
    purchasedRemaining: 0,
    purchasedReserved: 0,
    freeQuickUsedAt: null,
    freeQuickReserved: 0,
    lifetimeFullInterviews: 0,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    openReservationIds: [],
    updatedAt: now,
  };
}

export function plusPeriodActive(account: BillingAccount, now: number): boolean {
  if (account.plan !== "plus" || account.subscriptionStatus !== "active") return false;
  if (account.periodStart === null || account.periodEnd === null) return false;
  return now >= account.periodStart && now < account.periodEnd;
}

export function mockCreditsAvailable(account: BillingAccount, now: number): number {
  if (!plusPeriodActive(account, now)) return 0;
  return Math.max(0, account.mockGrant - account.mockConsumed - account.mockReserved);
}

export function practiceSessionsAvailable(account: BillingAccount, now: number): number {
  if (!plusPeriodActive(account, now)) return 0;
  return Math.max(0, account.practiceGrant - account.practiceConsumed - account.practiceReserved);
}

export function purchasedCreditsAvailable(account: BillingAccount): number {
  return Math.max(0, account.purchasedRemaining - account.purchasedReserved);
}

export function freeQuickAvailable(account: BillingAccount): boolean {
  return account.freeQuickUsedAt === null && account.freeQuickReserved === 0;
}

export function projectBilling(account: BillingAccount, now: number): BillingProjection {
  return {
    plan: account.plan,
    mockCreditsAvailable: mockCreditsAvailable(account, now),
    practiceSessionsAvailable: practiceSessionsAvailable(account, now),
    purchasedCreditsAvailable: purchasedCreditsAvailable(account),
    periodEnd: account.periodEnd,
    cancelAtPeriodEnd: account.cancelAtPeriodEnd,
    freeQuickAvailable: freeQuickAvailable(account),
  };
}

export function sessionClassForMinutes(minutes: number): SessionClass | null {
  if (minutes === QUICK_MINUTES) return "quick_practice";
  if (minutes === FULL_MINUTES) return "full_mock";
  return null;
}

export function voicePracticeLength(kind: Exclude<PracticeKind, null>): { targetMinutes: number; maxMinutes: number } {
  if (kind === "story") return { targetMinutes: STORY_TARGET_MINUTES, maxMinutes: PRACTICE_MAX_MINUTES };
  return { targetMinutes: WEAK_ANSWER_TARGET_MINUTES, maxMinutes: PRACTICE_MAX_MINUTES };
}

export function analysisTierFor(sessionClass: SessionClass): "basic" | "full" {
  return sessionClass === "full_mock" ? "full" : "basic";
}

export function releaseStaleReservations(account: BillingAccount, reservations: Reservation[], now: number): { account: BillingAccount; reservations: Reservation[] } {
  let next = account;
  const updated = reservations.map((reservation) => {
    if (reservation.status !== "reserved" || reservation.expiresAt > now) return reservation;
    next = restoreHold(next, reservation.source);
    return { ...reservation, status: "released" as const };
  });
  const open = updated.filter((reservation) => reservation.status === "reserved").map((reservation) => reservation.reservationId);
  return { account: { ...next, openReservationIds: open, updatedAt: now }, reservations: updated };
}

function restoreHold(account: BillingAccount, source: Reservation["source"]): BillingAccount {
  if (source === "free_quick") return { ...account, freeQuickReserved: Math.max(0, account.freeQuickReserved - 1) };
  if (source === "plus_mock") return { ...account, mockReserved: Math.max(0, account.mockReserved - 1) };
  if (source === "purchased_mock") return { ...account, purchasedReserved: Math.max(0, account.purchasedReserved - 1) };
  if (source === "plus_practice") return { ...account, practiceReserved: Math.max(0, account.practiceReserved - 1) };
  return account;
}

function takeHold(account: BillingAccount, source: EntitlementSource): BillingAccount {
  if (source === "free_quick") return { ...account, freeQuickReserved: account.freeQuickReserved + 1 };
  if (source === "plus_mock") return { ...account, mockReserved: account.mockReserved + 1 };
  if (source === "purchased_mock") return { ...account, purchasedReserved: account.purchasedReserved + 1 };
  return { ...account, practiceReserved: account.practiceReserved + 1 };
}

export function previewAllowed(account: BillingAccount, minutes: number, now: number): EntitlementCode | null {
  if (minutes !== QUICK_MINUTES && minutes !== FULL_MINUTES) return "DURATION_NOT_INCLUDED";
  if (minutes === QUICK_MINUTES) return freeQuickAvailable(account) ? null : "PAYMENT_REQUIRED";
  return mockCreditsAvailable(account, now) > 0 || purchasedCreditsAvailable(account) > 0 ? null : "PAYMENT_REQUIRED";
}

export function chooseFullMockSource(account: BillingAccount, now: number): EntitlementSource | null {
  if (mockCreditsAvailable(account, now) > 0) return "plus_mock";
  if (purchasedCreditsAvailable(account) > 0) return "purchased_mock";
  return null;
}

export type StartRequest =
  | { kind: "interview"; session: SessionGrant }
  | { kind: "story" };

export type StartDecision =
  | { ok: true; account: BillingAccount; reservation: Reservation; session: SessionGrant; reconnect: boolean }
  | { ok: false; code: EntitlementCode };

export function decideStart(input: {
  account: BillingAccount;
  reservations: Reservation[];
  request: StartRequest;
  reservationId: string;
  sessionId: string;
  now: number;
}): StartDecision {
  const released = releaseStaleReservations(input.account, input.reservations, input.now);
  const account = released.account;
  const open = released.reservations.some((reservation) => reservation.status === "reserved" && reservation.sessionId === (input.request.kind === "interview" ? input.request.session.sessionId : input.sessionId));
  if (open) return { ok: false, code: "CREDIT_RESERVED" };

  if (input.request.kind === "story") {
    if (practiceSessionsAvailable(account, input.now) < 1) return { ok: false, code: "SESSION_LIMIT" };
    const length = voicePracticeLength("story");
    const session: SessionGrant = {
      sessionId: input.sessionId,
      interviewId: null,
      sessionClass: "voice_practice",
      practiceKind: "story",
      targetMinutes: length.targetMinutes,
      maxMinutes: length.maxMinutes,
      analysisTier: "basic",
      entitlementSource: null,
      reconnectCount: 0,
      reconnectClaimExpiresAt: null,
      candidateSpoke: false,
      firstLiveStartedAt: null,
      liveSegments: [],
      liveWallClockSeconds: 0,
      reportedUsageSeconds: null,
      createdAt: input.now,
    };
    return hold(account, session, "plus_practice", input.reservationId, input.now, false);
  }

  const session = input.request.session;
  const reconnect = reconnectDecision(session, input.now);
  if (reconnect === "allow") {
    return {
      ok: true,
      account: { ...account, openReservationIds: [...account.openReservationIds, input.reservationId], updatedAt: input.now },
      reconnect: true,
      session: { ...session, reconnectClaimExpiresAt: input.now + RESERVATION_TTL_MS },
      reservation: {
        reservationId: input.reservationId,
        sessionId: session.sessionId,
        status: "reserved",
        source: "reconnect",
        createdAt: input.now,
        expiresAt: input.now + RESERVATION_TTL_MS,
        consumedAt: null,
        liveSessionId: null,
      },
    };
  }
  if (reconnect === "busy") return { ok: false, code: "CREDIT_RESERVED" };
  if (session.entitlementSource) return { ok: false, code: "PAYMENT_REQUIRED" };

  const source = sourceFor(account, session, input.now);
  if (!source) return { ok: false, code: session.sessionClass === "voice_practice" ? "SESSION_LIMIT" : "PAYMENT_REQUIRED" };
  return hold(account, session, source, input.reservationId, input.now, false);
}

function hold(account: BillingAccount, session: SessionGrant, source: EntitlementSource, reservationId: string, now: number, reconnect: boolean): StartDecision {
  const reservation: Reservation = {
    reservationId,
    sessionId: session.sessionId,
    status: "reserved",
    source,
    createdAt: now,
    expiresAt: now + RESERVATION_TTL_MS,
    consumedAt: null,
    liveSessionId: null,
  };
  return {
    ok: true,
    reconnect,
    session,
    reservation,
    account: { ...takeHold(account, source), openReservationIds: [...account.openReservationIds, reservationId], updatedAt: now },
  };
}

function sourceFor(account: BillingAccount, session: SessionGrant, now: number): EntitlementSource | null {
  if (session.sessionClass === "quick_practice") return freeQuickAvailable(account) ? "free_quick" : null;
  if (session.sessionClass === "voice_practice") return practiceSessionsAvailable(account, now) > 0 ? "plus_practice" : null;
  return chooseFullMockSource(account, now);
}

function reconnectDecision(session: SessionGrant, now: number): "allow" | "busy" | "no" {
  if (!session.firstLiveStartedAt || session.candidateSpoke) return "no";
  if (now > session.firstLiveStartedAt + RECONNECT_WINDOW_MS) return "no";
  if (session.reconnectCount >= 1) return "no";
  if (session.reconnectClaimExpiresAt && session.reconnectClaimExpiresAt > now) return "busy";
  if (!session.entitlementSource) return "no";
  return "allow";
}

export function consumeReservation(account: BillingAccount, reservation: Reservation, now: number, liveSessionId: string): { account: BillingAccount; reservation: Reservation } | null {
  if (reservation.status !== "reserved") return null;
  let next = restoreHold(account, reservation.source);
  if (reservation.source === "free_quick") next = { ...next, freeQuickUsedAt: now };
  if (reservation.source === "plus_mock") next = { ...next, mockConsumed: next.mockConsumed + 1 };
  if (reservation.source === "purchased_mock") next = { ...next, purchasedRemaining: Math.max(0, next.purchasedRemaining - 1), lifetimeFullInterviews: next.lifetimeFullInterviews + 1 };
  if (reservation.source === "plus_mock") next = { ...next, lifetimeFullInterviews: next.lifetimeFullInterviews + 1 };
  if (reservation.source === "plus_practice") next = { ...next, practiceConsumed: next.practiceConsumed + 1 };
  next = {
    ...next,
    openReservationIds: next.openReservationIds.filter((id) => id !== reservation.reservationId),
    updatedAt: now,
  };
  return {
    account: next,
    reservation: { ...reservation, status: "consumed", consumedAt: now, liveSessionId },
  };
}

export function releaseReservation(account: BillingAccount, reservation: Reservation, now: number): { account: BillingAccount; reservation: Reservation } | null {
  if (reservation.status !== "reserved") return null;
  const next = restoreHold(account, reservation.source);
  return {
    account: {
      ...next,
      openReservationIds: next.openReservationIds.filter((id) => id !== reservation.reservationId),
      updatedAt: now,
    },
    reservation: { ...reservation, status: "released" },
  };
}

export function confirmReconnect(session: SessionGrant): SessionGrant {
  return { ...session, reconnectCount: 1, reconnectClaimExpiresAt: null };
}

export function failReconnect(session: SessionGrant): SessionGrant {
  return { ...session, reconnectClaimExpiresAt: null };
}

export function startPlusPeriod(account: BillingAccount, start: number, end: number, now: number): BillingAccount {
  return {
    ...account,
    plan: "plus",
    subscriptionStatus: "active",
    cancelAtPeriodEnd: false,
    periodStart: start,
    periodEnd: end,
    mockGrant: products.plus.grants.mockCredits,
    mockConsumed: 0,
    mockReserved: 0,
    practiceGrant: products.plus.grants.practiceSessions,
    practiceConsumed: 0,
    practiceReserved: 0,
    updatedAt: now,
  };
}

export function scheduleCancellation(account: BillingAccount, now: number): BillingAccount {
  return { ...account, cancelAtPeriodEnd: true, subscriptionStatus: "active", updatedAt: now };
}

export function grantPurchasedCredit(account: BillingAccount, now: number): BillingAccount {
  return { ...account, purchasedRemaining: account.purchasedRemaining + 1, updatedAt: now };
}

export function reverseUnusedPurchasedCredit(
  account: BillingAccount,
  now: number,
): { account: BillingAccount; reversed: boolean; needsReview: boolean } {
  if (account.purchasedReserved > 0) {
    return { account: { ...account, updatedAt: now }, reversed: false, needsReview: true };
  }
  if (account.purchasedRemaining <= 0) {
    return { account: { ...account, updatedAt: now }, reversed: false, needsReview: true };
  }
  return {
    account: { ...account, purchasedRemaining: account.purchasedRemaining - 1, updatedAt: now },
    reversed: true,
    needsReview: false,
  };
}

export function attachStripeCustomer(account: BillingAccount, customerId: string, now: number): BillingAccount {
  return { ...account, stripeCustomerId: customerId, updatedAt: now };
}

export function attachStripeSubscription(
  account: BillingAccount,
  input: { customerId?: string | null; subscriptionId: string },
  now: number,
): BillingAccount {
  return {
    ...account,
    stripeCustomerId: input.customerId || account.stripeCustomerId,
    stripeSubscriptionId: input.subscriptionId,
    updatedAt: now,
  };
}

export function markPastDue(account: BillingAccount, now: number): BillingAccount {
  if (account.plan !== "plus" && account.subscriptionStatus === null) return { ...account, updatedAt: now };
  return { ...account, subscriptionStatus: "past_due", updatedAt: now };
}

export function endPlusSubscription(account: BillingAccount, now: number): BillingAccount {
  return {
    ...account,
    plan: "free",
    subscriptionStatus: "canceled",
    cancelAtPeriodEnd: false,
    updatedAt: now,
  };
}

export function syncPlusSubscriptionState(
  account: BillingAccount,
  input: {
    customerId?: string | null;
    subscriptionId: string;
    status: BillingAccount["subscriptionStatus"];
    cancelAtPeriodEnd: boolean;
    periodStart?: number | null;
    periodEnd?: number | null;
  },
  now: number,
): BillingAccount {
  if (input.status === "canceled") return endPlusSubscription(attachStripeSubscription(account, input, now), now);
  return {
    ...account,
    plan: "plus",
    subscriptionStatus: input.status === "past_due" ? "past_due" : "active",
    cancelAtPeriodEnd: input.cancelAtPeriodEnd,
    periodStart: input.periodStart ?? account.periodStart,
    periodEnd: input.periodEnd ?? account.periodEnd,
    stripeCustomerId: input.customerId || account.stripeCustomerId,
    stripeSubscriptionId: input.subscriptionId,
    updatedAt: now,
  };
}

export function markSessionLiveStart(session: SessionGrant, source: Reservation["source"], now: number): SessionGrant {
  return {
    ...session,
    entitlementSource: source === "reconnect" ? session.entitlementSource : source,
    reconnectCount: source === "reconnect" ? 1 : session.reconnectCount,
    reconnectClaimExpiresAt: null,
    firstLiveStartedAt: session.firstLiveStartedAt ?? now,
    liveSegments: [...session.liveSegments, { liveStartedAt: now, liveEndedAt: null, wallClockSeconds: 0, reportedUsageSeconds: null }],
  };
}

export function closeLiveSegment(session: SessionGrant, endedAt: number, reportedUsageSeconds: number | null): SessionGrant {
  const segments = session.liveSegments.map((segment, index) => {
    if (index !== session.liveSegments.length - 1 || segment.liveEndedAt !== null) return segment;
    const wallClockSeconds = Math.max(0, Math.round((endedAt - segment.liveStartedAt) / 1000));
    return { ...segment, liveEndedAt: endedAt, wallClockSeconds, reportedUsageSeconds };
  });
  const liveWallClockSeconds = segments.reduce((sum, segment) => sum + segment.wallClockSeconds, 0);
  const reported = reportedUsageSeconds ?? session.reportedUsageSeconds;
  return { ...session, liveSegments: segments, liveWallClockSeconds, reportedUsageSeconds: reported };
}

export function legacyResultsReadable(createdAt: number, status: string): boolean {
  return createdAt < BILLING_LAUNCH_AT && (status === "complete" || status === "analyzing" || status === "failed");
}
