import type Stripe from "stripe";

import { stripePriceId } from "@/lib/stripe/catalog";
import {
  invoiceCustomerId,
  invoiceGrantsPlusPeriod,
  invoicePeriod,
  invoiceSubscriptionId,
  mappedSubscriptionStatus,
  metadataValue,
  stripeObjectId,
  subscriptionPeriod,
} from "@/lib/stripe/objects";

export type StripeGrantIntent =
  | {
      kind: "grant_full_mock";
      uid: string;
      customerId: string;
      checkoutSessionId: string;
      eventId: string;
    }
  | {
      kind: "sync_plus_ids";
      uid: string;
      customerId: string;
      subscriptionId: string;
      eventId: string;
    }
  | {
      kind: "grant_plus_period";
      uid: string;
      customerId: string;
      subscriptionId: string;
      invoiceId: string;
      periodStart: number;
      periodEnd: number;
      eventId: string;
    }
  | {
      kind: "plus_payment_failed";
      uid: string;
      customerId: string;
      subscriptionId: string;
      eventId: string;
    }
  | {
      kind: "sync_plus_subscription";
      uid: string;
      customerId: string;
      subscriptionId: string;
      status: "active" | "past_due" | "canceled";
      cancelAtPeriodEnd: boolean;
      periodStart: number | null;
      periodEnd: number | null;
      eventId: string;
    }
  | {
      kind: "end_plus_subscription";
      uid: string;
      customerId: string;
      subscriptionId: string;
      eventId: string;
    }
  | {
      kind: "refund_full_mock";
      uid: string;
      eventId: string;
    }
  | {
      kind: "refund_review";
      uid: string;
      eventId: string;
    }
  | { kind: "ignore"; reason: string; eventId: string };

export function stripeEventIntent(event: Stripe.Event, env: Record<string, string | undefined> = process.env): StripeGrantIntent {
  if (event.livemode) return { kind: "ignore", reason: "live_event", eventId: event.id };
  switch (event.type) {
    case "checkout.session.completed":
      return checkoutIntent(event.data.object as Stripe.Checkout.Session, event.id, env);
    case "invoice.paid":
      return paidInvoiceIntent(event.data.object as Stripe.Invoice, event.id);
    case "invoice.payment_failed":
      return failedInvoiceIntent(event.data.object as Stripe.Invoice, event.id);
    case "customer.subscription.updated":
      return subscriptionUpdatedIntent(event.data.object as Stripe.Subscription, event.id);
    case "customer.subscription.deleted":
      return subscriptionDeletedIntent(event.data.object as Stripe.Subscription, event.id);
    case "charge.refunded":
      return refundIntent(event.data.object as Stripe.Charge, event.id);
    default:
      return { kind: "ignore", reason: "unhandled_type", eventId: event.id };
  }
}

function checkoutIntent(session: Stripe.Checkout.Session, eventId: string, env: Record<string, string | undefined>): StripeGrantIntent {
  const uid = metadataValue(session.metadata, "firebaseUid") || (session.client_reference_id ?? "").trim();
  const customerId = stripeObjectId(session.customer);
  if (!uid) return { kind: "ignore", reason: "missing_uid", eventId };
  if (session.mode === "payment") {
    const purchaseType = metadataValue(session.metadata, "purchaseType");
    if (purchaseType !== "full_mock") return { kind: "ignore", reason: "unexpected_purchase", eventId };
    if (session.payment_status && session.payment_status !== "paid") return { kind: "ignore", reason: "unpaid_session", eventId };
    const expected = env.STRIPE_PRICE_FULL_MOCK?.trim();
    const linePrice = firstLinePrice(session);
    if (expected && linePrice && linePrice !== expected) return { kind: "ignore", reason: "unexpected_price", eventId };
    return { kind: "grant_full_mock", uid, customerId, checkoutSessionId: session.id, eventId };
  }
  if (session.mode === "subscription") {
    const subscriptionId = stripeObjectId(session.subscription);
    if (!subscriptionId) return { kind: "ignore", reason: "missing_subscription", eventId };
    return { kind: "sync_plus_ids", uid, customerId, subscriptionId, eventId };
  }
  return { kind: "ignore", reason: "unexpected_mode", eventId };
}

function paidInvoiceIntent(invoice: Stripe.Invoice, eventId: string): StripeGrantIntent {
  if (!invoiceGrantsPlusPeriod(invoice)) return { kind: "ignore", reason: "invoice_not_period_grant", eventId };
  const uid = metadataValue(invoice.metadata, "firebaseUid") || metadataValue(invoice.parent && "subscription_details" in invoice.parent ? invoice.parent.subscription_details?.metadata : undefined, "firebaseUid");
  const subscriptionId = invoiceSubscriptionId(invoice);
  const period = invoicePeriod(invoice);
  if (!subscriptionId || period.start === null || period.end === null) {
    return { kind: "ignore", reason: "incomplete_invoice_period", eventId };
  }
  return {
    kind: "grant_plus_period",
    uid,
    customerId: invoiceCustomerId(invoice),
    subscriptionId,
    invoiceId: invoice.id,
    periodStart: period.start,
    periodEnd: period.end,
    eventId,
  };
}

function failedInvoiceIntent(invoice: Stripe.Invoice, eventId: string): StripeGrantIntent {
  return {
    kind: "plus_payment_failed",
    uid: metadataValue(invoice.metadata, "firebaseUid"),
    customerId: invoiceCustomerId(invoice),
    subscriptionId: invoiceSubscriptionId(invoice),
    eventId,
  };
}

function subscriptionUpdatedIntent(subscription: Stripe.Subscription, eventId: string): StripeGrantIntent {
  const status = mappedSubscriptionStatus(subscription.status);
  const period = subscriptionPeriod(subscription);
  if (!status) return { kind: "ignore", reason: "unmapped_subscription_status", eventId };
  if (status === "canceled") {
    return {
      kind: "end_plus_subscription",
      uid: metadataValue(subscription.metadata, "firebaseUid"),
      customerId: stripeObjectId(subscription.customer),
      subscriptionId: subscription.id,
      eventId,
    };
  }
  return {
    kind: "sync_plus_subscription",
    uid: metadataValue(subscription.metadata, "firebaseUid"),
    customerId: stripeObjectId(subscription.customer),
    subscriptionId: subscription.id,
    status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
    periodStart: period.start,
    periodEnd: period.end,
    eventId,
  };
}

function subscriptionDeletedIntent(subscription: Stripe.Subscription, eventId: string): StripeGrantIntent {
  return {
    kind: "end_plus_subscription",
    uid: metadataValue(subscription.metadata, "firebaseUid"),
    customerId: stripeObjectId(subscription.customer),
    subscriptionId: subscription.id,
    eventId,
  };
}

function refundIntent(charge: Stripe.Charge, eventId: string): StripeGrantIntent {
  const uid = metadataValue(charge.metadata, "firebaseUid");
  const purchaseType = metadataValue(charge.metadata, "purchaseType");
  if (purchaseType === "full_mock") return { kind: "refund_full_mock", uid, eventId };
  return { kind: "refund_review", uid, eventId };
}

function firstLinePrice(session: Stripe.Checkout.Session): string {
  const items = session.line_items?.data ?? [];
  return stripeObjectId(items[0]?.price);
}

export function plusPriceMatches(subscription: Stripe.Subscription, env: Record<string, string | undefined> = process.env): boolean {
  try {
    const expected = stripePriceId("plus", env);
    return subscription.items.data.some((item) => stripeObjectId(item.price) === expected);
  } catch {
    return true;
  }
}
