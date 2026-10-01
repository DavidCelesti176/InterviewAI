import OpenAI from "openai";

import { buildDifficultyCurve, overallDifficulty } from "@/lib/interview/difficulty";
import { buildExperienceCalibration, screenTheme } from "@/lib/interview/experience-calibration";
import type {
  CompanyInterviewProfile,
  DifficultyCurve,
  InterviewBlueprint,
  InterviewConfig,
  InterviewType,
  RoleAnalysis,
} from "@/lib/interview/types";
import { planModel } from "@/lib/live/config";

const blueprintSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    interviewerTone: { type: "string" },
    openingStrategy: { type: "string" },
    questionMix: {
      type: "object",
      additionalProperties: false,
      properties: {
        background: { type: "number" },
        behavioral: { type: "number" },
        resume: { type: "number" },
        technical: { type: "number" },
        situational: { type: "number" },
        motivation: { type: "number" },
      },
      required: ["background", "behavioral", "resume", "technical", "situational", "motivation"],
    },
    competencyPriorities: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          competency: { type: "string" },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          reason: { type: "string" },
        },
        required: ["competency", "priority", "reason"],
      },
    },
    resumeTopicsToProbe: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          topic: { type: "string" },
          reason: { type: "string" },
        },
        required: ["topic", "reason"],
      },
    },
    roleTopicsToProbe: { type: "array", items: { type: "string" } },
    followUpGuidance: { type: "array", items: { type: "string" } },
    behaviorsToAvoid: { type: "array", items: { type: "string" } },
    pacingGuidance: { type: "string" },
    closingStrategy: { type: "string" },
  },
  required: [
    "interviewerTone",
    "openingStrategy",
    "questionMix",
    "competencyPriorities",
    "resumeTopicsToProbe",
    "roleTopicsToProbe",
    "followUpGuidance",
    "behaviorsToAvoid",
    "pacingGuidance",
    "closingStrategy",
  ],
} as const;

const typeNotes: Record<InterviewType, string> = {
  mixed: "Balance motivation, a behavioral example, and role-specific work.",
  "hiring-manager": "Emphasize how the candidate has done the work, decisions, results, and collaboration.",
  behavioral: "Emphasize past examples with a clear personal action and an outcome.",
  recruiter: "Emphasize motivation, communication, and basic fit. Avoid a deep technical work sample.",
  "role-specific": "Emphasize the concrete skills and situations in the job description.",
};

function juniorOpening(level: RoleAnalysis["candidateLevel"]): boolean {
  return level === "intern" || level === "recent_grad" || level === "entry" || level === "early_career";
}

function authoredPacing(level: RoleAnalysis["candidateLevel"], minutes: number, curve: DifficultyCurve): string {
  const wrap = Math.round(minutes * 0.8);
  const levelNote = juniorOpening(level)
    ? "Start accessible and raise depth gradually."
    : "Keep the questions sophisticated and the tone conversational. Harder questions do not mean more follow-ups.";
  return `Question complexity follows opening ${curve.opening}, early ${curve.early}, middle ${curve.middle}, late ${curve.late}. Ease off between demanding questions instead of holding the top number. ${levelNote} After about ${wrap} minutes, finish the current thread instead of opening another deep one.`;
}

function companyStyle(profile: CompanyInterviewProfile): InterviewBlueprint["companyStyle"] {
  if (profile.confidence === "low") {
    return {
      summary: "Public evidence about this company's interview style is limited. Do not imitate a company-specific ritual.",
      confidence: "low",
      behavioralEmphasis: "unknown",
      technicalEmphasis: "unknown",
      commonQuestionPatterns: [],
    };
  }
  return {
    summary: profile.summary,
    confidence: profile.confidence,
    behavioralEmphasis: profile.behavioralEmphasis,
    technicalEmphasis: profile.technicalEmphasis,
    commonQuestionPatterns: profile.commonQuestionPatterns.slice(0, 4),
  };
}

export async function buildInterviewBlueprint(
  config: InterviewConfig,
  role: RoleAnalysis,
  profile: CompanyInterviewProfile,
): Promise<InterviewBlueprint> {
  const curve = buildDifficultyCurve(role.candidateLevel, role.recommendedInterviewDifficulty);
  const calibration = buildExperienceCalibration(role);
  const client = new OpenAI({ maxRetries: 0 });
  const response = await client.responses.create({
    model: planModel(),
    instructions:
      "Build private guidance for a live interviewer. Do not write a numbered script. Priority order: job description, candidate experience ceiling, interview type, resume, then company style. Company style never raises the authority you may assume. A hard question tests thinking about work the candidate could have done, not a more senior job. Question-mix numbers are rough percentages. Follow-up notes are angles to use only when an answer is vague, incomplete, or important. Do not write notes that say to probe every answer. Pacing should vary difficulty and leave time to move on. Return at most 5 competencies, 5 resume topics, 5 role topics, 3 follow-up notes, and 4 behaviors to avoid.",
    input: `Interview type: ${config.interviewType}. ${typeNotes[config.interviewType]}
${calibration.ceilingSummary}
${calibration.avoidUnsupportedAuthorityAssumptions ? "Behavioral themes must stay inside that ceiling. Use internships, class projects, part-time work, campus roles, or a small business at its real scale. Do not plan questions about persuading executives, managing employees, or owning enterprise strategy." : "Leadership and strategy questions are appropriate when they match the scope above."}
Candidate level: ${role.candidateLevel}
Difficulty curve from 1 to 5: opening ${curve.opening}, early ${curve.early}, middle ${curve.middle}, late ${curve.late}
Company confidence: ${profile.confidence}
Company style summary: ${profile.confidence === "low" ? "Limited public evidence. Do not invent a company style." : profile.summary}
Behavioral emphasis: ${profile.behavioralEmphasis}
Technical emphasis: ${profile.technicalEmphasis}
Case emphasis: ${profile.caseInterviewEmphasis}

Job title: ${config.jobTitle}
Job description:
${config.jobDescription}

Role competencies:
${role.keyCompetencies.map((item) => `${item.name} (${item.importance})`).join("\n")}

Resume:
${config.candidate.resumeText}`,
    text: {
      format: {
        type: "json_schema",
        name: "interview_blueprint",
        strict: true,
        schema: blueprintSchema,
      },
    },
  });

  const parsed = JSON.parse(response.output_text) as Omit<
    InterviewBlueprint,
    "candidateLevel" | "overallDifficulty" | "difficultyCurve" | "companyStyle" | "experienceCalibration"
  >;
  if (!parsed.openingStrategy.trim() || !parsed.interviewerTone.trim()) {
    throw new Error("Interview blueprint was incomplete");
  }

  const openingStrategy = juniorOpening(role.candidateLevel)
    ? "Begin conversationally. Ask one accessible question about their background, what interested them in this role, or a simple walk-through of an internship, project, or recent experience. Do not open with a strategic challenge, a case, or a multi-part problem."
    : parsed.openingStrategy;

  const avoid = new Set(parsed.behaviorsToAvoid);
  avoid.add("Coaching the candidate or praising every answer");
  avoid.add("Following up on every complete answer");
  avoid.add("Stacking difficult questions without an easier transition");
  if (juniorOpening(role.candidateLevel)) {
    avoid.add("Opening with an advanced strategic, case, or technical challenge");
  }
  if (calibration.avoidUnsupportedAuthorityAssumptions) {
    avoid.add("Asking for executive influence, people management, or enterprise strategy the candidate has not had");
  }

  const screenedThemes: string[] = [];
  const followUpGuidance = parsed.followUpGuidance
    .map((note) => note.trim())
    .filter((note) => note && !/\b(always|every answer|each answer|every response)\b/i.test(note))
    .filter((note) => {
      const screened = screenTheme(note, calibration);
      if (!screened.keep) screenedThemes.push(note);
      return screened.keep;
    })
    .slice(0, 3);
  const roleTopics = parsed.roleTopicsToProbe
    .map((topic) => topic.trim())
    .filter(Boolean)
    .filter((topic) => {
      const screened = screenTheme(topic, calibration);
      if (!screened.keep) screenedThemes.push(topic);
      return screened.keep;
    })
    .slice(0, 5);
  if (roleTopics.length === 0 && calibration.avoidUnsupportedAuthorityAssumptions) {
    roleTopics.push("a project they personally worked on", "how they checked the work", "how they explained the result");
  }

  return {
    candidateLevel: role.candidateLevel,
    overallDifficulty: overallDifficulty(role.candidateLevel, role.recommendedInterviewDifficulty),
    difficultyCurve: curve,
    interviewerTone: parsed.interviewerTone,
    openingStrategy,
    questionMix: parsed.questionMix,
    competencyPriorities: parsed.competencyPriorities.slice(0, 5),
    resumeTopicsToProbe: parsed.resumeTopicsToProbe
      .filter((item) => {
        const screened = screenTheme(`${item.topic} ${item.reason}`, calibration);
        if (!screened.keep) screenedThemes.push(item.topic);
        return screened.keep;
      })
      .slice(0, 5),
    roleTopicsToProbe: roleTopics,
    companyStyle: companyStyle(profile),
    followUpGuidance:
      followUpGuidance.length > 0
        ? followUpGuidance
        : ["Ask what they personally did, or what changed, only when that part of the answer is missing."],
    behaviorsToAvoid: [...avoid].slice(0, 8),
    pacingGuidance: authoredPacing(role.candidateLevel, config.targetDurationMinutes, curve),
    closingStrategy: parsed.closingStrategy,
    experienceCalibration: { ...calibration, screenedThemes },
  };
}

export function curveFor(role: RoleAnalysis): DifficultyCurve {
  return buildDifficultyCurve(role.candidateLevel, role.recommendedInterviewDifficulty);
}
