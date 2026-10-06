import type { App } from "firebase-admin/app";

const APP_NAME = "interviewai-admin";

export function adminConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_ADMIN_PROJECT_ID &&
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
      process.env.FIREBASE_ADMIN_PRIVATE_KEY,
  );
}

function privateKey(): string {
  return (process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
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
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: privateKey(),
      }),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    },
    APP_NAME,
  );
}
