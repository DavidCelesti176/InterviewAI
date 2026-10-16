import type { BillingAccount, EntitlementCode, Reservation } from "@/lib/billing/types";

export const FREE_QUICK_SECONDS = 10 * 60;
export const PACK_SECONDS = 30 * 60;
export const PLUS_PERIOD_SECONDS = 90 * 60;
export const MOCK_CREDIT_SECONDS = 30 * 60;
export const PRACTICE_CREDIT_SECONDS = 10 * 60;
export const CONNECT_GRACE_MS = 2 * 60 * 1000;
export const HEARTBEAT_STALE_MS = 90 * 1000;
export const HEARTBEAT_INTERVAL_MS = 20 * 1000;

/** The first heartbeat is due immediately when the Live session connects. Later ones wait. */
export function heartbeatDueDelay(previousHeartbeatCount: number): number {
  return previousHeartbeatCount <= 0 ? 0 : HEARTBEAT_INTERVAL_MS;
}

export type MinutePools = {
  monthly: number;
  purchased: number;
  free: number;
};

function periodActive(account: BillingAccount, now: number): boolean {
  if (account.plan !== "plus" || account.subscriptionStatus !== "active") return false;
  if (account.periodStart === null || account.periodEnd === null) return false;
  return now >= account.periodStart && now < account.periodEnd;
}

export function effectiveAccount(account: BillingAccount, now: number): BillingAccount {
  if (account.minutesMigratedAt) return account;
  const active = periodActive(account, now);
  const mocksLeft = active ? Math.max(0, account.mockGrant - account.mockConsumed) : 0;
  const practiceLeft = active ? Math.max(0, account.practiceGrant - account.practiceConsumed) : 0;
  const freeUsed = account.freeQuickUsedAt !== null;
  return {
    ...account,
    purchasedSecondsGrant: account.purchasedSecondsGrant + Math.max(0, account.purchasedRemaining) * PACK_SECONDS,
    purchasedSecondsReserved: account.purchasedSecondsReserved + Math.max(0, account.purchasedReserved) * PACK_SECONDS,
    monthlySecondsGrant: account.monthlySecondsGrant + mocksLeft * MOCK_CREDIT_SECONDS + practiceLeft * PRACTICE_CREDIT_SECONDS,
    monthlySecondsReserved:
      account.monthlySecondsReserved +
      (active ? Math.max(0, account.mockReserved) * MOCK_CREDIT_SECONDS + Math.max(0, account.practiceReserved) * PRACTICE_CREDIT_SECONDS : 0),
    freeQuickSecondsGrant: FREE_QUICK_SECONDS,
    freeQuickSecondsConsumed: freeUsed ? FREE_QUICK_SECONDS : account.freeQuickSecondsConsumed,
    freeQuickSecondsReserved: !freeUsed && account.freeQuickReserved > 0 ? FREE_QUICK_SECONDS : account.freeQuickSecondsReserved,
    purchasedRemaining: 0,
    purchasedReserved: 0,
    mockGrant: 0,
    mockConsumed: 0,
    mockReserved: 0,
    practiceGrant: 0,
    practiceConsumed: 0,
    practiceReserved: 0,
    freeQuickReserved: 0,
  };
}

export function migrateAccount(account: BillingAccount, now: number): BillingAccount {
  if (account.minutesMigratedAt) return account;
  return { ...effectiveAccount(account, now), minutesMigratedAt: now, updatedAt: now };
}

export function minutePools(account: BillingAccount, now: number): MinutePools {
  const view = effectiveAccount(account, now);
  const monthly = periodActive(account, now) ? Math.max(0, view.monthlySecondsGrant - view.monthlySecondsConsumed - view.monthlySecondsReserved) : 0;
  const purchased = Math.max(0, view.purchasedSecondsGrant - view.purchasedSecondsConsumed - view.purchasedSecondsReserved);
  const freeConsumed = view.freeQuickUsedAt !== null ? Math.max(view.freeQuickSecondsConsumed, view.freeQuickSecondsGrant) : view.freeQuickSecondsConsumed;
  const free = Math.max(0, view.freeQuickSecondsGrant - freeConsumed - view.freeQuickSecondsReserved);
  return { monthly, purchased, free };
}

export function paidAvailableSeconds(account: BillingAccount, now: number): number {
  const pools = minutePools(account, now);
  return pools.monthly + pools.purchased;
}

export type ReservedMinutes = {
  account: BillingAccount;
  authorizedSeconds: number;
  freeSeconds: number;
  monthlySeconds: number;
  purchasedSeconds: number;
};

export function reserveMinutes(
  account: BillingAccount,
  requestedSeconds: number,
  pool: "free" | "paid",
  now: number,
): { ok: true; reserved: ReservedMinutes } | { ok: false; code: EntitlementCode } {
  const view = migrateAccount(account, now);
  const requested = Math.max(0, Math.floor(requestedSeconds));
  if (requested <= 0) return { ok: false, code: "DURATION_NOT_INCLUDED" };
  const pools = minutePools(view, now);
  if (pool === "free") {
    if (pools.free <= 0) return { ok: false, code: "PAYMENT_REQUIRED" };
    const freeSeconds = Math.min(requested, pools.free);
    return {
      ok: true,
      reserved: {
        authorizedSeconds: freeSeconds,
        freeSeconds,
        monthlySeconds: 0,
        purchasedSeconds: 0,
        account: { ...view, freeQuickSecondsReserved: view.freeQuickSecondsReserved + freeSeconds, updatedAt: now },
      },
    };
  }
  const available = pools.monthly + pools.purchased;
  if (available <= 0) return { ok: false, code: account.plan === "plus" ? "SESSION_LIMIT" : "PAYMENT_REQUIRED" };
  const authorizedSeconds = Math.min(requested, available);
  const monthlySeconds = Math.min(authorizedSeconds, pools.monthly);
  const purchasedSeconds = authorizedSeconds - monthlySeconds;
  return {
    ok: true,
    reserved: {
      authorizedSeconds,
      freeSeconds: 0,
      monthlySeconds,
      purchasedSeconds,
      account: {
        ...view,
        monthlySecondsReserved: view.monthlySecondsReserved + monthlySeconds,
        purchasedSecondsReserved: view.purchasedSecondsReserved + purchasedSeconds,
        updatedAt: now,
      },
    },
  };
}

export function usageSeconds(startedAt: number | null, endedAt: number, authorizedSeconds: number): number {
  if (startedAt === null) return 0;
  const elapsed = Math.floor((endedAt - startedAt) / 1000);
  return Math.min(Math.max(0, authorizedSeconds), Math.max(0, elapsed));
}

/**
 * Stale usage uses only server timestamps.
 * No heartbeat and no live.create: release everything once the reserve expires.
 * live.create with no heartbeat before the connect grace: release everything.
 * Heartbeats stopped: charge floor((lastHeartbeatAt - startedAt) / 1000), capped at the reservation, and release the rest.
 * A missed /end does not consume the whole reservation when a heartbeat exists.
 */
export function staleUsage(reservation: Reservation, now: number): { settle: false } | { settle: true; consumedSeconds: number } {
  if (reservation.status !== "reserved") return { settle: false };
  if (reservation.startedAt === null) {
    if (reservation.liveCreatedAt === null) {
      if (now < reservation.expiresAt) return { settle: false };
      return { settle: true, consumedSeconds: 0 };
    }
    if (now < reservation.liveCreatedAt + CONNECT_GRACE_MS) return { settle: false };
    return { settle: true, consumedSeconds: 0 };
  }
  const last = reservation.lastHeartbeatAt ?? reservation.startedAt;
  if (now < last + HEARTBEAT_STALE_MS) return { settle: false };
  return { settle: true, consumedSeconds: usageSeconds(reservation.startedAt, last, reservation.authorizedSeconds) };
}

export function settleReservation(
  account: BillingAccount,
  reservation: Reservation,
  consumedSeconds: number,
  now: number,
): { account: BillingAccount; reservation: Reservation } | null {
  if (reservation.status !== "reserved") return null;
  const used = Math.min(Math.max(0, reservation.authorizedSeconds), Math.max(0, Math.floor(consumedSeconds)));
  let rest = used;
  const freeUsed = Math.min(rest, reservation.freeSeconds);
  rest -= freeUsed;
  const monthlyUsed = Math.min(rest, reservation.monthlySeconds);
  rest -= monthlyUsed;
  const purchasedUsed = Math.min(rest, reservation.purchasedSeconds);
  const monthlyStillCurrent = reservation.monthlyPeriodStart !== null && reservation.monthlyPeriodStart === account.periodStart;
  const next: BillingAccount = {
    ...account,
    freeQuickSecondsReserved: Math.max(0, account.freeQuickSecondsReserved - reservation.freeSeconds),
    freeQuickSecondsConsumed: account.freeQuickSecondsConsumed + freeUsed,
    monthlySecondsReserved: monthlyStillCurrent ? Math.max(0, account.monthlySecondsReserved - reservation.monthlySeconds) : account.monthlySecondsReserved,
    monthlySecondsConsumed: monthlyStillCurrent ? account.monthlySecondsConsumed + monthlyUsed : account.monthlySecondsConsumed,
    purchasedSecondsReserved: Math.max(0, account.purchasedSecondsReserved - reservation.purchasedSeconds),
    purchasedSecondsConsumed: account.purchasedSecondsConsumed + purchasedUsed,
    openReservationIds: account.openReservationIds.filter((id) => id !== reservation.reservationId),
    updatedAt: now,
  };
  if (freeUsed > 0 && next.freeQuickSecondsConsumed >= next.freeQuickSecondsGrant) {
    next.freeQuickUsedAt = next.freeQuickUsedAt ?? now;
  }
  return {
    account: next,
    reservation: {
      ...reservation,
      status: used > 0 ? "consumed" : "released",
      consumedAt: now,
      consumedSeconds: freeUsed + monthlyUsed + purchasedUsed,
    },
  };
}

export function markConnected(reservation: Reservation, now: number): Reservation {
  return {
    ...reservation,
    liveCreatedAt: reservation.liveCreatedAt ?? now,
    expiresAt: now + CONNECT_GRACE_MS,
  };
}

export function markHeartbeat(reservation: Reservation, now: number): Reservation | null {
  if (reservation.status !== "reserved") return null;
  if (reservation.liveCreatedAt === null) return null;
  return {
    ...reservation,
    startedAt: reservation.startedAt ?? now,
    lastHeartbeatAt: now,
    expiresAt: now + HEARTBEAT_STALE_MS,
  };
}

export function heartbeatAccess(requestUid: string | null, ownerUid: string): "ok" | "unsigned" | "forbidden" {
  if (!requestUid) return "unsigned";
  if (requestUid !== ownerUid) return "forbidden";
  return "ok";
}

export function clientUsageRejected(body: Record<string, unknown>): boolean {
  return "consumedSeconds" in body || "elapsedSeconds" in body || "balance" in body || "remainingSeconds" in body;
}

export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  if (rest === 0) return `${minutes}m`;
  return `${minutes}m ${rest}s`;
}

export function startLimitCopy(requestedSeconds: number, availableSeconds: number): string {
  const allowed = Math.min(Math.max(0, requestedSeconds), Math.max(0, availableSeconds));
  if (availableSeconds >= requestedSeconds) return `This interview can run for up to ${formatLimit(requestedSeconds)}.`;
  return `You have ${formatLimit(availableSeconds)} remaining. This interview can run for up to ${formatLimit(allowed)}.`;
}

export function formatLimit(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  if (rest === 0) return `${minutes} minutes`;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}
