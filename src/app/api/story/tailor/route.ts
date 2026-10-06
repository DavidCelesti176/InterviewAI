import { authenticate, isUser } from "@/lib/firebase/auth-server";
import { readProfessionalStory } from "@/lib/firebase/data";
import { isSameOrigin } from "@/lib/http/same-origin";
import { clip, readString } from "@/lib/story/story";
import { tailorStory } from "@/lib/story/tailor";

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
    return jsonError("The role could not be read.", 400);
  }
  if (!body || typeof body !== "object") return jsonError("The role could not be read.", 400);
  const payload = body as Record<string, unknown>;
  const company = clip(readString(payload.company), 200);
  const jobTitle = clip(readString(payload.jobTitle), 200);
  const jobDescription = clip(readString(payload.jobDescription), 4000);
  if (!company || !jobTitle || jobDescription.length < 20) {
    return jsonError("Add the company, the role, and a short description.", 400);
  }

  const story = await readProfessionalStory(user.uid);
  if (!story) return jsonError("Save your story before shaping it for a role.", 404);

  try {
    const tailored = await tailorStory(story, { company, jobTitle, jobDescription });
    return Response.json({ tailored });
  } catch (error) {
    console.error("Story tailor failed", error instanceof Error ? error.message : "error");
    return jsonError("That role version could not be written yet. Try again.", 502);
  }
}
