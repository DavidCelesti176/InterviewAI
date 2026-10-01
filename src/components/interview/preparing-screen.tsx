export type PrepareStepState = {
  id: string;
  label: string;
  state: "pending" | "active" | "done";
};

const details: Record<string, string> = {
  analyzing_resume: "Reading the experience you actually have.",
  understanding_role: "Separating the title from the level this role is hiring.",
  calibrating_difficulty: "Setting a challenge that fits that experience.",
  researching_company: "Checking public sources for how they interview.",
  building_plan: "Shaping the questions, pace, and follow-ups.",
};

export function PreparingScreen({
  company,
  jobTitle,
  steps,
}: {
  company: string;
  jobTitle: string;
  steps: PrepareStepState[];
}) {
  const done = steps.filter((step) => step.state === "done").length;
  const total = Math.max(steps.length, 1);
  const active = steps.find((step) => step.state === "active");
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - done / total);
  const place = [company.trim(), jobTitle.trim()].filter(Boolean).join(" · ");

  return (
    <div className="fixed inset-0 z-50 overflow-x-hidden overflow-y-auto bg-room text-room-ink">
      <div className="prep-glow pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(5,8,16,0.72)_100%)]" aria-hidden="true" />
      <div className="relative flex min-h-full flex-col">
        <div className="m-auto w-full max-w-lg px-6 py-10">
        <p className="text-xs font-medium tracking-[0.22em] text-white/45 uppercase">InterviewAI</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">Getting your interview ready</h1>
        {place ? <p className="mt-4 w-fit rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm text-white/75">{place}</p> : null}

        <div className="mt-8 flex items-center gap-5">
          <div className="relative grid size-28 place-items-center">
            <svg viewBox="0 0 120 120" className="size-28 -rotate-90" aria-hidden="true">
              <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="7" />
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke="url(#prep-arc)"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                className="prep-ring"
              />
              <defs>
                <linearGradient id="prep-arc" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#7aa2ff" />
                  <stop offset="100%" stopColor="#8b7cff" />
                </linearGradient>
              </defs>
            </svg>
            {active ? <span className="prep-spin absolute inset-1.5 rounded-full" aria-hidden="true" /> : null}
            <p className="absolute text-lg font-semibold tabular-nums">
              {done}
              <span className="text-sm font-medium text-white/40">/{steps.length}</span>
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-sm text-white/45">{active ? "Working on" : done === steps.length ? "Ready" : "Starting"}</p>
            <p className="mt-1 text-lg font-medium leading-snug">{active?.label ?? "Getting started"}</p>
          </div>
        </div>

        <ol className="mt-8 flex flex-col" aria-live="polite">
          {steps.map((step, index) => {
            const last = index === steps.length - 1;
            const current = step.state === "active";
            return (
              <li key={step.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium transition duration-300 ${
                      step.state === "pending"
                        ? "bg-white/10 text-white/35"
                        : current
                          ? "prep-live bg-accent text-white"
                          : "bg-white text-room"
                    }`}
                    aria-hidden="true"
                  >
                    {step.state === "done" ? "✓" : index + 1}
                  </span>
                  {last ? null : (
                    <span className={`my-1 w-px flex-1 transition-colors duration-300 ${step.state === "done" ? "bg-white/50" : "bg-white/15"}`} />
                  )}
                </div>
                <div className={`min-w-0 flex-1 ${last ? "" : "pb-3"}`}>
                  <div className={`rounded-2xl px-3 py-2 transition duration-300 ${current ? "bg-white/10 ring-1 ring-white/15" : ""}`}>
                    <p className={step.state === "pending" ? "text-white/40" : "font-medium text-white"}>{step.label}</p>
                    {current ? (
                      <div key={step.id} className="step-enter">
                        <p className="mt-1 text-sm leading-relaxed text-white/60">{details[step.id] ?? "Working through this step."}</p>
                        <div className="prep-indeterminate mt-3" aria-hidden="true" />
                      </div>
                    ) : null}
                    <p className="sr-only">{step.state === "done" ? "Done" : current ? "In progress" : "Waiting"}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        </div>
      </div>
    </div>
  );
}
