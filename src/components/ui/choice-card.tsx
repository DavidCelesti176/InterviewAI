import type { ReactNode } from "react";

export function ChoiceCard({
  selected,
  title,
  description,
  icon,
  badge,
  onSelect,
}: {
  selected: boolean;
  title: string;
  description: string;
  icon: ReactNode;
  badge?: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`flex h-full flex-col gap-3 rounded-[20px] border p-4 text-left transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        selected
          ? "border-accent bg-accent/5 shadow-[0_10px_30px_rgba(47,107,255,0.12)]"
          : "border-line bg-card hover:border-accent/30 hover:shadow-[var(--shadow-card)]"
      }`}
    >
      <span className="flex items-center justify-between gap-3">
        <span
          className={`flex size-9 items-center justify-center rounded-xl ${selected ? "bg-accent text-white" : "bg-background text-accent"}`}
          aria-hidden="true"
        >
          {icon}
        </span>
        {badge ? (
          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">{badge}</span>
        ) : null}
      </span>
      <span className="text-base font-medium">{title}</span>
      <span className="text-sm leading-5 text-muted">{description}</span>
    </button>
  );
}
