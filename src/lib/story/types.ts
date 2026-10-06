export type StoryConfidence = "low" | "medium" | "high";

export type StoryEvidenceRef = {
  experience: string;
  evidence: string;
};

export type StoryIdentityOption = {
  id: string;
  label: string;
  statement: string;
  explanation: string;
  evidence: StoryEvidenceRef[];
  confidence: StoryConfidence;
};

export type StoryAnalysis = {
  identityOptions: StoryIdentityOption[];
  recurringPatterns: string[];
  suggestedEvidence: Array<{
    experience: string;
    reason: string;
    proof: string;
  }>;
  note: string;
};

export type StoryProof = {
  title: string;
  sourceExperience: string;
  proof: string;
};

export type ProfessionalStory = {
  identity: {
    label: string;
    statement: string;
  };
  pattern: string;
  evidence: StoryProof[];
  direction: string;
  generalTellMeAboutYourself: string;
  shortTellMeAboutYourself: string;
  memorability: string;
  resumeId: string;
  createdAt: number;
  updatedAt: number;
};

export type StoryDraft = {
  standardAnswer: string;
  shortAnswer: string;
  direction: string;
  memorability: string;
};

export type TailoredStory = {
  identity: ProfessionalStory["identity"];
  pattern: string;
  evidence: StoryProof[];
  direction: string;
  tellMeAboutYourself: string;
  memorability: string;
};

export type StoryPracticeFeedback = {
  establishedIdentity: boolean;
  evidenceSupportedIdentity: boolean;
  clearThread: boolean;
  explainedDirection: boolean;
  rightLength: boolean;
  conversational: boolean;
  buriedEvidence: boolean;
  resumeChronology: boolean;
  coaching: string;
  interviewerMemory: string;
};

export const PRIMARY_STORY_ID = "primary";
