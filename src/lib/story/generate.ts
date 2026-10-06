import { storyJson } from "@/lib/story/complete";
import { clip, readProof, readString } from "@/lib/story/story";
import type { StoryDraft, StoryProof } from "@/lib/story/types";

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    direction: { type: "string" },
    standardAnswer: { type: "string" },
    shortAnswer: { type: "string" },
    memorability: { type: "string" },
  },
  required: ["direction", "standardAnswer", "shortAnswer", "memorability"],
} as const;

const instructions = `Write a spoken professional story from identity, pattern, and proof the person already confirmed.

Structure, without sounding like a template:
1. Who they are professionally, in their words.
2. The common pattern.
3. Two or three short pieces of proof.
4. Where that points next.

The standard answer should take about 60 to 90 seconds when spoken. The short answer about 45 seconds.
Sound like a real student or early professional. Direct sentences. No corporate buzzwords, no "highly motivated", no "results-driven", no resume chronology, no grandiose claims.
Use their identity label and statement. Do not rename them.
Use only the proof they selected and the resume. Do not add accomplishments, metrics, or motives that are not there.
The direction should connect their pattern to the kind of work they said they want. Keep it broad unless their interests are specific.
memorability is one sentence an interviewer might use afterward to describe them. It should name the pattern, not a job title list.`;

export async function generateStoryDraft(input: {
  resumeText: string;
  identityLabel: string;
  identityStatement: string;
  pattern: string;
  evidence: StoryProof[];
  interests: string;
}): Promise<StoryDraft> {
  const proof = input.evidence.map((item) => `- ${item.sourceExperience}: ${item.proof}`).join("\n");
  const parsed = await storyJson(
    instructions,
    `Identity label, use this wording: ${input.identityLabel}
Identity statement, use this wording: ${input.identityStatement}
Confirmed pattern: ${input.pattern}
Kinds of work they are interested in: ${input.interests || "They have not named a target role. Keep the direction general."}

Proof they chose:
${proof}

Resume, for grounding only. Do not retell it in order:
${clip(input.resumeText, 6000)}`,
    "story_draft",
    schema,
  );
  if (!parsed || typeof parsed !== "object") throw new Error("The story draft was incomplete.");
  const record = parsed as Record<string, unknown>;
  const direction = readString(record.direction);
  const standardAnswer = readString(record.standardAnswer);
  const shortAnswer = readString(record.shortAnswer);
  const memorability = readString(record.memorability);
  if (!direction || !standardAnswer || !shortAnswer || !memorability) throw new Error("The story draft was incomplete.");
  return {
    direction: clip(direction, 500),
    standardAnswer: clip(standardAnswer, 2200),
    shortAnswer: clip(shortAnswer, 1100),
    memorability: clip(memorability, 300),
  };
}

export function draftEvidence(value: unknown): StoryProof[] | null {
  const evidence = readProof(value);
  if (evidence.length < 1 || evidence.length > 3) return null;
  return evidence;
}
