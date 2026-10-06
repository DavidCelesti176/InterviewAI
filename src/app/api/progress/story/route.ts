import { authenticate, isUser } from "@/lib/firebase/auth-server";
import { readProfessionalStory } from "@/lib/firebase/data";
import { isSameOrigin } from "@/lib/http/same-origin";
import { awardStorySave } from "@/lib/progress/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Unexpected request origin" }, { status: 403 });
  const user = await authenticate(request);
  if (!isUser(user)) return user;
  const story = await readProfessionalStory(user.uid);
  if (!story) return Response.json({ error: "Save your story first." }, { status: 404 });
  try {
    await awardStorySave(user.uid, story.generalTellMeAboutYourself);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Story award failed", error instanceof Error ? error.message : "error");
    return Response.json({ error: "The story was saved, but progress could not be updated." }, { status: 500 });
  }
}
