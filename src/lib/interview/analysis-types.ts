export type ReadinessLabel = "needs_work" | "developing" | "solid" | "strong" | "excellent";

export interface SkillScore {
  score: number;
  explanation: string;
}

export interface FeedbackPoint {
  title: string;
  explanation: string;
  evidence: string;
}

export interface HighlightMoment {
  title: string;
  explanation: string;
  relatedQuestion: string;
}

export interface QuestionFeedback {
  id: string;
  question: string;
  answerSummary: string;
  score: number;
  whatWorked: string[];
  whatHeldItBack: string[];
  betterApproach: string;
  exampleImprovedAnswer: string;
  recommendedForPractice: boolean;
}

export interface SpeakingMetrics {
  averageAnswerSeconds?: number;
  longestAnswerSeconds?: number;
  approximateWordsPerMinute?: number;
  fillerWordCount?: number;
  fillerWords?: Array<{ word: string; count: number }>;
  quantifiedAnswerCount?: number;
  totalRelevantAnswers?: number;
}

export interface PracticeRecommendation {
  title: string;
  reason: string;
  priority: "high" | "medium" | "low";
  relatedQuestionIds: string[];
}

export interface InterviewAnalysis {
  overallReadiness: number;
  overallLabel: ReadinessLabel;
  summary: string;
  categoryScores: {
    communication: SkillScore;
    specificity: SkillScore;
    structure: SkillScore;
    conciseness: SkillScore;
    businessImpact: SkillScore;
    roleAlignment: SkillScore;
  };
  strengths: FeedbackPoint[];
  focusAreas: FeedbackPoint[];
  strongestMoment: HighlightMoment;
  missedOpportunity: HighlightMoment;
  questionFeedback: QuestionFeedback[];
  speakingMetrics: SpeakingMetrics;
  practiceRecommendations: PracticeRecommendation[];
  assistanceNote?: string;
}

export type AnalysisUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type AnalysisDebug = {
  model: string;
  durationMs: number;
  responseId: string;
  usage?: AnalysisUsage;
};
