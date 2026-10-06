"use client";

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { browserLocalPersistence, getAuth, onAuthStateChanged, setPersistence, type Auth, type User } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

export function firebaseClientConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || undefined,
  };
}

export function firebaseConfigured(): boolean {
  const config = firebaseClientConfig();
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
}

let app: FirebaseApp | null = null;
let persistence: Promise<Auth> | null = null;

export function firebaseApp(): FirebaseApp {
  if (!firebaseConfigured()) throw new Error("Firebase is not configured.");
  if (app) return app;
  app = getApps()[0] ?? initializeApp(firebaseClientConfig());
  return app;
}

export function firebaseAuth(): Auth {
  return getAuth(firebaseApp());
}

export function clientFirestore(): Firestore {
  return getFirestore(firebaseApp());
}

export function readyAuth(): Promise<Auth> {
  if (!persistence) {
    persistence = (async () => {
      const auth = firebaseAuth();
      await setPersistence(auth, browserLocalPersistence);
      return auth;
    })();
  }
  return persistence;
}

export async function currentIdToken(): Promise<string | null> {
  if (!firebaseConfigured()) return null;
  const auth = await readyAuth();
  const user = await restoredUser(auth);
  if (!user) return null;
  return user.getIdToken();
}

function restoredUser(auth: Auth): Promise<User | null> {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}
