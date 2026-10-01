import { readinessTitle } from "@/lib/interview/analysis-rubric";
import type { InterviewAnalysis } from "@/lib/interview/analysis-types";

export function ReadinessCard({ analysis }: { analysis: InterviewAnalysis }) {
  const strong = analysis.overallReadiness >= 80;
  return (
    <section
      className={`flex flex-col gap-6 rounded-[24px] border border-line bg-card p-6 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:p-8 ${
        strong ? "shadow-[0_16px_40px_rgba(18,21,28,0.06),0_18px_50px_rgba(47,107,255,0.16)]" : ""
      }`}
    >
      <div
        className="grid size-32 shrink-0 place-items-center rounded-full"
        style={{ background: `conic-gradient(var(--accent) ${analysis.overallReadiness * 3.6}deg, var(--line) 0deg)` }}
        aria-hidden="true"
      >
        <div className="grid size-[104px] place-items-center rounded-full bg-card">
          <p className="text-4xl font-semibold tracking-tight">{analysis.overallReadiness}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-accent">Interview readiness</p>
        <h2 className="text-3xl font-semibold tracking-tight">{readinessTitle(analysis.overallLabel)}</h2>
        <p className="max-w-2xl text-lg leading-relaxed">{analysis.summary}</p>
        <p className="text-sm text-muted">A coaching score for this practice interview.</p>
      </div>
    </section>
  );
}
