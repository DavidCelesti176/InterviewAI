import { durationMinutes } from "@/lib/interview/labels";
import {
  clipText,
  MAX_COMPANY_CHARS,
  MAX_JOB_DESCRIPTION_CHARS,
  MAX_JOB_TITLE_CHARS,
  MAX_PDF_BYTES,
  MAX_RESUME_TEXT_CHARS,
  MIN_JOB_DESCRIPTION_CHARS,
  MIN_RESUME_TEXT_CHARS,
} from "@/lib/interview/limits";
import { isInterviewMode } from "@/lib/interview/help-types";
import type { DurationChoice, InterviewConfig, InterviewType } from "@/lib/interview/types";
import { extractPdfText, looksLikePdf } from "@/lib/resume/parse-pdf";

const interviewTypes = new Set<InterviewType>(["mixed", "hiring-manager", "behavioral", "recruiter", "role-specific"]);
const durationChoices = new Set<DurationChoice>(["15", "30", "45", "unsure"]);

export type Submission =
  | { ok: true; config: InterviewConfig; resumeFileName: string; durationChoice: DurationChoice }
  | { ok: false; error: string; status: number };

function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function readInterviewSubmission(form: FormData): Promise<Submission> {
  const company = field(form, "company");
  const jobTitle = field(form, "jobTitle");
  const jobDescription = field(form, "jobDescription");
  const interviewType = field(form, "interviewType");
  const duration = field(form, "duration");
  const interviewMode = field(form, "interviewMode");
  const resume = form.get("resume");

  if (!company || company.length > MAX_COMPANY_CHARS) return { ok: false, error: "Enter a company name.", status: 400 };
  if (!jobTitle || jobTitle.length > MAX_JOB_TITLE_CHARS) return { ok: false, error: "Enter a job title.", status: 400 };
  if (!jobDescription || jobDescription.length < MIN_JOB_DESCRIPTION_CHARS) {
    return { ok: false, error: "Enter the job description.", status: 400 };
  }
  if (jobDescription.length > MAX_JOB_DESCRIPTION_CHARS) return { ok: false, error: "The job description is too long.", status: 400 };
  if (!interviewTypes.has(interviewType as InterviewType)) return { ok: false, error: "Choose an interview type.", status: 400 };
  if (!durationChoices.has(duration as DurationChoice)) return { ok: false, error: "Choose an expected interview length.", status: 400 };
  if (!(resume instanceof File) || resume.size === 0) return { ok: false, error: "Upload your resume PDF.", status: 400 };

  const pdfName = resume.name.toLowerCase().endsWith(".pdf");
  const pdfType = resume.type === "application/pdf" || resume.type === "";
  if ((!pdfName && resume.type !== "application/pdf") || (!pdfType && !pdfName)) {
    return { ok: false, error: "Upload a PDF resume.", status: 400 };
  }
  if (resume.size > MAX_PDF_BYTES) return { ok: false, error: "That PDF is too large. Use a file under 8 MB.", status: 400 };

  const bytes = new Uint8Array(await resume.arrayBuffer());
  if (!looksLikePdf(bytes)) return { ok: false, error: "Upload a PDF resume.", status: 400 };

  let resumeText = "";
  try {
    resumeText = await extractPdfText(bytes);
  } catch (error) {
    console.error("Resume parse failed", error instanceof Error ? error.name : "error");
    return { ok: false, error: "We could not read that PDF. Export it as a text-based PDF and try again.", status: 400 };
  }
  if (resumeText.length < MIN_RESUME_TEXT_CHARS) {
    return { ok: false, error: "We could not read text from that PDF. Export it as a text-based PDF and try again.", status: 400 };
  }

  return {
    ok: true,
    resumeFileName: resume.name || "resume.pdf",
    durationChoice: duration as DurationChoice,
    config: {
      company,
      jobTitle,
      jobDescription: clipText(jobDescription, MAX_JOB_DESCRIPTION_CHARS),
      interviewType: interviewType as InterviewType,
      interviewMode: isInterviewMode(interviewMode) ? interviewMode : "mock",
      targetDurationMinutes: durationMinutes(duration as DurationChoice),
      candidate: { resumeText: clipText(resumeText, MAX_RESUME_TEXT_CHARS) },
    },
  };
}

export function readStoredConfig(value: unknown): InterviewConfig | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const candidate = record.candidate;
  const resumeText =
    candidate && typeof candidate === "object" && typeof (candidate as { resumeText?: unknown }).resumeText === "string"
      ? (candidate as { resumeText: string }).resumeText
      : "";
  const company = typeof record.company === "string" ? record.company.trim() : "";
  const jobTitle = typeof record.jobTitle === "string" ? record.jobTitle.trim() : "";
  const jobDescription = typeof record.jobDescription === "string" ? record.jobDescription.trim() : "";
  const interviewType = record.interviewType;
  const interviewMode = record.interviewMode;
  const targetDurationMinutes = record.targetDurationMinutes;
  if (!company || company.length > MAX_COMPANY_CHARS) return null;
  if (!jobTitle || jobTitle.length > MAX_JOB_TITLE_CHARS) return null;
  if (jobDescription.length < MIN_JOB_DESCRIPTION_CHARS || jobDescription.length > MAX_JOB_DESCRIPTION_CHARS) return null;
  if (resumeText.length < MIN_RESUME_TEXT_CHARS || resumeText.length > MAX_RESUME_TEXT_CHARS + 1) return null;
  if (!interviewTypes.has(interviewType as InterviewType)) return null;
  if (typeof targetDurationMinutes !== "number" || targetDurationMinutes < 10 || targetDurationMinutes > 60) return null;
  return {
    company,
    jobTitle,
    jobDescription,
    interviewType: interviewType as InterviewType,
    interviewMode: isInterviewMode(interviewMode) ? interviewMode : "mock",
    targetDurationMinutes,
    candidate: { resumeText },
  };
}
