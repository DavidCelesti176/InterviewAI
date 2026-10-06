import type {
  ProfessionalStory,
  StoryAnalysis,
  StoryConfidence,
  StoryIdentityOption,
  StoryProof,
  TailoredStory,
} from "./types";

const confidences = new Set<StoryConfidence>(["low", "medium", "high"]);
const stopwords = new Set(["the", "and", "for", "with", "from", "that", "this", "your", "role", "work", "team", "job"]);
const bannedLabels = new Set([
  "hardworking",
  "motivated",
  "team player",
  "communicator",
  "go-getter",
  "people person",
  "results-driven",
]);

export function storyContextBlock(story: Pick<ProfessionalStory, "identity" | "pattern" | "evidence" | "direction">): string {
  const proof = story.evidence.map((item) => `- ${item.sourceExperience}: ${item.proof}`).join("\n");
  return `The candidate saved a professional story. This is private context, not a script. Do not recite it and do not tell them what to say. If you ask them to introduce themselves, ask naturally.
Identity they chose: ${story.identity.label}. ${story.identity.statement}
Pattern: ${story.pattern}
Evidence they consider proof:
${proof}
Direction: ${story.direction}`;
}

export function evidenceIsGrounded(resumeText: string, experience: string): boolean {
  const haystack = normalize(resumeText);
  const tokens = normalize(experience)
    .split(" ")
    .filter((token) => token.length >= 3 && !stopwords.has(token));
  if (tokens.length === 0) return false;
  return tokens.some((token) => haystack.includes(token));
}

export function groundedAnalysis(resumeText: string, analysis: StoryAnalysis): StoryAnalysis {
  const identityOptions = analysis.identityOptions
    .map((option) => ({
      ...option,
      label: clip(option.label, 40),
      statement: clip(option.statement, 280),
      explanation: clip(option.explanation, 320),
      evidence: option.evidence
        .filter((item) => item.evidence.trim() && evidenceIsGrounded(resumeText, item.experience))
        .slice(0, 3)
        .map((item) => ({
          experience: clip(item.experience, 120),
          evidence: clip(item.evidence, 280),
        })),
    }))
    .filter((option) => option.evidence.length > 0 && !isGenericIdentity(option))
    .slice(0, 5);
  const suggestedEvidence = analysis.suggestedEvidence
    .filter((item) => item.proof.trim() && evidenceIsGrounded(resumeText, item.experience))
    .slice(0, 6)
    .map((item) => ({
      experience: clip(item.experience, 120),
      reason: clip(item.reason, 240),
      proof: clip(item.proof, 280),
    }));
  const recurringPatterns = analysis.recurringPatterns
    .map((item) => clip(item, 320))
    .filter((item) => item && !genericPhrase(item))
    .slice(0, 4);
  const note =
    identityOptions.length > 0
      ? analysis.note
      : "The resume does not show a repeating theme we can support yet. You can write your own.";
  return { identityOptions, recurringPatterns, suggestedEvidence, note: clip(note, 320) };
}

export function preserveCore(
  story: ProfessionalStory,
  tailored: { evidence: StoryProof[]; direction: string; tellMeAboutYourself: string; memorability: string },
): TailoredStory {
  return {
    identity: { label: story.identity.label, statement: story.identity.statement },
    pattern: story.pattern,
    evidence: tailored.evidence.slice(0, 3),
    direction: tailored.direction,
    tellMeAboutYourself: tailored.tellMeAboutYourself,
    memorability: tailored.memorability,
  };
}

export function storyFromUnknown(value: unknown): ProfessionalStory | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const identity = record.identity;
  if (!identity || typeof identity !== "object") return null;
  const label = clip(readString((identity as { label?: unknown }).label), 40);
  const statement = clip(readString((identity as { statement?: unknown }).statement), 280);
  const pattern = clip(readString(record.pattern), 400);
  const direction = clip(readString(record.direction), 500);
  const general = clip(readString(record.generalTellMeAboutYourself), 2200);
  const short = clip(readString(record.shortTellMeAboutYourself), 1100);
  const memorability = clip(readString(record.memorability), 300);
  const resumeId = clip(readString(record.resumeId), 80);
  const evidence = readProof(record.evidence);
  const createdAt = readTime(record.createdAt);
  const updatedAt = readTime(record.updatedAt);
  if (!label || !statement || !pattern || !direction || !general || evidence.length === 0 || !createdAt || !updatedAt) {
    return null;
  }
  return {
    identity: { label, statement },
    pattern,
    evidence,
    direction,
    generalTellMeAboutYourself: general,
    shortTellMeAboutYourself: short,
    memorability,
    resumeId,
    createdAt,
    updatedAt,
  };
}

export function readProof(value: unknown): StoryProof[] {
  if (!Array.isArray(value)) return [];
  const items: StoryProof[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const title = clip(readString(record.title), 80);
    const sourceExperience = clip(readString(record.sourceExperience), 120);
    const proof = clip(readString(record.proof), 280);
    if (!title || !sourceExperience || !proof) continue;
    items.push({ title, sourceExperience, proof });
    if (items.length === 3) break;
  }
  return items;
}

function isGenericIdentity(option: StoryIdentityOption): boolean {
  if (bannedLabels.has(option.label.trim().toLowerCase())) return true;
  return genericPhrase(option.statement) && option.confidence === "low";
}

function genericPhrase(value: string): boolean {
  return /highly motivated|results-driven|dynamic professional|team player|hard worker|people person|go-getter/i.test(value);
}

export function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function clip(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max).trim();
}

function readTime(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

export function isConfidence(value: unknown): value is StoryConfidence {
  return typeof value === "string" && confidences.has(value as StoryConfidence);
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
