import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { Logo } from "@/components/logo";
import { AppNav, BottomNav, type NavItem } from "@/components/app-nav";
import { TierBadge } from "@/components/tier-badge";
import { LogoutButton } from "@/components/logout-button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getDict } from "@/i18n/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (user.roles.includes("TEAM")) redirect("/admin");
  const t = await getDict();
  const nav: NavItem[] = [
    { href: "/dashboard", label: t.nav.dashboard, icon: "home" },
    { href: "/onboarding/identity", label: t.nav.verification, match: "/onboarding", icon: "shield" },
    ...(user.roles.includes("FOUNDER") ? [{ href: "/pitches", label: t.nav.pitches, icon: "pitch" as const }] : []),
    ...(user.roles.includes("INVESTOR")
      ? [
          { href: "/opportunities", label: t.nav.opportunities, icon: "search" as const },
          { href: "/investments", label: t.nav.investments, icon: "briefcase" as const },
        ]
      : []),
    { href: "/sessions", label: t.nav.tank, icon: "video" },
  ];
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-ink-950/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <Logo href="/dashboard" subtitle={false} />
          <AppNav items={nav} className="hidden md:flex" />
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden text-end sm:block">
              <p className="text-sm font-medium text-white">
                {user.firstName} {user.lastName}
              </p>
              <TierBadge tier={user.tier} labels={t.tiers} word={t.tier} />
            </div>
            <LanguageSwitcher />
            <LogoutButton label={t.common.signOut} />
          </div>
        </div>
      </header>
      {/* Extra bottom padding on phones keeps content clear of the tab bar. */}
      <main className="mx-auto max-w-6xl px-4 pb-28 pt-8 sm:px-6 md:py-10">{children}</main>
      <BottomNav items={nav} />
    </div>
  );
}
