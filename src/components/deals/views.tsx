import type { ReactNode } from "react";
import type { DealDocument, DocumentSignature, EscrowEntry, MilestoneClaim, OfferRevision, PitchMilestone } from "@prisma/client";
import { formatMoney } from "@/config/platform";
import { describeTerms, type DealType, type OfferTerms } from "@/lib/deals/offers";
import { balance, releaseAmount, releasedFor } from "@/lib/deals/escrow";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";

const n = (d: unknown) => Number(d ?? 0);

export const OFFER_STATUS: Record<string, { tone: BadgeTone; label: string }> = {
  AWAITING_FOUNDER: { tone: "blue", label: "Waiting for founder" },
  AWAITING_INVESTOR: { tone: "violet", label: "Waiting for investor" },
  ACCEPTED: { tone: "green", label: "Accepted" },
  DECLINED: { tone: "red", label: "Declined" },
  WITHDRAWN: { tone: "neutral", label: "Withdrawn" },
};

export const DEAL_STATUS: Record<string, { tone: BadgeTone; label: string }> = {
  OPEN: { tone: "blue", label: "Collecting commitments" },
  COMMITTED: { tone: "violet", label: "Committed: agreements & deposits" },
  FUNDED: { tone: "green", label: "Funded: in execution" },
  COMPLETED: { tone: "gold", label: "Completed" },
  CANCELLED: { tone: "red", label: "Cancelled" },
};

export function StatusPill({ map, status }: { map: Record<string, { tone: BadgeTone; label: string }>; status: string }) {
  return <Badge tone={map[status]?.tone ?? "neutral"}>{map[status]?.label ?? status}</Badge>;
}

/** The negotiation history of one offer. Names are replaced by roles for founders. */
export function OfferThread({ revisions, dealType, currency }: { revisions: OfferRevision[]; dealType: DealType; currency: string }) {
  const verb: Record<string, string> = { OFFER: "offered", COUNTER: "countered with", ACCEPT: "accepted", DECLINE: "declined", WITHDRAW: "withdrew" };
  return (
    <ol className="space-y-3">
      {revisions.map((r) => (
        <li key={r.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
          <p className="text-white">
            <span className="font-medium">{r.by === "INVESTOR" ? "Investor" : "Founder"}</span> {verb[r.action] ?? r.action}{" "}
            {(r.action === "OFFER" || r.action === "COUNTER") && (
              <>
                {formatMoney(n(r.amount), currency)}: {describeTerms(dealType, r.terms as OfferTerms, currency)}
              </>
            )}
          </p>
          {r.conditions && (r.action === "OFFER" || r.action === "COUNTER") && <p className="mt-1 text-slate-400">Conditions: {r.conditions}</p>}
          {r.note && <p className="mt-1 text-slate-300">“{r.note}”</p>}
          <p className="mt-1 text-xs text-slate-500">{r.createdAt.toUTCString()}</p>
        </li>
      ))}
    </ol>
  );
}

const PARTIES = [
  ["INVESTOR", "Investor"],
  ["FOUNDER", "Founder"],
  ["RAMIZEEZ", "RamiZeeZ"],
] as const;

/** A term sheet or agreement, its signatures, and (optionally) a signing form. */
export function DocumentCard({ doc, sign }: { doc: DealDocument & { signatures: DocumentSignature[] }; sign?: ReactNode }) {
  return (
    <Card
      title={doc.title}
      description={`${doc.kind === "TERM_SHEET" ? "Term sheet" : "Investment agreement"} · issued ${doc.createdAt.toISOString().slice(0, 10)} · template ${doc.templateVersion}`}
      actions={<Badge tone={doc.status === "SIGNED" ? "green" : doc.status === "VOID" ? "red" : "blue"}>{doc.status === "SIGNED" ? "Signed by all" : doc.status === "VOID" ? "Void" : "Awaiting signatures"}</Badge>}
    >
      <ul className="grid gap-2 sm:grid-cols-3">
        {PARTIES.map(([party, label]) => {
          const s = doc.signatures.find((x) => x.party === party);
          return (
            <li key={party} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
              <p className="text-xs text-slate-400">{label}</p>
              {s ? <p className="mt-1 text-brand-200">✓ {s.typedName}</p> : <p className="mt-1 text-slate-500">Not signed</p>}
              {s && <p className="text-[11px] text-slate-500">{s.signedAt.toISOString().slice(0, 16).replace("T", " ")} UTC</p>}
            </li>
          );
        })}
      </ul>
      <details className="mt-4 rounded-xl border border-white/10 bg-ink-950/40 p-4">
        <summary className="cursor-pointer text-sm text-slate-300">Read the full text</summary>
        <div className="mt-3 max-h-96 space-y-3 overflow-y-auto whitespace-pre-line text-sm text-slate-300">{doc.body}</div>
      </details>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <a href={`/api/deals/documents/${doc.id}`} target="_blank" className="text-brand-300 hover:underline">
          Download PDF
        </a>
        <span className="font-mono">SHA-256 {doc.bodyHash.slice(0, 16)}…</span>
      </div>
      {sign && doc.status === "SIGNING" && <div className="mt-5 border-t border-white/10 pt-5">{sign}</div>}
    </Card>
  );
}

const ENTRY_LABEL: Record<string, string> = { DEPOSIT: "Deposit", FEE: "RamiZeeZ fee", RELEASE: "Release", REFUND: "Refund" };

export function EscrowLedger({
  entries,
  currency,
  actions,
  describe,
}: {
  entries: EscrowEntry[];
  currency: string;
  actions?: (entry: EscrowEntry) => ReactNode;
  describe?: (entry: EscrowEntry) => string | null;
}) {
  const bal = balance(entries.map((e) => ({ ...e, amount: n(e.amount) })));
  return (
    <div>
      <p className="text-sm text-slate-400">
        Balance in escrow: <span className="font-mono text-lg text-white">{formatMoney(bal, currency)}</span>
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="pb-2 pr-3 font-medium">Entry</th>
              <th className="pb-2 pr-3 text-right font-medium">Amount</th>
              <th className="pb-2 font-medium">Status</th>
              {actions && <th className="pb-2" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="py-2 pr-3 text-white">
                  {ENTRY_LABEL[e.type]} <span className="whitespace-nowrap text-xs text-slate-500">{e.createdAt.toISOString().slice(0, 10)}</span>
                  {describe?.(e) && <span className="block text-xs text-slate-500">{describe(e)}</span>}
                  {e.reference && <span className="block text-xs text-slate-500">Ref {e.reference}</span>}
                </td>
                <td className={`whitespace-nowrap py-2 pr-3 text-right font-mono ${e.type === "DEPOSIT" ? "text-brand-200" : "text-slate-200"}`}>
                  {e.type === "DEPOSIT" ? "+" : "−"}
                  {n(e.amount).toLocaleString("en-US")}
                </td>
                <td className="py-2">
                  <Badge tone={e.status === "POSTED" ? "green" : e.status === "PENDING" ? "amber" : "red"}>{e.status === "PENDING" ? "Awaiting approval" : e.status.toLowerCase()}</Badge>
                </td>
                {actions && <td className="py-2 text-right">{e.status === "PENDING" && actions(e)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        {!entries.length && <p className="py-3 text-sm text-slate-500">No entries yet.</p>}
      </div>
    </div>
  );
}

export function MilestoneProgress({
  milestones,
  claims,
  entries,
  target,
  funded,
  currency,
  renderAction,
}: {
  milestones: PitchMilestone[];
  claims: MilestoneClaim[];
  entries: EscrowEntry[];
  target: number;
  funded: number;
  currency: string;
  renderAction?: (m: PitchMilestone, claim: MilestoneClaim | undefined) => ReactNode;
}) {
  const plain = entries.map((e) => ({ ...e, amount: n(e.amount) }));
  return (
    <ol className="space-y-4">
      {[...milestones]
        .sort((a, b) => a.position - b.position)
        .map((m) => {
          const due = releaseAmount(n(m.budget), funded || target, target);
          const released = releasedFor(plain, m.id);
          const claim = [...claims].filter((c) => c.milestoneId === m.id).sort((a, b) => +b.createdAt - +a.createdAt)[0];
          const done = released >= due - 0.01;
          return (
            <li key={m.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-white">
                  <span className="font-mono text-brand-200">Month {m.month}</span> · {m.title}
                </p>
                {done ? (
                  <Badge tone="green">Released</Badge>
                ) : claim ? (
                  <Badge tone={claim.status === "APPROVED" ? "violet" : claim.status === "SUBMITTED" ? "blue" : "amber"}>
                    {claim.status === "APPROVED" ? "Approved: release pending" : claim.status === "SUBMITTED" ? "Evidence under review" : "More evidence needed"}
                  </Badge>
                ) : (
                  <Badge tone="neutral">Not started</Badge>
                )}
              </div>
              <p className="mt-1 text-slate-400">
                Success: {m.successMetric} · Release {formatMoney(due, currency)}
                {released > 0 && !done && ` (${formatMoney(released, currency)} released)`}
              </p>
              {claim && <p className="mt-2 whitespace-pre-line text-slate-300">Evidence: {claim.evidence}</p>}
              {claim?.reviewNote && <p className="mt-1 text-amber-200">Review: {claim.reviewNote}</p>}
              {renderAction && !done && <div className="mt-3">{renderAction(m, claim)}</div>}
            </li>
          );
        })}
    </ol>
  );
}
