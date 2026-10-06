import OpenAI from "openai";

import { authenticate, isUser } from "@/lib/firebase/auth-server";
import { saveResumeFile } from "@/lib/firebase/data";
import { isSameOrigin } from "@/lib/http/same-origin";
import { prepareInterview } from "@/lib/interview/prepare";
import { readInterviewSubmission } from "@/lib/interview/submission";

export const runtime = "nodejs";
export const maxDuration = 120;

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Unexpected request origin", 403);
  if (!process.env.OPENAI_API_KEY) return jsonError("Set OPENAI_API_KEY on the server", 503);
  const user = await authenticate(request);
  if (!isUser(user)) return user;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("The interview form could not be read.", 400);
  }

  const submission = await readInterviewSubmission(form);
  if (!submission.ok) return jsonError(submission.error, submission.status);

  try {
    if (submission.resumeBytes) {
      await saveResumeFile({
        uid: user.uid,
        fileName: submission.resumeFileName,
        bytes: submission.resumeBytes,
        parsedText: submission.config.candidate.resumeText,
      });
    }
    const prepared = await prepareInterview({
      uid: user.uid,
      config: submission.config,
      resumeFileName: submission.resumeFileName,
      durationChoice: submission.durationChoice,
      onStep: () => undefined,
    });
    return Response.json(prepared.summary);
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      console.error("Interview plan failed", error.status, error.code ?? "", error.message);
    } else {
      console.error("Interview plan failed", error instanceof Error ? error.message : "error");
    }
    return jsonError("The interview plan could not be created. Check the job description and resume, then try again.", 502);
  }
}
