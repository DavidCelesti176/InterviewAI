export type InterviewStatusName =
  | "draft"
  | "preparing"
  | "ready"
  | "in_progress"
  | "analyzing"
  | "complete"
  | "failed";

export type InterviewCard = {
  id: string;
  company: string;
  jobTitle: string;
  interviewMode: string;
  sessionKind: "interview" | "practice";
  status: InterviewStatusName;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
  activeDurationSeconds: number;
  overallReadiness: number | null;
  resumeFileName: string;
  interviewerProfileId: string;
};

export type ResumeCard = {
  id: string;
  originalFileName: string;
  createdAt: number;
  updatedAt: number;
  lastUsedAt: number | null;
};

export type UserProfile = {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  createdAt: number;
  updatedAt: number;
};
