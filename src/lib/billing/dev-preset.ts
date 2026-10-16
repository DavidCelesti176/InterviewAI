import { emptyBilling, startPlusPeriod } from "@/lib/billing/decide";
import type { BillingAccount } from "@/lib/billing/types";

export function devBillingPatch(body: Record<string, unknown>, now: number): Partial<BillingAccount> {
  const plan = body.plan === "plus" ? "plus" : "free";
  const base = plan === "plus" ? startPlusPeriod(emptyBilling(now), now, now + 30 * 24 * 60 * 60 * 1000, now) : emptyBilling(now);
  const mocks = clamp(body.mockCredits, 0, 3);
  const practice = clamp(body.practiceSessions, 0, 3);
  const purchased = clamp(body.purchasedCredits, 0, 3);
  return {
    ...base,
    mockGrant: 0,
    mockConsumed: 0,
    practiceGrant: 0,
    practiceConsumed: 0,
    purchasedRemaining: 0,
    monthlySecondsGrant: plan === "plus" ? mocks * 1800 + practice * 600 : 0,
    monthlySecondsConsumed: 0,
    monthlySecondsReserved: 0,
    purchasedSecondsGrant: purchased * 1800,
    purchasedSecondsConsumed: 0,
    purchasedSecondsReserved: 0,
    freeQuickSecondsGrant: 600,
    freeQuickSecondsConsumed: body.freeQuickAvailable === false ? 600 : 0,
    freeQuickUsedAt: body.freeQuickAvailable === false ? now : null,
    freeQuickReserved: 0,
    mockReserved: 0,
    practiceReserved: 0,
    purchasedReserved: 0,
    minutesMigratedAt: now,
    cancelAtPeriodEnd: body.cancelAtPeriodEnd === true && plan === "plus",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
  };
}

function clamp(value: unknown, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}
