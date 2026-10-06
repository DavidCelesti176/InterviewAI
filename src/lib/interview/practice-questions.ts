import type { InterviewAnalysis, QuestionFeedback } from "@/lib/interview/analysis-types";

const PRACTICE_LIMIT = 4;

export function questionsForWeakPractice(analysis: InterviewAnalysis): QuestionFeedback[] {
  const feedback = analysis.questionFeedback ?? [];
  const recommendations = analysis.practiceRecommendations ?? [];
  const marked = feedback.filter((item) => item.recommendedForPractice);
  if (marked.length > 0) return orderByPriority(marked, recommendations).slice(0, PRACTICE_LIMIT);
  const related = new Set(recommendations.flatMap((item) => item.relatedQuestionIds));
  const linked = feedback.filter((item) => related.has(item.id));
  const pool = linked.length > 0 ? linked : [...feedback].sort((left, right) => left.score - right.score);
  return orderByPriority(pool, recommendations).slice(0, PRACTICE_LIMIT);
}

function orderByPriority(questions: QuestionFeedback[], recommendations: InterviewAnalysis["practiceRecommendations"]): QuestionFeedback[] {
  const rank = new Map<string, number>();
  (recommendations ?? []).forEach((item, index) => {
    const weight = item.priority === "high" ? 0 : item.priority === "medium" ? 1 : 2;
    for (const id of item.relatedQuestionIds) {
      const current = rank.get(id);
      const next = weight * 100 + index;
      if (current === undefined || next < current) rank.set(id, next);
    }
  });
  return [...questions].sort((left, right) => {
    const leftRank = rank.get(left.id) ?? 1_000 + left.score;
    const rightRank = rank.get(right.id) ?? 1_000 + right.score;
    return leftRank - rightRank;
  });
}
