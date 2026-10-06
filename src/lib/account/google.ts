"use client";

import { GoogleAuthProvider, linkWithCredential, signInWithPopup, type AuthCredential, type User } from "firebase/auth";
import { FirebaseError } from "firebase/app";

import { upsertAccountProfile } from "@/lib/account/profile";
import { readyAuth } from "@/lib/firebase/client";

let pendingLink: { email: string; credential: AuthCredential } | null = null;
let inFlight: Promise<User> | null = null;

export function pendingGoogleEmail(): string {
  return pendingLink?.email ?? "";
}

export async function signInWithGoogle(): Promise<User> {
  if (inFlight) return inFlight;
  inFlight = runGoogleSignIn().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runGoogleSignIn(): Promise<User> {
  const auth = await readyAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    const result = await signInWithPopup(auth, provider);
    pendingLink = null;
    await upsertAccountProfile(result.user);
    return result.user;
  } catch (error) {
    const code = errorCode(error);
    if (code === "auth/account-exists-with-different-credential") {
      const credential = error instanceof FirebaseError ? GoogleAuthProvider.credentialFromError(error) : null;
      const email = errorEmail(error);
      pendingLink = credential ? { email, credential } : null;
      const conflict = new Error(
        "That email already uses a password. Sign in with email to keep your interviews, then Google can be connected to that same account.",
      );
      (conflict as Error & { code?: string; email?: string }).code = code;
      (conflict as Error & { email?: string }).email = email;
      throw conflict;
    }
    if (code === "permission-denied") {
      throw new Error("You are signed in, but the account profile could not be saved.");
    }
    throw error;
  }
}

export async function linkPendingGoogleAccount(user: User): Promise<void> {
  if (!pendingLink) return;
  if (pendingLink.email && user.email && pendingLink.email.toLowerCase() !== user.email.toLowerCase()) {
    pendingLink = null;
    return;
  }
  try {
    await linkWithCredential(user, pendingLink.credential);
    pendingLink = null;
    await upsertAccountProfile(user);
  } catch (error) {
    pendingLink = null;
    if (errorCode(error) === "auth/provider-already-linked") return;
    throw error;
  }
}

function errorCode(error: unknown): string {
  return error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code) : "";
}

function errorEmail(error: unknown): string {
  if (!error || typeof error !== "object" || !("customData" in error)) return "";
  const customData = (error as { customData?: { email?: unknown } }).customData;
  return typeof customData?.email === "string" ? customData.email : "";
}
