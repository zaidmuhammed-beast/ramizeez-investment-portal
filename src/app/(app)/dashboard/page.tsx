import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getOnboardingState, recomputeTier, type StepStatus } from "@/lib/onboarding";
import { Card, PageHeader } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StepStatusBadge } from "@/components/step-status";
import { TIER_LABELS } from "@/components/tier-badge";
import { cn } from "@/components/ui/cn";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  await recomputeTier(user.id);
  const state = await getOnboardingState(user.id);
  const { steps, tier } = state;

  const cards: { key: string; title: string; body: string; href: string; status: StepStatus; tierNo: number }[] = [
    { key: "identity", tierNo: 1, title: "Identity verification", body: "CNIC, NICOP or passport, a live selfie challenge, proof of address and sanctions screening.", href: "/onboarding/identity", status: steps.identity },
    { key: "profile", tierNo: 2, title: "Your full profile", body: "Background, education, experience, past ventures, life goals, references and declarations.", href: "/onboarding/profile", status: steps.profile },
    { key: "role", tierNo: 3, title: "Role verification", body: user.roles.includes("INVESTOR") ? "Investor profile, verified budget, source and proof of funds." : "Business details, registration and financial documents.", href: "/onboarding/role", status: steps.role },
    { key: "final", tierNo: 4, title: "RamiZeeZ approval", body: "Final review by our team and a short video interview.", href: "/onboarding/final", status: steps.final },
  ];
  const next = cards.find((c) => c.status !== "done" && c.status !== "locked");

  return (
    <>
      <PageHeader
        title={`Welcome, ${user.firstName}`}
        description="Complete each verification tier to unlock more of the platform. Your information is encrypted and only seen by authorised RamiZeeZ staff."
      />

      <Card strong className="mb-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-sm text-slate-400">Current tier</p>
            <p className="mt-1 text-2xl font-semibold text-white">
              Tier {tier} · {TIER_LABELS[tier]}
            </p>
          </div>
          {next && (
            <LinkButton href={next.href} className="px-5 py-3">
              Continue: {next.title}
            </LinkButton>
          )}
          {tier === 4 && <Badge tone="gold">★ RamiZeeZ Verified</Badge>}
        </div>
        <ol className="mt-6 grid grid-cols-5 gap-2" aria-label="Verification progress">
          {TIER_LABELS.map((label, i) => (
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
                <p className="text-xs uppercase tracking-wider text-slate-500">Tier {c.tierNo}</p>
                <h2 className="mt-1 text-lg font-semibold text-white">{c.title}</h2>
              </div>
              <StepStatusBadge status={c.status} />
            </div>
            <p className="mt-3 text-sm text-slate-400">{c.body}</p>
            {c.status !== "locked" && (
              <Link href={c.href} className="mt-4 inline-block text-sm font-medium text-brand-300 hover:text-brand-200">
                {c.status === "done" || c.status === "in_review" ? "View" : "Start"} →
              </Link>
            )}
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {user.roles.includes("FOUNDER") && (
          <Card title="Your pitches" description="Draft from Tier 1, submit from Tier 2. Listed once you're RamiZeeZ Verified (Tier 4).">
            {tier >= 1 ? (
              <LinkButton href="/pitches" variant="secondary">
                Open pitch builder
              </LinkButton>
            ) : (
              <Badge tone="neutral">Opens at Tier 1</Badge>
            )}
          </Card>
        )}
        {user.roles.includes("INVESTOR") && (
          <Card title="Opportunities" description="Opens at Tier 3. Matched to your verified budget and preferences.">
            <Badge tone="neutral">Coming soon</Badge>
          </Card>
        )}
      </div>
    </>
  );
}
