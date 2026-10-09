/** Production always enforces billing. A bypass variable is ignored when NODE_ENV is production. */
export function billingBypassEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV === "production") return false;
  return env.DEV_BILLING_BYPASS === "1";
}

/** Development-only switch used to prove a failed live.create releases the hold. Production ignores it. */
export function liveCreateShouldFail(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV === "production") return false;
  return env.DEV_LIVE_CREATE_FAIL === "1";
}
