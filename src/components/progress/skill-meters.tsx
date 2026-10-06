import { Card } from "@/components/ui/card";
import type { ProgressView } from "@/lib/progress/types";

export function SkillMeters({ progress }: { progress: ProgressView }) {
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">Skills</h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {progress.skills.map((skill) => (
          <li key={skill.id} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium">{skill.label}</p>
              <p className="text-sm tabular-nums text-muted">{skill.samples > 0 && skill.score !== null ? skill.score : "Not seen yet"}</p>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-line"
              role="meter"
              aria-label={skill.label}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={skill.score ?? 0}
            >
              <div className="skill-bar h-full rounded-full bg-accent" style={{ width: `${skill.samples > 0 && skill.score !== null ? skill.score : 0}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
