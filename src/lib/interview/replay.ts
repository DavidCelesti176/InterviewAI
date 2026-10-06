import type { StoredInterview } from "@/lib/interview/store";

const replayable = new Set(["complete", "in_progress", "failed", "analyzing"]);

export function canReplayStatus(status: string): boolean {
  return replayable.has(status);
}

export function clonedInterview(source: StoredInterview, id: string, now: number): StoredInterview {
  return {
    id,
    createdAt: now,
    resumeFileName: source.resumeFileName,
    config: source.config,
    blueprint: source.blueprint,
    debug: source.debug,
    ...(source.practice ? { practice: source.practice } : {}),
    ...(source.storyContext ? { storyContext: source.storyContext } : {}),
  };
}

export function replayQuestionLines(source: StoredInterview): string[] {
  return (source.practice?.questions ?? []).map((item) => item.question.trim()).filter(Boolean);
}
