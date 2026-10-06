"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { PageShell } from "@/components/interview/page-shell";
import { ButtonLink } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";

export function HomeEntry() {
  const { ready, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && user) router.replace("/dashboard");
  }, [ready, router, user]);

  if (!ready || user) {
    return <div className="min-h-dvh" aria-hidden="true" />;
  }

  return (
    <PageShell>
      <header className="flex flex-col gap-3">
        <h1 className="text-4xl font-semibold tracking-tight">Practice the interview before it counts.</h1>
        <p className="text-lg text-muted">Create an account to save your resume, transcript, and feedback.</p>
      </header>
      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/signup">Create account</ButtonLink>
        <ButtonLink href="/login" variant="secondary">
          Sign in
        </ButtonLink>
      </div>
    </PageShell>
  );
}
