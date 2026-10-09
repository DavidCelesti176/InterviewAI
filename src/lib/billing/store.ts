import type { DocumentData, DocumentReference, Transaction } from "firebase-admin/firestore";

import { getAdminApp } from "@/lib/firebase/admin";
import {
  attachStripeCustomer,
  attachStripeSubscription,
  emptyBilling,
  closeLiveSegment,
  endPlusSubscription,
  grantPurchasedCredit,
  markPastDue,
  previewAllowed,
  projectBilling,
  reverseUnusedPurchasedCredit,
  startPlusPeriod,
  syncPlusSubscriptionState,
} from "@/lib/billing/decide";
import { abortLedger, authorizeLedger, commitLedger, lockLedger, type Ledger } from "@/lib/billing/ledger";
import type {
  AnalysisTier,
  BillingAccount,
  BillingAuditEvent,
  BillingProjection,
  EntitlementCode,
  PracticeKind,
  Reservation,
  SessionClass,
  SessionGrant,
} from "@/lib/billing/types";

async function database() {
  const { getFirestore } = await import("firebase-admin/firestore");
  return getFirestore(await getAdminApp());
}

function accountRef(db: Awaited<ReturnType<typeof database>>, uid: string) {
  return db.doc(`users/${uid}/billing/main`);
}

function sessionRef(db: Awaited<ReturnType<typeof database>>, uid: string, sessionId: string) {
  return accountRef(db, uid).collection("sessions").doc(sessionId);
}

function reservationRef(db: Awaited<ReturnType<typeof database>>, uid: string, reservationId: string) {
  return accountRef(db, uid).collection("reservations").doc(reservationId);
}

function linkRef(db: Awaited<ReturnType<typeof database>>, uid: string, interviewId: string) {
  return accountRef(db, uid).collection("interviewLinks").doc(interviewId);
}

function eventRef(db: Awaited<ReturnType<typeof database>>, uid: string, eventId: string) {
  return accountRef(db, uid).collection("events").doc(eventId);
}

function customerMapRef(db: Awaited<ReturnType<typeof database>>, customerId: string) {
  return db.doc(`stripeCustomers/${customerId}`);
}

export async function billingProjection(uid: string, now = Date.now()): Promise<BillingProjection> {
  const account = await readAccount(uid, now);
  return projectBilling(account, now);
}

export async function previewAccess(uid: string, minutes: number, now = Date.now()): Promise<EntitlementCode | null> {
  const account = await readAccount(uid, now);
  return previewAllowed(account, minutes, now);
}

async function readAccount(uid: string, now: number): Promise<BillingAccount> {
  const db = await database();
  const snap = await accountRef(db, uid).get();
  return snap.exists ? accountFrom(snap.data() ?? {}) : emptyBilling(now);
}

export async function createInterviewGrant(input: {
  uid: string;
  interviewId: string;
  sessionClass: SessionClass;
  practiceKind: PracticeKind;
  targetMinutes: number;
  maxMinutes: number;
  analysisTier: AnalysisTier;
}): Promise<string> {
  const db = await database();
  const link = linkRef(db, input.uid, input.interviewId);
  const sessionId = crypto.randomUUID();
  const now = Date.now();
  const session: SessionGrant = {
    sessionId,
    interviewId: input.interviewId,
    sessionClass: input.sessionClass,
    practiceKind: input.practiceKind,
    targetMinutes: input.targetMinutes,
    maxMinutes: input.maxMinutes,
    analysisTier: input.analysisTier,
    entitlementSource: null,
    reconnectCount: 0,
    reconnectClaimExpiresAt: null,
    candidateSpoke: false,
    firstLiveStartedAt: null,
    liveSegments: [],
    liveWallClockSeconds: 0,
    reportedUsageSeconds: null,
    createdAt: now,
  };
  return db.runTransaction(async (tx) => {
    const existing = await tx.get(link);
    const current = existing.get("sessionId");
    if (existing.exists && typeof current === "string" && current) return current;
    tx.set(sessionRef(db, input.uid, sessionId), session);
    tx.set(link, { sessionId });
    return sessionId;
  });
}

export async function readSession(uid: string, sessionId: string): Promise<SessionGrant | null> {
  const db = await database();
  const snap = await sessionRef(db, uid, sessionId).get();
  if (!snap.exists) return null;
  return sessionFrom(snap.data() ?? {}, sessionId);
}

export async function readSessionForInterview(uid: string, interviewId: string): Promise<SessionGrant | null> {
  const db = await database();
  const link = await linkRef(db, uid, interviewId).get();
  const sessionId = link.get("sessionId");
  if (!link.exists || typeof sessionId !== "string" || !sessionId) return null;
  return readSession(uid, sessionId);
}

export type AuthorizedLive = {
  ok: true;
  sessionId: string;
  reservationId: string;
  targetMinutes: number;
  maxMinutes: number;
  ceilingMinutes: number;
  reconnect: boolean;
};

export async function authorizeLive(
  uid: string,
  input: { interviewId?: string | null; story?: boolean },
): Promise<AuthorizedLive | { ok: false; code: EntitlementCode }> {
  const db = await database();
  const now = Date.now();
  try {
    return await db.runTransaction(async (tx) => {
      const accountDoc = accountRef(db, uid);
      const accountSnap = await tx.get(accountDoc);
      const account = accountSnap.exists ? accountFrom(accountSnap.data() ?? {}) : emptyBilling(now);
      const reservations = await openReservations(db, tx, uid, account.openReservationIds);
      const sessions: Record<string, SessionGrant> = {};
      const interviewId = input.story ? "" : (input.interviewId?.trim() ?? "");
      if (interviewId) {
        const link = await tx.get(linkRef(db, uid, interviewId));
        const linked = link.get("sessionId");
        if (link.exists && typeof linked === "string" && linked) {
          const sessionSnap = await tx.get(sessionRef(db, uid, linked));
          if (sessionSnap.exists) sessions[linked] = sessionFrom(sessionSnap.data() ?? {}, linked);
        }
      }
      const before = ledgerFrom(account, sessions, reservations);
      const outcome = authorizeLedger(before, input, now, { reservationId: crypto.randomUUID(), sessionId: crypto.randomUUID() });
      writeLedger(db, tx, uid, accountDoc, before, outcome.ledger);
      return outcome.result;
    });
  } catch (error) {
    console.error("Entitlement check failed", error instanceof Error ? error.message : "error");
    return { ok: false, code: "ENTITLEMENT_CHECK_FAILED" };
  }
}

export async function lockReservation(uid: string, reservationId: string, sessionId: string): Promise<SessionGrant | null> {
  const db = await database();
  const now = Date.now();
  return db.runTransaction(async (tx) => {
    const loaded = await loadHold(db, tx, uid, reservationId);
    if (!loaded) return null;
    const sessionSnap = await tx.get(sessionRef(db, uid, sessionId));
    if (!sessionSnap.exists) return null;
    const before = ledgerFrom(loaded.account, { [sessionId]: sessionFrom(sessionSnap.data() ?? {}, sessionId) }, [loaded.reservation]);
    const locked = lockLedger(before, reservationId, sessionId, now);
    if (!locked.grant) return null;
    tx.set(reservationRef(db, uid, reservationId), locked.ledger.reservations[reservationId] ?? loaded.reservation);
    return locked.grant;
  });
}

export async function commitLive(uid: string, reservationId: string, liveSessionId: string): Promise<boolean> {
  const db = await database();
  const now = Date.now();
  return db.runTransaction(async (tx) => {
    const loaded = await loadHold(db, tx, uid, reservationId);
    if (!loaded) return false;
    const sessionSnap = await tx.get(sessionRef(db, uid, loaded.reservation.sessionId));
    if (!sessionSnap.exists) return false;
    const sessionId = loaded.reservation.sessionId;
    const before = ledgerFrom(loaded.account, { [sessionId]: sessionFrom(sessionSnap.data() ?? {}, sessionId) }, [loaded.reservation]);
    const committed = commitLedger(before, reservationId, liveSessionId, now);
    if (!committed.committed) return false;
    writeLedger(db, tx, uid, accountRef(db, uid), before, committed.ledger);
    return true;
  });
}

export async function abortLive(uid: string, reservationId: string): Promise<void> {
  const db = await database();
  const now = Date.now();
  await db.runTransaction(async (tx) => {
    const loaded = await loadHold(db, tx, uid, reservationId);
    if (!loaded || loaded.reservation.status !== "reserved") return;
    const sessionSnap = await tx.get(sessionRef(db, uid, loaded.reservation.sessionId));
    const sessionId = loaded.reservation.sessionId;
    const sessions = sessionSnap.exists ? { [sessionId]: sessionFrom(sessionSnap.data() ?? {}, sessionId) } : {};
    const before = ledgerFrom(loaded.account, sessions, [loaded.reservation]);
    writeLedger(db, tx, uid, accountRef(db, uid), before, abortLedger(before, reservationId, now));
  });
}

export async function markCandidateSpoke(uid: string, interviewId: string): Promise<void> {
  const session = await readSessionForInterview(uid, interviewId);
  if (!session || session.candidateSpoke) return;
  const db = await database();
  await sessionRef(db, uid, session.sessionId).set({ candidateSpoke: true }, { merge: true });
}

export async function closeLiveUsage(uid: string, interviewId: string, endedAt: number, reportedUsageSeconds: number | null): Promise<void> {
  const session = await readSessionForInterview(uid, interviewId);
  if (!session) return;
  await closeSession(uid, session.sessionId, endedAt, reportedUsageSeconds);
}

export async function closeLiveUsageBySession(uid: string, sessionId: string, endedAt: number, reportedUsageSeconds: number | null): Promise<void> {
  await closeSession(uid, sessionId, endedAt, reportedUsageSeconds);
}

async function closeSession(uid: string, sessionId: string, endedAt: number, reportedUsageSeconds: number | null): Promise<void> {
  const db = await database();
  await db.runTransaction(async (tx) => {
    const ref = sessionRef(db, uid, sessionId);
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    tx.set(ref, closeLiveSegment(sessionFrom(snap.data() ?? {}, sessionId), endedAt, reportedUsageSeconds));
  });
}

export async function applyDevBilling(uid: string, patch: Partial<BillingAccount>, now = Date.now()): Promise<BillingProjection> {
  const db = await database();
  const ref = accountRef(db, uid);
  const snap = await ref.get();
  const current = snap.exists ? accountFrom(snap.data() ?? {}) : emptyBilling(now);
  const next = { ...current, ...patch, updatedAt: now };
  await ref.set(next);
  return projectBilling(next, now);
}

export function plusAccount(now: number, end: number): BillingAccount {
  return startPlusPeriod(emptyBilling(now), now, end, now);
}

export type StripeGrantResult = {
  applied: boolean;
  reason: "applied" | "duplicate_event" | "duplicate_invariant" | "missing_user";
};

export async function readBillingAccount(uid: string, now = Date.now()): Promise<BillingAccount> {
  return readAccount(uid, now);
}

export async function lookupUidByStripeCustomer(customerId: string): Promise<string | null> {
  if (!customerId) return null;
  const db = await database();
  const snap = await customerMapRef(db, customerId).get();
  const uid = snap.get("uid");
  return snap.exists && typeof uid === "string" && uid ? uid : null;
}

export async function persistStripeCustomer(uid: string, customerId: string, now = Date.now()): Promise<string> {
  const db = await database();
  const ref = accountRef(db, uid);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? accountFrom(snap.data() ?? {}) : emptyBilling(now);
    if (current.stripeCustomerId) return current.stripeCustomerId;
    tx.set(ref, attachStripeCustomer(current, customerId, now));
    tx.set(customerMapRef(db, customerId), { uid, createdAt: now }, { merge: true });
    return customerId;
  });
}

export async function grantPurchasedMockFromStripe(input: {
  uid: string;
  eventId: string;
  checkoutSessionId: string;
  customerId?: string | null;
}): Promise<StripeGrantResult> {
  return mutateBilling(input.uid, input.eventId, [`checkout:${input.checkoutSessionId}`], (account, now) => ({
    account: grantPurchasedCredit(
      input.customerId ? attachStripeCustomer(account, input.customerId, now) : account,
      now,
    ),
    event: {
      name: "credit_granted",
      at: now,
      stripeEventId: input.eventId,
      source: "purchased_mock",
      checkoutSessionId: input.checkoutSessionId,
    },
  }));
}

export async function syncPlusIdsFromStripe(input: {
  uid: string;
  eventId: string;
  customerId: string;
  subscriptionId: string;
}): Promise<StripeGrantResult> {
  return mutateBilling(input.uid, input.eventId, [], (account, now) => ({
    account: attachStripeSubscription(account, input, now),
    event: {
      name: "subscription_synced",
      at: now,
      stripeEventId: input.eventId,
      source: "plus",
      subscriptionId: input.subscriptionId,
    },
  }));
}

export async function grantPlusPeriodFromStripe(input: {
  uid: string;
  eventId: string;
  customerId?: string | null;
  subscriptionId: string;
  invoiceId: string;
  periodStart: number;
  periodEnd: number;
}): Promise<StripeGrantResult> {
  return mutateBilling(input.uid, input.eventId, [`invoice:${input.invoiceId}`, `period:${input.subscriptionId}:${input.periodStart}`], (account, now) => ({
    account: startPlusPeriod(
      attachStripeSubscription(account, { customerId: input.customerId, subscriptionId: input.subscriptionId }, now),
      input.periodStart,
      input.periodEnd,
      now,
    ),
    event: {
      name: "subscription_period_started",
      at: now,
      stripeEventId: input.eventId,
      source: "plus",
      invoiceId: input.invoiceId,
      subscriptionId: input.subscriptionId,
    },
  }));
}

export async function markPlusPastDueFromStripe(input: {
  uid: string;
  eventId: string;
  customerId?: string | null;
  subscriptionId?: string | null;
}): Promise<StripeGrantResult> {
  return mutateBilling(input.uid, input.eventId, [], (account, now) => ({
    account: markPastDue(
      input.subscriptionId
        ? attachStripeSubscription(account, { customerId: input.customerId, subscriptionId: input.subscriptionId }, now)
        : account,
      now,
    ),
    event: {
      name: "subscription_past_due",
      at: now,
      stripeEventId: input.eventId,
      source: "plus",
      subscriptionId: input.subscriptionId,
    },
  }));
}

export async function syncPlusSubscriptionFromStripe(input: {
  uid: string;
  eventId: string;
  customerId?: string | null;
  subscriptionId: string;
  status: BillingAccount["subscriptionStatus"];
  cancelAtPeriodEnd: boolean;
  periodStart?: number | null;
  periodEnd?: number | null;
}): Promise<StripeGrantResult> {
  return mutateBilling(input.uid, input.eventId, [], (account, now) => ({
    account: syncPlusSubscriptionState(account, input, now),
    event: {
      name: input.status === "canceled" ? "subscription_canceled" : "subscription_synced",
      at: now,
      stripeEventId: input.eventId,
      source: "plus",
      subscriptionId: input.subscriptionId,
    },
  }));
}

export async function endPlusSubscriptionFromStripe(input: {
  uid: string;
  eventId: string;
  customerId?: string | null;
  subscriptionId?: string | null;
}): Promise<StripeGrantResult> {
  return mutateBilling(input.uid, input.eventId, [], (account, now) => ({
    account: endPlusSubscription(
      input.subscriptionId
        ? attachStripeSubscription(account, { customerId: input.customerId, subscriptionId: input.subscriptionId }, now)
        : account,
      now,
    ),
    event: {
      name: "subscription_canceled",
      at: now,
      stripeEventId: input.eventId,
      source: "plus",
      subscriptionId: input.subscriptionId,
    },
  }));
}

export async function refundPurchasedMockFromStripe(input: {
  uid: string;
  eventId: string;
}): Promise<StripeGrantResult> {
  return mutateBilling(input.uid, input.eventId, [], (account, now) => {
    const reversed = reverseUnusedPurchasedCredit(account, now);
    return {
      account: reversed.account,
      event: {
        name: reversed.needsReview ? "refund_review" : "refund",
        at: now,
        stripeEventId: input.eventId,
        source: "purchased_mock",
        needsReview: reversed.needsReview,
      },
    };
  });
}

export async function recordStripeReviewEvent(input: { uid: string; eventId: string }): Promise<StripeGrantResult> {
  return mutateBilling(input.uid, input.eventId, [], (account, now) => ({
    account: { ...account, updatedAt: now },
    event: {
      name: "refund_review",
      at: now,
      stripeEventId: input.eventId,
      source: "stripe",
      needsReview: true,
    },
  }));
}

async function mutateBilling(
  uid: string,
  eventId: string,
  extraKeys: string[],
  apply: (account: BillingAccount, now: number) => { account: BillingAccount; event: BillingAuditEvent },
): Promise<StripeGrantResult> {
  if (!uid) return { applied: false, reason: "missing_user" };
  const db = await database();
  const now = Date.now();
  return db.runTransaction(async (tx) => {
    const eventDoc = eventRef(db, uid, eventId);
    if ((await tx.get(eventDoc)).exists) return { applied: false, reason: "duplicate_event" as const };
    for (const key of extraKeys) {
      if ((await tx.get(eventRef(db, uid, key))).exists) {
        tx.set(eventDoc, { name: "credit_granted", at: now, stripeEventId: eventId, source: "duplicate_invariant" });
        return { applied: false, reason: "duplicate_invariant" as const };
      }
    }
    const accountDoc = accountRef(db, uid);
    const snap = await tx.get(accountDoc);
    const current = snap.exists ? accountFrom(snap.data() ?? {}) : emptyBilling(now);
    const next = apply(current, now);
    tx.set(accountDoc, next.account);
    tx.set(eventDoc, next.event);
    for (const key of extraKeys) {
      tx.set(eventRef(db, uid, key), { ...next.event, stripeEventId: eventId, invariantKey: key });
    }
    if (next.account.stripeCustomerId) {
      tx.set(customerMapRef(db, next.account.stripeCustomerId), { uid, createdAt: now }, { merge: true });
    }
    return { applied: true, reason: "applied" as const };
  });
}

function ledgerFrom(account: BillingAccount, sessions: Record<string, SessionGrant>, reservations: Reservation[]): Ledger {
  return {
    account,
    sessions,
    reservations: Object.fromEntries(reservations.map((reservation) => [reservation.reservationId, reservation])),
    events: {},
  };
}

function writeLedger(
  db: Awaited<ReturnType<typeof database>>,
  tx: Transaction,
  uid: string,
  accountDoc: DocumentReference,
  before: Ledger,
  after: Ledger,
) {
  if (before.account !== after.account) tx.set(accountDoc, after.account);
  for (const [id, reservation] of Object.entries(after.reservations)) {
    if (before.reservations[id] !== reservation) tx.set(reservationRef(db, uid, id), reservation);
  }
  for (const [id, session] of Object.entries(after.sessions)) {
    if (before.sessions[id] !== session) tx.set(sessionRef(db, uid, id), session);
  }
  for (const [id, event] of Object.entries(after.events)) {
    if (!before.events[id]) tx.set(eventRef(db, uid, id), event);
  }
}

async function loadHold(
  db: Awaited<ReturnType<typeof database>>,
  tx: Transaction,
  uid: string,
  reservationId: string,
): Promise<{ account: BillingAccount; reservation: Reservation } | null> {
  const accountSnap = await tx.get(accountRef(db, uid));
  const reservationSnap = await tx.get(reservationRef(db, uid, reservationId));
  if (!accountSnap.exists || !reservationSnap.exists) return null;
  return { account: accountFrom(accountSnap.data() ?? {}), reservation: reservationFrom(reservationSnap.data() ?? {}, reservationId) };
}

async function openReservations(
  db: Awaited<ReturnType<typeof database>>,
  tx: Transaction,
  uid: string,
  ids: string[],
): Promise<Reservation[]> {
  const reservations: Reservation[] = [];
  for (const id of ids.slice(0, 10)) {
    const snap = await tx.get(reservationRef(db, uid, id));
    if (snap.exists) reservations.push(reservationFrom(snap.data() ?? {}, id));
  }
  return reservations;
}

function accountFrom(data: DocumentData): BillingAccount {
  const base = emptyBilling(Date.now());
  return {
    ...base,
    plan: data.plan === "plus" ? "plus" : "free",
    subscriptionStatus: data.subscriptionStatus === "active" || data.subscriptionStatus === "past_due" || data.subscriptionStatus === "canceled" ? data.subscriptionStatus : null,
    cancelAtPeriodEnd: data.cancelAtPeriodEnd === true,
    periodStart: numberOrNull(data.periodStart),
    periodEnd: numberOrNull(data.periodEnd),
    mockGrant: numberOr(data.mockGrant),
    mockConsumed: numberOr(data.mockConsumed),
    mockReserved: numberOr(data.mockReserved),
    practiceGrant: numberOr(data.practiceGrant),
    practiceConsumed: numberOr(data.practiceConsumed),
    practiceReserved: numberOr(data.practiceReserved),
    purchasedRemaining: numberOr(data.purchasedRemaining),
    purchasedReserved: numberOr(data.purchasedReserved),
    freeQuickUsedAt: numberOrNull(data.freeQuickUsedAt),
    freeQuickReserved: numberOr(data.freeQuickReserved),
    lifetimeFullInterviews: numberOr(data.lifetimeFullInterviews),
    stripeCustomerId: typeof data.stripeCustomerId === "string" ? data.stripeCustomerId : null,
    stripeSubscriptionId: typeof data.stripeSubscriptionId === "string" ? data.stripeSubscriptionId : null,
    openReservationIds: Array.isArray(data.openReservationIds) ? data.openReservationIds.filter((id): id is string => typeof id === "string").slice(0, 10) : [],
    updatedAt: numberOr(data.updatedAt),
  };
}

function sessionFrom(data: DocumentData, sessionId: string): SessionGrant {
  return {
    sessionId,
    interviewId: typeof data.interviewId === "string" ? data.interviewId : null,
    sessionClass: data.sessionClass === "quick_practice" || data.sessionClass === "voice_practice" ? data.sessionClass : "full_mock",
    practiceKind: data.practiceKind === "story" || data.practiceKind === "weak_answer" ? data.practiceKind : null,
    targetMinutes: numberOr(data.targetMinutes) || 10,
    maxMinutes: numberOr(data.maxMinutes) || 10,
    analysisTier: data.analysisTier === "full" ? "full" : "basic",
    entitlementSource:
      data.entitlementSource === "free_quick" || data.entitlementSource === "plus_mock" || data.entitlementSource === "purchased_mock" || data.entitlementSource === "plus_practice"
        ? data.entitlementSource
        : null,
    reconnectCount: numberOr(data.reconnectCount),
    reconnectClaimExpiresAt: numberOrNull(data.reconnectClaimExpiresAt),
    candidateSpoke: data.candidateSpoke === true,
    firstLiveStartedAt: numberOrNull(data.firstLiveStartedAt),
    liveSegments: Array.isArray(data.liveSegments) ? data.liveSegments.filter(isSegment) : [],
    liveWallClockSeconds: numberOr(data.liveWallClockSeconds),
    reportedUsageSeconds: numberOrNull(data.reportedUsageSeconds),
    createdAt: numberOr(data.createdAt),
  };
}

function reservationFrom(data: DocumentData, reservationId: string): Reservation {
  const source = data.source;
  return {
    reservationId,
    sessionId: typeof data.sessionId === "string" ? data.sessionId : "",
    status: data.status === "consumed" || data.status === "released" ? data.status : "reserved",
    source: source === "free_quick" || source === "plus_mock" || source === "purchased_mock" || source === "plus_practice" || source === "reconnect" ? source : "plus_mock",
    createdAt: numberOr(data.createdAt),
    expiresAt: numberOr(data.expiresAt),
    consumedAt: numberOrNull(data.consumedAt),
    liveSessionId: typeof data.liveSessionId === "string" ? data.liveSessionId : null,
  };
}

function isSegment(value: unknown): value is SessionGrant["liveSegments"][number] {
  if (!value || typeof value !== "object") return false;
  return typeof (value as { liveStartedAt?: unknown }).liveStartedAt === "number";
}

function numberOr(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
