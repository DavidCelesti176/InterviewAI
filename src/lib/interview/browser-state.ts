import type { AnalysisDebug, InterviewAnalysis } from "@/lib/interview/analysis-types";
import type { InterviewAssistanceEvent, InterviewPauseEvent } from "@/lib/interview/help-types";
import type { DurationChoice, InterviewMode, InterviewTurn, InterviewType, PreparationDebug } from "@/lib/interview/types";

const setupKey = "interview-setup";
const draftKey = "interview-draft";
const resultKey = "interview-result";
const historyKey = "interview-history";
const debugKey = "interview-debug";
const practiceKey = "interview-practice";
const practiceNoticeKey = "interview-practice-notice";
const maxHistory = 12;

export type InterviewSetup = {
  interviewId: string;
  company: string;
  jobTitle: string;
  interviewType: InterviewType;
  interviewMode?: InterviewMode;
  targetDurationMinutes: number;
  durationChoice: DurationChoice;
  resumeFileName: string;
  levelLabel?: string;
  emphasisLabel?: string;
  interviewerProfileId?: string;
};

export type JobEntryMode = "paste" | "manual";

export type InterviewDraft = {
  company: string;
  jobTitle: string;
  jobDescription: string;
  interviewType: InterviewType;
  interviewMode?: InterviewMode;
  durationChoice: DurationChoice;
  entryMode?: JobEntryMode;
  jobListing?: string;
};

export type PracticeSetup = {
  interviewId: string;
  company: string;
  jobTitle: string;
  interviewType: InterviewType;
  questions: string[];
  interviewerProfileId?: string;
};

export type PracticeNotice = {
  questionCount: number;
};

export type SavedInterviewResult = {
  setup: InterviewSetup;
  elapsedMs: number;
  turns: InterviewTurn[];
  pauses?: InterviewPauseEvent[];
  assistance?: InterviewAssistanceEvent[];
  pausedMs?: number;
  voiceUsageWhilePausedSeconds?: number;
  analysis?: InterviewAnalysis;
  analysisDebug?: AnalysisDebug;
};

export type InterviewHistoryItem = {
  interviewId: string;
  company: string;
  jobTitle: string;
  savedAt: number;
  elapsedMs: number;
  analyzed: boolean;
};

type StoredHistoryItem = SavedInterviewResult & { savedAt: number };

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function readInterviewSetup(): InterviewSetup | null {
  const setup = readJson<InterviewSetup>(setupKey);
  if (!setup?.interviewId || !setup.company || !setup.jobTitle) return null;
  return setup;
}

export function saveInterviewSetup(setup: InterviewSetup): void {
  window.sessionStorage.setItem(setupKey, JSON.stringify(setup));
}

export function readInterviewDraft(): InterviewDraft | null {
  return readJson<InterviewDraft>(draftKey);
}

export function saveInterviewDraft(draft: InterviewDraft): void {
  window.sessionStorage.setItem(draftKey, JSON.stringify(draft));
}

export function readInterviewResult(): SavedInterviewResult | null {
  const result = readJson<SavedInterviewResult>(resultKey);
  if (!result?.setup?.interviewId || !Array.isArray(result.turns)) return null;
  return result;
}

export function saveInterviewResult(result: SavedInterviewResult): void {
  window.sessionStorage.setItem(resultKey, JSON.stringify(result));
  rememberInterview(result);
}

export function saveInterviewAnalysis(analysis: InterviewAnalysis, debug?: AnalysisDebug): void {
  const current = readInterviewResult();
  if (!current) return;
  saveInterviewResult({ ...current, analysis, analysisDebug: debug });
}

export function listInterviewHistory(): InterviewHistoryItem[] {
  return readHistory()
    .filter((item) => item.setup?.interviewId && item.setup.company && item.setup.jobTitle)
    .map((item) => ({
      interviewId: item.setup.interviewId,
      company: item.setup.company,
      jobTitle: item.setup.jobTitle,
      savedAt: item.savedAt,
      elapsedMs: item.elapsedMs,
      analyzed: Boolean(item.analysis?.summary),
    }));
}

export function restoreInterviewHistory(interviewId: string): boolean {
  const item = readHistory().find((entry) => entry.setup.interviewId === interviewId);
  if (!item) return false;
  const { savedAt, ...result } = item;
  void savedAt;
  window.sessionStorage.setItem(resultKey, JSON.stringify(result));
  return true;
}

function rememberInterview(result: SavedInterviewResult): void {
  try {
    const history = readHistory().filter((item) => item.setup.interviewId !== result.setup.interviewId);
    const previous = readHistory().find((item) => item.setup.interviewId === result.setup.interviewId);
    history.unshift({ ...result, savedAt: previous?.savedAt ?? Date.now() });
    window.localStorage.setItem(historyKey, JSON.stringify(history.slice(0, maxHistory)));
  } catch {
    // The current tab still has the transcript in session storage.
  }
}

function readHistory(): StoredHistoryItem[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(historyKey);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isStoredHistoryItem);
  } catch {
    return [];
  }
}

function isStoredHistoryItem(value: unknown): value is StoredHistoryItem {
  if (!value || typeof value !== "object") return false;
  const item = value as StoredHistoryItem;
  return typeof item.savedAt === "number" && Boolean(item.setup?.interviewId) && Array.isArray(item.turns);
}

export function savePracticeSetup(setup: PracticeSetup): void {
  window.sessionStorage.setItem(practiceKey, JSON.stringify(setup));
}

export function readPracticeSetup(): PracticeSetup | null {
  const setup = readJson<PracticeSetup>(practiceKey);
  if (!setup?.interviewId || !setup.company || !setup.jobTitle) return null;
  if (!Array.isArray(setup.questions) || setup.questions.length === 0) return null;
  if (!setup.questions.every((question) => typeof question === "string" && question.trim())) return null;
  return setup;
}

export function savePracticeNotice(notice: PracticeNotice): void {
  window.sessionStorage.setItem(practiceNoticeKey, JSON.stringify(notice));
}

export function readPracticeNotice(): PracticeNotice | null {
  const notice = readJson<PracticeNotice>(practiceNoticeKey);
  if (!notice || typeof notice.questionCount !== "number" || notice.questionCount < 1) return null;
  return notice;
}

export function clearPracticeNotice(): void {
  window.sessionStorage.removeItem(practiceNoticeKey);
}

export function savePreparationDebug(debug: PreparationDebug): void {
  window.sessionStorage.setItem(debugKey, JSON.stringify(debug));
}

export function readPreparationDebug(): PreparationDebug | null {
  const debug = readJson<PreparationDebug>(debugKey);
  if (!debug?.roleAnalysis || !debug.blueprint || !debug.companyProfile) return null;
  return debug;
}
