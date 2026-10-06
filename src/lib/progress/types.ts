export const SKILL_IDS = [
  "communication",
  "specificity",
  "structure",
  "conciseness",
  "businessImpact",
  "roleAlignment",
  "storytelling",
] as const;

export type SkillId = (typeof SKILL_IDS)[number];

export const JOURNEY_IDS = ["fundamentals", "story", "behavioral", "star", "role", "mocks", "ready"] as const;

export type JourneyId = (typeof JOURNEY_IDS)[number];

export type JourneyState = "available" | "complete";

export type SkillSnapshot = {
  score: number | null;
  samples: number;
};

export type DailyMission = {
  id: string;
  title: string;
  detail: string;
  href: string;
};

export type DailyPlan = {
  day: string;
  focusSkill: SkillId | null;
  primary: DailyMission;
  options: DailyMission[];
  completed: boolean;
};

export type ProgressState = {
  xp: number;
  level: number;
  levelTitle: string;
  streakCount: number;
  streakLastDay: string;
  restDaysUsedWeek: number;
  restWeekKey: string;
  timezone: string;
  readiness: number | null;
  readinessUpdatedAt: number | null;
  readinessHistory: number[];
  skills: Record<SkillId, SkillSnapshot>;
  weakestSkill: SkillId | null;
  journey: Record<JourneyId, JourneyState>;
  achievements: Record<string, number>;
  awarded: Record<string, number>;
  daily: DailyPlan | null;
  analyzedCount: number;
  behavioralCount: number;
  roleSpecificCount: number;
  storySaved: boolean;
  starPracticed: boolean;
  latestInterviewId: string;
  lastStoryAnswerHash: string;
  updatedAt: number;
};

export type AwardKind = "practice" | "story_practice" | "review" | "story_first" | "story_rewrite" | "weak_practice" | "mock";

export type AwardInput = {
  eventId: string;
  kind: AwardKind;
  day: string;
  now: number;
  scores?: Partial<Record<SkillId, number>>;
  readinessScore?: number;
  interviewType?: string;
  interviewId?: string;
  storyAnswerHash?: string;
};

export type AwardResult = {
  state: ProgressState;
  granted: boolean;
  xpGained: number;
};

export type ProgressView = {
  xp: number;
  level: number;
  levelTitle: string;
  streakCount: number;
  readiness: number | null;
  readinessLabel: string | null;
  skills: Array<{ id: SkillId; label: string; score: number | null; samples: number }>;
  daily: DailyPlan;
  journey: Array<{ id: JourneyId; label: string; detail: string; state: JourneyState }>;
  highlightedStage: JourneyId;
  completedStages: number;
  newestAchievement: { id: string; label: string } | null;
};
