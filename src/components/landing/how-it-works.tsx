const steps = [
  {
    number: "01",
    title: "Give us the role",
    body: "Paste the job and upload your resume. InterviewAI understands what the company is looking for and what experience you actually have.",
    icon: RoleMark,
  },
  {
    number: "02",
    title: "Interview out loud",
    body: "Have a real conversation. Your interviewer listens, remembers what you said, asks follow-ups, and adapts as you answer.",
    icon: VoiceMark,
  },
  {
    number: "03",
    title: "Know what to fix",
    body: "Finish with clear coaching. See your strongest answers, missed opportunities, readiness score, and what to practice next.",
    icon: ScoreMark,
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-6 border-y border-line bg-white" aria-labelledby="how-title">
      <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="text-sm font-medium tracking-[0.16em] text-accent uppercase">How it works</p>
        <h2 id="how-title" className="mt-3 max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Three steps. Then you’re in the room.
        </h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {steps.map((step) => (
            <li key={step.number} className="flex flex-col rounded-[22px] border border-line bg-card p-5 shadow-[var(--shadow-card)]">
              <div className="flex items-center justify-between">
                <step.icon />
                <p className="font-mono text-sm text-accent">{step.number}</p>
              </div>
              <h3 className="mt-5 text-xl font-semibold tracking-tight">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function RoleMark() {
  return (
    <svg className="size-11 text-accent" viewBox="0 0 44 44" fill="none" aria-hidden="true">
      <rect x="8" y="6" width="22" height="28" rx="4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M14 15h10M14 21h10M14 27h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="31" cy="29" r="7" fill="#f4f6f8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M31 26v3.2L33.2 31" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function VoiceMark() {
  return (
    <svg className="size-11 text-violet" viewBox="0 0 44 44" fill="none" aria-hidden="true">
      <path d="M22 10v16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M16 16a6 6 0 0 0 12 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M13 18a9 9 0 0 0 18 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M10 28c2.2 4 5.8 6 12 6s9.8-2 12-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M22 34v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ScoreMark() {
  return (
    <svg className="size-11 text-accent" viewBox="0 0 44 44" fill="none" aria-hidden="true">
      <circle cx="22" cy="22" r="12" stroke="#e2e6ec" strokeWidth="3" />
      <path d="M22 10a12 12 0 0 1 10.4 6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M17.5 22.5l3 3 6-6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
