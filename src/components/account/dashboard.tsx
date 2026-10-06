"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { PageShell } from "@/components/interview/page-shell";
import { ProgressPanel } from "@/components/progress/progress-panel";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/auth-context";
import { authorizedFetch } from "@/lib/account/client";
import { deleteOwnedInterview, listOwnedInterviews } from "@/lib/account/interviews";
import type { InterviewCard, InterviewStatusName } from "@/lib/account/types";
import { readSavedStory } from "@/lib/story/client";
import type { ProfessionalStory } from "@/lib/story/types";
import { saveInterviewSetup, savePracticeSetup, type InterviewSetup } from "@/lib/interview/browser-state";
import type { SavedInterviewResult } from "@/lib/interview/browser-state";
import { interviewModeLabel } from "@/lib/interview/labels";

export function Dashboard() {
  const { profile, user } = useAuth();
  const [interviews, setInterviews] = useState<InterviewCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [story, setStory] = useState<ProfessionalStory | null>(null);
  const firstName = profile?.firstName || user?.displayName?.split(" ")[0] || "";

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void Promise.all([listOwnedInterviews(user.uid), readSavedStory(user.uid).catch(() => null)])
      .then(([items, savedStory]) => {
        if (cancelled) return;
        setInterviews(items);
        setStory(savedStory);
      })
      .catch(() => {
        if (!cancelled) setError("Your interviews could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function remove(id: string) {
    setDeleting(true);
    setError("");
    try {
      if (!user) throw new Error("Sign in to continue.");
      await deleteOwnedInterview(user.uid, id);
      setInterviews((current) => current.filter((item) => item.id !== id));
      setPendingDelete(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That interview could not be deleted.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <PageShell width="wide">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{greeting(firstName)}</h1>
          <p className="mt-1 text-muted">Prepare for your next interview.</p>
          <p className="mt-2 text-sm text-muted">Your resume, transcript, and feedback are saved privately to your account.</p>
          {user && !user.emailVerified ? (
            <p className="mt-2 text-sm text-muted">Verify your email when you can. You can keep using InterviewAI.</p>
          ) : null}
        </div>
        <ButtonLink href="/interview/new" className="w-fit">
          Start New Interview
        </ButtonLink>
      </div>
      <ProgressPanel />
      <StoryTool story={story} loading={loading} />
      {latestPractice(interviews) ? (
        <Card className="flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-accent">Career preparation</p>
            <h2 className="mt-1 text-lg font-semibold">Practice weak answers</h2>
            <p className="mt-1 text-sm text-muted">
              {latestPractice(interviews)?.company} · {latestPractice(interviews)?.jobTitle}
            </p>
          </div>
          <ButtonLink href={`/interview/${latestPractice(interviews)?.id}/results`} variant="secondary">
            Practice weak answers
          </ButtonLink>
        </Card>
      ) : null}
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <div className="h-28" aria-hidden="true" /> : null}
      {!loading && interviews.length === 0 ? (
        <Card className="flex flex-col items-start gap-3 p-6">
          <h2 className="text-lg font-semibold">No interviews yet</h2>
          <p className="max-w-md text-sm text-muted">When you finish an interview, the job, transcript, and feedback stay here.</p>
        </Card>
      ) : null}
      <div className="grid gap-3">
        {interviews.map((item) => (
          <Card key={item.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-lg font-semibold">{item.company}</p>
              <p className="text-sm text-muted">{item.jobTitle}</p>
              <p className="mt-1 text-sm text-muted">
                {formatWhen(item.completedAt ?? item.createdAt)} · {item.sessionKind === "practice" ? "Answer practice" : interviewModeLabel(item.interviewMode === "practice" ? "practice" : "mock")}
                {item.activeDurationSeconds > 0 ? ` · ${formatMinutes(item.activeDurationSeconds)}` : ""}
              </p>
              <p className="mt-2 text-sm">
                {item.overallReadiness !== null ? (
                  <>
                    Interview Readiness <span className="font-semibold">{Math.round(item.overallReadiness)}</span>
                  </>
                ) : (
                  <span className="text-muted">{statusLabel(item.status)}</span>
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <InterviewAction item={item} />
              {pendingDelete === item.id ? (
                <Button type="button" variant="danger" disabled={deleting} onClick={() => void remove(item.id)}>
                  {deleting ? "Deleting…" : "Confirm delete"}
                </Button>
              ) : (
                <Button type="button" variant="ghost" onClick={() => setPendingDelete(item.id)}>
                  Delete
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}

function InterviewAction({ item }: { item: InterviewCard }) {
  const router = useRouter();
  const [opening, setOpening] = useState(false);
  const [actionError, setActionError] = useState("");
  const replayable = item.status === "complete" || item.status === "in_progress" || item.status === "failed" || item.status === "analyzing";

  async function resume() {
    setOpening(true);
    setActionError("");
    try {
      const response = await authorizedFetch(`/api/account/interviews/${item.id}`);
      const body = (await response.json()) as { result?: SavedInterviewResult; error?: string };
      if (!response.ok || !body.result) throw new Error(body.error || "This interview could not be opened.");
      saveInterviewSetup(body.result.setup satisfies InterviewSetup);
      router.push("/interview/prepare");
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "This interview could not be opened.");
      setOpening(false);
    }
  }

  async function practiceAgain() {
    setOpening(true);
    setActionError("");
    try {
      const response = await authorizedFetch(`/api/account/interviews/${item.id}/replay`, { method: "POST" });
      const body = (await response.json()) as { setup?: InterviewSetup; practiceQuestions?: string[]; error?: string };
      if (!response.ok || !body.setup) throw new Error(body.error || "This interview could not be opened again.");
      if (body.practiceQuestions && body.practiceQuestions.length > 0) {
        savePracticeSetup({
          interviewId: body.setup.interviewId,
          company: body.setup.company,
          jobTitle: body.setup.jobTitle,
          interviewType: body.setup.interviewType,
          interviewerProfileId: body.setup.interviewerProfileId,
          questions: body.practiceQuestions,
        });
        router.push("/interview/practice");
        return;
      }
      saveInterviewSetup(body.setup);
      router.push("/interview/prepare");
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "This interview could not be opened again.");
      setOpening(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap gap-2">
        {item.status === "ready" ? (
          <Button type="button" variant="secondary" disabled={opening} onClick={() => void resume()}>
            {opening ? "Opening…" : "Resume Interview"}
          </Button>
        ) : null}
        {replayable ? (
          <Button type="button" disabled={opening} onClick={() => void practiceAgain()}>
            {opening ? "Opening…" : "Practice again"}
          </Button>
        ) : null}
        {item.status !== "ready" && item.status !== "preparing" ? (
          <ButtonLink href={`/interview/${item.id}/results`} variant="secondary">
            View Results
          </ButtonLink>
        ) : null}
      </div>
      {actionError ? (
        <p className="text-sm text-danger" role="alert">
          {actionError}
        </p>
      ) : null}
    </div>
  );
}

function StoryTool({ story, loading }: { story: ProfessionalStory | null; loading: boolean }) {
  if (loading) return <div className="h-36 rounded-[20px] border border-line bg-card" aria-hidden="true" />;
  if (!story) {
    return (
      <Card className="flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl">
          <p className="text-sm font-medium text-accent">Career preparation</p>
          <h2 className="mt-1 text-xl font-semibold">Build Your Story</h2>
          <p className="mt-1 text-sm text-muted">Turn your resume into a memorable professional story for “Tell me about yourself.”</p>
          <p className="mt-1 text-sm text-muted">Discover the common thread in your experience.</p>
        </div>
        <ButtonLink href="/story-builder">Build My Story</ButtonLink>
      </Card>
    );
  }
  return (
    <Card className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="max-w-xl">
        <p className="text-sm font-medium text-accent">Your story</p>
        <h2 className="mt-1 text-xl font-semibold">{story.identity.label}</h2>
        <p className="mt-1 text-sm text-muted">“{story.identity.statement}”</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <ButtonLink href="/story-builder" variant="secondary">
          View / Edit
        </ButtonLink>
        <ButtonLink href="/story-builder/practice">Practice</ButtonLink>
      </div>
    </Card>
  );
}

function latestPractice(interviews: InterviewCard[]): InterviewCard | undefined {
  return interviews.find((item) => item.status === "complete" && item.sessionKind === "interview");
}

function greeting(name: string): string {
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return name ? `${hello}, ${name}` : hello;
}

function formatWhen(value: number): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatMinutes(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
}

function statusLabel(status: InterviewStatusName): string {
  switch (status) {
    case "ready":
      return "Ready";
    case "in_progress":
      return "In progress";
    case "analyzing":
      return "Analyzing";
    case "complete":
      return "Complete";
    case "failed":
      return "Interrupted";
    case "preparing":
      return "Preparing";
    default:
      return "Draft";
  }
}
