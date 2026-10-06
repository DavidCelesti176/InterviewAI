import { authenticate, isUser } from "@/lib/firebase/auth-server";
import { getResume, isRecordId } from "@/lib/firebase/data";
import { isSameOrigin } from "@/lib/http/same-origin";
import { draftEvidence, generateStoryDraft } from "@/lib/story/generate";
import { clip, readString } from "@/lib/story/story";

export const runtime = "nodejs";
export const maxDuration = 30;

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Unexpected request origin", 403);
  if (!process.env.OPENAI_API_KEY) return jsonError("Set OPENAI_API_KEY on the server", 503);
  const user = await authenticate(request);
  if (!isUser(user)) return user;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("The story could not be read.", 400);
  }
  if (!body || typeof body !== "object") return jsonError("The story could not be read.", 400);
  const payload = body as Record<string, unknown>;
  const identity = payload.identity;
  if (!identity || typeof identity !== "object") return jsonError("Choose the identity that sounds like you.", 400);
  const identityLabel = clip(readString((identity as { label?: unknown }).label), 40);
  const identityStatement = clip(readString((identity as { statement?: unknown }).statement), 280);
  const pattern = clip(readString(payload.pattern), 400);
  const interests = clip(readString(payload.interests), 400);
  const evidence = draftEvidence(payload.evidence);
  const resumeId = readString(payload.resumeId);
  if (!identityLabel || !identityStatement || !pattern || !evidence) {
    return jsonError("Add who you are, the pattern, and at least one piece of proof.", 400);
  }
  if (!resumeId || !isRecordId(resumeId)) return jsonError("Choose the resume this story comes from.", 400);
  const resume = await getResume(user.uid, resumeId);
  if (!resume) return jsonError("That saved resume could not be found.", 404);

  try {
    const draft = await generateStoryDraft({
      resumeText: resume.parsedText,
      identityLabel,
      identityStatement,
      pattern,
      evidence,
      interests,
    });
    return Response.json({ draft });
  } catch (error) {
    console.error("Story draft failed", error instanceof Error ? error.message : "error");
    return jsonError("The story could not be written yet. Try again.", 502);
  }
}
