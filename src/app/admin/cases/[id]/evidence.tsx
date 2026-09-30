import type { ReactNode } from "react";
import type { Prisma } from "@prisma/client";
import { countryName } from "@/lib/countries";
import type { CheckResult } from "@/lib/kyc/types";
import type { AmlHit } from "@/lib/kyc/aml";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { RevealNumber } from "./client";

export const fmtDate = (d?: Date | null) => (d ? d.toISOString().slice(0, 10) : "—");

export function Dl({ items }: { items: [string, ReactNode][] }) {
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

export function ChecksTable({ checks }: { checks: CheckResult[] }) {
  return (
    <ul className="divide-y divide-white/5">
      {checks.map((c) => (
        <li key={c.id} className="flex items-start justify-between gap-4 py-3">
          <div>
            <p className="text-sm font-medium text-white">{c.label}</p>
            <p className="text-xs text-slate-400">{c.detail}</p>
          </div>
          <StatusBadge status={c.status} />
        </li>
      ))}
    </ul>
  );
}

function FileThumb({ id, label, pdf }: { id: string; label: string; pdf?: boolean }) {
  return (
    <figure className="space-y-1.5">
      <a href={`/api/files/${id}`} target="_blank" className="block overflow-hidden rounded-xl border border-white/10 bg-ink-950/60">
        {pdf ? (
          <div className="grid aspect-video place-items-center text-sm text-brand-300">Open PDF ↗</div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/files/${id}`} alt={label} className="aspect-video w-full object-contain" />
        )}
      </a>
      <figcaption className="text-xs text-slate-400">{label}</figcaption>
    </figure>
  );
}

type IdentityData = {
  doc: Prisma.IdentityDocumentGetPayload<object> | null;
  liveness: Prisma.LivenessCheckGetPayload<object> | null;
  address: Prisma.AddressGetPayload<object> | null;
  aml: Prisma.AmlScreeningGetPayload<object> | null;
  files: Record<string, { mimeType: string; liveCapture: boolean }>;
  canViewFiles: boolean;
};

export function IdentityEvidence({ doc, liveness, address, aml, files, canViewFiles }: IdentityData) {
  if (!doc) return <Card title="Identity document">No document found.</Card>;
  const hits = (aml?.hits ?? []) as AmlHit[];
  return (
    <>
      <Card title="Document">
        <Dl
          items={[
            ["Type", doc.type],
            ["Issuing country", countryName(doc.issuingCountry)],
            ["Number", canViewFiles ? <RevealNumber docId={doc.id} last4={doc.numberLast4} /> : `••••${doc.numberLast4}`],
            ["Name on document", doc.fullNameOnDoc],
            ["Date of birth", fmtDate(doc.dateOfBirth)],
            ["Gender", doc.gender],
            ["Issued", fmtDate(doc.issueDate)],
            ["Expires", fmtDate(doc.expiryDate)],
          ]}
        />
        {doc.mrz && <pre className="mt-4 overflow-x-auto rounded-xl bg-ink-950/60 p-3 font-mono text-xs text-slate-200">{doc.mrz}</pre>}
        {canViewFiles ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <FileThumb id={doc.frontFileId} label={`Front${files[doc.frontFileId]?.liveCapture ? " · live" : " · uploaded"}`} />
            {doc.backFileId && <FileThumb id={doc.backFileId} label={`Back${files[doc.backFileId]?.liveCapture ? " · live" : " · uploaded"}`} />}
          </div>
        ) : (
          <p className="mt-4 text-xs text-slate-500">Your role cannot view KYC images.</p>
        )}
      </Card>

      {liveness && (
        <Card title="Liveness challenge" description={`Issued ${liveness.issuedAt.toUTCString()}, captured ${liveness.capturedAt.toUTCString()}`}>
          {canViewFiles ? (
            <div className="grid gap-4 sm:grid-cols-3">
              {liveness.frameIds.map((id, i) => (
                <FileThumb key={id} id={id} label={`${i + 1}. ${liveness.challenge[i]}${files[id]?.liveCapture ? "" : " (uploaded)"}`} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">Your role cannot view KYC images.</p>
          )}
        </Card>
      )}

      {address && (
        <Card title="Current address" actions={address.verified ? <Badge tone="green">Verified</Badge> : <Badge tone="amber">Unverified</Badge>}>
          <p className="text-sm text-slate-100">
            {[address.line1, address.line2, address.city, address.region, address.postalCode, countryName(address.country)].filter(Boolean).join(", ")}
          </p>
          {address.proofFileId && canViewFiles && (
            <div className="mt-4 max-w-xs">
              <FileThumb id={address.proofFileId} label="Proof of address" pdf={files[address.proofFileId]?.mimeType === "application/pdf"} />
            </div>
          )}
        </Card>
      )}

      <Card title="AML screening" actions={aml && <StatusBadge status={aml.result} />}>
        {!aml ? (
          <p className="text-sm text-slate-400">Not screened.</p>
        ) : hits.length === 0 ? (
          <p className="text-sm text-slate-400">No matches for “{aml.screenedName}” on {aml.screenedAt.toUTCString()}.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {hits.map((h) => (
              <li key={h.entryId} className="rounded-xl border border-amber-400/30 bg-amber-400/5 px-3 py-2">
                <span className="font-medium text-amber-100">{h.name}</span> · {h.listSource} · score {h.score}
                {h.dobMatch && <Badge tone="red" className="ml-2">DOB match</Badge>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
