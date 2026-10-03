import type { InterviewType } from "@/lib/interview/types";
import type { InterviewerProfile } from "@/components/interview/avatar/types";

/**
 * Visual identities only. Interview behavior still comes from the blueprint.
 * Replace a character by editing its look, not the voice session.
 */
export const interviewerProfiles: InterviewerProfile[] = [
  {
    id: "jordan",
    name: "Jordan",
    title: "AI Interviewer",
    styleLabel: "Balanced",
    shortDescription: "Professional, calm, and conversational.",
    visualPersonality: "balanced",
    look: {
      skin: ["#f4d0b6", "#e0ad88", "#c48968"],
      hair: ["#4a403a", "#241e1b"],
      hairStyle: "medium",
      iris: "#5b4536",
      lip: "#c56b62",
      blazer: ["#4d6282", "#2a3b52"],
      lapel: ["#6d82a0", "#31445e"],
      shirt: "#f6f1e8",
      eyeScale: 1,
      smile: 0.35,
      jaw: "round",
      blush: 0.2,
    },
  },
  {
    id: "maya",
    name: "Maya",
    title: "AI Interviewer",
    styleLabel: "Warm",
    shortDescription: "Friendly and approachable.",
    visualPersonality: "warm",
    look: {
      skin: ["#c98a64", "#a86b48", "#7d4e34"],
      hair: ["#3a2c26", "#1a1412"],
      hairStyle: "waves",
      iris: "#3e2b24",
      lip: "#a85a50",
      blazer: ["#5c4a56", "#322830"],
      lapel: ["#7a6572", "#3d3038"],
      shirt: "#f3e6dc",
      eyeScale: 1.08,
      smile: 0.72,
      jaw: "round",
      blush: 0.28,
    },
  },
  {
    id: "marcus",
    name: "Marcus",
    title: "AI Interviewer",
    styleLabel: "Focused",
    shortDescription: "Calm and direct.",
    visualPersonality: "direct",
    look: {
      skin: ["#8f5c3e", "#70462e", "#4e301f"],
      hair: ["#2c221c", "#14110f"],
      hairStyle: "crop",
      iris: "#2a1e18",
      lip: "#8d4c44",
      blazer: ["#4a4e56", "#262a30"],
      lapel: ["#686d76", "#333840"],
      shirt: "#f7f5f2",
      eyeScale: 0.94,
      smile: 0.05,
      jaw: "defined",
      blush: 0.1,
      beard: true,
    },
  },
  {
    id: "claire",
    name: "Claire",
    title: "AI Interviewer",
    styleLabel: "Polished",
    shortDescription: "Confident and composed.",
    visualPersonality: "executive",
    look: {
      skin: ["#f6d5c4", "#e6b59c", "#cc947c"],
      hair: ["#c4b8ae", "#8f857c"],
      hairStyle: "bob",
      iris: "#6d5640",
      lip: "#c47c72",
      blazer: ["#3a4048", "#1a1e24"],
      lapel: ["#5c646e", "#2a3038"],
      shirt: "#f4ecdf",
      eyeScale: 1,
      smile: 0.22,
      jaw: "round",
      blush: 0.14,
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
