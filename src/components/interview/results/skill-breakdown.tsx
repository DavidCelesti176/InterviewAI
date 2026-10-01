import type { InterviewAnalysis } from "@/lib/interview/analysis-types";

const categories = [
  ["communication", "Communication"],
  ["specificity", "Specificity"],
  ["structure", "Answer structure"],
  ["conciseness", "Conciseness"],
  ["businessImpact", "Business impact"],
  ["roleAlignment", "Role alignment"],
] as const;

export function SkillBreakdown({ scores }: { scores: InterviewAnalysis["categoryScores"] }) {
  return (
    <section className="flex flex-col gap-5 rounded-[24px] border border-line bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
      <h2 className="text-xl font-semibold tracking-tight">Skill breakdown</h2>
      <ul className="grid gap-5 sm:grid-cols-2">
        {categories.map(([key, label]) => {
          const skill = scores[key];
          return (
            <li key={key} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-medium">{label}</p>
                <p className="text-sm tabular-nums text-muted">{skill.score}</p>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-line" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={skill.score}>
                <div className="skill-bar h-full rounded-full bg-accent" style={{ width: `${skill.score}%` }} />
              </div>
              <p className="text-sm leading-relaxed text-muted">{skill.explanation}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
