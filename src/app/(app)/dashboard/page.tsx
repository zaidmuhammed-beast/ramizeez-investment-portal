import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getOnboardingState, recomputeTier, type StepStatus } from "@/lib/onboarding";
import { Card, PageHeader } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StepStatusBadge } from "@/components/step-status";
import { cn } from "@/components/ui/cn";
import { fill } from "@/i18n/config";
import { getDict } from "@/i18n/server";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  await recomputeTier(user.id);
  const state = await getOnboardingState(user.id);
  const { steps, tier } = state;
  const d = await getDict();
  const t = d.dashboard;

  const cards: { key: string; title: string; body: string; href: string; status: StepStatus; tierNo: number }[] = [
    { key: "identity", tierNo: 1, title: t.identityTitle, body: t.identityBody, href: "/onboarding/identity", status: steps.identity },
    { key: "profile", tierNo: 2, title: t.profileTitle, body: t.profileBody, href: "/onboarding/profile", status: steps.profile },
    { key: "role", tierNo: 3, title: t.roleTitle, body: user.roles.includes("INVESTOR") ? t.roleInvestor : t.roleFounder, href: "/onboarding/role", status: steps.role },
    { key: "final", tierNo: 4, title: t.finalTitle, body: t.finalBody, href: "/onboarding/final", status: steps.final },
  ];
  const next = cards.find((c) => c.status !== "done" && c.status !== "locked");

  return (
    <>
      <PageHeader
        title={fill(t.welcome, { name: user.firstName })}
        description={t.intro}
      />

      <Card strong className="mb-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-sm text-slate-400">{t.currentTier}</p>
            <p className="mt-1 text-2xl font-semibold text-white">
              {d.tier} {tier} · {d.tiers[tier]}
            </p>
          </div>
          {next && (
            <LinkButton href={next.href} className="px-5 py-3">
              {fill(t.continueTo, { step: next.title })}
            </LinkButton>
          )}
          {tier === 4 && <Badge tone="gold">{t.verifiedBadge}</Badge>}
        </div>
        <ol className="mt-6 grid grid-cols-5 gap-2" aria-label={t.progress}>
          {d.tiers.map((label, i) => (
            <li key={label} className="space-y-2">
              <div className={cn("h-1.5 rounded-full", i <= tier ? "bg-gradient-to-r from-brand-400 to-teal-300" : "bg-white/10")} />
              <p className={cn("text-[11px] sm:text-xs", i <= tier ? "text-slate-200" : "text-slate-500")}>
                T{i} · {label}
              </p>
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        {cards.map((c) => (
          <Card key={c.key} className={cn(c.status === "locked" && "opacity-60")}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">{d.tier} {c.tierNo}</p>
                <h2 className="mt-1 text-lg font-semibold text-white">{c.title}</h2>
              </div>
              <StepStatusBadge status={c.status} labels={d.steps} />
            </div>
            <p className="mt-3 text-sm text-slate-400">{c.body}</p>
            {c.status !== "locked" && (
              <Link href={c.href} className="mt-4 inline-block text-sm font-medium text-brand-300 hover:text-brand-200">
                {c.status === "done" || c.status === "in_review" ? t.view : t.start} <span aria-hidden className="inline-block rtl:rotate-180">→</span>
              </Link>
            )}
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {user.roles.includes("FOUNDER") && (
          <Card title={t.pitchesTitle} description={t.pitchesBody}>
            {tier >= 1 ? (
              <LinkButton href="/pitches" variant="secondary">
                {t.pitchesCta}
              </LinkButton>
            ) : (
              <Badge tone="neutral">{fill(t.opensAt, { tier: 1 })}</Badge>
            )}
          </Card>
        )}
        {user.roles.includes("INVESTOR") && (
          <Card title={t.oppsTitle} description={t.oppsBody}>
            {tier >= 3 ? (
              <LinkButton href="/opportunities" variant="secondary">
                {t.oppsCta}
              </LinkButton>
            ) : (
              <Badge tone="neutral">{fill(t.opensAt, { tier: 3 })}</Badge>
            )}
          </Card>
        )}
        <Card title={t.tankTitle} description={t.tankBody}>
          <LinkButton href="/sessions" variant="secondary">
            {t.tankCta}
          </LinkButton>
        </Card>
      </div>
    </>
  );
}
