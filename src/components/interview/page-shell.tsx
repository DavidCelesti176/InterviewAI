import type { ReactNode } from "react";

import { AccountMenu, BrandLink } from "@/components/auth/account-menu";

export function PageShell({
  children,
  width = "setup",
}: {
  children: ReactNode;
  width?: "setup" | "wide";
}) {
  const max = width === "wide" ? "max-w-5xl" : "max-w-[720px]";
  return (
    <div className="relative min-h-full">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,rgba(47,107,255,0.14),transparent_60%)]"
        aria-hidden="true"
      />
      <main className={`relative mx-auto flex w-full ${max} flex-col gap-8 px-5 py-8 sm:px-6 sm:py-14`}>
        <div className="flex items-center justify-between gap-4">
          <BrandLink />
          <AccountMenu />
        </div>
        {children}
      </main>
    </div>
  );
}
