import { storyJson } from "@/lib/story/complete";
import { clip, groundedAnalysis, isConfidence, readString } from "@/lib/story/story";
import type { StoryAnalysis, StoryIdentityOption } from "@/lib/story/types";

const evidenceSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    experience: { type: "string" },
    evidence: { type: "string" },
  },
  required: ["experience", "evidence"],
} as const;

const analysisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    identityOptions: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          statement: { type: "string" },
          explanation: { type: "string" },
          evidence: { type: "array", minItems: 1, maxItems: 3, items: evidenceSchema },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["id", "label", "statement", "explanation", "evidence", "confidence"],
      },
    },
    recurringPatterns: { type: "array", minItems: 2, maxItems: 4, items: { type: "string" } },
    suggestedEvidence: {
      type: "array",
      minItems: 2,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          experience: { type: "string" },
          reason: { type: "string" },
          proof: { type: "string" },
        },
        required: ["experience", "reason", "proof"],
      },
    },
    note: { type: "string" },
  },
  required: ["identityOptions", "recurringPatterns", "suggestedEvidence", "note"],
} as const;

const instructions = `You help a person see the professional story already present in their resume. You do not invent a personality.

Look across different experiences for a repeating pattern: the problems they choose, the role they actually take, what they start, build, fix, organize, analyze, simplify, sell, lead, or improve, and what other people appear to trust them with.

Rules:
- Every identity must be supported by the resume text. If you cannot point to the experience, leave it out.
- Do not invent leadership, results, responsibilities, interests, motivation, or personality.
- Do not make everyone a Builder. Choose the phrase the resume actually supports. You may use a short original phrase when the usual words do not fit.
- If the link between experiences is thin, set confidence to low and say so in the explanation.
- A student, intern, or project-only resume can still have a pattern. Do not exaggerate authority.
- Scattered experience should produce several plausible themes, not one false narrative.
- Statements are second person and concrete. Never write "highly motivated", "results-driven", "dynamic", or "team player".
- experience must be an organization, role, class, or project name that appears in the resume.
- evidence is one sentence about what that experience shows. No invented metrics.
- recurringPatterns are full sentences a person could say, each beginning "A pattern throughout my experiences has been".
- suggestedEvidence should come from different parts of the resume when the resume has them.
- note is one sentence about how strong the pattern is. If evidence is weak, say that.`;

export async function analyzeResumeStory(resumeText: string): Promise<StoryAnalysis> {
  const parsed = await storyJson(
    instructions,
    `Resume:\n${clip(resumeText, 8000)}\n\nFind 3 to 5 grounded identity themes. Prefer themes that connect different experiences.`,
    "story_analysis",
    analysisSchema,
  );
  return groundedAnalysis(resumeText, normalizeAnalysis(parsed));
}

function normalizeAnalysis(value: unknown): StoryAnalysis {
  if (!value || typeof value !== "object") throw new Error("The story analysis was incomplete.");
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.identityOptions) || !Array.isArray(record.recurringPatterns) || !Array.isArray(record.suggestedEvidence)) {
    throw new Error("The story analysis was incomplete.");
  }
  const identityOptions: StoryIdentityOption[] = [];
  for (const item of record.identityOptions) {
    if (!item || typeof item !== "object") continue;
    const option = item as Record<string, unknown>;
    const evidence = Array.isArray(option.evidence)
      ? option.evidence
          .map((entry) => {
            if (!entry || typeof entry !== "object") return null;
            const row = entry as Record<string, unknown>;
            const experience = readString(row.experience);
            const detail = readString(row.evidence);
            if (!experience || !detail) return null;
            return { experience, evidence: detail };
          })
          .filter((entry): entry is { experience: string; evidence: string } => Boolean(entry))
      : [];
    const label = readString(option.label);
    const statement = readString(option.statement);
    if (!label || !statement || evidence.length === 0 || !isConfidence(option.confidence)) continue;
    identityOptions.push({
      id: readString(option.id) || label.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40),
      label,
      statement,
      explanation: readString(option.explanation),
      evidence,
      confidence: option.confidence,
    });
  }
  const suggestedEvidence = record.suggestedEvidence
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const experience = readString(row.experience);
      const reason = readString(row.reason);
      const proof = readString(row.proof);
      if (!experience || !proof) return null;
      return { experience, reason, proof };
    })
    .filter((item): item is { experience: string; reason: string; proof: string } => Boolean(item));
  return {
    identityOptions,
    recurringPatterns: record.recurringPatterns.filter((item): item is string => typeof item === "string" && item.trim().length > 0),
    suggestedEvidence,
    note: readString(record.note),
  };
}
