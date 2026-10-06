import { authenticate, isUser } from "@/lib/firebase/auth-server";
import { listResumes } from "@/lib/firebase/data";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await authenticate(request);
  if (!isUser(user)) return user;
  const resumes = await listResumes(user.uid);
  return Response.json({ resumes });
}
