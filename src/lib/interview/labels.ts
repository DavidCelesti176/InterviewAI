import type { InterviewMode } from "@/lib/interview/help-types";
import type { DurationChoice, InterviewType } from "@/lib/interview/types";

export const interviewTypeOptions: Array<{ value: InterviewType; label: string; description: string }> = [
  {
    value: "mixed",
    label: "Mixed Interview",
    description: "A balanced conversation across motivation, experience, and the work itself.",
  },
  {
    value: "hiring-manager",
    label: "Hiring Manager",
    description: "Deeper questions about your experience, decisions, and impact.",
  },
  {
    value: "behavioral",
    label: "Behavioral",
    description: "Past examples, what you personally did, and what changed.",
  },
  {
    value: "recruiter",
    label: "Recruiter Screen",
    description: "Motivation, your story, and whether the role is a fit.",
  },
  {
    value: "role-specific",
    label: "Role-Specific",
    description: "The skills and situations this job actually asks for.",
  },
];

export const durationOptions: Array<{
  value: DurationChoice;
  label: string;
  detail: string;
  minutes: number;
  recommended?: boolean;
}> = [
  { value: "10", label: "10 minutes", detail: "Quick Practice", minutes: 10 },
  { value: "30", label: "30 minutes", detail: "Full mock interview", minutes: 30, recommended: true },
];

export function interviewModeLabel(mode: InterviewMode | undefined): string {
  return mode === "practice" ? "Practice Mode" : "Mock Interview";
}

export function interviewTypeLabel(type: InterviewType): string {
  return interviewTypeOptions.find((option) => option.value === type)?.label ?? type;
}

export function durationLabel(choice: DurationChoice): string {
  if (choice === "unsure") return "About 30 minutes";
  return durationOptions.find((option) => option.value === choice)?.label ?? `${choice} minutes`;
}

export function durationMinutes(choice: DurationChoice): number {
  return durationOptions.find((option) => option.value === choice)?.minutes ?? 30;
}
