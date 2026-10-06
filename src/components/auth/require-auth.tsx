"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useAuth } from "@/contexts/auth-context";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { ready, configured, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!ready || user) return;
    const next = `${pathname}${window.location.search}`;
    router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [pathname, ready, router, user]);

  if (!ready || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-6 text-sm text-muted">
        {configured || !ready ? "Loading…" : "Sign-in is not configured yet."}
      </div>
    );
  }

  return children;
}
