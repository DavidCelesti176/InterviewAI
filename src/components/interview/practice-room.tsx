"use client";

import { useEffect, useState } from "react";

import { InterviewRoom } from "@/components/interview/interview-room";
import { PageShell } from "@/components/interview/page-shell";
import { ButtonLink } from "@/components/ui/button";
import { readPracticeSetup, type InterviewSetup, type PracticeSetup } from "@/lib/interview/browser-state";

export function PracticeRoom() {
  const [practice, setPractice] = useState<PracticeSetup | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPractice(readPracticeSetup());
    setReady(true);
  }, []);

  if (!ready) return null;
  if (!practice) {
    return (
      <PageShell>
        <h1 className="text-4xl font-semibold tracking-tight">No practice session</h1>
        <p className="text-muted">Open a finished interview and choose an answer to practice.</p>
        <ButtonLink href="/interview/results">Back to your review</ButtonLink>
      </PageShell>
    );
  }

  const setup: InterviewSetup = {
    interviewId: practice.interviewId,
    company: practice.company,
    jobTitle: practice.jobTitle,
    interviewType: practice.interviewType,
    targetDurationMinutes: Math.min(20, Math.max(8, practice.questions.length * 5)),
    durationChoice: "15",
    resumeFileName: "",
  };

  return <InterviewRoom setup={setup} mode="practice" practiceQuestions={practice.questions} />;
}
