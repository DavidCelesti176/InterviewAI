import type { HighlightMoment } from "@/lib/interview/analysis-types";

export function HighlightCard({
  kind,
  moment,
}: {
  kind: "strength" | "opportunity";
  moment: HighlightMoment;
}) {
  const strength = kind === "strength";
  return (
    <article className="flex flex-col gap-3 rounded-[24px] border border-line bg-card p-6 shadow-[var(--shadow-card)]">
      <p className={`text-sm font-medium ${strength ? "text-success" : "text-warning"}`}>
        {strength ? "Strongest moment" : "Missed opportunity"}
      </p>
      <h3 className="text-xl font-semibold tracking-tight">{moment.title}</h3>
      <p className="leading-relaxed text-muted">{moment.explanation}</p>
      {moment.relatedQuestion ? <p className="text-sm text-foreground">{moment.relatedQuestion}</p> : null}
    </article>
  );
}
