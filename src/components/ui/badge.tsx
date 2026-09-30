import type { ReactNode } from "react";
import { cn } from "./cn";

export type BadgeTone = "neutral" | "green" | "amber" | "red" | "blue" | "violet" | "gold";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-white/8 text-slate-300 ring-white/15",
  green: "bg-brand-400/12 text-brand-200 ring-brand-400/30",
  amber: "bg-amber-400/12 text-amber-200 ring-amber-400/30",
  red: "bg-rose-400/12 text-rose-200 ring-rose-400/30",
  blue: "bg-sky-400/12 text-sky-200 ring-sky-400/30",
  violet: "bg-violet-400/12 text-violet-200 ring-violet-400/30",
  gold: "bg-gold-400/15 text-gold-300 ring-gold-400/40",
};

export function Badge({ tone = "neutral", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", tones[tone], className)}>
      {children}
    </span>
  );
}

const STATUS: Record<string, { tone: BadgeTone; label: string }> = {
  PASS: { tone: "green", label: "Pass" },
  WARN: { tone: "amber", label: "Warning" },
  FAIL: { tone: "red", label: "Fail" },
  MANUAL: { tone: "blue", label: "Manual" },
  IN_REVIEW: { tone: "blue", label: "In review" },
  NEEDS_INFO: { tone: "amber", label: "Needs info" },
  APPROVED: { tone: "green", label: "Approved" },
  REJECTED: { tone: "red", label: "Rejected" },
  LOW: { tone: "green", label: "Low risk" },
  MEDIUM: { tone: "amber", label: "Medium risk" },
  HIGH: { tone: "red", label: "High risk" },
  ACTIVE: { tone: "green", label: "Active" },
  SUSPENDED: { tone: "red", label: "Suspended" },
  CLOSED: { tone: "neutral", label: "Closed" },
  CLEAR: { tone: "green", label: "Clear" },
  POTENTIAL_MATCH: { tone: "amber", label: "Potential match" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { tone: "neutral" as const, label: status };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
