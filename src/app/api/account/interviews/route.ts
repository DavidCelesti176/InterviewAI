import { authenticate, isUser } from "@/lib/firebase/auth-server";
import { listInterviews } from "@/lib/firebase/data";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await authenticate(request);
  if (!isUser(user)) return user;
  const interviews = await listInterviews(user.uid);
  return Response.json({ interviews });
}
