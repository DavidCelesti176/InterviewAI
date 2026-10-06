import OpenAI from "openai";

import { readinessLabel } from "@/lib/interview/analysis-rubric";
import { analysisInput, analysisInstructions } from "@/lib/interview/analysis-prompt";
import type {
  AnalysisDebug,
  AnalysisUsage,
  FeedbackPoint,
  HighlightMoment,
  InterviewAnalysis,
  PracticeRecommendation,
  QuestionFeedback,
  SkillScore,
  SpeakingMetrics,
} from "@/lib/interview/analysis-types";
import { assistanceContext } from "@/lib/interview/assistance";
import type { InterviewAssistanceEvent } from "@/lib/interview/help-types";
import { interviewModeOf } from "@/lib/interview/help-types";
import { speakingMetrics } from "@/lib/interview/speaking-metrics";
import type { StoredInterview } from "@/lib/interview/store";
import type { InterviewTurn } from "@/lib/interview/types";
import { analysisModel, planReasoning } from "@/lib/live/config";

export type AnalysisStep = "reviewing" | "evaluating" | "building_plan";

const skillScoreSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    score: { type: "number" },
    explanation: { type: "string" },
  },
  required: ["score", "explanation"],
} as const;

const feedbackSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    explanation: { type: "string" },
    evidence: { type: "string" },
  },
  required: ["title", "explanation", "evidence"],
} as const;

const highlightSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    explanation: { type: "string" },
    relatedQuestion: { type: "string" },
  },
  required: ["title", "explanation", "relatedQuestion"],
} as const;

const questionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    question: { type: "string" },
    answerSummary: { type: "string" },
    score: { type: "number" },
    whatWorked: { type: "array", items: { type: "string" }, maxItems: 2 },
    whatHeldItBack: { type: "array", items: { type: "string" }, maxItems: 2 },
    betterApproach: { type: "string" },
    exampleImprovedAnswer: { type: "string" },
    recommendedForPractice: { type: "boolean" },
  },
  required: [
    "id",
    "question",
    "answerSummary",
    "score",
    "whatWorked",
    "whatHeldItBack",
    "betterApproach",
    "exampleImprovedAnswer",
    "recommendedForPractice",
  ],
} as const;

const analysisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    overallReadiness: { type: "number" },
    summary: { type: "string" },
    categoryScores: {
      type: "object",
      additionalProperties: false,
      properties: {
        communication: skillScoreSchema,
        specificity: skillScoreSchema,
        structure: skillScoreSchema,
        conciseness: skillScoreSchema,
        businessImpact: skillScoreSchema,
        roleAlignment: skillScoreSchema,
      },
      required: ["communication", "specificity", "structure", "conciseness", "businessImpact", "roleAlignment"],
    },
    strengths: { type: "array", items: feedbackSchema, maxItems: 2 },
    focusAreas: { type: "array", items: feedbackSchema, maxItems: 2 },
    strongestMoment: highlightSchema,
    missedOpportunity: highlightSchema,
    questionFeedback: { type: "array", items: questionSchema, maxItems: 4 },
    quantifiedAnswerCount: { type: "number" },
    totalRelevantAnswers: { type: "number" },
    assistanceNote: { type: "string" },
    practiceRecommendations: {
      type: "array",
      maxItems: 2,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          reason: { type: "string" },
          priority: { type: "string", enum: ["high", "medium", "low"] },
          relatedQuestionIds: { type: "array", items: { type: "string" }, maxItems: 2 },
        },
        required: ["title", "reason", "priority", "relatedQuestionIds"],
      },
    },
  },
  required: [
    "overallReadiness",
    "summary",
    "categoryScores",
    "strengths",
    "focusAreas",
    "strongestMoment",
    "missedOpportunity",
    "questionFeedback",
    "quantifiedAnswerCount",
    "totalRelevantAnswers",
    "practiceRecommendations",
    "assistanceNote",
  ],
} as const;

type ModelAnalysis = {
  overallReadiness: number;
  summary: string;
  categoryScores: InterviewAnalysis["categoryScores"];
  strengths: FeedbackPoint[];
  focusAreas: FeedbackPoint[];
  strongestMoment: HighlightMoment;
  missedOpportunity: HighlightMoment;
  questionFeedback: QuestionFeedback[];
  quantifiedAnswerCount: number;
  totalRelevantAnswers: number;
  practiceRecommendations: PracticeRecommendation[];
  assistanceNote: string;
};

export async function analyzeInterview(input: {
  interview: StoredInterview;
  turns: InterviewTurn[];
  elapsedMs: number;
  assistance?: InterviewAssistanceEvent[];
  pausedMs?: number;
  onStep?: (step: AnalysisStep, state: "active" | "done") => void;
}): Promise<{ analysis: InterviewAnalysis; debug: AnalysisDebug }> {
  const onStep = input.onStep ?? (() => undefined);
  onStep("reviewing", "active");
  const candidateText = input.turns
    .filter((turn) => turn.speaker === "candidate")
    .map((turn) => turn.text.trim())
    .join(" ");
  if (candidateText.length < 40) throw new Error("There isn't enough of the conversation to review.");
  const measured = speakingMetrics(input.turns);
  onStep("reviewing", "done");

  onStep("evaluating", "active");
  const started = Date.now();
  const client = new OpenAI({ maxRetries: 0, timeout: 25_000 });
  const model = analysisModel();
  const response = await client.responses.create({
    model,
    reasoning: planReasoning,
    instructions: analysisInstructions,
    input: analysisInput(
      input.interview.config,
      input.interview.blueprint,
      input.turns,
      input.elapsedMs,
      assistanceContext(interviewModeOf(input.interview.config.interviewMode), input.assistance ?? [], input.pausedMs ?? 0),
    ),
    text: {
      format: {
        type: "json_schema",
        name: "interview_analysis",
        strict: true,
        schema: analysisSchema,
      },
    },
  });
  onStep("evaluating", "done");

  onStep("building_plan", "active");
  const parsed: unknown = JSON.parse(response.output_text);
  if (!isModelAnalysis(parsed)) throw new Error("The analysis was incomplete.");
  const analysis = normalize(parsed, measured);
  onStep("building_plan", "done");

  return {
    analysis,
    debug: {
      model,
      durationMs: Date.now() - started,
      responseId: response.id,
      usage: usageFrom(response.usage),
    },
  };
}

function normalize(model: ModelAnalysis, measured: SpeakingMetrics): InterviewAnalysis {
  const overallReadiness = score(model.overallReadiness);
  const usedIds = new Set<string>();
  const questions = model.questionFeedback.slice(0, 4).map((item, index) => {
    const base = item.id.trim().slice(0, 40) || `q${index + 1}`;
    let id = base;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);
    return {
      id,
      question: clip(item.question, 400),
      answerSummary: clip(item.answerSummary, 400),
      score: score(item.score),
      whatWorked: cleanList(item.whatWorked, 3),
      whatHeldItBack: cleanList(item.whatHeldItBack, 3),
      betterApproach: clip(item.betterApproach, 500),
      exampleImprovedAnswer: clip(item.exampleImprovedAnswer, 700),
      recommendedForPractice: item.recommendedForPractice,
    };
  });
  const ids = new Set(questions.map((item) => item.id));
  const totalRelevant = Math.max(0, Math.round(model.totalRelevantAnswers));
  const quantified = Math.min(totalRelevant, Math.max(0, Math.round(model.quantifiedAnswerCount)));
  const speaking: SpeakingMetrics = { ...measured };
  if (totalRelevant > 0) {
    speaking.quantifiedAnswerCount = quantified;
    speaking.totalRelevantAnswers = totalRelevant;
  }

  return {
    overallReadiness,
    overallLabel: readinessLabel(overallReadiness),
    summary: clip(model.summary, 700),
    categoryScores: {
      communication: skill(model.categoryScores.communication),
      specificity: skill(model.categoryScores.specificity),
      structure: skill(model.categoryScores.structure),
      conciseness: skill(model.categoryScores.conciseness),
      businessImpact: skill(model.categoryScores.businessImpact),
      roleAlignment: skill(model.categoryScores.roleAlignment),
    },
    strengths: model.strengths.slice(0, 3).map(point),
    focusAreas: model.focusAreas.slice(0, 3).map(point),
    strongestMoment: moment(model.strongestMoment),
    missedOpportunity: moment(model.missedOpportunity),
    questionFeedback: questions,
    speakingMetrics: speaking,
    assistanceNote: clip(model.assistanceNote ?? "", 400),
    practiceRecommendations: model.practiceRecommendations
      .slice(0, 4)
      .map((item) => ({
        title: clip(item.title, 120),
        reason: clip(item.reason, 400),
        priority: item.priority,
        relatedQuestionIds: item.relatedQuestionIds.filter((id) => ids.has(id)).slice(0, 4),
      }))
      .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority)),
  };
}

function isModelAnalysis(value: unknown): value is ModelAnalysis {
  if (!value || typeof value !== "object") return false;
  const analysis = value as ModelAnalysis;
  return (
    typeof analysis.summary === "string" &&
    analysis.summary.trim().length > 0 &&
    Boolean(analysis.categoryScores?.communication) &&
    Boolean(analysis.strongestMoment?.title) &&
    Boolean(analysis.missedOpportunity?.title) &&
    Array.isArray(analysis.questionFeedback) &&
    analysis.questionFeedback.length > 0 &&
    Array.isArray(analysis.practiceRecommendations)
  );
}

function skill(value: SkillScore): SkillScore {
  return { score: score(value.score), explanation: clip(value.explanation, 280) };
}

function point(value: FeedbackPoint): FeedbackPoint {
  return {
    title: clip(value.title, 120),
    explanation: clip(value.explanation, 400),
    evidence: clip(value.evidence, 300),
  };
}

function moment(value: HighlightMoment): HighlightMoment {
  return {
    title: clip(value.title, 140),
    explanation: clip(value.explanation, 450),
    relatedQuestion: clip(value.relatedQuestion, 200),
  };
}

function cleanList(values: string[], max: number): string[] {
  return values.map((item) => clip(item, 220)).filter(Boolean).slice(0, max);
}

function score(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function clip(value: string, max: number): string {
  const text = value.trim();
  if (text.length <= max) return text;
  const sliced = text.slice(0, max);
  const sentence = Math.max(sliced.lastIndexOf(". "), sliced.lastIndexOf("! "), sliced.lastIndexOf("? "));
  if (sentence > max * 0.55) return sliced.slice(0, sentence + 1);
  const space = sliced.lastIndexOf(" ");
  return space > 40 ? sliced.slice(0, space) : sliced;
}

function priorityRank(priority: PracticeRecommendation["priority"]): number {
  if (priority === "high") return 0;
  if (priority === "medium") return 1;
  return 2;
}

function usageFrom(usage: OpenAI.Responses.Response["usage"]): AnalysisUsage | undefined {
  if (!usage) return undefined;
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    totalTokens: usage.total_tokens,
  };
}
