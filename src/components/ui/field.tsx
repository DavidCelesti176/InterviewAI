import type { ComponentProps, ReactNode } from "react";

const control =
  "w-full rounded-[14px] border border-line bg-white px-3.5 py-2.5 text-base text-foreground outline-none transition duration-200 placeholder:text-muted/70 focus:border-accent focus:ring-4 focus:ring-accent/10";

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
      {label}
      {children}
    </label>
  );
}

export function TextInput(props: ComponentProps<"input">) {
  return <input className={control} {...props} />;
}

export function TextArea({ className = "", ...props }: ComponentProps<"textarea">) {
  return <textarea className={`${control} min-h-36 resize-y ${className}`} {...props} />;
}
