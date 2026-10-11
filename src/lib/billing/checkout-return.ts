import type { BillingProjection } from "@/lib/billing/types";

const returnPaths = new Set([
  "/interview/new",
  "/interview/prepare",
  "/interview/live",
  "/story-builder/practice",
  "/dashboard",
]);

export function checkoutReturnPath(value: unknown): string {
  if (typeof value !== "string") return "/dashboard";
  const path = value.split("?")[0]?.split("#")[0] ?? "";
  const normalized = path.length > 1 ? path.replace(/\/+$/, "") : path;
  if (!normalized.startsWith("/") || normalized.startsWith("//") || normalized.includes("..")) return "/dashboard";
  return returnPaths.has(normalized) ? normalized : "/dashboard";
}

export function paymentIsReady(billing: Pick<BillingProjection, "purchasedCreditsAvailable" | "mockCreditsAvailable">): boolean {
  return billing.purchasedCreditsAvailable > 0 || billing.mockCreditsAvailable > 0;
}
