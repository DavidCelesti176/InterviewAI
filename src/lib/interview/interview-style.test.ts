import assert from "node:assert/strict";
import test from "node:test";

import { planCoverage } from "./competencies";
import { buildContinueInstruction } from "./interview-phase";
import {
  applyCompanyStyle,
  closingReserveMinutes,
  frameworkForCompetency,
  mainTopicGuidance,
  openingFor,
  styleInstructions,
  styleProfile,
} from "./interview-style";
import { durationOptions } from "./labels";
import type { InterviewTurn } from "./types";

const quietCompany = { confidence: "low", behavioralEmphasis: "unknown", technicalEmphasis: "unknown" };

function turn(id: string, text: string): InterviewTurn {
  return { id, speaker: "interviewer", text, timestampMs: 60_000 };
}

test("a recruiter screen opens with background and motivation, not a behavioral competency", () => {
  const opening = openingFor("recruiter", true);
  const guide = styleInstructions("recruiter", 10, quietCompany, true);
  assert.match(opening, /tell you about themselves|walk through their background/i);
  assert.match(opening, /why this role/i);
  assert.match(opening, /Do not open with a behavioral competency question/);
  assert.match(guide, /then motivation/);
  assert.equal(/tell me about a time/i.test(opening), false);
});

test("a 30-minute recruiter screen stays a screen", () => {
  const guide = styleInstructions("recruiter", 30);
  assert.match(guide, /30-minute Recruiter Screen/);
  assert.match(guide, /does not turn the interview into a different type/);
  assert.match(guide, /At most one or two light past examples/);
  const planned = planCoverage(
    [
      { competency: "Motivation", priority: "high", reason: "Fit." },
      { competency: "Conflict", priority: "high", reason: "Useful later." },
      { competency: "Leadership", priority: "high", reason: "Useful later." },
      { competency: "Failure", priority: "high", reason: "Useful later." },
      { competency: "Teamwork", priority: "high", reason: "Useful later." },
    ],
    30,
    "recruiter",
  );
  const intendedStories = planned.filter((item) => item.role === "intended" && item.framework === "star");
  assert.ok(intendedStories.length <= 2);
  assert.equal(planned.find((item) => item.id === "motivation")?.framework, "motivation");
  const nudge = buildContinueInstruction({
    elapsedMs: 10 * 60_000,
    targetMinutes: 30,
    turns: [turn("1", "Tell me about yourself.")],
    interviewType: "recruiter",
  });
  assert.match(nudge, /still a screen/i);
  assert.match(nudge, /Do not open a difficult behavioral/);
});

test("a behavioral interview favors past-experience questions", () => {
  const guide = styleInstructions("behavioral", 30);
  assert.match(guide, /past-experience questions/);
  assert.match(guide, /specific situation/);
  assert.match(openingFor("behavioral", false), /Open briefly/);
  for (const id of ["conflict", "teamwork", "initiative", "failure", "ownership"]) {
    assert.equal(frameworkForCompetency(id, "behavioral"), "star");
  }
  assert.equal(frameworkForCompetency("motivation", "behavioral"), "motivation");
});

test("a hiring manager interview can go deeper on experience", () => {
  const profile = styleProfile("hiring-manager");
  assert.equal(profile.followUpDepth, "deep");
  assert.equal(profile.resumeDepth, "deep");
  const guide = styleInstructions("hiring-manager", 30);
  assert.match(guide, /deeper look at an interesting experience/);
  assert.match(guide, /explore one interesting answer further/);
  assert.match(guide, /does not stay on one topic|Do not interrogate one topic/);
});

test("a role-specific interview starts with setup and then the work", () => {
  const opening = openingFor("role-specific", true);
  const guide = styleInstructions("role-specific", 30, quietCompany, true);
  assert.match(opening, /one natural setup or background question/);
  assert.match(opening, /Do not cold-open/);
  assert.match(guide, /skills and realistic situations/);
  assert.equal(frameworkForCompetency("data_analysis", "role-specific"), "structured_reasoning");
  assert.equal(frameworkForCompetency("problem_solving", "role-specific"), "structured_reasoning");
  assert.equal(frameworkForCompetency("teamwork", "role-specific"), "star");
});

test("a mixed interview covers motivation, a past example, and the work", () => {
  const guide = styleInstructions("mixed", 30);
  assert.match(guide, /opening story, motivation, one past-experience question, one role-specific question/);
  assert.match(openingFor("mixed", false), /tell-me-about-yourself/i);
  assert.equal(frameworkForCompetency("motivation", "mixed"), "motivation");
  assert.equal(frameworkForCompetency("conflict", "mixed"), "star");
  assert.equal(frameworkForCompetency("judgment", "mixed"), "structured_reasoning");
});

test("a 10-minute interview protects time to close", () => {
  const topics = mainTopicGuidance(10);
  assert.equal(topics.max, 3);
  assert.ok(closingReserveMinutes(10) >= 2);
  const guide = styleInstructions("mixed", 10);
  assert.match(guide, /Leave about/);
  assert.match(guide, /do not keep asking main questions until the clock runs out/);
});

test("a 30-minute interview stays within a reasonable number of main topics", () => {
  const topics = mainTopicGuidance(30);
  assert.equal(topics.min, 5);
  assert.equal(topics.max, 8);
  assert.match(styleInstructions("behavioral", 30), /Do not exceed about 8/);
});

test("interview type does not raise the early-career ceiling", () => {
  for (const type of ["recruiter", "behavioral", "hiring-manager", "role-specific", "mixed"] as const) {
    const guide = styleInstructions(type, 30, quietCompany, true);
    assert.match(guide, /does not raise the experience ceiling/);
    assert.match(openingFor(type, true), /does not raise the experience ceiling|scale they have actually had/);
  }
  assert.equal(styleProfile("hiring-manager").type, "hiring-manager");
});

test("company style can nudge emphasis without replacing the interview type", () => {
  const screen = applyCompanyStyle(styleProfile("recruiter"), {
    confidence: "high",
    behavioralEmphasis: "high",
    technicalEmphasis: "high",
  });
  assert.equal(screen.type, "recruiter");
  assert.equal(screen.behavioralDepth, "medium");
  assert.equal(screen.roleSpecificDepth, "medium");
  assert.notEqual(screen.behavioralDepth, "deep");
  const guide = styleInstructions("recruiter", 30, {
    confidence: "high",
    behavioralEmphasis: "high",
    technicalEmphasis: "low",
  });
  assert.match(guide, /does not replace the selected Recruiter Screen/);
  assert.match(guide, /Behavioral depth is medium/);
});

test("sold interview lengths stay 10 and 30 minutes", () => {
  assert.deepEqual(durationOptions.map((option) => option.minutes), [10, 30]);
  assert.equal(mainTopicGuidance(20).text, "about 4 to 6");
});
