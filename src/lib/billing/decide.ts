import {
  effectiveAccount,
  migrateAccount,
  minutePools,
  PACK_SECONDS,
  PLUS_PERIOD_SECONDS,
  reserveMinutes,
  settleReservation,
  staleUsage,
} from "@/lib/billing/minutes";
import {
  BILLING_LAUNCH_AT,
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
    freeQuickSecondsGrant: 600,
    freeQuickSecondsConsumed: 0,
    freeQuickSecondsReserved: 0,
    monthlySecondsGrant: 0,
    monthlySecondsConsumed: 0,
    monthlySecondsReserved: 0,
    purchasedSecondsGrant: 0,
    purchasedSecondsConsumed: 0,
    purchasedSecondsReserved: 0,
    minutesMigratedAt: now,
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
  const pools = minutePools(account, now);
  return {
    plan: account.plan,
    mockCreditsAvailable: pools.monthly > 0 ? 1 : 0,
    practiceSessionsAvailable: 0,
    purchasedCreditsAvailable: pools.purchased > 0 ? 1 : 0,
    monthlySecondsAvailable: pools.monthly,
    purchasedSecondsAvailable: pools.purchased,
    paidSecondsAvailable: pools.monthly + pools.purchased,
    freeQuickSecondsAvailable: pools.free,
    periodEnd: account.periodEnd,
    cancelAtPeriodEnd: account.cancelAtPeriodEnd,
    freeQuickAvailable: pools.free > 0,
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
  let next = effectiveAccount(account, now);
  const updated = reservations.map((reservation) => {
    const stale = staleUsage(reservation, now);
    if (!stale.settle) return reservation;
    const settled = settleReservation(next, reservation, stale.consumedSeconds, now);
    if (!settled) return reservation;
    next = settled.account;
    return settled.reservation;
  });
  return { account: { ...next, openReservationIds: updated.filter((reservation) => reservation.status === "reserved").map((reservation) => reservation.reservationId), updatedAt: now }, reservations: updated };
}

export function previewAllowed(account: BillingAccount, minutes: number, now: number): EntitlementCode | null {
  if (minutes !== QUICK_MINUTES && minutes !== FULL_MINUTES) return "DURATION_NOT_INCLUDED";
  const pools = minutePools(account, now);
  if (minutes === QUICK_MINUTES) return pools.free > 0 ? null : "PAYMENT_REQUIRED";
  return pools.monthly + pools.purchased > 0 ? null : "PAYMENT_REQUIRED";
}

export function chooseFullMockSource(account: BillingAccount, now: number): EntitlementSource | null {
  const pools = minutePools(account, now);
  if (pools.monthly > 0) return "plus_mock";
  if (pools.purchased > 0) return "purchased_mock";
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
  const sessionId = input.request.kind === "interview" ? input.request.session.sessionId : input.sessionId;
  const openHold = released.reservations.find((reservation) => reservation.status === "reserved" && reservation.sessionId === sessionId && reservation.source !== "reconnect");
  if (openHold && input.request.kind === "interview") {
    const reconnect = reconnectDecision(input.request.session, input.now);
    if (reconnect === "allow") return reconnectHold(account, input.request.session, input.reservationId, input.now);
    return { ok: false, code: "CREDIT_RESERVED" };
  }
  if (openHold) return { ok: false, code: "CREDIT_RESERVED" };

  if (input.request.kind === "story") {
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
    return reserveSession(account, session, input.reservationId, input.now);
  }

  const session = input.request.session;
  const reconnect = reconnectDecision(session, input.now);
  if (reconnect === "allow") return reconnectHold(account, session, input.reservationId, input.now);
  if (reconnect === "busy") return { ok: false, code: "CREDIT_RESERVED" };
  if (session.entitlementSource) return { ok: false, code: "PAYMENT_REQUIRED" };
  return reserveSession(account, session, input.reservationId, input.now);
}

function reserveSession(account: BillingAccount, session: SessionGrant, reservationId: string, now: number): StartDecision {
  const pool = session.sessionClass === "quick_practice" ? "free" : "paid";
  const reserved = reserveMinutes(account, Math.round(session.maxMinutes * 60), pool, now);
  if (!reserved.ok) return reserved;
  const hold = reserved.reserved;
  const source: EntitlementSource = hold.freeSeconds > 0 ? "free_quick" : hold.monthlySeconds > 0 ? "plus_mock" : "purchased_mock";
  return {
    ok: true,
    reconnect: false,
    session: { ...session, authorizedSeconds: hold.authorizedSeconds },
    reservation: reservationShell(reservationId, session.sessionId, source, now, { ...hold, periodStart: hold.account.periodStart }),
    account: { ...hold.account, openReservationIds: [...hold.account.openReservationIds, reservationId] },
  };
}

function reconnectHold(account: BillingAccount, session: SessionGrant, reservationId: string, now: number): StartDecision {
  const migrated = migrateAccount(account, now);
  return {
    ok: true,
    reconnect: true,
    account: { ...migrated, openReservationIds: [...migrated.openReservationIds, reservationId], updatedAt: now },
    session: { ...session, reconnectClaimExpiresAt: now + RESERVATION_TTL_MS },
    reservation: reservationShell(reservationId, session.sessionId, "reconnect", now, {
      authorizedSeconds: 0,
      freeSeconds: 0,
      monthlySeconds: 0,
      purchasedSeconds: 0,
      periodStart: null,
    }),
  };
}

function reservationShell(
  reservationId: string,
  sessionId: string,
  source: Reservation["source"],
  now: number,
  hold: { authorizedSeconds: number; freeSeconds: number; monthlySeconds: number; purchasedSeconds: number; periodStart?: number | null },
): Reservation {
  return {
    reservationId,
    sessionId,
    status: "reserved",
    source,
    createdAt: now,
    expiresAt: now + RESERVATION_TTL_MS,
    consumedAt: null,
    liveSessionId: null,
    authorizedSeconds: hold.authorizedSeconds,
    freeSeconds: hold.freeSeconds,
    monthlySeconds: hold.monthlySeconds,
    purchasedSeconds: hold.purchasedSeconds,
    monthlyPeriodStart: hold.monthlySeconds > 0 ? (hold.periodStart ?? null) : null,
    liveCreatedAt: null,
    startedAt: null,
    lastHeartbeatAt: null,
    consumedSeconds: null,
  };
}

function reconnectDecision(session: SessionGrant, now: number): "allow" | "busy" | "no" {
  if (!session.firstLiveStartedAt || session.candidateSpoke) return "no";
  if (now > session.firstLiveStartedAt + RECONNECT_WINDOW_MS) return "no";
  if (session.reconnectCount >= 1) return "no";
  if (session.reconnectClaimExpiresAt && session.reconnectClaimExpiresAt > now) return "busy";
  if (!session.entitlementSource) return "no";
  return "allow";
}

export function consumeReservation(account: BillingAccount, reservation: Reservation, now: number, liveSessionId: string, consumedSeconds = reservation.authorizedSeconds): { account: BillingAccount; reservation: Reservation } | null {
  const settled = settleReservation(account, reservation, consumedSeconds, now);
  if (!settled) return null;
  if (settled.reservation.consumedSeconds && settled.reservation.consumedSeconds > 0 && (reservation.source === "plus_mock" || reservation.source === "purchased_mock")) {
    settled.account = { ...settled.account, lifetimeFullInterviews: account.lifetimeFullInterviews + 1 };
  }
  return { account: settled.account, reservation: { ...settled.reservation, liveSessionId: liveSessionId || reservation.liveSessionId } };
}

export function releaseReservation(account: BillingAccount, reservation: Reservation, now: number): { account: BillingAccount; reservation: Reservation } | null {
  return settleReservation(account, reservation, 0, now);
}

export function confirmReconnect(session: SessionGrant): SessionGrant {
  return { ...session, reconnectCount: 1, reconnectClaimExpiresAt: null };
}

export function failReconnect(session: SessionGrant): SessionGrant {
  return { ...session, reconnectClaimExpiresAt: null };
}

export function plusRenewalKeys(input: { invoiceId: string; subscriptionId: string; periodStart: number }): string[] {
  return [`invoice:${input.invoiceId}`, `period:${input.subscriptionId}:${input.periodStart}`];
}

export function renewalEventDecision(
  seen: { eventIds: string[]; keys: string[] },
  input: { eventId: string; invoiceId: string; subscriptionId: string; periodStart: number },
): "apply" | "duplicate_event" | "duplicate_invariant" {
  if (seen.eventIds.includes(input.eventId)) return "duplicate_event";
  if (plusRenewalKeys(input).some((key) => seen.keys.includes(key))) return "duplicate_invariant";
  return "apply";
}

/**
 * Opens a Plus period without taking monthly seconds from a reservation that belongs to another period.
 * Reservations are returned unchanged. A repeated call for the same period does not reset that period's counters.
 * Old monthly seconds stay on their reservation and expire with that period; they are not copied onto the new grant.
 */
export function renewPlusPeriod(
  account: BillingAccount,
  reservations: Reservation[],
  start: number,
  end: number,
  now: number,
): { account: BillingAccount; reservations: Reservation[] } {
  const migrated = migrateAccount(account, now);
  const samePeriod =
    migrated.plan === "plus" &&
    migrated.subscriptionStatus === "active" &&
    migrated.periodStart === start &&
    migrated.periodEnd === end &&
    migrated.monthlySecondsGrant === PLUS_PERIOD_SECONDS;
  if (samePeriod) return { account: migrated, reservations };
  const reservedForNewPeriod = reservations
    .filter((reservation) => reservation.status === "reserved" && reservation.monthlyPeriodStart === start)
    .reduce((sum, reservation) => sum + reservation.monthlySeconds, 0);
  return {
    reservations,
    account: {
      ...migrated,
      plan: "plus",
      subscriptionStatus: "active",
      cancelAtPeriodEnd: false,
      periodStart: start,
      periodEnd: end,
      monthlySecondsGrant: PLUS_PERIOD_SECONDS,
      monthlySecondsConsumed: 0,
      monthlySecondsReserved: reservedForNewPeriod,
      mockGrant: 0,
      mockConsumed: 0,
      mockReserved: 0,
      practiceGrant: 0,
      practiceConsumed: 0,
      practiceReserved: 0,
      minutesMigratedAt: migrated.minutesMigratedAt ?? now,
      updatedAt: now,
    },
  };
}

export function startPlusPeriod(account: BillingAccount, start: number, end: number, now: number, reservations: Reservation[] = []): BillingAccount {
  return renewPlusPeriod(account, reservations, start, end, now).account;
}

export function scheduleCancellation(account: BillingAccount, now: number): BillingAccount {
  return { ...account, cancelAtPeriodEnd: true, subscriptionStatus: "active", updatedAt: now };
}

export function grantPurchasedCredit(account: BillingAccount, now: number): BillingAccount {
  const migrated = migrateAccount(account, now);
  return { ...migrated, purchasedSecondsGrant: migrated.purchasedSecondsGrant + PACK_SECONDS, updatedAt: now };
}

export function reverseUnusedPurchasedCredit(
  account: BillingAccount,
  now: number,
): { account: BillingAccount; reversed: boolean; needsReview: boolean } {
  const migrated = migrateAccount(account, now);
  const available = migrated.purchasedSecondsGrant - migrated.purchasedSecondsConsumed - migrated.purchasedSecondsReserved;
  if (migrated.purchasedSecondsReserved > 0 || available < PACK_SECONDS) {
    return { account: { ...migrated, updatedAt: now }, reversed: false, needsReview: true };
  }
  return {
    account: { ...migrated, purchasedSecondsGrant: migrated.purchasedSecondsGrant - PACK_SECONDS, updatedAt: now },
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
