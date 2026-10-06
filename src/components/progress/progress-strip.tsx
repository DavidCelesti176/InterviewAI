import type { ProgressView } from "@/lib/progress/types";

export function ProgressStrip({ progress }: { progress: ProgressView }) {
  const streak = progress.streakCount > 0 ? `${progress.streakCount} day${progress.streakCount === 1 ? "" : "s"}` : "Not started";
  return (
    <section className="grid gap-3 sm:grid-cols-4" aria-label="Your progress">
      <Stat label="Streak" value={streak} />
      <Stat label="Level" value={`${progress.level} · ${progress.levelTitle}`} />
      <Stat label="XP" value={progress.xp.toLocaleString()} />
      <Stat
        label="Interview readiness"
        value={progress.readiness === null ? "After your first interview" : `${progress.readiness}%`}
        detail={progress.readinessLabel ?? undefined}
      />
    </section>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-[20px] border border-line bg-card px-4 py-4 shadow-[var(--shadow-card)]">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-tight">{value}</p>
      {detail ? <p className="text-sm text-muted">{detail}</p> : null}
    </div>
  );
}
