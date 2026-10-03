import OpenAI from "openai";

import { isSameOrigin } from "@/lib/http/same-origin";
import { analyzeRole } from "@/lib/interview/analyze-role";
import { finishPreparedInterview, storedRoleAnalysis } from "@/lib/interview/prepare";
import { researchCompany, unavailableCompanyProfile } from "@/lib/interview/research-company";
import { readInterviewSubmission, readStoredConfig } from "@/lib/interview/submission";
import type { CompanyInterviewProfile } from "@/lib/interview/types";

export const runtime = "nodejs";
export const maxDuration = 30;

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}

function isProfile(value: unknown): value is CompanyInterviewProfile {
  if (!value || typeof value !== "object") return false;
  const profile = value as CompanyInterviewProfile;
  return typeof profile.company === "string" && typeof profile.summary === "string" && typeof profile.confidence === "string";
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Unexpected request origin", 403);
  if (!process.env.OPENAI_API_KEY) return jsonError("Set OPENAI_API_KEY on the server", 503);

  const stage = new URL(request.url).searchParams.get("stage") || "intake";

  try {
    if (stage === "intake") {
      let form: FormData;
      try {
        form = await request.formData();
      } catch {
        return jsonError("The interview form could not be read.", 400);
      }
      const submission = await readInterviewSubmission(form);
      if (!submission.ok) return jsonError(submission.error, submission.status);
      return Response.json({
        config: submission.config,
        resumeFileName: submission.resumeFileName,
        durationChoice: submission.durationChoice,
      });
    }

    const body = await readJson(request);
    if (!body) return jsonError("The interview form could not be read.", 400);

    if (stage === "role") {
      const config = readStoredConfig(body.config);
      if (!config) return jsonError("The interview details could not be read. Try again.", 400);
      const roleAnalysis = await analyzeRole(config);
      return Response.json({ roleAnalysis });
    }

    if (stage === "company") {
      const company = typeof body.company === "string" ? body.company.trim() : "";
      const jobTitle = typeof body.jobTitle === "string" ? body.jobTitle.trim() : "";
      if (!company || !jobTitle) return jsonError("Enter a company and job title.", 400);
      const researched = await researchCompany(company, jobTitle);
      return Response.json(researched);
    }

    if (stage === "finish") {
      const config = readStoredConfig(body.config);
      const roleAnalysis = storedRoleAnalysis(body.roleAnalysis);
      const resumeFileName = typeof body.resumeFileName === "string" ? body.resumeFileName.slice(0, 180) : "";
      const durationChoice = typeof body.durationChoice === "string" ? body.durationChoice : "";
      if (!config || !roleAnalysis || !resumeFileName || !durationChoice) {
        return jsonError("The interview plan could not be created. Try again.", 400);
      }
      const companyBody = body.company;
      const profile =
        companyBody && typeof companyBody === "object" && isProfile((companyBody as { profile?: unknown }).profile)
          ? (companyBody as { profile: CompanyInterviewProfile; cacheHit?: boolean })
          : null;
      const prepared = await finishPreparedInterview({
        config,
        resumeFileName,
        durationChoice,
        roleAnalysis,
        company: profile
          ? { profile: profile.profile, cacheHit: profile.cacheHit === true }
          : { profile: unavailableCompanyProfile(config.company), cacheHit: false },
      });
      return Response.json({
        summary: prepared.summary,
        debug: process.env.NODE_ENV === "development" ? prepared.debug : undefined,
      });
    }

    return jsonError("Unknown preparation step.", 400);
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      console.error("Interview prepare failed", stage, error.status, error.code ?? "", error.message);
    } else {
      console.error("Interview prepare failed", stage, error instanceof Error ? error.message : "error");
    }
    const timedOut = error instanceof Error && /timeout|timed out/i.test(error.message);
    return jsonError(
      timedOut
        ? "Preparing the interview was interrupted before it finished. Try again."
        : "The interview plan could not be created. Check the job description and resume, then try again.",
      502,
    );
  }
}
