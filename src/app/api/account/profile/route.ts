import { authenticate, isUser } from "@/lib/firebase/auth-server";
import { readUserProfile, saveUserProfile } from "@/lib/firebase/data";

export const runtime = "nodejs";

function cleanName(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 40) : "";
}

export async function GET(request: Request) {
  const user = await authenticate(request);
  if (!isUser(user)) return user;
  const profile = await readUserProfile(user.uid);
  if (!profile) return Response.json({ error: "Profile not found." }, { status: 404 });
  return Response.json({ profile });
}

export async function POST(request: Request) {
  const user = await authenticate(request);
  if (!isUser(user)) return user;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Enter your name." }, { status: 400 });
  }
  const record = body && typeof body === "object" ? (body as { firstName?: unknown; lastName?: unknown }) : {};
  const firstName = cleanName(record.firstName);
  const lastName = cleanName(record.lastName);
  if (!firstName || !lastName) return Response.json({ error: "Enter your first and last name." }, { status: 400 });
  const profile = await saveUserProfile(user, { firstName, lastName });
  return Response.json({ profile });
}
