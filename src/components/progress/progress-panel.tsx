"use client";

import { useEffect, useState } from "react";

import { Journey } from "@/components/progress/journey";
import { ProgressStrip } from "@/components/progress/progress-strip";
import { SkillMeters } from "@/components/progress/skill-meters";
import { TodayTraining } from "@/components/progress/today-training";
import { authorizedFetch } from "@/lib/account/client";
import type { ProgressView } from "@/lib/progress/types";

export function ProgressPanel() {
  const [progress, setProgress] = useState<ProgressView | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    void authorizedFetch(`/api/progress?timezone=${encodeURIComponent(timezone)}`)
      .then(async (response) => {
        if (!response.ok) return null;
        const body = (await response.json()) as { progress?: ProgressView };
        return body.progress ?? null;
      })
      .then((next) => {
        if (!cancelled) setProgress(next);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded) return <div className="h-28 rounded-[20px] border border-line bg-card" aria-hidden="true" />;
  if (!progress) return null;

  return (
    <div className="flex flex-col gap-3">
      <ProgressStrip progress={progress} />
      <div className="grid gap-3 lg:grid-cols-[1.3fr_0.7fr]">
        <TodayTraining progress={progress} />
        <Journey progress={progress} />
      </div>
      <SkillMeters progress={progress} />
    </div>
  );
}
