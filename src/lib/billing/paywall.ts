export type PaywallReason = "full_mock" | "voice_practice";

export function paywallReason(code: string): PaywallReason | null {
  if (code === "PAYMENT_REQUIRED") return "full_mock";
  if (code === "SESSION_LIMIT") return "voice_practice";
  return null;
}

export class PaywallError extends Error {
  readonly reason: PaywallReason;

  constructor(reason: PaywallReason) {
    super(reason === "voice_practice" ? "Voice practice needs Plus." : "A full interview needs an available credit.");
    this.name = "PaywallError";
    this.reason = reason;
  }
}
