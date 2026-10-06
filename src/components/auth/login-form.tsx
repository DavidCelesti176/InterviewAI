"use client";

import { signInWithEmailAndPassword } from "firebase/auth";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { AuthScreen } from "@/components/auth/auth-screen";
import { AuthDivider, GoogleSignInButton } from "@/components/auth/google-sign-in";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { useAuth } from "@/contexts/auth-context";
import { authErrorEmail, authErrorMessage, safeNextPath } from "@/lib/account/auth-errors";
import { linkPendingGoogleAccount, signInWithGoogle } from "@/lib/account/google";
import { readyAuth } from "@/lib/firebase/client";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { configured, user, ready, refreshProfile } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"google" | "email" | null>(null);
  const googlePending = useRef(false);
  const next = safeNextPath(params.get("next"));

  useEffect(() => {
    if (ready && user && !googlePending.current) router.replace(next);
  }, [next, ready, router, user]);

  async function continueWithGoogle() {
    setError("");
    if (!configured) {
      setError("Sign-in is not configured yet.");
      return;
    }
    googlePending.current = true;
    setBusy("google");
    try {
      await signInWithGoogle();
      await refreshProfile();
      router.replace(next);
    } catch (reason) {
      googlePending.current = false;
      const conflictEmail = authErrorEmail(reason);
      if (conflictEmail) setEmail(conflictEmail);
      setError(authErrorMessage(reason, reason instanceof Error ? reason.message : "Could not sign in with Google."));
      setBusy(null);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!configured) {
      setError("Sign-in is not configured yet.");
      return;
    }
    if (!email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy("email");
    try {
      const auth = await readyAuth();
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      await linkPendingGoogleAccount(credential.user).catch(() => undefined);
      router.replace(next);
    } catch (reason) {
      setError(authErrorMessage(reason, "Could not sign in. Try again."));
      setBusy(null);
    }
  }

  return (
    <AuthScreen title="Welcome back" subtitle="Sign in to your interviews, resumes, and feedback.">
      <div className="flex flex-col gap-4">
        <GoogleSignInButton disabled={busy !== null} label={busy === "google" ? "Signing in…" : "Continue with Google"} onClick={() => void continueWithGoogle()} />
        <AuthDivider />
      </div>
      <form className="mt-4 flex flex-col gap-4" onSubmit={(event) => void onSubmit(event)}>
        <Field label="Email">
          <TextInput type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </Field>
        <Field label="Password">
          <TextInput
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </Field>
        <Link href="/forgot-password" className="w-fit text-sm text-accent">
          Forgot password?
        </Link>
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={busy !== null}>
          {busy === "email" ? "Signing in…" : "Sign in"}
        </Button>
        <p className="text-sm text-muted">
          New here?{" "}
          <Link href={`/signup?next=${encodeURIComponent(next)}`} className="text-accent">
            Create an account
          </Link>
        </p>
      </form>
    </AuthScreen>
  );
}
