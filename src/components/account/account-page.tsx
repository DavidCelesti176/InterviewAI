"use client";

import { sendPasswordResetEmail } from "firebase/auth";
import { useEffect, useState, type FormEvent } from "react";

import { PageShell } from "@/components/interview/page-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, TextInput } from "@/components/ui/field";
import { useAuth } from "@/contexts/auth-context";
import { authorizedFetch } from "@/lib/account/client";
import type { ResumeCard } from "@/lib/account/types";
import { authErrorMessage } from "@/lib/account/auth-errors";
import { readyAuth } from "@/lib/firebase/client";

export function AccountPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [resumes, setResumes] = useState<ResumeCard[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingResume, setPendingResume] = useState<string | null>(null);

  useEffect(() => {
    setFirstName(profile?.firstName ?? "");
    setLastName(profile?.lastName ?? "");
  }, [profile]);

  useEffect(() => {
    let cancelled = false;
    void authorizedFetch("/api/account/resumes")
      .then(async (response) => {
        if (!response.ok) return [];
        const body = (await response.json()) as { resumes?: ResumeCard[] };
        return body.resumes ?? [];
      })
      .then((items) => {
        if (!cancelled) setResumes(items);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveName(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);
    try {
      const response = await authorizedFetch("/api/account/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error || "Your name could not be saved.");
      await refreshProfile();
      setMessage("Name saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your name could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword() {
    setError("");
    setMessage("");
    if (!user?.email) {
      setError("This account has no email address.");
      return;
    }
    try {
      const auth = await readyAuth();
      await sendPasswordResetEmail(auth, user.email, { url: `${window.location.origin}/login`, handleCodeInApp: false });
      setMessage("Password reset email sent.");
    } catch (reason) {
      setError(authErrorMessage(reason, "Could not send the reset email."));
    }
  }

  async function removeResume(id: string) {
    setError("");
    const response = await authorizedFetch(`/api/account/resumes/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError("That resume could not be deleted.");
      return;
    }
    setResumes((current) => current.filter((item) => item.id !== id));
    setPendingResume(null);
  }

  return (
    <PageShell>
      <header>
        <h1 className="text-4xl font-semibold tracking-tight">Account</h1>
        <p className="mt-2 text-muted">Your interviews and resumes are private to this account.</p>
      </header>
      <Card className="flex flex-col gap-4 p-6">
        <form className="flex flex-col gap-4" onSubmit={(event) => void saveName(event)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name">
              <TextInput value={firstName} onChange={(event) => setFirstName(event.target.value)} required />
            </Field>
            <Field label="Last name">
              <TextInput value={lastName} onChange={(event) => setLastName(event.target.value)} required />
            </Field>
          </div>
          <Field label="Email">
            <TextInput value={user?.email ?? ""} readOnly />
          </Field>
          <Button type="submit" disabled={saving} className="w-fit">
            {saving ? "Saving…" : "Save name"}
          </Button>
        </form>
        <Button type="button" variant="secondary" className="w-fit" onClick={() => void resetPassword()}>
          Send password reset email
        </Button>
      </Card>
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Saved resumes</h2>
        {resumes.length === 0 ? <p className="text-sm text-muted">Resumes you upload for an interview show up here.</p> : null}
        {resumes.map((resume) => (
          <Card key={resume.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">{resume.originalFileName}</p>
              <p className="text-sm text-muted">
                {resume.lastUsedAt ? `Last used ${formatWhen(resume.lastUsedAt)}` : `Added ${formatWhen(resume.createdAt)}`}
              </p>
            </div>
            {pendingResume === resume.id ? (
              <Button type="button" variant="danger" onClick={() => void removeResume(resume.id)}>
                Confirm delete
              </Button>
            ) : (
              <Button type="button" variant="ghost" onClick={() => setPendingResume(resume.id)}>
                Delete resume
              </Button>
            )}
          </Card>
        ))}
      </section>
      {message ? <p className="text-sm">{message}</p> : null}
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </PageShell>
  );
}

function formatWhen(value: number): string {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
