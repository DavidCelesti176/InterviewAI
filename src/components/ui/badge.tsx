import type { ReactNode } from "react";

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex w-fit items-center rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
      {children}
    </span>
  );
}
