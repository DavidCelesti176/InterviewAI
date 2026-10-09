export const CHECKOUT_PRODUCTS = ["full_mock", "plus"] as const;

export type CheckoutProduct = (typeof CHECKOUT_PRODUCTS)[number];

export function parseCheckoutProduct(value: unknown): CheckoutProduct | null {
  return value === "full_mock" || value === "plus" ? value : null;
}

export function stripePriceId(product: CheckoutProduct, env: Record<string, string | undefined> = process.env): string {
  const name = product === "full_mock" ? "STRIPE_PRICE_FULL_MOCK" : "STRIPE_PRICE_PLUS";
  const value = env[name]?.trim() ?? "";
  if (!value) throw new Error(`${name} is not configured.`);
  if (!value.startsWith("price_")) throw new Error(`${name} must be a Stripe Price id.`);
  return value;
}

export function checkoutMode(product: CheckoutProduct): "payment" | "subscription" {
  return product === "plus" ? "subscription" : "payment";
}
