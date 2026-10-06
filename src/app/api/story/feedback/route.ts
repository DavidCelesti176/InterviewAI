import { authenticate, isUser } from "@/lib/firebase/auth-server";
import { readProfessionalStory } from "@/lib/firebase/data";
import { isSameOrigin } from "@/lib/http/same-origin";
import { awardStoryPractice } from "@/lib/progress/store";
import { reviewStoryPractice } from "@/lib/story/feedback";
import type { InterviewTurn } from "@/lib/interview/types";

export const runtime = "nodejs";
export const maxDuration = 30;

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}

function readTurns(value: unknown): InterviewTurn[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 40) return null;
  const turns: InterviewTurn[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const turn = item as Partial<InterviewTurn>;
    if (turn.speaker !== "candidate" && turn.speaker !== "interviewer") return null;
    if (typeof turn.text !== "string" || typeof turn.timestampMs !== "number") return null;
    const text = turn.text.trim().slice(0, 2000);
    if (!text) continue;
    turns.push({
      id: typeof turn.id === "string" ? turn.id.slice(0, 80) : `turn-${turns.length + 1}`,
      speaker: turn.speaker,
      text,
      timestampMs: turn.timestampMs,
    });
  }
  return turns.length > 0 ? turns : null;
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
    return jsonError("The practice could not be read.", 400);
  }
  if (!body || typeof body !== "object") return jsonError("The practice could not be read.", 400);
  const turns = readTurns((body as { turns?: unknown }).turns);
  if (!turns) return jsonError("There isn't enough of the story to review.", 400);
  const story = await readProfessionalStory(user.uid);
  if (!story) return jsonError("Save your story before practicing it.", 404);

  try {
    const feedback = await reviewStoryPractice(story, turns);
    const spoken = turns
      .filter((turn) => turn.speaker === "candidate")
      .map((turn) => turn.text)
      .join(" ");
    try {
      await awardStoryPractice(user.uid, spoken, feedback);
    } catch (awardError) {
      console.error("Story practice award failed", awardError instanceof Error ? awardError.message : "error");
    }
    return Response.json({ feedback });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.error("Story feedback failed", message || "error");
    if (message === "There isn't enough of the story to review.") return jsonError(message, 400);
    return jsonError("The practice could not be reviewed yet. Try again.", 502);
  }
}
