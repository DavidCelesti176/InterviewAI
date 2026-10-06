import { authenticate, isUser } from "@/lib/firebase/auth-server";
import { isRecordId, replaySavedInterview } from "@/lib/firebase/data";
import { isSameOrigin } from "@/lib/http/same-origin";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ interviewId: string }> }) {
  if (!isSameOrigin(request)) return Response.json({ error: "Unexpected request origin" }, { status: 403 });
  const user = await authenticate(request);
  if (!isUser(user)) return user;
  const { interviewId } = await context.params;
  if (!isRecordId(interviewId)) return Response.json({ error: "This interview could not be found." }, { status: 404 });
  const replay = await replaySavedInterview(user.uid, interviewId);
  if (!replay) return Response.json({ error: "This interview cannot be practiced again yet." }, { status: 404 });
  return Response.json(replay);
}
