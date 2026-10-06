"use client";

import { GoogleAuthProvider, signInWithPopup, type User } from "firebase/auth";

import { authorizedFetch } from "@/lib/account/client";
import { readyAuth } from "@/lib/firebase/client";

export async function signInWithGoogle(): Promise<User> {
  const auth = await readyAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const result = await signInWithPopup(auth, provider);
  await ensureUserProfile(result.user);
  return result.user;
}

async function ensureUserProfile(user: User): Promise<void> {
  const existing = await authorizedFetch("/api/account/profile");
  if (existing.ok) return;
  if (existing.status !== 404) {
    const body = (await existing.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || "Your profile could not be saved.");
  }
  const { firstName, lastName } = namesFrom(user.displayName, user.email);
  const response = await authorizedFetch("/api/account/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ firstName, lastName }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || "Your profile could not be saved.");
  }
}

function namesFrom(displayName: string | null, email: string | null): { firstName: string; lastName: string } {
  const parts = (displayName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return { firstName: parts[0].slice(0, 40), lastName: parts.slice(1).join(" ").slice(0, 40) };
  }
  const firstName = (parts[0] || email?.split("@")[0] || "Account").slice(0, 40);
  return { firstName, lastName: firstName };
}
