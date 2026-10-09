"use client";

import { useState } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { startCheckout } from "@/lib/billing/checkout-client";
import { products } from "@/lib/billing/products";

export function UpgradePanel({ message }: { message: string }) {
  const [busy, setBusy] = useState<"full_mock" | "plus" | null>(null);
  const [error, setError] = useState("");

  async function buy(product: "full_mock" | "plus") {
    setError("");
    setBusy(product);
    try {
      await startCheckout(product);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Checkout could not start.");
      setBusy(null);
    }
  }

  return (
    <div className="rounded-[20px] border border-line bg-card px-5 py-4">
      <p className="font-medium">This interview needs an available credit.</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">{message}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="button" disabled={busy !== null} onClick={() => void buy("full_mock")}>
          {busy === "full_mock" ? "Starting checkout…" : `Buy Full Mock — $${(products.fullInterview.priceCents / 100).toFixed(2)}`}
        </Button>
        <Button type="button" variant="secondary" disabled={busy !== null} onClick={() => void buy("plus")}>
          {busy === "plus" ? "Starting checkout…" : `Upgrade to Plus — $${(products.plus.priceCents / 100).toFixed(2)}/month`}
        </Button>
        <ButtonLink href="/dashboard" variant="ghost">
          Back to your account
        </ButtonLink>
      </div>
      {error ? (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
