"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { interviewerById } from "@/components/interview/avatar/profile";
import { InterviewerPicker } from "@/components/interview/interviewer-picker";
import { MicrophoneCheck } from "@/components/interview/microphone-check";
import { PreparationDebugPanel } from "@/components/interview/preparation-debug";
import { PageShell } from "@/components/interview/page-shell";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressSteps } from "@/components/ui/progress-steps";
import { StatusRow } from "@/components/ui/status-row";
import { authorizedFetch } from "@/lib/account/client";
import { readInterviewSetup, saveInterviewSetup } from "@/lib/interview/browser-state";
import { interviewModeLabel, interviewTypeLabel } from "@/lib/interview/labels";

export function PrepareInterview() {
  const router = useRouter();
  const [setup, setSetup] = useState<ReturnType<typeof readInterviewSetup>>(null);
  const [ready, setReady] = useState(false);
  const [microphoneReady, setMicrophoneReady] = useState(false);
  const [speaker, setSpeaker] = useState("Default speakers");
  const [online, setOnline] = useState(true);
  const [checklist, setChecklist] = useState<Array<{ id: string; label: string; done: boolean }>>([]);
  const [questionsReady, setQuestionsReady] = useState(false);
  const [roomQuiet, setRoomQuiet] = useState(false);

  useEffect(() => {
    const current = readInterviewSetup();
    setSetup(current);
    setReady(true);
    if (current?.interviewId) {
      void authorizedFetch(`/api/account/stories?interviewId=${encodeURIComponent(current.interviewId)}`)
        .then(async (response) => {
          const body = (await response.json().catch(() => null)) as { checklist?: Array<{ id: string; label: string; done: boolean }> } | null;
          if (response.ok && body?.checklist) setChecklist(body.checklist);
        })
        .catch(() => undefined);
    }
    setOnline(navigator.onLine);
    let cancelled = false;
    void navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        if (cancelled) return;
        if (devices.some((device) => device.kind === "audiooutput")) setSpeaker("Ready");
      })
      .catch(() => {
        if (!cancelled) setSpeaker("Default speakers");
      });
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (!ready) return null;

  if (!setup) {
    return (
      <PageShell>
        <h1 className="text-4xl font-semibold tracking-tight">No interview yet</h1>
        <p className="text-muted">Build an interview before you step into the room.</p>
        <ButtonLink href="/interview/new">Build your interview</ButtonLink>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <ProgressSteps current={3} />
      <header className="flex flex-col gap-3">
        <h1 className="text-4xl font-semibold tracking-tight">Your interview is ready.</h1>
        <p className="text-lg text-muted">Check your sound, then enter the room when you want to begin.</p>
      </header>
      <InterviewerPicker
        value={interviewerById(setup.interviewerProfileId).id}
        onChange={(id) => {
          const next = { ...setup, interviewerProfileId: id };
          saveInterviewSetup(next);
          setSetup(next);
          void authorizedFetch(`/api/account/interviews/${setup.interviewId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ interviewerProfileId: id }),
          }).catch(() => undefined);
        }}
      />
      <Card className="flex flex-col gap-2 p-6">
        <p className="text-2xl font-semibold">{setup.company}</p>
        <p className="text-lg">{setup.jobTitle}</p>
        <p className="text-muted">{interviewModeLabel(setup.interviewMode)}</p>
        <p className="text-muted">{setup.levelLabel || interviewTypeLabel(setup.interviewType)}</p>
        <p className="text-muted">{setup.emphasisLabel || interviewTypeLabel(setup.interviewType)}</p>
        <p className="text-muted">~{setup.targetDurationMinutes} minutes</p>
      </Card>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Prepared using</p>
        <ul className="grid gap-2 sm:grid-cols-3">
          {["Resume", "Job description", "Role requirements"].map((item) => (
            <li key={item} className="rounded-[14px] border border-line bg-card px-3 py-3 text-sm">
              <span className="text-success" aria-hidden="true">
                ✓{" "}
              </span>
              {item}
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">Resume prepared: {setup.resumeFileName}</p>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Before you start</p>
        <ul className="flex flex-col gap-1">
          {checklist.map((item) => (
            <li key={item.id} className="text-sm text-muted">
              {item.done ? "Ready" : "Still open"} · {item.label}
            </li>
          ))}
        </ul>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={questionsReady} onChange={(event) => setQuestionsReady(event.target.checked)} />
          Questions for the interviewer
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={roomQuiet} onChange={(event) => setRoomQuiet(event.target.checked)} />
          Quiet room
        </label>
        <ButtonLink href="/interview-stories" variant="secondary">
          Your Interview Stories
        </ButtonLink>
      </div>
      <div className="flex flex-col gap-3">
        <MicrophoneCheck onReady={setMicrophoneReady} />
        <StatusRow label="Speaker" value={speaker} tone={speaker === "Ready" ? "ready" : "neutral"} />
        <StatusRow label="Connection" value={online ? "Online" : "Offline"} tone={online ? "ready" : "blocked"} />
      </div>
      <p className="text-lg">Take a second. You&apos;ve got this.</p>
      <PreparationDebugPanel />
      <div className="flex flex-wrap gap-3">
        <Button type="button" disabled={!microphoneReady} onClick={() => router.push("/interview/live")}>
          Enter interview room
        </Button>
        <ButtonLink href="/interview/new" variant="secondary">
          Edit setup
        </ButtonLink>
      </div>
    </PageShell>
  );
}
