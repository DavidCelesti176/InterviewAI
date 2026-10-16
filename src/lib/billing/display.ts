import type { BillingProjection } from "@/lib/billing/types";

export function billingSentence(billing: BillingProjection): string {
  const monthly = Math.floor(billing.monthlySecondsAvailable / 60);
  const purchased = Math.floor(billing.purchasedSecondsAvailable / 60);
  const total = Math.floor(billing.paidSecondsAvailable / 60);
  const cancel = billing.cancelAtPeriodEnd ? " Cancellation is scheduled." : "";
  if (billing.plan === "plus") {
    return `${total} interview minutes available. ${monthly} monthly · ${purchased} purchased.${cancel}`;
  }
  if (billing.freeQuickAvailable && purchased === 0) return "One Quick Practice is ready.";
  if (purchased > 0) return `${purchased} purchased interview minutes available.`;
  return "Ready when you add interview minutes.";
}
