import type { ReadinessLabel } from "@/lib/interview/analysis-types";

export function readinessLabel(score: number): ReadinessLabel {
  if (score >= 90) return "excellent";
  if (score >= 80) return "strong";
  if (score >= 65) return "solid";
  if (score >= 50) return "developing";
  return "needs_work";
}

export function readinessTitle(label: ReadinessLabel): string {
  const titles: Record<ReadinessLabel, string> = {
    needs_work: "Needs work",
    developing: "Developing",
    solid: "Solid",
    strong: "Strong",
    excellent: "Excellent",
  };
  return titles[label];
}

export const rubricAnchors = `Use whole numbers. 84 and 83 are not a meaningful difference, so pick the number that matches the band.

Communication
50: Difficult to follow or often unclear.
70: Understandable, with some rambling or muddy points.
85: Clear, professional, and easy to follow.
95: Exceptionally clear, concise, confident, and natural.

Specificity
50: Mostly generic claims.
70: Some concrete examples, with uneven detail.
85: Specific examples and clear personal actions.
95: Highly specific, relevant, and backed by concrete evidence.

Answer structure
50: Hard to find the point.
70: A recognizable example, but the pieces arrive out of order.
85: A clear situation, action, and result when the question calls for it.
95: Easy to follow, with the point up front and the result in the right place.

Conciseness
50: So long or so thin that the point is lost.
70: Some extra setup or a few missing beats.
85: Complete without wandering.
95: Complete, tight, and natural. Do not punish a short answer that already did the job.

Business impact
50: No outcome, even when the question asked for one.
70: A result is mentioned, but it is vague or late.
85: A clear outcome tied to the candidate's own work.
95: A specific, credible outcome that shows why the work mattered. Skip this demand when the question did not call for a metric.

Role alignment
50: Little connection to this job.
70: Related experience, with a weak link to the actual work.
85: Relevant examples at the level this role expects.
95: Directly shows the judgment, scope, and skills this role is hiring for.

Calibrate to the candidate level. A recent graduate is not an executive. A senior manager should show more scope, leadership, and tradeoffs. A recruiter screen weighs clarity, motivation, and fit. A role-specific interview weighs applied skill. A behavioral interview weighs specific past examples. Do not raise the bar because a company style is demanding, and do not lower it below the job.`;
