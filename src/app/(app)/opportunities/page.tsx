import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { formatMoney } from "@/config/platform";
import { investorContext, listOpportunities, quotaUsage } from "@/lib/investor/access";
import type { Level } from "@/lib/investor/disclosure";
import { Card, PageHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { TeaserCard } from "@/components/investor/teaser";
import { cn } from "@/components/ui/cn";

export const metadata: Metadata = { title: "Opportunities" };

export default async function OpportunitiesPage({ searchParams }: PageProps<"/opportunities">) {
  const user = await requireUser();
  if (!user.roles.includes("INVESTOR")) redirect("/dashboard");
  const { all, view } = await searchParams;
  const ctx = await investorContext(user);

  if (!ctx?.ready || !ctx.prefs || !ctx.profile) {
    return (
      <>
        <PageHeader title="Opportunities" description="Vetted, RamiZeeZ-screened businesses that match your verified budget and preferences." />
        <Card>
          <Alert tone="info">
            Opportunities open once your investor role is verified (Tier 3) and RamiZeeZ has set your verified budget.{" "}
            <Link href="/dashboard" className="underline">
              See your progress
            </Link>
            .
          </Alert>
        </Card>
      </>
    );
  }

  const [items, quota] = await Promise.all([listOpportunities(user, ctx.prefs, all === "1"), quotaUsage(user.id, ctx.tier)]);
  const watchOnly = view === "watchlist";
  const shown = watchOnly ? items.filter((i) => i.pitch.watchers.length) : items;
  const levelOf = (i: (typeof items)[number]): Level =>
    i.pitch.accessRequests[0]?.status === "APPROVED" && ctx.tier >= 4 ? "FULL" : i.pitch.ndaSignatures.length ? "SUMMARY" : "TEASER";
  const tab = (href: string, label: string, active: boolean) => (
    <Link href={href} className={cn("rounded-lg px-3 py-1.5 text-sm", active ? "bg-white/10 text-white" : "text-slate-400 hover:text-white")}>
      {label}
    </Link>
  );

  return (
    <>
      <PageHeader title="Opportunities" description="Anonymous teasers of screened businesses. Sign a deal-specific NDA to unlock a summary, then request the full data room." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-slate-400">Verified budget</p>
          <p className="mt-1 text-xl font-semibold text-white">{formatMoney(ctx.prefs.verifiedBudget ?? 0, ctx.prefs.currency)}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-400">Summary unlocks (30 days)</p>
          <p className="mt-1 text-xl font-semibold text-white" data-testid="unlocks-left">
            {Math.max(quota.unlockLimit - quota.unlocks, 0)} of {quota.unlockLimit} left
          </p>
        </Card>
        <Card>
          <p className="text-xs text-slate-400">Data-room requests (30 days)</p>
          <p className="mt-1 text-xl font-semibold text-white">
            {ctx.tier >= 4 ? `${Math.max(quota.requestLimit - quota.requests, 0)} of ${quota.requestLimit} left` : "At Tier 4"}
          </p>
        </Card>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {tab("/opportunities", "Matches my preferences", !all && !watchOnly)}
        {tab("/opportunities?all=1", "Everything within my budget", all === "1" && !watchOnly)}
        {tab("/opportunities?view=watchlist&all=1", "Watchlist", watchOnly)}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {shown.map((i) => (
          <TeaserCard key={i.pitch.id} pitch={i.pitch} level={levelOf(i)} fit={i.match.fit} watching={i.pitch.watchers.length > 0} requestStatus={i.pitch.accessRequests[0]?.status} />
        ))}
      </div>
      {!shown.length && (
        <Card>
          <p className="text-sm text-slate-400">
            {watchOnly ? "Your watchlist is empty." : "No listed opportunities match right now. We'll email you when one does."}
            {!all && !watchOnly && (
              <>
                {" "}
                <Link href="/opportunities?all=1" className="text-brand-300 underline">
                  See everything within your budget
                </Link>
                .
              </>
            )}
          </p>
        </Card>
      )}
    </>
  );
}
