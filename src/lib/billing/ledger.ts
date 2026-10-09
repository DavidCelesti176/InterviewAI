import { decideStart, failReconnect, markSessionLiveStart, releaseReservation, releaseStaleReservations, consumeReservation } from "@/lib/billing/decide";
import { safetyCeilingMinutes } from "@/lib/billing/products";
import type { BillingAccount, EntitlementCode, Reservation, SessionGrant } from "@/lib/billing/types";

export type LedgerEvent = {
  name: "credit_reserved" | "credit_consumed" | "credit_released";
  at: number;
  reservationId: string;
  source: string;
};

export type Ledger = {
  account: BillingAccount;
  sessions: Record<string, SessionGrant>;
  reservations: Record<string, Reservation>;
  events: Record<string, LedgerEvent>;
};

export type AuthorizeResult =
  | { ok: true; sessionId: string; reservationId: string; targetMinutes: number; maxMinutes: number; ceilingMinutes: number; reconnect: boolean }
  | { ok: false; code: EntitlementCode };

export function authorizeLedger(
  ledger: Ledger,
  input: { interviewId?: string | null; story?: boolean },
  now: number,
  ids: { reservationId: string; sessionId: string },
): { ledger: Ledger; result: AuthorizeResult } {
  const before = Object.values(ledger.reservations);
  const recovered = releaseStaleReservations(ledger.account, before, now);
  let next = withReservations(ledger, recovered.account, recovered.reservations);
  next = withReleaseEvents(next, newlyReleased(before, recovered.reservations), now);
  if (input.story) {
    const decision = decideStart({
      account: next.account,
      reservations: Object.values(next.reservations),
      request: { kind: "story" },
      reservationId: ids.reservationId,
      sessionId: ids.sessionId,
      now,
    });
    if (!decision.ok) return { ledger: next, result: decision };
    return { ledger: applyDecision(next, decision), result: okResult(decision) };
  }
  const interviewId = input.interviewId?.trim() ?? "";
  const session = interviewId ? Object.values(next.sessions).find((item) => item.interviewId === interviewId) : undefined;
  if (!interviewId || !session) return { ledger: next, result: { ok: false, code: "PAYMENT_REQUIRED" } };
  const decision = decideStart({
    account: next.account,
    reservations: Object.values(next.reservations),
    request: { kind: "interview", session },
    reservationId: ids.reservationId,
    sessionId: session.sessionId,
    now,
  });
  if (!decision.ok) return { ledger: next, result: decision };
  return { ledger: applyDecision(next, decision), result: okResult(decision) };
}

export function lockLedger(ledger: Ledger, reservationId: string, sessionId: string, now: number): { ledger: Ledger; grant: SessionGrant | null } {
  const reservation = ledger.reservations[reservationId];
  const session = ledger.sessions[sessionId];
  if (!reservation || !session) return { ledger, grant: null };
  if (reservation.status !== "reserved" || reservation.sessionId !== sessionId) return { ledger, grant: null };
  if (reservation.expiresAt <= now || reservation.liveSessionId) return { ledger, grant: null };
  return {
    ledger: {
      ...ledger,
      reservations: { ...ledger.reservations, [reservationId]: { ...reservation, liveSessionId: "pending" } },
    },
    grant: session,
  };
}

export function commitLedger(ledger: Ledger, reservationId: string, liveSessionId: string, now: number): { ledger: Ledger; committed: boolean } {
  const reservation = ledger.reservations[reservationId];
  if (!reservation || reservation.status !== "reserved") return { ledger, committed: false };
  const consumed = consumeReservation(ledger.account, reservation, now, liveSessionId);
  if (!consumed) return { ledger, committed: false };
  const session = ledger.sessions[reservation.sessionId];
  if (!session) return { ledger, committed: false };
  const eventId = `consumed-${reservationId}`;
  return {
    committed: true,
    ledger: {
      account: consumed.account,
      sessions: {
        ...ledger.sessions,
        [session.sessionId]: markSessionLiveStart(session, reservation.source, now),
      },
      reservations: { ...ledger.reservations, [reservationId]: consumed.reservation },
      events: {
        ...ledger.events,
        [eventId]: { name: "credit_consumed", at: now, reservationId, source: reservation.source },
      },
    },
  };
}

export function abortLedger(ledger: Ledger, reservationId: string, now: number): Ledger {
  const reservation = ledger.reservations[reservationId];
  if (!reservation || reservation.status !== "reserved") return ledger;
  const released = releaseReservation(ledger.account, reservation, now);
  if (!released) return ledger;
  const session = ledger.sessions[reservation.sessionId];
  const sessions = { ...ledger.sessions };
  if (reservation.source === "reconnect" && session) sessions[session.sessionId] = failReconnect(session);
  return {
    account: released.account,
    sessions,
    reservations: { ...ledger.reservations, [reservationId]: released.reservation },
    events: {
      ...ledger.events,
      [`released-${reservationId}`]: { name: "credit_released", at: now, reservationId, source: reservation.source },
    },
  };
}

function applyDecision(ledger: Ledger, decision: Extract<ReturnType<typeof decideStart>, { ok: true }>): Ledger {
  return {
    account: decision.account,
    sessions: { ...ledger.sessions, [decision.session.sessionId]: decision.session },
    reservations: { ...ledger.reservations, [decision.reservation.reservationId]: decision.reservation },
    events: {
      ...ledger.events,
      [`reserved-${decision.reservation.reservationId}`]: {
        name: "credit_reserved",
        at: decision.reservation.createdAt,
        reservationId: decision.reservation.reservationId,
        source: decision.reservation.source,
      },
    },
  };
}

function withReservations(ledger: Ledger, account: BillingAccount, reservations: Reservation[]): Ledger {
  const next = { ...ledger.reservations };
  for (const reservation of reservations) next[reservation.reservationId] = reservation;
  return { ...ledger, account, reservations: next };
}

function newlyReleased(before: Reservation[], after: Reservation[]): Reservation[] {
  const wasReserved = new Set(before.filter((reservation) => reservation.status === "reserved").map((reservation) => reservation.reservationId));
  return after.filter((reservation) => reservation.status === "released" && wasReserved.has(reservation.reservationId));
}

function withReleaseEvents(ledger: Ledger, reservations: Reservation[], now: number): Ledger {
  const events = { ...ledger.events };
  for (const reservation of reservations) {
    const id = `released-${reservation.reservationId}`;
    if (events[id]) continue;
    events[id] = { name: "credit_released", at: now, reservationId: reservation.reservationId, source: reservation.source };
  }
  return { ...ledger, events };
}

function okResult(decision: Extract<ReturnType<typeof decideStart>, { ok: true }>): AuthorizeResult {
  return {
    ok: true,
    sessionId: decision.session.sessionId,
    reservationId: decision.reservation.reservationId,
    targetMinutes: decision.session.targetMinutes,
    maxMinutes: decision.session.maxMinutes,
    ceilingMinutes: safetyCeilingMinutes(decision.session),
    reconnect: decision.reconnect,
  };
}
