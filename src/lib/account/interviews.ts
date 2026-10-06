"use client";

import { collection, deleteDoc, doc, getDocs, limit, orderBy, query } from "firebase/firestore";

import type { InterviewCard, InterviewStatusName } from "@/lib/account/types";
import { clientFirestore } from "@/lib/firebase/client";

const STATUSES = new Set<InterviewStatusName>([
  "draft",
  "preparing",
  "ready",
  "in_progress",
  "analyzing",
  "complete",
  "failed",
]);

export async function listOwnedInterviews(uid: string): Promise<InterviewCard[]> {
  const snap = await getDocs(
    query(collection(clientFirestore(), "users", uid, "interviews"), orderBy("createdAt", "desc"), limit(30)),
  );
  return snap.docs.map((item) => {
    const data = item.data();
    return {
      id: item.id,
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

export async function deleteOwnedInterview(uid: string, interviewId: string): Promise<void> {
  const db = clientFirestore();
  for (const name of ["turns", "analysis", "assistance"]) {
    const snap = await getDocs(collection(db, "users", uid, "interviews", interviewId, name));
    await Promise.all(snap.docs.map((item) => deleteDoc(item.ref)));
  }
  await deleteDoc(doc(db, "users", uid, "interviews", interviewId));
}

function statusOf(value: unknown): InterviewStatusName {
  return typeof value === "string" && STATUSES.has(value as InterviewStatusName) ? (value as InterviewStatusName) : "draft";
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
