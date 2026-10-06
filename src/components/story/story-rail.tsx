const marks = [
  { id: "who", label: "Who" },
  { id: "proof", label: "Proof" },
  { id: "next", label: "Next" },
] as const;

export function StoryRail({ step }: { step: number }) {
  return (
    <ol className="grid grid-cols-3 gap-3" aria-label="Story progress">
      {marks.map((mark, index) => {
        const done = index < step;
        const current = index === step;
        return (
          <li key={mark.id} className="flex flex-col gap-2">
            <span className="h-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
              <span
                className={`block h-full rounded-full bg-gradient-to-r from-accent to-violet transition-all duration-500 ${
                  done || current ? "w-full" : "w-0"
                } ${current ? "opacity-80" : "opacity-100"}`}
              />
            </span>
            <span className={`text-sm ${current ? "font-medium text-foreground" : done ? "text-foreground" : "text-muted"}`}>
              <span className="sr-only">{done ? "Completed: " : current ? "Current: " : "Upcoming: "}</span>
              {mark.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function railStep(stage: string): number {
  if (stage === "evidence") return 1;
  if (stage === "direction" || stage === "answer") return 2;
  if (stage === "saved") return 3;
  return 0;
}
