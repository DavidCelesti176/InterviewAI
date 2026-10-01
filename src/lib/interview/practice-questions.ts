import type { InterviewAnalysis, QuestionFeedback } from "@/lib/interview/analysis-types";

const PRACTICE_LIMIT = 4;

export function questionsForWeakPractice(analysis: InterviewAnalysis): QuestionFeedback[] {
  const marked = analysis.questionFeedback.filter((item) => item.recommendedForPractice);
  if (marked.length > 0) return orderByPriority(marked, analysis).slice(0, PRACTICE_LIMIT);
  const related = new Set(analysis.practiceRecommendations.flatMap((item) => item.relatedQuestionIds));
  const linked = analysis.questionFeedback.filter((item) => related.has(item.id));
  const pool = linked.length > 0 ? linked : [...analysis.questionFeedback].sort((left, right) => left.score - right.score);
  return orderByPriority(pool, analysis).slice(0, PRACTICE_LIMIT);
}

function orderByPriority(questions: QuestionFeedback[], analysis: InterviewAnalysis): QuestionFeedback[] {
  const rank = new Map<string, number>();
  analysis.practiceRecommendations.forEach((item, index) => {
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
