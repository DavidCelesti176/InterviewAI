import type { EntitlementCode } from "@/lib/billing/types";

const messages: Record<EntitlementCode, { status: number; error: string }> = {
  AUTH_REQUIRED: { status: 401, error: "Sign in to continue." },
  PAYMENT_REQUIRED: { status: 402, error: "A full interview needs an available credit." },
  CREDIT_RESERVED: { status: 409, error: "This session is already starting. Wait a moment, then try again." },
  SESSION_LIMIT: { status: 429, error: "The voice practice sessions for this period are used." },
  ENTITLEMENT_CHECK_FAILED: { status: 503, error: "Interview access could not be checked. Try again." },
  DURATION_NOT_INCLUDED: { status: 402, error: "Choose a 10-minute Quick Practice or a 30-minute full mock." },
};

export function entitlementResponse(code: EntitlementCode): Response {
  const message = messages[code];
  return Response.json({ error: message.error, code }, { status: message.status });
}
