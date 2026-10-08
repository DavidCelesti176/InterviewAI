import { competencyById, isCompetencyId, type CompetencyId } from "@/lib/interview/competencies";

export const MAX_INTERVIEW_STORIES = 6;

export type StoryReadiness = "ready" | "needs_detail" | "needs_result" | "needs_learning" | "needs_a_story";

export type EvidenceSource = "resume" | "professional_story" | "transcript" | "user";

export type InterviewStory = {
  storyId: string;
  title: string;
  sourceExperience: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  learning: string;
  competencies: CompetencyId[];
  evidenceGrounding: Array<{ source: EvidenceSource; quote: string }>;
  confidence: "low" | "medium" | "high";
  createdAt: number;
  updatedAt: number;
};

export type StoryDraft = Omit<InterviewStory, "storyId" | "confidence" | "createdAt" | "updatedAt">;

const readinessRank: Record<StoryReadiness, number> = {
  ready: 0,
  needs_learning: 1,
  needs_result: 2,
  needs_detail: 3,
  needs_a_story: 4,
};

export function readinessLabel(state: StoryReadiness): string {
  if (state === "ready") return "Ready";
  if (state === "needs_detail") return "Needs detail";
  if (state === "needs_result") return "Needs result";
  if (state === "needs_learning") return "Needs learning";
  return "Needs a story";
}

export function canAddStory(count: number): boolean {
  return count < MAX_INTERVIEW_STORIES;
}

export function storyConfidence(draft: Pick<StoryDraft, "action" | "result" | "learning">): InterviewStory["confidence"] {
  if (!draft.action.trim() || (!draft.result.trim() && !draft.learning.trim())) return "low";
  if (!draft.result.trim() || !draft.learning.trim()) return "medium";
  return "high";
}

export function readinessFor(stories: InterviewStory[], competencyId: string): StoryReadiness {
  const states = stories
    .map((story) => storyState(story, competencyId))
    .filter((state): state is StoryReadiness => state !== null);
  if (states.length === 0) return "needs_a_story";
  return states.sort((left, right) => readinessRank[left] - readinessRank[right])[0] ?? "needs_a_story";
}

export function assignStories(
  stories: InterviewStory[],
  competencyIds: string[],
): Array<{ competencyId: string; storyId: string | null; readiness: StoryReadiness }> {
  const used = new Map<string, number>();
  return competencyIds.map((competencyId) => {
    const options = stories
      .flatMap((story) => {
        const state = storyState(story, competencyId);
        return state ? [{ story, state }] : [];
      })
      .sort((left, right) => readinessRank[left.state] - readinessRank[right.state] || (used.get(left.story.storyId) ?? 0) - (used.get(right.story.storyId) ?? 0));
    const chosen = options.find((item) => (used.get(item.story.storyId) ?? 0) < 2) ?? options[0];
    if (!chosen) return { competencyId, storyId: null, readiness: "needs_a_story" };
    used.set(chosen.story.storyId, (used.get(chosen.story.storyId) ?? 0) + 1);
    return { competencyId, storyId: chosen.story.storyId, readiness: chosen.state };
  });
}

export function parseStoryWrite(body: unknown): { ok: true; draft: StoryDraft } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "This story could not be saved." };
  const record = body as Record<string, unknown>;
  if ("uid" in record || "userId" in record) return { ok: false, error: "This story could not be saved." };
  const title = clip(record.title, 80);
  if (!title) return { ok: false, error: "Add a short title." };
  const competencies = competencyIds(record.competencies);
  if (!competencies) return { ok: false, error: "Choose a competency from the list." };
  const evidence = evidenceOf(record.evidenceGrounding);
  if (!evidence) return { ok: false, error: "A source note is not in the right shape." };
  return {
    ok: true,
    draft: {
      title,
      sourceExperience: clip(record.sourceExperience, 120),
      situation: clip(record.situation, 600),
      task: clip(record.task, 600),
      action: clip(record.action, 600),
      result: clip(record.result, 600),
      learning: clip(record.learning, 600),
      competencies,
      evidenceGrounding: evidence,
    },
  };
}

export function storiesForAnalysis(stories: InterviewStory[]): string {
  return stories
    .map((story) => `${story.title}: ${[story.situation, story.task, story.action, story.result, story.learning].filter(Boolean).join(" ")}`)
    .join("\n");
}

export function prepChecklist(input: {
  companyResearched: boolean;
  roleUnderstood: boolean;
  resumeReviewed: boolean;
  tellMeAboutYourself: boolean;
  storyCount: number;
}): Array<{ id: string; label: string; done: boolean }> {
  return [
    { id: "company", label: "Company research is in the plan", done: input.companyResearched },
    { id: "role", label: "Role plan is ready", done: input.roleUnderstood },
    { id: "resume", label: "Resume is attached", done: input.resumeReviewed },
    { id: "opening", label: "A short tell-me-about-yourself is saved", done: input.tellMeAboutYourself },
    { id: "stories", label: "3 to 6 interview stories are saved", done: input.storyCount >= 3 && input.storyCount <= MAX_INTERVIEW_STORIES },
  ];
}

function storyState(story: InterviewStory, competencyId: string): StoryReadiness | null {
  if (!story.competencies.includes(competencyId as CompetencyId)) return null;
  const competency = competencyById(competencyId);
  if (!story.situation.trim() || !story.task.trim() || !story.action.trim()) return "needs_detail";
  if (competency?.learningApplies && !story.learning.trim()) return "needs_learning";
  if (!story.result.trim() && !competency?.learningApplies) return "needs_result";
  return "ready";
}

function clip(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function competencyIds(value: unknown): CompetencyId[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 4) return null;
  const ids: CompetencyId[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !isCompetencyId(item) || ids.includes(item)) return null;
    ids.push(item);
  }
  return ids;
}

function evidenceOf(value: unknown): StoryDraft["evidenceGrounding"] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 4) return null;
  const sources = new Set<EvidenceSource>(["resume", "professional_story", "transcript", "user"]);
  const notes = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const source = (item as { source?: unknown }).source;
    const quote = clip((item as { quote?: unknown }).quote, 200);
    if (typeof source !== "string" || !sources.has(source as EvidenceSource) || !quote) return null;
    notes.push({ source: source as EvidenceSource, quote });
  }
  return notes;
}
