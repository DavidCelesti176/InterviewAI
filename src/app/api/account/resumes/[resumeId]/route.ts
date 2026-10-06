import { authenticate, isUser } from "@/lib/firebase/auth-server";
import { deleteResume } from "@/lib/firebase/data";

export const runtime = "nodejs";

export async function DELETE(request: Request, context: { params: Promise<{ resumeId: string }> }) {
  const user = await authenticate(request);
  if (!isUser(user)) return user;
  const { resumeId } = await context.params;
  const removed = await deleteResume(user.uid, resumeId);
  if (!removed) return Response.json({ error: "That resume could not be found." }, { status: 404 });
  return Response.json({ ok: true });
}
