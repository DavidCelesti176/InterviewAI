import type { App } from "firebase-admin/app";

const APP_NAME = "interviewai-admin";

function envValue(name: string): string {
  return process.env[name] ?? "";
}

export function adminConfigured(): boolean {
  return Boolean(envValue("FIREBASE_ADMIN_PROJECT_ID") && envValue("FIREBASE_ADMIN_CLIENT_EMAIL") && envValue("FIREBASE_ADMIN_PRIVATE_KEY"));
}

function privateKey(): string {
  return envValue("FIREBASE_ADMIN_PRIVATE_KEY").replace(/\\n/g, "\n");
}

export async function getAdminApp(): Promise<App> {
  const { cert, getApps, initializeApp } = await import("firebase-admin/app");
  const existing = getApps().find((app) => app.name === APP_NAME);
  if (existing) return existing;
  if (!adminConfigured()) {
    throw new Error("Firebase Admin is not configured.");
  }
  return initializeApp(
    {
      credential: cert({
        projectId: envValue("FIREBASE_ADMIN_PROJECT_ID"),
        clientEmail: envValue("FIREBASE_ADMIN_CLIENT_EMAIL"),
        privateKey: privateKey(),
      }),
      storageBucket: envValue("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
    },
    APP_NAME,
  );
}
