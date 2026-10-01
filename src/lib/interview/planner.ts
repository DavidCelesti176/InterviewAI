import OpenAI from "openai";

import { planModel } from "@/lib/live/config";
import type { InterviewConfig, InterviewPlan, InterviewType } from "@/lib/interview/types";

const priorities = ["high", "medium", "low"] as const;

const interviewPlanSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    roleSummary: { type: "string" },
    priorityCompetencies: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          reason: { type: "string" },
          priority: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["name", "reason", "priority"],
      },
    },
    resumeTopicsToProbe: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          topic: { type: "string" },
          reason: { type: "string" },
        },
        required: ["topic", "reason"],
      },
    },
    jobRequirements: { type: "array", items: { type: "string" } },
    interviewThemes: { type: "array", items: { type: "string" } },
    potentialFollowUps: { type: "array", items: { type: "string" } },
    interviewerStrategy: { type: "string" },
    openingApproach: { type: "string" },
  },
  required: [
    "roleSummary",
    "priorityCompetencies",
    "resumeTopicsToProbe",
    "jobRequirements",
    "interviewThemes",
    "potentialFollowUps",
    "interviewerStrategy",
    "openingApproach",
  ],
} as const;

const typeNotes: Record<InterviewType, string> = {
  mixed: "Balance motivation, a behavioral example, and role-specific work.",
  "hiring-manager": "Emphasize how the candidate has done the work, decisions, results, and collaboration.",
  behavioral: "Emphasize past examples with a clear personal action and an outcome.",
  recruiter: "Emphasize motivation, communication, career story, and basic fit. Avoid a deep technical work sample.",
  "role-specific": "Emphasize the concrete skills and situations in the job description.",
};

function isPlan(value: unknown): value is InterviewPlan {
  if (!value || typeof value !== "object") return false;
  const plan = value as InterviewPlan;
  if (typeof plan.roleSummary !== "string" || typeof plan.interviewerStrategy !== "string") return false;
  if (typeof plan.openingApproach !== "string") return false;
  if (!Array.isArray(plan.jobRequirements) || !Array.isArray(plan.interviewThemes)) return false;
  if (!Array.isArray(plan.potentialFollowUps) || !Array.isArray(plan.priorityCompetencies)) return false;
  if (!Array.isArray(plan.resumeTopicsToProbe)) return false;
  return plan.priorityCompetencies.every(
    (item) =>
      typeof item.name === "string" &&
      typeof item.reason === "string" &&
      priorities.includes(item.priority),
  );
}

export async function createInterviewPlan(config: InterviewConfig): Promise<InterviewPlan> {
  const client = new OpenAI({ maxRetries: 0 });
  const response = await client.responses.create({
    model: planModel(),
    instructions:
      "You prepare private context for a live voice interviewer. Do not write a numbered script of questions. Give objectives the interviewer can pursue while following what the candidate actually says. Keep every string concise enough to speak from, not to read aloud.",
    input: `Interview type: ${config.interviewType}. ${typeNotes[config.interviewType]}
Target duration: about ${config.targetDurationMinutes} minutes. This is pacing, not a list of timed sections.
Company: ${config.company}
Job title: ${config.jobTitle}

Job description:
${config.jobDescription}

Resume:
${config.candidate.resumeText}

Return at most 5 competencies, 5 resume topics, 5 job requirements, 4 themes, and 5 example follow-ups. The follow-ups are optional examples, not a sequence.`,
    text: {
      format: {
        type: "json_schema",
        name: "interview_plan",
        strict: true,
        schema: interviewPlanSchema,
      },
    },
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.output_text);
  } catch {
    throw new Error("Interview plan was not valid JSON");
  }
  if (!isPlan(parsed)) {
    throw new Error("Interview plan did not match the expected shape");
  }
  if (!parsed.roleSummary.trim() || !parsed.openingApproach.trim() || parsed.interviewThemes.length === 0) {
    throw new Error("Interview plan was incomplete");
  }
  return parsed;
}
