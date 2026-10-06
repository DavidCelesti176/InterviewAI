import { getFirestore, type CollectionReference, type DocumentData, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

import type { InterviewCard, InterviewStatusName, ResumeCard, UserProfile } from "@/lib/account/types";
import type { InterviewAnalysis } from "@/lib/interview/analysis-types";
import type { SavedInterviewResult } from "@/lib/interview/browser-state";
import type { InterviewAssistanceEvent, InterviewPauseEvent } from "@/lib/interview/help-types";
import type { StoredInterview } from "@/lib/interview/store";
import type { DurationChoice, InterviewTurn } from "@/lib/interview/types";
import { getAdminApp } from "@/lib/firebase/admin";

const STATUSES = new Set<InterviewStatusName>([
  "draft",
  "preparing",
  "ready",
  "in_progress",
  "analyzing",
  "complete",
  "failed",
]);

function database(): Firestore {
  return getFirestore(getAdminApp());
}

function interviewRef(uid: string, interviewId: string) {
  return database().doc(`users/${uid}/interviews/${interviewId}`);
}

function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function text(value: unknown, max = 200): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function statusOf(value: unknown): InterviewStatusName {
  return typeof value === "string" && STATUSES.has(value as InterviewStatusName) ? (value as InterviewStatusName) : "draft";
}

export function isRecordId(value: string): boolean {
  return /^[A-Za-z0-9_-]{8,80}$/.test(value);
}

function isStoredInterview(value: unknown): value is StoredInterview {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<StoredInterview>;
  return typeof record.id === "string" && typeof record.createdAt === "number" && Boolean(record.config) && Boolean(record.blueprint);
}

export async function saveUserProfile(
  user: { uid: string; email: string },
  input: { firstName: string; lastName: string },
): Promise<UserProfile> {
  const ref = database().doc(`users/${user.uid}`);
  const existing = await ref.get();
  const now = Date.now();
  const firstName = input.firstName.trim().slice(0, 40);
  const lastName = input.lastName.trim().slice(0, 40);
  const profile: UserProfile = {
    uid: user.uid,
    email: user.email,
    firstName,
    lastName,
    displayName: `${firstName} ${lastName}`.trim(),
    createdAt: existing.exists && typeof existing.get("createdAt") === "number" ? existing.get("createdAt") : now,
    updatedAt: now,
  };
  await ref.set(profile, { merge: true });
  return profile;
}

export async function readUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await database().doc(`users/${uid}`).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  if (typeof data.firstName !== "string" || typeof data.email !== "string") return null;
  return {
    uid,
    email: data.email,
    firstName: data.firstName,
    lastName: typeof data.lastName === "string" ? data.lastName : "",
    displayName: typeof data.displayName === "string" ? data.displayName : data.firstName,
    createdAt: num(data.createdAt) ?? Date.now(),
    updatedAt: num(data.updatedAt) ?? Date.now(),
  };
}

export async function createPreparingInterview(input: {
  uid: string;
  interviewId: string;
  resumeId: string;
  resumeFileName: string;
  durationChoice: DurationChoice;
  config: StoredInterview["config"];
}): Promise<void> {
  const now = Date.now();
  await interviewRef(input.uid, input.interviewId).set({
    userId: input.uid,
    company: input.config.company,
    jobTitle: input.config.jobTitle,
    jobDescription: input.config.jobDescription,
    interviewType: input.config.interviewType,
    interviewMode: input.config.interviewMode,
    interviewerProfileId: "claire",
    targetDurationMinutes: input.config.targetDurationMinutes,
    durationChoice: input.durationChoice,
    status: "preparing",
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    completedAt: null,
    activeDurationSeconds: 0,
    elapsedMs: 0,
    resumeId: input.resumeId,
    resumeFileName: input.resumeFileName,
    overallReadiness: null,
    analysisStatus: "pending",
    sessionKind: "interview",
    config: plain(input.config),
    assistance: [],
    pauses: [],
  });
}

export async function saveInterview(
  uid: string,
  interview: StoredInterview,
  extra?: {
    status?: InterviewStatusName;
    resumeId?: string | null;
    durationChoice?: string;
    levelLabel?: string;
    emphasisLabel?: string;
    interviewerProfileId?: string;
  },
): Promise<void> {
  const ref = interviewRef(uid, interview.id);
  const existing = await ref.get();
  const now = Date.now();
  const previous = existing.data() ?? {};
  await ref.set(
    {
      userId: uid,
      company: interview.config.company,
      jobTitle: interview.config.jobTitle,
      jobDescription: interview.config.jobDescription,
      interviewType: interview.config.interviewType,
      interviewMode: interview.config.interviewMode,
      interviewerProfileId: extra?.interviewerProfileId || text(previous.interviewerProfileId, 40) || "claire",
      targetDurationMinutes: interview.config.targetDurationMinutes,
      durationChoice: extra?.durationChoice || text(previous.durationChoice, 20) || "30",
      status: extra?.status ?? (existing.exists ? statusOf(previous.status) : "ready"),
      createdAt: num(previous.createdAt) ?? interview.createdAt,
      updatedAt: now,
      startedAt: previous.startedAt ?? null,
      completedAt: previous.completedAt ?? null,
      activeDurationSeconds: num(previous.activeDurationSeconds) ?? 0,
      elapsedMs: num(previous.elapsedMs) ?? 0,
      resumeId: extra?.resumeId ?? (typeof previous.resumeId === "string" ? previous.resumeId : null),
      resumeFileName: interview.resumeFileName,
      overallReadiness: num(previous.overallReadiness),
      analysisStatus: text(previous.analysisStatus, 40) || "pending",
      sessionKind: interview.practice ? "practice" : "interview",
      levelLabel: extra?.levelLabel || text(previous.levelLabel, 80),
      emphasisLabel: extra?.emphasisLabel || text(previous.emphasisLabel, 80),
      companyProfileSummary: interview.debug?.companyProfile?.summary ?? text(previous.companyProfileSummary, 2000),
      record: plain(interview),
    },
    { merge: true },
  );
}

export async function getInterview(uid: string, id: string): Promise<StoredInterview | null> {
  if (!isRecordId(id)) return null;
  const snap = await interviewRef(uid, id).get();
  if (!snap.exists) return null;
  const record = snap.get("record");
  return isStoredInterview(record) ? record : null;
}

export async function markInterviewStarted(uid: string, interviewId: string, interviewerId: string): Promise<void> {
  if (!isRecordId(interviewId)) return;
  const ref = interviewRef(uid, interviewId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const now = Date.now();
  await ref.set(
    {
      status: "in_progress",
      updatedAt: now,
      startedAt: num(snap.get("startedAt")) ?? now,
      interviewerProfileId: interviewerId || text(snap.get("interviewerProfileId"), 40) || "claire",
    },
    { merge: true },
  );
}

export async function setInterviewer(uid: string, interviewId: string, interviewerProfileId: string): Promise<boolean> {
  if (!isRecordId(interviewId)) return false;
  const ref = interviewRef(uid, interviewId);
  const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.set({ interviewerProfileId, updatedAt: Date.now() }, { merge: true });
  return true;
}

export async function listInterviews(uid: string): Promise<InterviewCard[]> {
  const snap = await database().collection(`users/${uid}/interviews`).orderBy("createdAt", "desc").limit(30).get();
  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      company: text(data.company, 200) || "Interview",
      jobTitle: text(data.jobTitle, 200),
      interviewMode: text(data.interviewMode, 40) || "mock",
      sessionKind: data.sessionKind === "practice" ? "practice" : "interview",
      status: statusOf(data.status),
      createdAt: num(data.createdAt) ?? 0,
      updatedAt: num(data.updatedAt) ?? 0,
      completedAt: num(data.completedAt),
      activeDurationSeconds: num(data.activeDurationSeconds) ?? 0,
      overallReadiness: num(data.overallReadiness),
      resumeFileName: text(data.resumeFileName, 180),
      interviewerProfileId: text(data.interviewerProfileId, 40) || "claire",
    };
  });
}

export async function readInterviewResult(uid: string, interviewId: string): Promise<SavedInterviewResult | null> {
  if (!isRecordId(interviewId)) return null;
  const snap = await interviewRef(uid, interviewId).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  const turns = await readTurns(uid, interviewId);
  const analysis = await readAnalysis(uid, interviewId);
  const setup = setupFrom(interviewId, data);
  if (!setup) return null;
  return {
    setup,
    elapsedMs: num(data.elapsedMs) ?? (num(data.activeDurationSeconds) ?? 0) * 1000,
    turns,
    pauses: readPauses(data.pauses),
    assistance: readAssistance(data.assistance),
    analysis: analysis ?? undefined,
  };
}

function setupFrom(interviewId: string, data: DocumentData): SavedInterviewResult["setup"] | null {
  const company = text(data.company, 200);
  const jobTitle = text(data.jobTitle, 200);
  if (!company || !jobTitle) return null;
  const interviewType = data.interviewType;
  const durationChoice = data.durationChoice;
  return {
    interviewId,
    company,
    jobTitle,
    interviewType:
      interviewType === "mixed" ||
      interviewType === "hiring-manager" ||
      interviewType === "behavioral" ||
      interviewType === "recruiter" ||
      interviewType === "role-specific"
        ? interviewType
        : "mixed",
    interviewMode: data.interviewMode === "practice" ? "practice" : "mock",
    targetDurationMinutes: num(data.targetDurationMinutes) ?? 30,
    durationChoice:
      durationChoice === "15" || durationChoice === "30" || durationChoice === "45" || durationChoice === "unsure"
        ? durationChoice
        : "30",
    resumeFileName: text(data.resumeFileName, 180),
    levelLabel: text(data.levelLabel, 80) || undefined,
    emphasisLabel: text(data.emphasisLabel, 80) || undefined,
    interviewerProfileId: text(data.interviewerProfileId, 40) || "claire",
  };
}

async function readTurns(uid: string, interviewId: string): Promise<InterviewTurn[]> {
  const snap = await interviewRef(uid, interviewId).collection("turns").orderBy("sequence", "asc").limit(200).get();
  const turns: InterviewTurn[] = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.speaker !== "candidate" && data.speaker !== "interviewer") continue;
    const textValue = text(data.text, 4000).trim();
    if (!textValue) continue;
    turns.push({
      id: doc.id,
      speaker: data.speaker,
      text: textValue,
      timestampMs: num(data.timestampMs) ?? 0,
    });
  }
  return turns;
}

async function readAnalysis(uid: string, interviewId: string): Promise<InterviewAnalysis | null> {
  const snap = await interviewRef(uid, interviewId).collection("analysis").doc("main").get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  if (typeof data.overallReadiness !== "number" || typeof data.summary !== "string" || !data.categoryScores) return null;
  const { savedAt: _savedAt, model: _model, ...analysis } = data;
  void _savedAt;
  void _model;
  return analysis as InterviewAnalysis;
}

function readAssistance(value: unknown): InterviewAssistanceEvent[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is InterviewAssistanceEvent => {
    if (!item || typeof item !== "object") return false;
    const event = item as InterviewAssistanceEvent;
    return typeof event.type === "string" && typeof event.timestampMs === "number";
  });
}

function readPauses(value: unknown): InterviewPauseEvent[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is InterviewPauseEvent => {
    if (!item || typeof item !== "object") return false;
    return typeof (item as InterviewPauseEvent).startedAt === "number";
  });
}

export async function saveInterviewProgress(
  uid: string,
  interviewId: string,
  input: {
    status: InterviewStatusName;
    turns: InterviewTurn[];
    elapsedMs: number;
    assistance: InterviewAssistanceEvent[];
    pauses: InterviewPauseEvent[];
  },
): Promise<boolean> {
  if (!isRecordId(interviewId)) return false;
  const ref = interviewRef(uid, interviewId);
  const snap = await ref.get();
  if (!snap.exists) return false;
  const now = Date.now();
  const batch = database().batch();
  input.turns.slice(0, 200).forEach((turn, index) => {
    const id = turn.id.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80) || `turn-${index + 1}`;
    batch.set(
      ref.collection("turns").doc(id),
      {
        sequence: index + 1,
        speaker: turn.speaker,
        text: turn.text.slice(0, 4000),
        timestampMs: turn.timestampMs,
        createdAt: now,
      },
      { merge: true },
    );
  });
  const current = statusOf(snap.get("status"));
  const nextStatus = current === "complete" ? "complete" : input.status;
  batch.set(
    ref,
    {
      status: nextStatus,
      updatedAt: now,
      startedAt: num(snap.get("startedAt")) ?? (nextStatus === "in_progress" ? now : null),
      elapsedMs: Math.max(0, input.elapsedMs),
      activeDurationSeconds: Math.max(0, Math.round(input.elapsedMs / 1000)),
      assistance: plain(input.assistance.slice(0, 40)),
      pauses: plain(input.pauses.slice(0, 40)),
    },
    { merge: true },
  );
  await batch.commit();
  return true;
}

export async function appendAssistance(uid: string, interviewId: string, event: InterviewAssistanceEvent): Promise<void> {
  if (!isRecordId(interviewId)) return;
  const ref = interviewRef(uid, interviewId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const current = readAssistance(snap.get("assistance"));
  await ref.set(
    {
      assistance: plain([...current, event].slice(-40)),
      updatedAt: Date.now(),
    },
    { merge: true },
  );
}

export async function saveInterviewAnalysis(
  uid: string,
  interviewId: string,
  analysis: InterviewAnalysis,
  metadata?: { model?: string },
): Promise<boolean> {
  if (!isRecordId(interviewId)) return false;
  const ref = interviewRef(uid, interviewId);
  const snap = await ref.get();
  if (!snap.exists) return false;
  const now = Date.now();
  const readiness = typeof analysis.overallReadiness === "number" ? analysis.overallReadiness : null;
  await ref.collection("analysis").doc("main").set({
    ...plain(analysis),
    savedAt: now,
    model: metadata?.model ?? "",
  });
  await ref.set(
    {
      status: "complete",
      analysisStatus: "complete",
      overallReadiness: readiness,
      completedAt: num(snap.get("completedAt")) ?? now,
      updatedAt: now,
    },
    { merge: true },
  );
  return true;
}

export async function deleteInterview(uid: string, interviewId: string): Promise<boolean> {
  if (!isRecordId(interviewId)) return false;
  const ref = interviewRef(uid, interviewId);
  const snap = await ref.get();
  if (!snap.exists) return false;
  await deleteDocs(ref.collection("turns"));
  await deleteDocs(ref.collection("analysis"));
  await deleteDocs(ref.collection("assistance"));
  await ref.delete();
  return true;
}

async function deleteDocs(collection: CollectionReference): Promise<void> {
  const snap = await collection.limit(200).get();
  if (snap.empty) return;
  const batch = database().batch();
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  if (snap.size === 200) await deleteDocs(collection);
}

export async function saveResumeFile(input: {
  uid: string;
  fileName: string;
  bytes: Uint8Array;
  parsedText: string;
}): Promise<{ id: string; originalFileName: string }> {
  const id = crypto.randomUUID();
  const storagePath = `users/${input.uid}/resumes/${id}/resume.pdf`;
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucketName) throw new Error("Firebase Storage is not configured.");
  await getStorage(getAdminApp()).bucket(bucketName).file(storagePath).save(Buffer.from(input.bytes), {
    contentType: "application/pdf",
    resumable: false,
    metadata: { contentType: "application/pdf" },
  });
  const now = Date.now();
  await database().doc(`users/${input.uid}/resumes/${id}`).set({
    originalFileName: input.fileName.slice(0, 180),
    storagePath,
    parsedText: input.parsedText,
    createdAt: now,
    updatedAt: now,
    lastUsedAt: now,
  });
  return { id, originalFileName: input.fileName.slice(0, 180) };
}

export async function getResume(
  uid: string,
  resumeId: string,
): Promise<{ originalFileName: string; parsedText: string } | null> {
  if (!isRecordId(resumeId)) return null;
  const snap = await database().doc(`users/${uid}/resumes/${resumeId}`).get();
  if (!snap.exists) return null;
  const parsedText = text(snap.get("parsedText"), 12_001);
  const originalFileName = text(snap.get("originalFileName"), 180);
  if (!parsedText || !originalFileName) return null;
  return { originalFileName, parsedText };
}

export async function touchResume(uid: string, resumeId: string): Promise<void> {
  if (!isRecordId(resumeId)) return;
  await database().doc(`users/${uid}/resumes/${resumeId}`).set({ lastUsedAt: Date.now(), updatedAt: Date.now() }, { merge: true });
}

export async function listResumes(uid: string): Promise<ResumeCard[]> {
  const snap = await database().collection(`users/${uid}/resumes`).orderBy("updatedAt", "desc").limit(20).get();
  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      originalFileName: text(data.originalFileName, 180) || "resume.pdf",
      createdAt: num(data.createdAt) ?? 0,
      updatedAt: num(data.updatedAt) ?? 0,
      lastUsedAt: num(data.lastUsedAt),
    };
  });
}

export async function deleteResume(uid: string, resumeId: string): Promise<boolean> {
  if (!isRecordId(resumeId)) return false;
  const ref = database().doc(`users/${uid}/resumes/${resumeId}`);
  const snap = await ref.get();
  if (!snap.exists) return false;
  const storagePath = text(snap.get("storagePath"), 300);
  if (storagePath.startsWith(`users/${uid}/`)) {
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (bucketName) {
      await getStorage(getAdminApp()).bucket(bucketName).file(storagePath).delete({ ignoreNotFound: true }).catch(() => undefined);
    }
  }
  await ref.delete();
  return true;
}
