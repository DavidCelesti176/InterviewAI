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
      skin: ["#f6d3be", "#e7b496", "#c98b6e"],
      hair: ["#6a432c", "#3a2418"],
      hairStyle: "long",
      iris: "#6a5038",
      lip: "#c56d64",
      blazer: ["#3e4f6b", "#243044"],
      lapel: ["#6d82a0", "#31445e"],
      shirt: "#f7f3ec",
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
      skin: ["#f0c9a6", "#d7a57e", "#b07d58"],
      hair: ["#3d2a22", "#1c1410"],
      hairStyle: "short",
      iris: "#3d2c22",
      lip: "#b06a5c",
      blazer: ["#3a424c", "#1e242c"],
      lapel: ["#686d76", "#333840"],
      shirt: "#f7f5f2",
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
