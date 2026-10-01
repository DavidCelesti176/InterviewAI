"use client";

import { Button } from "@/components/ui/button";
import type { InterviewMode } from "@/lib/interview/help-types";

export function PauseOverlay({
  interviewMode,
  onResume,
  onHelp,
  onEnd,
}: {
  interviewMode: InterviewMode;
  onResume: () => void;
  onHelp?: () => void;
  onEnd: () => void;
}) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0c1220]/80 px-5 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#121826] p-8 text-center shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="pause-title">
        <p className="text-sm text-white/50">{interviewMode === "practice" ? "Practice Mode" : "Mock Interview"}</p>
        <h2 id="pause-title" className="mt-2 text-3xl font-semibold tracking-tight">
          Interview paused
        </h2>
        <p className="mt-3 text-white/70">Take a moment. Resume whenever you&apos;re ready.</p>
        {interviewMode === "mock" ? (
          <p className="mt-3 text-sm text-white/50">Pausing means this session is no longer a fully unassisted mock.</p>
        ) : null}
        <div className="mt-6 flex flex-col gap-3">
          <Button type="button" onClick={onResume}>
            Resume interview
          </Button>
          {onHelp ? (
            <Button type="button" variant="room" onClick={onHelp}>
              Need a hand?
            </Button>
          ) : null}
          <Button type="button" variant="room" onClick={onEnd}>
            End interview
          </Button>
        </div>
      </div>
    </div>
  );
}
