import type { ComponentProps } from "react";
import { cn } from "./cn";

type Tone = "info" | "success" | "warn" | "error";

const tones: Record<Tone, string> = {
  info: "border-sky-400/30 bg-sky-400/10 text-sky-100",
  success: "border-brand-400/30 bg-brand-400/10 text-brand-100",
  warn: "border-amber-400/30 bg-amber-400/10 text-amber-100",
  error: "border-rose-400/30 bg-rose-400/10 text-rose-100",
};

export function Alert({ tone = "info", className, ...props }: ComponentProps<"div"> & { tone?: Tone }) {
  return <div className={cn("rounded-xl border px-4 py-3 text-sm", tones[tone], className)} {...props} />;
}
