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
  { value: "15", label: "15 minutes", detail: "Quick practice", minutes: 15 },
  { value: "30", label: "30 minutes", detail: "Standard interview", minutes: 30, recommended: true },
  { value: "45", label: "45 minutes", detail: "Deep practice", minutes: 45 },
  { value: "unsure", label: "I'm not sure", detail: "We'll aim for about 30 minutes", minutes: 30 },
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
