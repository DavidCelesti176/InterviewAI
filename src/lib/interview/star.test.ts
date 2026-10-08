import assert from "node:assert/strict";
import test from "node:test";

import { coverageLimit, matchCompetency, planCoverage } from "./competencies";
import {
  FOLLOW_UP_ACTION,
  FOLLOW_UP_EXAMPLE,
  FOLLOW_UP_LEARNING,
  FOLLOW_UP_RESULT,
  clearStar,
  followUpFor,
  frameworkForQuestion,
  type StarCoverage,
} from "./star";

function gap(partial: Partial<StarCoverage>): StarCoverage {
  return { ...clearStar(), ...partial };
}

test("question text picks an answer framework and does not force STAR", () => {
  assert.equal(frameworkForQuestion("Tell me about a time you disagreed with a teammate."), "star");
  assert.equal(frameworkForQuestion("Why this company?"), "motivation");
  assert.equal(frameworkForQuestion("How would you prioritize two deadlines?"), "structured_reasoning");
  assert.equal(frameworkForQuestion("What functions interest you?"), "direct");
});

test("a clear STAR answer produces no follow-up", () => {
  assert.equal(followUpFor({ framework: "star", coverage: clearStar(), followUpsAlready: 0 }), null);
});

test("non-STAR questions do not get a STAR follow-up", () => {
  const thin = gap({ action: "missing", result: "missing" });
  assert.equal(followUpFor({ framework: "motivation", coverage: thin, followUpsAlready: 0 }), null);
  assert.equal(followUpFor({ framework: "structured_reasoning", coverage: null, followUpsAlready: 0 }), null);
  assert.equal(followUpFor({ framework: "direct", coverage: null, followUpsAlready: 0 }), null);
  assert.equal(followUpFor({ framework: "star", coverage: null, followUpsAlready: 0 }), null);
});

test("missing example, action, result, and learning each produce one matching line", () => {
  assert.equal(
    followUpFor({ framework: "star", coverage: gap({ situation: "missing", task: "missing", action: "missing" }), followUpsAlready: 0 }),
    FOLLOW_UP_EXAMPLE,
  );
  assert.equal(followUpFor({ framework: "star", coverage: gap({ action: "weak" }), followUpsAlready: 0 }), FOLLOW_UP_ACTION);
  assert.equal(followUpFor({ framework: "star", coverage: gap({ result: "missing" }), followUpsAlready: 0 }), FOLLOW_UP_RESULT);
  assert.equal(
    followUpFor({ framework: "star", coverage: gap({ learning: "missing", result: "clear" }), followUpsAlready: 0 }),
    FOLLOW_UP_LEARNING,
  );
});

test("a failure answer with clear learning does not demand a positive result", () => {
  assert.equal(
    followUpFor({ framework: "star", coverage: gap({ result: "missing", learning: "clear" }), followUpsAlready: 0 }),
    null,
  );
});

test("a second follow-up is only for a still-vague high-priority answer, and a third is refused", () => {
  const thin = gap({ action: "missing" });
  assert.equal(followUpFor({ framework: "star", coverage: thin, followUpsAlready: 1, priority: "medium", stillVague: true }), null);
  assert.equal(followUpFor({ framework: "star", coverage: thin, followUpsAlready: 1, priority: "high", stillVague: false }), null);
  assert.equal(
    followUpFor({ framework: "star", coverage: thin, followUpsAlready: 1, priority: "high", stillVague: true }),
    FOLLOW_UP_ACTION,
  );
  assert.equal(followUpFor({ framework: "star", coverage: thin, followUpsAlready: 2, priority: "high", stillVague: true }), null);
});

test("a 30-minute plan treats medium competencies as backups", () => {
  const planned = planCoverage(
    [
      { competency: "Data analysis", priority: "high", reason: "The job is analytical." },
      { competency: "Communication", priority: "high", reason: "They explain findings." },
      { competency: "Commercial thinking", priority: "high", reason: "They support sales." },
      { competency: "Prioritization", priority: "high", reason: "Deadlines compete." },
      { competency: "Teamwork", priority: "high", reason: "They work with sales." },
      { competency: "Initiative", priority: "medium", reason: "Useful if time remains." },
      { competency: "Problem solving", priority: "medium", reason: "Useful if time remains." },
      { competency: "Adaptability", priority: "medium", reason: "Useful if time remains." },
      { competency: "Formal leadership", priority: "low", reason: "The role does not manage people." },
    ],
    30,
  );
  const intended = planned.filter((item) => item.role === "intended");
  assert.deepEqual(intended.map((item) => item.id), ["data_analysis", "communication", "commercial_thinking", "prioritization", "teamwork"]);
  assert.equal(planned.filter((item) => item.role === "backup").length, 2);
  assert.equal(planned.find((item) => item.id === "leadership")?.role, "skip");
  assert.equal(planned.length < 19, true);
  const short = planCoverage(planned.map((item) => ({ competency: item.label, priority: item.priority, reason: item.reason })), 10);
  assert.equal(short.filter((item) => item.role === "intended").length, 3);
  assert.equal(short.some((item) => item.role === "backup"), false);
});

test("coverage limits keep a short interview to three high competencies", () => {
  assert.deepEqual(coverageLimit(10), { intendedHigh: 3, backupMedium: 0 });
  assert.deepEqual(coverageLimit(30), { intendedHigh: 5, backupMedium: 2 });
  assert.equal(matchCompetency("Data analysis")?.id, "data_analysis");
  assert.equal(matchCompetency("formal leadership")?.id, "leadership");
  assert.equal(matchCompetency("unknown skill"), null);
});
