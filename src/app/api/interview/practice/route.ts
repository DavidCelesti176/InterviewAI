import { isSameOrigin } from "@/lib/http/same-origin";
import { clipText } from "@/lib/interview/limits";
import type { PracticeQuestion } from "@/lib/interview/practice-types";
import { getInterview, saveInterview } from "@/lib/interview/store";

export const runtime = "nodejs";

const MAX_QUESTIONS = 4;

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}

function readText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return clipText(value, max);
}

function readQuestions(value: unknown): PracticeQuestion[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_QUESTIONS) return null;
  const questions: PracticeQuestion[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const record = item as Record<string, unknown>;
    const question = readText(record.question, 500);
    if (!question) return null;
    const gaps = Array.isArray(record.whatHeldItBack) ? record.whatHeldItBack : [];
    const whatHeldItBack = gaps
      .filter((gap): gap is string => typeof gap === "string")
      .map((gap) => clipText(gap, 300))
      .filter(Boolean)
      .slice(0, 4);
    questions.push({
      id: readText(record.id, 80) || `practice-${questions.length + 1}`,
      question,
      answerSummary: readText(record.answerSummary, 800),
      whatHeldItBack,
      betterApproach: readText(record.betterApproach, 600),
    });
  }
  return questions;
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Unexpected request origin", 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("The practice session could not be created.", 400);
  }
  if (!body || typeof body !== "object") return jsonError("The practice session could not be created.", 400);
  const payload = body as { interviewId?: unknown; questions?: unknown };
  if (typeof payload.interviewId !== "string" || !payload.interviewId.trim()) {
    return jsonError("The practice session could not be created.", 400);
  }
  const questions = readQuestions(payload.questions);
  if (!questions) return jsonError("Choose an answer to practice.", 400);

  const interview = await getInterview(payload.interviewId.trim());
  if (!interview) {
    return jsonError(
      "This interview is no longer available on the server. Your review is still saved in this browser.",
      404,
    );
  }

  const id = crypto.randomUUID();
  await saveInterview({
    id,
    createdAt: Date.now(),
    resumeFileName: interview.resumeFileName,
    config: interview.config,
    blueprint: interview.blueprint,
    debug: interview.debug,
    practice: { questions },
  });

  return Response.json({ practiceId: id, questionCount: questions.length });
}
