import { getInterview as readOwnedInterview, saveInterview as writeOwnedInterview } from "@/lib/firebase/data";
import type { PracticeFocus } from "@/lib/interview/practice-types";
import type { InterviewBlueprint, InterviewConfig, PreparationDebug } from "@/lib/interview/types";

export type StoredInterview = {
  id: string;
  createdAt: number;
  resumeFileName: string;
  config: InterviewConfig;
  blueprint: InterviewBlueprint;
  debug: PreparationDebug;
  practice?: PracticeFocus;
};

export async function saveInterview(
  uid: string,
  interview: StoredInterview,
  extra?: {
    status?: "draft" | "preparing" | "ready" | "in_progress" | "analyzing" | "complete" | "failed";
    resumeId?: string | null;
    durationChoice?: string;
    levelLabel?: string;
    emphasisLabel?: string;
    interviewerProfileId?: string;
  },
): Promise<void> {
  await writeOwnedInterview(uid, interview, extra);
}

export async function getInterview(uid: string, id: string): Promise<StoredInterview | null> {
  return readOwnedInterview(uid, id);
}
