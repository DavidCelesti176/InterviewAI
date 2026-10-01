"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { StatusRow } from "@/components/ui/status-row";

type CheckState = "idle" | "checking" | "ready" | "blocked";

export function MicrophoneCheck({ onReady }: { onReady: (ready: boolean) => void }) {
  const [state, setState] = useState<CheckState>("idle");

  async function check() {
    setState("checking");
    onReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setState("ready");
      onReady(true);
    } catch {
      setState("blocked");
      onReady(false);
    }
  }

  const value = {
    idle: "Not checked",
    checking: "Checking",
    ready: "Ready",
    blocked: "Blocked",
  }[state];
  const tone = state === "ready" ? "ready" : state === "blocked" ? "blocked" : state === "checking" ? "waiting" : "neutral";

  return (
    <div className="flex flex-col gap-3">
      <StatusRow label="Microphone" value={value} tone={tone} />
      <Button type="button" variant="secondary" onClick={() => void check()} disabled={state === "checking"}>
        {state === "checking" ? "Checking microphone…" : "Check microphone"}
      </Button>
      {state === "blocked" ? (
        <p className="text-sm text-danger" role="alert">
          The browser blocked the microphone. Allow microphone access for this site, and allow the browser under System
          Settings, Privacy & Security, Microphone.
        </p>
      ) : null}
    </div>
  );
}
