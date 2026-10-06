"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export function AuthScreen({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-[480px] flex-col justify-center gap-8 px-5 py-12">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,rgba(47,107,255,0.14),transparent_60%)]"
        aria-hidden="true"
      />
      <div className="relative flex flex-col gap-3">
        <Link href="/" className="w-fit text-sm font-medium tracking-tight">
          InterviewAI
        </Link>
        <h1 className="text-4xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted">{subtitle}</p>
      </div>
      <div className="relative rounded-[24px] border border-line bg-card p-6 shadow-[var(--shadow-card)]">{children}</div>
    </main>
  );
}
