"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { authorizedFetch } from "@/lib/account/client";
import { startCheckout } from "@/lib/billing/checkout-client";
import type { PaywallReason } from "@/lib/billing/paywall";
import { priceLabel, products } from "@/lib/billing/products";
import type { BillingProjection } from "@/lib/billing/types";
import type { CheckoutProduct } from "@/lib/stripe/catalog";

export function UpgradePanel({
  reason,
  onUseQuick,
  beforeCheckout,
}: {
  reason: PaywallReason;
  onUseQuick?: () => void;
  beforeCheckout?: () => void;
}) {
  const [billing, setBilling] = useState<BillingProjection | null>(null);
  const [pending, setPending] = useState<CheckoutProduct | null>(null);
  const [checkoutError, setCheckoutError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void authorizedFetch("/api/billing")
      .then(async (response) => {
        if (!response.ok) return null;
        const body = (await response.json()) as { billing?: BillingProjection };
        return body.billing ?? null;
      })
      .then((next) => {
        if (!cancelled) setBilling(next);
      })
      .catch(() => {
        if (!cancelled) setBilling(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const alreadyPlus = billing?.plan === "plus";
  const quickAvailable = billing?.freeQuickAvailable === true;
  const fullPrice = priceLabel(products.fullInterview.priceCents);
  const plusPrice = priceLabel(products.plus.priceCents);

  async function buy(product: CheckoutProduct) {
    setCheckoutError("");
    setPending(product);
    try {
      beforeCheckout?.();
      await startCheckout(product);
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Checkout could not start.");
      setPending(null);
    }
  }

  const title = alreadyPlus ? "This month’s interview minutes are used" : "Keep going with interview minutes";

  const detail = alreadyPlus
    ? "Purchased minutes stay on your account. Plus minutes come back with the next billing period. Written Story Builder stays free."
    : "Paid minutes work for a full interview or voice practice. Plus includes 90 minutes each month.";

  const showFull = reason === "full_mock";
  const showPlus = !alreadyPlus && (reason === "voice_practice" || reason === "full_mock");

  return (
    <section className="rounded-[24px] border border-line bg-card p-6 text-foreground shadow-[var(--shadow-card)]">
      <p className="text-sm font-medium text-accent">Ready when you are</p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">{detail}</p>
      {showFull || showPlus ? (
        <div className={`mt-5 grid gap-3 ${showFull && showPlus ? "sm:grid-cols-2" : ""}`}>
          {showFull ? (
            <article className="flex flex-col rounded-[18px] border border-line bg-background p-4">
              <h3 className="text-base font-semibold">30 interview minutes</h3>
              <p className="mt-1 text-2xl font-semibold tracking-tight">{fullPrice}</p>
              <p className="mt-1 text-sm text-muted">Use them whenever you want. They do not expire.</p>
              <Button type="button" className="mt-4 w-full" variant={showPlus ? "secondary" : "primary"} disabled={pending !== null} onClick={() => void buy("full_mock")}>
                {pending === "full_mock" ? "Opening checkout…" : `Get 30 interview minutes · ${fullPrice}`}
              </Button>
            </article>
          ) : null}
          {showPlus ? (
            <article className="flex flex-col rounded-[18px] border border-accent/40 bg-background p-4">
              <p className="text-xs font-medium tracking-wide text-accent uppercase">Best for more than one interview</p>
              <h3 className="mt-1 text-base font-semibold">Plus</h3>
              <p className="mt-1 text-2xl font-semibold tracking-tight">
                {plusPrice}
                <span className="text-base font-medium text-muted">/month</span>
              </p>
              <p className="mt-1 text-sm text-muted">90 interview minutes / month</p>
              <Button type="button" className="mt-4 w-full" disabled={pending !== null} onClick={() => void buy("plus")}>
                {pending === "plus" ? "Opening checkout…" : `Get Plus for ${plusPrice}`}
              </Button>
            </article>
          ) : null}
        </div>
      ) : null}
      {checkoutError ? <p className="mt-3 text-sm text-danger">{checkoutError}</p> : null}
      <p className="mt-4 text-xs text-muted">
        By paying you agree to the <Link href="/terms" className="underline">terms</Link> and <Link href="/refunds" className="underline">refund policy</Link>.
      </p>
      {reason === "full_mock" && quickAvailable && onUseQuick ? (
        <p className="mt-4 text-sm text-muted">
          Your free 10-minute Quick Practice is still open.{" "}
          <button type="button" className="font-medium text-accent underline-offset-2 hover:underline" onClick={onUseQuick}>
            Practice for 10 minutes
          </button>
        </p>
      ) : null}
    </section>
  );
}
