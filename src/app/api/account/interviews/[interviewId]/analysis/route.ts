import { BILLING_LAUNCH_AT } from "@/lib/billing/products";
import { projectAnalysis } from "@/lib/billing/project-analysis";
import { readSessionForInterview } from "@/lib/billing/store";
import type { InterviewAnalysis } from "@/lib/interview/analysis-types";
import { authenticate, isUser } from "@/lib/firebase/auth-server";
import { saveInterviewAnalysis } from "@/lib/firebase/data";
import { getInterview } from "@/lib/interview/store";

export const runtime = "nodejs";

function isAnalysis(value: unknown): value is InterviewAnalysis {
  if (!value || typeof value !== "object") return false;
  const analysis = value as Partial<InterviewAnalysis>;
  return typeof analysis.overallReadiness === "number" && typeof analysis.summary === "string" && typeof analysis.overallLabel === "string";
}

export async function POST(request: Request, context: { params: Promise<{ interviewId: string }> }) {
  const user = await authenticate(request);
  if (!isUser(user)) return user;
  const { interviewId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "The review could not be saved." }, { status: 400 });
  }
  const analysis = body && typeof body === "object" ? (body as { analysis?: unknown }).analysis : null;
  if (!isAnalysis(analysis)) return Response.json({ error: "The review could not be saved." }, { status: 400 });
  const grant = await readSessionForInterview(user.uid, interviewId);
  const interview = grant ? null : await getInterview(user.uid, interviewId);
  const tier = grant?.analysisTier ?? ((interview?.createdAt ?? BILLING_LAUNCH_AT) < BILLING_LAUNCH_AT ? "full" : "basic");
  const saved = await saveInterviewAnalysis(user.uid, interviewId, projectAnalysis(analysis, tier));
  if (!saved) return Response.json({ error: "This interview could not be found." }, { status: 404 });
  return Response.json({ ok: true });
}
