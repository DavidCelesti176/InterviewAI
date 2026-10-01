import type { ComponentProps } from "react";

export function Card({ className = "", ...props }: ComponentProps<"section">) {
  return (
    <section
      className={`rounded-[20px] border border-line bg-card shadow-[var(--shadow-card)] ${className}`}
      {...props}
    />
  );
}
