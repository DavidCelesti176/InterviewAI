"use client";

import { doc, getDoc, setDoc } from "firebase/firestore";

import { clientFirestore } from "@/lib/firebase/client";
import { storyFromUnknown } from "@/lib/story/story";
import { PRIMARY_STORY_ID, type ProfessionalStory } from "@/lib/story/types";

export async function readSavedStory(uid: string): Promise<ProfessionalStory | null> {
  const snap = await getDoc(doc(clientFirestore(), "users", uid, "story", PRIMARY_STORY_ID));
  if (!snap.exists()) return null;
  return storyFromUnknown(snap.data());
}

export async function saveSavedStory(uid: string, story: ProfessionalStory): Promise<void> {
  const clean = storyFromUnknown(story);
  if (!clean) throw new Error("The story is missing a piece. Add who you are, the proof, and where it leads.");
  await setDoc(doc(clientFirestore(), "users", uid, "story", PRIMARY_STORY_ID), clean);
}
