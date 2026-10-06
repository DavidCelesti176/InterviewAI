import { authenticate, isUser } from "@/lib/firebase/auth-server";
import { progressView } from "@/lib/progress/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await authenticate(request);
  if (!isUser(user)) return user;
  const timezone = new URL(request.url).searchParams.get("timezone") ?? "";
  try {
    const progress = await progressView(user.uid, timezone);
    return Response.json({ progress });
  } catch (error) {
    console.error("Progress read failed", error instanceof Error ? error.message : "error");
    const missing = error instanceof Error && error.message === "Firebase Admin is not configured.";
    return Response.json(
      { error: missing ? "Accounts are not configured yet." : "Progress could not be loaded." },
      { status: missing ? 503 : 500 },
    );
  }
}
