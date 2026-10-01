"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { HelpKind, InterviewHelpResponse } from "@/lib/interview/help-types";
import type { InterviewTurn } from "@/lib/interview/types";

const options: Array<{ kind: HelpKind; title: string; detail: string }> = [
  { kind: "rephrase", title: "Rephrase this question", detail: "Hear it in simpler language." },
  { kind: "competency", title: "What are they looking for?", detail: "The skill this question is testing." },
  { kind: "structure", title: "Help me structure it", detail: "A short way to organize your thinking." },
  { kind: "experiences", title: "Find an example from my experience", detail: "Ideas grounded in your background." },
];

const loadingCopy: Record<HelpKind, string> = {
  rephrase: "Thinking through the question…",
  competency: "Thinking through the question…",
  structure: "Thinking through the question…",
  experiences: "Finding relevant experiences…",
};

export function InterviewHelpPanel({
  interviewId,
  question,
  turns,
  onResume,
  onRepeat,
  onHelped,
  onEnd,
}: {
  interviewId: string;
  question: string;
  turns: InterviewTurn[];
  onResume: (repeat: boolean) => void;
  onRepeat: () => void;
  onHelped: (kind: HelpKind) => void;
  onEnd: () => void;
}) {
  const [kind, setKind] = useState<HelpKind | null>(null);
  const [help, setHelp] = useState<InterviewHelpResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [repeat, setRepeat] = useState(false);

  async function requestHelp(next: HelpKind) {
    if (!question || loading) return;
    setKind(next);
    setHelp(null);
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/interview/help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interviewId,
          kind: next,
          question,
          turns: turns.slice(-8).map((turn) => ({
            speaker: turn.speaker,
            text: turn.text,
            timestampMs: turn.timestampMs,
          })),
        }),
      });
      const body = (await response.json()) as { error?: string; help?: InterviewHelpResponse };
      if (!response.ok || !body.help) throw new Error(body.error || "We couldn't load coaching right now.");
      setHelp(body.help);
      onHelped(next);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "We couldn't load coaching right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="absolute inset-0 z-20 flex items-end justify-center bg-[#0c1220]/75 px-4 py-4 backdrop-blur-sm sm:items-center">
      <div className="flex max-h-[min(100%,40rem)] w-full max-w-lg flex-col gap-4 overflow-auto rounded-[28px] border border-white/10 bg-[#121826] p-6 text-left shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="help-title">
        <div>
          <p className="text-sm text-white/50">Practice Mode</p>
          <h2 id="help-title" className="mt-1 text-2xl font-semibold tracking-tight">
            Need a hand?
          </h2>
        </div>
        <div className="rounded-2xl bg-white/5 px-4 py-3">
          <p className="text-xs font-medium tracking-wide text-white/45 uppercase">Current question</p>
          <p className="mt-1 text-sm leading-relaxed text-white/85">{question || "The interviewer hasn't asked a question yet."}</p>
        </div>
        {question && !help && !loading && !repeat ? (
          <div className="grid gap-2">
            {options.map((option) => (
              <button
                key={option.kind}
                type="button"
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:border-white/25"
                onClick={() => void requestHelp(option.kind)}
              >
                <span className="block text-sm font-medium">{option.title}</span>
                <span className="mt-0.5 block text-sm text-white/55">{option.detail}</span>
              </button>
            ))}
            <button
              type="button"
              className="rounded-2xl border border-white/10 px-4 py-3 text-left text-sm font-medium transition hover:border-white/25"
              onClick={() => {
                setRepeat(true);
                onRepeat();
              }}
            >
              Repeat question
            </button>
          </div>
        ) : null}
        {loading && kind ? <p className="text-sm text-white/70">{loadingCopy[kind]}</p> : null}
        {error ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-red-300" role="alert">
              {error}
            </p>
            {kind ? (
              <Button type="button" variant="room" onClick={() => void requestHelp(kind)}>
                Retry
              </Button>
            ) : null}
          </div>
        ) : null}
        {help ? <HelpResult help={help} /> : null}
        {repeat && !help ? <p className="text-sm text-white/70">The interviewer will repeat the question when you resume.</p> : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" onClick={() => onResume(repeat)}>
            Resume interview
          </Button>
          <Button type="button" variant="room" onClick={onEnd}>
            End interview
          </Button>
          {help || error || repeat ? (
            <Button
              type="button"
              variant="room"
              onClick={() => {
                setHelp(null);
                setError("");
                setKind(null);
                setRepeat(false);
              }}
            >
              Choose another type of help
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function HelpResult({ help }: { help: InterviewHelpResponse }) {
  if (help.rephrasedQuestion) {
    return <p className="text-sm leading-relaxed text-white/85">{help.rephrasedQuestion}</p>;
  }
  if (help.competency) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">{help.competency.name}</p>
        <p className="text-sm leading-relaxed text-white/75">{help.competency.explanation}</p>
        {help.competency.whatStrongAnswersShow.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {help.competency.whatStrongAnswersShow.map((item) => (
              <li key={item} className="text-sm leading-relaxed text-white/75">
                {item}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
  if (help.answerFramework) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium">{help.answerFramework.name}</p>
        <ol className="flex flex-col gap-2">
          {help.answerFramework.steps.map((step) => (
            <li key={step.label}>
              <p className="text-sm font-medium">{step.label}</p>
              <p className="text-sm leading-relaxed text-white/70">{step.guidance}</p>
            </li>
          ))}
        </ol>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {help.suggestedExperiences && help.suggestedExperiences.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {help.suggestedExperiences.map((item) => (
            <li key={`${item.source}-${item.title}`}>
              <p className="text-sm font-medium">{item.title}</p>
              <p className="text-sm leading-relaxed text-white/70">{item.reason}</p>
            </li>
          ))}
        </ul>
      ) : null}
      {help.note ? <p className="text-sm leading-relaxed text-white/75">{help.note}</p> : null}
    </div>
  );
}
