import { overallDifficulty } from "@/lib/interview/difficulty";
import type {
  CandidateExperienceProfile,
  CandidateLevel,
  CareerStage,
  ExperienceCalibration,
  ExperienceDepth,
  PeopleManagementScope,
  RoleAnalysis,
} from "@/lib/interview/types";

const careerStages: CareerStage[] = [
  "student",
  "intern",
  "recent_grad",
  "entry",
  "early_career",
  "mid",
  "senior",
  "manager",
  "director",
  "executive",
];

const depths: ExperienceDepth[] = ["low", "moderate", "high"];
const internships = ["none", "limited", "moderate", "strong"] as const;
const managementScopes: PeopleManagementScope[] = ["none", "limited", "substantial"];

const depthRank: Record<ExperienceDepth, number> = { low: 0, moderate: 1, high: 2 };
const stageRank: Record<CareerStage, number> = {
  student: 0,
  intern: 1,
  recent_grad: 2,
  entry: 3,
  early_career: 4,
  mid: 5,
  senior: 6,
  manager: 7,
  director: 8,
  executive: 9,
};

const unambiguousNewGrad: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /recent graduates?/i, reason: "recent-graduate language" },
  { pattern: /new graduates?/i, reason: "new-graduate language" },
  { pattern: /\bnew grads?\b/i, reason: "new-grad language" },
  { pattern: /campus hires?/i, reason: "campus-hire language" },
  { pattern: /campus recruiting/i, reason: "campus recruiting" },
  { pattern: /college recruiting/i, reason: "college recruiting" },
  { pattern: /graduating\b/i, reason: "graduation-date language" },
  { pattern: /class of 20\d{2}/i, reason: "class-year language" },
  { pattern: /no (prior |full-time |previous )?experience required/i, reason: "no experience required" },
  { pattern: /no full-time experience/i, reason: "no full-time experience required" },
  { pattern: /\b0\s*(?:[-–]|to)\s*2\s+years/i, reason: "0–2 years of experience" },
  { pattern: /internship experience (preferred|is a plus|welcome)/i, reason: "internship experience preferred" },
  { pattern: /early[- ]career (program|rotational|development)/i, reason: "early-career program" },
];

const supportingNewGrad: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /(?<!not an? )(?<!beyond )entry[- ]level/i, reason: "entry-level language" },
  { pattern: /early[- ]career (role|position|opportunity|hire|opening)/i, reason: "early-career language" },
  { pattern: /bachelor'?s degree required/i, reason: "bachelor's degree required" },
  { pattern: /rotational program/i, reason: "rotational program" },
  { pattern: /development program/i, reason: "development program" },
];

export function isCareerStage(value: string): value is CareerStage {
  return careerStages.includes(value as CareerStage);
}

export function isJuniorStage(stage: CareerStage): boolean {
  return stageRank[stage] <= stageRank.early_career;
}

export function isJuniorLevel(level: CandidateLevel): boolean {
  return level === "intern" || level === "recent_grad" || level === "entry" || level === "early_career";
}

export function detectHiringStage(
  title: string,
  description: string,
): { cap: CandidateLevel | null; reasons: string[]; internshipPosting: boolean } {
  const text = `${title}\n${description}`;
  const reasons: string[] = [];
  const internshipPosting =
    /\bintern\b/i.test(title) ||
    (/\b(summer|winter|fall|spring|our|this|the) internship\b/i.test(description) &&
      !/internship experience/i.test(description));
  if (internshipPosting) reasons.push("internship posting");

  for (const signal of unambiguousNewGrad) {
    if (signal.pattern.test(text)) reasons.push(signal.reason);
  }
  const strong = reasons.length > 0;
  const support = supportingNewGrad.filter((signal) => signal.pattern.test(text));
  const anchored = support.some(
    (signal) => signal.reason === "entry-level language" || signal.reason === "early-career language",
  );
  if (!strong && anchored && support.length >= 2) {
    reasons.push(...support.map((signal) => signal.reason));
  } else if (!strong && support.some((signal) => signal.reason === "entry-level language")) {
    reasons.push("entry-level language");
  } else if (!strong && support.some((signal) => signal.reason === "early-career language")) {
    reasons.push("early-career language");
  }

  if (reasons.length === 0) return { cap: null, reasons: [], internshipPosting };
  if (internshipPosting && !unambiguousNewGrad.some((signal) => signal.pattern.test(text))) {
    return { cap: "intern", reasons, internshipPosting };
  }
  if (reasons.includes("entry-level language") && reasons.length === 1) return { cap: "entry", reasons, internshipPosting };
  if (reasons.length === 1 && reasons[0] === "early-career language") return { cap: "early_career", reasons, internshipPosting };
  return { cap: internshipPosting ? "intern" : "recent_grad", reasons, internshipPosting };
}

export function calibrateJobLevel(analysis: RoleAnalysis, title: string, description: string): RoleAnalysis {
  const hiring = detectHiringStage(title, description);
  if (!hiring.cap) return analysis;
  const modelIsLowerIntern = analysis.candidateLevel === "intern" && hiring.cap === "recent_grad" && !hiring.internshipPosting;
  if (!modelIsLowerIntern && levelRank(analysis.candidateLevel) <= levelRank(hiring.cap)) return analysis;
  const capped = modelIsLowerIntern ? "recent_grad" : hiring.cap;
  return {
    ...analysis,
    candidateLevel: capped,
    leadershipExpectation: Math.min(analysis.leadershipExpectation, 2),
    strategicExpectation: Math.min(analysis.strategicExpectation, 2),
    recommendedInterviewDifficulty: Math.min(analysis.recommendedInterviewDifficulty, 3),
    reasoningSummary: `${analysis.reasoningSummary} The posting is classified as ${capped.replaceAll("_", " ")} because it includes ${hiring.reasons.join(", ")}. The title "${title}" was not treated as proof of seniority.`,
  };
}

export function clampCandidateProfile(
  profile: CandidateExperienceProfile,
  jobLevel: CandidateLevel,
): CandidateExperienceProfile {
  const years = clampYears(profile.relevantExperienceYears);
  let stage = profile.careerStage;
  const limitedPast = years <= 2 && (isJuniorLevel(jobLevel) || isJuniorStage(stage));
  if (limitedPast && stageRank[stage] > stageRank.recent_grad) {
    stage = jobLevel === "intern" ? "intern" : jobLevel === "entry" ? "entry" : "recent_grad";
  }
  const junior = isJuniorStage(stage) && years < 4;
  const early = stage === "student" || stage === "intern" || stage === "recent_grad";
  return {
    ...profile,
    careerStage: stage,
    relevantExperienceYears: years,
    leadershipAuthority: junior ? capDepth(profile.leadershipAuthority, early ? "low" : "moderate") : profile.leadershipAuthority,
    stakeholderInfluence: junior ? capDepth(profile.stakeholderInfluence, early ? "low" : "moderate") : profile.stakeholderInfluence,
    strategicDecisionAuthority: junior ? "low" : profile.strategicDecisionAuthority,
    peopleManagement: junior && profile.peopleManagement === "substantial" ? "limited" : profile.peopleManagement,
  };
}

export function buildExperienceCalibration(role: RoleAnalysis): ExperienceCalibration {
  const profile = role.candidateProfile;
  const interviewDifficulty = overallDifficulty(role.candidateLevel, role.recommendedInterviewDifficulty);
  const avoidUnsupportedAuthorityAssumptions =
    profile.leadershipAuthority === "low" ||
    profile.stakeholderInfluence === "low" ||
    profile.strategicDecisionAuthority === "low" ||
    profile.peopleManagement === "none";
  return {
    careerStage: profile.careerStage,
    jobSeniority: role.candidateLevel,
    roleComplexity: role.roleComplexity,
    interviewDifficulty,
    leadershipAuthority: profile.leadershipAuthority,
    stakeholderInfluence: profile.stakeholderInfluence,
    strategicDecisionAuthority: profile.strategicDecisionAuthority,
    independentProjectOwnership: profile.independentProjectOwnership,
    peopleManagement: profile.peopleManagement,
    challengeThinking: true,
    avoidUnsupportedAuthorityAssumptions,
    allowExperienceLevelReframe: true,
    ceilingSummary: ceilingSummary(role, interviewDifficulty),
    screenedThemes: [],
  };
}

export function calibrationInstructions(calibration: ExperienceCalibration): string {
  const fair = calibration.avoidUnsupportedAuthorityAssumptions
    ? `Do not assume direct reports, executive access, enterprise strategy, budget ownership, or formal decision rights.
Do not ask them to persuade senior stakeholders, influence executives, resolve competing organizational priorities, or manage an underperforming employee unless their background already shows that scope.
Ask instead about the project they owned: which metrics or inputs they chose, how they checked the work, what was hardest, who used it, what feedback they received, what they would change, and what they learned from a teammate, supervisor, or another department.
Accept examples from internships, class projects, part-time work, campus roles, volunteering, athletics, and a small business at its real scale. Do not treat a small business as a large-company executive role.`
    : `Leadership, stakeholder, and strategy questions are appropriate when they match the scope this person has actually had. Still do not inflate a smaller role into enterprise authority.`;
  return `Candidate experience calibration:
Challenge their thinking about one level above what they have done. Do not ask them to pretend they held authority they have not had.
Career stage: ${label(calibration.careerStage)}. Job seniority this interview was built for: ${calibration.jobSeniority.replaceAll("_", " ")}.
Role complexity ${calibration.roleComplexity} of 5. Interview difficulty ${calibration.interviewDifficulty} of 5. A demanding question here means deeper thinking about their own work, not a more senior job.
Leadership authority: ${calibration.leadershipAuthority}. Stakeholder influence: ${calibration.stakeholderInfluence}. Strategic decision authority: ${calibration.strategicDecisionAuthority}. People management: ${calibration.peopleManagement}. Project ownership: ${calibration.independentProjectOwnership}.
${fair}
If they hesitate, say they do not have an example, or seem confused because the question assumes too much responsibility, rephrase it once into a comparable situation they could have faced. Then listen. Do not coach, do not supply an example they have not already mentioned, and do not make the question easier a second time.`;
}

export function screenTheme(text: string, calibration: ExperienceCalibration): { keep: boolean; authorityAssumption: number } {
  if (!calibration.avoidUnsupportedAuthorityAssumptions) return { keep: true, authorityAssumption: 1 };
  const authorityAssumption = authorityScore(text);
  const peopleBlocked =
    calibration.peopleManagement !== "substantial" &&
    /direct report|underperforming|manage (a |the )?team|people management/i.test(text);
  const executiveBlocked =
    calibration.stakeholderInfluence !== "high" &&
    /executive|senior stakeholder|persuad\w* (senior |executive |leadership)|influence (executive|leadership|senior)/i.test(text);
  const strategyBlocked =
    calibration.strategicDecisionAuthority === "low" &&
    /enterprise strategy|strategic decision you owned|organizational priorit|business unit/i.test(text);
  const influenceBlocked = calibration.stakeholderInfluence === "low" && authorityAssumption >= 3;
  return {
    keep: !peopleBlocked && !executiveBlocked && !strategyBlocked && !influenceBlocked,
    authorityAssumption,
  };
}

export function isCandidateProfile(value: unknown): value is CandidateExperienceProfile {
  if (!value || typeof value !== "object") return false;
  const profile = value as CandidateExperienceProfile;
  return (
    isCareerStage(profile.careerStage) &&
    depths.includes(profile.leadershipAuthority) &&
    depths.includes(profile.stakeholderInfluence) &&
    depths.includes(profile.strategicDecisionAuthority) &&
    depths.includes(profile.independentProjectOwnership) &&
    depths.includes(profile.crossFunctionalExposure) &&
    depths.includes(profile.analyticalProjectDepth) &&
    internships.includes(profile.internshipDepth) &&
    managementScopes.includes(profile.peopleManagement) &&
    typeof profile.reasoningSummary === "string"
  );
}

function ceilingSummary(role: RoleAnalysis, interviewDifficulty: number): string {
  const profile = role.candidateProfile;
  return `Job seniority ${role.candidateLevel.replaceAll("_", " ")}. Candidate ${label(profile.careerStage)}. Leadership authority ${profile.leadershipAuthority}. Stakeholder influence ${profile.stakeholderInfluence}. Strategic decision authority ${profile.strategicDecisionAuthority}. People management ${profile.peopleManagement}. Project ownership ${profile.independentProjectOwnership}. Role complexity ${role.roleComplexity} of 5. Interview difficulty ${interviewDifficulty} of 5. ${role.reasoningSummary}`;
}

function authorityScore(text: string): number {
  if (/executive|senior stakeholder|underperforming|organizational priorit|enterprise strategy|persuad\w* (senior |executive )|influence executive/i.test(text)) {
    return 5;
  }
  if (/stakeholder|get (someone|them) on board|competing priorit/i.test(text)) return 3;
  return 1;
}

function capDepth(value: ExperienceDepth, max: ExperienceDepth): ExperienceDepth {
  return depthRank[value] <= depthRank[max] ? value : max;
}

function clampYears(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(40, Math.round(value));
}

function levelRank(level: CandidateLevel): number {
  const ranks: Record<CandidateLevel, number> = {
    intern: 0,
    recent_grad: 1,
    entry: 2,
    early_career: 3,
    mid: 4,
    senior: 5,
    manager: 6,
    director: 7,
    executive: 8,
  };
  return ranks[level];
}

function label(stage: CareerStage): string {
  return stage.replaceAll("_", " ");
}
