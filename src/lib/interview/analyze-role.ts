import OpenAI from "openai";

import { clampScore } from "@/lib/interview/difficulty";
import { calibrateJobLevel, clampCandidateProfile, isCandidateProfile } from "@/lib/interview/experience-calibration";
import type { CandidateLevel, InterviewConfig, RoleAnalysis } from "@/lib/interview/types";
import { planModel, planReasoning, planRequestTimeoutMs } from "@/lib/live/config";

const levels: CandidateLevel[] = [
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

const roleAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    candidateLevel: { type: "string", enum: levels },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    reasoningSummary: { type: "string" },
    expectedExperienceYears: {
      type: "object",
      additionalProperties: false,
      properties: {
        min: { type: "number" },
        max: { type: "number" },
      },
      required: ["min", "max"],
    },
    roleComplexity: { type: "number" },
    technicalDepth: { type: "number" },
    leadershipExpectation: { type: "number" },
    strategicExpectation: { type: "number" },
    communicationExpectation: { type: "number" },
    keyCompetencies: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          importance: { type: "string", enum: ["low", "medium", "high"] },
          reason: { type: "string" },
        },
        required: ["name", "importance", "reason"],
      },
    },
    recommendedInterviewDifficulty: { type: "number" },
    candidateProfile: {
      type: "object",
      additionalProperties: false,
      properties: {
        careerStage: {
          type: "string",
          enum: ["student", "intern", "recent_grad", "entry", "early_career", "mid", "senior", "manager", "director", "executive"],
        },
        relevantExperienceYears: { type: "number" },
        internshipDepth: { type: "string", enum: ["none", "limited", "moderate", "strong"] },
        independentProjectOwnership: { type: "string", enum: ["low", "moderate", "high"] },
        leadershipAuthority: { type: "string", enum: ["low", "moderate", "high"] },
        stakeholderInfluence: { type: "string", enum: ["low", "moderate", "high"] },
        strategicDecisionAuthority: { type: "string", enum: ["low", "moderate", "high"] },
        peopleManagement: { type: "string", enum: ["none", "limited", "substantial"] },
        crossFunctionalExposure: { type: "string", enum: ["low", "moderate", "high"] },
        analyticalProjectDepth: { type: "string", enum: ["low", "moderate", "high"] },
        confidence: { type: "string", enum: ["low", "medium", "high"] },
        reasoningSummary: { type: "string" },
      },
      required: [
        "careerStage",
        "relevantExperienceYears",
        "internshipDepth",
        "independentProjectOwnership",
        "leadershipAuthority",
        "stakeholderInfluence",
        "strategicDecisionAuthority",
        "peopleManagement",
        "crossFunctionalExposure",
        "analyticalProjectDepth",
        "confidence",
        "reasoningSummary",
      ],
    },
  },
  required: [
    "candidateLevel",
    "confidence",
    "reasoningSummary",
    "expectedExperienceYears",
    "roleComplexity",
    "technicalDepth",
    "leadershipExpectation",
    "strategicExpectation",
    "communicationExpectation",
    "keyCompetencies",
    "recommendedInterviewDifficulty",
    "candidateProfile",
  ],
} as const;

export function isRoleAnalysis(value: unknown): value is RoleAnalysis {
  if (!value || typeof value !== "object") return false;
  const analysis = value as RoleAnalysis;
  return (
    levels.includes(analysis.candidateLevel) &&
    typeof analysis.reasoningSummary === "string" &&
    Array.isArray(analysis.keyCompetencies) &&
    isCandidateProfile(analysis.candidateProfile)
  );
}

export async function analyzeRole(config: InterviewConfig): Promise<RoleAnalysis> {
  const client = new OpenAI({ maxRetries: 0, timeout: planRequestTimeoutMs });
  const response = await client.responses.create({
    model: planModel(),
    reasoning: planReasoning,
    instructions:
      "Judge the job and the candidate separately. The job description decides who the job is hiring. The title is a weak signal: Supply Chain Manager, Account Manager, and Product Manager can be new-graduate or entry-level roles. Recent graduate, campus hire, graduating class, 0–2 years, no experience required, or internship-preferred language outweighs the word Manager. Internship experience preferred means the new hire may have interned. It does not make a full-time role an internship. A graduating student hired into a full-time job is recent_grad. Use intern only when the job itself is an internship. Do not treat Manager as people leadership unless the description says the person manages employees. Do not treat Analyst as entry-level unless the description says so. Do not raise the job level because the resume looks strong. Role complexity can be high even when the hire is a new graduate. Interview difficulty should follow the experience the job expects, not the complexity of the function. Scores are integers from 1 to 5. Use 0 for an unknown years bound. Return at most 5 competencies. Then profile the candidate from the resume only. A student or recent graduate who led a project, rotated across teams, or owns a small business still has low strategic decision authority and no enterprise people management. Do not turn campus leadership or a small business into executive influence. relevantExperienceYears is a number, 0 if unclear.",
    input: `Interview type: ${config.interviewType}

Job description:
${config.jobDescription}

Job title, weak signal only:
${config.jobTitle}

Resume, for the candidate profile only. Do not use it to raise the job's seniority:
${config.candidate.resumeText}`,
    text: {
      format: {
        type: "json_schema",
        name: "role_analysis",
        strict: true,
        schema: roleAnalysisSchema,
      },
    },
  });

  const parsed: unknown = JSON.parse(response.output_text);
  if (!isRoleAnalysis(parsed) || !parsed.reasoningSummary.trim()) {
    throw new Error("Role analysis was incomplete");
  }
  const leveled = calibrateJobLevel(
    {
      ...parsed,
      roleComplexity: clampScore(parsed.roleComplexity),
      technicalDepth: clampScore(parsed.technicalDepth),
      leadershipExpectation: clampScore(parsed.leadershipExpectation),
      strategicExpectation: clampScore(parsed.strategicExpectation),
      communicationExpectation: clampScore(parsed.communicationExpectation),
      recommendedInterviewDifficulty: clampScore(parsed.recommendedInterviewDifficulty),
      keyCompetencies: parsed.keyCompetencies.slice(0, 5),
      candidateProfile: {
        ...parsed.candidateProfile,
        reasoningSummary: parsed.candidateProfile.reasoningSummary.trim(),
      },
    },
    config.jobTitle,
    config.jobDescription,
  );
  return {
    ...leveled,
    candidateProfile: clampCandidateProfile(leveled.candidateProfile, leveled.candidateLevel),
  };
}
