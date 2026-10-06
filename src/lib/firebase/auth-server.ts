import { getAdminApp } from "@/lib/firebase/admin";

export type AuthenticatedUser = {
  uid: string;
  email: string;
};

export class UnauthorizedError extends Error {
  readonly status = 401;

  constructor() {
    super("Sign in to continue.");
    this.name = "UnauthorizedError";
  }
}

export async function requireAuthenticatedUser(request: Request): Promise<AuthenticatedUser> {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  const token = match?.[1]?.trim();
  if (!token) throw new UnauthorizedError();
  try {
    const { getAuth } = await import("firebase-admin/auth");
    const decoded = await getAuth(await getAdminApp()).verifyIdToken(token);
    if (!decoded.uid) throw new UnauthorizedError();
    return { uid: decoded.uid, email: typeof decoded.email === "string" ? decoded.email : "" };
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    if (error instanceof Error && error.message === "Firebase Admin is not configured.") throw error;
    throw new UnauthorizedError();
  }
}

export function unauthorizedResponse(): Response {
  return Response.json({ error: "Sign in to continue." }, { status: 401 });
}

export function unavailableAccountResponse(): Response {
  return Response.json({ error: "Accounts are not configured yet." }, { status: 503 });
}

export async function authenticate(request: Request): Promise<AuthenticatedUser | Response> {
  try {
    return await requireAuthenticatedUser(request);
  } catch (error) {
    if (error instanceof Error && error.message === "Firebase Admin is not configured.") {
      return unavailableAccountResponse();
    }
    return unauthorizedResponse();
  }
}

export function isUser(value: AuthenticatedUser | Response): value is AuthenticatedUser {
  return !(value instanceof Response);
}
