"use client";

import { signOut } from "firebase/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/contexts/auth-context";
import { readyAuth } from "@/lib/firebase/client";

export function AccountMenu() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  if (!user) return null;

  const name = profile?.displayName || user.displayName || "Account";
  const email = profile?.email || user.email || "";
  const initial = (profile?.firstName || name).slice(0, 1).toUpperCase();

  async function logout() {
    const auth = await readyAuth();
    await signOut(auth);
    setOpen(false);
    router.replace("/");
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-medium text-white"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      >
        {initial}
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-60 rounded-[16px] border border-line bg-card p-2 shadow-[var(--shadow-card)]" role="menu">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="truncate text-xs text-muted">{email}</p>
          </div>
          <Link href="/dashboard" className="block rounded-[12px] px-3 py-2 text-sm hover:bg-white" onClick={() => setOpen(false)}>
            Dashboard
          </Link>
          <Link href="/account" className="block rounded-[12px] px-3 py-2 text-sm hover:bg-white" onClick={() => setOpen(false)}>
            Account
          </Link>
          <button type="button" className="block w-full rounded-[12px] px-3 py-2 text-left text-sm hover:bg-white" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function BrandLink() {
  const { user, ready } = useAuth();
  return (
    <Link href={ready && user ? "/dashboard" : "/"} className="w-fit text-sm font-medium tracking-tight text-foreground">
      InterviewAI
    </Link>
  );
}
