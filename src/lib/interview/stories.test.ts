import assert from "node:assert/strict";
import test from "node:test";

import { assignStories, canAddStory, parseStoryWrite, prepChecklist, readinessFor, readinessLabel, type InterviewStory } from "./stories";

function story(partial: Partial<InterviewStory> & Pick<InterviewStory, "storyId" | "competencies">): InterviewStory {
  return {
    title: partial.storyId,
    sourceExperience: "Internship",
    situation: "A weekly report was late.",
    task: "I owned the update.",
    action: "I rebuilt the sheet.",
    result: "The team used it on Monday.",
    learning: "",
    evidenceGrounding: [],
    confidence: "medium",
    createdAt: 1,
    updatedAt: 1,
    ...partial,
  };
}

test("readiness comes from the saved fields", () => {
  assert.equal(readinessFor([], "teamwork"), "needs_a_story");
  assert.equal(readinessLabel("needs_a_story"), "Needs a story");
  const thin = story({ storyId: "thin", competencies: ["teamwork"], situation: "", action: "" });
  assert.equal(readinessFor([thin], "teamwork"), "needs_detail");
  const noResult = story({ storyId: "open", competencies: ["teamwork"], result: "" });
  assert.equal(readinessFor([noResult], "teamwork"), "needs_result");
  const failure = story({ storyId: "miss", competencies: ["failure"], result: "The launch slipped.", learning: "" });
  assert.equal(readinessFor([failure], "failure"), "needs_learning");
  const learned = story({ storyId: "learned", competencies: ["failure"], result: "", learning: "I now check the date first." });
  assert.equal(readinessFor([learned], "failure"), "ready");
  assert.equal(readinessFor([story({ storyId: "done", competencies: ["data_analysis"] })], "data_analysis"), "ready");
});

test("one story can cover two competencies, and a third uses another story when one exists", () => {
  const shared = story({ storyId: "shared", competencies: ["data_analysis", "communication", "teamwork"] });
  const other = story({ storyId: "other", competencies: ["teamwork"], title: "Group project" });
  const assigned = assignStories([shared, other], ["data_analysis", "communication", "teamwork"]);
  assert.equal(assigned[0]?.storyId, "shared");
  assert.equal(assigned[1]?.storyId, "shared");
  assert.equal(assigned[2]?.storyId, "other");
});

test("the server rejects a seventh story, a bad competency, and a uid in the body", () => {
  assert.equal(canAddStory(6), false);
  assert.equal(canAddStory(5), true);
  assert.equal(parseStoryWrite({ title: "Dashboard", competencies: ["not_real"], situation: "" }).ok, false);
  assert.equal(parseStoryWrite({ title: "Dashboard", competencies: ["data_analysis"], uid: "someone-else" }).ok, false);
  const parsed = parseStoryWrite({ title: "Dashboard", competencies: ["data_analysis"], result: "" });
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.equal(parsed.draft.result, "");
});

test("the checklist does not decide whether the interview can start", () => {
  const items = prepChecklist({
    companyResearched: false,
    roleUnderstood: true,
    resumeReviewed: true,
    tellMeAboutYourself: false,
    storyCount: 1,
  });
  assert.equal(items.some((item) => item.id === "start"), false);
  assert.equal(items.find((item) => item.id === "stories")?.done, false);
});
