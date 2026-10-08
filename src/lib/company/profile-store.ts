import { adminConfigured, getAdminApp } from "@/lib/firebase/admin";
import { companyCacheKey, companyProfileFrom, freshStoredProfile } from "@/lib/company/profile-cache";
import type { CompanyInterviewProfile } from "@/lib/interview/types";
import { companyProfileTtlMs } from "@/lib/live/config";

async function database() {
  const { getFirestore } = await import("firebase-admin/firestore");
  return getFirestore(await getAdminApp());
}

export async function readStoredCompanyProfile(
  company: string,
  now = Date.now(),
): Promise<{ profile: CompanyInterviewProfile; expiresAt: number } | null> {
  if (!adminConfigured()) return null;
  try {
    const db = await database();
    const snap = await db.doc(`companyProfiles/${companyCacheKey(company)}`).get();
    if (!snap.exists) return null;
    return freshStoredProfile(snap.data(), now);
  } catch (error) {
    console.error("Company profile cache read failed", error instanceof Error ? error.message : "error");
    return null;
  }
}

export async function writeStoredCompanyProfile(profile: CompanyInterviewProfile, now = Date.now()): Promise<void> {
  if (!adminConfigured()) return;
  const stored = companyProfileFrom(profile);
  if (!stored) return;
  const db = await database();
  await db.doc(`companyProfiles/${companyCacheKey(stored.company)}`).set({
    profile: stored,
    expiresAt: now + companyProfileTtlMs(),
  });
}
