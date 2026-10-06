"use client";

import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from "firebase/auth";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { AuthScreen } from "@/components/auth/auth-screen";
import { AuthDivider, GoogleSignInButton } from "@/components/auth/google-sign-in";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { useAuth } from "@/contexts/auth-context";
import { authErrorEmail, authErrorMessage, passwordProblem, safeNextPath } from "@/lib/account/auth-errors";
import { signInWithGoogle } from "@/lib/account/google";
import { upsertAccountProfile } from "@/lib/account/profile";
import { readyAuth } from "@/lib/firebase/client";

export function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { configured, user, ready, refreshProfile } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"google" | "email" | null>(null);
  const started = useRef(false);
  const next = safeNextPath(params.get("next"));

  useEffect(() => {
    if (ready && user && !started.current) router.replace(next);
  }, [next, ready, router, user]);

  async function continueWithGoogle() {
    setError("");
    if (!configured) {
      setError("Account creation is not configured yet.");
      return;
    }
    started.current = true;
    setBusy("google");
    try {
      await signInWithGoogle();
      await refreshProfile();
      router.replace(next);
    } catch (reason) {
      started.current = false;
      const conflictEmail = authErrorEmail(reason);
      if (conflictEmail) setEmail(conflictEmail);
      setError(authErrorMessage(reason, reason instanceof Error ? reason.message : "Could not continue with Google."));
      setBusy(null);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!configured) {
      setError("Account creation is not configured yet.");
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      setError("Enter your first and last name.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    const passwordError = passwordProblem(password, confirm);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    started.current = true;
    setBusy("email");
    try {
      const auth = await readyAuth();
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const displayName = `${firstName.trim()} ${lastName.trim()}`;
      await updateProfile(credential.user, { displayName });
      await upsertAccountProfile(credential.user, { firstName: firstName.trim(), lastName: lastName.trim() });
      await refreshProfile();
      void sendEmailVerification(credential.user).catch(() => undefined);
      router.replace(next);
    } catch (reason) {
      setError(authErrorMessage(reason, reason instanceof Error ? reason.message : "Could not create the account."));
      setBusy(null);
    }
  }

  return (
    <AuthScreen title="Create your account" subtitle="Your interviews, resume, and feedback stay private to you.">
      <div className="flex flex-col gap-4">
        <GoogleSignInButton disabled={busy !== null} label={busy === "google" ? "Continuing…" : "Continue with Google"} onClick={() => void continueWithGoogle()} />
        <AuthDivider />
      </div>
      <form className="mt-4 flex flex-col gap-4" onSubmit={(event) => void onSubmit(event)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name">
            <TextInput autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} required />
          </Field>
          <Field label="Last name">
            <TextInput autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} required />
          </Field>
        </div>
        <Field label="Email">
          <TextInput type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </Field>
        <Field label="Password">
          <TextInput
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </Field>
        <Field label="Confirm password">
          <TextInput
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            required
          />
        </Field>
        <p className="text-sm text-muted">Use at least 8 characters, with a letter and a number.</p>
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={busy !== null}>
          {busy === "email" ? "Creating account…" : "Create account"}
        </Button>
        <p className="text-sm text-muted">
          Already have an account?{" "}
          <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-accent">
            Sign in
          </Link>
        </p>
      </form>
    </AuthScreen>
  );
}
