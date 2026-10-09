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
        mockCreditsAvailable: 3,
        practiceSessionsAvailable: 3,
        purchasedCreditsAvailable: 0,
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
    canManageSubscription: Boolean(account.stripeCustomerId && (account.plan === "plus" || account.subscriptionStatus === "past_due")),
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
    const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
    const reported = typeof body.reportedUsageSeconds === "number" && Number.isFinite(body.reportedUsageSeconds) ? body.reportedUsageSeconds : null;
    if (sessionId) await closeLiveUsageBySession(user.uid, sessionId, Date.now(), reported);
    return Response.json({ ok: true });
  }
  if (billingBypassEnabled()) {
    return Response.json({ bypass: true, sessionId: "", reservationId: "", targetMinutes: 30, maxMinutes: 30, ceilingMinutes: 35, reconnect: false });
  }
  const result = await authorizeLive(user.uid, {
    interviewId: typeof body.interviewId === "string" ? body.interviewId : null,
    story: body.story === true,
  });
  if (!result.ok) return entitlementResponse(result.code);
  return Response.json(result);
}
