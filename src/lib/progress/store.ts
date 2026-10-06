import type { InterviewAnalysis } from "@/lib/interview/analysis-types";
import { getAdminApp } from "@/lib/firebase/admin";
import {
  applyAward,
  emptyProgress,
  journeyFrom,
  levelForXp,
  localDay,
  refreshDaily,
  safeTimeZone,
  storytellingScore,
  weakestSkill,
} from "@/lib/progress/award";
import { presentProgress } from "@/lib/progress/view";
import type { AwardInput, AwardKind, ProgressState, ProgressView, SkillId } from "@/lib/progress/types";

const MAIN = "main";

async function database() {
  const { getFirestore } = await import("firebase-admin/firestore");
  return getFirestore(await getAdminApp());
}

function refFor(db: Awaited<ReturnType<typeof database>>, uid: string) {
  return db.doc(`users/${uid}/progress/${MAIN}`);
}

export async function readProgress(uid: string): Promise<ProgressState> {
  const db = await database();
  const snap = await refFor(db, uid).get();
  if (!snap.exists) return emptyProgress(Date.now());
  return progressFrom(snap.data() ?? {});
}

export async function progressView(uid: string, timezone: string): Promise<ProgressView> {
  const db = await database();
  const ref = refFor(db, uid);
  const now = Date.now();
  const snap = await ref.get();
  let state = snap.exists ? progressFrom(snap.data() ?? {}) : emptyProgress(now);
  const storedZone = state.timezone;
  if (!storedZone && timezone.trim()) state = { ...state, timezone: safeTimeZone(timezone) };
  const day = localDay(now, state.timezone || "UTC");
  const previousDay = state.daily?.day ?? "";
  const refreshed = refreshDaily(state, day);
  if (!snap.exists || refreshed.daily?.day !== previousDay || refreshed.timezone !== storedZone) {
    await ref.set(progressTo(refreshed));
  }
  return presentProgress(refreshed, day);
}

export async function award(uid: string, input: Omit<AwardInput, "day" | "now"> & { day?: string; now?: number }): Promise<boolean> {
  const db = await database();
  const ref = refFor(db, uid);
  const now = input.now ?? Date.now();
  let granted = false;
  await db.runTransaction(async (tx) => {
    granted = false;
    const snap = await tx.get(ref);
    const current = snap.exists ? progressFrom(snap.data() ?? {}) : emptyProgress(now);
    const day = input.day || localDay(now, current.timezone || "UTC");
    const result = applyAward(current, { ...input, day, now });
    if (!result.granted) return;
    granted = true;
    tx.set(ref, progressTo(result.state));
    if (input.scores && Object.keys(input.scores).length > 0) {
      tx.set(ref.collection("samples").doc(), {
        at: now,
        sourceId: input.eventId,
        source: input.kind,
        scores: input.scores,
      });
    }
  });
  return granted;
}

export async function awardAnalyzedInterview(uid: string, interviewId: string, analysis: InterviewAnalysis, interviewType: string): Promise<void> {
  const scores: Partial<Record<SkillId, number>> = {
    communication: analysis.categoryScores.communication.score,
    specificity: analysis.categoryScores.specificity.score,
    structure: analysis.categoryScores.structure.score,
    conciseness: analysis.categoryScores.conciseness.score,
    businessImpact: analysis.categoryScores.businessImpact.score,
    roleAlignment: analysis.categoryScores.roleAlignment.score,
  };
  await award(uid, {
    eventId: `interview:${interviewId}:analyzed`,
    kind: "mock",
    scores,
    readinessScore: analysis.overallReadiness,
    interviewType,
    interviewId,
  });
}

export async function awardPracticeSession(uid: string, interviewId: string, kind: AwardKind): Promise<void> {
  await award(uid, { eventId: `practice:${interviewId}:complete`, kind });
}

export async function awardReview(uid: string, interviewId: string): Promise<void> {
  await award(uid, { eventId: `interview:${interviewId}:reviewed`, kind: "review" });
}

export async function awardStorySave(uid: string, answer: string): Promise<void> {
  const hash = hashText(answer);
  const state = await readProgress(uid);
  const now = Date.now();
  const day = localDay(now, state.timezone || "UTC");
  if (!state.awarded["story:saved"]) {
    await award(uid, { eventId: "story:saved", kind: "story_first", storyAnswerHash: hash, now, day });
    return;
  }
  if (!hash || hash === state.lastStoryAnswerHash) return;
  await award(uid, { eventId: `story:rewrite:${day}`, kind: "story_rewrite", storyAnswerHash: hash, now, day });
}

export async function awardStoryPractice(
  uid: string,
  spoken: string,
  feedback: {
    establishedIdentity: boolean;
    evidenceSupportedIdentity: boolean;
    clearThread: boolean;
    explainedDirection: boolean;
    resumeChronology: boolean;
    buriedEvidence: boolean;
    conversational: boolean;
  },
): Promise<void> {
  const score = storytellingScore(feedback);
  await award(uid, {
    eventId: `story:spoken:${hashText(spoken)}`,
    kind: "story_practice",
    scores: { storytelling: score },
  });
}

function hashText(value: string): string {
  let hash = 0;
  const text = value.trim();
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 33 + text.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16);
}

function progressTo(state: ProgressState): Record<string, unknown> {
  return { ...state };
}

function progressFrom(data: Record<string, unknown>): ProgressState {
  const base = emptyProgress(typeof data.updatedAt === "number" ? data.updatedAt : Date.now());
  const skills = { ...base.skills };
  const rawSkills = data.skills;
  if (rawSkills && typeof rawSkills === "object") {
    for (const id of Object.keys(skills) as SkillId[]) {
      const item = (rawSkills as Record<string, unknown>)[id];
      if (!item || typeof item !== "object") continue;
      const score = (item as { score?: unknown }).score;
      const samples = (item as { samples?: unknown }).samples;
      skills[id] = {
        score: typeof score === "number" && Number.isFinite(score) ? score : null,
        samples: typeof samples === "number" && samples > 0 ? samples : 0,
      };
    }
  }
  const state: ProgressState = {
    ...base,
    xp: numberOr(data.xp, 0),
    level: numberOr(data.level, base.level),
    levelTitle: stringOr(data.levelTitle, base.levelTitle),
    streakCount: numberOr(data.streakCount, 0),
    streakLastDay: stringOr(data.streakLastDay, ""),
    restDaysUsedWeek: numberOr(data.restDaysUsedWeek, 0),
    restWeekKey: stringOr(data.restWeekKey, ""),
    timezone: stringOr(data.timezone, ""),
    readiness: typeof data.readiness === "number" ? data.readiness : null,
    readinessUpdatedAt: typeof data.readinessUpdatedAt === "number" ? data.readinessUpdatedAt : null,
    readinessHistory: numberList(data.readinessHistory).slice(-3),
    skills,
    weakestSkill: null,
    journey: base.journey,
    achievements: numberMap(data.achievements),
    awarded: numberMap(data.awarded),
    daily: isDaily(data.daily) ? data.daily : null,
    analyzedCount: numberOr(data.analyzedCount, 0),
    behavioralCount: numberOr(data.behavioralCount, 0),
    roleSpecificCount: numberOr(data.roleSpecificCount, 0),
    storySaved: data.storySaved === true,
    starPracticed: data.starPracticed === true,
    latestInterviewId: stringOr(data.latestInterviewId, ""),
    lastStoryAnswerHash: stringOr(data.lastStoryAnswerHash, ""),
    updatedAt: numberOr(data.updatedAt, base.updatedAt),
  };
  const leveled = levelForXp(state.xp);
  state.level = leveled.level;
  state.levelTitle = leveled.title;
  state.weakestSkill = weakestSkill(state.skills);
  state.journey = journeyFrom(state);
  return state;
}

function isDaily(value: unknown): value is ProgressState["daily"] & object {
  if (!value || typeof value !== "object") return false;
  const daily = value as { day?: unknown; primary?: unknown; options?: unknown; completed?: unknown };
  return typeof daily.day === "string" && daily.primary !== null && typeof daily.primary === "object" && Array.isArray(daily.options);
}

function numberMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  const next: Record<string, number> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "number" && Number.isFinite(item)) next[key] = item;
  }
  return next;
}

function numberList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is number => typeof item === "number" && Number.isFinite(item));
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}
