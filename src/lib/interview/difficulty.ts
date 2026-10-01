import type { CandidateLevel, DifficultyCurve } from "@/lib/interview/types";

const juniorLevels = new Set<CandidateLevel>(["intern", "recent_grad", "entry", "early_career"]);

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(5, Math.max(1, Math.round(value)));
}

export function buildDifficultyCurve(level: CandidateLevel, recommended: number): DifficultyCurve {
  const overall = clampScore(recommended);
  if (juniorLevels.has(level)) {
    return { opening: 1, early: 2, middle: 3, late: 3 };
  }
  if (level === "mid") {
    return {
      opening: 2,
      early: Math.min(3, Math.max(2, overall)),
      middle: Math.min(4, overall + 1),
      late: Math.min(4, Math.max(3, overall + 1)),
    };
  }
  if (level === "senior" || level === "manager") {
    return { opening: 2, early: 3, middle: 4, late: Math.max(4, Math.min(5, overall)) };
  }
  return { opening: 2, early: 3, middle: 4, late: 5 };
}

export function overallDifficulty(level: CandidateLevel, recommended: number): number {
  const score = clampScore(recommended);
  if (juniorLevels.has(level)) return Math.min(3, Math.max(2, score));
  return score;
}

export function levelLabel(level: CandidateLevel): string {
  const labels: Record<CandidateLevel, string> = {
    intern: "Internship interview",
    recent_grad: "Recent-graduate interview",
    entry: "Entry-level interview",
    early_career: "Early-career interview",
    mid: "Mid-level interview",
    senior: "Senior interview",
    manager: "Manager interview",
    director: "Director interview",
    executive: "Executive interview",
  };
  return labels[level];
}
