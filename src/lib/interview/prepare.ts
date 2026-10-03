import { analyzeRole } from "@/lib/interview/analyze-role";
import { buildInterviewBlueprint, curveFor } from "@/lib/interview/build-blueprint";
import { levelLabel } from "@/lib/interview/difficulty";
import { interviewTypeLabel } from "@/lib/interview/labels";
import { researchCompany } from "@/lib/interview/research-company";
import { saveInterview } from "@/lib/interview/store";
import type { InterviewMode } from "@/lib/interview/help-types";
import type { CompanyInterviewProfile, InterviewConfig, InterviewType, PreparationDebug } from "@/lib/interview/types";

export type PrepareStep = "understanding_role" | "calibrating_difficulty" | "researching_company" | "building_plan";

export type PreparationSummary = {
  interviewId: string;
  company: string;
  jobTitle: string;
  interviewType: InterviewType;
  interviewMode: InterviewMode;
  interviewTypeLabel: string;
  targetDurationMinutes: number;
  durationChoice: string;
  resumeFileName: string;
  levelLabel: string;
  emphasisLabel: string;
};

export function emphasisLabel(profile: CompanyInterviewProfile, interviewType: InterviewType): string {
  if (profile.confidence === "low") return interviewTypeLabel(interviewType);
  if (profile.behavioralEmphasis === "high" || profile.behavioralEmphasis === "medium") return "Behavioral emphasis";
  if (profile.technicalEmphasis === "high" || profile.technicalEmphasis === "medium") return "Technical emphasis";
  if (profile.caseInterviewEmphasis === "high" || profile.caseInterviewEmphasis === "medium") return "Case-style emphasis";
  return interviewTypeLabel(interviewType);
}

export async function prepareInterview(input: {
  config: InterviewConfig;
  resumeFileName: string;
  durationChoice: string;
  onStep: (step: PrepareStep, state: "active" | "done") => void;
}): Promise<{ summary: PreparationSummary; debug: PreparationDebug }> {
  input.onStep("understanding_role", "active");
  input.onStep("researching_company", "active");
  const [roleAnalysis, company] = await Promise.all([
    analyzeRole(input.config),
    researchCompany(input.config.company, input.config.jobTitle),
  ]);
  input.onStep("understanding_role", "done");
  input.onStep("researching_company", "done");

  input.onStep("calibrating_difficulty", "active");
  const difficultyCurve = curveFor(roleAnalysis);
  input.onStep("calibrating_difficulty", "done");

  input.onStep("building_plan", "active");
  const blueprint = await buildInterviewBlueprint(input.config, roleAnalysis, company.profile);
  input.onStep("building_plan", "done");

  const id = crypto.randomUUID();
  await saveInterview({
    id,
    createdAt: Date.now(),
    resumeFileName: input.resumeFileName,
    config: input.config,
    blueprint,
    debug: {
      cacheHit: company.cacheHit,
      roleAnalysis,
      difficultyCurve,
      companyProfile: company.profile,
      blueprint,
    },
  });

  return {
    summary: {
      interviewId: id,
      company: input.config.company,
      jobTitle: input.config.jobTitle,
      interviewType: input.config.interviewType,
      interviewMode: input.config.interviewMode === "practice" ? "practice" : "mock",
      interviewTypeLabel: interviewTypeLabel(input.config.interviewType),
      targetDurationMinutes: input.config.targetDurationMinutes,
      durationChoice: input.durationChoice,
      resumeFileName: input.resumeFileName,
      levelLabel: levelLabel(roleAnalysis.candidateLevel),
      emphasisLabel: emphasisLabel(company.profile, input.config.interviewType),
    },
    debug: {
      cacheHit: company.cacheHit,
      roleAnalysis,
      difficultyCurve,
      companyProfile: company.profile,
      blueprint,
    },
  };
}
