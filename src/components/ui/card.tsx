import type { ReactNode } from "react";
import { cn } from "./cn";

export function Card({
  title,
  description,
  actions,
  children,
  className,
  strong,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  strong?: boolean;
}) {
  return (
    <section className={cn(strong ? "glass-strong" : "glass", "rounded-2xl p-6 sm:p-7", className)}>
      {(title || actions) && (
        <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-lg font-semibold tracking-tight text-white">{title}</h2>}
            {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-slate-400">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
