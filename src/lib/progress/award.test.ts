import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAward,
  buildDaily,
  emptyProgress,
  emptySkills,
  journeyFrom,
  levelForXp,
  levelSpan,
  localDay,
  readinessFromScores,
  storytellingScore,
  weakestSkill,
} from "./award";
import type { SkillId } from "./types";

const day = "2026-10-06";

function score(id: SkillId, value: number, samples = 1) {
  const skills = emptySkills();
  skills[id] = { score: value, samples };
  return skills;
}

test("levels follow the XP thresholds and never use a lower title", () => {
  assert.deepEqual(levelForXp(0), { level: 1, title: "Foundations" });
  assert.deepEqual(levelForXp(49), { level: 1, title: "Foundations" });
  assert.deepEqual(levelForXp(50), { level: 2, title: "Clear answers" });
  assert.deepEqual(levelForXp(540), { level: 6, title: "Composed" });
  assert.deepEqual(levelForXp(759), { level: 6, title: "Composed" });
  assert.deepEqual(levelForXp(760), { level: 7, title: "Composed" });
  assert.deepEqual(levelSpan(0), { level: 1, title: "Foundations", start: 0, next: 50 });
  assert.deepEqual(levelSpan(540), { level: 6, title: "Composed", start: 540, next: 760 });
  assert.deepEqual(levelSpan(760), { level: 7, title: "Composed", start: 760, next: 980 });
});

test("the same award cannot be claimed twice", () => {
  const first = applyAward(emptyProgress(1), { eventId: "interview:abc:analyzed", kind: "mock", day, now: 1, readinessScore: 70 });
  const second = applyAward(first.state, { eventId: "interview:abc:analyzed", kind: "mock", day, now: 2, readinessScore: 90 });
  assert.equal(first.granted, true);
  assert.equal(first.xpGained, 80);
  assert.equal(second.granted, false);
  assert.equal(second.state.xp, 80);
});

test("a missed day spends the weekly rest day and a second miss starts over", () => {
  const start = applyAward(emptyProgress(1), { eventId: "a", kind: "practice", day: "2026-10-05", now: 1 });
  const kept = applyAward(start.state, { eventId: "b", kind: "practice", day: "2026-10-07", now: 2 });
  assert.equal(kept.state.streakCount, 2);
  assert.equal(kept.state.restDaysUsedWeek, 1);
  assert.equal(kept.state.xp, 50);
  const reset = applyAward(kept.state, { eventId: "c", kind: "practice", day: "2026-10-09", now: 3 });
  assert.equal(reset.state.streakCount, 1);
  assert.equal(reset.state.xp, 75);
});

test("the next day extends the streak and the same day does not", () => {
  const start = applyAward(emptyProgress(1), { eventId: "a", kind: "story_practice", day: "2026-10-05", now: 1 });
  const same = applyAward(start.state, { eventId: "b", kind: "story_practice", day: "2026-10-05", now: 2 });
  const next = applyAward(same.state, { eventId: "c", kind: "story_practice", day: "2026-10-06", now: 3 });
  assert.equal(same.state.streakCount, 1);
  assert.equal(next.state.streakCount, 2);
});

test("readiness stays empty until an analyzed interview and then weights the latest", () => {
  assert.equal(readinessFromScores([]), null);
  assert.equal(readinessFromScores([70]), 70);
  assert.equal(readinessFromScores([60, 80, 90]), Math.round(90 * 0.5 + 80 * 0.3 + 60 * 0.2));
  const practiced = applyAward(emptyProgress(1), { eventId: "p", kind: "practice", day, now: 1 });
  assert.equal(practiced.state.readiness, null);
});

test("ties pick structure before specificity", () => {
  const skills = emptySkills();
  skills.structure = { score: 60, samples: 1 };
  skills.specificity = { score: 60, samples: 1 };
  skills.conciseness = { score: 80, samples: 1 };
  assert.equal(weakestSkill(skills), "structure");
});

test("an eight point gain on the weakest skill adds a one-time bonus", () => {
  let state = emptyProgress(1);
  state = {
    ...state,
    skills: score("structure", 60),
    weakestSkill: "structure",
  };
  const next = applyAward(state, {
    eventId: "interview:two:analyzed",
    kind: "mock",
    day,
    now: 2,
    readinessScore: 74,
    scores: { structure: 70 },
  });
  assert.equal(next.xpGained, 110);
  const again = applyAward(next.state, {
    eventId: "interview:two:analyzed",
    kind: "mock",
    day,
    now: 3,
    readinessScore: 90,
    scores: { structure: 90 },
  });
  assert.equal(again.granted, false);
});

test("storytelling uses coarse bands and a timeline stays low", () => {
  assert.equal(
    storytellingScore({
      establishedIdentity: true,
      evidenceSupportedIdentity: true,
      clearThread: true,
      explainedDirection: true,
      resumeChronology: true,
      buriedEvidence: false,
      conversational: true,
    }),
    55,
  );
  assert.equal(
    storytellingScore({
      establishedIdentity: true,
      evidenceSupportedIdentity: true,
      clearThread: true,
      explainedDirection: true,
      resumeChronology: false,
      buriedEvidence: false,
      conversational: true,
    }),
    85,
  );
});

test("journey stages stay available until the evidence exists", () => {
  const open = journeyFrom({
    analyzedCount: 0,
    storySaved: false,
    behavioralCount: 0,
    starPracticed: false,
    roleSpecificCount: 0,
    readiness: null,
  });
  assert.equal(open.fundamentals, "available");
  assert.equal(open.ready, "available");
  const ready = journeyFrom({
    analyzedCount: 2,
    storySaved: true,
    behavioralCount: 1,
    starPracticed: true,
    roleSpecificCount: 1,
    readiness: 82,
  });
  assert.equal(ready.ready, "complete");
  assert.equal(ready.mocks, "complete");
});

test("the daily recommendation follows the weakest skill without hiding the mock", () => {
  const plan = buildDaily({
    day,
    weakest: "structure",
    storySaved: true,
    latestInterviewId: "interview-1",
    completed: false,
  });
  assert.equal(plan.primary.href, "/interview/interview-1/results");
  assert.equal(plan.options.some((option) => option.href === "/interview/new"), true);
});

test("local day follows the stored timezone", () => {
  const evening = Date.parse("2026-10-07T02:30:00Z");
  assert.equal(localDay(evening, "America/New_York"), "2026-10-06");
  assert.equal(localDay(evening, "Not/AZone"), "2026-10-07");
});
