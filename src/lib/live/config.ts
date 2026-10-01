const DEFAULT_LIVE_MODEL = "gpt-live-1";
const DEFAULT_VOICE = "meridian";
const DEFAULT_PLAN_MODEL = "gpt-5.4";

export type LiveSessionSettings = {
  model: string;
  voice: string;
};

/**
 * The only place model identifiers are chosen.
 * Server-only: do not import this from client components.
 */
export function liveSessionSettings(): LiveSessionSettings {
  const model = process.env.OPENAI_LIVE_MODEL?.trim() || DEFAULT_LIVE_MODEL;
  const voice = process.env.OPENAI_LIVE_VOICE?.trim() || DEFAULT_VOICE;
  return { model, voice };
}

export function planModel(): string {
  return process.env.OPENAI_PLAN_MODEL?.trim() || DEFAULT_PLAN_MODEL;
}

export function analysisModel(): string {
  return process.env.OPENAI_ANALYSIS_MODEL?.trim() || DEFAULT_PLAN_MODEL;
}

export function coachingModel(): string {
  return process.env.OPENAI_COACHING_MODEL?.trim() || planModel();
}

const DEFAULT_PROFILE_TTL_DAYS = 45;

export function companyProfileTtlMs(): number {
  const parsed = Number(process.env.COMPANY_PROFILE_TTL_DAYS);
  const days = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PROFILE_TTL_DAYS;
  return days * 24 * 60 * 60 * 1000;
}
