"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "./ui/cn";

export type NavIcon = "home" | "shield" | "pitch" | "search" | "briefcase" | "video";
export type NavItem = { href: string; label: string; match?: string; icon?: NavIcon };

// Simple 24px stroke icons for the phone tab bar.
const ICONS: Record<NavIcon, string[]> = {
  home: ["M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"],
  shield: ["M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z", "M9 12l2 2 4-4"],
  pitch: ["M3 4h18", "M5 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4", "M12 15v4", "M8 21l4-2 4 2"],
  search: ["M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z", "M20 20l-4-4"],
  briefcase: ["M4 8h16v11H4z", "M9 8V5h6v3", "M4 13h16"],
  video: ["M3 7h12v10H3z", "M15 10l6-3v10l-6-3"],
};

function useActive() {
  const pathname = usePathname();
  return (item: NavItem) => (item.href === "/admin" || item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.match ?? item.href));
}

/** `match` marks the item active for every path under that prefix (defaults to `href`). */
export function AppNav({ items, className }: { items: NavItem[]; className?: string }) {
  const isActive = useActive();
  return (
    <nav className={cn("flex gap-1 overflow-x-auto", className)}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(item) ? "page" : undefined}
          className={cn("whitespace-nowrap rounded-lg px-3 py-2 text-sm transition", isActive(item) ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white")}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

/** Phone tab bar, fixed to the bottom of the screen like a native app. Hidden from tablet width up. */
export function BottomNav({ items }: { items: NavItem[] }) {
  const isActive = useActive();
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink-950/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      <ul className="mx-auto flex max-w-lg">
        {items.map((item) => {
          const active = isActive(item);
          return (
            <li key={item.href} className="min-w-0 flex-1">
              <Link href={item.href} aria-current={active ? "page" : undefined} className={cn("flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[11px] leading-tight transition", active ? "text-brand-300" : "text-slate-400 hover:text-white")}>
                {item.icon && (
                  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    {ICONS[item.icon].map((d) => (
                      <path key={d} d={d} />
                    ))}
                  </svg>
                )}
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
