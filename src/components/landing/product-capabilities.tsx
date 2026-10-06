const capabilities = [
  ["Resume-aware", "Questions grounded in your actual experience."],
  ["Role-aware", "Built around the job you’re applying for."],
  ["Adaptive", "Follow-up questions change based on your answer."],
  ["Voice-first", "Practice saying answers out loud, not just typing them."],
  ["Saved to your account", "Return to transcripts and feedback later."],
  ["Specific feedback", "Know which answers need work and why."],
];

export function ProductCapabilities() {
  return (
    <section id="capabilities" className="scroll-mt-6 border-t border-line bg-white" aria-labelledby="capabilities-title">
      <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        <h2 id="capabilities-title" className="max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Tied to your resume, the role, and the company.
        </h2>
        <ul className="mt-8 grid gap-px overflow-hidden rounded-[22px] border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {capabilities.map(([title, body]) => (
            <li key={title} className="bg-card px-5 py-5">
              <p className="font-semibold tracking-tight">{title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
