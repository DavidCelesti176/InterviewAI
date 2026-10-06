"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listInterviewHistory, restoreInterviewHistory, type InterviewHistoryItem } from "@/lib/interview/browser-state";

export function InterviewHistory() {
  const router = useRouter();
  const [items, setItems] = useState<InterviewHistoryItem[]>([]);

  useEffect(() => {
    setItems(listInterviewHistory());
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Your interviews</h2>
        <p className="mt-1 text-sm text-muted">Saved in this browser, so you can open a finished interview again.</p>
      </div>
      <div className="grid gap-3">
        {items.map((item) => (
          <Card key={item.interviewId} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">{item.company}</p>
              <p className="text-sm text-muted">
                {item.jobTitle} · {formatWhen(item.savedAt)} · {formatDuration(item.elapsedMs)}
              </p>
              <p className="mt-1 text-sm text-muted">{item.analyzed ? "Review saved" : "Transcript saved"}</p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                if (!restoreInterviewHistory(item.interviewId)) return;
                router.push("/interview/results");
              }}
            >
              Open
            </Button>
          </Card>
        ))}
      </div>
    </section>
  );
}

function formatWhen(savedAt: number): string {
  return new Date(savedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
