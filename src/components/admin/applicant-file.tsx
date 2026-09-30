import type { ReactNode } from "react";
import type { Prisma } from "@prisma/client";
import { countryName } from "@/lib/countries";
import { PLATFORM_TERMS } from "@/config/platform";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const applicantInclude = {
  personalProfile: true,
  education: { orderBy: { position: "asc" } },
  experience: { orderBy: { position: "asc" } },
  pastVentures: { orderBy: { position: "asc" } },
  references: { orderBy: { position: "asc" } },
  goals: true,
  declaration: true,
  investorProfile: true,
  founderProfile: true,
} satisfies Prisma.UserInclude;

export type Applicant = Prisma.UserGetPayload<{ include: typeof applicantInclude }>;
type FileRow = { id: string; originalName: string | null; kind: string };

const fmt = (d?: Date | null) => (d ? d.toISOString().slice(0, 10) : "—");
const years = (a?: number | null, b?: number | null) => `${a ?? "?"}–${b ?? "present"}`;
const money = (currency: string, v: unknown) => (v === null || v === undefined ? "—" : `${currency} ${Number(v).toLocaleString("en-US")}`);

function Dl({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs uppercase tracking-wider text-slate-500">{k}</dt>
          <dd className="mt-0.5 whitespace-pre-line text-sm text-slate-100">{v || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function Files({ ids, files }: { ids: string[]; files: Record<string, FileRow> }) {
  if (!ids.length) return <p className="text-sm text-slate-400">No documents.</p>;
  return (
    <ul className="space-y-1 text-sm">
      {ids.map((id) => (
        <li key={id}>
          <a href={`/api/files/${id}`} target="_blank" className="text-brand-300 hover:underline">
            📎 {files[id]?.originalName ?? "document"}
          </a>{" "}
          <span className="text-xs text-slate-500">{files[id]?.kind.toLowerCase().replaceAll("_", " ")}</span>
        </li>
      ))}
    </ul>
  );
}

export function RoleEvidence({ user, files, canViewFiles }: { user: Applicant; files: Record<string, FileRow>; canViewFiles: boolean }) {
  const inv = user.investorProfile;
  const fdr = user.founderProfile;
  return (
    <>
      {inv && (
        <Card title="Investor profile" actions={inv.shariahOnly ? <Badge tone="gold">Shariah only</Badge> : undefined}>
          <Dl
            items={[
              ["Type", inv.investorType.replaceAll("_", " ").toLowerCase()],
              ["Entity", inv.entityName ? `${inv.entityName} (${inv.entityRegNumber})` : null],
              ["Declared budget", money(inv.currency, inv.declaredBudget)],
              ["Verified budget", inv.verifiedBudget ? money(inv.currency, inv.verifiedBudget) : <Badge tone="amber">Not set</Badge>],
              ["Ticket range", `${money(inv.currency, inv.ticketMin)} – ${money(inv.currency, inv.ticketMax)}`],
              ["Income / net worth", `${inv.annualIncomeBand} / ${inv.netWorthBand}`],
              ["Sources of funds", inv.sourceOfFunds.join(", ").toLowerCase()],
              ["Source of wealth", inv.sourceOfWealth],
              ["Experience", inv.experience],
              ["Suitability score", `${inv.riskScore}/9`],
              ["Sectors", inv.sectors.join(", ")],
              ["Stages", inv.stages.join(", ").toLowerCase()],
              ["Deal types", inv.dealTypes.join(", ").replaceAll("_", " ").toLowerCase()],
              ["Regions", inv.geographies.join(", ")],
            ]}
          />
          <h3 className="mb-2 mt-5 text-sm font-medium text-white">Proof of funds & entity documents</h3>
          {canViewFiles ? <Files ids={[...inv.proofOfFundsIds, ...inv.entityDocumentIds]} files={files} /> : <p className="text-xs text-slate-500">Your role cannot view documents.</p>}
        </Card>
      )}
      {fdr && (
        <Card title="Founder profile">
          <Dl
            items={[
              ["Stage", fdr.stage === "IDEA" ? "Idea" : "Existing business"],
              ["Business", fdr.businessName],
              ["Sector", fdr.sector],
              ["Location", `${fdr.city}, ${countryName(fdr.country)}`],
              ["Legal form", fdr.entityType?.replaceAll("_", " ").toLowerCase()],
              ["Registration / tax no.", [fdr.registrationNumber, fdr.taxNumber].filter(Boolean).join(" / ")],
              ["Founded / employees", [fdr.foundedYear, fdr.employees !== null ? `${fdr.employees} staff` : null].filter(Boolean).join(" · ")],
              ["Own capital", money(fdr.currency, fdr.personalCapital)],
              ["Deal types", fdr.preferredDealTypes.join(", ").replaceAll("_", " ").toLowerCase()],
              ["Co-founders", fdr.coFounders],
              [
                "RamiZeeZ terms",
                fdr.platformTermsAcceptedAt ? (
                  <>
                    {fdr.platformTermsVersion === PLATFORM_TERMS.version ? <Badge tone="green">Current</Badge> : <Badge tone="amber">Outdated</Badge>} v{fdr.platformTermsVersion},
                    accepted {fmt(fdr.platformTermsAcceptedAt)}
                  </>
                ) : (
                  <Badge tone="red">Not accepted</Badge>
                ),
              ],
            ]}
          />
          <h3 className="mb-2 mt-5 text-sm font-medium text-white">Documents</h3>
          {canViewFiles ? <Files ids={fdr.documentIds} files={files} /> : <p className="text-xs text-slate-500">Your role cannot view documents.</p>}
        </Card>
      )}
    </>
  );
}

export function ProfileSummary({ user }: { user: Applicant }) {
  const p = user.personalProfile;
  const g = user.goals;
  const d = user.declaration;
  return (
    <>
      <Card title="Personal">
        {p ? (
          <Dl
            items={[
              ["Date of birth", fmt(p.dateOfBirth)],
              ["Father / husband", p.fatherOrSpouseName],
              ["Nationalities", p.nationalities.map(countryName).join(", ")],
              ["Languages", p.languages.join(", ")],
              ["Marital status / dependants", [p.maritalStatus, p.dependants !== null ? `${p.dependants} dependants` : null].filter(Boolean).join(" · ")],
              ["LinkedIn", p.linkedinUrl && <a href={p.linkedinUrl} target="_blank" rel="noreferrer noopener" className="text-brand-300 hover:underline">{p.linkedinUrl}</a>],
              ["About", p.bio],
              ["Other links", p.otherLinks],
            ]}
          />
        ) : (
          <p className="text-sm text-slate-400">Not completed.</p>
        )}
      </Card>

      <Card title="Education & experience">
        <ul className="space-y-3 text-sm">
          {user.education.map((e) => (
            <li key={e.id}>
              <span className="font-medium text-white">{e.qualification}</span>
              {e.fieldOfStudy && `, ${e.fieldOfStudy}`} · {e.institution} <span className="text-slate-500">({years(e.startYear, e.endYear)})</span>
            </li>
          ))}
        </ul>
        <div className="my-4 border-t border-white/10" />
        <ul className="space-y-4 text-sm">
          {user.experience.map((e) => (
            <li key={e.id}>
              <p>
                <span className="font-medium text-white">{e.title}</span> · {e.employer} <span className="text-slate-500">({years(e.startYear, e.endYear)})</span>
              </p>
              <p className="mt-1 text-slate-400">{e.responsibilities}</p>
            </li>
          ))}
        </ul>
        {user.pastVentures.length > 0 && (
          <>
            <div className="my-4 border-t border-white/10" />
            <h3 className="mb-2 text-sm font-medium text-white">Past businesses</h3>
            <ul className="space-y-3 text-sm">
              {user.pastVentures.map((v) => (
                <li key={v.id}>
                  <span className="text-white">{v.name}</span> · {v.sector} · {v.outcome.toLowerCase()} <span className="text-slate-500">({years(v.startYear, v.endYear)})</span>
                  <p className="mt-1 text-slate-400">Lessons: {v.lessons}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Card title="Goals & motivation">
        {g ? (
          <Dl
            items={[
              ["1 year", g.goals1y],
              ["5 years", g.goals5y],
              ["10 years", g.goals10y],
              ["Motivation", g.motivation],
              ["Cause they care about", g.causeCare],
              ["Success looks like", g.successDefinition],
              ["Time commitment", g.timeCommitment.replace("_", " ").toLowerCase()],
              ["Other commitments", g.otherCommitments],
              ["Values", g.values],
              ["Setback story", g.setbackStory],
            ]}
          />
        ) : (
          <p className="text-sm text-slate-400">Not completed.</p>
        )}
      </Card>

      <Card title="References & declarations">
        <ul className="space-y-2 text-sm">
          {user.references.map((r) => (
            <li key={r.id}>
              <span className="text-white">{r.name}</span> · {r.relationship} · {r.email} · {r.phone}
            </li>
          ))}
        </ul>
        {d && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
            {(
              [
                ["Criminal record", d.hasCriminalRecord],
                ["Litigation", d.hasPendingLitigation],
                ["Bankruptcy / default", d.hasBankruptcyOrDefault],
                ["PEP", d.isPep],
                ["Conflict of interest", d.hasConflictOfInterest],
              ] as const
            ).map(([label, v]) => (
              <Badge key={label} tone={v ? "red" : "green"}>
                {label}: {v ? "yes" : "no"}
              </Badge>
            ))}
            {d.details && <p className="w-full text-sm text-slate-300">{d.details}</p>}
            <p className="w-full text-xs text-slate-500">Signed {d.signedAt.toUTCString()} from {d.signedIp ?? "unknown IP"}</p>
          </div>
        )}
      </Card>
    </>
  );
}
