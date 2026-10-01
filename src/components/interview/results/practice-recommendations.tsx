import type { PracticeRecommendation } from "@/lib/interview/analysis-types";

const priorityLabel = { high: "High priority", medium: "Worth practicing", low: "Later" };

export function PracticeRecommendations({ items }: { items: PracticeRecommendation[] }) {
  if (items.length === 0) return null;
  return (
    <section id="practice-plan" className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold tracking-tight">Practice recommendations</h2>
      <ol className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.title} className="rounded-[20px] border border-line bg-card px-5 py-4 shadow-[var(--shadow-card)]">
            <p className="text-sm text-muted">{priorityLabel[item.priority]}</p>
            <h3 className="mt-1 font-semibold">{item.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted">{item.reason}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
