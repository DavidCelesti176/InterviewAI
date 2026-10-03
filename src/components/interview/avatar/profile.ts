import type { InterviewType } from "@/lib/interview/types";
import type { InterviewerProfile } from "@/components/interview/avatar/types";

/**
 * Visual identities only. Interview behavior still comes from the blueprint.
 * Swap a character by replacing files under public/interviewers/{id}/.
 * Optional eye and mouth layers are used automatically when their paths are set.
 */
export const interviewerProfiles: InterviewerProfile[] = [
  {
    id: "jordan",
    name: "Jordan",
    title: "AI Interviewer",
    styleLabel: "Balanced",
    shortDescription: "Professional, calm, and conversational.",
    visualPersonality: "balanced",
    avatar: { base: "/interviewers/jordan/base.jpg" },
  },
  {
    id: "maya",
    name: "Maya",
    title: "AI Interviewer",
    styleLabel: "Warm",
    shortDescription: "Approachable and conversational while still professional.",
    visualPersonality: "warm",
    avatar: { base: "/interviewers/maya/base.jpg" },
  },
  {
    id: "marcus",
    name: "Marcus",
    title: "AI Interviewer",
    styleLabel: "Direct",
    shortDescription: "More reserved visual presence with a focused style.",
    visualPersonality: "direct",
    avatar: { base: "/interviewers/marcus/base.jpg" },
  },
  {
    id: "claire",
    name: "Claire",
    title: "AI Interviewer",
    styleLabel: "Executive",
    shortDescription: "Polished, composed, executive-style presence.",
    visualPersonality: "executive",
    avatar: { base: "/interviewers/claire/base.jpg" },
  },
];

export const defaultInterviewer = interviewerProfiles[0];

export function interviewerById(id?: string | null): InterviewerProfile {
  return interviewerProfiles.find((profile) => profile.id === id) ?? defaultInterviewer;
}

export function interviewerRoleLabel(type: InterviewType): string {
  if (type === "hiring-manager") return "AI Hiring Manager Interviewer";
  if (type === "behavioral") return "AI Behavioral Interviewer";
  if (type === "recruiter") return "AI Recruiter Interviewer";
  if (type === "role-specific") return "AI Role Interviewer";
  return "AI Interviewer";
}
