import { getStore } from "@netlify/blobs";

import type { PracticeFocus } from "@/lib/interview/practice-types";
import type { InterviewBlueprint, InterviewConfig, PreparationDebug } from "@/lib/interview/types";

export type StoredInterview = {
  id: string;
  createdAt: number;
  resumeFileName: string;
  config: InterviewConfig;
  blueprint: InterviewBlueprint;
  debug: PreparationDebug;
  practice?: PracticeFocus;
};

const TTL_MS = 6 * 60 * 60 * 1000;
const MAX_INTERVIEWS = 100;
const BLOB_STORE = "interviews";

type StoreGlobal = typeof globalThis & {
  __interviewStore?: Map<string, StoredInterview>;
};

function memory(): Map<string, StoredInterview> {
  const root = globalThis as StoreGlobal;
  if (!root.__interviewStore) root.__interviewStore = new Map();
  return root.__interviewStore;
}

function prune(interviews: Map<string, StoredInterview>): void {
  const cutoff = Date.now() - TTL_MS;
  for (const [id, interview] of interviews) {
    if (interview.createdAt < cutoff) interviews.delete(id);
  }
  while (interviews.size > MAX_INTERVIEWS) {
    const oldest = interviews.keys().next().value;
    if (!oldest) break;
    interviews.delete(oldest);
  }
}

function onNetlify(): boolean {
  const env = process.env;
  return env["NETLIFY"] === "true" || Boolean(env["NETLIFY_BLOBS_CONTEXT"]);
}

function isStoredInterview(value: unknown): value is StoredInterview {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<StoredInterview>;
  return (
    typeof record.id === "string" &&
    typeof record.createdAt === "number" &&
    Boolean(record.config) &&
    Boolean(record.blueprint)
  );
}

function expired(interview: StoredInterview): boolean {
  return Date.now() - interview.createdAt > TTL_MS;
}

export async function saveInterview(interview: StoredInterview): Promise<void> {
  if (!onNetlify()) {
    const interviews = memory();
    prune(interviews);
    interviews.set(interview.id, interview);
    return;
  }
  const store = getStore(BLOB_STORE);
  await store.setJSON(interview.id, interview);
}

export async function getInterview(id: string): Promise<StoredInterview | null> {
  if (!onNetlify()) {
    const interviews = memory();
    prune(interviews);
    return interviews.get(id) ?? null;
  }
  const store = getStore(BLOB_STORE);
  const stored = await store.get(id, { type: "json", consistency: "strong" });
  if (!isStoredInterview(stored)) return null;
  if (expired(stored)) {
    await store.delete(id);
    return null;
  }
  return stored;
}
