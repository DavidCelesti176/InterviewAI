"use client";

import Link from "next/link";
import { useState } from "react";

import { authorizedFetch } from "@/lib/account/client";
import { useAuth } from "@/contexts/auth-context";

const presets = [
  { label: "Free, Quick Practice available", body: { plan: "free", freeQuickAvailable: true, purchasedCredits: 0 } },
  { label: "Free, Quick Practice used", body: { plan: "free", freeQuickAvailable: false, purchasedCredits: 0 } },
  { label: "One purchased credit", body: { plan: "free", freeQuickAvailable: false, purchasedCredits: 1 } },
  { label: "Plus, full allowance", body: { plan: "plus", mockCredits: 3, practiceSessions: 3, purchasedCredits: 0, freeQuickAvailable: true } },
  { label: "Plus, cancellation scheduled", body: { plan: "plus", mockCredits: 2, practiceSessions: 1, cancelAtPeriodEnd: true, freeQuickAvailable: false } },
];

export function DevBilling() {
  const { ready, user } = useAuth();
  const [note, setNote] = useState("");

  async function apply(body: Record<string, unknown>) {
    setNote("Saving…");
    try {
      const response = await authorizedFetch("/api/dev/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setNote(response.ok ? "Saved. Open the dashboard to see the account line." : "That test account could not be saved.");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "That test account could not be saved.");
    }
  }

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 px-6 py-10">
      <h1 className="text-2xl font-semibold">Billing test accounts</h1>
      <p className="text-sm text-muted">These presets exist only in development. Production returns not found. A preset changes only the signed-in account.</p>
      {!ready ? <p className="text-sm">Checking sign-in…</p> : null}
      {ready && !user ? (
        <p className="text-sm">
          Sign in to continue. <Link href="/login?next=/dev/billing">Sign in</Link>
        </p>
      ) : null}
      {user
        ? presets.map((preset) => (
        <button key={preset.label} type="button" className="rounded-full border border-line px-4 py-2 text-left text-sm" onClick={() => void apply(preset.body)}>
          {preset.label}
        </button>
        ))
        : null}
      {note ? <p className="text-sm">{note}</p> : null}
    </main>
  );
}
