import { entitlementResponse } from "@/lib/billing/http";
import { billingBypassEnabled } from "@/lib/billing/enforcement";
import { authorizeLive, billingProjection, closeLiveUsageBySession, previewAccess, readBillingAccount } from "@/lib/billing/store";
import { authenticate, isUser } from "@/lib/firebase/auth-server";
import { isSameOrigin } from "@/lib/http/same-origin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Unexpected request origin" }, { status: 403 });
  const user = await authenticate(request);
  if (!isUser(user)) return user;
  if (billingBypassEnabled()) {
    return Response.json({
      billing: {
        plan: "plus",
        mockCreditsAvailable: 1,
        practiceSessionsAvailable: 0,
        purchasedCreditsAvailable: 0,
        monthlySecondsAvailable: 5400,
        purchasedSecondsAvailable: 0,
        paidSecondsAvailable: 5400,
        freeQuickSecondsAvailable: 600,
        periodEnd: null,
        cancelAtPeriodEnd: false,
        freeQuickAvailable: true,
      },
      canManageSubscription: false,
    });
  }
  const account = await readBillingAccount(user.uid);
  const billing = await billingProjection(user.uid);
  return Response.json({
    billing,
    canManageSubscription: Boolean(account.stripeCustomerId),
  });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Unexpected request origin" }, { status: 403 });
  const user = await authenticate(request);
  if (!isUser(user)) return user;
  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "authorize";
  let body: Record<string, unknown> = {};
  try {
    const parsed: unknown = await request.json();
    if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
  } catch {
    body = {};
  }
  if (action === "preview") {
    const minutes = typeof body.targetMinutes === "number" ? body.targetMinutes : Number.NaN;
    if (billingBypassEnabled()) return Response.json({ allowed: true });
    const code = await previewAccess(user.uid, minutes);
    if (code) return entitlementResponse(code);
    return Response.json({ allowed: true });
  }
  if (action === "close") {
    if ("consumedSeconds" in body || "elapsedSeconds" in body || "balance" in body || "remainingSeconds" in body) {
      return Response.json({ error: "The server measures connected time." }, { status: 400 });
    }
    const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
    if (sessionId) await closeLiveUsageBySession(user.uid, sessionId, Date.now(), null);
    return Response.json({ ok: true });
  }
  if (billingBypassEnabled()) {
    return Response.json({ bypass: true, sessionId: "", reservationId: "", targetMinutes: 30, maxMinutes: 30, ceilingMinutes: 30, authorizedSeconds: 1800, reconnect: false });
  }
  const result = await authorizeLive(user.uid, {
    interviewId: typeof body.interviewId === "string" ? body.interviewId : null,
    story: body.story === true,
  });
  if (!result.ok) return entitlementResponse(result.code);
  return Response.json(result);
}
