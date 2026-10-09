export const BILLING_LAUNCH_AT = Date.parse("2026-10-07T00:00:00.000Z");
export const RESERVATION_TTL_MS = 3 * 60 * 1000;
export const RECONNECT_WINDOW_MS = 3 * 60 * 1000;
export const QUICK_MINUTES = 10;
export const FULL_MINUTES = 30;
export const PRACTICE_MAX_MINUTES = 10;
export const QUICK_CEILING_MINUTES = 13;
export const FULL_CEILING_MINUTES = 35;
export const STORY_TARGET_MINUTES = 5;
export const WEAK_ANSWER_TARGET_MINUTES = 10;

export const products = {
  quickPractice: {
    id: "quick_practice",
    displayName: "Quick Practice",
    priceCents: 0,
    currency: "usd",
    recurring: false,
    targetMinutes: QUICK_MINUTES,
    maxMinutes: QUICK_MINUTES,
    analysisTier: "basic",
    grants: { lifetimeQuick: 1 },
  },
  fullInterview: {
    id: "full_interview",
    displayName: "Full interview",
    priceCents: 899,
    currency: "usd",
    recurring: false,
    targetMinutes: FULL_MINUTES,
    maxMinutes: FULL_MINUTES,
    analysisTier: "full",
    grants: { purchasedCredits: 1 },
  },
  plus: {
    id: "plus",
    displayName: "InterviewAI Plus",
    priceCents: 1499,
    currency: "usd",
    recurring: true,
    interval: "month",
    grants: { mockCredits: 3, practiceSessions: 3 },
  },
  extraCredit: {
    id: "extra_credit",
    displayName: "Extra interview",
    priceCents: 599,
    currency: "usd",
    recurring: false,
    grants: { purchasedCredits: 1 },
    availableTo: "plus",
  },
} as const;

export function launchMinutes(value: number): 10 | 30 | null {
  if (value === QUICK_MINUTES) return 10;
  if (value === FULL_MINUTES) return 30;
  return null;
}

export function connectedLimitMs(ceilingMinutes: number): number {
  return Math.round(ceilingMinutes * 60 * 1000);
}

export function safetyCeilingMinutes(session: { sessionClass: "quick_practice" | "full_mock" | "voice_practice" }): number {
  if (session.sessionClass === "quick_practice") return QUICK_CEILING_MINUTES;
  if (session.sessionClass === "full_mock") return FULL_CEILING_MINUTES;
  return PRACTICE_MAX_MINUTES;
}
