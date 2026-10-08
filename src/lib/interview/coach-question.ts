import OpenAI from "openai";

import type { HelpKind, InterviewHelpResponse } from "@/lib/interview/help-types";
import { clipText } from "@/lib/interview/limits";
import type { StoredInterview } from "@/lib/interview/store";
import type { InterviewTurn } from "@/lib/interview/types";
import { coachingModel, planReasoning } from "@/lib/live/config";

const stepSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    label: { type: "string" },
    guidance: { type: "string" },
  },
  required: ["label", "guidance"],
} as const;

const schemas = {
  rephrase: {
    type: "object",
    additionalProperties: false,
    properties: { rephrasedQuestion: { type: "string" } },
    required: ["rephrasedQuestion"],
  },
  competency: {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string" },
      explanation: { type: "string" },
      whatStrongAnswersShow: { type: "array", items: { type: "string" } },
    },
    required: ["name", "explanation", "whatStrongAnswersShow"],
  },
  structure: {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string" },
      steps: { type: "array", items: stepSchema },
    },
    required: ["name", "steps"],
  },
  experiences: {
    type: "object",
    additionalProperties: false,
    properties: {
      suggestions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            source: { type: "string", enum: ["resume", "interview"] },
            reason: { type: "string" },
          },
          required: ["title", "source", "reason"],
        },
      },
      note: { type: "string" },
    },
    required: ["suggestions", "note"],
  },
} as const;

const kindTask: Record<HelpKind, string> = {
  rephrase:
    "Rephrase the interviewer's question in simpler language. Do not answer it. One or two sentences.",
  competency:
    "Name the competency being tested, explain it in plain language, and list up to three things a strong answer shows. Do not write the candidate's answer.",
  structure:
    "Give a short framework for this question. Use Situation, Challenge, Action, Result only when it is a past-behavior question. For an analytical or technical question, use a framework such as Problem, Approach, Reasoning, Result, Lesson. Three to five steps. Each step is a prompt they can think through, not a filled-in story.",
  experiences:
    "Suggest up to four real experiences that could fit. Use only the resume and the interview transcript. Do not invent employers, projects, or outcomes. If nothing fits, return an empty list and a note that a class project, internship, part-time job, campus role, or small business can work when they actually did it. Do not write the story for them.",
};

export async function coachQuestion(input: {
  interview: StoredInterview;
  kind: HelpKind;
  question: string;
  recentTurns: InterviewTurn[];
}): Promise<{ help: InterviewHelpResponse; model: string; durationMs: number; responseId: string }> {
  const started = Date.now();
  const client = new OpenAI({ maxRetries: 0, timeout: 45_000 });
  const model = coachingModel();
  const response = await client.responses.create({
    model,
    reasoning: planReasoning,
    instructions: coachingInstructions(input.interview),
    input: coachingInput(input),
    text: {
      format: {
        type: "json_schema",
        name: "interview_help",
        strict: true,
        schema: schemas[input.kind],
      },
    },
  });
  const parsed: unknown = JSON.parse(response.output_text);
  return {
    help: normalizeHelp(input.kind, input.question, parsed),
    model,
    durationMs: Date.now() - started,
    responseId: response.id,
  };
}

function coachingInstructions(interview: StoredInterview): string {
  const calibration = interview.blueprint.experienceCalibration;
  const ceiling = calibration
    ? `Career stage: ${calibration.careerStage.replaceAll("_", " ")}. Leadership authority: ${calibration.leadershipAuthority}. Stakeholder influence: ${calibration.stakeholderInfluence}. People management: ${calibration.peopleManagement}. ${calibration.ceilingSummary}`
    : "Calibrate to the candidate level in the materials.";
  return `You help a candidate understand an interview question while the interview is paused. You are not the interviewer.

Do not write their complete answer. Do not encourage lying or exaggeration. Do not fabricate employers, projects, metrics, or conversations. Prefer helping them recognize a real experience.

For students and recent graduates, internships, class projects, student organizations, athletics, part-time work, entrepreneurship, and volunteering are valid. Do not imply that corporate leadership examples are required.

${ceiling}

Keep the response short enough to read in a few seconds. Plain language. No scores.`;
}

function coachingInput(input: { interview: StoredInterview; kind: HelpKind; question: string; recentTurns: InterviewTurn[] }): string {
  const turns = input.recentTurns
    .slice(-6)
    .map((turn) => `${turn.speaker === "candidate" ? "Candidate" : "Interviewer"}: ${clipText(turn.text, 500)}`)
    .join("\n");
  return `Task: ${kindTask[input.kind]}

Current question:
${input.question}

Recent conversation:
${turns || "No earlier turns."}

Job title: ${input.interview.config.jobTitle}
Company: ${input.interview.config.company}

Job description:
${clipText(input.interview.config.jobDescription, 2500)}

Resume:
${clipText(input.interview.config.candidate.resumeText, 4000)}`;
}

function normalizeHelp(kind: HelpKind, question: string, value: unknown): InterviewHelpResponse {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const help: InterviewHelpResponse = { question: clipText(question, 500) };
  if (kind === "rephrase") {
    help.rephrasedQuestion = clipText(stringField(record.rephrasedQuestion), 400);
  }
  if (kind === "competency") {
    const shows = Array.isArray(record.whatStrongAnswersShow) ? record.whatStrongAnswersShow : [];
    help.competency = {
      name: clipText(stringField(record.name), 80),
      explanation: clipText(stringField(record.explanation), 400),
      whatStrongAnswersShow: shows
        .filter((item): item is string => typeof item === "string")
        .map((item) => clipText(item, 160))
        .filter(Boolean)
        .slice(0, 3),
    };
  }
  if (kind === "structure") {
    const steps = Array.isArray(record.steps) ? record.steps : [];
    help.answerFramework = {
      name: clipText(stringField(record.name), 80) || "A simple structure",
      steps: steps
        .map((step) => {
          if (!step || typeof step !== "object") return null;
          const item = step as Record<string, unknown>;
          const label = clipText(stringField(item.label), 40);
          const guidance = clipText(stringField(item.guidance), 160);
          if (!label || !guidance) return null;
          return { label, guidance };
        })
        .filter((step): step is { label: string; guidance: string } => step !== null)
        .slice(0, 5),
    };
  }
  if (kind === "experiences") {
    const suggestions = Array.isArray(record.suggestions) ? record.suggestions : [];
    const experiences: NonNullable<InterviewHelpResponse["suggestedExperiences"]> = [];
    for (const item of suggestions) {
      if (!item || typeof item !== "object") continue;
      const suggestion = item as Record<string, unknown>;
      const title = clipText(stringField(suggestion.title), 80);
      const reason = clipText(stringField(suggestion.reason), 180);
      const source = suggestion.source === "interview" || suggestion.source === "resume" ? suggestion.source : null;
      if (!title || !reason || !source) continue;
      experiences.push({ title, source, reason });
    }
    help.suggestedExperiences = experiences.slice(0, 4);
    help.note = clipText(stringField(record.note), 300);
  }
  return help;
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value : "";
}
