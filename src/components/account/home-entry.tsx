"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AnimatedInterviewer } from "@/components/interview/avatar/animated-interviewer";
import { interviewerProfiles } from "@/components/interview/avatar/profile";
import { Button, ButtonLink } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";

const steps = [
  {
    number: "01",
    title: "Paste the job",
    body: "Drop in the posting. InterviewAI pulls the company, the role, and what they actually care about.",
  },
  {
    number: "02",
    title: "Talk it through",
    body: "A live voice interviewer has your resume. Answer out loud. Pause, ask for the question again, or keep going.",
  },
  {
    number: "03",
    title: "Keep the tape",
    body: "The transcript and the feedback stay on your account, so the next round starts from what you already learned.",
  },
];

export function HomeEntry() {
  const { ready, user } = useAuth();
  const router = useRouter();
  const [shareNote, setShareNote] = useState("");
  const [shareLink, setShareLink] = useState("");

  useEffect(() => {
    if (ready && user) router.replace("/dashboard");
  }, [ready, router, user]);

  if (!ready || user) {
    return <div className="min-h-dvh" aria-hidden="true" />;
  }

  async function share() {
    const url = window.location.origin;
    const text = "Practice the interview before it counts.";
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "InterviewAI", text, url });
        setShareNote("Shared.");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareLink("");
      setShareNote("Link copied.");
    } catch {
      setShareLink(url);
      setShareNote("");
    }
  }

  return (
    <div className="min-h-dvh bg-[#f3f5f8] text-foreground">
      <header className="relative overflow-hidden bg-room text-white">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(47,107,255,0.45),transparent_42%),radial-gradient(ellipse_at_80%_20%,rgba(109,94,252,0.28),transparent_32%)]"
          aria-hidden="true"
        />
        <div className="relative mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-sm font-semibold tracking-tight">
            <Mark />
            InterviewAI
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3">
            <Link href="/login" className="rounded-[12px] px-3 py-2 text-sm text-white/80 hover:text-white">
              Sign in
            </Link>
            <ButtonLink href="/signup" className="px-4">
              Start practicing
            </ButtonLink>
          </nav>
        </div>

        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-5 pt-8 pb-20 sm:px-8 sm:pt-14 sm:pb-28 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-sm font-medium tracking-[0.18em] text-white/60 uppercase">The interview, before the interview</p>
            <h1 className="mt-4 max-w-xl text-5xl leading-[0.95] font-semibold tracking-tight sm:text-7xl">
              Don’t meet them for the first time on the day.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/75">
              A live voice interview for the job you actually want. It reads your resume, asks like a person, and leaves you with the transcript and the feedback.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/signup" className="px-6 py-3 text-base">
                Practice this week’s interview
              </ButtonLink>
              <ButtonLink href="/login" variant="room" className="px-6 py-3 text-base">
                I already have an account
              </ButtonLink>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/60">
              <li>Live voice</li>
              <li>Resume-aware</li>
              <li>Yours to keep</li>
            </ul>
          </div>
          <PortraitPair />
        </div>
      </header>

      <main>
        <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="max-w-2xl">
            <p className="text-sm font-medium tracking-[0.18em] text-accent uppercase">How it goes</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">Three steps. Then you’re in the room.</h2>
          </div>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {steps.map((step) => (
              <li key={step.number} className="rounded-[24px] border border-line bg-card p-6 shadow-[var(--shadow-card)]">
                <p className="font-mono text-sm text-accent">{step.number}</p>
                <h3 className="mt-4 text-xl font-semibold tracking-tight">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-y border-line bg-white">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-sm font-medium tracking-[0.18em] text-accent uppercase">Who’s across the table</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">Pick the interviewer. Hear yourself answer.</h2>
              <p className="mt-4 max-w-md text-base leading-relaxed text-muted">
                Claire keeps it warm. James keeps it straight. Same job, same resume, two different rooms — so you find out which version of you shows up.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {interviewerProfiles.map((profile) => (
                <figure key={profile.id} className="overflow-hidden rounded-[24px] border border-line bg-card">
                  <div className="aspect-[4/5] bg-[radial-gradient(circle_at_50%_18%,#f7f4ef,#d5deea)]">
                    <AnimatedInterviewer id={`home-${profile.id}`} look={profile.look} label={profile.name} />
                  </div>
                  <figcaption className="px-4 py-4">
                    <p className="font-semibold">{profile.name}</p>
                    <p className="text-xs font-medium tracking-wide text-accent uppercase">{profile.styleLabel}</p>
                    <p className="mt-1 text-sm text-muted">{profile.shortDescription}</p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="overflow-hidden rounded-[32px] bg-room px-6 py-12 text-white sm:px-12 sm:py-16">
            <p className="max-w-3xl text-4xl leading-[1.05] font-semibold tracking-tight sm:text-6xl">
              Know someone with an interview this week?
            </p>
            <p className="mt-4 max-w-xl text-lg text-white/70">Send them the room. They can practice before it counts.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button type="button" variant="secondary" className="bg-white" onClick={() => void share()}>
                {shareNote === "Link copied." || shareNote === "Shared." ? shareNote : "Share InterviewAI"}
              </Button>
              <ButtonLink href="/signup" className="px-6">
                Start practicing
              </ButtonLink>
            </div>
            {shareLink ? (
              <label className="mt-5 block text-sm text-white/70">
                Copy this link
                <input
                  readOnly
                  value={shareLink}
                  className="mt-2 w-full rounded-[14px] border border-white/15 bg-white/10 px-4 py-3 text-white"
                  onFocus={(event) => event.currentTarget.select()}
                />
              </label>
            ) : null}
            <p className="sr-only" role="status">
              {shareNote}
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>InterviewAI</p>
          <div className="flex gap-4">
            <Link href="/login" className="hover:text-foreground">
              Sign in
            </Link>
            <Link href="/signup" className="hover:text-foreground">
              Create an account
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function PortraitPair() {
  const claire = interviewerProfiles.find((profile) => profile.id === "claire") ?? interviewerProfiles[0];
  const james = interviewerProfiles.find((profile) => profile.id === "james") ?? interviewerProfiles[1];
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-6 rounded-[40px] bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,0.16),transparent_68%)]" aria-hidden="true" />
      <div className="relative grid grid-cols-2 gap-3">
        <Portrait profile={claire} featured />
        <Portrait profile={james} />
      </div>
    </div>
  );
}

function Portrait({
  profile,
  featured = false,
}: {
  profile: (typeof interviewerProfiles)[number];
  featured?: boolean;
}) {
  return (
    <figure className={`overflow-hidden rounded-[28px] border border-white/15 bg-white/10 shadow-[0_24px_60px_rgba(0,0,0,0.28)] ${featured ? "mt-8" : ""}`}>
      <div className="aspect-[4/5] bg-[radial-gradient(circle_at_50%_18%,#f7f4ef,#d5deea)]">
        <AnimatedInterviewer id={`hero-${profile.id}`} look={profile.look} label={profile.name} />
      </div>
      <figcaption className="px-4 py-3 text-white">
        <p className="font-semibold">{profile.name}</p>
        <p className="text-xs tracking-wide text-white/60 uppercase">{profile.styleLabel}</p>
      </figcaption>
    </figure>
  );
}

function Mark() {
  return (
    <span className="flex size-8 items-center justify-center rounded-[10px] bg-gradient-to-br from-accent to-violet text-sm font-semibold text-white">
      I
    </span>
  );
}
