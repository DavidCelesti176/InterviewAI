import type { AnswerFramework } from "@/lib/interview/star";
import type { InterviewType } from "@/lib/interview/types";
import { candidateQuestionsNotBeforeMinutes } from "@/lib/interview/interview-phase";

export type StyleDepth = "light" | "medium" | "deep";

export type InterviewStyleProfile = {
  type: InterviewType;
  motivationDepth: StyleDepth;
  behavioralDepth: StyleDepth;
  roleSpecificDepth: StyleDepth;
  resumeDepth: StyleDepth;
  followUpDepth: StyleDepth;
};

const depths: StyleDepth[] = ["light", "medium", "deep"];

const baseProfiles: Record<InterviewType, InterviewStyleProfile> = {
  recruiter: {
    type: "recruiter",
    motivationDepth: "deep",
    behavioralDepth: "light",
    roleSpecificDepth: "light",
    resumeDepth: "light",
    followUpDepth: "light",
  },
  behavioral: {
    type: "behavioral",
    motivationDepth: "light",
    behavioralDepth: "deep",
    roleSpecificDepth: "light",
    resumeDepth: "light",
    followUpDepth: "medium",
  },
  "hiring-manager": {
    type: "hiring-manager",
    motivationDepth: "medium",
    behavioralDepth: "medium",
    roleSpecificDepth: "medium",
    resumeDepth: "deep",
    followUpDepth: "deep",
  },
  "role-specific": {
    type: "role-specific",
    motivationDepth: "light",
    behavioralDepth: "medium",
    roleSpecificDepth: "deep",
    resumeDepth: "medium",
    followUpDepth: "medium",
  },
  mixed: {
    type: "mixed",
    motivationDepth: "medium",
    behavioralDepth: "medium",
    roleSpecificDepth: "medium",
    resumeDepth: "medium",
    followUpDepth: "medium",
  },
};

const labels: Record<InterviewType, string> = {
  recruiter: "Recruiter Screen",
  behavioral: "Behavioral",
  "hiring-manager": "Hiring Manager",
  "role-specific": "Role-Specific",
  mixed: "Mixed Interview",
};

const starCompetencies = new Set([
  "conflict",
  "teamwork",
  "initiative",
  "leadership",
  "failure",
  "adaptability",
  "ownership",
  "stress_management",
  "customer_service",
  "persuasion",
]);

const reasoningCompetencies = new Set([
  "problem_solving",
  "judgment",
  "data_analysis",
  "process_improvement",
  "commercial_thinking",
  "prioritization",
  "attention_to_detail",
]);

export function styleProfile(type: InterviewType): InterviewStyleProfile {
  return { ...baseProfiles[type] };
}

export function applyCompanyStyle(
  profile: InterviewStyleProfile,
  company: { confidence: string; behavioralEmphasis: string; technicalEmphasis: string },
): InterviewStyleProfile {
  if (company.confidence === "low") return profile;
  const next = { ...profile };
  if (company.behavioralEmphasis === "high") next.behavioralDepth = raise(profile.behavioralDepth, profile.type);
  if (company.technicalEmphasis === "high" || company.technicalEmphasis === "role_dependent") {
    next.roleSpecificDepth = raise(profile.roleSpecificDepth, profile.type);
  }
  return next;
}

export function mainTopicGuidance(minutes: number): { min: number; max: number; text: string } {
  if (minutes <= 12) return { min: 3, max: 3, text: "about 3" };
  if (minutes <= 24) return { min: 4, max: 6, text: "about 4 to 6" };
  return { min: 5, max: 8, text: "about 5 to 8" };
}

export function closingReserveMinutes(minutes: number): number {
  return Math.max(2, minutes - candidateQuestionsNotBeforeMinutes(minutes));
}

export function frameworkForCompetency(id: string, type: InterviewType): AnswerFramework {
  if (id === "motivation") return "motivation";
  if (type === "behavioral") return "star";
  if (type === "recruiter") return starCompetencies.has(id) ? "star" : "direct";
  if (reasoningCompetencies.has(id) && (type === "role-specific" || type === "hiring-manager" || type === "mixed")) {
    return "structured_reasoning";
  }
  if (starCompetencies.has(id)) return "star";
  if (id === "communication") return "direct";
  return type === "role-specific" ? "structured_reasoning" : "direct";
}

export function openingFor(type: InterviewType, earlyCareer: boolean): string {
  const ceiling = earlyCareer
    ? " Interview type does not raise the experience ceiling. Ask about work, school, projects, or a small business at the scale they have actually had."
    : "";
  switch (type) {
    case "recruiter":
      return `Open in a friendly, low-pressure way. Ask them to tell you about themselves or walk through their background. Then ask why this role and why this company or program. Do not open with a behavioral competency question or a role-specific scenario.${ceiling}`;
    case "behavioral":
      return `Open briefly with a short background question, then move into past-experience questions. Do not open with a cold scenario.${ceiling}`;
    case "hiring-manager":
      return `Open with a brief, useful background question, then go into an experience they have actually had. Do not open with a cold case.${ceiling}`;
    case "role-specific":
      return `Ask one natural setup or background question before any scenario about the job. Do not cold-open with a difficult scenario.${ceiling}`;
    default:
      return `Open with a natural tell-me-about-yourself question.${ceiling}`;
  }
}

export function styleInstructions(
  type: InterviewType,
  minutes: number,
  company: { confidence: string; behavioralEmphasis: string; technicalEmphasis: string } = {
    confidence: "low",
    behavioralEmphasis: "unknown",
    technicalEmphasis: "unknown",
  },
  earlyCareer = false,
): string {
  const profile = applyCompanyStyle(styleProfile(type), company);
  const topics = mainTopicGuidance(minutes);
  const notBefore = candidateQuestionsNotBeforeMinutes(minutes);
  const name = labels[type];
  return `${structureFor(profile)}
Follow-up depth is ${profile.followUpDepth}. ${followUpLine(profile.followUpDepth)}
Resume probing is ${profile.resumeDepth}. ${resumeLine(profile.resumeDepth)}
Motivation emphasis is ${profile.motivationDepth}. Role-specific depth is ${profile.roleSpecificDepth}. Behavioral depth is ${profile.behavioralDepth}.
This is a ${minutes}-minute ${name}. Extra time stays inside this structure. It does not turn the interview into a different type.
Aim for ${topics.text} main topics. Do not exceed about ${topics.max}. These are guidelines, not a quota.
Leave about ${closingReserveMinutes(minutes)} minutes for their questions and a short close. Do not invite their questions before about ${notBefore} minutes, and do not keep asking main questions until the clock runs out.
${earlyCareer ? "Interview type does not raise the experience ceiling." : "Harder questions still stay inside the experience ceiling."}
Company style may nudge emphasis. It does not replace the selected ${name}.`;
}

export function continueTypeLine(type: InterviewType): string {
  switch (type) {
    case "recruiter":
      return "This is still a Recruiter Screen. Stay on background, motivation, and fit. Do not switch into a difficult behavioral competency question or a role scenario.";
    case "behavioral":
      return "This is still a Behavioral interview. The next main question should ask for a past example, with a normal transition. Do not turn it into rapid-fire questions.";
    case "hiring-manager":
      return "This is still a Hiring Manager interview. You may go deeper on one interesting experience, then move. Do not interrogate the same topic.";
    case "role-specific":
      return "This is still a Role-Specific interview. After the setup question, ask about the work this job requires. Do not cold-start a scenario if you have not asked a setup question yet.";
    default:
      return "This is still a Mixed Interview. Keep a balance of motivation, a past example, and the work itself.";
  }
}

function raise(depth: StyleDepth, type: InterviewType): StyleDepth {
  const next = depths[Math.min(depths.length - 1, depths.indexOf(depth) + 1)] ?? depth;
  if (type === "recruiter" && next === "deep") return "medium";
  return next;
}

function structureFor(profile: InterviewStyleProfile): string {
  switch (profile.type) {
    case "recruiter":
      return `Recruiter Screen structure: opening background, then motivation for the role and company, then fit and what they are looking for. At most one or two light past examples, and only after motivation, if time allows. High-priority competencies may inform a question. They do not replace this order. Keep it friendly, broad, and less technical.`;
    case "behavioral":
      return `Behavioral structure: a brief opening, then past-experience questions about conflict, teamwork, initiative, prioritization, problem solving, failure, leadership, adaptability, judgment, or ownership, chosen from what this role needs. Most of those questions use a past example: a specific situation, what they personally did, and what changed. Do not force that shape onto a motivation question. Allow a transition between stories. End with their questions.`;
    case "hiring-manager":
      return `Hiring Manager structure: brief background, then a deeper look at an interesting experience, the decision or tradeoff, what they personally contributed, and the result. Then one behavioral competency, one role-relevant situation, and motivation for this team. This may go deeper than a screen. It still uses the follow-up cap and does not stay on one topic.`;
    case "role-specific":
      return `Role-Specific structure: one setup or background question, then relevant experience, then the skills and realistic situations in the job, then judgment or problem solving, then one job-specific past example. Adapt the situations to the actual role. Do not assume years of professional authority.`;
    default:
      return `Mixed Interview structure: opening story, motivation, one past-experience question, one role-specific question, then judgment or adaptability, then their questions. Balance the areas. Do not maximize only one of them.`;
  }
}

function followUpLine(depth: StyleDepth): string {
  if (depth === "light") return "Most answers get no follow-up. One short follow-up only when the answer is too vague to judge.";
  if (depth === "deep") {
    return "You may explore one interesting answer further than a screen would. Most answers still get zero or one follow-up. A second only when the first is still vague and the topic matters. Do not interrogate one topic.";
  }
  return "Most answers get zero or one follow-up. A second only when the answer is still vague and the topic matters.";
}

function resumeLine(depth: StyleDepth): string {
  if (depth === "deep") return "You may go into one interesting resume experience: the decision, their own contribution, and the result.";
  if (depth === "medium") return "After the setup question, you may ask about one relevant resume item.";
  return "Use the resume only to clarify relevant experience. Do not walk it job by job.";
}
