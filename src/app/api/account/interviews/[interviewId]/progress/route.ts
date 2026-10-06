import { authenticate, isUser } from "@/lib/firebase/auth-server";
import { saveInterviewProgress } from "@/lib/firebase/data";
import type { InterviewStatusName } from "@/lib/account/types";
import type { AssistanceType, InterviewAssistanceEvent, InterviewPauseEvent } from "@/lib/interview/help-types";
import type { InterviewTurn } from "@/lib/interview/types";

export const runtime = "nodejs";

const statuses = new Set<InterviewStatusName>(["in_progress", "analyzing", "complete", "failed", "ready"]);
const assistanceTypes = new Set<AssistanceType>(["pause", "rephrase", "competency", "structure", "experience_suggestions", "repeat"]);

function readTurns(value: unknown): InterviewTurn[] {
  if (!Array.isArray(value)) return [];
  const turns: InterviewTurn[] = [];
  for (const item of value.slice(0, 200)) {
    if (!item || typeof item !== "object") continue;
    const turn = item as Partial<InterviewTurn>;
    if (turn.speaker !== "candidate" && turn.speaker !== "interviewer") continue;
    const text = typeof turn.text === "string" ? turn.text.trim().slice(0, 4000) : "";
    if (!text) continue;
    turns.push({
      id: typeof turn.id === "string" && turn.id.trim() ? turn.id.trim().slice(0, 80) : `turn-${turns.length + 1}`,
      speaker: turn.speaker,
      text,
      timestampMs: typeof turn.timestampMs === "number" && Number.isFinite(turn.timestampMs) ? turn.timestampMs : 0,
    });
  }
  return turns;
}

function readAssistance(value: unknown): InterviewAssistanceEvent[] {
  if (!Array.isArray(value)) return [];
  const events: InterviewAssistanceEvent[] = [];
  for (const item of value.slice(0, 40)) {
    if (!item || typeof item !== "object") continue;
    const event = item as Partial<InterviewAssistanceEvent>;
    if (typeof event.type !== "string" || !assistanceTypes.has(event.type as AssistanceType)) continue;
    events.push({
      timestampMs: typeof event.timestampMs === "number" && Number.isFinite(event.timestampMs) ? event.timestampMs : 0,
      type: event.type as AssistanceType,
      question: typeof event.question === "string" ? event.question.slice(0, 300) : undefined,
      durationMs: typeof event.durationMs === "number" && Number.isFinite(event.durationMs) ? event.durationMs : undefined,
    });
  }
  return events;
}

function readPauses(value: unknown): InterviewPauseEvent[] {
  if (!Array.isArray(value)) return [];
  const pauses: InterviewPauseEvent[] = [];
  for (const item of value.slice(0, 40)) {
    if (!item || typeof item !== "object") continue;
    const pause = item as Partial<InterviewPauseEvent>;
    if (typeof pause.startedAt !== "number" || !Number.isFinite(pause.startedAt)) continue;
    pauses.push({
      startedAt: pause.startedAt,
      endedAt: typeof pause.endedAt === "number" ? pause.endedAt : undefined,
      durationMs: typeof pause.durationMs === "number" ? pause.durationMs : undefined,
    });
  }
  return pauses;
}

export async function POST(request: Request, context: { params: Promise<{ interviewId: string }> }) {
  const user = await authenticate(request);
  if (!isUser(user)) return user;
  const { interviewId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "The interview could not be saved." }, { status: 400 });
  }
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const status = typeof record.status === "string" && statuses.has(record.status as InterviewStatusName) ? (record.status as InterviewStatusName) : "in_progress";
  const elapsedMs = typeof record.elapsedMs === "number" && Number.isFinite(record.elapsedMs) ? record.elapsedMs : 0;
  const saved = await saveInterviewProgress(user.uid, interviewId, {
    status,
    turns: readTurns(record.turns),
    elapsedMs,
    assistance: readAssistance(record.assistance),
    pauses: readPauses(record.pauses),
  });
  if (!saved) return Response.json({ error: "This interview could not be found." }, { status: 404 });
  return Response.json({ ok: true });
}
