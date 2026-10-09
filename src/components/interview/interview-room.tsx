"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { InterviewerAvatar } from "@/components/interview/avatar/interviewer-avatar";
import { interviewerById } from "@/components/interview/avatar/profile";
import type { AvatarState } from "@/components/interview/avatar/types";
import { InterviewHelpPanel } from "@/components/interview/interview-help-panel";
import { PauseOverlay } from "@/components/interview/pause-overlay";
import { PreparationDebugPanel } from "@/components/interview/preparation-debug";
import { Button } from "@/components/ui/button";
import { helpTypeLabel } from "@/lib/interview/assistance";
import { authorizedFetch } from "@/lib/account/client";
import { saveInterviewResult, savePracticeNotice, type InterviewSetup } from "@/lib/interview/browser-state";
import { currentInterviewQuestion, interviewModeOf, type InterviewAssistanceEvent } from "@/lib/interview/help-types";
import { interviewPhase } from "@/lib/interview/interview-phase";
import { interviewModeLabel, interviewTypeLabel } from "@/lib/interview/labels";
import { pacingDiagnostics } from "@/lib/interview/pacing-diagnostics";
import { practiceContinueInstruction, practiceOpeningInstruction } from "@/lib/interview/practice-cues";
import {
  createSnapshot,
  formatElapsed,
  InterviewSession,
  type InterviewSnapshot,
  type InterviewStatus,
} from "@/lib/live/interview-session";

export function InterviewRoom({
  setup,
  mode = "interview",
  practiceQuestions = [],
}: {
  setup: InterviewSetup;
  mode?: "interview" | "practice";
  practiceQuestions?: string[];
}) {
  const router = useRouter();
  const sessionRef = useRef<InterviewSession | null>(null);
  const audioSlotRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef<HTMLParagraphElement>(null);
  const savedRef = useRef(false);
  const assistanceRef = useRef<InterviewAssistanceEvent[]>([]);
  const [assistance, setAssistance] = useState<InterviewAssistanceEvent[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const snapshotRef = useRef<InterviewSnapshot>(createSnapshot());
  const levelRef = useRef(0);
  const shownSecondRef = useRef(0);
  const signatureRef = useRef("");
  const [snapshot, setSnapshot] = useState<InterviewSnapshot>(createSnapshot);
  const [closingCopy, setClosingCopy] = useState("Interview complete");
  const [thinkingLong, setThinkingLong] = useState(false);
  const [saveWarning, setSaveWarning] = useState(false);

  useEffect(() => {
    const session = new InterviewSession(
      audioSlotRef.current,
      mode === "practice"
        ? { opening: practiceOpeningInstruction, continuePrompt: practiceContinueInstruction }
        : null,
    );
    sessionRef.current = session;
    const unsubscribe = session.subscribe((next) => {
      snapshotRef.current = next;
      levelRef.current = next.level;
      const second = Math.floor(next.elapsedMs / 1000);
      if (clockRef.current && second !== shownSecondRef.current) {
        shownSecondRef.current = second;
        clockRef.current.textContent = formatElapsed(next.elapsedMs);
      }
      const signature = roomSignature(next);
      if (signature === signatureRef.current) return;
      signatureRef.current = signature;
      setSnapshot(next);
    });
    return () => {
      unsubscribe();
      session.dispose();
      sessionRef.current = null;
    };
  }, [mode]);

  useEffect(() => {
    if (snapshot.status !== "Ended" || savedRef.current) return;
    const copyTimer =
      mode === "practice" ? 0 : window.setTimeout(() => setClosingCopy("Analyzing your interview…"), 700);
    const leaveTimer = window.setTimeout(() => {
      if (savedRef.current) return;
      savedRef.current = true;
      const latest = snapshotRef.current;
      const persist = persistProgress(setup.interviewId, {
        status: mode === "practice" ? "complete" : "analyzing",
        turns: latest.turns,
        elapsedMs: latest.elapsedMs,
        assistance: assistanceRef.current,
        pauses: latest.pauseEvents,
        usageSeconds: latest.usageSeconds,
      });
      if (mode === "practice") {
        savePracticeNotice({ questionCount: Math.max(1, practiceQuestions.length) });
      } else {
        saveInterviewResult({
          setup,
          elapsedMs: latest.elapsedMs,
          turns: latest.turns,
          pauses: latest.pauseEvents,
          assistance: assistanceRef.current,
          pausedMs: latest.pausedMs,
          voiceUsageWhilePausedSeconds: latest.voiceUsageWhilePausedSeconds,
        });
      }
      void Promise.race([persist, wait(2500)]).finally(() => {
        router.push(mode === "practice" ? "/interview/results" : `/interview/${setup.interviewId}/results`);
      });
    }, 1600);
    return () => {
      if (copyTimer) window.clearTimeout(copyTimer);
      window.clearTimeout(leaveTimer);
    };
  }, [mode, practiceQuestions.length, router, setup, snapshot.status]);

  useEffect(() => {
    if (snapshot.status === "Ready" || snapshot.status === "Connecting") return;
    if (snapshot.turns.length === 0 && snapshot.status !== "Error") return;
    const status = snapshot.status === "Ended" ? (mode === "practice" ? "complete" : "analyzing") : snapshot.status === "Error" ? "failed" : "in_progress";
    const timer = window.setTimeout(() => {
      const latest = snapshotRef.current;
      void persistProgress(setup.interviewId, {
        status,
        turns: latest.turns,
        elapsedMs: latest.elapsedMs,
        assistance: assistanceRef.current,
        pauses: latest.pauseEvents,
        usageSeconds: latest.usageSeconds,
      })
        .then(() => setSaveWarning(false))
        .catch(() => setSaveWarning(true));
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [mode, setup.interviewId, snapshot.pauseEvents, snapshot.status, snapshot.turns, assistance]);

  useEffect(() => {
    if (snapshot.status !== "Thinking") {
      setThinkingLong(false);
      return;
    }
    const timer = window.setTimeout(() => setThinkingLong(true), 8_000);
    return () => window.clearTimeout(timer);
  }, [snapshot.status]);

  const avatarState = snapshot.paused ? "idle" : toAvatarState(snapshot.status, snapshot.muted);
  const finished = snapshot.status === "Ended";
  const interviewer = interviewerById(setup.interviewerProfileId);
  const pacing = process.env.NODE_ENV === "development" ? pacingDiagnostics(snapshot.turns, snapshot.elapsedMs) : null;
  const coachingEnabled = mode === "interview" && interviewModeOf(setup.interviewMode) === "practice";
  const live = mode === "interview" && snapshot.canEnd && !snapshot.paused && !finished;

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-room text-room-ink">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(109,94,252,0.16),transparent_46%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_46%,rgba(5,8,16,0.55)_100%)]"
        aria-hidden="true"
      />
      <header className="relative flex shrink-0 items-start justify-between gap-4 px-5 py-4 sm:px-8">
        <div className="min-w-0">
          <p className="truncate text-base font-medium sm:text-lg">{setup.company}</p>
          <p className="truncate text-sm text-white/70">{setup.jobTitle}</p>
          {saveWarning ? <p className="text-xs text-amber-200">Having trouble saving this interview. We'll keep trying.</p> : null}
          <p className="truncate text-sm text-white/50">
            {mode === "practice"
              ? `Answer practice · ${practiceQuestions.length === 1 ? "1 question" : `${practiceQuestions.length} questions`}`
              : `${interviewModeLabel(setup.interviewMode)} · ${interviewTypeLabel(setup.interviewType)}`}
          </p>
        </div>
        <p ref={clockRef} className="font-mono text-xl tabular-nums sm:text-2xl">
          {formatElapsed(0)}
        </p>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-5 text-center">
        <div className="relative min-h-0 w-full flex-1">
          <div className="absolute inset-0 flex items-center justify-center">
            <InterviewerAvatar state={avatarState} levelRef={levelRef} profile={interviewer} />
          </div>
        </div>
        {finished ? (
          <div className="mt-4 flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {mode === "practice" ? "Practice complete" : closingCopy}
            </h1>
            <p className="text-white/60">{mode === "practice" ? "Your review is still saved." : "Saving this conversation."}</p>
          </div>
        ) : (
          <div className="mt-2 flex shrink-0 flex-col gap-0.5">
            <p className="text-2xl font-semibold tracking-tight">{interviewer.name}</p>
            <p className="text-sm text-white/60">{interviewer.title}</p>
            <p className="mt-1 text-sm text-white/80" aria-live="polite">
              {roomStatusLabel(snapshot.status, snapshot.muted, mode, interviewer.name, thinkingLong)}
            </p>
            {mode === "practice" && snapshot.canStart && practiceQuestions.length > 0 ? (
              <ul className="mt-3 flex max-h-24 w-full max-w-lg flex-col gap-1 overflow-auto">
                {practiceQuestions.map((question, index) => (
                  <li key={`${index}-${question}`} className="text-sm leading-relaxed text-white/75">
                    {question}
                  </li>
                ))}
              </ul>
            ) : null}
            {snapshot.errorMessage ? (
              <p className="mt-3 max-w-md text-sm text-red-300" role="alert">
                {snapshot.errorMessage}
              </p>
            ) : null}
            {snapshot.autoplayBlocked ? (
              <p className="mt-3 max-w-md text-sm text-white/70">Select play on the audio controls to hear the interviewer.</p>
            ) : null}
          </div>
        )}
        <div ref={audioSlotRef} className={snapshot.autoplayBlocked ? "mt-4 w-full max-w-md" : "sr-only"} />
      </div>

      <div className="relative flex shrink-0 flex-wrap items-center justify-center gap-3 px-5 pt-3 pb-4">
        {snapshot.canStart ? (
          <Button
            type="button"
            onClick={() => void sessionRef.current?.start(setup.interviewId, setup.interviewerProfileId, setup.targetDurationMinutes, { interviewMode: interviewModeOf(setup.interviewMode) })}
          >
            {mode === "practice" ? "Start practice" : "Start interview"}
          </Button>
        ) : null}
        {live ? (
          <Button type="button" variant="room" onClick={() => sessionRef.current?.pause()}>
            Pause
          </Button>
        ) : null}
        {live && coachingEnabled ? (
          <Button type="button" variant="room" onClick={() => openHelp()}>
            <svg viewBox="0 0 24 24" className="mr-2 size-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
              <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3 11c.4.4.7.9.8 1.4h4.4c.1-.5.4-1 .8-1.4A6 6 0 0 0 12 3z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Need help?
          </Button>
        ) : null}
        {mode === "practice" && snapshot.canStart ? (
          <Button type="button" variant="room" onClick={() => router.push("/interview/results")}>
            Back to review
          </Button>
        ) : null}
        <Button
          type="button"
          variant="room"
          disabled={!snapshot.canMute}
          onClick={() => {
            if (snapshot.muted) sessionRef.current?.unmute();
            else sessionRef.current?.mute();
          }}
        >
          {snapshot.muted ? "Unmute" : "Mute"}
        </Button>
        <Button type="button" variant="room" disabled={!snapshot.canEnd} onClick={() => sessionRef.current?.end()}>
          {mode === "practice" ? "End practice" : "End interview"}
        </Button>
      </div>

      <details className="relative mx-5 mb-3 shrink-0 rounded-[14px] border border-dashed border-white/15 px-4 py-2 text-sm text-white/70 sm:mx-8">
        <summary className="cursor-pointer font-medium text-white/80">Developer debug</summary>
        <div className="mt-4 flex flex-col gap-4">
          <p>
            Interviewer: {interviewer.id}
            {` · voice ${interviewer.voice ?? "session default"}`}
            {` · avatar ${avatarState}`}
            {" · level "}
            <span data-avatar-debug-level>0.00</span>
            {" · mouth "}
            <span data-avatar-debug-mouth>closed</span>
            {" · "}
            Mode: {mode === "practice" ? "Answer practice" : interviewModeLabel(setup.interviewMode)}
            {` · pauses ${snapshot.pauseEvents.length}`}
            {` · paused ${formatElapsed(snapshot.pausedMs)}`}
            {` · help ${assistance.filter((event) => event.type !== "pause").length}`}
            {snapshot.voiceUsageWhilePausedSeconds > 0 ? ` · voice while paused ${snapshot.voiceUsageWhilePausedSeconds}s` : ""}
          </p>
          {assistance.length > 0 ? (
            <ul>
              {assistance.map((event, index) => (
                <li key={`${event.type}-${event.timestampMs}-${index}`}>
                  {helpTypeLabel(event.type)}
                  {event.question ? ` · ${event.question}` : ""}
                </li>
              ))}
            </ul>
          ) : null}
          <p>
            Voice usage: {snapshot.usageSeconds === null ? "—" : `${snapshot.usageSeconds}s`}
            {snapshot.contextUsageRatio === null ? "" : ` · context ${Math.round(snapshot.contextUsageRatio * 100)}%`}
            {snapshot.delegationFailures > 0 ? ` · delegation test failures ${snapshot.delegationFailures}` : ""}
          </p>
          <div>
            <p className="mb-1 font-medium text-white">Candidate transcript</p>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-3">{snapshot.inputTranscript || "—"}</pre>
          </div>
          <div>
            <p className="mb-1 font-medium text-white">Interviewer transcript</p>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-3">{snapshot.outputTranscript || "—"}</pre>
          </div>
          {pacing ? (
            <div>
              <p className="mb-1 font-medium text-white">Pacing</p>
              <p>
                Main questions {pacing.mainQuestions}
                {pacing.followUpsByQuestion.length ? ` · follow-ups ${pacing.followUpsByQuestion.join(", ")}` : ""}
                {` · max consecutive ${pacing.maxConsecutiveFollowUps}`}
              </p>
              <p>
                Zero follow-ups {Math.round(pacing.zeroFollowUpShare * 100)}% · one {Math.round(pacing.oneFollowUpShare * 100)}% · two or
                more {Math.round(pacing.twoOrMoreShare * 100)}%
              </p>
              <p>
                Topic transitions {pacing.topicTransitions} · elapsed {formatElapsed(pacing.elapsedMs)} · phase{" "}
                {interviewPhase(snapshot.turns, snapshot.elapsedMs, setup.targetDurationMinutes)} · candidate questions{" "}
                {pacing.candidateQuestionsAtMs === null ? "not yet" : formatElapsed(pacing.candidateQuestionsAtMs)}
                {pacing.connectivityChecks > 0 ? ` · connectivity checks ${pacing.connectivityChecks}` : ""}
              </p>
            </div>
          ) : null}
          <PreparationDebugPanel inverted />
          <div>
            <p className="mb-1 font-medium text-white">Events</p>
            <ol className="max-h-80 overflow-auto rounded-lg bg-black/30 p-3 font-mono text-xs">
              {snapshot.debug.length === 0 ? <li>—</li> : null}
              {snapshot.debug.map((entry) => (
                <li key={entry.id} className="mb-3">
                  <span className="text-white/40">{entry.at}</span> {entry.label}
                  <pre className="mt-1 whitespace-pre-wrap">{entry.detail}</pre>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </details>
      {snapshot.paused && !finished && !helpOpen ? (
        <PauseOverlay
          interviewMode={interviewModeOf(setup.interviewMode)}
          onResume={() => sessionRef.current?.resume(false)}
          onHelp={coachingEnabled ? () => setHelpOpen(true) : undefined}
          onEnd={() => sessionRef.current?.end()}
        />
      ) : null}
      {helpOpen && !finished ? (
        <InterviewHelpPanel
          interviewId={setup.interviewId}
          question={currentInterviewQuestion(snapshot.turns)}
          turns={snapshot.turns}
          onHelped={(kind) => recordHelp(kind === "experiences" ? "experience_suggestions" : kind)}
          onRepeat={() => recordHelp("repeat")}
          onResume={(repeat) => {
            setHelpOpen(false);
            sessionRef.current?.resume(repeat);
          }}
          onEnd={() => sessionRef.current?.end()}
        />
      ) : null}
    </div>
  );

  function openHelp() {
    sessionRef.current?.pause();
    setHelpOpen(true);
  }

  function recordHelp(type: InterviewAssistanceEvent["type"]) {
    const event: InterviewAssistanceEvent = {
      timestampMs: snapshotRef.current.elapsedMs,
      type,
      question: currentInterviewQuestion(snapshotRef.current.turns),
    };
    assistanceRef.current = [...assistanceRef.current, event];
    setAssistance(assistanceRef.current);
  }
}

function persistProgress(
  interviewId: string,
  body: {
    status: "in_progress" | "analyzing" | "complete" | "failed";
    turns: InterviewSnapshot["turns"];
    elapsedMs: number;
    assistance: InterviewAssistanceEvent[];
    pauses: InterviewSnapshot["pauseEvents"];
    usageSeconds?: number | null;
  },
): Promise<void> {
  return authorizedFetch(`/api/account/interviews/${interviewId}/progress`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((response) => {
    if (!response.ok) throw new Error("save failed");
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function roomSignature(snapshot: InterviewSnapshot): string {
  return [
    snapshot.status,
    snapshot.muted,
    snapshot.errorMessage,
    snapshot.canStart,
    snapshot.canMute,
    snapshot.canEnd,
    snapshot.paused,
    snapshot.pauseEvents.length,
    snapshot.autoplayBlocked,
    snapshot.inputTranscript,
    snapshot.outputTranscript,
    snapshot.turns.length,
    snapshot.turns.at(-1)?.id ?? "",
    snapshot.debug.at(-1)?.id ?? 0,
    snapshot.usageSeconds,
    snapshot.contextUsageRatio,
    snapshot.delegationFailures,
  ].join("|");
}

function toAvatarState(status: InterviewStatus, muted: boolean): AvatarState {
  if (status === "Error") return "error";
  if (status === "Ended") return "ended";
  if (status === "Connecting") return "connecting";
  if (status === "Speaking") return "speaking";
  if (status === "Thinking") return "thinking";
  if (muted) return "muted";
  if (status === "Listening") return "listening";
  return "idle";
}

function roomStatusLabel(
  status: InterviewStatus,
  muted: boolean,
  mode: "interview" | "practice",
  name: string,
  thinkingLong: boolean,
): string {
  if (status === "Error") return "Error";
  if (status === "Ended") return "Ended";
  if (status === "Connecting") return "Connecting...";
  if (status === "Thinking") return thinkingLong ? `${name} is still thinking...` : `${name} is thinking...`;
  if (muted && status !== "Speaking") return "Muted";
  if (status === "Speaking") return "Speaking...";
  if (status === "Listening") return "Listening...";
  return mode === "practice" ? "Ready to practice" : "Ready";
}
