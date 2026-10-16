import type { InterviewType } from "@/lib/interview/types";
import type { InterviewerProfile } from "@/components/interview/avatar/types";

/**
 * Visual identities only. Interview behavior still comes from the blueprint.
 * Voices for these ids are chosen in the live session config.
 */
export const interviewerProfiles: InterviewerProfile[] = [
  {
    id: "claire",
    name: "Claire",
    title: "AI Interviewer",
    styleLabel: "Warm",
    shortDescription: "Friendly and conversational.",
    visualPersonality: "warm",
    look: {
      skin: ["#f4cbb4", "#e3ad90", "#c48468"],
      hair: ["#6d4630", "#342116"],
      hairStyle: "long",
      iris: "#6d5340",
      lip: "#c46a62",
      blazer: ["#4d6488", "#24344e"],
      lapel: ["#7d92b0", "#31445e"],
      shirt: "#f6f1e8",
      eyeScale: 1.04,
      smile: 0.42,
      jaw: "round",
      blush: 0.22,
    },
  },
  {
    id: "james",
    name: "James",
    title: "AI Interviewer",
    styleLabel: "Direct",
    shortDescription: "Calm and straightforward.",
    visualPersonality: "direct",
    look: {
      skin: ["#ebc4a4", "#d2a484", "#a87856"],
      hair: ["#3c322c", "#1a1613"],
      hairStyle: "short",
      iris: "#3a2a22",
      lip: "#a86a5c",
      blazer: ["#5c6572", "#2a313a"],
      lapel: ["#8a9098", "#3a424c"],
      shirt: "#f3efe8",
      eyeScale: 0.96,
      smile: 0.12,
      jaw: "defined",
      blush: 0.08,
    },
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
