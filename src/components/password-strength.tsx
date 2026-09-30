"use client";

import { cn } from "./ui/cn";

const rules: [string, (p: string) => boolean][] = [
  ["12+ characters", (p) => p.length >= 12],
  ["Upper & lower case", (p) => /[a-z]/.test(p) && /[A-Z]/.test(p)],
  ["A number", (p) => /\d/.test(p)],
  ["A symbol", (p) => /[^A-Za-z0-9]/.test(p)],
];

export function PasswordStrength({ password, labels }: { password: string; labels?: string[] }) {
  const met = rules.filter(([, test]) => test(password)).length;
  return (
    <div className="mt-2 space-y-2" aria-live="polite">
      <div className="flex gap-1">
        {rules.map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition",
              i < met ? (met === rules.length ? "bg-brand-400" : met >= 2 ? "bg-amber-400" : "bg-rose-400") : "bg-white/10",
            )}
          />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-2 text-[11px] text-slate-400">
        {rules.map(([label, test], i) => (
          <li key={label} className={cn(test(password) && "text-brand-300")}>
            {test(password) ? "✓" : "○"} {labels?.[i] ?? label}
          </li>
        ))}
      </ul>
    </div>
  );
}
