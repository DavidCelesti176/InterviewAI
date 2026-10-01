import { companyProfileTtlMs } from "@/lib/live/config";
import type { CompanyInterviewProfile } from "@/lib/interview/types";

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

export function readCompanyProfile(company: string): { profile: CompanyInterviewProfile; cacheHit: true } | null {
  const stored = cache().get(companyCacheKey(company));
  if (!stored || stored.expiresAt <= Date.now()) {
    if (stored) cache().delete(companyCacheKey(company));
    return null;
  }
  return { profile: stored.profile, cacheHit: true };
}

export function writeCompanyProfile(profile: CompanyInterviewProfile): void {
  const now = Date.now();
  cache().set(companyCacheKey(profile.company), {
    profile,
    expiresAt: now + companyProfileTtlMs(),
  });
}
