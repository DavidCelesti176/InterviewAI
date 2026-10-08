import { authenticate, isUser } from "@/lib/firebase/auth-server";
import { deleteInterviewStory, updateInterviewStory } from "@/lib/interview/story-store";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ storyId: string }> }) {
  const user = await authenticate(request);
  if (!isUser(user)) return user;
  const { storyId } = await context.params;
  const body = await request.json().catch(() => null);
  const saved = await updateInterviewStory(user.uid, storyId, body);
  if ("error" in saved) return Response.json({ error: saved.error }, { status: saved.status });
  return Response.json({ story: saved });
}

export async function DELETE(request: Request, context: { params: Promise<{ storyId: string }> }) {
  const user = await authenticate(request);
  if (!isUser(user)) return user;
  const { storyId } = await context.params;
  const removed = await deleteInterviewStory(user.uid, storyId);
  if ("error" in removed) return Response.json({ error: removed.error }, { status: removed.status });
  return Response.json({ ok: true });
}
