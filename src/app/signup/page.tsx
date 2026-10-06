import { Suspense } from "react";

import { SignupForm } from "@/components/auth/signup-form";

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="flex min-h-dvh items-center justify-center text-sm text-muted">Loading…</div>}>
      <SignupForm />
    </Suspense>
  );
}
