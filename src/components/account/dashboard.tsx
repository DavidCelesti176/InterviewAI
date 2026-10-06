"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { PageShell } from "@/components/interview/page-shell";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/auth-context";
import { authorizedFetch } from "@/lib/account/client";
import type { InterviewCard, InterviewStatusName } from "@/lib/account/types";
import { saveInterviewSetup, type InterviewSetup } from "@/lib/interview/browser-state";
import type { SavedInterviewResult } from "@/lib/interview/browser-state";
import { interviewModeLabel } from "@/lib/interview/labels";

export function Dashboard() {
  const { profile, user } = useAuth();
  const [interviews, setInterviews] = useState<InterviewCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const firstName = profile?.firstName || user?.displayName?.split(" ")[0] || "";

  useEffect(() => {
    let cancelled = false;
    void authorizedFetch("/api/account/interviews")
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as { interviews?: InterviewCard[]; error?: string } | null;
        if (!response.ok) throw new Error(body?.error || "Interviews could not be loaded.");
        return body?.interviews ?? [];
      })
      .then((items) => {
        if (!cancelled) setInterviews(items);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Interviews could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function remove(id: string) {
    setDeleting(true);
    setError("");
    try {
      const response = await authorizedFetch(`/api/account/interviews/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "That interview could not be deleted.");
      }
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

  async function resume() {
    setOpening(true);
    try {
      const response = await authorizedFetch(`/api/account/interviews/${item.id}`);
      const body = (await response.json()) as { result?: SavedInterviewResult; error?: string };
      if (!response.ok || !body.result) throw new Error(body.error || "This interview could not be opened.");
      saveInterviewSetup(body.result.setup satisfies InterviewSetup);
      router.push("/interview/prepare");
    } catch {
      setOpening(false);
    }
  }

  if (item.status === "ready") {
    return (
      <Button type="button" variant="secondary" disabled={opening} onClick={() => void resume()}>
        {opening ? "Opening…" : "Resume Interview"}
      </Button>
    );
  }
  if (item.status === "preparing") return null;
  return (
    <ButtonLink href={`/interview/${item.id}/results`} variant="secondary">
      View Results
    </ButtonLink>
  );
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
