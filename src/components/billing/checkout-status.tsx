"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { authorizedFetch } from "@/lib/account/client";
import { billingSentence } from "@/lib/billing/display";
import type { BillingProjection } from "@/lib/billing/types";

type Snapshot = BillingProjection & { line: string };

function checkoutRequested(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("checkout") === "success";
}

export function CheckoutStatus() {
  const router = useRouter();
  const [wanted] = useState(checkoutRequested);
  const [state, setState] = useState<"confirming" | "ready" | "delayed">("confirming");
  const [line, setLine] = useState("");

  useEffect(() => {
    if (!wanted) return;
    let cancelled = false;
    let attempts = 0;

    async function load(): Promise<Snapshot | null> {
      const response = await authorizedFetch("/api/billing");
      if (!response.ok) return null;
      const body = (await response.json()) as { billing?: BillingProjection };
      if (!body.billing) return null;
      return { ...body.billing, line: billingSentence(body.billing) };
    }

    function confirmed(billing: Snapshot): string | null {
      if (billing.plan === "plus") return "InterviewAI Plus";
      if (billing.purchasedCreditsAvailable > 0) return billingSentence(billing);
      return null;
    }

    async function poll() {
      try {
        const billing = await load();
        if (cancelled) return;
        const message = billing ? confirmed(billing) : null;
        if (message) {
          setLine(message);
          setState("ready");
          return;
        }
        attempts += 1;
        if (attempts >= 6) {
          setState("delayed");
          return;
        }
        window.setTimeout(() => void poll(), 2000);
      } catch {
        if (!cancelled) setState("delayed");
      }
    }

    void poll();
    return () => {
      cancelled = true;
    };
  }, [wanted]);

  if (!wanted) return null;
  return (
    <div className="rounded-[20px] border border-[#ece7e0] bg-white px-5 py-4 text-sm">
      {state === "confirming" ? <p>Confirming your purchase…</p> : null}
      {state === "ready" ? <p>{line}</p> : null}
      {state === "delayed" ? (
        <p>
          Payment is still confirming. Refresh in a moment if your credit or Plus plan does not appear yet.
          <button type="button" className="ml-2 font-medium underline" onClick={() => router.refresh()}>
            Refresh
          </button>
        </p>
      ) : null}
    </div>
  );
}
