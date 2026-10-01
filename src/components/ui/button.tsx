import Link from "next/link";
import type { ComponentProps } from "react";

const styles = {
  primary:
    "bg-gradient-to-r from-accent to-violet text-white shadow-[0_8px_24px_rgba(47,107,255,0.28)] hover:brightness-110",
  secondary: "border border-line bg-card text-foreground shadow-sm hover:border-accent/40 hover:bg-white",
  ghost: "text-foreground hover:bg-white/70",
  danger: "border border-danger/30 bg-white text-danger hover:bg-danger/5",
  room: "border border-white/15 bg-white/10 text-white hover:bg-white/15",
} as const;

const base =
  "inline-flex items-center justify-center rounded-[14px] px-5 py-2.5 text-sm font-medium transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-40";

type Variant = keyof typeof styles;

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={`${base} ${styles[variant]} ${className}`} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={`${base} ${styles[variant]} ${className}`} {...props} />;
}
