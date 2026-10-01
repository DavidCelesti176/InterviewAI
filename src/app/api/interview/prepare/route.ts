import OpenAI from "openai";

import { isSameOrigin } from "@/lib/http/same-origin";
import { prepareInterview, type PrepareStep } from "@/lib/interview/prepare";
import { readInterviewSubmission } from "@/lib/interview/submission";

export const runtime = "nodejs";
export const maxDuration = 120;

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Unexpected request origin", 403);
  if (!process.env.OPENAI_API_KEY) return jsonError("Set OPENAI_API_KEY on the server", 503);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("The interview form could not be read.", 400);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      const onStep = (step: PrepareStep, state: "active" | "done") => send({ step, state });
      try {
        send({ step: "analyzing_resume", state: "active" });
        const submission = await readInterviewSubmission(form);
        if (!submission.ok) {
          send({ step: "error", error: submission.error });
          return;
        }
        send({ step: "analyzing_resume", state: "done" });
        const prepared = await prepareInterview({
          config: submission.config,
          resumeFileName: submission.resumeFileName,
          durationChoice: submission.durationChoice,
          onStep,
        });
        send({
          step: "ready",
          summary: prepared.summary,
          debug: process.env.NODE_ENV === "development" ? prepared.debug : undefined,
        });
      } catch (error) {
        if (error instanceof OpenAI.APIError) {
          console.error("Interview prepare failed", error.status, error.code ?? "", error.message);
        } else {
          console.error("Interview prepare failed", error instanceof Error ? error.message : "error");
        }
        send({
          step: "error",
          error: "The interview plan could not be created. Check the job description and resume, then try again.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  });
}
