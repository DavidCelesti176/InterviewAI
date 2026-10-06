import { highlightedStage, JOURNEY_COPY, newestAchievement, readinessText, refreshDaily, SKILL_LABELS, visibleSkills } from "./award";
import { JOURNEY_IDS, type ProgressState, type ProgressView } from "./types";

export function presentProgress(state: ProgressState, day: string): ProgressView {
  const current = refreshDaily(state, day);
  const daily = current.daily;
  if (!daily) throw new Error("Today's training could not be prepared.");
  const journey = JOURNEY_IDS.map((id) => ({
    id,
    label: JOURNEY_COPY[id].label,
    detail: JOURNEY_COPY[id].detail,
    state: current.journey[id],
  }));
  return {
    xp: current.xp,
    level: current.level,
    levelTitle: current.levelTitle,
    streakCount: current.streakCount,
    readiness: current.readiness,
    readinessLabel: readinessText(current.readiness),
    skills: visibleSkills().map((id) => ({
      id,
      label: SKILL_LABELS[id],
      score: current.skills[id].score,
      samples: current.skills[id].samples,
    })),
    daily,
    journey,
    highlightedStage: highlightedStage(current.journey),
    completedStages: journey.filter((stage) => stage.state === "complete").length,
    newestAchievement: newestAchievement(current.achievements),
    achievementCount: Object.keys(current.achievements).length,
  };
}
