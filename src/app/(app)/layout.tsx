import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { Logo } from "@/components/logo";
import { AppNav } from "@/components/app-nav";
import { TierBadge } from "@/components/tier-badge";
import { LogoutButton } from "@/components/logout-button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getDict } from "@/i18n/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (user.roles.includes("TEAM")) redirect("/admin");
  const t = await getDict();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-ink-950/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Logo href="/dashboard" subtitle={false} />
          <AppNav
            items={[
              { href: "/dashboard", label: t.nav.dashboard },
              { href: "/onboarding/identity", label: t.nav.verification, match: "/onboarding" },
              ...(user.roles.includes("FOUNDER") ? [{ href: "/pitches", label: t.nav.pitches }] : []),
              ...(user.roles.includes("INVESTOR") ? [{ href: "/opportunities", label: t.nav.opportunities }, { href: "/investments", label: t.nav.investments }] : []),
              { href: "/sessions", label: t.nav.tank },
            ]}
          />
          <div className="flex items-center gap-3">
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
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">{children}</main>
    </div>
  );
}
