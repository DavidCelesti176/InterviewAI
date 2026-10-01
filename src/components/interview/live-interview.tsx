"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { InterviewRoom } from "@/components/interview/interview-room";
import { PageShell } from "@/components/interview/page-shell";
import { readInterviewSetup, type InterviewSetup } from "@/lib/interview/browser-state";

export function LiveInterview() {
  const [setup, setSetup] = useState<InterviewSetup | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSetup(readInterviewSetup());
    setReady(true);
  }, []);

  if (!ready) return null;
  if (!setup) {
    return (
      <PageShell>
        <h1 className="text-3xl font-semibold tracking-tight">No interview yet</h1>
        <Link className="w-fit rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900" href="/interview/new">
          Create interview
        </Link>
      </PageShell>
    );
  }
  return <InterviewRoom setup={setup} />;
}
