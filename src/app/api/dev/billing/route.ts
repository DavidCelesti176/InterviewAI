import { billingBypassEnabled } from "@/lib/billing/enforcement";
import { devBillingPatch } from "@/lib/billing/dev-preset";
import { applyDevBilling } from "@/lib/billing/store";
import { authenticate, isUser } from "@/lib/firebase/auth-server";
import { isSameOrigin } from "@/lib/http/same-origin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") return Response.json({ error: "Not found" }, { status: 404 });
  if (!isSameOrigin(request)) return Response.json({ error: "Unexpected request origin" }, { status: 403 });
  const user = await authenticate(request);
  if (!isUser(user)) return user;
  let body: Record<string, unknown> = {};
  try {
    const parsed: unknown = await request.json();
    if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
  } catch {
    return Response.json({ error: "The billing test could not be read." }, { status: 400 });
  }
  const now = Date.now();
  const billing = await applyDevBilling(user.uid, devBillingPatch(body, now), now);
  return Response.json({ billing, bypassIgnored: billingBypassEnabled() });
}
