import { requireTeam, can, TEAM_ROLE_LABELS, type Permission } from "@/lib/auth/rbac";
import { Logo } from "@/components/logo";
import { AppNav } from "@/components/app-nav";
import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "@/components/logout-button";

const NAV: { href: string; label: string; permission?: Permission }[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/cases", label: "Verification queue", permission: "cases.view" },
  { href: "/admin/pitches", label: "Pitches", permission: "pitches.view" },
  { href: "/admin/deals", label: "Deals", permission: "deals.view" },
  { href: "/admin/users", label: "Users", permission: "users.view" },
  { href: "/admin/team", label: "Team", permission: "team.manage" },
  { href: "/admin/watchlist", label: "Watchlist", permission: "watchlist.manage" },
  { href: "/admin/audit", label: "Audit log", permission: "audit.view" },
  { href: "/admin/outbox", label: "Outbox", permission: "outbox.view" },
  { href: "/admin/settings", label: "Settings", permission: "team.manage" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireTeam();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-ink-950/50 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo href="/admin" subtitle={false} />
            <Badge tone="violet">Team portal</Badge>
          </div>
          <AppNav items={NAV.filter((n) => !n.permission || can(user, n.permission))} />
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-white">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-slate-400">{user.teamRole && TEAM_ROLE_LABELS[user.teamRole]}</p>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">{children}</main>
    </div>
  );
}
