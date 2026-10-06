import assert from "node:assert/strict";
import test from "node:test";

import { canReplayStatus, clonedInterview, replayQuestionLines } from "./replay";
import type { StoredInterview } from "./store";

const source = {
  id: "interview-1",
  createdAt: 10,
  resumeFileName: "resume.pdf",
  config: { company: "Northline", jobTitle: "Analyst" },
  blueprint: { opening: "Tell me about yourself." },
  debug: {},
  storyContext: "Builder who ships tools.",
  practice: {
    questions: [
      {
        id: "q1",
        question: " Walk me through the dashboard. ",
        answerSummary: "",
        whatHeldItBack: [],
        betterApproach: "",
      },
    ],
  },
} as unknown as StoredInterview;

test("a finished interview can be practiced again", () => {
  assert.equal(canReplayStatus("complete"), true);
  assert.equal(canReplayStatus("in_progress"), true);
  assert.equal(canReplayStatus("failed"), true);
  assert.equal(canReplayStatus("ready"), false);
  assert.equal(canReplayStatus("preparing"), false);
});

test("a replay keeps the plan and starts as a new interview", () => {
  const next = clonedInterview(source, "interview-2", 99);
  assert.equal(next.id, "interview-2");
  assert.equal(next.createdAt, 99);
  assert.equal(next.config.company, "Northline");
  assert.equal(next.storyContext, source.storyContext);
  assert.equal(next.practice?.questions[0]?.question, source.practice?.questions[0]?.question);
  assert.deepEqual(replayQuestionLines(source), ["Walk me through the dashboard."]);
  assert.equal(source.id, "interview-1");
});
