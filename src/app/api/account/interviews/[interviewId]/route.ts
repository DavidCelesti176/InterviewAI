import { authenticate, isUser } from "@/lib/firebase/auth-server";
import { deleteInterview, isRecordId, readInterviewResult, setInterviewer } from "@/lib/firebase/data";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ interviewId: string }> }) {
  const user = await authenticate(request);
  if (!isUser(user)) return user;
  const { interviewId } = await context.params;
  if (!isRecordId(interviewId)) return Response.json({ error: "This interview could not be found." }, { status: 404 });
  const result = await readInterviewResult(user.uid, interviewId);
  if (!result) return Response.json({ error: "This interview could not be found." }, { status: 404 });
  return Response.json({ result });
}

export async function DELETE(request: Request, context: { params: Promise<{ interviewId: string }> }) {
  const user = await authenticate(request);
  if (!isUser(user)) return user;
  const { interviewId } = await context.params;
  const removed = await deleteInterview(user.uid, interviewId);
  if (!removed) return Response.json({ error: "This interview could not be found." }, { status: 404 });
  return Response.json({ ok: true });
}

export async function PATCH(request: Request, context: { params: Promise<{ interviewId: string }> }) {
  const user = await authenticate(request);
  if (!isUser(user)) return user;
  const { interviewId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "The interview could not be updated." }, { status: 400 });
  }
  const interviewerProfileId =
    body && typeof body === "object" && typeof (body as { interviewerProfileId?: unknown }).interviewerProfileId === "string"
      ? (body as { interviewerProfileId: string }).interviewerProfileId.trim().slice(0, 40)
      : "";
  if (!interviewerProfileId) return Response.json({ error: "Choose an interviewer." }, { status: 400 });
  const updated = await setInterviewer(user.uid, interviewId, interviewerProfileId);
  if (!updated) return Response.json({ error: "This interview could not be found." }, { status: 404 });
  return Response.json({ ok: true });
}
