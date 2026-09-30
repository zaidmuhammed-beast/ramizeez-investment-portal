"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "gold";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60 disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-brand-500 to-teal-400 text-ink-950 shadow-lg shadow-brand-500/20 hover:from-brand-400 hover:to-teal-300",
  secondary: "glass text-slate-100 hover:bg-white/10",
  ghost: "text-slate-300 hover:bg-white/5 hover:text-white",
  danger: "bg-rose-500/90 text-white hover:bg-rose-500",
  gold: "bg-gradient-to-r from-gold-400 to-amber-300 text-ink-950 hover:from-gold-300 hover:to-amber-200",
};

export function Button({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={cn(base, variants[variant], className)} {...props} />;
}

export function LinkButton({ variant = "primary", className, ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={cn(base, variants[variant], className)} {...props} />;
}

export function SubmitButton({
  children,
  pendingText = "Please wait…",
  ...props
}: ComponentProps<"button"> & { variant?: Variant; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {pending ? pendingText : children}
    </Button>
  );
}
