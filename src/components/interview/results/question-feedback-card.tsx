"use client";

import type { QuestionFeedback } from "@/lib/interview/analysis-types";
import type { StarCoverage } from "@/lib/interview/star";
import { Button } from "@/components/ui/button";

export function QuestionFeedbackCard({
  feedback,
  starting,
  disabled,
  error,
  coaching,
  onPractice,
}: {
  feedback: QuestionFeedback;
  starting: boolean;
  disabled: boolean;
  error: string;
  coaching?: string;
  onPractice: () => void;
}) {
  return (
    <details id={`question-${feedback.id}`} className="group rounded-[24px] border border-line bg-card shadow-[var(--shadow-card)] [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-6">
        <span className="flex min-w-0 flex-col gap-2">
          <span className="text-lg font-semibold tracking-tight">{feedback.question}</span>
          {coaching ? <span className="w-fit rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">Coaching used</span> : null}
          <span className="text-sm leading-relaxed text-muted">{feedback.answerSummary}</span>
        </span>
        <span className="flex shrink-0 items-center gap-3">
          <span className="text-sm font-medium tabular-nums text-muted">{feedback.score}</span>
          <span className="text-muted transition group-open:rotate-180" aria-hidden="true">
            ⌄
          </span>
        </span>
      </summary>
      <div className="flex flex-col gap-5 border-t border-line px-6 py-5">
        {coaching ? <p className="text-sm leading-relaxed text-muted">{coaching}</p> : null}
        {feedback.framework === "star" && feedback.starCoverage ? <CoverageLine coverage={feedback.starCoverage} /> : null}
        {feedback.recommendedStory ? <p className="text-sm text-muted">Story to practice: {feedback.recommendedStory}</p> : null}
        <FeedbackList title="What worked" items={feedback.whatWorked} />
        <FeedbackList title="What held it back" items={feedback.whatHeldItBack} />
        {feedback.betterApproach ? (
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-medium">Better approach</h3>
            <p className="text-sm leading-relaxed text-muted">{feedback.betterApproach}</p>
          </div>
        ) : null}
        {feedback.exampleImprovedAnswer ? (
          <div className="rounded-2xl bg-background p-4">
            <h3 className="text-sm font-medium">A stronger version</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{feedback.exampleImprovedAnswer}</p>
          </div>
        ) : null}
        {feedback.recommendedForPractice ? (
          <div className="flex flex-col items-start gap-2">
            <Button type="button" variant="secondary" disabled={disabled} onClick={onPractice}>
              {starting ? "Starting practice…" : "Practice this answer"}
            </Button>
            {error ? (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            ) : (
              <p className="text-sm text-muted">A short voice session on this question, with one chance to try it again.</p>
            )}
          </div>
        ) : null}
      </div>
    </details>
  );
}

function CoverageLine({ coverage }: { coverage: StarCoverage }) {
  const parts = [
    `Situation ${coverage.situation}`,
    `Task ${coverage.task}`,
    `Action ${coverage.action}`,
    `Result ${coverage.result}`,
  ];
  if (coverage.learning !== "not_applicable") parts.push(`Learning ${coverage.learning}`);
  return <p className="text-sm text-muted">{parts.join(" · ")}</p>;
}

function FeedbackList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{title}</h3>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item} className="text-sm leading-relaxed text-muted">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
