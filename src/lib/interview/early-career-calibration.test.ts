import assert from "node:assert/strict";
import test from "node:test";

import { buildDifficultyCurve } from "./difficulty";
import { calibrationInstructions, screenTheme } from "./experience-calibration";
import {
  buildContinueInstruction,
  candidateQuestionsNotBeforeMinutes,
  interviewPhase,
  invitesCandidateQuestionsTooEarly,
  openingAnswerSeconds,
} from "./interview-phase";
import { isConnectivityCheck, pacingDiagnostics } from "./pacing-diagnostics";
import type { ExperienceCalibration, InterviewTurn } from "./types";

const recentGradSalesAnalyst = {
  role: "Sales Analyst",
  experience: "0–2 years, recent graduate, internship and project work, no corporate leadership authority",
  curve: { opening: 1, early: 2, middle: 3, late: 3 },
  targetMinutes: 30,
  mainQuestions: { min: 5, max: 8 },
};

const juniorCalibration: ExperienceCalibration = {
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

function turn(id: string, speaker: InterviewTurn["speaker"], text: string, timestampMs: number): InterviewTurn {
  return { id, speaker, text, timestampMs };
}

test("entry-level roles use a gentle difficulty curve", () => {
  for (const level of ["intern", "recent_grad", "entry", "early_career"] as const) {
    assert.deepEqual(buildDifficultyCurve(level, 5), recentGradSalesAnalyst.curve);
  }
});

test("a 30 minute interview does not invite candidate questions after only a few minutes", () => {
  assert.equal(candidateQuestionsNotBeforeMinutes(30), 22);
  assert.equal(invitesCandidateQuestionsTooEarly(6 * 60_000, 30), true);
  assert.equal(invitesCandidateQuestionsTooEarly(23 * 60_000, 30), false);
  const early = buildContinueInstruction({
    elapsedMs: 6 * 60_000,
    targetMinutes: recentGradSalesAnalyst.targetMinutes,
    turns: [turn("q1", "interviewer", "Tell me about a project you worked on.", 60_000)],
    pendingCandidateText: "I built a weekly sales report for the team.",
  });
  assert.match(early, /Do not invite their questions/);
  assert.match(early, /6 minutes/);
});

test("candidate-question mode does not return to an earlier topic", () => {
  const turns = [
    turn("1", "interviewer", "We're getting toward the end of my questions. What questions do you have for me?", 6 * 60_000),
    turn("2", "candidate", "Where do you think I would fit?", 6.5 * 60_000),
    turn("3", "interviewer", "When you said the one-pager was customizable, how did that work?", 7 * 60_000),
  ];
  assert.equal(interviewPhase(turns, 7 * 60_000, 30), "CANDIDATE_QUESTIONS");
  const instruction = buildContinueInstruction({
    elapsedMs: 7 * 60_000,
    targetMinutes: 30,
    turns,
    pendingCandidateText: "Where do you think I would fit?",
  });
  assert.match(instruction, /Do not return to CORE/);
  assert.match(instruction, /Answer the question they just asked/);
});

test("hello during a processing gap is not treated as an interview answer", () => {
  assert.equal(isConnectivityCheck("Hello?"), true);
  assert.equal(isConnectivityCheck("Are you there?"), true);
  assert.equal(isConnectivityCheck("I built a dashboard the sales team used each week."), false);
  const instruction = buildContinueInstruction({
    elapsedMs: 8 * 60_000,
    targetMinutes: 30,
    turns: [turn("1", "interviewer", "How did the team use that report?", 7 * 60_000)],
    pendingCandidateText: "Hello?",
  });
  assert.match(instruction, /connectivity check/);
});

test("a nearly three minute opening is measurable for coaching", () => {
  const turns = [
    turn("q", "interviewer", "Tell me about yourself.", 10_000),
    turn("a", "candidate", "I studied business, interned in sales analytics, and built several dashboards.", 20_000),
    turn("n", "interviewer", "What was the business need behind that work?", 190_000),
  ];
  const seconds = openingAnswerSeconds(turns);
  assert.ok(seconds !== null && seconds >= 150 && seconds < 180);
});

test("a fair early-career interview uses a handful of questions and light follow-ups", () => {
  const turns = [
    turn("1", "interviewer", "Tell me about yourself.", 30_000),
    turn("2", "candidate", "I am a recent graduate with an analytics internship.", 50_000),
    turn("3", "interviewer", "Let's talk about the business need behind the reporting project?", 90_000),
    turn("4", "candidate", "The team needed a weekly view of orders.", 120_000),
    turn("5", "interviewer", "How did you know the data was accurate?", 140_000),
    turn("6", "candidate", "I checked it against the source file.", 160_000),
    turn("7", "interviewer", "Let's shift to how you explained the finding?", 200_000),
    turn("8", "candidate", "I walked the sales partner through the chart.", 230_000),
    turn("9", "interviewer", "Let's move on to how you decide what to prioritize?", 280_000),
    turn("10", "candidate", "I ask what decision the report supports.", 310_000),
    turn("11", "interviewer", "Let's talk about a time you needed help from another person?", 360_000),
    turn("12", "candidate", "I needed product details from another intern.", 390_000),
    turn("13", "interviewer", "Let's shift to what you would want to learn in this role?", 440_000),
    turn("14", "candidate", "How the team uses reporting to support customers.", 470_000),
    turn("15", "interviewer", "What questions do you have for me?", 23 * 60_000),
  ];
  const pacing = pacingDiagnostics(turns, 23 * 60_000);
  assert.ok(pacing.mainQuestions >= recentGradSalesAnalyst.mainQuestions.min);
  assert.ok(pacing.mainQuestions <= recentGradSalesAnalyst.mainQuestions.max);
  assert.ok(pacing.maxConsecutiveFollowUps <= 2);
  assert.equal(invitesCandidateQuestionsTooEarly(pacing.candidateQuestionsAtMs ?? 0, 30), false);
  assert.equal(interviewPhase(turns, 23 * 60_000, 30), "CANDIDATE_QUESTIONS");
});

test("recent graduates are not planned into senior authority questions", () => {
  const senior = screenTheme(
    "Tell me about a time you had to get stakeholders with competing priorities aligned.",
    juniorCalibration,
  );
  const fitted = screenTheme(
    "Tell me about a time you had to work with people who had different priorities.",
    juniorCalibration,
  );
  assert.equal(senior.keep, false);
  assert.equal(fitted.keep, true);
  const guidance = calibrationInstructions(juniorCalibration);
  assert.match(guidance, /one level above/);
  assert.match(guidance, /different priorities/);
});
