import { authorizedFetch } from "@/lib/account/client";
import type { CheckoutProduct } from "@/lib/stripe/catalog";

export async function startCheckout(product: CheckoutProduct): Promise<void> {
  const response = await authorizedFetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product }),
  });
  const body = (await response.json()) as { url?: string; error?: string };
  if (!response.ok || !body.url) throw new Error(body.error || "Checkout could not start.");
  window.location.assign(body.url);
}

export async function startCustomerPortal(): Promise<void> {
  const response = await authorizedFetch("/api/billing/portal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const body = (await response.json()) as { url?: string; error?: string };
  if (!response.ok || !body.url) throw new Error(body.error || "The billing portal could not start.");
  window.location.assign(body.url);
}
