import { cn } from "@/lib/utils";
import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary: "btn-gradient",
  secondary:
    "bg-(--color-ink) text-(--color-paper) hover:opacity-90 shadow-(--shadow-soft)",
  ghost: "bg-transparent hover:bg-black/5 dark:hover:bg-white/10 text-(--color-ink)",
  outline:
    "bg-(--color-surface) border border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20 text-(--color-ink) shadow-(--shadow-soft)",
};

const sizeClasses: Record<Size, string> = {
  sm: "text-sm px-4 py-2 gap-1.5",
  md: "text-[0.95rem] px-5 py-3 gap-2",
  lg: "text-base px-7 py-4 gap-2.5",
};

const base =
  "inline-flex items-center justify-center rounded-full font-semibold transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97]";

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={cn(base, variantClasses[variant], sizeClasses[size], className)}
      {...props}
    />
  );
}

export function LinkButton({
  className,
  variant = "primary",
  size = "md",
  href,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return (
    <Link
      href={href}
      className={cn(base, variantClasses[variant], sizeClasses[size], className)}
      {...props}
    />
  );
}
