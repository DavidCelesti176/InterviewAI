const DEFAULT_LIVE_MODEL = "gpt-live-1";
const DEFAULT_VOICE = "gleam";

const interviewerVoices = {
  claire: { name: "Claire", voice: "gleam" },
  james: { name: "James", voice: "meridian" },
} as const;
const DEFAULT_PLAN_MODEL = "gpt-5.4";
const DEFAULT_ANALYSIS_MODEL = "gpt-5.4-mini";

export type LiveSessionSettings = {
  model: string;
  voice: string;
};

/**
 * The only place model identifiers are chosen.
 * Server-only: do not import this from client components.
 */
export function liveSessionSettings(interviewerId?: string): LiveSessionSettings {
  const model = process.env.OPENAI_LIVE_MODEL?.trim() || DEFAULT_LIVE_MODEL;
  const known = interviewerId && interviewerId in interviewerVoices ? interviewerVoices[interviewerId as keyof typeof interviewerVoices] : null;
  const voice = known?.voice || process.env.OPENAI_LIVE_VOICE?.trim() || DEFAULT_VOICE;
  return { model, voice };
}

export function interviewerName(interviewerId?: string): string {
  if (interviewerId && interviewerId in interviewerVoices) {
    return interviewerVoices[interviewerId as keyof typeof interviewerVoices].name;
  }
  return interviewerVoices.claire.name;
}

export function planModel(): string {
  return process.env.OPENAI_PLAN_MODEL?.trim() || DEFAULT_PLAN_MODEL;
}

/** gpt-5.4 accepts none, low, medium, high, and xhigh. None keeps each step inside the platform cutoff. */
export const planReasoning = { effort: "none" as const };
export const planRequestTimeoutMs = 20_000;

export function analysisModel(): string {
  return process.env.OPENAI_ANALYSIS_MODEL?.trim() || DEFAULT_ANALYSIS_MODEL;
}

export function coachingModel(): string {
  return process.env.OPENAI_COACHING_MODEL?.trim() || planModel();
}

/** Story Builder reasoning. Defaults to the plan model and stays overrideable. */
export function storyModel(): string {
  return process.env.OPENAI_STORY_MODEL?.trim() || planModel();
}

const DEFAULT_PROFILE_TTL_DAYS = 45;

export function companyProfileTtlMs(): number {
  const parsed = Number(process.env.COMPANY_PROFILE_TTL_DAYS);
  const days = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PROFILE_TTL_DAYS;
  return days * 24 * 60 * 60 * 1000;
}
