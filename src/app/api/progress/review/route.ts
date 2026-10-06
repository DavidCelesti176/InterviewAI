import { authenticate, isUser } from "@/lib/firebase/auth-server";
import { isRecordId, readAnalysis } from "@/lib/firebase/data";
import { isSameOrigin } from "@/lib/http/same-origin";
import { awardReview } from "@/lib/progress/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Unexpected request origin" }, { status: 403 });
  const user = await authenticate(request);
  if (!isUser(user)) return user;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "The review could not be read." }, { status: 400 });
  }
  const interviewId = body && typeof body === "object" && typeof (body as { interviewId?: unknown }).interviewId === "string"
    ? (body as { interviewId: string }).interviewId.trim()
    : "";
  if (!isRecordId(interviewId)) return Response.json({ error: "This review could not be found." }, { status: 404 });
  const analysis = await readAnalysis(user.uid, interviewId);
  if (!analysis) return Response.json({ ok: true, granted: false });
  try {
    const granted = await awardReview(user.uid, interviewId);
    return Response.json({ ok: true, granted });
  } catch (error) {
    console.error("Review award failed", error instanceof Error ? error.message : "error");
    return Response.json({ ok: true, granted: false });
  }
}
