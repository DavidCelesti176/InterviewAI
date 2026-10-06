import Link from "next/link";

import { FinalCta } from "@/components/landing/final-cta";
import { HowItWorks } from "@/components/landing/how-it-works";
import { InterviewDemo } from "@/components/landing/interview-demo";
import { InterviewerPreview } from "@/components/landing/interviewer-preview";
import { PersonalizationFlow } from "@/components/landing/personalization-flow";
import { ProductCapabilities } from "@/components/landing/product-capabilities";
import { ResultsPreview } from "@/components/landing/results-preview";
import { StoryBuilderPreview } from "@/components/landing/story-builder-preview";
import { ButtonLink } from "@/components/ui/button";

const assurances = ["No credit card", "Resume-aware", "Personalized feedback"];

export function LandingPage({ signedIn = false }: { signedIn?: boolean }) {
  const practiceHref = signedIn ? "/interview/new" : "/signup?next=%2Finterview%2Fnew";
  const storyHref = signedIn ? "/story-builder" : "/signup?next=%2Fstory-builder";
  const signInHref = signedIn ? "/dashboard" : "/login";

  return (
    <div className="min-h-dvh overflow-x-hidden bg-background text-foreground">
      <header className="relative overflow-hidden bg-room text-white">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(47,107,255,0.32),transparent_46%),radial-gradient(ellipse_at_85%_0%,rgba(109,94,252,0.2),transparent_34%)]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-40 bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:80px_80px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_78%)]"
          aria-hidden="true"
        />
        <div className="relative mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5 rounded-[10px] text-sm font-semibold tracking-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            <span className="flex size-8 items-center justify-center rounded-[10px] bg-gradient-to-br from-accent to-violet text-sm font-semibold text-white">
              I
            </span>
            InterviewAI
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2" aria-label="Primary">
            <a href="#how-it-works" className="hidden rounded-[12px] px-3 py-2 text-sm text-white/80 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:inline">
              How it works
            </a>
            <a href="#capabilities" className="hidden rounded-[12px] px-3 py-2 text-sm text-white/80 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:inline">
              Features
            </a>
            <Link href={signInHref} className="rounded-[12px] px-3 py-2 text-sm text-white/80 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              Sign in
            </Link>
            <ButtonLink href={practiceHref} className="px-4">
              Start practicing
            </ButtonLink>
          </nav>
        </div>

        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-5 pt-6 pb-12 sm:px-8 sm:pt-8 sm:pb-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
          <div>
            <p className="text-sm font-medium tracking-[0.16em] text-[#c5d4ff] uppercase">Your resume. The job. A live interview.</p>
            <h1 className="mt-4 max-w-xl text-[2.65rem] leading-[1.05] font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Practice the exact interview before it happens.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">
              Paste the job. Upload your resume. InterviewAI runs a realistic voice interview tailored to the role, company, and your experience — then shows you exactly what to improve.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={practiceHref} className="px-6 py-3 text-base">
                Start a free mock interview
              </ButtonLink>
              <ButtonLink href="#how-it-works" variant="room" className="px-6 py-3 text-base">
                See how it works
              </ButtonLink>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/75">
              {assurances.map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <svg className="size-3.5 text-[#9eb6ff]" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M3 8.2 6.2 11.5 13 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <InterviewDemo />
        </div>
      </header>

      <main>
        <PersonalizationFlow />
        <HowItWorks />
        <ResultsPreview practiceHref={practiceHref} />
        <StoryBuilderPreview storyHref={storyHref} />
        <InterviewerPreview />
        <ProductCapabilities />
        <FinalCta practiceHref={practiceHref} />
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>InterviewAI</p>
          <div className="flex gap-4">
            <Link href={signInHref} className="rounded-md hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
              Sign in
            </Link>
            <Link href="/signup" className="rounded-md hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
              Create an account
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
