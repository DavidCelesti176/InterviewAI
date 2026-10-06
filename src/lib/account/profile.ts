"use client";

import { doc, getDoc, setDoc } from "firebase/firestore";

import type { UserProfile } from "@/lib/account/types";
import { clientFirestore } from "@/lib/firebase/client";

type AccountIdentity = {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
};

export async function readAccountProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(clientFirestore(), "users", uid));
  if (!snap.exists()) return null;
  return profileFrom(uid, snap.data());
}

export async function upsertAccountProfile(
  user: AccountIdentity,
  names?: { firstName?: string; lastName?: string },
): Promise<UserProfile> {
  const ref = doc(clientFirestore(), "users", user.uid);
  const snap = await getDoc(ref);
  const existing = snap.exists() ? snap.data() : {};
  const parsed = splitName(user.displayName);
  const firstName = kept(names?.firstName) || kept(existing.firstName) || parsed.firstName;
  const lastName = kept(names?.lastName) || kept(existing.lastName) || parsed.lastName;
  const email = kept(user.email) || kept(existing.email);
  const explicitName = [kept(names?.firstName), kept(names?.lastName)].filter(Boolean).join(" ");
  const displayName =
    explicitName || kept(existing.displayName) || kept(user.displayName) || [firstName, lastName].filter(Boolean).join(" ") || email;
  const photoURL = kept(user.photoURL) || kept(existing.photoURL);
  const now = Date.now();
  const payload: Record<string, string | number> = {
    uid: user.uid,
    updatedAt: now,
  };
  if (!snap.exists()) payload.createdAt = now;
  if (email) payload.email = email;
  if (firstName) payload.firstName = firstName;
  if (lastName) payload.lastName = lastName;
  if (displayName) payload.displayName = displayName;
  if (photoURL) payload.photoURL = photoURL;
  await setDoc(ref, payload, { merge: true });
  return {
    uid: user.uid,
    email: email || kept(existing.email),
    firstName: firstName || kept(existing.firstName),
    lastName: lastName || kept(existing.lastName),
    displayName: displayName || kept(existing.displayName),
    photoURL: photoURL || undefined,
    createdAt: typeof existing.createdAt === "number" ? existing.createdAt : now,
    updatedAt: now,
  };
}

function profileFrom(uid: string, data: Record<string, unknown>): UserProfile | null {
  const email = kept(data.email);
  const firstName = kept(data.firstName);
  if (!email && !firstName) return null;
  const lastName = kept(data.lastName);
  return {
    uid,
    email,
    firstName,
    lastName,
    displayName: kept(data.displayName) || [firstName, lastName].filter(Boolean).join(" ") || email,
    photoURL: kept(data.photoURL) || undefined,
    createdAt: typeof data.createdAt === "number" ? data.createdAt : Date.now(),
    updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : Date.now(),
  };
}

function splitName(displayName: string | null | undefined): { firstName: string; lastName: string } {
  const parts = (displayName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0].slice(0, 40), lastName: "" };
  return { firstName: parts[0].slice(0, 40), lastName: parts.slice(1).join(" ").slice(0, 40) };
}

function kept(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 500) : "";
}
