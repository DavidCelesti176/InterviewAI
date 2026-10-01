import type { InterviewType } from "@/lib/interview/types";
import type { InterviewerProfile } from "@/components/interview/avatar/types";

export const defaultInterviewer: InterviewerProfile = {
  id: "jordan-hale",
  name: "Jordan Hale",
  presentation: "neutral",
};

export function interviewerRoleLabel(type: InterviewType): string {
  if (type === "hiring-manager") return "AI Hiring Manager Interviewer";
  if (type === "behavioral") return "AI Behavioral Interviewer";
  if (type === "recruiter") return "AI Recruiter Interviewer";
  if (type === "role-specific") return "AI Role Interviewer";
  return "AI Interviewer";
}
