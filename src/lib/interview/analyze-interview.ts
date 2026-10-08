import OpenAI from "openai";

import { readinessLabel } from "@/lib/interview/analysis-rubric";
import { excessiveStoryReuse, groundImprovedAnswer, showMissingEvidence } from "@/lib/interview/analysis-grounding";
import { analysisInput, analysisInstructions } from "@/lib/interview/analysis-prompt";
import { frameworkForQuestion, type AnswerFramework, type StarCoverage } from "@/lib/interview/star";
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
    framework: { type: "string", enum: ["star", "motivation", "structured_reasoning", "direct"] },
    starCoverage: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          properties: {
            situation: { type: "string", enum: ["missing", "weak", "clear"] },
            task: { type: "string", enum: ["missing", "weak", "clear"] },
            action: { type: "string", enum: ["missing", "weak", "clear"] },
            result: { type: "string", enum: ["missing", "weak", "clear"] },
            learning: { type: "string", enum: ["not_applicable", "missing", "weak", "clear"] },
          },
          required: ["situation", "task", "action", "result", "learning"],
        },
      ],
    },
    recommendedStory: { type: "string" },
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
    "framework",
    "starCoverage",
    "recommendedStory",
  ],
} as const;

export const basicSchema = {
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
    strengths: { type: "array", items: feedbackSchema, maxItems: 1 },
    focusAreas: { type: "array", items: feedbackSchema, maxItems: 1 },
    assistanceNote: { type: "string" },
  },
  required: ["overallReadiness", "summary", "categoryScores", "strengths", "focusAreas", "assistanceNote"],
} as const;

const basicInstructions = [
  "You review a short practice interview.",
  "Return only the requested fields: readiness, a short summary, six category scores, one strength, one focus area, and an assistance note.",
  "Do not invent questions, highlights, or a practice plan.",
  "Scores are 0 to 100.",
].join(" ");

export const analysisSchema = {
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
    coachingLine: { type: "string" },
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
    "coachingLine",
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
  coachingLine?: string;
};

export async function analyzeInterview(input: {
  interview: StoredInterview;
  turns: InterviewTurn[];
  elapsedMs: number;
  assistance?: InterviewAssistanceEvent[];
  pausedMs?: number;
  tier?: "basic" | "full";
  confirmedStories?: string;
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
  const tier = input.tier === "basic" ? "basic" : "full";
  const started = Date.now();
  const client = new OpenAI({ maxRetries: 0, timeout: 25_000 });
  const model = analysisModel();
  const response = await client.responses.create({
    model,
    reasoning: planReasoning,
    instructions: tier === "basic" ? basicInstructions : analysisInstructions,
    input: analysisInput(
      input.interview.config,
      input.interview.blueprint,
      input.turns,
      input.elapsedMs,
      assistanceContext(interviewModeOf(input.interview.config.interviewMode), input.assistance ?? [], input.pausedMs ?? 0),
      input.interview.storyContext ?? "",
      input.confirmedStories ?? "",
    ),
    text: {
      format: {
        type: "json_schema",
        name: tier === "basic" ? "basic_interview_analysis" : "interview_analysis",
        strict: true,
        schema: tier === "basic" ? basicSchema : analysisSchema,
      },
    },
  });
  onStep("evaluating", "done");

  onStep("building_plan", "active");
  const parsed: unknown = JSON.parse(response.output_text);
  const grounded = [candidateText, input.interview.config.candidate.resumeText, input.interview.storyContext ?? "", input.confirmedStories ?? ""].join("\n");
  const analysis = tier === "basic" ? normalizeBasic(parsed, measured) : normalizeFull(parsed, measured, grounded);
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

function normalizeFull(parsed: unknown, measured: SpeakingMetrics, grounded: string): InterviewAnalysis {
  if (!isModelAnalysis(parsed)) throw new Error("The analysis was incomplete.");
  return normalize(parsed, measured, grounded);
}

function normalizeBasic(parsed: unknown, measured: SpeakingMetrics): InterviewAnalysis {
  if (!parsed || typeof parsed !== "object") throw new Error("The analysis was incomplete.");
  const model = parsed as {
    overallReadiness: number;
    summary: string;
    categoryScores: InterviewAnalysis["categoryScores"];
    strengths: FeedbackPoint[];
    focusAreas: FeedbackPoint[];
    assistanceNote: string;
  };
  if (typeof model.summary !== "string" || !model.summary.trim() || !model.categoryScores?.communication) {
    throw new Error("The analysis was incomplete.");
  }
  const overallReadiness = score(model.overallReadiness);
  const blank = { title: "", explanation: "", relatedQuestion: "" };
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
    strengths: (model.strengths ?? []).slice(0, 1).map(point),
    focusAreas: (model.focusAreas ?? []).slice(0, 1).map(point),
    strongestMoment: blank,
    missedOpportunity: blank,
    questionFeedback: [],
    speakingMetrics: measured,
    assistanceNote: clip(model.assistanceNote ?? "", 400),
    practiceRecommendations: [],
  };
}

function normalize(model: ModelAnalysis, measured: SpeakingMetrics, grounded: string): InterviewAnalysis {
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
    const framework = frameworkOf(item.framework, item.question);
    const starCoverage = framework === "star" ? coverageOf(item.starCoverage) : null;
    const improved = showMissingEvidence(groundImprovedAnswer(clip(item.exampleImprovedAnswer, 700), [grounded]), starCoverage);
    return {
      id,
      question: clip(item.question, 400),
      answerSummary: clip(item.answerSummary, 400),
      score: score(item.score),
      whatWorked: cleanList(item.whatWorked, 3),
      whatHeldItBack: cleanList(item.whatHeldItBack, 3),
      betterApproach: clip(item.betterApproach, 500),
      exampleImprovedAnswer: improved,
      recommendedForPractice: item.recommendedForPractice,
      framework,
      starCoverage,
      recommendedStory: clip(item.recommendedStory ?? "", 120) || "Needs a story",
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
    coachingLine: coachingLineFor(model.coachingLine, questions),
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

function frameworkOf(value: unknown, question: string): AnswerFramework {
  if (value === "star" || value === "motivation" || value === "structured_reasoning" || value === "direct") return value;
  return frameworkForQuestion(question);
}

function coverageOf(value: unknown): StarCoverage | null {
  if (!value || typeof value !== "object") return null;
  const coverage = value as StarCoverage;
  const level = (item: unknown) => item === "missing" || item === "weak" || item === "clear";
  const learning = coverage.learning === "not_applicable" || level(coverage.learning);
  if (!level(coverage.situation) || !level(coverage.task) || !level(coverage.action) || !level(coverage.result) || !learning) return null;
  return coverage;
}

function coachingLineFor(value: string | undefined, questions: QuestionFeedback[]): string {
  const line = clip(value ?? "", 180);
  if (!excessiveStoryReuse(questions.map((item) => item.recommendedStory ?? ""))) return line;
  return line || "The same story was used for most of this interview. A second example would be stronger.";
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
