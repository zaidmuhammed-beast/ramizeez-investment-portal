import type { Metadata } from "next";
import Link from "next/link";
import type { CaseKind, CaseStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireTeam } from "@/lib/auth/rbac";
import { KIND_LABEL } from "@/lib/case-labels";
import { Card, PageHeader } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Verification queue" };

const KINDS: CaseKind[] = ["IDENTITY", "ROLE", "FINAL"];
const STATUSES: CaseStatus[] = ["IN_REVIEW", "NEEDS_INFO", "APPROVED", "REJECTED"];

const age = (d: Date) => {
  const h = Math.floor((Date.now() - d.getTime()) / 3_600_000);
  return h < 1 ? "just now" : h < 48 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
};

export default async function CasesPage({ searchParams }: PageProps<"/admin/cases">) {
  const me = await requireTeam("cases.view");
  const sp = await searchParams;
  const kind = KINDS.includes(sp.kind as CaseKind) ? (sp.kind as CaseKind) : undefined;
  const status = STATUSES.includes(sp.status as CaseStatus) ? (sp.status as CaseStatus) : sp.status === "ALL" ? undefined : "IN_REVIEW";
  const mine = sp.mine === "1";

  const where: Prisma.VerificationCaseWhereInput = { kind, status, ...(mine ? { assignedToId: me.id } : {}) };
  const cases = await db.verificationCase.findMany({
    where,
    // Oldest first, so nobody waits too long.
    orderBy: [{ createdAt: "asc" }],
    take: 200,
    include: {
      user: { select: { firstName: true, lastName: true, email: true, roles: true, countryOfResidence: true } },
      assignedTo: { select: { firstName: true, lastName: true } },
    },
  });

  return (
    <>
      <PageHeader title="Verification queue" description="Oldest first. Open a case to review the automated checks and make a decision." />
      <Card className="mb-6">
        <form className="flex flex-wrap items-end gap-3" method="get">
          <label className="space-y-1 text-sm">
            <span className="block text-slate-400">Type</span>
            <select name="kind" defaultValue={kind ?? ""} className="field-control min-w-40">
              <option value="">All types</option>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="block text-slate-400">Status</span>
            <select name="status" defaultValue={status ?? "ALL"} className="field-control min-w-40">
              <option value="ALL">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ").toLowerCase()}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 pb-3 text-sm text-slate-300">
            <input type="checkbox" name="mine" value="1" defaultChecked={mine} className="size-4 accent-brand-400" /> Assigned to me
          </label>
          <button className="glass rounded-xl px-4 py-2.5 text-sm text-white hover:bg-white/10">Filter</button>
        </form>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="pb-3 font-medium">Applicant</th>
                <th className="pb-3 font-medium">Type</th>
                <th className="pb-3 font-medium">Risk</th>
                <th className="pb-3 font-medium">Submitted</th>
                <th className="pb-3 font-medium">Assigned</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {cases.map((c) => (
                <tr key={c.id} className="hover:bg-white/[0.03]">
                  <td className="py-3">
                    <Link href={`/admin/cases/${c.id}`} className="font-medium text-white hover:text-brand-200">
                      {c.user.firstName} {c.user.lastName}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {c.user.email} · {c.user.countryOfResidence} · {c.user.roles.join("/").toLowerCase()}
                    </p>
                  </td>
                  <td className="py-3">
                    <Badge tone="violet">{KIND_LABEL[c.kind]}</Badge>
                  </td>
                  <td className="py-3">
                    <StatusBadge status={c.riskLevel} />
                  </td>
                  <td className="py-3 text-slate-300">{age(c.createdAt)}</td>
                  <td className="py-3 text-slate-300">{c.assignedTo ? `${c.assignedTo.firstName} ${c.assignedTo.lastName}` : "—"}</td>
                  <td className="py-3">
                    <StatusBadge status={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!cases.length && <p className="py-6 text-center text-sm text-slate-400">No cases match these filters.</p>}
        </div>
      </Card>
    </>
  );
}
