"use client";

import { useEffect, useRef, useState } from "react";

import { InterviewerAvatar } from "@/components/interview/avatar/interviewer-avatar";
import { interviewerById } from "@/components/interview/avatar/profile";
import type { AvatarState } from "@/components/interview/avatar/types";
import { PageShell } from "@/components/interview/page-shell";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/auth-context";
import { authorizedFetch } from "@/lib/account/client";
import { readSavedStory } from "@/lib/story/client";
import type { ProfessionalStory, StoryPracticeFeedback } from "@/lib/story/types";
import type { InterviewTurn } from "@/lib/interview/types";
import {
  createSnapshot,
  formatElapsed,
  InterviewSession,
  type InterviewSnapshot,
  type InterviewStatus,
} from "@/lib/live/interview-session";

export function StoryPractice() {
  const { user } = useAuth();
  const [story, setStory] = useState<ProfessionalStory | null>(null);
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [turns, setTurns] = useState<InterviewTurn[] | null>(null);
  const [feedback, setFeedback] = useState<StoryPracticeFeedback | null>(null);
  const [reviewError, setReviewError] = useState("");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void readSavedStory(user.uid)
      .then((saved) => {
        if (!cancelled) setStory(saved);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!turns) return;
    let cancelled = false;
    void authorizedFetch("/api/story/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ turns }),
    })
      .then(async (response) => {
        const body = (await response.json()) as { error?: string; feedback?: StoryPracticeFeedback };
        if (!response.ok || !body.feedback) throw new Error(body.error || "The practice could not be reviewed yet.");
        if (!cancelled) setFeedback(body.feedback);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setReviewError(reason instanceof Error ? reason.message : "The practice could not be reviewed yet.");
      });
    return () => {
      cancelled = true;
    };
  }, [turns]);

  if (!ready) {
    return (
      <PageShell>
        <p className="text-sm text-muted">Loading…</p>
      </PageShell>
    );
  }
  if (!story) {
    return (
      <PageShell>
        <h1 className="text-4xl font-semibold tracking-tight">Practice your story</h1>
        <p className="text-muted">Save a story first. Then you can say it out loud.</p>
        <ButtonLink href="/story-builder">Build my story</ButtonLink>
      </PageShell>
    );
  }
  if (turns) {
    return (
      <PageShell width="wide">
        <p className="text-sm font-medium text-accent">Story practice</p>
        <h1 className="text-4xl font-semibold tracking-tight">How it landed</h1>
        {!feedback && !reviewError ? <p className="text-muted">Listening back to the shape of the story.</p> : null}
        {reviewError ? (
          <p className="text-sm text-danger" role="alert">
            {reviewError}
          </p>
        ) : null}
        {feedback ? <FeedbackView feedback={feedback} /> : null}
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/story-builder">Back to your story</ButtonLink>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setTurns(null);
              setFeedback(null);
              setReviewError("");
              setAttempt((current) => current + 1);
            }}
          >
            Try it again
          </Button>
        </div>
      </PageShell>
    );
  }

  return <PracticeSession key={attempt} onFinished={setTurns} />;
}

function PracticeSession({ onFinished }: { onFinished: (turns: InterviewTurn[]) => void }) {
  const sessionRef = useRef<InterviewSession | null>(null);
  const audioSlotRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef<HTMLParagraphElement>(null);
  const snapshotRef = useRef<InterviewSnapshot>(createSnapshot());
  const levelRef = useRef(0);
  const shownSecondRef = useRef(0);
  const finishedRef = useRef(false);
  const [snapshot, setSnapshot] = useState<InterviewSnapshot>(createSnapshot);

  useEffect(() => {
    const session = new InterviewSession(audioSlotRef.current);
    sessionRef.current = session;
    const unsubscribe = session.subscribe((next) => {
      snapshotRef.current = next;
      levelRef.current = next.level;
      const second = Math.floor(next.elapsedMs / 1000);
      if (clockRef.current && second !== shownSecondRef.current) {
        shownSecondRef.current = second;
        clockRef.current.textContent = formatElapsed(next.elapsedMs);
      }
      setSnapshot(next);
    });
    return () => {
      unsubscribe();
      session.dispose();
      sessionRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (snapshot.status !== "Ended" || finishedRef.current) return;
    finishedRef.current = true;
    onFinished(snapshotRef.current.turns);
  }, [onFinished, snapshot.status]);

  const interviewer = interviewerById("claire");
  const avatarState = toAvatarState(snapshot.status, snapshot.muted);

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-room text-room-ink">
      <header className="relative flex items-start justify-between gap-4 px-5 py-4 sm:px-8">
        <div>
          <p className="text-base font-medium">Tell me about yourself</p>
          <p className="text-sm text-white/60">Say the story in your own words. It does not need to match a script.</p>
        </div>
        <p ref={clockRef} className="font-mono text-xl tabular-nums">
          {formatElapsed(0)}
        </p>
      </header>
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-5 text-center">
        <InterviewerAvatar state={avatarState} levelRef={levelRef} profile={interviewer} />
        <p className="mt-2 text-2xl font-semibold">{interviewer.name}</p>
        <p className="text-sm text-white/70" aria-live="polite">
          {statusLabel(snapshot.status, snapshot.muted)}
        </p>
        {snapshot.errorMessage ? (
          <p className="mt-3 max-w-md text-sm text-red-300" role="alert">
            {snapshot.errorMessage}
          </p>
        ) : null}
        <div ref={audioSlotRef} className={snapshot.autoplayBlocked ? "mt-4 w-full max-w-md" : "sr-only"} />
      </div>
      <div className="relative flex flex-wrap items-center justify-center gap-3 px-5 pb-6">
        {snapshot.canStart ? (
          <Button type="button" onClick={() => void sessionRef.current?.start("", "claire", 3, { storyPractice: true })}>
            Start practice
          </Button>
        ) : null}
        <Button
          type="button"
          variant="room"
          disabled={!snapshot.canMute}
          onClick={() => (snapshot.muted ? sessionRef.current?.unmute() : sessionRef.current?.mute())}
        >
          {snapshot.muted ? "Unmute" : "Mute"}
        </Button>
        <Button type="button" variant="room" disabled={!snapshot.canEnd} onClick={() => sessionRef.current?.end()}>
          End practice
        </Button>
        <ButtonLink href="/story-builder" variant="room">
          Back
        </ButtonLink>
      </div>
    </div>
  );
}

function FeedbackView({ feedback }: { feedback: StoryPracticeFeedback }) {
  const notes = [
    feedback.establishedIdentity ? "The identity came through." : "The identity did not land early.",
    feedback.evidenceSupportedIdentity ? "The proof supported it." : "The proof did not clearly support the identity.",
    feedback.clearThread ? "There was a common thread." : "The common thread was hard to hear.",
    feedback.explainedDirection ? "You said where this leads." : "The direction was missing.",
    feedback.rightLength ? "The length was about right." : "The length drifted off a one-minute answer.",
    feedback.conversational ? "It sounded like you talking." : "It sounded more recited than spoken.",
    feedback.buriedEvidence ? "The strongest proof showed up late." : "",
    feedback.resumeChronology ? "It turned into a career timeline." : "",
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <p className="text-xs font-semibold tracking-[0.16em] text-accent">HOW AN INTERVIEWER MAY REMEMBER YOU</p>
        <p className="mt-2 text-lg font-medium leading-snug">{feedback.interviewerMemory}</p>
      </Card>
      <Card className="p-5">
        <p className="leading-7">{feedback.coaching}</p>
      </Card>
      <ul className="grid gap-2 sm:grid-cols-2">
        {notes.map((note) => (
          <li key={note} className="rounded-[14px] border border-line bg-card px-4 py-3 text-sm">
            {note}
          </li>
        ))}
      </ul>
    </div>
  );
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

function statusLabel(status: InterviewStatus, muted: boolean): string {
  if (status === "Connecting") return "Connecting";
  if (status === "Speaking") return "Claire is asking";
  if (status === "Thinking") return "Claire is listening";
  if (status === "Listening") return muted ? "Muted" : "Your turn";
  if (status === "Error") return "The practice did not start";
  return "Ready when you are";
}
