import { products } from "@/lib/billing/products";
import type { BillingProjection } from "@/lib/billing/types";

export function billingSentence(billing: BillingProjection): string {
  if (billing.plan === "plus") {
    const interviews = `${billing.mockCreditsAvailable} of ${products.plus.grants.mockCredits} full interviews left this month.`;
    const practice = `${billing.practiceSessionsAvailable} voice practice${billing.practiceSessionsAvailable === 1 ? "" : "s"} left.`;
    const purchased = billing.purchasedCreditsAvailable > 0 ? ` ${creditLine(billing.purchasedCreditsAvailable)}` : "";
    const cancel = billing.cancelAtPeriodEnd ? " Cancellation is scheduled." : "";
    return `${interviews} ${practice}${purchased}${cancel}`;
  }
  if (billing.purchasedCreditsAvailable > 0 && !billing.freeQuickAvailable) return creditLine(billing.purchasedCreditsAvailable);
  if (billing.freeQuickAvailable) {
    const purchased = billing.purchasedCreditsAvailable > 0 ? ` ${creditLine(billing.purchasedCreditsAvailable)}` : "";
    return `One Quick Practice is ready.${purchased}`;
  }
  return "Ready for a full mock?";
}

function creditLine(count: number): string {
  return `${count} full interview credit${count === 1 ? "" : "s"} ready.`;
}
