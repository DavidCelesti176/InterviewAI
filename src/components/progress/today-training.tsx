import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ProgressView } from "@/lib/progress/types";

export function TodayTraining({ progress }: { progress: ProgressView }) {
  const { daily } = progress;
  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-accent">Today’s training</p>
        <h2 className="text-xl font-semibold tracking-tight">{daily.primary.title}</h2>
        <p className="max-w-xl text-sm text-muted">{daily.primary.detail}</p>
        {daily.completed ? <p className="text-sm text-muted">You practiced today. Another rep is optional.</p> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <ButtonLink href={daily.primary.href}>{daily.completed ? "Practice again" : "Start"}</ButtonLink>
        {daily.options.map((option) => (
          <ButtonLink key={option.id} href={option.href} variant="secondary">
            {option.title}
          </ButtonLink>
        ))}
      </div>
    </Card>
  );
}
