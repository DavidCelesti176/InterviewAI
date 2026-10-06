const sources = [
  {
    kicker: "Your resume",
    items: ["Reporting tools", "A software product", "A service business"],
  },
  {
    kicker: "The job",
    items: ["Sales Analyst", "Excel", "Reporting", "Commercial analysis"],
  },
  {
    kicker: "The company",
    items: ["Revenue operations", "Account reviews", "Weekly reporting"],
  },
];

export function PersonalizationFlow() {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 sm:py-16" aria-labelledby="personalization-title">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <h2 id="personalization-title" className="max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Not a list of generic interview questions.
        </h2>
        <p className="max-w-sm text-base leading-relaxed text-muted">
          InterviewAI understands what the company wants and what you’ve actually done.
        </p>
      </div>

      <div className="mt-8 grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-stretch">
        {sources.map((source, index) => (
          <div key={source.kicker} className="contents">
            <article className="rounded-[20px] border border-line bg-card px-5 py-4 shadow-[var(--shadow-card)]">
              <p className="text-xs font-medium tracking-[0.16em] text-accent uppercase">{source.kicker}</p>
              <ul className="mt-3 flex flex-col gap-1">
                {source.items.map((item) => (
                  <li key={item} className="text-[15px] font-medium tracking-tight">
                    {item}
                  </li>
                ))}
              </ul>
            </article>
            {index < sources.length - 1 ? <Plus /> : null}
          </div>
        ))}
      </div>

      <div className="my-3 flex items-center justify-center gap-3 text-muted" aria-hidden="true">
        <span className="h-px w-10 bg-line sm:w-16" />
        <svg className="size-8 text-accent" viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="15" stroke="currentColor" strokeOpacity="0.35" />
          <path d="M16 9v12M11 16l5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="h-px w-10 bg-line sm:w-16" />
      </div>

      <div className="overflow-hidden rounded-[24px] bg-room text-white shadow-[0_20px_50px_rgba(12,18,32,0.18)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-6">
          <p className="text-sm font-medium">Your interview</p>
          <p className="text-xs tracking-wide text-white/60 uppercase">Sales Analyst</p>
        </div>
        <div className="grid gap-5 px-5 py-5 sm:px-6 sm:py-6">
          <div>
            <p className="text-xs font-medium tracking-[0.16em] text-[#b7c8ff] uppercase">Opening question</p>
            <p className="mt-2 max-w-3xl text-lg leading-snug font-medium sm:text-xl">
              Tell me about a time you turned data into a recommendation someone could actually use.
            </p>
          </div>
          <div className="border-t border-white/10 pt-5">
            <p className="text-xs font-medium tracking-[0.16em] text-[#b7c8ff] uppercase">Follow-up, after you answer</p>
            <p className="mt-2 max-w-3xl text-base leading-relaxed text-white/80">
              You mentioned your pricing work. How did someone use that analysis?
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Plus() {
  return (
    <span className="grid place-items-center text-sm font-medium text-muted lg:px-1" aria-hidden="true">
      <span className="lg:hidden">+</span>
      <span className="hidden text-lg lg:inline">+</span>
    </span>
  );
}
