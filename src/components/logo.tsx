import Link from "next/link";
import { BRAND } from "@/config/brand";

export function Logo({ href = "/", subtitle = true }: { href?: string; subtitle?: boolean }) {
  return (
    <Link href={href} className="group flex items-center gap-3">
      <span className="glass-strong grid size-10 place-items-center rounded-xl">
        <svg viewBox="0 0 32 32" className="size-6" aria-hidden>
          <defs>
            <linearGradient id="rz-g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#6ee7c8" />
              <stop offset="1" stopColor="#f0c35a" />
            </linearGradient>
          </defs>
          <path d="M7 25V7h8.5a5.5 5.5 0 0 1 1.6 10.76L22 25h-4.6l-4.3-6.8H11V25H7Zm4-10.3h4.3a2.1 2.1 0 1 0 0-4.2H11v4.2Z" fill="url(#rz-g)" />
          <path d="M19 7h7l-5.2 7.5" stroke="url(#rz-g)" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-semibold tracking-tight text-white">{BRAND.name}</span>
        {subtitle && <span className="block text-[11px] uppercase tracking-[0.18em] text-slate-400">{BRAND.tagline}</span>}
      </span>
    </Link>
  );
}
