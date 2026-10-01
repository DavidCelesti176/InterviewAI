export function StatusRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ready" | "waiting" | "blocked" | "neutral";
}) {
  const dot = {
    ready: "bg-success",
    waiting: "bg-warning",
    blocked: "bg-danger",
    neutral: "bg-muted",
  }[tone];

  return (
    <div className="flex items-center justify-between gap-4 rounded-[14px] border border-line bg-white px-4 py-3">
      <span className="text-sm font-medium">{label}</span>
      <span className="flex items-center gap-2 text-sm text-muted">
        <span className={`size-2 rounded-full ${dot}`} aria-hidden="true" />
        {value}
      </span>
    </div>
  );
}
