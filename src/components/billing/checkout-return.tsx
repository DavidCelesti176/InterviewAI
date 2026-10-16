"use client";

import { useEffect, useState } from "react";

import { authorizedFetch } from "@/lib/account/client";
import { paymentIsReady } from "@/lib/billing/checkout-return";
import type { BillingProjection } from "@/lib/billing/types";

export type CheckoutReturnStatus = "idle" | "confirming" | "ready" | "canceled" | "delayed";

function clearCheckoutQuery(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("checkout")) return;
  url.searchParams.delete("checkout");
  const next = `${url.pathname}${url.search}`;
  window.history.replaceState(null, "", next);
}

export function useCheckoutReturn(): CheckoutReturnStatus {
  const [status, setStatus] = useState<CheckoutReturnStatus>("idle");

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("checkout");
    if (value === "canceled") {
      setStatus("canceled");
      clearCheckoutQuery();
      return;
    }
    if (value !== "success") return;

    let cancelled = false;
    let attempts = 0;
    setStatus("confirming");

    async function poll() {
      try {
        const response = await authorizedFetch("/api/billing");
        if (cancelled) return;
        if (response.ok) {
          const body = (await response.json()) as { billing?: BillingProjection };
          if (body.billing && paymentIsReady(body.billing)) {
            setStatus("ready");
            clearCheckoutQuery();
            return;
          }
        }
      } catch {
        if (cancelled) return;
      }
      attempts += 1;
      if (attempts === 8 && !cancelled) setStatus("delayed");
      window.setTimeout(() => {
        if (!cancelled) void poll();
      }, attempts < 8 ? 1500 : 4000);
    }

    void poll();
    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
