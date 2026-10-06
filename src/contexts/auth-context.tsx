"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { UserProfile } from "@/lib/account/types";
import { authorizedFetch } from "@/lib/account/client";
import { firebaseConfigured, readyAuth } from "@/lib/firebase/client";

type AuthState = {
  ready: boolean;
  configured: boolean;
  user: User | null;
  profile: UserProfile | null;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  ready: false,
  configured: false,
  user: null,
  profile: null,
  refreshProfile: async () => undefined,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = firebaseConfigured();
  const [ready, setReady] = useState(!configured);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!configured) return;
    let unsubscribe = () => {};
    let cancelled = false;
    void readyAuth()
      .then((auth) => {
        if (cancelled) return;
        unsubscribe = onAuthStateChanged(auth, (next) => {
          setUser(next);
          setReady(true);
          if (!next) setProfile(null);
        });
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [configured]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void authorizedFetch("/api/account/profile")
      .then(async (response) => {
        if (!response.ok) return null;
        const body = (await response.json()) as { profile?: UserProfile };
        return body.profile ?? null;
      })
      .then((next) => {
        if (!cancelled) setProfile(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user]);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      configured,
      user,
      profile,
      refreshProfile: async () => {
        if (!user) return;
        const response = await authorizedFetch("/api/account/profile");
        if (!response.ok) return;
        const body = (await response.json()) as { profile?: UserProfile };
        setProfile(body.profile ?? null);
      },
    }),
    [configured, profile, ready, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
