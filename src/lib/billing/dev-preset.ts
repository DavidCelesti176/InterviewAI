import { emptyBilling, startPlusPeriod } from "@/lib/billing/decide";
import { products } from "@/lib/billing/products";
import type { BillingAccount } from "@/lib/billing/types";

export function devBillingPatch(body: Record<string, unknown>, now: number): Partial<BillingAccount> {
  const plan = body.plan === "plus" ? "plus" : "free";
  const base = plan === "plus" ? startPlusPeriod(emptyBilling(now), now, now + 30 * 24 * 60 * 60 * 1000, now) : emptyBilling(now);
  const mocks = clamp(body.mockCredits, 0, products.plus.grants.mockCredits);
  const practice = clamp(body.practiceSessions, 0, products.plus.grants.practiceSessions);
  const purchased = clamp(body.purchasedCredits, 0, 3);
  return {
    ...base,
    mockConsumed: plan === "plus" ? products.plus.grants.mockCredits - mocks : 0,
    practiceConsumed: plan === "plus" ? products.plus.grants.practiceSessions - practice : 0,
    purchasedRemaining: purchased,
    freeQuickUsedAt: body.freeQuickAvailable === false ? now : null,
    freeQuickReserved: 0,
    mockReserved: 0,
    practiceReserved: 0,
    purchasedReserved: 0,
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
