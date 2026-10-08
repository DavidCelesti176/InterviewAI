import { getAdminApp } from "@/lib/firebase/admin";

export type AuthenticatedUser = {
  uid: string;
  email: string;
};

export class UnauthorizedError extends Error {
  readonly status = 401;
  readonly reason: string;

  constructor(reason = "unauthorized") {
    super("Sign in to continue.");
    this.name = "UnauthorizedError";
    this.reason = reason;
  }
}

export async function requireAuthenticatedUser(request: Request): Promise<AuthenticatedUser> {
  const token = bearerToken(request);
  if (!token) throw new UnauthorizedError("missing-token");
  try {
    const { getAuth } = await import("firebase-admin/auth");
    const decoded = await getAuth(await getAdminApp()).verifyIdToken(token);
    if (!decoded.uid) throw new UnauthorizedError("missing-uid");
    return { uid: decoded.uid, email: typeof decoded.email === "string" ? decoded.email : "" };
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    if (adminUnavailable(error)) throw new Error("Firebase Admin is not configured.");
    throw new UnauthorizedError("rejected");
  }
}

function bearerToken(request: Request): string {
  const custom = request.headers.get("x-firebase-token") ?? "";
  const authorization = request.headers.get("authorization") ?? "";
  const header = custom.trim() || authorization.trim();
  const match = /^(?:Bearer\s+)?(\S+)$/i.exec(header);
  return match?.[1]?.trim() ?? "";
}

function adminUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message;
  return (
    message === "Firebase Admin is not configured." ||
    /cannot find module ['"]firebase-admin/i.test(message) ||
    /could not resolve ['"]firebase-admin/i.test(message)
  );
}

export function unauthorizedResponse(): Response {
  return Response.json({ error: "Sign in to continue.", code: "AUTH_REQUIRED" }, { status: 401 });
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
