import { storyJson } from "@/lib/story/complete";
import { clip, preserveCore, readProof, readString } from "@/lib/story/story";
import type { ProfessionalStory, TailoredStory } from "@/lib/story/types";

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    evidence: {
      type: "array",
      minItems: 2,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          sourceExperience: { type: "string" },
          proof: { type: "string" },
        },
        required: ["title", "sourceExperience", "proof"],
      },
    },
    direction: { type: "string" },
    tellMeAboutYourself: { type: "string" },
    memorability: { type: "string" },
  },
  required: ["evidence", "direction", "tellMeAboutYourself", "memorability"],
} as const;

const instructions = `Adapt a saved professional story to one role. Keep the person's identity and the meaning of their pattern. You may change which proof is emphasized, the order, and the direction sentence.

Do not invent experiences. Use only the saved proof. Do not rename the identity. Do not overwrite who they are to match the job.
The spoken answer is about 60 to 90 seconds, natural, and not a resume chronology.
Direction should connect their existing pattern to this role without becoming a list of the job description.
memorability is one sentence an interviewer for this role might remember.`;

export async function tailorStory(
  story: ProfessionalStory,
  role: { company: string; jobTitle: string; jobDescription: string },
): Promise<TailoredStory> {
  const proof = story.evidence.map((item) => `- ${item.title} | ${item.sourceExperience}: ${item.proof}`).join("\n");
  const parsed = await storyJson(
    instructions,
    `Keep this identity exactly: ${story.identity.label}. ${story.identity.statement}
Keep this pattern's meaning: ${story.pattern}
Saved proof:
${proof}
General direction: ${story.direction}

Role: ${role.jobTitle} at ${role.company}
Job description:
${clip(role.jobDescription, 4000)}`,
    "story_tailor",
    schema,
  );
  if (!parsed || typeof parsed !== "object") throw new Error("The role version was incomplete.");
  const record = parsed as Record<string, unknown>;
  const evidence = readProof(record.evidence);
  const direction = readString(record.direction);
  const tellMeAboutYourself = readString(record.tellMeAboutYourself);
  const memorability = readString(record.memorability);
  if (evidence.length < 2 || !direction || !tellMeAboutYourself || !memorability) {
    throw new Error("The role version was incomplete.");
  }
  return preserveCore(story, {
    evidence,
    direction: clip(direction, 500),
    tellMeAboutYourself: clip(tellMeAboutYourself, 2200),
    memorability: clip(memorability, 300),
  });
}
