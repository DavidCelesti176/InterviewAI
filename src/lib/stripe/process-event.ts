import type Stripe from "stripe";

import {
  endPlusSubscriptionFromStripe,
  grantPlusPeriodFromStripe,
  grantPurchasedMockFromStripe,
  lookupUidByStripeCustomer,
  markPlusPastDueFromStripe,
  recordStripeReviewEvent,
  refundPurchasedMockFromStripe,
  syncPlusIdsFromStripe,
  syncPlusSubscriptionFromStripe,
  type StripeGrantResult,
} from "@/lib/billing/store";
import { stripeEventIntent } from "@/lib/stripe/intents";

export async function processVerifiedStripeEvent(event: Stripe.Event): Promise<StripeGrantResult> {
  const intent = stripeEventIntent(event);
  if (intent.kind === "ignore") return { applied: false, reason: "duplicate_invariant" };
  const uid = intent.uid || (await lookupUidByStripeCustomer("customerId" in intent ? intent.customerId : ""));
  if (!uid) return { applied: false, reason: "missing_user" };

  switch (intent.kind) {
    case "grant_full_mock":
      return grantPurchasedMockFromStripe({ ...intent, uid });
    case "sync_plus_ids":
      return syncPlusIdsFromStripe({ ...intent, uid });
    case "grant_plus_period":
      return grantPlusPeriodFromStripe({ ...intent, uid });
    case "plus_payment_failed":
      return markPlusPastDueFromStripe({ ...intent, uid });
    case "sync_plus_subscription":
      return syncPlusSubscriptionFromStripe({ ...intent, uid });
    case "end_plus_subscription":
      return endPlusSubscriptionFromStripe({ ...intent, uid });
    case "refund_full_mock":
      return refundPurchasedMockFromStripe({ uid, eventId: intent.eventId });
    case "refund_review":
      return recordStripeReviewEvent({ uid, eventId: intent.eventId });
  }
}
