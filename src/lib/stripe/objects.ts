import type Stripe from "stripe";

export function stripeObjectId(value: unknown): string {
  if (typeof value === "string" && value) return value;
  if (value && typeof value === "object" && "id" in value && typeof (value as { id: unknown }).id === "string") {
    return (value as { id: string }).id;
  }
  return "";
}

export function unixMs(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value < 1_000_000_000_000 ? Math.round(value * 1000) : value;
}

export function metadataValue(metadata: Stripe.Metadata | null | undefined, key: string): string {
  const value = metadata?.[key];
  return typeof value === "string" ? value.trim() : "";
}

export function subscriptionPeriod(subscription: Stripe.Subscription): { start: number | null; end: number | null } {
  const item = subscription.items?.data?.[0] as { current_period_start?: number; current_period_end?: number } | undefined;
  const legacy = subscription as { current_period_start?: number; current_period_end?: number };
  return {
    start: unixMs(item?.current_period_start ?? legacy.current_period_start),
    end: unixMs(item?.current_period_end ?? legacy.current_period_end),
  };
}

export function invoiceSubscriptionId(invoice: Stripe.Invoice): string {
  const parent = invoice.parent as { subscription_details?: { subscription?: unknown } } | null | undefined;
  return stripeObjectId(parent?.subscription_details?.subscription) || stripeObjectId((invoice as { subscription?: unknown }).subscription);
}

export function invoicePeriod(invoice: Stripe.Invoice): { start: number | null; end: number | null } {
  const line = invoice.lines?.data?.[0];
  return { start: unixMs(line?.period?.start), end: unixMs(line?.period?.end) };
}

export function invoiceCustomerId(invoice: Stripe.Invoice): string {
  return stripeObjectId(invoice.customer);
}

export function mappedSubscriptionStatus(status: string): "active" | "past_due" | "canceled" | null {
  if (status === "active" || status === "trialing") return "active";
  if (status === "past_due" || status === "unpaid" || status === "incomplete_expired") return "past_due";
  if (status === "canceled") return "canceled";
  return null;
}

export function invoiceGrantsPlusPeriod(invoice: Stripe.Invoice): boolean {
  if (invoice.status !== "paid") return false;
  const reason = (invoice as { billing_reason?: string | null }).billing_reason;
  return reason === "subscription_create" || reason === "subscription_cycle";
}
