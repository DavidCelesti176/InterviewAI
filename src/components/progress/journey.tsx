import { Card } from "@/components/ui/card";
import type { ProgressView } from "@/lib/progress/types";

export function Journey({ progress }: { progress: ProgressView }) {
  const current = progress.journey.find((stage) => stage.id === progress.highlightedStage) ?? progress.journey[0];
  if (!current) return null;
  return (
    <Card className="p-6">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-accent">Training journey</p>
        <p className="text-sm text-muted">
          {progress.completedStages} of {progress.journey.length}
        </p>
      </div>
      <h2 className="mt-2 text-lg font-semibold">{current.label}</h2>
      <p className="mt-1 text-sm text-muted">{current.detail}</p>
      <ol className="mt-4 flex gap-1.5" aria-label="Journey stages">
        {progress.journey.map((stage) => (
          <li
            key={stage.id}
            className={`h-1.5 flex-1 rounded-full ${stage.state === "complete" ? "bg-accent" : stage.id === current.id ? "bg-accent/40" : "bg-line"}`}
            title={stage.label}
          >
            <span className="sr-only">
              {stage.label}
              {stage.state === "complete" ? ", complete" : stage.id === current.id ? ", current" : ""}
            </span>
          </li>
        ))}
      </ol>
      {progress.newestAchievement ? <p className="mt-4 text-sm text-muted">Latest: {progress.newestAchievement.label}</p> : null}
    </Card>
  );
}
