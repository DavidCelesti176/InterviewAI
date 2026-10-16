"use client";

import { signOut } from "firebase/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { CheckoutStatus } from "@/components/billing/checkout-status";
import { Button, ButtonLink } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { authorizedFetch } from "@/lib/account/client";
import { listOwnedInterviews } from "@/lib/account/interviews";
import type { InterviewCard, InterviewStatusName } from "@/lib/account/types";
import type { BillingProjection } from "@/lib/billing/types";
import { readyAuth } from "@/lib/firebase/client";
import { saveInterviewSetup, savePracticeSetup, type InterviewSetup, type SavedInterviewResult } from "@/lib/interview/browser-state";
import type { ProgressView } from "@/lib/progress/types";

export function Dashboard() {
  const { profile, user } = useAuth();
  const [interviews, setInterviews] = useState<InterviewCard[]>([]);
  const [progress, setProgress] = useState<ProgressView | null>(null);
  const [billing, setBilling] = useState<BillingProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const firstName = profile?.firstName || user?.displayName?.split(" ")[0] || "";
  const fullName = profile?.displayName || user?.displayName || firstName || "Account";
  const practice = interviews.filter((item) => canPractice(item.status));
  const featured = practice[0] ?? null;
  const others = interviews.filter((item) => item.id !== featured?.id);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    void Promise.all([
      listOwnedInterviews(user.uid),
      authorizedFetch(`/api/progress?timezone=${encodeURIComponent(timezone)}`)
        .then(async (response) => {
          if (!response.ok) return null;
          const body = (await response.json()) as { progress?: ProgressView };
          return body.progress ?? null;
        })
        .catch(() => null),
      authorizedFetch("/api/billing")
        .then(async (response) => {
          if (!response.ok) return null;
          const body = (await response.json()) as { billing?: BillingProjection };
          return body.billing ?? null;
        })
        .catch(() => null),
    ])
      .then(([items, savedProgress, savedBilling]) => {
        if (cancelled) return;
        setInterviews(items);
        setProgress(savedProgress);
        setBilling(savedBilling);
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
      const response = await authorizedFetch(`/api/account/interviews/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("That interview could not be deleted.");
      setInterviews((current) => current.filter((item) => item.id !== id));
      setPendingDelete(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That interview could not be deleted.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="lg:grid lg:min-h-dvh lg:grid-cols-[240px_minmax(0,1fr)]">
        <Sidebar name={fullName} email={profile?.email || user?.email || ""} firstName={firstName} />
        <div className="min-w-0">
          <header className="flex flex-wrap items-end justify-between gap-4 px-5 py-6 sm:px-8">
            <div>
              <p className="text-sm text-muted">{formatLongDate(Date.now())}</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">{greeting(firstName)}</h1>
            </div>
            <ButtonLink href="/interview/new">New interview</ButtonLink>
          </header>

          <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 pb-16 sm:px-8">
            {user && !user.emailVerified ? (
              <p className="text-sm text-muted">Verify your email when you can. You can keep using InterviewAI.</p>
            ) : null}
            <CheckoutStatus onBilling={setBilling} />

            <section className="grid gap-4 sm:grid-cols-2" aria-label="Credits and streak">
              <CreditsCard billing={billing} loading={loading} />
              <StreakCard progress={progress} loading={loading} />
            </section>

            <section>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">Practice a past interview</h2>
                  <p className="mt-1 text-sm text-muted">Go back to an interview you already took and work the answers again.</p>
                </div>
              </div>
              {error ? (
                <p className="mt-3 text-sm text-danger" role="alert">
                  {error}
                </p>
              ) : null}
              {loading ? <div className="mt-4 h-28 rounded-[22px] border border-line bg-card" aria-hidden="true" /> : null}
              {!loading && interviews.length === 0 ? (
                <div className="mt-4 rounded-[22px] border border-line bg-card px-5 py-6 shadow-card">
                  <p className="text-sm text-muted">Finish an interview and it will show up here so you can practice it again.</p>
                  <ButtonLink href="/interview/new" className="mt-4">
                    Start an interview
                  </ButtonLink>
                </div>
              ) : null}
              {featured ? (
                <article className="mt-4 rounded-[22px] border border-line bg-card p-5 shadow-card sm:p-6">
                  <p className="text-sm text-muted">Pick up where you left off</p>
                  <h3 className="mt-1 text-2xl font-semibold tracking-tight">{featured.company}</h3>
                  <p className="mt-1 text-muted">{featured.jobTitle}</p>
                  <p className="mt-1 text-sm text-muted">{relativeWhen(featured.completedAt ?? featured.createdAt)}</p>
                  <div className="mt-5">
                    <InterviewAction item={featured} prominent />
                  </div>
                </article>
              ) : null}
              {others.length > 0 ? (
                <ul className="mt-3 overflow-hidden rounded-[22px] border border-line bg-card shadow-card">
                  {others.map((item) => (
                    <li key={item.id} className="border-b border-line last:border-b-0">
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
              {featured && pendingDelete === featured.id ? (
                <div className="mt-3 flex items-center gap-3 text-sm">
                  <button type="button" className="font-medium text-danger" disabled={deleting} onClick={() => void remove(featured.id)}>
                    {deleting ? "Deleting…" : "Confirm delete"}
                  </button>
                  <button type="button" className="text-muted" onClick={() => setPendingDelete(null)}>
                    Cancel
                  </button>
                </div>
              ) : featured ? (
                <button type="button" className="mt-3 text-sm text-muted hover:text-foreground" onClick={() => setPendingDelete(featured.id)}>
                  Delete this interview
                </button>
              ) : null}
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

function Sidebar({ name, email, firstName }: { name: string; email: string; firstName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const initial = (firstName || name).slice(0, 1).toUpperCase() || "I";

  async function logout() {
    const auth = await readyAuth();
    await signOut(auth);
    router.replace("/");
  }

  return (
    <aside className="bg-room text-room-ink lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:px-4 lg:py-5">
      <div className="flex items-center justify-between px-4 py-3 lg:px-2">
        <Link href="/dashboard" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <span className="grid size-8 place-items-center rounded-[10px] bg-accent text-white" aria-hidden="true">
            <Spark />
          </span>
          InterviewAI
        </Link>
        <button type="button" className="rounded-full px-3 py-1 text-sm text-white/80 lg:hidden" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
          {open ? "Close" : "Menu"}
        </button>
      </div>
      <div className={`${open ? "block" : "hidden"} lg:flex lg:min-h-0 lg:flex-1 lg:flex-col`}>
        <nav className="mt-2 flex flex-col gap-1 px-2" aria-label="Dashboard">
          <NavLink href="/dashboard" current>
            Overview
          </NavLink>
          <NavLink href="/interview/new">New interview</NavLink>
          <NavLink href="/story-builder">Stories</NavLink>
          <NavLink href="/account">Account</NavLink>
        </nav>
        <div className="mt-auto hidden px-2 pt-6 lg:block">
          <div className="flex items-center gap-2 px-2 py-2">
            <span className="grid size-8 place-items-center rounded-full bg-accent text-sm font-medium text-white">{initial}</span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{name}</span>
              <span className="block truncate text-xs text-white/50">{email}</span>
            </span>
          </div>
          <button type="button" className="mt-1 w-full rounded-[12px] px-3 py-2 text-left text-sm text-white/70 hover:bg-white/5" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
        <div className="flex flex-col gap-2 px-4 py-4 lg:hidden">
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
      className={`rounded-[12px] px-3 py-2.5 text-sm ${current ? "bg-white/10 text-white shadow-[inset_3px_0_0_var(--accent)]" : "text-white/70 hover:bg-white/5 hover:text-white"}`}
    >
      {children}
    </Link>
  );
}

function CreditsCard({ billing, loading }: { billing: BillingProjection | null; loading: boolean }) {
  if (loading) return <div className="h-36 rounded-[22px] border border-line bg-card" aria-hidden="true" />;
  const full = (billing?.purchasedCreditsAvailable ?? 0) + (billing?.mockCreditsAvailable ?? 0);
  const practice = billing?.practiceSessionsAvailable ?? 0;
  return (
    <article className="rounded-[22px] border border-line bg-card p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted">Credits</p>
        <p className="text-sm text-muted">{billing?.plan === "plus" ? "Plus" : "Free"}</p>
      </div>
      <p className="mt-3 text-4xl font-semibold tracking-tight tabular-nums">{billing ? full : "—"}</p>
      <p className="mt-1 text-sm text-muted">{billing ? (full === 1 ? "full interview ready" : "full interviews ready") : "Credits could not be loaded."}</p>
      <ul className="mt-4 flex flex-col gap-1 text-sm text-muted">
        {billing?.plan === "plus" ? <li>{practice === 1 ? "1 voice practice left" : `${practice} voice practices left`}</li> : null}
        {billing?.freeQuickAvailable ? <li>1 quick practice ready</li> : null}
        {billing?.cancelAtPeriodEnd ? <li>Plus cancellation is scheduled</li> : null}
      </ul>
    </article>
  );
}

function StreakCard({ progress, loading }: { progress: ProgressView | null; loading: boolean }) {
  if (loading) return <div className="h-36 rounded-[22px] border border-line bg-card" aria-hidden="true" />;
  const days = progress?.streakCount ?? 0;
  const practicedToday = progress?.daily.completed === true;
  const detail =
    days === 0
      ? "One finished practice starts your streak."
      : practicedToday
        ? "You practiced today. Come back tomorrow to keep it going."
        : "Practice today to keep it going.";
  return (
    <article className="rounded-[22px] border border-line bg-card p-5 shadow-card">
      <p className="text-sm font-medium text-muted">Streak</p>
      <p className="mt-3 text-4xl font-semibold tracking-tight tabular-nums">{progress ? days : "—"}</p>
      <p className="mt-1 text-sm text-muted">{progress ? (days === 1 ? "day" : "days") : "Streak could not be loaded."}</p>
      {progress ? <p className="mt-4 text-sm text-muted">{detail}</p> : null}
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
      <div className="min-w-0 flex-1">
        {href ? (
          <Link href={href} className="block min-w-0">
            <span className="block truncate font-medium">{item.company}</span>
            <span className="block truncate text-sm text-muted">{item.jobTitle}</span>
          </Link>
        ) : (
          <div className="min-w-0">
            <span className="block truncate font-medium">{item.company}</span>
            <span className="block truncate text-sm text-muted">{item.jobTitle}</span>
          </div>
        )}
        <p className="mt-1 text-sm text-muted">
          {relativeWhen(item.completedAt ?? item.createdAt)}
          {item.status !== "complete" ? ` · ${statusLabel(item.status)}` : ""}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <InterviewAction item={item} />
        {pendingDelete ? (
          <button type="button" className="text-sm text-danger" disabled={deleting} onClick={onConfirm}>
            {deleting ? "Deleting…" : "Confirm delete"}
          </button>
        ) : (
          <button type="button" className="text-sm text-muted hover:text-foreground" onClick={onDelete}>
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

function InterviewAction({ item, prominent = false }: { item: InterviewCard; prominent?: boolean }) {
  const router = useRouter();
  const [opening, setOpening] = useState(false);
  const [actionError, setActionError] = useState("");
  const replayable = canPractice(item.status);
  const reviewHref = replayable ? `/interview/${item.id}/results` : "";

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
    <span className="flex flex-col items-start gap-2">
      <span className="flex flex-wrap items-center gap-2">
        {item.status === "ready" ? (
          <Button type="button" variant={prominent ? "primary" : "secondary"} disabled={opening} onClick={() => void resume()}>
            {opening ? "Opening…" : "Resume"}
          </Button>
        ) : null}
        {replayable ? (
          <Button type="button" variant={prominent ? "primary" : "secondary"} disabled={opening} onClick={() => void practiceAgain()}>
            {opening ? "Opening…" : "Practice again"}
          </Button>
        ) : null}
        {prominent && reviewHref ? (
          <ButtonLink href={reviewHref} variant="secondary">
            Review
          </ButtonLink>
        ) : null}
      </span>
      {actionError ? <span className="text-xs text-danger">{actionError}</span> : null}
    </span>
  );
}

function canPractice(status: InterviewStatusName): boolean {
  return status === "complete" || status === "in_progress" || status === "failed" || status === "analyzing";
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
      return "Ready to start";
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
