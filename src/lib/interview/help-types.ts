import type { InterviewMode, InterviewTurn } from "@/lib/interview/types";

export type { InterviewMode };

export type HelpKind = "rephrase" | "competency" | "structure" | "experiences";

export type AssistanceType = "pause" | "rephrase" | "competency" | "structure" | "experience_suggestions" | "repeat";

export interface InterviewPauseEvent {
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
}

export interface InterviewAssistanceEvent {
  timestampMs: number;
  question?: string;
  type: AssistanceType;
  durationMs?: number;
}

export interface InterviewHelpResponse {
  question: string;
  rephrasedQuestion?: string;
  competency?: {
    name: string;
    explanation: string;
    whatStrongAnswersShow: string[];
  };
  answerFramework?: {
    name: string;
    steps: Array<{
      label: string;
      guidance: string;
    }>;
  };
  suggestedExperiences?: Array<{
    title: string;
    source: "resume" | "interview";
    reason: string;
  }>;
  note?: string;
}

export function isInterviewMode(value: unknown): value is InterviewMode {
  return value === "practice" || value === "mock";
}

export function interviewModeOf(value: unknown): InterviewMode {
  return value === "practice" ? "practice" : "mock";
}

export function currentInterviewQuestion(turns: InterviewTurn[]): string {
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    if (turn?.speaker === "interviewer" && turn.text.trim()) return turn.text.trim();
  }
  return "";
}
