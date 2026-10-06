import { readinessLabel, readinessTitle } from "../interview/analysis-rubric";
import {
  JOURNEY_IDS,
  SKILL_IDS,
  type AwardInput,
  type AwardResult,
  type DailyMission,
  type DailyPlan,
  type JourneyId,
  type JourneyState,
  type ProgressState,
  type SkillId,
  type SkillSnapshot,
} from "./types";

export const XP = {
  practice: 25,
  storyPractice: 25,
  review: 10,
  storyFirst: 40,
  storyRewrite: 15,
  weakPractice: 35,
  mock: 80,
  improvement: 30,
} as const;

const LEVELS: Array<{ xp: number; title: string }> = [
  { xp: 0, title: "Foundations" },
  { xp: 50, title: "Clear answers" },
  { xp: 120, title: "Structured examples" },
  { xp: 220, title: "Consistent practice" },
  { xp: 360, title: "Role ready" },
  { xp: 540, title: "Composed" },
];

const TIE_ORDER: SkillId[] = [
  "structure",
  "specificity",
  "conciseness",
  "communication",
  "storytelling",
  "businessImpact",
  "roleAlignment",
];

export const SKILL_LABELS: Record<SkillId, string> = {
  communication: "Communication",
  specificity: "Specific examples",
  structure: "STAR structure",
  conciseness: "Conciseness",
  businessImpact: "Business impact",
  roleAlignment: "Role alignment",
  storytelling: "Storytelling",
};

export const JOURNEY_COPY: Record<JourneyId, { label: string; detail: string }> = {
  fundamentals: { label: "Interview fundamentals", detail: "Finish one reviewed interview." },
  story: { label: "Tell your story", detail: "Save the professional story from your resume." },
  behavioral: { label: "Behavioral basics", detail: "Complete a behavioral or mixed interview." },
  star: { label: "STAR practice", detail: "Practice an answer that needs a clearer structure." },
  role: { label: "Role-specific practice", detail: "Complete an interview built around one role." },
  mocks: { label: "Full mock interviews", detail: "Finish two reviewed interviews." },
  ready: { label: "Interview ready", detail: "Reach a strong readiness score and keep a saved story." },
};

export const ACHIEVEMENT_LABELS: Record<string, string> = {
  first_interview: "First interview reviewed",
  first_story: "Story saved",
  first_story_spoken: "Story practiced out loud",
  first_weak_retry: "Weak answer practiced",
  streak_3: "Three days of practice",
  streak_7: "Seven days of practice",
  readiness_solid: "Reached solid readiness",
};

const DASHBOARD_SKILLS: SkillId[] = ["structure", "specificity", "conciseness", "communication", "storytelling", "businessImpact"];

export function emptySkills(): Record<SkillId, SkillSnapshot> {
  return {
    communication: { score: null, samples: 0 },
    specificity: { score: null, samples: 0 },
    structure: { score: null, samples: 0 },
    conciseness: { score: null, samples: 0 },
    businessImpact: { score: null, samples: 0 },
    roleAlignment: { score: null, samples: 0 },
    storytelling: { score: null, samples: 0 },
  };
}

export function emptyProgress(now = 0): ProgressState {
  const skills = emptySkills();
  return {
    xp: 0,
    level: 1,
    levelTitle: "Foundations",
    streakCount: 0,
    streakLastDay: "",
    restDaysUsedWeek: 0,
    restWeekKey: "",
    timezone: "",
    readiness: null,
    readinessUpdatedAt: null,
    readinessHistory: [],
    skills,
    weakestSkill: null,
    journey: journeyFrom({ analyzedCount: 0, storySaved: false, behavioralCount: 0, starPracticed: false, roleSpecificCount: 0, readiness: null }),
    achievements: {},
    awarded: {},
    daily: null,
    analyzedCount: 0,
    behavioralCount: 0,
    roleSpecificCount: 0,
    storySaved: false,
    starPracticed: false,
    latestInterviewId: "",
    lastStoryAnswerHash: "",
    updatedAt: now,
  };
}

export function levelForXp(xp: number): { level: number; title: string } {
  const value = Math.max(0, Math.floor(xp));
  let level = 1;
  let title = LEVELS[0].title;
  for (let index = 0; index < LEVELS.length; index += 1) {
    if (value >= LEVELS[index].xp) {
      level = index + 1;
      title = LEVELS[index].title;
    }
  }
  if (value >= 540) {
    level = 6 + Math.floor((value - 540) / 220);
    title = "Composed";
  }
  return { level, title };
}

export function localDay(now: number, timeZone: string): string {
  const zone = safeTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(now));
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function safeTimeZone(value: string): string {
  const zone = value.trim();
  if (!zone || zone.length > 80) return "UTC";
  try {
    Intl.DateTimeFormat("en-US", { timeZone: zone }).format(0);
    return zone;
  } catch {
    return "UTC";
  }
}

export function readinessFromScores(scores: number[]): number | null {
  const recent = scores.filter((score) => Number.isFinite(score)).slice(-3);
  if (recent.length === 0) return null;
  if (recent.length === 1) return clampScore(recent[0]);
  if (recent.length === 2) return clampScore(recent[1] * 0.625 + recent[0] * 0.375);
  return clampScore(recent[2] * 0.5 + recent[1] * 0.3 + recent[0] * 0.2);
}

export function weakestSkill(skills: Record<SkillId, SkillSnapshot>): SkillId | null {
  const sampled = SKILL_IDS.filter((id) => skills[id].samples > 0 && skills[id].score !== null);
  if (sampled.length === 0) return null;
  sampled.sort((left, right) => {
    const delta = (skills[left].score ?? 100) - (skills[right].score ?? 100);
    if (delta !== 0) return delta;
    return TIE_ORDER.indexOf(left) - TIE_ORDER.indexOf(right);
  });
  return sampled[0] ?? null;
}

export function storytellingScore(input: {
  establishedIdentity: boolean;
  evidenceSupportedIdentity: boolean;
  clearThread: boolean;
  explainedDirection: boolean;
  resumeChronology: boolean;
  buriedEvidence: boolean;
  conversational: boolean;
}): number {
  const core = input.establishedIdentity && input.evidenceSupportedIdentity && input.clearThread && input.explainedDirection;
  if (input.resumeChronology || !input.establishedIdentity || !core) return 55;
  if (input.conversational && !input.buriedEvidence) return 85;
  return 70;
}

export function journeyFrom(input: {
  analyzedCount: number;
  storySaved: boolean;
  behavioralCount: number;
  starPracticed: boolean;
  roleSpecificCount: number;
  readiness: number | null;
}): Record<JourneyId, JourneyState> {
  const done: Record<JourneyId, boolean> = {
    fundamentals: input.analyzedCount >= 1,
    story: input.storySaved,
    behavioral: input.behavioralCount >= 1,
    star: input.starPracticed,
    role: input.roleSpecificCount >= 1,
    mocks: input.analyzedCount >= 2,
    ready: (input.readiness ?? 0) >= 80 && input.storySaved,
  };
  return {
    fundamentals: done.fundamentals ? "complete" : "available",
    story: done.story ? "complete" : "available",
    behavioral: done.behavioral ? "complete" : "available",
    star: done.star ? "complete" : "available",
    role: done.role ? "complete" : "available",
    mocks: done.mocks ? "complete" : "available",
    ready: done.ready ? "complete" : "available",
  };
}

export function highlightedStage(journey: Record<JourneyId, JourneyState>): JourneyId {
  return JOURNEY_IDS.find((id) => journey[id] !== "complete") ?? "ready";
}

export function buildDaily(input: {
  day: string;
  weakest: SkillId | null;
  storySaved: boolean;
  latestInterviewId: string;
  completed: boolean;
}): DailyPlan {
  const practiceHref = input.latestInterviewId ? `/interview/${input.latestInterviewId}/results` : "/interview/new";
  const storyHref = input.storySaved ? "/story-builder/practice" : "/story-builder";
  const focus = input.weakest;
  let primary: DailyMission;
  if (!input.latestInterviewId && !input.storySaved) {
    primary = {
      id: "start-story",
      title: "Build your story",
      detail: "A short story is enough to practice today. A full interview can wait.",
      href: "/story-builder",
    };
  } else if (focus === "storytelling" || (!input.latestInterviewId && input.storySaved)) {
    primary = {
      id: "story",
      title: input.storySaved ? "Practice your story" : "Build your story",
      detail: "Say who you are, what proves it, and where you want to go.",
      href: storyHref,
    };
  } else if (focus === "structure") {
    primary = {
      id: "structure",
      title: "Practice a structured answer",
      detail: "Your lightest skill is STAR structure. One answer is enough for today.",
      href: practiceHref,
    };
  } else if (focus === "specificity") {
    primary = {
      id: "specificity",
      title: "Practice a specific example",
      detail: "Your lightest skill is specific examples. Retell one moment with a clear action.",
      href: practiceHref,
    };
  } else if (focus === "conciseness") {
    primary = {
      id: "conciseness",
      title: "Tighten one answer",
      detail: "Your lightest skill is conciseness. Practice saying the point sooner.",
      href: practiceHref,
    };
  } else if (focus === "communication") {
    primary = {
      id: "communication",
      title: "Practice a clearer answer",
      detail: "Your lightest skill is communication. One clearer pass counts.",
      href: practiceHref,
    };
  } else if (input.latestInterviewId) {
    primary = {
      id: "weak",
      title: "Practice a weak answer",
      detail: "Work the skill your last interview scored lowest.",
      href: practiceHref,
    };
  } else {
    primary = {
      id: "mock",
      title: "Start a mock interview",
      detail: "One finished interview is enough to see where you stand.",
      href: "/interview/new",
    };
  }
  const options = [
    {
      id: "story-option",
      title: input.storySaved ? "Story practice" : "Build your story",
      detail: "A few spoken minutes keeps the day.",
      href: storyHref,
    },
    {
      id: "mock-option",
      title: "Full interview",
      detail: "Use this when you want a complete rep.",
      href: "/interview/new",
    },
  ].filter((option) => option.href !== primary.href);
  return {
    day: input.day,
    focusSkill: focus,
    primary,
    options,
    completed: input.completed,
  };
}

export function applyAward(state: ProgressState, input: AwardInput): AwardResult {
  if (!input.eventId || state.awarded[input.eventId]) {
    return { state, granted: false, xpGained: 0 };
  }
  const base = xpFor(input.kind);
  const improvement = input.kind === "mock" ? improvementBonus(state, input.scores) : 0;
  const xpGained = base + improvement;
  const day = isDay(input.day) ? input.day : localDay(input.now, state.timezone || "UTC");
  const streak = applyStreak(state, day);
  const skills = applyScores(state.skills, input.scores);
  const history =
    input.kind === "mock" && typeof input.readinessScore === "number"
      ? [...state.readinessHistory, clampScore(input.readinessScore)].slice(-3)
      : state.readinessHistory;
  const readiness = input.kind === "mock" ? readinessFromScores(history) : state.readiness;
  const analyzedCount = state.analyzedCount + (input.kind === "mock" ? 1 : 0);
  const behavioralCount =
    state.behavioralCount + (input.kind === "mock" && (input.interviewType === "behavioral" || input.interviewType === "mixed") ? 1 : 0);
  const roleSpecificCount = state.roleSpecificCount + (input.kind === "mock" && input.interviewType === "role-specific" ? 1 : 0);
  const storySaved = state.storySaved || input.kind === "story_first";
  const starPracticed = state.starPracticed || input.kind === "weak_practice";
  const leveled = levelForXp(state.xp + xpGained);
  const next: ProgressState = {
    ...state,
    ...streak,
    xp: state.xp + xpGained,
    level: leveled.level,
    levelTitle: leveled.title,
    skills,
    weakestSkill: weakestSkill(skills),
    readiness,
    readinessUpdatedAt: input.kind === "mock" ? input.now : state.readinessUpdatedAt,
    readinessHistory: history,
    analyzedCount,
    behavioralCount,
    roleSpecificCount,
    storySaved,
    starPracticed,
    latestInterviewId: input.kind === "mock" && input.interviewId ? input.interviewId : state.latestInterviewId,
    lastStoryAnswerHash: input.storyAnswerHash || state.lastStoryAnswerHash,
    journey: journeyFrom({
      analyzedCount,
      storySaved,
      behavioralCount,
      starPracticed,
      roleSpecificCount,
      readiness,
    }),
    awarded: { ...state.awarded, [input.eventId]: input.now },
    achievements: achievementsFor(state.achievements, {
      analyzedCount,
      storySaved,
      storytellingSamples: skills.storytelling.samples,
      starPracticed,
      streakCount: streak.streakCount,
      readiness,
      now: input.now,
    }),
    daily:
      state.daily && state.daily.day === day
        ? { ...state.daily, completed: true }
        : state.daily,
    updatedAt: input.now,
  };
  return { state: next, granted: true, xpGained };
}

export function refreshDaily(state: ProgressState, day: string): ProgressState {
  if (state.daily?.day === day) return state;
  return {
    ...state,
    daily: buildDaily({
      day,
      weakest: state.weakestSkill,
      storySaved: state.storySaved,
      latestInterviewId: state.latestInterviewId,
      completed: state.streakLastDay === day,
    }),
  };
}

export function visibleSkills(): SkillId[] {
  return DASHBOARD_SKILLS;
}

function xpFor(kind: AwardInput["kind"]): number {
  switch (kind) {
    case "practice":
      return XP.practice;
    case "story_practice":
      return XP.storyPractice;
    case "review":
      return XP.review;
    case "story_first":
      return XP.storyFirst;
    case "story_rewrite":
      return XP.storyRewrite;
    case "weak_practice":
      return XP.weakPractice;
    case "mock":
      return XP.mock;
    default:
      return 0;
  }
}

function improvementBonus(state: ProgressState, scores: AwardInput["scores"]): number {
  const weakest = weakestSkill(state.skills);
  if (!weakest || !scores || typeof scores[weakest] !== "number") return 0;
  const previous = state.skills[weakest];
  if (previous.samples < 1 || previous.score === null) return 0;
  return scores[weakest] >= previous.score + 8 ? XP.improvement : 0;
}

function applyScores(
  skills: Record<SkillId, SkillSnapshot>,
  scores: AwardInput["scores"],
): Record<SkillId, SkillSnapshot> {
  if (!scores) return skills;
  const next = { ...skills };
  for (const id of SKILL_IDS) {
    const score = scores[id];
    if (typeof score !== "number" || !Number.isFinite(score)) continue;
    next[id] = { score: clampScore(score), samples: skills[id].samples + 1 };
  }
  return next;
}

function applyStreak(state: ProgressState, day: string): Pick<ProgressState, "streakCount" | "streakLastDay" | "restDaysUsedWeek" | "restWeekKey"> {
  const week = weekKey(day);
  const restUsed = state.restWeekKey === week ? state.restDaysUsedWeek : 0;
  if (!state.streakLastDay) {
    return { streakCount: 1, streakLastDay: day, restDaysUsedWeek: restUsed, restWeekKey: week };
  }
  const gap = daysBetween(state.streakLastDay, day);
  if (gap <= 0) {
    return {
      streakCount: state.streakCount,
      streakLastDay: state.streakLastDay,
      restDaysUsedWeek: restUsed,
      restWeekKey: week,
    };
  }
  if (gap === 1) {
    return { streakCount: state.streakCount + 1, streakLastDay: day, restDaysUsedWeek: restUsed, restWeekKey: week };
  }
  if (gap === 2 && restUsed < 1) {
    return { streakCount: state.streakCount + 1, streakLastDay: day, restDaysUsedWeek: restUsed + 1, restWeekKey: week };
  }
  return { streakCount: 1, streakLastDay: day, restDaysUsedWeek: restUsed, restWeekKey: week };
}

function achievementsFor(
  current: Record<string, number>,
  input: {
    analyzedCount: number;
    storySaved: boolean;
    storytellingSamples: number;
    starPracticed: boolean;
    streakCount: number;
    readiness: number | null;
    now: number;
  },
): Record<string, number> {
  const next = { ...current };
  const earn = (id: string, when: boolean) => {
    if (when && !next[id]) next[id] = input.now;
  };
  earn("first_interview", input.analyzedCount >= 1);
  earn("first_story", input.storySaved);
  earn("first_story_spoken", input.storytellingSamples >= 1);
  earn("first_weak_retry", input.starPracticed);
  earn("streak_3", input.streakCount >= 3);
  earn("streak_7", input.streakCount >= 7);
  earn("readiness_solid", (input.readiness ?? 0) >= 65);
  return next;
}

export function newestAchievement(achievements: Record<string, number>): { id: string; label: string } | null {
  let bestId = "";
  let bestAt = 0;
  for (const [id, at] of Object.entries(achievements)) {
    if (at >= bestAt && ACHIEVEMENT_LABELS[id]) {
      bestId = id;
      bestAt = at;
    }
  }
  if (!bestId) return null;
  return { id: bestId, label: ACHIEVEMENT_LABELS[bestId] };
}

export function readinessText(score: number | null): string | null {
  if (score === null) return null;
  return readinessTitle(readinessLabel(score));
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function isDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function daysBetween(from: string, to: string): number {
  if (!isDay(from) || !isDay(to)) return 99;
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 99;
  return Math.round((end - start) / 86_400_000);
}

function weekKey(day: string): string {
  if (!isDay(day)) return "";
  const date = new Date(`${day}T00:00:00Z`);
  const weekday = date.getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  date.setUTCDate(date.getUTCDate() + mondayOffset);
  return date.toISOString().slice(0, 10);
}

export function spokenEnough(text: string): boolean {
  return text.trim().length >= 40;
}
