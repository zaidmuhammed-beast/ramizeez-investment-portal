"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "./ui/cn";

/** `match` marks the item active for every path under that prefix (defaults to `href`). */
export function AppNav({ items, className }: { items: { href: string; label: string; match?: string }[]; className?: string }) {
  const pathname = usePathname();
  return (
    <nav className={cn("flex gap-1 overflow-x-auto", className)}>
      {items.map((item) => {
        const active = item.href === "/admin" || item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.match ?? item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "whitespace-nowrap rounded-lg px-3 py-2 text-sm transition",
              active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
