import { analysisTierFor, sessionClassForMinutes } from "@/lib/billing/decide";
import { createInterviewGrant } from "@/lib/billing/store";
import { analyzeRole, isRoleAnalysis } from "@/lib/interview/analyze-role";
import { buildInterviewBlueprint, curveFor } from "@/lib/interview/build-blueprint";
import { levelLabel } from "@/lib/interview/difficulty";
import { interviewTypeLabel } from "@/lib/interview/labels";
import { researchCompany } from "@/lib/interview/research-company";
import { saveInterview } from "@/lib/interview/store";
import { readProfessionalStory } from "@/lib/firebase/data";
import { storyContextBlock } from "@/lib/story/story";
import type { InterviewMode } from "@/lib/interview/help-types";
import type { CompanyInterviewProfile, InterviewConfig, InterviewType, PreparationDebug, RoleAnalysis } from "@/lib/interview/types";

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

export async function finishPreparedInterview(input: {
  uid: string;
  interviewId?: string;
  config: InterviewConfig;
  resumeFileName: string;
  durationChoice: string;
  roleAnalysis: RoleAnalysis;
  company: { profile: CompanyInterviewProfile; cacheHit: boolean };
  useStory?: boolean;
}): Promise<{ summary: PreparationSummary; debug: PreparationDebug }> {
  const savedStory = input.useStory ? await readProfessionalStory(input.uid) : null;
  const storyContext = savedStory ? storyContextBlock(savedStory) : "";
  const difficultyCurve = curveFor(input.roleAnalysis);
  const blueprint = await buildInterviewBlueprint(input.config, input.roleAnalysis, input.company.profile, storyContext);

  const id = input.interviewId?.trim() || crypto.randomUUID();
  const sessionClass = sessionClassForMinutes(input.config.targetDurationMinutes);
  if (!sessionClass) throw new Error("Choose a 10-minute Quick Practice or a 30-minute full mock.");
  await saveInterview(
    input.uid,
    {
      id,
      createdAt: Date.now(),
      resumeFileName: input.resumeFileName,
      config: input.config,
      blueprint,
      ...(storyContext ? { storyContext } : {}),
      debug: {
        cacheHit: input.company.cacheHit,
        roleAnalysis: input.roleAnalysis,
        difficultyCurve,
        companyProfile: input.company.profile,
        blueprint,
      },
    },
    {
      status: "ready",
      durationChoice: input.durationChoice,
      levelLabel: levelLabel(input.roleAnalysis.candidateLevel),
      emphasisLabel: emphasisLabel(input.company.profile, input.config.interviewType),
    },
  );
  await createInterviewGrant({
    uid: input.uid,
    interviewId: id,
    sessionClass,
    practiceKind: null,
    targetMinutes: input.config.targetDurationMinutes,
    maxMinutes: input.config.targetDurationMinutes,
    analysisTier: analysisTierFor(sessionClass),
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
      levelLabel: levelLabel(input.roleAnalysis.candidateLevel),
      emphasisLabel: emphasisLabel(input.company.profile, input.config.interviewType),
    },
    debug: {
      cacheHit: input.company.cacheHit,
      roleAnalysis: input.roleAnalysis,
      difficultyCurve,
      companyProfile: input.company.profile,
      blueprint,
    },
  };
}

export function storedRoleAnalysis(value: unknown): RoleAnalysis | null {
  return isRoleAnalysis(value) ? value : null;
}

export async function prepareInterview(input: {
  uid: string;
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
  const sessionClass = sessionClassForMinutes(input.config.targetDurationMinutes);
  if (!sessionClass) throw new Error("Choose a 10-minute Quick Practice or a 30-minute full mock.");
  await saveInterview(
    input.uid,
    {
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
    },
    {
      status: "ready",
      durationChoice: input.durationChoice,
      levelLabel: levelLabel(roleAnalysis.candidateLevel),
      emphasisLabel: emphasisLabel(company.profile, input.config.interviewType),
    },
  );
  await createInterviewGrant({
    uid: input.uid,
    interviewId: id,
    sessionClass,
    practiceKind: null,
    targetMinutes: input.config.targetDurationMinutes,
    maxMinutes: input.config.targetDurationMinutes,
    analysisTier: analysisTierFor(sessionClass),
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
