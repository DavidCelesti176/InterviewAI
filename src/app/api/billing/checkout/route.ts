import { plusPeriodActive } from "@/lib/billing/decide";
import { readBillingAccount } from "@/lib/billing/store";
import { authenticate, isUser } from "@/lib/firebase/auth-server";
import { isSameOrigin } from "@/lib/http/same-origin";
import { checkoutMode, parseCheckoutProduct, stripePriceId } from "@/lib/stripe/catalog";
import { stripeCustomerForUser } from "@/lib/stripe/customer";
import { getStripe } from "@/lib/stripe/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Unexpected request origin" }, { status: 403 });
  const user = await authenticate(request);
  if (!isUser(user)) return user;
  let productValue: unknown = null;
  try {
    const parsed: unknown = await request.json();
    if (parsed && typeof parsed === "object" && "product" in parsed) {
      productValue = (parsed as { product: unknown }).product;
    }
  } catch {
    return Response.json({ error: "Choose Full Mock or Plus." }, { status: 400 });
  }
  const product = parseCheckoutProduct(productValue);
  if (!product) return Response.json({ error: "Choose Full Mock or Plus." }, { status: 400 });
  const account = await readBillingAccount(user.uid);
  if (product === "plus" && plusPeriodActive(account, Date.now())) {
    return Response.json({ error: "InterviewAI Plus is already active." }, { status: 409 });
  }

  try {
    const origin = request.headers.get("origin") ?? "";
    const customer = await stripeCustomerForUser(user.uid, user.email);
    const price = stripePriceId(product);
    const session = await getStripe().checkout.sessions.create({
      mode: checkoutMode(product),
      customer,
      client_reference_id: user.uid,
      line_items: [{ price, quantity: 1 }],
      success_url: `${origin}/dashboard?checkout=success`,
      cancel_url: `${origin}/dashboard?checkout=canceled`,
      metadata: { firebaseUid: user.uid, purchaseType: product },
      ...(product === "full_mock"
        ? {
            invoice_creation: { enabled: true },
            payment_intent_data: {
              metadata: { firebaseUid: user.uid, purchaseType: "full_mock" },
            },
          }
        : {
            subscription_data: {
              metadata: { firebaseUid: user.uid, purchaseType: "plus" },
            },
          }),
    });
    if (!session.url) return Response.json({ error: "Checkout could not start." }, { status: 502 });
    return Response.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout failed", error instanceof Error ? error.message : "error");
    return Response.json({ error: "Checkout could not start." }, { status: 503 });
  }
}
