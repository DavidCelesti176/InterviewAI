"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { LandingPage } from "@/components/landing/landing-page";
import { useAuth } from "@/contexts/auth-context";

export function HomeEntry() {
  const { ready, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && user) router.replace("/dashboard");
  }, [ready, router, user]);

  if (ready && user) {
    return <div className="min-h-dvh" aria-hidden="true" />;
  }

  return <LandingPage signedIn={false} />;
}
