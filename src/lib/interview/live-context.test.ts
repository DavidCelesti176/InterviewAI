import assert from "node:assert/strict";
import test from "node:test";

import { buildPracticeInstructions } from "./practice-prompt";
import type { PracticeFocus } from "./practice-types";
import { buildInterviewerInstructions } from "./prompt";
import type { ExperienceCalibration, InterviewBlueprint, InterviewConfig } from "./types";

const job = "Weekly reporting for the sales team. ".repeat(400);
const resume = "Built dashboards the sales team used each week. ".repeat(400);

const config: InterviewConfig = {
  company: "Northwind",
  jobTitle: "Sales Analyst",
  jobDescription: job,
  interviewType: "behavioral",
  interviewMode: "mock",
  targetDurationMinutes: 30,
  candidate: { resumeText: resume },
};

const calibration: ExperienceCalibration = {
  careerStage: "recent_grad",
  jobSeniority: "recent_grad",
  roleComplexity: 2,
  interviewDifficulty: 3,
  leadershipAuthority: "low",
  stakeholderInfluence: "low",
  strategicDecisionAuthority: "low",
  independentProjectOwnership: "moderate",
  peopleManagement: "none",
  challengeThinking: true,
  avoidUnsupportedAuthorityAssumptions: true,
  allowExperienceLevelReframe: true,
  ceilingSummary: "Recent graduate sales analyst.",
  screenedThemes: [],
};

const blueprint: InterviewBlueprint = {
  candidateLevel: "recent_grad",
  overallDifficulty: 3,
  difficultyCurve: { opening: 1, early: 2, middle: 3, late: 3 },
  interviewerTone: "Calm",
  openingStrategy: "Ask about their background.",
  questionMix: { background: 20, behavioral: 20, resume: 20, technical: 20, situational: 10, motivation: 10 },
  competencyPriorities: [{ competency: "Reporting", priority: "high", reason: "The job asks for it." }],
  resumeTopicsToProbe: [{ topic: "Dashboard work", reason: "They built one." }],
  roleTopicsToProbe: ["Weekly reporting"],
  companyStyle: {
    summary: "Limited public evidence.",
    confidence: "low",
    behavioralEmphasis: "unknown",
    technicalEmphasis: "unknown",
    commonQuestionPatterns: [],
  },
  followUpGuidance: ["Ask who used the report."],
  behaviorsToAvoid: ["Do not invent a company ritual."],
  pacingGuidance: "Leave time to move on.",
  closingStrategy: "Invite their questions.",
  experienceCalibration: calibration,
  coverage: [],
  privateFlow: "Do not announce interview phases.",
};

test("the live interviewer keeps the blueprint and a short slice of the source text", () => {
  const instructions = buildInterviewerInstructions(config, blueprint, "Claire");
  assert.match(instructions, /Reporting \(high\)/);
  assert.match(instructions, /Dashboard work/);
  assert.ok(instructions.length < job.length + resume.length);
  assert.equal(instructions.includes(job), false);
  assert.equal(instructions.includes(resume), false);
  assert.ok(instructions.includes(job.slice(0, 80)));
  assert.ok(instructions.includes(resume.slice(0, 80)));
  assert.match(instructions, /Do not coach them into the answer/);
  assert.equal(instructions.includes("Think of one specific situation"), false);
  const practice = buildInterviewerInstructions({ ...config, interviewMode: "practice" }, blueprint, "Claire");
  assert.match(practice, /Think of one specific situation from work, school, athletics, a project, or your business/);
});

test("practice instructions keep the questions ahead of the supporting text", () => {
  const practice: PracticeFocus = {
    questions: [
      {
        id: "q1",
        question: "How did the team use that dashboard?",
        answerSummary: "They described the charts.",
        whatHeldItBack: ["The result came last."],
        betterApproach: "Start with who used it.",
      },
    ],
  };
  const instructions = buildPracticeInstructions(config, blueprint, practice, "James");
  assert.match(instructions, /How did the team use that dashboard\?/);
  assert.equal(instructions.includes(job), false);
  assert.equal(instructions.includes(resume), false);
});
