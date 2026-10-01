import type { SpeakingMetrics } from "@/lib/interview/analysis-types";

export function SpeakingMetricsPanel({ metrics }: { metrics: SpeakingMetrics }) {
  const items = metricItems(metrics);
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold tracking-tight">How you spoke</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.label} className="rounded-[20px] border border-line bg-card px-5 py-4 shadow-[var(--shadow-card)]">
            <p className="text-sm text-muted">{item.label}</p>
            <p className="mt-1 text-lg font-semibold tracking-tight">{item.value}</p>
            {item.detail ? <p className="mt-1 text-sm text-muted">{item.detail}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function metricItems(metrics: SpeakingMetrics): Array<{ label: string; value: string; detail?: string }> {
  const items: Array<{ label: string; value: string; detail?: string }> = [];
  if (metrics.averageAnswerSeconds != null) {
    items.push({ label: "Average answer", value: formatSeconds(metrics.averageAnswerSeconds) });
  }
  if (metrics.longestAnswerSeconds != null) {
    items.push({ label: "Longest answer", value: formatSeconds(metrics.longestAnswerSeconds) });
  }
  if (metrics.approximateWordsPerMinute != null) {
    items.push({ label: "Speaking pace", value: `About ${metrics.approximateWordsPerMinute} words per minute` });
  }
  if (metrics.fillerWordCount != null && metrics.fillerWords && metrics.fillerWords.length > 0) {
    const top = [...metrics.fillerWords].sort((a, b) => b.count - a.count).slice(0, 2);
    items.push({
      label: "Filler words",
      value: String(metrics.fillerWordCount),
      detail: `Mostly ${top.map((item) => `“${item.word}”`).join(" and ")}`,
    });
  }
  if (metrics.quantifiedAnswerCount != null && metrics.totalRelevantAnswers != null && metrics.totalRelevantAnswers > 0) {
    items.push({
      label: "Answers with measurable impact",
      value: `${metrics.quantifiedAnswerCount} of ${metrics.totalRelevantAnswers}`,
    });
  }
  return items;
}

function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}
