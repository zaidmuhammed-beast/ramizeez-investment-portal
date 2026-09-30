import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { can, requireTeam } from "@/lib/auth/rbac";
import { KIND_LABEL } from "@/lib/case-labels";
import { countryName } from "@/lib/countries";
import { Card, PageHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { TierBadge } from "@/components/tier-badge";
import { ProfileSummary, RoleEvidence, applicantInclude } from "@/components/admin/applicant-file";
import { UserStatusForm } from "./status-form";

export const metadata: Metadata = { title: "User" };

export default async function UserPage({ params }: PageProps<"/admin/users/[id]">) {
  const me = await requireTeam("users.view");
  const { id } = await params;
  const u = await db.user.findUnique({
    where: { id },
    include: {
      ...applicantInclude,
      cases: { orderBy: { createdAt: "desc" } },
      amlScreenings: { orderBy: { screenedAt: "desc" }, take: 5 },
      sessions: { orderBy: { lastSeenAt: "desc" }, take: 5 },
    },
  });
  if (!u || u.roles.includes("TEAM")) notFound();
  await audit("user.viewed", { actorId: me.id, targetType: "User", targetId: u.id });

  const canViewFiles = can(me, "kyc.files.view");
  const fileIds = [...(u.investorProfile?.proofOfFundsIds ?? []), ...(u.investorProfile?.entityDocumentIds ?? []), ...(u.founderProfile?.documentIds ?? [])];
  const files = Object.fromEntries(
    (await db.storedFile.findMany({ where: { id: { in: fileIds } }, select: { id: true, originalName: true, kind: true } })).map((f) => [f.id, f]),
  );

  return (
    <>
      <Link href="/admin/users" className="text-sm text-slate-400 hover:text-white">
        ← All users
      </Link>
      <PageHeader
        title={`${u.firstName} ${u.lastName}`}
        description={`${u.email} · ${u.phone} · ${countryName(u.countryOfResidence)} · ${u.roles.join(", ").toLowerCase()}`}
        actions={
          <div className="flex items-center gap-2">
            <TierBadge tier={u.tier} />
            <StatusBadge status={u.status} />
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <RoleEvidence user={u} files={files} canViewFiles={canViewFiles} />
          <ProfileSummary user={u} />
        </div>
        <aside className="space-y-6">
          <Card title="Verification cases">
            <ul className="space-y-2 text-sm">
              {u.cases.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2">
                  {can(me, "cases.view") ? (
                    <Link href={`/admin/cases/${c.id}`} className="text-slate-300 hover:text-white">
                      {KIND_LABEL[c.kind]} · {c.createdAt.toISOString().slice(0, 10)}
                    </Link>
                  ) : (
                    <span className="text-slate-300">{KIND_LABEL[c.kind]}</span>
                  )}
                  <StatusBadge status={c.status} />
                </li>
              ))}
              {!u.cases.length && <li className="text-slate-500">Nothing submitted yet.</li>}
            </ul>
          </Card>
          <Card title="Security">
            <ul className="space-y-2 text-sm text-slate-300">
              <li>Email verified: {u.emailVerifiedAt ? "✓" : "—"}</li>
              <li>Phone verified: {u.phoneVerifiedAt ? "✓" : "—"}</li>
              <li>2FA: {u.totpEnabledAt ? `on since ${u.totpEnabledAt.toISOString().slice(0, 10)}` : "off"}</li>
              <li>Recovery codes left: {u.recoveryCodes.length}</li>
              <li>Last login: {u.lastLoginAt?.toUTCString() ?? "—"}</li>
            </ul>
            <h3 className="mb-2 mt-4 text-xs uppercase tracking-wider text-slate-500">Recent sessions</h3>
            <ul className="space-y-1 text-xs text-slate-400">
              {u.sessions.map((s) => (
                <li key={s.id}>
                  {s.ip ?? "?"} · {s.userAgent?.slice(0, 40)} · {s.lastSeenAt.toISOString().slice(0, 16)}
                </li>
              ))}
            </ul>
          </Card>
          <Card title="AML screenings">
            <ul className="space-y-2 text-sm">
              {u.amlScreenings.map((a) => (
                <li key={a.id} className="flex items-center justify-between">
                  <span className="text-slate-400">{a.screenedAt.toISOString().slice(0, 10)}</span>
                  <StatusBadge status={a.result} />
                </li>
              ))}
              {!u.amlScreenings.length && <li className="text-slate-500">Not screened yet.</li>}
            </ul>
          </Card>
          {can(me, "users.suspend") && (
            <Card title="Account status">
              <UserStatusForm userId={u.id} status={u.status} reason={u.statusReason} />
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
