import { ButtonLink } from "@/components/ui/button";

const skills = [
  ["Communication", 86],
  ["Specificity", 74],
  ["Business impact", 78],
  ["Role alignment", 89],
] as const;

export function ResultsPreview({ practiceHref }: { practiceHref: string }) {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 sm:py-16" aria-labelledby="results-title">
      <div className="max-w-2xl">
        <p className="text-sm font-medium tracking-[0.16em] text-accent uppercase">After the interview</p>
        <h2 id="results-title" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Finish with more than a transcript.
        </h2>
        <p className="mt-3 text-base leading-relaxed text-muted">
          Know what worked, what held you back, and what to practice before the real interview.
        </p>
      </div>

      <div className="relative mt-8">
        <div
          className="pointer-events-none absolute inset-x-8 -top-6 h-40 bg-[radial-gradient(ellipse_at_center,rgba(47,107,255,0.12),transparent_70%)]"
          aria-hidden="true"
        />
        <article className="relative overflow-hidden rounded-[24px] border border-line bg-card shadow-[var(--shadow-card)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
            <p className="text-sm font-medium">Example results</p>
            <p className="text-xs tracking-wide text-muted uppercase">Sales Analyst practice</p>
          </div>
          <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[auto_1fr] lg:items-center">
            <div className="flex items-center gap-5">
              <div
                className="grid size-28 shrink-0 place-items-center rounded-full"
                style={{ background: "conic-gradient(var(--accent) 295.2deg, var(--line) 0deg)" }}
                aria-hidden="true"
              >
                <div className="grid size-[92px] place-items-center rounded-full bg-card">
                  <p className="text-3xl font-semibold tracking-tight">82</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-accent">Interview readiness</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight">Strong</p>
                <p className="mt-1 max-w-[14rem] text-sm text-muted">An example score from one practice interview.</p>
              </div>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2">
              {skills.map(([label, score]) => (
                <li key={label} className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-sm tabular-nums text-muted">{score}</p>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-line" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={score}>
                    <div className="skill-bar h-full rounded-full bg-accent" style={{ width: `${score}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid gap-px border-t border-line bg-line sm:grid-cols-2">
            <div className="bg-card px-5 py-5 sm:px-6">
              <p className="text-sm font-medium text-success">Strongest moment</p>
              <p className="mt-2 text-sm leading-relaxed">Your example showed clear ownership and problem solving.</p>
            </div>
            <div className="bg-card px-5 py-5 sm:px-6">
              <p className="text-sm font-medium text-warning">Biggest opportunity</p>
              <p className="mt-2 text-sm leading-relaxed">
                Your opening answer ran too long. Aim for 60–90 seconds and lead with the strongest theme.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 border-t border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-sm text-muted">Preview of the review screen. Not a claim about InterviewAI.</p>
            <ButtonLink href={practiceHref} variant="secondary">
              Practice weak answers
            </ButtonLink>
          </div>
        </article>
      </div>
    </section>
  );
}
