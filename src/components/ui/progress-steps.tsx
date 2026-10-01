const labels = ["Role", "Background", "Interview", "Review"] as const;

export function ProgressSteps({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Interview setup progress">
      {labels.map((label, index) => {
        const state = index < current ? "done" : index === current ? "current" : "upcoming";
        return (
          <li key={label} className="flex min-w-0 flex-1 items-center gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                  state === "upcoming" ? "bg-white text-muted ring-1 ring-line" : "bg-accent text-white"
                }`}
                aria-hidden="true"
              >
                {state === "done" ? "✓" : index + 1}
              </span>
              <span className={`truncate text-sm ${state === "current" ? "font-medium text-foreground" : "text-muted"}`}>
                <span className="sr-only">{state === "current" ? "Current step: " : state === "done" ? "Completed step: " : "Upcoming step: "}</span>
                {label}
              </span>
            </span>
            {index < labels.length - 1 ? <span className={`h-px flex-1 ${index < current ? "bg-accent" : "bg-line"}`} /> : null}
          </li>
        );
      })}
    </ol>
  );
}
