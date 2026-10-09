import { processVerifiedStripeEvent } from "@/lib/stripe/process-event";
import { getStripe, stripeWebhookSecret } from "@/lib/stripe/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing Stripe-Signature" }, { status: 400 });
  const raw = await request.text();
  let event;
  try {
    event = getStripe().webhooks.constructEvent(raw, signature, stripeWebhookSecret());
  } catch {
    return Response.json({ error: "Invalid Stripe signature" }, { status: 400 });
  }
  if (event.livemode) {
    return Response.json({ error: "Live Stripe events are disabled." }, { status: 400 });
  }
  try {
    await processVerifiedStripeEvent(event);
    return Response.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook failed", error instanceof Error ? error.message : "error");
    return Response.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
