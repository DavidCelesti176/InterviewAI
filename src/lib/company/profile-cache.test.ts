import assert from "node:assert/strict";
import test from "node:test";

import {
  clearCompanyProfileCache,
  companyCacheKey,
  companyProfileFrom,
  freshStoredProfile,
  readCompanyProfile,
  rememberCompanyProfile,
} from "./profile-cache";
import type { CompanyInterviewProfile } from "@/lib/interview/types";

const profile: CompanyInterviewProfile = {
  company: "U.S. Bank",
  confidence: "medium",
  researchedAt: "2026-10-01T00:00:00.000Z",
  summary: "Public evidence points to structured behavioral interviews.",
  officialEvidenceFound: true,
  behavioralEmphasis: "high",
  technicalEmphasis: "role_dependent",
  caseInterviewEmphasis: "low",
  structuredInterviewLikelihood: "high",
  commonQuestionPatterns: ["Tell me about a time you influenced a decision."],
  commonCompetencies: ["Communication"],
  interviewerToneGuidance: "Direct and structured.",
  followUpStyle: "One follow-up when an example is vague.",
  processNotes: ["Recruiter screen, then hiring manager."],
  answerStructure: "star",
  answerStructureNote: "Candidates are asked to include the result.",
  interviewPhilosophy: "Take a moment before answering.",
  officialPatterns: ["A specific situation with a result."],
  sources: [{ title: "Careers", url: "https://example.com/careers", sourceType: "official", sourceWeight: "official", publishedAt: "" }],
};

test("company names share one cache key", () => {
  assert.equal(companyCacheKey("U.S. Bank"), companyCacheKey("u.s. bank"));
  assert.equal(companyCacheKey("AT&T"), "at-and-t");
});

test("a stored profile is reused until it expires", () => {
  clearCompanyProfileCache();
  rememberCompanyProfile(profile, 200);
  assert.equal(readCompanyProfile("u.s. bank", 100)?.profile.summary, profile.summary);
  assert.equal(readCompanyProfile("u.s. bank", 200), null);
  clearCompanyProfileCache();
});

test("a durable record is ignored when it is expired or incomplete", () => {
  assert.equal(freshStoredProfile({ expiresAt: 500, profile }, 100)?.profile.company, "U.S. Bank");
  assert.equal(freshStoredProfile({ expiresAt: 50, profile }, 100), null);
  assert.equal(companyProfileFrom({ ...profile, confidence: "certain" }), null);
  assert.equal(freshStoredProfile({ expiresAt: 500, profile: { ...profile, summary: "  " } }, 100), null);
});

test("an older cached profile still loads without the newer fields", () => {
  const older = {
    company: profile.company,
    confidence: profile.confidence,
    researchedAt: profile.researchedAt,
    summary: profile.summary,
    officialEvidenceFound: profile.officialEvidenceFound,
    behavioralEmphasis: profile.behavioralEmphasis,
    technicalEmphasis: profile.technicalEmphasis,
    caseInterviewEmphasis: profile.caseInterviewEmphasis,
    structuredInterviewLikelihood: profile.structuredInterviewLikelihood,
    commonQuestionPatterns: profile.commonQuestionPatterns,
    commonCompetencies: profile.commonCompetencies,
    interviewerToneGuidance: profile.interviewerToneGuidance,
    followUpStyle: profile.followUpStyle,
    processNotes: profile.processNotes,
    sources: [{ title: "Forum", url: "https://example.com/forum", sourceType: "third_party" as const, publishedAt: "" }],
  };
  const parsed = companyProfileFrom(older);
  assert.equal(parsed?.answerStructure, "none");
  assert.equal(parsed?.sources[0]?.sourceWeight, "community");
  assert.equal(parsed?.officialPatterns.length, 0);
});
