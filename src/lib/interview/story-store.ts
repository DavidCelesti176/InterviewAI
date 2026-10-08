import { getAdminApp } from "@/lib/firebase/admin";
import { canAddStory, parseStoryWrite, storyConfidence, type InterviewStory, type StoryDraft } from "@/lib/interview/stories";

const storyIdPattern = /^[A-Za-z0-9_-]{8,80}$/;

export function isStoryId(value: string): boolean {
  return storyIdPattern.test(value);
}

async function database() {
  const { getFirestore } = await import("firebase-admin/firestore");
  return getFirestore(await getAdminApp());
}

function collection(uid: string, db: Awaited<ReturnType<typeof database>>) {
  return db.collection(`users/${uid}/interviewStories`);
}

export async function listInterviewStories(uid: string): Promise<InterviewStory[]> {
  const snap = await collection(uid, await database()).get();
  return snap.docs
    .map((doc) => storyFrom(doc.id, doc.data()))
    .filter((story): story is InterviewStory => story !== null)
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

export async function createInterviewStory(uid: string, body: unknown): Promise<InterviewStory | { error: string; status: number }> {
  const parsed = parseStoryWrite(body);
  if (!parsed.ok) return { error: parsed.error, status: 400 };
  const db = await database();
  const id = crypto.randomUUID();
  const now = Date.now();
  try {
    await db.runTransaction(async (tx) => {
      const existing = await tx.get(collection(uid, db));
      if (!canAddStory(existing.size)) throw new Error("STORY_LIMIT");
      tx.set(collection(uid, db).doc(id), written(parsed.draft, now, now));
    });
  } catch (error) {
    if (error instanceof Error && error.message === "STORY_LIMIT") {
      return { error: "You can save up to 6 stories.", status: 409 };
    }
    throw error;
  }
  return { storyId: id, ...parsed.draft, confidence: storyConfidence(parsed.draft), createdAt: now, updatedAt: now };
}

export async function updateInterviewStory(
  uid: string,
  storyId: string,
  body: unknown,
): Promise<InterviewStory | { error: string; status: number }> {
  if (!isStoryId(storyId)) return { error: "This story could not be found.", status: 404 };
  const parsed = parseStoryWrite(body);
  if (!parsed.ok) return { error: parsed.error, status: 400 };
  const db = await database();
  const ref = collection(uid, db).doc(storyId);
  const now = Date.now();
  const updated = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const createdAt = typeof snap.get("createdAt") === "number" ? snap.get("createdAt") : now;
    tx.set(ref, written(parsed.draft, createdAt, now));
    return { storyId, ...parsed.draft, confidence: storyConfidence(parsed.draft), createdAt, updatedAt: now };
  });
  if (!updated) return { error: "This story could not be found.", status: 404 };
  return updated;
}

export async function deleteInterviewStory(uid: string, storyId: string): Promise<{ error: string; status: number } | { ok: true }> {
  if (!isStoryId(storyId)) return { error: "This story could not be found.", status: 404 };
  const db = await database();
  const ref = collection(uid, db).doc(storyId);
  const removed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    tx.delete(ref);
    return true;
  });
  if (!removed) return { error: "This story could not be found.", status: 404 };
  return { ok: true };
}

function written(draft: StoryDraft, createdAt: number, updatedAt: number) {
  return {
    title: draft.title,
    sourceExperience: draft.sourceExperience,
    situation: draft.situation,
    task: draft.task,
    action: draft.action,
    result: draft.result,
    learning: draft.learning,
    competencies: draft.competencies,
    evidenceGrounding: draft.evidenceGrounding,
    confidence: storyConfidence(draft),
    createdAt,
    updatedAt,
  };
}

function storyFrom(storyId: string, value: unknown): InterviewStory | null {
  if (!isStoryId(storyId)) return null;
  const parsed = parseStoryWrite(value);
  if (!parsed.ok || !value || typeof value !== "object") return null;
  const record = value as { createdAt?: unknown; updatedAt?: unknown };
  const createdAt = typeof record.createdAt === "number" ? record.createdAt : 0;
  const updatedAt = typeof record.updatedAt === "number" ? record.updatedAt : createdAt;
  return { storyId, ...parsed.draft, confidence: storyConfidence(parsed.draft), createdAt, updatedAt };
}
