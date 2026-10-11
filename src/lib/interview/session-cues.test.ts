import assert from "node:assert/strict";
import test from "node:test";

import { exactLastQuestion, restartQuestionInstruction } from "./session-cues";

test("restart keeps the last question and drops the lead-in", () => {
  const question = exactLastQuestion("That makes sense. Tell me about a time you led a project. What changed because of it?");
  assert.equal(question, "Tell me about a time you led a project. What changed because of it?");
});

test("restart uses the whole turn when it was not phrased as a question", () => {
  assert.equal(exactLastQuestion("Walk me through the process you used."), "Walk me through the process you used.");
});

test("the restart instruction quotes the question word for word", () => {
  const instruction = restartQuestionInstruction("Thanks. How did you measure the result?");
  assert.match(instruction, /word for word/);
  assert.match(instruction, /How did you measure the result\?/);
  assert.equal(instruction.includes("Thanks."), false);
});
