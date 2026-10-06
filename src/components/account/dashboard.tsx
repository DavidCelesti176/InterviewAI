"use client";

import { signOut } from "firebase/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { useAuth } from "@/contexts/auth-context";
import { authorizedFetch } from "@/lib/account/client";
import { deleteOwnedInterview, listOwnedInterviews } from "@/lib/account/interviews";
import type { InterviewCard, InterviewStatusName } from "@/lib/account/types";
import { readyAuth } from "@/lib/firebase/client";
import { saveInterviewSetup, savePracticeSetup, type InterviewSetup, type SavedInterviewResult } from "@/lib/interview/browser-state";
import { levelSpan } from "@/lib/progress/award";
import type { ProgressView, SkillId } from "@/lib/progress/types";
import { readSavedStory } from "@/lib/story/client";
import type { ProfessionalStory } from "@/lib/story/types";

const coral = "#e8633a";

export function Dashboard() {
  const { profile, user } = useAuth();
  const [interviews, setInterviews] = useState<InterviewCard[]>([]);
  const [progress, setProgress] = useState<ProgressView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [story, setStory] = useState<ProfessionalStory | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [questOpen, setQuestOpen] = useState(true);
  const [shareNote, setShareNote] = useState("");
  const firstName = profile?.firstName || user?.displayName?.split(" ")[0] || "";
  const fullName = profile?.displayName || user?.displayName || firstName || "Account";

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    void Promise.all([
      listOwnedInterviews(user.uid),
      readSavedStory(user.uid).catch(() => null),
      authorizedFetch(`/api/progress?timezone=${encodeURIComponent(timezone)}`)
        .then(async (response) => {
          if (!response.ok) return null;
          const body = (await response.json()) as { progress?: ProgressView };
          return body.progress ?? null;
        })
        .catch(() => null),
    ])
      .then(([items, savedStory, savedProgress]) => {
        if (cancelled) return;
        setInterviews(items);
        setStory(savedStory);
        setProgress(savedProgress);
      })
      .catch(() => {
        if (!cancelled) setError("Your interviews could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function remove(id: string) {
    setDeleting(true);
    setError("");
    try {
      if (!user) throw new Error("Sign in to continue.");
      await deleteOwnedInterview(user.uid, id);
      setInterviews((current) => current.filter((item) => item.id !== id));
      setPendingDelete(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That interview could not be deleted.");
    } finally {
      setDeleting(false);
    }
  }

  async function share() {
    const url = window.location.origin;
    const text = "Practice the interview before it happens.";
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "InterviewAI", text, url });
        setShareNote("Shared.");
        return;
      } catch (reason) {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareNote("Link copied.");
    } catch {
      setShareNote(url);
    }
  }

  const recent = showAll ? interviews : interviews.slice(0, 4);
  const report = interviews.find((item) => item.status !== "preparing" && item.status !== "ready" && item.status !== "draft");
  const minutes = weekMinutes(interviews);
  const span = progress ? levelSpan(progress.xp) : null;
  const levelFill = span && progress ? Math.min(100, Math.round(((progress.xp - span.start) / Math.max(1, span.next - span.start)) * 100)) : 0;

  return (
    <div className="min-h-dvh bg-[#f6f3ee] text-[#1c1915]">
      <div className="lg:grid lg:min-h-dvh lg:grid-cols-[248px_minmax(0,1fr)]">
        <Sidebar
          name={fullName}
          email={profile?.email || user?.email || ""}
          firstName={firstName}
          streak={progress?.streakCount ?? 0}
          practiceDue={progress ? !progress.daily.completed : false}
        />
        <div className="min-w-0">
          <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
            <p className="text-sm text-[#6d675f]">
              <span>{formatLongDate(Date.now())}</span>
              <span className="px-2 text-[#c4bdb4]">/</span>
              <span className="text-[#1c1915]">{greeting(firstName)}</span>
            </p>
            <Link href="/interview/new" className="inline-flex items-center gap-1.5 rounded-full bg-[#1c1915] px-4 py-2.5 text-sm font-medium text-white">
              <span aria-hidden="true">+</span> New interview
            </Link>
          </header>

          <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 pb-16 sm:px-8">
            {user && !user.emailVerified ? (
              <p className="text-sm text-[#6d675f]">Verify your email when you can. You can keep using InterviewAI.</p>
            ) : null}
            <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-medium tracking-[0.16em] text-[#8a837a] uppercase">Your prep HQ</p>
                <h1 className="mt-2 max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">
                  Make your next <span style={{ color: coral }}>yes</span> inevitable.
                </h1>
                <p className="mt-2 text-[#6d675f]">Small reps. Sharper stories. Big career energy.</p>
              </div>
              <LevelCard progress={progress} loading={loading} fill={levelFill} next={span?.next ?? null} />
            </section>

            <section className="grid overflow-hidden rounded-[22px] border border-[#ece7e0] bg-white shadow-[0_10px_30px_rgba(28,25,21,0.04)] sm:grid-cols-2 xl:grid-cols-4" aria-label="Your progress">
              <Stat
                icon={<Flame />}
                tone="#e8633a"
                label="Current streak"
                value={progress ? (progress.streakCount > 0 ? `${progress.streakCount} day${progress.streakCount === 1 ? "" : "s"}` : "Not started") : "—"}
                detail={progress && progress.streakCount > 0 ? "A short practice keeps it going." : "One finished practice starts it."}
              />
              <Stat
                icon={<Target />}
                tone="#1f9d6a"
                label="Interview readiness"
                value={progress?.readiness === null || progress?.readiness === undefined ? "—" : `${progress.readiness}/100`}
                detail={progress?.readinessLabel ?? "After your first interview"}
              />
              <Stat icon={<Clock />} tone="#3b6fd8" label="Practice time" value={`${minutes} min`} detail="Saved interviews this week" />
              <Stat
                icon={<Medal />}
                tone="#d89a1a"
                label="Achievements"
                value={progress ? `${progress.achievementCount} unlocked` : "—"}
                detail={progress?.newestAchievement?.label ?? "Finish a practice to earn one."}
              />
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.35fr_0.85fr]">
              {questOpen && progress ? (
                <article className="rounded-[22px] border border-[#ece7e0] bg-white p-6 shadow-[0_10px_30px_rgba(28,25,21,0.04)] sm:p-7">
                  <p className="text-xs font-medium tracking-[0.16em] uppercase" style={{ color: coral }}>
                    Today’s quest · +{questXp(progress.daily.primary)} XP
                  </p>
                  <div className="mt-4 grid items-center gap-6 lg:grid-cols-[1fr_180px]">
                    <div>
                      <h2 className="max-w-md text-4xl font-semibold tracking-tight">
                        {progress.daily.completed ? "You practiced today." : progress.daily.primary.title}
                      </h2>
                      <p className="mt-3 max-w-md text-[#6d675f]">
                        {progress.daily.completed ? "Another rep is optional." : progress.daily.primary.detail}
                      </p>
                      <div className="mt-6 flex flex-wrap items-center gap-4">
                        <Link href={progress.daily.primary.href} className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-white" style={{ background: coral }}>
                          <Play />
                          {progress.daily.completed ? "Practice again" : "Start practice"}
                        </Link>
                        <button type="button" className="text-sm text-[#6d675f] hover:text-[#1c1915]" onClick={() => setQuestOpen(false)}>
                          Maybe later
                        </button>
                      </div>
                    </div>
                    <QuestMark />
                  </div>
                </article>
              ) : (
                <article className="flex flex-col justify-center rounded-[22px] border border-[#ece7e0] bg-white p-6 shadow-[0_10px_30px_rgba(28,25,21,0.04)]">
                  <p className="text-xs font-medium tracking-[0.16em] text-[#8a837a] uppercase">Today’s quest</p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-tight">{loading ? "Loading today’s practice…" : "Start with a story or a mock."}</h2>
                  <Link href="/interview/new" className="mt-5 inline-flex w-fit items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-white" style={{ background: coral }}>
                    <Play /> New interview
                  </Link>
                </article>
              )}
              <JourneyCard progress={progress} />
            </section>

            <section id="progress" className="grid scroll-mt-6 gap-5 xl:grid-cols-[1.15fr_0.85fr]">
              <SkillMap progress={progress} reportHref={report ? `/interview/${report.id}/results` : ""} />
              <StoryBank story={story} loading={loading} />
            </section>

            <section>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-medium tracking-[0.16em] text-[#8a837a] uppercase">Recent practice</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight">Your reps are adding up</h2>
                </div>
                {interviews.length > 4 ? (
                  <button type="button" className="text-sm font-medium text-[#6d675f]" onClick={() => setShowAll((current) => !current)}>
                    {showAll ? "Show less" : "See all"}
                  </button>
                ) : null}
              </div>
              {error ? (
                <p className="mt-3 text-sm text-danger" role="alert">
                  {error}
                </p>
              ) : null}
              {loading ? <div className="mt-4 h-28 rounded-[22px] border border-[#ece7e0] bg-white" aria-hidden="true" /> : null}
              {!loading && interviews.length === 0 ? (
                <p className="mt-4 rounded-[22px] border border-[#ece7e0] bg-white px-5 py-6 text-sm text-[#6d675f]">
                  When you finish an interview, the job, transcript, and feedback stay here.
                </p>
              ) : null}
              {recent.length > 0 ? (
                <ul className="mt-3 overflow-hidden rounded-[22px] border border-[#ece7e0] bg-white">
                  {recent.map((item) => (
                    <li key={item.id} className="border-b border-[#f0ebe4] last:border-b-0">
                      <InterviewRow
                        item={item}
                        pendingDelete={pendingDelete === item.id}
                        deleting={deleting}
                        onDelete={() => setPendingDelete(item.id)}
                        onConfirm={() => void remove(item.id)}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>

            <section className="flex flex-col gap-3 rounded-[22px] border border-[#f0d7c8] bg-[#fff7f2] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-[#e8633a]" aria-hidden="true">
                  <People />
                </span>
                <div>
                  <p className="font-semibold">Good interviews are better together.</p>
                  <p className="text-sm text-[#6d675f]">Send InterviewAI to someone preparing this week.</p>
                </div>
              </div>
              <button type="button" className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-[#1c1915] shadow-sm" onClick={() => void share()}>
                {shareNote === "Shared." || shareNote === "Link copied." ? shareNote : "Invite a friend"}
                <span aria-hidden="true">→</span>
              </button>
            </section>
            {shareNote.startsWith("http") ? (
              <label className="text-sm text-[#6d675f]">
                Copy this link
                <input readOnly value={shareNote} className="mt-2 w-full rounded-[14px] border border-[#ece7e0] bg-white px-4 py-3" onFocus={(event) => event.currentTarget.select()} />
              </label>
            ) : null}
            <p className="sr-only" role="status">
              {shareNote}
            </p>
          </main>
        </div>
      </div>
    </div>
  );
}

function Sidebar({
  name,
  email,
  firstName,
  streak,
  practiceDue,
}: {
  name: string;
  email: string;
  firstName: string;
  streak: number;
  practiceDue: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const initial = (firstName || name).slice(0, 1).toUpperCase() || "I";

  async function logout() {
    const auth = await readyAuth();
    await signOut(auth);
    router.replace("/");
  }

  return (
    <aside className="bg-[#10151f] text-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:px-4 lg:py-5">
      <div className="flex items-center justify-between px-4 py-3 lg:px-2">
        <Link href="/dashboard" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <span className="grid size-8 place-items-center rounded-[10px] text-white" style={{ background: coral }} aria-hidden="true">
            <Spark />
          </span>
          interview<span style={{ color: coral }}>AI</span>
        </Link>
        <button type="button" className="rounded-full px-3 py-1 text-sm text-white/80 lg:hidden" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
          {open ? "Close" : "Menu"}
        </button>
      </div>
      <div className={`${open ? "block" : "hidden"} lg:flex lg:min-h-0 lg:flex-1 lg:flex-col`}>
        <Link href="/account" className="mx-2 flex items-center justify-between gap-2 rounded-[14px] px-3 py-3 text-left hover:bg-white/5">
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full text-sm font-medium text-white" style={{ background: coral }}>
              {initial}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{firstName ? `${firstName}’s workspace` : "Your workspace"}</span>
              <span className="block text-xs text-white/50">Your interviews</span>
            </span>
          </span>
          <span className="text-white/40" aria-hidden="true">
            ›
          </span>
        </Link>
        <nav className="mt-2 flex flex-col gap-1 px-2" aria-label="Dashboard">
          <NavLink href="/dashboard" current>
            <HomeIcon /> Overview
          </NavLink>
          <NavLink href="/interview/new">
            <Play /> Practice room
            {practiceDue ? <span className="ml-auto size-1.5 rounded-full bg-[#e8633a]" aria-label="Practice is waiting" /> : null}
          </NavLink>
          <NavLink href="/story-builder">
            <Book /> My stories
          </NavLink>
          <NavLink href="#progress">
            <Chart /> Progress
          </NavLink>
        </nav>
        <div className="mt-auto hidden flex-col gap-3 px-2 pt-6 lg:flex">
          {streak > 0 ? (
            <Link href="#progress" className="flex items-center justify-between gap-2 rounded-[16px] bg-white/5 px-3 py-3 hover:bg-white/10">
              <span className="flex items-center gap-2">
                <span className="text-[#e8633a]" aria-hidden="true">
                  <Flame />
                </span>
                <span>
                  <span className="block text-sm font-medium">{streak} day streak</span>
                  <span className="block text-xs text-white/50">Keep it going</span>
                </span>
              </span>
              <span className="text-white/40" aria-hidden="true">
                ›
              </span>
            </Link>
          ) : null}
          <Link href="/account" className="px-2 text-sm text-white/70 hover:text-white">
            Account
          </Link>
          <div className="relative">
            <div className="flex w-full items-center gap-2 rounded-[14px] px-2 py-2 text-left">
              <span className="grid size-8 place-items-center rounded-full text-sm font-medium text-white" style={{ background: coral }}>
                {initial}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{name}</span>
                <span className="block truncate text-xs text-white/45">{email}</span>
              </span>
            </div>
            <button type="button" className="mt-1 w-full rounded-[12px] px-3 py-2 text-left text-sm text-white/70 hover:bg-white/5" onClick={() => void logout()}>
              Sign out
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-2 px-4 py-4 lg:hidden">
          <Link href="/account" className="text-sm text-white/70">
            Account
          </Link>
          <button type="button" className="text-left text-sm text-white/70" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}

function NavLink({ href, current = false, children }: { href: string; current?: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`flex items-center gap-2 rounded-[12px] px-3 py-2.5 text-sm ${current ? "bg-white/10 text-white shadow-[inset_3px_0_0_#e8633a]" : "text-white/70 hover:bg-white/5 hover:text-white"}`}
    >
      {children}
    </Link>
  );
}

function LevelCard({ progress, loading, fill, next }: { progress: ProgressView | null; loading: boolean; fill: number; next: number | null }) {
  if (loading) return <div className="h-24 w-full rounded-[20px] border border-[#ece7e0] bg-white lg:w-64" aria-hidden="true" />;
  if (!progress || next === null) return null;
  return (
    <div className="w-full rounded-[20px] border border-[#ece7e0] bg-white px-4 py-3 shadow-[0_10px_30px_rgba(28,25,21,0.04)] lg:w-64">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-[12px] text-white" style={{ background: coral }} aria-hidden="true">
          <Spark />
        </span>
        <span>
          <span className="block text-[11px] font-medium tracking-[0.14em] text-[#8a837a] uppercase">Level {String(progress.level).padStart(2, "0")}</span>
          <span className="block text-sm font-semibold">{progress.levelTitle}</span>
        </span>
      </div>
      <p className="mt-3 text-xs text-[#6d675f]">
        {progress.xp.toLocaleString()} / {next.toLocaleString()} XP
      </p>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#f0ebe4]" role="meter" aria-label="Level progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={fill}>
        <div className="h-full rounded-full" style={{ width: `${fill}%`, background: coral }} />
      </div>
    </div>
  );
}

function Stat({ icon, label, value, detail, tone }: { icon: ReactNode; label: string; value: string; detail: string; tone: string }) {
  return (
    <div className="px-5 py-4 xl:border-r xl:border-[#f0ebe4] xl:last:border-r-0">
      <p className="flex items-center justify-between gap-2 text-xs font-medium tracking-wide text-[#8a837a] uppercase">
        {label}
        <span style={{ color: tone }} aria-hidden="true">
          {icon}
        </span>
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-sm text-[#6d675f]">{detail}</p>
    </div>
  );
}

function JourneyCard({ progress }: { progress: ProgressView | null }) {
  const stages = progress?.journey ?? [];
  const currentIndex = stages.findIndex((stage) => stage.id === progress?.highlightedStage);
  const anchor = currentIndex > 0 ? currentIndex - 1 : 0;
  const start = Math.max(0, Math.min(anchor, Math.max(0, stages.length - 3)));
  const visible = stages.slice(start, start + 3);
  return (
    <article className="rounded-[22px] border border-[#ece7e0] bg-white p-6 shadow-[0_10px_30px_rgba(28,25,21,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium tracking-[0.16em] text-[#8a837a] uppercase">Your journey</p>
      </div>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight">Level up your edge</h2>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#f0ebe4]">
        <div className="h-full rounded-full bg-[#1f9d6a]" style={{ width: progress ? `${(progress.completedStages / Math.max(1, progress.journey.length)) * 100}%` : "0%" }} />
      </div>
      <p className="mt-2 text-right text-xs text-[#8a837a]">
        {progress ? `${progress.completedStages} of ${progress.journey.length} milestones` : "Milestones appear as you practice"}
      </p>
      <ol className="mt-4 flex flex-col gap-3">
        {visible.map((stage) => {
          const current = stage.id === progress?.highlightedStage && stage.state !== "complete";
          return (
            <li key={stage.id} className="flex items-center gap-3">
              <span
                className={`grid size-6 place-items-center rounded-full text-xs ${stage.state === "complete" ? "bg-[#e7f6ee] text-[#1f9d6a]" : current ? "bg-[#fff1ea] text-[#e8633a]" : "bg-[#f6f3ee] text-[#8a837a]"}`}
                aria-hidden="true"
              >
                {stage.state === "complete" ? "✓" : current ? "•" : ""}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{stage.label}</span>
              </span>
              <span className="text-xs text-[#8a837a]">{stage.state === "complete" ? "Complete" : current ? "In progress" : "Up next"}</span>
            </li>
          );
        })}
      </ol>
    </article>
  );
}

function SkillMap({ progress, reportHref }: { progress: ProgressView | null; reportHref: string }) {
  return (
    <article className="rounded-[22px] border border-[#ece7e0] bg-white p-6 shadow-[0_10px_30px_rgba(28,25,21,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium tracking-[0.16em] text-[#8a837a] uppercase">Your skill map</p>
        {reportHref ? (
          <Link href={reportHref} className="text-sm text-[#6d675f]">
            View report
          </Link>
        ) : null}
      </div>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight">Where you shine</h2>
      {progress ? (
        <ul className="mt-5 flex flex-col gap-4">
          {progress.skills.map((skill) => {
            const seen = skill.samples > 0 && skill.score !== null;
            return (
              <li key={skill.id}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <p className="font-medium">{skill.label}</p>
                  <p className="tabular-nums text-[#6d675f]">{seen ? `${skill.score}/100` : "Not seen yet"}</p>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#f0ebe4]" role="meter" aria-label={skill.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={skill.score ?? 0}>
                  <div className="h-full rounded-full" style={{ width: `${seen ? skill.score : 0}%`, background: skillColor(skill.id) }} />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-[#6d675f]">Skills show up after a reviewed interview.</p>
      )}
    </article>
  );
}

function StoryBank({ story, loading }: { story: ProfessionalStory | null; loading: boolean }) {
  if (loading) return <div className="min-h-56 rounded-[22px] bg-[#142033]" aria-hidden="true" />;
  if (!story) {
    return (
      <article className="flex flex-col justify-between rounded-[22px] bg-[#142033] p-6 text-white">
        <div>
          <p className="text-xs font-medium tracking-[0.16em] text-white/50 uppercase">Story bank</p>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight">Build the story you want them to remember.</h2>
          <p className="mt-2 text-sm text-white/70">Turn your resume into a clear answer for “Tell me about yourself.”</p>
        </div>
        <Link href="/story-builder" className="mt-6 inline-flex w-fit rounded-full px-4 py-2 text-sm font-medium text-white" style={{ background: coral }}>
          Build my story
        </Link>
      </article>
    );
  }
  const proofs = story.evidence.length;
  return (
    <article className="flex flex-col justify-between rounded-[22px] bg-[#142033] p-6 text-white">
      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium tracking-[0.16em] text-white/50 uppercase">Story bank</p>
          <Link href="/story-builder" className="text-sm text-white/60">
            Edit
          </Link>
        </div>
        <p className="mt-5 text-sm text-white/60">Your secret weapon</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">{story.identity.label}</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/75">{story.identity.statement}</p>
      </div>
      <div className="mt-6 flex items-center justify-between gap-3">
        <p className="text-sm text-white/55">{proofs > 0 ? `${proofs} piece${proofs === 1 ? "" : "s"} of proof` : "Saved"}</p>
        <Link href="/story-builder/practice" className="rounded-full px-4 py-2 text-sm font-medium text-white" style={{ background: coral }}>
          Practice
        </Link>
      </div>
    </article>
  );
}

function InterviewRow({
  item,
  pendingDelete,
  deleting,
  onDelete,
  onConfirm,
}: {
  item: InterviewCard;
  pendingDelete: boolean;
  deleting: boolean;
  onDelete: () => void;
  onConfirm: () => void;
}) {
  const href = item.status === "ready" || item.status === "preparing" ? "" : `/interview/${item.id}/results`;
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center">
      {href ? (
        <Link href={href} className="flex min-w-0 flex-1 items-center gap-3">
          <Mark name={item.company} />
          <span className="min-w-0">
            <span className="block truncate font-medium">{item.company}</span>
            <span className="block truncate text-sm text-[#6d675f]">{item.jobTitle}</span>
          </span>
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Mark name={item.company} />
          <span className="min-w-0">
            <span className="block truncate font-medium">{item.company}</span>
            <span className="block truncate text-sm text-[#6d675f]">{item.jobTitle}</span>
          </span>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 sm:justify-end">
        <p className="text-sm text-[#8a837a]">{relativeWhen(item.completedAt ?? item.createdAt)}</p>
        <p className="text-sm">
          <span className="text-[#8a837a]">Readiness </span>
          <span className="font-semibold">{item.overallReadiness !== null ? Math.round(item.overallReadiness) : statusLabel(item.status)}</span>
        </p>
        <InterviewAction item={item} />
        {pendingDelete ? (
          <button type="button" className="text-sm text-danger" disabled={deleting} onClick={onConfirm}>
            {deleting ? "Deleting…" : "Confirm delete"}
          </button>
        ) : (
          <button type="button" className="text-sm text-[#8a837a] hover:text-[#1c1915]" onClick={onDelete}>
            Delete
          </button>
        )}
        {href ? (
          <Link href={href} className="text-[#c4bdb4]" aria-label={`Open ${item.company}`}>
            ›
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function InterviewAction({ item }: { item: InterviewCard }) {
  const router = useRouter();
  const [opening, setOpening] = useState(false);
  const [actionError, setActionError] = useState("");
  const replayable = item.status === "complete" || item.status === "in_progress" || item.status === "failed" || item.status === "analyzing";

  async function resume() {
    setOpening(true);
    setActionError("");
    try {
      const response = await authorizedFetch(`/api/account/interviews/${item.id}`);
      const body = (await response.json()) as { result?: SavedInterviewResult; error?: string };
      if (!response.ok || !body.result) throw new Error(body.error || "This interview could not be opened.");
      saveInterviewSetup(body.result.setup satisfies InterviewSetup);
      router.push("/interview/prepare");
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "This interview could not be opened.");
      setOpening(false);
    }
  }

  async function practiceAgain() {
    setOpening(true);
    setActionError("");
    try {
      const response = await authorizedFetch(`/api/account/interviews/${item.id}/replay`, { method: "POST" });
      const body = (await response.json()) as { setup?: InterviewSetup; practiceQuestions?: string[]; error?: string };
      if (!response.ok || !body.setup) throw new Error(body.error || "This interview could not be opened again.");
      if (body.practiceQuestions && body.practiceQuestions.length > 0) {
        savePracticeSetup({
          interviewId: body.setup.interviewId,
          company: body.setup.company,
          jobTitle: body.setup.jobTitle,
          interviewType: body.setup.interviewType,
          interviewerProfileId: body.setup.interviewerProfileId,
          questions: body.practiceQuestions,
        });
        router.push("/interview/practice");
        return;
      }
      saveInterviewSetup(body.setup);
      router.push("/interview/prepare");
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "This interview could not be opened again.");
      setOpening(false);
    }
  }

  return (
    <span className="flex flex-col items-start">
      {item.status === "ready" ? (
        <button type="button" className="text-sm font-medium" style={{ color: coral }} disabled={opening} onClick={() => void resume()}>
          {opening ? "Opening…" : "Resume"}
        </button>
      ) : null}
      {replayable ? (
        <button type="button" className="text-sm font-medium" style={{ color: coral }} disabled={opening} onClick={() => void practiceAgain()}>
          {opening ? "Opening…" : "Practice again"}
        </button>
      ) : null}
      {actionError ? <span className="text-xs text-danger">{actionError}</span> : null}
    </span>
  );
}

function Mark({ name }: { name: string }) {
  const letter = (name.trim()[0] || "I").toUpperCase();
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-[12px] text-sm font-semibold text-white" style={{ background: tone(name) }}>
      {letter}
    </span>
  );
}

function QuestMark() {
  return (
    <div className="relative mx-auto grid size-40 place-items-center" aria-hidden="true">
      <span className="absolute size-36 rounded-full border border-[#f3d2c4]" />
      <span className="absolute size-24 rounded-full border border-dashed border-[#f0b79a]" />
      <span className="grid size-16 place-items-center rounded-[18px] text-white shadow-[0_12px_30px_rgba(232,99,58,0.35)]" style={{ background: coral }}>
        <Spark />
      </span>
      <span className="absolute -bottom-1 rounded-full bg-white px-2 py-1 text-[11px] text-[#6d675f] shadow-sm">You’ve got this</span>
    </div>
  );
}

function skillColor(id: SkillId): string {
  const colors: Record<SkillId, string> = {
    storytelling: "#e8633a",
    communication: "#1f9d6a",
    businessImpact: "#3b6fd8",
    structure: "#d89a1a",
    specificity: "#6d5efc",
    conciseness: "#8a837a",
    roleAlignment: "#0f9f6e",
  };
  return colors[id];
}

function questXp(mission: { id: string; href: string }): number {
  if (mission.id === "start-story") return 40;
  if (mission.id === "story") return mission.href.includes("practice") ? 25 : 40;
  if (mission.id === "mock") return 80;
  return 35;
}

function tone(name: string): string {
  const colors = ["#e8633a", "#1f9d6a", "#3b6fd8", "#d89a1a", "#6d5efc"];
  let hash = 0;
  for (const char of name) hash = (hash + char.charCodeAt(0)) % colors.length;
  return colors[hash] ?? colors[0];
}

function weekMinutes(interviews: InterviewCard[]): number {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? 6 : day - 1;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - mondayOffset);
  const seconds = interviews.reduce((sum, item) => {
    const when = item.completedAt ?? item.createdAt;
    return when >= start.getTime() ? sum + item.activeDurationSeconds : sum;
  }, 0);
  return Math.round(seconds / 60);
}

function greeting(name: string): string {
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return name ? `${hello}, ${name}` : hello;
}

function formatLongDate(value: number): string {
  return new Date(value).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function relativeWhen(value: number): string {
  if (!value) return "";
  const date = new Date(value);
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  if (day === start) return "Today";
  if (day === start - 86_400_000) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function statusLabel(status: InterviewStatusName): string {
  switch (status) {
    case "ready":
      return "Ready";
    case "in_progress":
      return "In progress";
    case "analyzing":
      return "Analyzing";
    case "complete":
      return "Complete";
    case "failed":
      return "Interrupted";
    case "preparing":
      return "Preparing";
    default:
      return "Draft";
  }
}

function Spark() {
  return (
    <svg className="size-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 1.5 9.2 6.2 14 8 9.2 9.8 8 14.5 6.8 9.8 2 8l4.8-1.8L8 1.5Z" fill="currentColor" />
    </svg>
  );
}

function Play() {
  return (
    <svg className="size-3.5" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M5 3.5v9l8-4.5-8-4.5Z" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg className="size-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 7.2 8 3l5 4.2V13H3V7.2Z" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function Book() {
  return (
    <svg className="size-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 3.5h4.2c.7 0 1.3.4 1.8 1.1.5-.7 1.1-1.1 1.8-1.1H13V12h-2.2c-.7 0-1.3.3-1.8.8-.5-.5-1.1-.8-1.8-.8H3V3.5Z" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function Chart() {
  return (
    <svg className="size-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 13V8M8 13V4M13 13V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function Flame() {
  return (
    <svg className="size-3.5" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 1.5s3.2 2.4 3.2 5.2c0 1.2-.5 2-1.2 2.6.2-1.4-.6-2.4-1.2-2.8-.1 1.8-1.5 2.8-1.5 4.4 0 2 1.5 3.6 3.5 3.6-3.8.4-6.8-1.8-6.8-5.4C4 5.2 8 1.5 8 1.5Z" />
    </svg>
  );
}

function Target() {
  return (
    <svg className="size-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="8" cy="8" r="2" fill="currentColor" />
    </svg>
  );
}

function Clock() {
  return (
    <svg className="size-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 5.2V8l2 1.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function Medal() {
  return (
    <svg className="size-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="7" r="3.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6.2 9.6 5.2 14l2.8-1.4L10.8 14 9.8 9.6" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function People() {
  return (
    <svg className="size-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="2" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="11" cy="6.5" r="1.6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2.8 12.2c.6-1.6 1.8-2.4 3.2-2.4s2.6.8 3.2 2.4M9.2 10c1.1 0 2.1.6 2.8 1.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
