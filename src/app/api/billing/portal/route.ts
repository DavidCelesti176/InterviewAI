import { readBillingAccount } from "@/lib/billing/store";
import { authenticate, isUser } from "@/lib/firebase/auth-server";
import { isSameOrigin } from "@/lib/http/same-origin";
import { getStripe } from "@/lib/stripe/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Unexpected request origin" }, { status: 403 });
  const user = await authenticate(request);
  if (!isUser(user)) return user;
  const account = await readBillingAccount(user.uid);
  if (!account.stripeCustomerId) {
    return Response.json({ error: "No Stripe customer is linked to this account." }, { status: 409 });
  }
  try {
    const origin = request.headers.get("origin") ?? "";
    const session = await getStripe().billingPortal.sessions.create({
      customer: account.stripeCustomerId,
      return_url: `${origin}/dashboard`,
    });
    if (!session.url) return Response.json({ error: "The billing portal could not start." }, { status: 502 });
    return Response.json({ url: session.url });
  } catch (error) {
    console.error("Stripe portal failed", error instanceof Error ? error.message : "error");
    return Response.json({ error: "The billing portal could not start." }, { status: 503 });
  }
}
