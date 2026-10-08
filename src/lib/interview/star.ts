import type { CompetencyPriority } from "@/lib/interview/competencies";

export type AnswerFramework = "star" | "motivation" | "structured_reasoning" | "direct";

export type StarLevel = "missing" | "weak" | "clear";

export type LearningLevel = "not_applicable" | StarLevel;

export type StarCoverage = {
  situation: StarLevel;
  task: StarLevel;
  action: StarLevel;
  result: StarLevel;
  learning: LearningLevel;
};

export const FOLLOW_UP_ACTION = "What did you personally do?";
export const FOLLOW_UP_RESULT = "What happened as a result?";
export const FOLLOW_UP_EXAMPLE = "Can you give me one specific example?";
export const FOLLOW_UP_LEARNING = "What did you take away from that experience?";

export function frameworkForQuestion(question: string): AnswerFramework {
  const text = question.trim().toLowerCase();
  if (/tell me about a time|describe a time|give me an example|walk me through a time|when have you|a situation where/.test(text)) return "star";
  if (/why (this|our) (company|firm|organization)|why (do you want|this role|this program|this fellowship)|what draws you|why us\b/.test(text)) return "motivation";
  if (/how would you|what would you do|how might you|if you had to prioritize|how do you prioritize/.test(text)) return "structured_reasoning";
  return "direct";
}

export function followUpFor(input: {
  framework: AnswerFramework;
  coverage: StarCoverage | null;
  followUpsAlready: number;
  priority?: CompetencyPriority;
  stillVague?: boolean;
}): string | null {
  if (input.framework !== "star" || !input.coverage) return null;
  if (input.followUpsAlready >= 2) return null;
  if (input.followUpsAlready === 1 && !(input.priority === "high" && input.stillVague)) return null;
  return nextGap(input.coverage);
}

function nextGap(coverage: StarCoverage): string | null {
  const learningRequired = coverage.learning !== "not_applicable";
  if (coverage.situation === "missing" && coverage.task === "missing") return FOLLOW_UP_EXAMPLE;
  if (coverage.action !== "clear") return FOLLOW_UP_ACTION;
  if (learningRequired && coverage.learning !== "clear") return FOLLOW_UP_LEARNING;
  if (!learningRequired && coverage.result !== "clear") return FOLLOW_UP_RESULT;
  return null;
}

export function clearStar(learning: LearningLevel = "not_applicable"): StarCoverage {
  return { situation: "clear", task: "clear", action: "clear", result: "clear", learning };
}
