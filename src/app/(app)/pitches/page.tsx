import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { recomputeTier } from "@/lib/onboarding";
import { formatMoney } from "@/config/platform";
import { toPitchData } from "@/lib/pitch/data";
import { pitchIssues } from "@/lib/pitch/completeness";
import { Card, PageHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { PitchStatusBadge } from "@/components/pitch/status-badge";
import { SubmitButton } from "@/components/ui/button";
import { createPitchAction } from "./actions";

export const metadata: Metadata = { title: "Your pitches" };

export default async function PitchesPage({ searchParams }: PageProps<"/pitches">) {
  const user = await requireUser();
  if (!user.roles.includes("FOUNDER")) redirect("/dashboard");
  const { limit } = await searchParams;
  const tier = await recomputeTier(user.id);
  const pitches = await db.pitch.findMany({
    where: { founderId: user.id },
    orderBy: { updatedAt: "desc" },
    include: { costItems: true, milestones: true },
  });

  return (
    <>
      <PageHeader
        title="Your pitches"
        description="Build a complete proposal: your experience, the business, the costing and the roadmap. Drafts save section by section, and only RamiZeeZ staff see a pitch until it's approved and listed."
      />
      {limit && (
        <Alert tone="warn" className="mb-6">
          You can have up to 5 active pitches. Withdraw one to start another.
        </Alert>
      )}

      {tier < 1 ? (
        <Card>
          <Alert tone="info">
            Pitching opens once your identity is verified (Tier 1).{" "}
            <Link href="/onboarding/identity" className="underline">
              Verify your identity
            </Link>
            . You&apos;ll need your full profile (Tier 2) to submit.
          </Alert>
        </Card>
      ) : (
        <Card strong title="Start a new pitch" className="mb-6">
          <form action={createPitchAction} className="flex flex-wrap items-end gap-3">
            <label className="min-w-64 flex-1 space-y-1.5 text-sm">
              <span className="block font-medium text-slate-200">Working title</span>
              <input name="title" required maxLength={120} placeholder="e.g. Organic dairy delivery in Lahore" className="field-control" />
            </label>
            <SubmitButton pendingText="Creating…">Create pitch</SubmitButton>
          </form>
        </Card>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {pitches.map((p) => {
          const data = toPitchData(p);
          const open = pitchIssues(data).length;
          return (
            <Link key={p.id} href={`/pitches/${p.id}`} className="glass block rounded-2xl p-6 transition hover:bg-white/10">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold text-white">{p.title}</h2>
                <PitchStatusBadge status={p.status} />
              </div>
              <p className="mt-1 text-sm text-slate-400">
                {[p.sector, p.city].filter(Boolean).join(" · ") || "No sector yet"}
                {data.amount !== null && ` · raising ${formatMoney(data.amount, p.currency)}`}
              </p>
              <p className="mt-4 text-xs text-slate-500">
                {p.status === "DRAFT" || p.status === "RETURNED" ? (open ? `${open} item(s) left before you can submit` : "Ready to submit") : `Updated ${p.updatedAt.toISOString().slice(0, 10)}`}
              </p>
            </Link>
          );
        })}
      </div>
      {!pitches.length && tier >= 1 && <p className="text-center text-sm text-slate-400">No pitches yet.</p>}
    </>
  );
}
