"use client";

import { currentIdToken } from "@/lib/firebase/client";

export function rememberFirebaseToken(token: string): void {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `firebase-token=${encodeURIComponent(token)}; Path=/; SameSite=Lax; Max-Age=3600${secure}`;
}

export async function authorizedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = await currentIdToken();
  if (!token) throw new Error("Sign in to continue.");
  rememberFirebaseToken(token);
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("x-firebase-token", token);
  return fetch(input, { ...init, headers, credentials: "same-origin" });
}
