"use client";

import { sendPasswordResetEmail } from "firebase/auth";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { AuthScreen } from "@/components/auth/auth-screen";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { useAuth } from "@/contexts/auth-context";
import { authErrorMessage } from "@/lib/account/auth-errors";
import { readyAuth } from "@/lib/firebase/client";

export function ForgotPasswordForm() {
  const { configured } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSent(false);
    if (!configured) {
      setError("Password reset is not configured yet.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setSubmitting(true);
    try {
      const auth = await readyAuth();
      await sendPasswordResetEmail(auth, email.trim(), {
        url: `${window.location.origin}/login`,
        handleCodeInApp: false,
      });
      setSent(true);
    } catch (reason) {
      const code = reason && typeof reason === "object" && "code" in reason ? String((reason as { code: unknown }).code) : "";
      if (code === "auth/user-not-found") {
        setSent(true);
      } else {
        setError(authErrorMessage(reason, "Could not send the reset email."));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthScreen title="Reset your password" subtitle="We'll email you a link to choose a new password.">
      <form className="flex flex-col gap-4" onSubmit={(event) => void onSubmit(event)}>
        <Field label="Email">
          <TextInput type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </Field>
        {sent ? <p className="text-sm text-foreground">Check your email for a reset link.</p> : null}
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Sending…" : "Send reset link"}
        </Button>
        <Link href="/login" className="text-sm text-accent">
          Back to sign in
        </Link>
      </form>
    </AuthScreen>
  );
}
