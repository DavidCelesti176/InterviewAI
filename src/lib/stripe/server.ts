import Stripe from "stripe";

let client: Stripe | null = null;

export function assertStripeTestMode(env: Record<string, string | undefined> = process.env): void {
  const secret = env.STRIPE_SECRET_KEY ?? "";
  if (secret.startsWith("sk_live")) {
    throw new Error("Live Stripe keys are disabled.");
  }
}

export function stripeSecretKey(env: Record<string, string | undefined> = process.env): string {
  const value = env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (!value) throw new Error("STRIPE_SECRET_KEY is not configured.");
  if (value.startsWith("sk_live")) throw new Error("Live Stripe keys are disabled.");
  return value;
}

export function stripeWebhookSecret(env: Record<string, string | undefined> = process.env): string {
  const value = env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
  if (!value) throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
  return value;
}

export function getStripe(): Stripe {
  assertStripeTestMode();
  if (!client) {
    client = new Stripe(stripeSecretKey());
  }
  return client;
}
