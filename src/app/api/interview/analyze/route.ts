import OpenAI from "openai";

import { authenticate, isUser } from "@/lib/firebase/auth-server";
import { saveInterviewAnalysis } from "@/lib/firebase/data";
import { isSameOrigin } from "@/lib/http/same-origin";
import { analyzeInterview, type AnalysisStep } from "@/lib/interview/analyze-interview";
import type { AssistanceType, InterviewAssistanceEvent } from "@/lib/interview/help-types";
import { getInterview } from "@/lib/interview/store";
import type { InterviewTurn } from "@/lib/interview/types";

export const runtime = "nodejs";
export const maxDuration = 120;

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}

function readTurns(value: unknown): InterviewTurn[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 200) return null;
  const turns: InterviewTurn[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const turn = item as Partial<InterviewTurn>;
    if (turn.speaker !== "candidate" && turn.speaker !== "interviewer") return null;
    if (typeof turn.text !== "string" || typeof turn.timestampMs !== "number") return null;
    if (!Number.isFinite(turn.timestampMs) || turn.timestampMs < 0) return null;
    const text = turn.text.trim().slice(0, 4000);
    if (!text) continue;
    turns.push({
      id: typeof turn.id === "string" && turn.id.trim() ? turn.id.trim().slice(0, 80) : `turn-${turns.length + 1}`,
      speaker: turn.speaker,
      text,
      timestampMs: turn.timestampMs,
    });
  }
  return turns.length > 0 ? turns : null;
}

const assistanceTypes = new Set<AssistanceType>(["pause", "rephrase", "competency", "structure", "experience_suggestions", "repeat"]);

function readAssistance(value: unknown): InterviewAssistanceEvent[] {
  if (!Array.isArray(value)) return [];
  const events: InterviewAssistanceEvent[] = [];
  for (const item of value.slice(0, 40)) {
    if (!item || typeof item !== "object") continue;
    const event = item as Partial<InterviewAssistanceEvent>;
    if (typeof event.type !== "string" || !assistanceTypes.has(event.type as AssistanceType)) continue;
    const question = typeof event.question === "string" ? event.question.trim().slice(0, 300) : "";
    events.push({
      timestampMs: typeof event.timestampMs === "number" && Number.isFinite(event.timestampMs) ? event.timestampMs : 0,
      type: event.type as AssistanceType,
      question: question || undefined,
    });
  }
  return events;
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
    return jsonError("The interview could not be read.", 400);
  }
  if (!body || typeof body !== "object") return jsonError("The interview could not be read.", 400);
  const payload = body as { interviewId?: unknown; elapsedMs?: unknown; turns?: unknown; assistance?: unknown; pausedMs?: unknown };
  if (typeof payload.interviewId !== "string" || !payload.interviewId.trim()) {
    return jsonError("The interview could not be read.", 400);
  }
  const elapsedMs = typeof payload.elapsedMs === "number" && Number.isFinite(payload.elapsedMs) ? payload.elapsedMs : 0;
  if (elapsedMs < 0 || elapsedMs > 6 * 60 * 60 * 1000) return jsonError("The interview could not be read.", 400);
  const turns = readTurns(payload.turns);
  if (!turns) return jsonError("There isn't enough of the conversation to review.", 400);

  const interviewId = payload.interviewId.trim();
  console.info("Interview analysis started", interviewId);
  const interview = await getInterview(user.uid, interviewId);
  if (!interview) {
    return jsonError("This interview could not be found.", 404);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      const onStep = (step: AnalysisStep, state: "active" | "done") => send({ step, state });
      try {
        const pausedMs = typeof payload.pausedMs === "number" && Number.isFinite(payload.pausedMs) ? payload.pausedMs : 0;
        const result = await analyzeInterview({
          interview,
          turns,
          elapsedMs,
          assistance: readAssistance(payload.assistance),
          pausedMs,
          onStep,
        });
        let saved = false;
        try {
          saved = await saveInterviewAnalysis(user.uid, interviewId, result.analysis, {
            model: result.debug.model,
          });
        } catch (saveError) {
          console.error("Analysis save failed", saveError instanceof Error ? saveError.message : "error");
        }
        send({
          step: "ready",
          analysis: result.analysis,
          saved,
          debug: process.env.NODE_ENV === "development" ? result.debug : undefined,
        });
      } catch (error) {
        if (error instanceof OpenAI.APIError) {
          console.error("Interview analysis failed", error.status, error.code ?? "", error.message);
        } else {
          console.error("Interview analysis failed", error instanceof Error ? error.message : "error");
        }
        const message =
          error instanceof Error && error.message === "There isn't enough of the conversation to review."
            ? error.message
            : "We couldn't finish your analysis yet.";
        send({ step: "error", error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  });
}
