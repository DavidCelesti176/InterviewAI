import Stripe from "stripe";

let client: Stripe | null = null;

export function stripeLiveEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.STRIPE_MODE === "live";
}

export function assertStripeMode(env: Record<string, string | undefined> = process.env): void {
  const secret = env.STRIPE_SECRET_KEY ?? "";
  const live = stripeLiveEnabled(env);
  if (live && !secret.startsWith("sk_live")) {
    throw new Error("STRIPE_MODE=live requires a live secret key.");
  }
  if (!live && secret.startsWith("sk_live")) {
    throw new Error("Live Stripe keys require STRIPE_MODE=live.");
  }
}

export function stripeSecretKey(env: Record<string, string | undefined> = process.env): string {
  const value = env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (!value) throw new Error("STRIPE_SECRET_KEY is not configured.");
  assertStripeMode({ ...env, STRIPE_SECRET_KEY: value });
  return value;
}

export function stripeWebhookSecret(env: Record<string, string | undefined> = process.env): string {
  const value = env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
  if (!value) throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
  return value;
}

export function getStripe(): Stripe {
  assertStripeMode();
  if (!client) {
    client = new Stripe(stripeSecretKey());
  }
  return client;
}
