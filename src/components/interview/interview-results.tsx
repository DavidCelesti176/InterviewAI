"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { interviewerById } from "@/components/interview/avatar/profile";
import { PageShell } from "@/components/interview/page-shell";
import { AnalysisLoading, type AnalysisStepId } from "@/components/interview/results/analysis-loading";
import { HighlightCard } from "@/components/interview/results/highlight-card";
import { PracticeRecommendations } from "@/components/interview/results/practice-recommendations";
import { QuestionFeedbackCard } from "@/components/interview/results/question-feedback-card";
import { ReadinessCard } from "@/components/interview/results/readiness-card";
import { SkillBreakdown } from "@/components/interview/results/skill-breakdown";
import { SpeakingMetricsPanel } from "@/components/interview/results/speaking-metrics";
import { Button, ButtonLink } from "@/components/ui/button";
import { authorizedFetch } from "@/lib/account/client";
import { coachingNote, helpRequestCount, mostRequestedHelp } from "@/lib/interview/assistance";
import type { AnalysisDebug, InterviewAnalysis, QuestionFeedback } from "@/lib/interview/analysis-types";
import {
  readInterviewResult,
  clearPracticeNotice,
  readPracticeNotice,
  saveInterviewAnalysis,
  saveInterviewResult,
  savePracticeSetup,
  type PracticeNotice,
  type SavedInterviewResult,
} from "@/lib/interview/browser-state";
import type { InterviewAssistanceEvent, InterviewMode } from "@/lib/interview/help-types";
import { interviewModeLabel, interviewTypeLabel } from "@/lib/interview/labels";
import { questionsForWeakPractice } from "@/lib/interview/practice-questions";

type Phase = "loading" | "ready" | "error" | "thin";

type AnalysisPayload = { analysis: InterviewAnalysis; debug?: AnalysisDebug; saved?: boolean };

const pending = new Map<string, Promise<AnalysisPayload>>();
const listeners = new Map<string, (event: { step: AnalysisStepId; state: "active" | "done" }) => void>();

export function InterviewResults({ interviewId }: { interviewId?: string }) {
  const router = useRouter();
  const [result, setResult] = useState<SavedInterviewResult | null>(null);
  const [missing, setMissing] = useState(false);
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState("");
  const [saveWarning, setSaveWarning] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [steps, setSteps] = useState<Partial<Record<AnalysisStepId, "active" | "done">>>({});
  const [attempt, setAttempt] = useState(0);
  const [practiceNotice, setPracticeNotice] = useState<PracticeNotice | null>(null);
  const [practiceTarget, setPracticeTarget] = useState<string | null>(null);
  const [practiceErrorTarget, setPracticeErrorTarget] = useState<string | null>(null);
  const [practiceError, setPracticeError] = useState("");
  const practicingRef = useRef(false);

  useEffect(() => {
    setPracticeNotice(readPracticeNotice());
  }, []);

  useEffect(() => {
    if (phase !== "ready" || !interviewId) return;
    void authorizedFetch("/api/progress/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interviewId }),
    }).catch(() => undefined);
  }, [interviewId, phase]);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<SavedInterviewResult | null> {
      if (!interviewId) return readInterviewResult();
      const response = await authorizedFetch(`/api/account/interviews/${interviewId}`);
      if (response.status === 404) return null;
      const body = (await response.json().catch(() => null)) as { result?: SavedInterviewResult; error?: string } | null;
      if (!response.ok || !body?.result) throw new Error(body?.error || "This interview could not be opened.");
      const local = readInterviewResult();
      if (local?.setup.interviewId === body.result.setup.interviewId && local.turns.length > body.result.turns.length) {
        return {
          ...body.result,
          turns: local.turns,
          elapsedMs: local.elapsedMs || body.result.elapsedMs,
          assistance: local.assistance ?? body.result.assistance,
          pauses: local.pauses ?? body.result.pauses,
          analysis: body.result.analysis ?? local.analysis,
        };
      }
      return body.result;
    }
    void load()
      .then((saved) => {
        if (cancelled) return;
        if (!saved) {
          setMissing(true);
          return;
        }
        saveInterviewResult(saved);
        setResult(saved);
        const candidateText = saved.turns
          .filter((turn) => turn.speaker === "candidate")
          .map((turn) => turn.text.trim())
          .join(" ");
        if (candidateText.length < 40) {
          setPhase("thin");
          return;
        }
        if (saved.analysis && typeof saved.analysis.overallReadiness === "number" && saved.analysis.summary) {
          setPhase("ready");
          return;
        }
        const id = saved.setup.interviewId;
        listeners.set(id, (event) => {
          setSteps((current) => ({ ...current, [event.step]: event.state }));
        });
        return requestAnalysis(saved, attempt > 0).then((payload) => {
          if (cancelled) return;
          saveInterviewAnalysis(payload.analysis, payload.debug);
          setResult(readInterviewResult());
          setSaveWarning(payload.saved === false);
          setPhase("ready");
        });
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : "We couldn't finish your analysis yet.");
        setPhase("error");
      });
    return () => {
      cancelled = true;
      if (interviewId) listeners.delete(interviewId);
    };
  }, [attempt, interviewId]);

  async function beginPractice(saved: SavedInterviewResult, questions: QuestionFeedback[], target: string) {
    if (practicingRef.current || questions.length === 0) return;
    practicingRef.current = true;
    setPracticeError("");
    setPracticeErrorTarget(null);
    setPracticeTarget(target);
    try {
      const response = await authorizedFetch("/api/interview/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interviewId: saved.setup.interviewId,
          questions: questions.map((item) => ({
            id: item.id,
            question: item.question,
            answerSummary: item.answerSummary,
            whatHeldItBack: item.whatHeldItBack,
            betterApproach: item.betterApproach,
          })),
        }),
      });
      const body = (await response.json()) as { error?: string; practiceId?: string };
      if (!response.ok || !body.practiceId) {
        throw new Error(body.error || "Practice could not be started.");
      }
      savePracticeSetup({
        interviewId: body.practiceId,
        company: saved.setup.company,
        jobTitle: saved.setup.jobTitle,
        interviewType: saved.setup.interviewType,
        interviewerProfileId: saved.setup.interviewerProfileId,
        questions: questions.map((item) => item.question),
      });
      router.push("/interview/practice");
    } catch (reason: unknown) {
      practicingRef.current = false;
      setPracticeError(reason instanceof Error ? reason.message : "Practice could not be started.");
      setPracticeErrorTarget(target);
      setPracticeTarget(null);
    }
  }

  if (missing) {
    return (
      <PageShell>
        <h1 className="text-4xl font-semibold tracking-tight">No completed interview</h1>
        <p className="text-muted">Finish an interview and the review will show up here.</p>
        <ButtonLink href="/interview/new">Start an interview</ButtonLink>
      </PageShell>
    );
  }

  if (!result) {
    return (
      <PageShell>
        <h1 className="text-3xl font-semibold tracking-tight">{phase === "error" ? "Couldn't open this interview" : "Loading interview"}</h1>
        <p className="text-muted">{phase === "error" ? error : "Opening your saved interview."}</p>
      </PageShell>
    );
  }

  if (phase === "loading") {
    return <AnalysisLoading states={steps} company={result.setup.company} jobTitle={result.setup.jobTitle} />;
  }

  return (
    <PageShell width="wide">
      {practiceNotice ? (
        <section className="flex items-start justify-between gap-4 rounded-[24px] border border-line bg-card p-5 shadow-[var(--shadow-card)]">
          <div>
            <p className="text-sm font-medium text-accent">Practice complete</p>
            <p className="mt-1 text-muted">
              You practiced {practiceNotice.questionCount === 1 ? "1 answer" : `${practiceNotice.questionCount} answers`}. This
              review is still from your full interview.
            </p>
          </div>
          <button
            type="button"
            className="text-sm text-muted"
            onClick={() => {
              clearPracticeNotice();
              setPracticeNotice(null);
            }}
          >
            Dismiss
          </button>
        </section>
      ) : null}

      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium text-accent">Interview complete</p>
        <h1 className="text-4xl font-semibold tracking-tight">{result.setup.company}</h1>
        <p className="text-lg text-muted">{result.setup.jobTitle}</p>
        <p className="text-sm text-muted">Practiced with {interviewerById(result.setup.interviewerProfileId).name}</p>
        <p className="text-sm text-muted">
          {interviewModeLabel(result.setup.interviewMode)} · {interviewTypeLabel(result.setup.interviewType)} · {formatDuration(result.elapsedMs)}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {confirmDelete ? (
            <Button
              type="button"
              variant="danger"
              disabled={deleting}
              onClick={() => {
                setDeleting(true);
                void authorizedFetch(`/api/account/interviews/${result.setup.interviewId}`, { method: "DELETE" })
                  .then((response) => {
                    if (!response.ok) throw new Error("delete failed");
                    router.push("/dashboard");
                  })
                  .catch(() => {
                    setDeleting(false);
                    setError("This interview could not be deleted.");
                  });
              }}
            >
              {deleting ? "Deleting…" : "Confirm delete"}
            </Button>
          ) : (
            <Button type="button" variant="ghost" onClick={() => setConfirmDelete(true)}>
              Delete interview
            </Button>
          )}
        </div>
      </header>
      {saveWarning ? (
        <p className="text-sm text-danger" role="alert">
          This review is on screen, but it could not be saved to your account yet.
        </p>
      ) : null}

      {phase === "thin" ? (
        <section className="flex flex-col gap-3 rounded-[24px] border border-line bg-card p-6 shadow-[var(--shadow-card)]">
          <h2 className="text-2xl font-semibold tracking-tight">There isn't enough of the conversation to review.</h2>
          <p className="text-muted">The transcript is still here. Start another interview when you're ready.</p>
        </section>
      ) : null}

      {phase === "error" ? (
        <section className="flex flex-col items-start gap-4 rounded-[24px] border border-line bg-card p-6 shadow-[var(--shadow-card)]">
          <h2 className="text-2xl font-semibold tracking-tight">We couldn't finish your analysis yet.</h2>
          <p className="text-muted">
            {error === "We couldn't finish your analysis yet."
              ? "Your transcript is saved to your account. You can try the analysis again."
              : error}
          </p>
          <Button
            type="button"
            onClick={() => {
              setSteps({});
              setError("");
              setPhase("loading");
              setAttempt((value) => value + 1);
            }}
          >
            Try the analysis again
          </Button>
        </section>
      ) : null}

      {phase === "ready" && result.analysis ? (
        <AnalysisView
          analysis={result.analysis}
          assistance={result.assistance ?? []}
          pauseCount={result.pauses?.length ?? 0}
          interviewMode={result.setup.interviewMode}
          practiceTarget={practiceTarget}
          practiceErrorTarget={practiceErrorTarget}
          practiceError={practiceError}
          onPractice={(questions, target) => void beginPractice(result, questions, target)}
        />
      ) : null}

      <Transcript turns={result.turns} interviewerName={interviewerById(result.setup.interviewerProfileId).name} />
      {process.env.NODE_ENV === "development" ? (
        <DeveloperAnalysis debug={result.analysisDebug} analysis={result.analysis} error={phase === "error" ? error : ""} />
      ) : null}

      <div className="flex flex-col items-start gap-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          {phase === "ready" && result.analysis && questionsForWeakPractice(result.analysis).length > 0 ? (
            <Button
              type="button"
              disabled={practiceTarget !== null}
              onClick={() => {
                if (!result.analysis) return;
                void beginPractice(result, questionsForWeakPractice(result.analysis), "weak");
              }}
            >
              {practiceTarget === "weak" ? "Starting practice…" : "Practice weak answers"}
            </Button>
          ) : null}
          <ButtonLink href="/interview/new" variant={phase === "ready" ? "secondary" : "primary"}>
            Start another interview
          </ButtonLink>
          <ButtonLink href="/story-builder" variant="ghost">
            Improve your opening story
          </ButtonLink>
        </div>
        {phase === "ready" && result.analysis && questionsForWeakPractice(result.analysis).length > 0 ? (
          <p className="text-sm text-muted">A voice session on the answers that need the most work. Your review stays here.</p>
        ) : null}
        {practiceErrorTarget === "weak" && practiceError ? (
          <p className="text-sm text-danger" role="alert">
            {practiceError}
          </p>
        ) : null}
      </div>
    </PageShell>
  );
}

function AnalysisView({
  analysis,
  assistance,
  pauseCount,
  interviewMode,
  practiceTarget,
  practiceErrorTarget,
  practiceError,
  onPractice,
}: {
  analysis: InterviewAnalysis;
  assistance: InterviewAssistanceEvent[];
  pauseCount: number;
  interviewMode: InterviewMode | undefined;
  practiceTarget: string | null;
  practiceErrorTarget: string | null;
  practiceError: string;
  onPractice: (questions: QuestionFeedback[], target: string) => void;
}) {
  return (
    <>
      <ReadinessCard analysis={analysis} />
      <div className="grid gap-4 lg:grid-cols-2">
        <HighlightCard kind="strength" moment={analysis.strongestMoment} />
        <HighlightCard kind="opportunity" moment={analysis.missedOpportunity} />
      </div>
      <SkillBreakdown scores={analysis.categoryScores} />
      <section className="grid gap-4 lg:grid-cols-2">
        <FeedbackColumn title="Strengths" items={analysis.strengths} />
        <FeedbackColumn title="Focus areas" items={analysis.focusAreas} />
      </section>
      <AssistanceSummary analysis={analysis} assistance={assistance} pauseCount={pauseCount} interviewMode={interviewMode} />
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold tracking-tight">Question review</h2>
        {analysis.questionFeedback.map((feedback) => (
          <QuestionFeedbackCard
            key={feedback.id}
            feedback={feedback}
            starting={practiceTarget === feedback.id}
            disabled={practiceTarget !== null}
            error={practiceErrorTarget === feedback.id ? practiceError : ""}
            coaching={coachingNote(assistance, feedback.question)}
            onPractice={() => onPractice([feedback], feedback.id)}
          />
        ))}
      </section>
      <SpeakingMetricsPanel metrics={analysis.speakingMetrics} />
      <PracticeRecommendations items={analysis.practiceRecommendations} />
    </>
  );
}

function AssistanceSummary({
  analysis,
  assistance,
  pauseCount,
  interviewMode,
}: {
  analysis: InterviewAnalysis;
  assistance: InterviewAssistanceEvent[];
  pauseCount: number;
  interviewMode: InterviewMode | undefined;
}) {
  const helpCount = helpRequestCount(assistance);
  const focus = mostRequestedHelp(assistance);
  if (helpCount === 0 && pauseCount === 0 && !analysis.assistanceNote) return null;
  return (
    <section className="flex flex-col gap-2 rounded-[24px] border border-line bg-card p-6 shadow-[var(--shadow-card)]">
      <h2 className="text-xl font-semibold tracking-tight">Assistance used</h2>
      {helpCount > 0 ? (
        <p className="text-sm text-muted">
          {helpCount === 1 ? "1 time" : `${helpCount} times`}
          {focus ? ` · Most requested help: ${focus}` : ""}
        </p>
      ) : null}
      {pauseCount > 0 ? (
        <p className="text-sm text-muted">
          Pauses used: {pauseCount}.
          {interviewMode === "mock" ? " This mock included a pause, so it was not fully unassisted." : ""}
        </p>
      ) : null}
      {analysis.assistanceNote ? <p className="text-sm leading-relaxed">{analysis.assistanceNote}</p> : null}
    </section>
  );
}

function FeedbackColumn({
  title,
  items,
}: {
  title: string;
  items: InterviewAnalysis["strengths"];
}) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-4 rounded-[24px] border border-line bg-card p-6 shadow-[var(--shadow-card)]">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <ul className="flex flex-col gap-4">
        {items.map((item) => (
          <li key={item.title} className="flex flex-col gap-1">
            <h3 className="font-medium">{item.title}</h3>
            <p className="text-sm leading-relaxed text-muted">{item.explanation}</p>
            {item.evidence ? <p className="text-sm leading-relaxed">{item.evidence}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Transcript({
  turns,
  interviewerName,
}: {
  turns: SavedInterviewResult["turns"];
  interviewerName: string;
}) {
  return (
    <section className="flex flex-col gap-5 rounded-[24px] border border-line bg-card p-6 shadow-[var(--shadow-card)]">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Transcript</h2>
        <p className="mt-1 text-sm text-muted">The full conversation from this interview.</p>
      </div>
      {turns.length === 0 ? (
        <p className="text-sm text-muted">No conversation was captured.</p>
      ) : (
        <ol className="flex flex-col gap-5">
          {turns.map((turn) => {
            const candidate = turn.speaker === "candidate";
            return (
              <li key={turn.id} className="flex flex-col gap-1">
                <p className="text-sm font-medium">
                  <span className={candidate ? "text-foreground" : "text-accent"}>{candidate ? "You" : interviewerName}</span>
                  <span className="font-normal text-muted"> · {formatDuration(turn.timestampMs)}</span>
                </p>
                <p className="whitespace-pre-wrap leading-relaxed">{turn.text}</p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function DeveloperAnalysis({
  analysis,
  debug,
  error,
}: {
  analysis?: InterviewAnalysis;
  debug?: AnalysisDebug;
  error: string;
}) {
  if (!debug && !error && !analysis) return null;
  return (
    <details className="rounded-[20px] border border-dashed border-line p-4 text-sm">
      <summary className="cursor-pointer font-medium">Developer analysis</summary>
      <div className="mt-4 flex flex-col gap-4">
        {debug ? (
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-muted">Model</dt>
              <dd>{debug.model}</dd>
            </div>
            <div>
              <dt className="text-muted">Duration</dt>
              <dd>{Math.round(debug.durationMs / 100) / 10}s</dd>
            </div>
            <div>
              <dt className="text-muted">Request ID</dt>
              <dd className="break-all">{debug.responseId}</dd>
            </div>
            {debug.usage ? (
              <div>
                <dt className="text-muted">Tokens</dt>
                <dd>
                  {debug.usage.inputTokens ?? 0} in · {debug.usage.outputTokens ?? 0} out
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}
        {error ? <p>{error}</p> : null}
        {analysis ? (
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap text-xs text-muted">{JSON.stringify(analysis, null, 2)}</pre>
        ) : null}
      </div>
    </details>
  );
}

function requestAnalysis(result: SavedInterviewResult, force: boolean): Promise<AnalysisPayload> {
  const id = result.setup.interviewId;
  if (!force) {
    const existing = pending.get(id);
    if (existing) return existing;
  }
  const promise = runAnalysis(result).finally(() => {
    if (pending.get(id) === promise) pending.delete(id);
  });
  pending.set(id, promise);
  return promise;
}

async function runAnalysis(result: SavedInterviewResult): Promise<AnalysisPayload> {
  const response = await authorizedFetch("/api/interview/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      interviewId: result.setup.interviewId,
      elapsedMs: result.elapsedMs,
      turns: result.turns,
      assistance: result.assistance ?? [],
      pausedMs: result.pausedMs ?? 0,
    }),
  });
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await response.json()) as { error?: string };
    throw new Error(body.error || "We couldn't finish your analysis yet.");
  }
  if (!response.ok || !response.body) throw new Error("We couldn't finish your analysis yet.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let payload: AnalysisPayload | null = null;
  const id = result.setup.interviewId;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as {
        step?: string;
        state?: "active" | "done";
        error?: string;
        analysis?: InterviewAnalysis;
        debug?: AnalysisDebug;
        saved?: boolean;
      };
      if (event.step === "error") throw new Error(event.error || "We couldn't finish your analysis yet.");
      if (event.step === "ready" && event.analysis) {
        payload = { analysis: event.analysis, debug: event.debug, saved: event.saved };
        continue;
      }
      if (
        (event.step === "reviewing" || event.step === "evaluating" || event.step === "building_plan") &&
        event.state
      ) {
        listeners.get(id)?.({ step: event.step, state: event.state });
      }
    }
  }
  if (!payload) throw new Error("We couldn't finish your analysis yet.");
  return payload;
}

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
