import type { InterviewAnalysis } from "@/lib/interview/analysis-types";
import type { AnalysisTier } from "@/lib/billing/types";

const emptyMoment = { title: "", explanation: "", relatedQuestion: "" };

export function projectAnalysis(analysis: InterviewAnalysis, tier: AnalysisTier): InterviewAnalysis {
  if (tier === "full") return analysis;
  return {
    ...analysis,
    strengths: analysis.strengths.slice(0, 1),
    focusAreas: analysis.focusAreas.slice(0, 1),
    strongestMoment: emptyMoment,
    missedOpportunity: emptyMoment,
    questionFeedback: [],
    practiceRecommendations: [],
    coachingLine: "",
  };
}
