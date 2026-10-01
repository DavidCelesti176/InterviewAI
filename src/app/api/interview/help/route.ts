import { isSameOrigin } from "@/lib/http/same-origin";
import { coachQuestion } from "@/lib/interview/coach-question";
import type { HelpKind } from "@/lib/interview/help-types";
import { clipText } from "@/lib/interview/limits";
import { getInterview } from "@/lib/interview/store";
import type { InterviewTurn } from "@/lib/interview/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const kinds = new Set<HelpKind>(["rephrase", "competency", "structure", "experiences"]);

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}

function readTurns(value: unknown): InterviewTurn[] {
  if (!Array.isArray(value)) return [];
  const turns: InterviewTurn[] = [];
  for (const item of value.slice(-8)) {
    if (!item || typeof item !== "object") continue;
    const turn = item as Partial<InterviewTurn>;
    if (turn.speaker !== "candidate" && turn.speaker !== "interviewer") continue;
    const text = typeof turn.text === "string" ? clipText(turn.text, 500) : "";
    if (!text) continue;
    turns.push({
      id: `help-${turns.length + 1}`,
      speaker: turn.speaker,
      text,
      timestampMs: typeof turn.timestampMs === "number" && Number.isFinite(turn.timestampMs) ? turn.timestampMs : 0,
    });
  }
  return turns;
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Unexpected request origin", 403);
  if (!process.env.OPENAI_API_KEY) return jsonError("Set OPENAI_API_KEY on the server", 503);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Coaching could not be started.", 400);
  }
  if (!body || typeof body !== "object") return jsonError("Coaching could not be started.", 400);
  const payload = body as { interviewId?: unknown; kind?: unknown; question?: unknown; turns?: unknown };
  if (typeof payload.interviewId !== "string" || !payload.interviewId.trim()) {
    return jsonError("Coaching could not be started.", 400);
  }
  if (typeof payload.kind !== "string" || !kinds.has(payload.kind as HelpKind)) {
    return jsonError("Choose a type of help.", 400);
  }
  const question = typeof payload.question === "string" ? clipText(payload.question, 800) : "";
  if (!question) return jsonError("Help is available once a question has been asked.", 400);

  const interview = await getInterview(payload.interviewId.trim());
  if (!interview) {
    return jsonError("This interview is no longer available on the server. You can still resume.", 404);
  }
  if (interview.config.interviewMode !== "practice") {
    return jsonError("Coaching is available in Practice Mode.", 403);
  }

  try {
    const result = await coachQuestion({
      interview,
      kind: payload.kind as HelpKind,
      question,
      recentTurns: readTurns(payload.turns),
    });
    return Response.json({
      help: result.help,
      debug:
        process.env.NODE_ENV === "development"
          ? { model: result.model, durationMs: result.durationMs, responseId: result.responseId }
          : undefined,
    });
  } catch (error) {
    console.error("Interview coaching failed", error instanceof Error ? error.message : "error");
    return jsonError("We couldn't load coaching right now.", 502);
  }
}
