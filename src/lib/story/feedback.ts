import type { InterviewTurn } from "@/lib/interview/types";

import { storyJson } from "./complete";
import { storyFeedbackInstructions } from "./practice-prompt";
import { readString, storyContextBlock } from "./story";
import type { ProfessionalStory, StoryPracticeFeedback } from "./types";

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    establishedIdentity: { type: "boolean" },
    evidenceSupportedIdentity: { type: "boolean" },
    clearThread: { type: "boolean" },
    explainedDirection: { type: "boolean" },
    rightLength: { type: "boolean" },
    conversational: { type: "boolean" },
    buriedEvidence: { type: "boolean" },
    resumeChronology: { type: "boolean" },
    coaching: { type: "string" },
    interviewerMemory: { type: "string" },
  },
  required: [
    "establishedIdentity",
    "evidenceSupportedIdentity",
    "clearThread",
    "explainedDirection",
    "rightLength",
    "conversational",
    "buriedEvidence",
    "resumeChronology",
    "coaching",
    "interviewerMemory",
  ],
} as const;

export async function reviewStoryPractice(story: ProfessionalStory, turns: InterviewTurn[]): Promise<StoryPracticeFeedback> {
  const spoken = turns
    .filter((turn) => turn.speaker === "candidate")
    .map((turn) => turn.text.trim())
    .filter(Boolean)
    .join(" ");
  if (spoken.length < 40) throw new Error("There isn't enough of the story to review.");
  const parsed = await storyJson(
    storyFeedbackInstructions,
    `${storyContextBlock(story)}

What they actually said:
${spoken.slice(0, 4000)}`,
    "story_feedback",
    schema,
  );
  return normalizeFeedback(parsed);
}

function normalizeFeedback(value: unknown): StoryPracticeFeedback {
  if (!value || typeof value !== "object") throw new Error("The story feedback was incomplete.");
  const record = value as Record<string, unknown>;
  const coaching = readString(record.coaching);
  const interviewerMemory = readString(record.interviewerMemory);
  if (!coaching || !interviewerMemory) throw new Error("The story feedback was incomplete.");
  return {
    establishedIdentity: record.establishedIdentity === true,
    evidenceSupportedIdentity: record.evidenceSupportedIdentity === true,
    clearThread: record.clearThread === true,
    explainedDirection: record.explainedDirection === true,
    rightLength: record.rightLength === true,
    conversational: record.conversational === true,
    buriedEvidence: record.buriedEvidence === true,
    resumeChronology: record.resumeChronology === true,
    coaching: coaching.slice(0, 700),
    interviewerMemory: interviewerMemory.slice(0, 300),
  };
}
