import assert from "node:assert/strict";
import test from "node:test";

import { analysisInstructions, analysisInput } from "./analysis-prompt";
import {
  excessiveStoryReuse,
  groundImprovedAnswer,
  openingLengthIsFine,
  showMissingEvidence,
  ungroundedNumbers,
} from "./analysis-grounding";
import { clearStar } from "./star";
import type { InterviewBlueprint, InterviewConfig } from "./types";

test("40 and 100 second openings are not treated as length failures", () => {
  assert.equal(openingLengthIsFine(40), true);
  assert.equal(openingLengthIsFine(100), true);
  assert.equal(openingLengthIsFine(20), false);
  assert.equal(openingLengthIsFine(140), false);
  assert.match(analysisInstructions, /walks through jobs in order/);
});

test("an improved answer cannot introduce a number from outside the sources", () => {
  const sources = ["The transcript says the report reached 12 managers."];
  assert.deepEqual(ungroundedNumbers("It reached 12 managers and saved 40%.", sources), ["40%"]);
  assert.equal(groundImprovedAnswer("It reached 12 managers and saved 40%.", sources), "It reached 12 managers and saved [number not in the source].");
});

test("a missing result or learning is shown instead of invented", () => {
  const coverage = clearStar("missing");
  coverage.result = "missing";
  assert.match(showMissingEvidence("I fixed the report.", coverage), /result not in the answer/);
  assert.match(showMissingEvidence("I fixed the report.", coverage), /learning not in the answer/);
  assert.equal(showMissingEvidence("Why this company matters.", null), "Why this company matters.");
});

test("using one story twice is fine, and using it for most of the interview is flagged", () => {
  assert.equal(excessiveStoryReuse(["Campus dashboard", "Campus dashboard"]), false);
  assert.equal(excessiveStoryReuse(["Campus dashboard", "Campus dashboard", "Campus dashboard", "Needs a story"]), true);
});

test("a fine opening does not add a length warning to the analysis input", () => {
  const config: InterviewConfig = {
    company: "Northwind",
    jobTitle: "Analyst",
    jobDescription: "Reporting",
    interviewType: "behavioral",
    interviewMode: "mock",
    targetDurationMinutes: 30,
    candidate: { resumeText: "Built a dashboard." },
  };
  const blueprint = {
    candidateLevel: "recent_grad",
    overallDifficulty: 2,
    difficultyCurve: { opening: 1, early: 2, middle: 2, late: 2 },
    interviewerTone: "Calm",
    openingStrategy: "Ask about background.",
    questionMix: { background: 1, behavioral: 1, resume: 1, technical: 0, situational: 0, motivation: 1 },
    competencyPriorities: [],
    resumeTopicsToProbe: [],
    roleTopicsToProbe: [],
    companyStyle: { summary: "", confidence: "low", behavioralEmphasis: "", technicalEmphasis: "", commonQuestionPatterns: [] },
    followUpGuidance: [],
    behaviorsToAvoid: [],
    pacingGuidance: "",
    closingStrategy: "",
    experienceCalibration: {
      careerStage: "recent_grad",
      jobSeniority: "recent_grad",
      roleComplexity: 2,
      interviewDifficulty: 2,
      leadershipAuthority: "low",
      stakeholderInfluence: "low",
      strategicDecisionAuthority: "low",
      independentProjectOwnership: "moderate",
      peopleManagement: "none",
      challengeThinking: true,
      avoidUnsupportedAuthorityAssumptions: true,
      allowExperienceLevelReframe: true,
      ceilingSummary: "Recent graduate.",
      screenedThemes: [],
    },
    coverage: [],
    privateFlow: "",
  } satisfies InterviewBlueprint;
  const turns = [
    { id: "q", speaker: "interviewer" as const, text: "Tell me about yourself.", timestampMs: 0 },
    { id: "a", speaker: "candidate" as const, text: "I studied business and built a sales dashboard.", timestampMs: 5_000 },
    { id: "n", speaker: "interviewer" as const, text: "What did the team use it for?", timestampMs: 45_000 },
  ];
  const input = analysisInput(config, blueprint, turns, 60_000);
  assert.equal(input.includes("Measured opening answer"), false);
});
