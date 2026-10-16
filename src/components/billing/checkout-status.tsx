"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/contexts/auth-context";
import { authorizedFetch } from "@/lib/account/client";
import { paymentIsReady } from "@/lib/billing/checkout-return";
import type { BillingProjection } from "@/lib/billing/types";
import { readInterviewDraft, readInterviewSetup } from "@/lib/interview/browser-state";

function checkoutRequested(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("checkout") === "success";
}

function continueInterview(): string | null {
  const setup = readInterviewSetup();
  if (setup?.interviewId) return "/interview/live?checkout=success";
  const draft = readInterviewDraft();
  if (draft?.company && draft.jobTitle) return "/interview/new?checkout=success";
  return null;
}

export function CheckoutStatus({ onBilling }: { onBilling?: (billing: BillingProjection) => void }) {
  const router = useRouter();
  const { ready, user } = useAuth();
  const [wanted] = useState(checkoutRequested);
  const [round, setRound] = useState(0);
  const [state, setState] = useState<"confirming" | "ready" | "delayed">("confirming");
  const onBillingRef = useRef(onBilling);
  onBillingRef.current = onBilling;

  useEffect(() => {
    if (!wanted || !ready || !user) return;
    let cancelled = false;
    let attempts = 0;
    setState("confirming");

    async function poll() {
      try {
        const response = await authorizedFetch("/api/billing");
        if (cancelled) return;
        if (response.ok) {
          const body = (await response.json()) as { billing?: BillingProjection };
          if (body.billing) onBillingRef.current?.(body.billing);
          if (body.billing && paymentIsReady(body.billing)) {
            setState("ready");
            const next = continueInterview();
            if (next) router.replace(next);
            return;
          }
        }
      } catch {
        if (cancelled) return;
      }
      attempts += 1;
      if (attempts === 8 && !cancelled) setState("delayed");
      window.setTimeout(() => {
        if (!cancelled) void poll();
      }, attempts < 8 ? 1500 : 4000);
    }

    void poll();
    return () => {
      cancelled = true;
    };
  }, [ready, router, round, user, wanted]);

  if (!wanted) return null;
  if (state === "ready") return null;

  return (
    <div className="rounded-[20px] border border-line bg-card px-5 py-4 text-sm text-foreground shadow-card">
      {state === "confirming" ? <p>Payment received. Opening your interview…</p> : null}
      {state === "delayed" ? (
        <p>
          Your payment is saved. The interview credit is taking a moment to appear.
          <button
            type="button"
            className="ml-2 font-medium underline"
            onClick={() => {
              const next = continueInterview();
              if (next) {
                router.replace(next);
                return;
              }
              setRound((current) => current + 1);
            }}
          >
            Continue
          </button>
        </p>
      ) : null}
    </div>
  );
}
