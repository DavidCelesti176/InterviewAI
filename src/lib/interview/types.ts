export type InterviewType =
  | "mixed"
  | "hiring-manager"
  | "behavioral"
  | "recruiter"
  | "role-specific";

export type DurationChoice = "15" | "30" | "45" | "unsure";

export type InterviewMode = "practice" | "mock";

export interface InterviewConfig {
  company: string;
  jobTitle: string;
  jobDescription: string;
  interviewType: InterviewType;
  interviewMode: InterviewMode;
  targetDurationMinutes: number;
  candidate: {
    resumeText: string;
  };
}

export interface InterviewPlan {
  roleSummary: string;
  priorityCompetencies: Array<{
    name: string;
    reason: string;
    priority: "high" | "medium" | "low";
  }>;
  resumeTopicsToProbe: Array<{
    topic: string;
    reason: string;
  }>;
  jobRequirements: string[];
  interviewThemes: string[];
  potentialFollowUps: string[];
  interviewerStrategy: string;
  openingApproach: string;
}

export type CandidateLevel =
  | "intern"
  | "recent_grad"
  | "entry"
  | "early_career"
  | "mid"
  | "senior"
  | "manager"
  | "director"
  | "executive";

export type Confidence = "low" | "medium" | "high";

export type Emphasis = "low" | "medium" | "high" | "unknown";

export type RoleDependentEmphasis = Emphasis | "role_dependent";

export type CareerStage =
  | "student"
  | "intern"
  | "recent_grad"
  | "entry"
  | "early_career"
  | "mid"
  | "senior"
  | "manager"
  | "director"
  | "executive";

export type ExperienceDepth = "low" | "moderate" | "high";

export type InternshipDepth = "none" | "limited" | "moderate" | "strong";

export type PeopleManagementScope = "none" | "limited" | "substantial";

export interface CandidateExperienceProfile {
  careerStage: CareerStage;
  relevantExperienceYears: number;
  internshipDepth: InternshipDepth;
  independentProjectOwnership: ExperienceDepth;
  leadershipAuthority: ExperienceDepth;
  stakeholderInfluence: ExperienceDepth;
  strategicDecisionAuthority: ExperienceDepth;
  peopleManagement: PeopleManagementScope;
  crossFunctionalExposure: ExperienceDepth;
  analyticalProjectDepth: ExperienceDepth;
  confidence: Confidence;
  reasoningSummary: string;
}

export interface ExperienceCalibration {
  careerStage: CareerStage;
  jobSeniority: CandidateLevel;
  roleComplexity: number;
  interviewDifficulty: number;
  leadershipAuthority: ExperienceDepth;
  stakeholderInfluence: ExperienceDepth;
  strategicDecisionAuthority: ExperienceDepth;
  independentProjectOwnership: ExperienceDepth;
  peopleManagement: PeopleManagementScope;
  challengeThinking: true;
  avoidUnsupportedAuthorityAssumptions: boolean;
  allowExperienceLevelReframe: boolean;
  ceilingSummary: string;
  screenedThemes: string[];
}

export interface RoleAnalysis {
  candidateLevel: CandidateLevel;
  confidence: Confidence;
  reasoningSummary: string;
  expectedExperienceYears: {
    min: number;
    max: number;
  };
  roleComplexity: number;
  technicalDepth: number;
  leadershipExpectation: number;
  strategicExpectation: number;
  communicationExpectation: number;
  keyCompetencies: Array<{
    name: string;
    importance: "low" | "medium" | "high";
    reason: string;
  }>;
  recommendedInterviewDifficulty: number;
  candidateProfile: CandidateExperienceProfile;
}

export interface DifficultyCurve {
  opening: number;
  early: number;
  middle: number;
  late: number;
}

export interface CompanyInterviewProfile {
  company: string;
  confidence: Confidence;
  researchedAt: string;
  summary: string;
  officialEvidenceFound: boolean;
  behavioralEmphasis: Emphasis;
  technicalEmphasis: RoleDependentEmphasis;
  caseInterviewEmphasis: RoleDependentEmphasis;
  structuredInterviewLikelihood: Emphasis;
  commonQuestionPatterns: string[];
  commonCompetencies: string[];
  interviewerToneGuidance: string;
  followUpStyle: string;
  processNotes: string[];
  sources: Array<{
    title: string;
    url: string;
    sourceType: "official" | "candidate_report" | "third_party";
    publishedAt: string;
  }>;
}

export interface InterviewBlueprint {
  candidateLevel: CandidateLevel;
  overallDifficulty: number;
  difficultyCurve: DifficultyCurve;
  interviewerTone: string;
  openingStrategy: string;
  questionMix: {
    background: number;
    behavioral: number;
    resume: number;
    technical: number;
    situational: number;
    motivation: number;
  };
  competencyPriorities: Array<{
    competency: string;
    priority: "low" | "medium" | "high";
    reason: string;
  }>;
  resumeTopicsToProbe: Array<{
    topic: string;
    reason: string;
  }>;
  roleTopicsToProbe: string[];
  companyStyle: {
    summary: string;
    confidence: Confidence;
    behavioralEmphasis: string;
    technicalEmphasis: string;
    commonQuestionPatterns: string[];
  };
  followUpGuidance: string[];
  behaviorsToAvoid: string[];
  pacingGuidance: string;
  closingStrategy: string;
  experienceCalibration: ExperienceCalibration;
}

export interface PreparationDebug {
  cacheHit: boolean;
  roleAnalysis: RoleAnalysis;
  difficultyCurve: DifficultyCurve;
  companyProfile: CompanyInterviewProfile;
  blueprint: InterviewBlueprint;
}

export interface InterviewTurn {
  id: string;
  speaker: "candidate" | "interviewer";
  text: string;
  timestampMs: number;
}
