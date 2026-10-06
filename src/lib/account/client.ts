"use client";

import { currentIdToken } from "@/lib/firebase/client";

export async function authorizedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = await currentIdToken();
  if (!token) throw new Error("Sign in to continue.");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
