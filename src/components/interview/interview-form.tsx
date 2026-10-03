"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { PageShell } from "@/components/interview/page-shell";
import { PreparingScreen, type PrepareStepState } from "@/components/interview/preparing-screen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChoiceCard } from "@/components/ui/choice-card";
import { Field, TextArea, TextInput } from "@/components/ui/field";
import { ProgressSteps } from "@/components/ui/progress-steps";
import { UploadZone } from "@/components/ui/upload-zone";
import { readInterviewDraft, saveInterviewDraft, saveInterviewSetup, savePreparationDebug } from "@/lib/interview/browser-state";
import { durationOptions, interviewTypeOptions } from "@/lib/interview/labels";
import {
  MAX_COMPANY_CHARS,
  MAX_JOB_LISTING_CHARS,
  MAX_JOB_TITLE_CHARS,
  MAX_PDF_BYTES,
  MIN_JOB_DESCRIPTION_CHARS,
  MIN_JOB_LISTING_CHARS,
} from "@/lib/interview/limits";
import type { InterviewMode } from "@/lib/interview/help-types";
import type { DurationChoice, InterviewType, PreparationDebug } from "@/lib/interview/types";

const resumeInputId = "resume-pdf";

export function InterviewForm() {
  const router = useRouter();
  const resumeRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [interviewType, setInterviewType] = useState<InterviewType>("mixed");
  const [interviewMode, setInterviewMode] = useState<InterviewMode>("practice");
  const [duration, setDuration] = useState<DurationChoice>("30");
  const [jobListing, setJobListing] = useState("");
  const [readListing, setReadListing] = useState("");
  const [resumeName, setResumeName] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [prepareSteps, setPrepareSteps] = useState<PrepareStepState[]>([]);

  useEffect(() => {
    const draft = readInterviewDraft();
    if (!draft) return;
    setCompany(draft.company);
    setJobTitle(draft.jobTitle);
    setJobDescription(draft.jobDescription);
    setInterviewType(draft.interviewType);
    if (draft.interviewMode === "practice" || draft.interviewMode === "mock") setInterviewMode(draft.interviewMode);
    setDuration(draft.durationChoice);
    if (draft.jobListing) setJobListing(draft.jobListing);
    if (draft.jobListing && draft.jobDescription.trim().length >= MIN_JOB_DESCRIPTION_CHARS) {
      setReadListing(draft.jobListing.trim());
    }
  }, []);

  function currentDraft() {
    return {
      company: company.trim(),
      jobTitle: jobTitle.trim(),
      jobDescription: jobDescription.trim(),
      interviewType,
      interviewMode,
      durationChoice: duration,
      jobListing: jobListing.trim(),
    };
  }

  async function extractListing() {
    setError(null);
    const listing = jobListing.trim();
    if (listing.length < MIN_JOB_LISTING_CHARS) {
      setError("Paste a job listing first.");
      return;
    }
    if (listing.length > MAX_JOB_LISTING_CHARS) {
      setError("That job listing is too long.");
      return;
    }
    setExtracting(true);
    try {
      const response = await fetch("/api/interview/listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing }),
      });
      const body: unknown = await response.json().catch(() => null);
      const message =
        body && typeof body === "object" && "error" in body && typeof body.error === "string"
          ? body.error
          : "We couldn't read that listing. Paste the full posting and try again.";
      if (!response.ok || !isExtracted(body)) {
        setError(message);
        return;
      }
      setCompany(body.company);
      setJobTitle(body.jobTitle);
      setJobDescription(body.jobDescription);
      setReadListing(listing);
      saveInterviewDraft({
        ...currentDraft(),
        company: body.company.trim(),
        jobTitle: body.jobTitle.trim(),
        jobDescription: body.jobDescription.trim(),
        jobListing: listing,
      });
      if (!body.company.trim() || !body.jobTitle.trim() || body.jobDescription.trim().length < MIN_JOB_DESCRIPTION_CHARS) {
        setError("We couldn't find the company, title, and description. Paste the full posting.");
      }
    } catch {
      setError("We couldn't read that listing. Paste the full posting and try again.");
    } finally {
      setExtracting(false);
    }
  }

  async function acceptResume(file: File, source: "input" | "drop") {
    const problem = await resumeProblem(file);
    if (problem) {
      setError(problem);
      setResumeName(null);
      if (resumeRef.current) resumeRef.current.value = "";
      return;
    }
    if (source === "drop" && resumeRef.current) {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      resumeRef.current.files = transfer.files;
    }
    setResumeName(file.name);
    setError(null);
  }

  function roleReady() {
    return Boolean(company.trim() && jobTitle.trim() && jobDescription.trim().length >= MIN_JOB_DESCRIPTION_CHARS);
  }

  function goNext() {
    if (step === 0 && (jobListing.trim().length === 0 || jobListing.trim() !== readListing)) {
      setError("Paste the full job listing, then read it.");
      return;
    }
    if (step === 0 && !roleReady()) {
      setError("Add the company and job title from that listing.");
      return;
    }
    if (step === 1 && !resumeRef.current?.files?.[0]) {
      setError("Upload your resume PDF.");
      return;
    }
    setError(null);
    setStep((current) => Math.min(current + 1, 2));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const resume = form.get("resume");
    if (!(resume instanceof File) || resume.size === 0) {
      setError("Upload your resume PDF.");
      setStep(1);
      return;
    }
    if (!roleReady()) {
      setError("Paste the full job listing, then read it.");
      setStep(0);
      return;
    }

    saveInterviewDraft(currentDraft());
    setSubmitting(true);
    setPrepareSteps(initialPrepareSteps(company));
    let leaving = false;
    try {
      const response = await fetch("/api/interview/prepare", { method: "POST", body: form });
      if (response.status === 413) {
        setError("That PDF is too large for the site. Use a file under 6 MB.");
        return;
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("ndjson")) {
        const body: unknown = await response.json().catch(() => null);
        const message =
          body && typeof body === "object" && "error" in body && typeof body.error === "string"
            ? body.error
            : "The interview plan could not be created. Check the job description and resume, then try again.";
        setError(message);
        return;
      }
      const prepared = await readPrepareEvents(response, (step, state) => {
        setPrepareSteps((current) => current.map((item) => (item.id === step ? { ...item, state } : item)));
      });
      if (prepared.error || !prepared.summary) {
        setError(prepared.error || "Preparing the interview was interrupted before it finished. Try again.");
        return;
      }
      if (prepared.debug) savePreparationDebug(prepared.debug);
      const summary = prepared.summary;
      saveInterviewSetup({
        interviewId: summary.interviewId,
        company: summary.company,
        jobTitle: summary.jobTitle,
        interviewType: summary.interviewType,
        interviewMode: summary.interviewMode,
        targetDurationMinutes: summary.targetDurationMinutes,
        durationChoice: summary.durationChoice,
        resumeFileName: summary.resumeFileName,
        levelLabel: summary.levelLabel,
        emphasisLabel: summary.emphasisLabel,
      });
      leaving = true;
      router.push("/interview/prepare");
    } catch {
      setError("The interview plan could not be created. Check the job description and resume, then try again.");
    } finally {
      if (!leaving) setSubmitting(false);
    }
  }

  return (
    <PageShell>
      {submitting ? <PreparingScreen company={company} jobTitle={jobTitle} steps={prepareSteps} /> : null}
      <header className="flex flex-col gap-3">
        <h1 className="text-4xl font-semibold tracking-tight">Build your mock interview</h1>
        <p className="text-lg text-muted">A few details, then you can step into the room.</p>
      </header>
      <ProgressSteps current={step} />
      <form className="flex flex-col gap-6" onSubmit={(event) => void onSubmit(event)}>
        <input
          ref={resumeRef}
          id={resumeInputId}
          name="resume"
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) void acceptResume(file, "input");
          }}
        />
        <input type="hidden" name="company" value={company} />
        <input type="hidden" name="jobTitle" value={jobTitle} />
        <input type="hidden" name="jobDescription" value={jobDescription} />
        <input type="hidden" name="interviewType" value={interviewType} />
        <input type="hidden" name="interviewMode" value={interviewMode} />
        <input type="hidden" name="duration" value={duration} />
        <div key={step} className="step-enter flex flex-col gap-6">
          {step === 0 ? (
            <RoleStep
              company={company}
              jobTitle={jobTitle}
              jobListing={jobListing}
              listingRead={readListing.length > 0 && jobListing.trim() === readListing}
              onCompany={setCompany}
              onTitle={setJobTitle}
              onListing={(value) => {
                setJobListing(value);
                if (value.trim() !== readListing) setJobDescription("");
              }}
            />
          ) : null}
          {step === 1 ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-semibold tracking-tight">Give your interviewer some context</h2>
                <p className="text-muted">A PDF resume is enough. You’ll review everything before the interview starts.</p>
              </div>
              <UploadZone fileName={resumeName} inputId={resumeInputId} onFile={(file) => void acceptResume(file, "drop")} />
            </div>
          ) : null}
          {step === 2 ? (
            <InterviewStep
              interviewType={interviewType}
              interviewMode={interviewMode}
              duration={duration}
              onType={setInterviewType}
              onMode={setInterviewMode}
              onDuration={setDuration}
            />
          ) : null}
        </div>
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          {step > 0 ? (
            <Button type="button" variant="secondary" onClick={() => setStep((current) => current - 1)} disabled={submitting}>
              Back
            </Button>
          ) : null}
          {step === 0 && (jobListing.trim().length === 0 || jobListing.trim() !== readListing) ? (
            <Button type="button" onClick={() => void extractListing()} disabled={extracting}>
              {extracting ? "Reading listing…" : "Read listing"}
            </Button>
          ) : step < 2 ? (
            <Button type="button" onClick={goNext}>
              Continue
            </Button>
          ) : (
            <Button type="submit" disabled={submitting}>
              Get my interview ready
            </Button>
          )}
        </div>
      </form>
    </PageShell>
  );
}

function RoleStep({
  company,
  jobTitle,
  jobListing,
  listingRead,
  onCompany,
  onTitle,
  onListing,
}: {
  company: string;
  jobTitle: string;
  jobListing: string;
  listingRead: boolean;
  onCompany: (value: string) => void;
  onTitle: (value: string) => void;
  onListing: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight">Who are you interviewing with?</h2>
        <p className="text-muted">Paste the full posting from LinkedIn, Indeed, or the company site.</p>
      </div>
      <Field label="Job listing">
        <TextArea
          value={jobListing}
          onChange={(event) => onListing(event.target.value)}
          maxLength={MAX_JOB_LISTING_CHARS}
          placeholder="Paste the entire job listing"
        />
      </Field>
      {listingRead ? (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Company">
              <TextInput value={company} onChange={(event) => onCompany(event.target.value)} maxLength={MAX_COMPANY_CHARS} />
            </Field>
            <Field label="Job title">
              <TextInput value={jobTitle} onChange={(event) => onTitle(event.target.value)} maxLength={MAX_JOB_TITLE_CHARS} />
            </Field>
          </div>
          <Card className="flex flex-col gap-2 p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">From the listing</p>
            <p className="text-xl font-semibold">{company.trim() || "Company"}</p>
            <p className="text-muted">{jobTitle.trim() || "Role"}</p>
            <p className="text-sm text-accent">Mock interview</p>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function InterviewStep({
  interviewType,
  interviewMode,
  duration,
  onType,
  onMode,
  onDuration,
}: {
  interviewType: InterviewType;
  interviewMode: InterviewMode;
  duration: DurationChoice;
  onType: (value: InterviewType) => void;
  onMode: (value: InterviewMode) => void;
  onDuration: (value: DurationChoice) => void;
}) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight">How should this interview feel?</h2>
        <p className="text-muted">Choose both, then we’ll build the interview.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {interviewTypeOptions.map((option) => (
          <ChoiceCard
            key={option.value}
            selected={interviewType === option.value}
            title={option.label}
            description={option.description}
            icon={<TypeMark type={option.value} />}
            onSelect={() => onType(option.value)}
          />
        ))}
      </div>
      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-medium">How long do you want to practice?</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {durationOptions.map((option) => (
            <ChoiceCard
              key={option.value}
              selected={duration === option.value}
              title={option.label}
              description={option.detail}
              badge={option.recommended ? "Recommended" : undefined}
              icon={<span className="text-xs font-semibold">{option.value === "unsure" ? "~30" : option.value}</span>}
              onSelect={() => onDuration(option.value)}
            />
          ))}
        </div>
        <p className="text-sm text-muted">
          Your interviewer will manage the pacing naturally, so the conversation may finish slightly early or run a little longer.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-medium">How do you want to practice?</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceCard
            selected={interviewMode === "practice"}
            title="Practice Mode"
            description="Pause anytime and get coaching when you're stuck."
            badge="Recommended for learning"
            icon={<ModeMark mode="practice" />}
            onSelect={() => onMode("practice")}
          />
          <ChoiceCard
            selected={interviewMode === "mock"}
            title="Mock Interview"
            description="Complete the interview without assistance and see how you perform under realistic conditions."
            icon={<ModeMark mode="mock" />}
            onSelect={() => onMode("mock")}
          />
        </div>
      </div>
    </div>
  );
}

function ModeMark({ mode }: { mode: InterviewMode }) {
  const path =
    mode === "practice"
      ? "M9 18h6M10 21h4M12 3a6 6 0 0 0-3 11c.4.4.7.9.8 1.4h4.4c.1-.5.4-1 .8-1.4A6 6 0 0 0 12 3z"
      : "M5 6h14v12H5zM8 10h8M8 14h5";
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d={path} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TypeMark({ type }: { type: InterviewType }) {
  const path = {
    mixed: "M4 12h16M8 7h8M8 17h8",
    "hiring-manager": "M5 8h14v10H5zM9 8V6h6v2",
    behavioral: "M5 7h10v7H8l-3 3z",
    recruiter: "M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 19c1.2-2.2 3-3.2 6-3.2S16.8 16.8 18 19",
    "role-specific": "M12 5l2.2 4.6L19 12l-4.8 2.4L12 19l-2.2-4.6L5 12l4.8-2.4z",
  }[type];
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d={path} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function isExtracted(value: unknown): value is { company: string; jobTitle: string; jobDescription: string } {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.company === "string" && typeof record.jobTitle === "string" && typeof record.jobDescription === "string";
}

function initialPrepareSteps(company: string): PrepareStepState[] {
  const name = company.trim() || "the company";
  return [
    { id: "analyzing_resume", label: "Analyzing your resume", state: "pending" },
    { id: "understanding_role", label: "Understanding the role", state: "pending" },
    { id: "calibrating_difficulty", label: "Calibrating interview difficulty", state: "pending" },
    { id: "researching_company", label: `Researching ${name}'s interview approach`, state: "pending" },
    { id: "building_plan", label: "Building your interview plan", state: "pending" },
  ];
}

async function readPrepareEvents(
  response: Response,
  onStep: (step: string, state: "active" | "done") => void,
): Promise<{ summary: ReturnType<typeof isSummary> extends infer T ? T : never; debug?: PreparationDebug; error?: string }> {
  const reader = response.body?.getReader();
  if (!reader) return { summary: null, error: "The interview plan could not be created. Check the job description and resume, then try again." };
  const decoder = new TextDecoder();
  let buffer = "";
  let summary: ReturnType<typeof isSummary> = null;
  let debug: PreparationDebug | undefined;
  let error = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as {
        step?: string;
        state?: "active" | "done";
        error?: string;
        summary?: unknown;
        debug?: PreparationDebug;
      };
      if (event.step === "error") error = event.error || error;
      if (event.step && event.state) onStep(event.step, event.state);
      if (event.step === "ready") {
        summary = isSummary(event.summary);
        if (event.debug?.blueprint) debug = event.debug;
      }
    }
  }
  return { summary, debug, error };
}

function isSummary(value: unknown) {
  if (!isPlanResponse(value)) return null;
  return value;
}

function isPlanResponse(value: unknown): value is {
  interviewId: string;
  company: string;
  jobTitle: string;
  interviewType: InterviewType;
  interviewMode: InterviewMode;
  targetDurationMinutes: number;
  durationChoice: DurationChoice;
  resumeFileName: string;
  levelLabel: string;
  emphasisLabel: string;
} {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.interviewId === "string" &&
    typeof record.company === "string" &&
    typeof record.jobTitle === "string" &&
    typeof record.interviewType === "string" &&
    (record.interviewMode === "practice" || record.interviewMode === "mock") &&
    typeof record.targetDurationMinutes === "number" &&
    typeof record.durationChoice === "string" &&
    typeof record.resumeFileName === "string" &&
    typeof record.levelLabel === "string" &&
    typeof record.emphasisLabel === "string"
  );
}

async function resumeProblem(file: File): Promise<string | null> {
  const pdfName = file.name.toLowerCase().endsWith(".pdf");
  const pdfType = file.type === "application/pdf" || file.type === "";
  if ((!pdfName && file.type !== "application/pdf") || (!pdfType && !pdfName) || file.size === 0) {
    return "Upload a PDF resume.";
  }
  if (file.size > MAX_PDF_BYTES) return "That PDF is too large. Use a file under 8 MB.";
  const header = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  const pdf = [0x25, 0x50, 0x44, 0x46].every((byte, index) => header[index] === byte);
  if (!pdf) return "Upload a PDF resume.";
  return null;
}
