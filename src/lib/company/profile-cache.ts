import { companyProfileTtlMs } from "@/lib/live/config";
import type { AnswerStructureKind, CompanyInterviewProfile, Confidence, Emphasis, RoleDependentEmphasis, SourceWeight } from "@/lib/interview/types";

export type CachedCompanyProfile = {
  profile: CompanyInterviewProfile;
  expiresAt: number;
};

type CacheGlobal = typeof globalThis & {
  __companyProfileCache?: Map<string, CachedCompanyProfile>;
};

function cache(): Map<string, CachedCompanyProfile> {
  const root = globalThis as CacheGlobal;
  if (!root.__companyProfileCache) root.__companyProfileCache = new Map();
  return root.__companyProfileCache;
}

export function companyCacheKey(company: string): string {
  const slug = company
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "unknown-company";
}

export function readCompanyProfile(company: string, now = Date.now()): { profile: CompanyInterviewProfile; cacheHit: true; expiresAt: number } | null {
  const stored = cache().get(companyCacheKey(company));
  if (!stored || stored.expiresAt <= now) {
    if (stored) cache().delete(companyCacheKey(company));
    return null;
  }
  return { profile: stored.profile, cacheHit: true, expiresAt: stored.expiresAt };
}

export function rememberCompanyProfile(profile: CompanyInterviewProfile, expiresAt = Date.now() + companyProfileTtlMs()): void {
  cache().set(companyCacheKey(profile.company), { profile, expiresAt });
}

export function writeCompanyProfile(profile: CompanyInterviewProfile): void {
  rememberCompanyProfile(profile);
}

export function clearCompanyProfileCache(): void {
  cache().clear();
}

const confidences = new Set<Confidence>(["low", "medium", "high"]);
const emphasis = new Set<Emphasis>(["low", "medium", "high", "unknown"]);
const roleEmphasis = new Set<RoleDependentEmphasis>(["low", "medium", "high", "unknown", "role_dependent"]);
const sourceTypes = new Set(["official", "candidate_report", "third_party"]);
const answerStructures = new Set<AnswerStructureKind>(["none", "star", "other"]);
const sourceWeights = new Set<SourceWeight>(["official", "official_prep", "candidate_report", "community"]);

function stringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function companyProfileFrom(value: unknown): CompanyInterviewProfile | null {
  if (!value || typeof value !== "object") return null;
  const profile = value as CompanyInterviewProfile;
  if (typeof profile.company !== "string" || !profile.company.trim()) return null;
  if (!confidences.has(profile.confidence)) return null;
  if (typeof profile.researchedAt !== "string" || !profile.researchedAt.trim()) return null;
  if (typeof profile.summary !== "string" || !profile.summary.trim()) return null;
  if (typeof profile.officialEvidenceFound !== "boolean") return null;
  if (!emphasis.has(profile.behavioralEmphasis)) return null;
  if (!roleEmphasis.has(profile.technicalEmphasis)) return null;
  if (!roleEmphasis.has(profile.caseInterviewEmphasis)) return null;
  if (!emphasis.has(profile.structuredInterviewLikelihood)) return null;
  if (!stringList(profile.commonQuestionPatterns) || !stringList(profile.commonCompetencies) || !stringList(profile.processNotes)) return null;
  if (typeof profile.interviewerToneGuidance !== "string" || typeof profile.followUpStyle !== "string") return null;
  if (!Array.isArray(profile.sources)) return null;
  const sources = [];
  for (const source of profile.sources) {
    if (!source || typeof source !== "object") return null;
    if (typeof source.title !== "string" || typeof source.url !== "string" || typeof source.publishedAt !== "string") return null;
    if (!sourceTypes.has(source.sourceType)) return null;
    const weight = "sourceWeight" in source && sourceWeights.has(source.sourceWeight as SourceWeight)
      ? (source.sourceWeight as SourceWeight)
      : weightFor(source.sourceType);
    sources.push({ ...source, sourceWeight: weight });
  }
  const answerStructure = answerStructures.has(profile.answerStructure) ? profile.answerStructure : "none";
  return {
    ...profile,
    answerStructure,
    answerStructureNote: typeof profile.answerStructureNote === "string" ? profile.answerStructureNote : "",
    interviewPhilosophy: typeof profile.interviewPhilosophy === "string" ? profile.interviewPhilosophy : "",
    officialPatterns: stringList(profile.officialPatterns) ? profile.officialPatterns.slice(0, 5) : [],
    sources,
  };
}

function weightFor(sourceType: "official" | "candidate_report" | "third_party"): SourceWeight {
  if (sourceType === "official") return "official";
  if (sourceType === "candidate_report") return "candidate_report";
  return "community";
}

export function freshStoredProfile(value: unknown, now = Date.now()): { profile: CompanyInterviewProfile; expiresAt: number } | null {
  if (!value || typeof value !== "object") return null;
  const record = value as { expiresAt?: unknown; profile?: unknown };
  if (typeof record.expiresAt !== "number" || record.expiresAt <= now) return null;
  const profile = companyProfileFrom(record.profile);
  if (!profile) return null;
  return { profile, expiresAt: record.expiresAt };
}
