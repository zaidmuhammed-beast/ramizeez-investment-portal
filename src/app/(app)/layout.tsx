import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { Logo } from "@/components/logo";
import { AppNav } from "@/components/app-nav";
import { TierBadge } from "@/components/tier-badge";
import { LogoutButton } from "@/components/logout-button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (user.roles.includes("TEAM")) redirect("/admin");
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-ink-950/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Logo href="/dashboard" subtitle={false} />
          <AppNav
            items={[
              { href: "/dashboard", label: "Dashboard" },
              { href: "/onboarding/identity", label: "Identity" },
              { href: "/onboarding/profile", label: "Profile" },
              { href: "/onboarding/role", label: "Role verification" },
              { href: "/onboarding/final", label: "Final approval" },
            ]}
          />
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-white">
                {user.firstName} {user.lastName}
              </p>
              <TierBadge tier={user.tier} />
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">{children}</main>
    </div>
  );
}
