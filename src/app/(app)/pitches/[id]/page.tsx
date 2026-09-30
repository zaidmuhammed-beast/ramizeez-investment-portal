import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { COUNTRIES } from "@/lib/countries";
import { SECTORS } from "@/lib/taxonomy";
import { toPitchData, type PitchData } from "@/lib/pitch/data";
import { issuesBySection, pitchIssues, type Issue } from "@/lib/pitch/completeness";
import { netOfFee } from "@/lib/pitch/deal";
import { PITCH_STATUS_LABEL, sectionsFor, type PitchSectionKey } from "@/lib/pitch/sections";
import { FOUNDER_EDITABLE, FOUNDER_WITHDRAWABLE } from "@/lib/pitch/workflow";
import { Card, PageHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/button";
import { SelectField, TextArea, TextField } from "@/components/ui/form";
import { PitchView } from "@/components/pitch/pitch-view";
import { PitchStatusBadge } from "@/components/pitch/status-badge";
import { cn } from "@/components/ui/cn";
import { withdrawPitchAction } from "../actions";
import { AccessDecisionButtons, AskForm, ConfidentialityForm, ListForm, MediaForm, SectionForm, SubmitForm } from "./forms";
import { InvestorInterest } from "@/components/pitch/investor-interest";
import { CONFIDENTIAL_CANDIDATES } from "@/lib/investor/disclosure";

export const metadata: Metadata = { title: "Pitch builder" };

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

function IssueList({ issues }: { issues: Issue[] }) {
  if (!issues.length) return null;
  return (
    <Alert tone="warn" className="mb-5">
      <p className="font-medium">Needed before you can submit:</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        {issues.map((i) => (
          <li key={i.message}>{i.message}</li>
        ))}
      </ul>
    </Alert>
  );
}

export default async function PitchBuilderPage({ params, searchParams }: PageProps<"/pitches/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const { s: rawSection } = await searchParams;
  const pitch = await db.pitch.findFirst({
    where: { id, founderId: user.id },
    include: {
      costItems: true,
      milestones: true,
      events: { orderBy: { createdAt: "desc" } },
      submissions: { orderBy: { version: "desc" }, take: 1 },
    },
  });
  if (!pitch) notFound();

  const data = toPitchData(pitch);
  const issues = pitchIssues(data);
  const bySection = issuesBySection(issues);
  const sections = sectionsFor(pitch.type);
  const editable = FOUNDER_EDITABLE.includes(pitch.status);
  const section = rawSection === "submit" || rawSection === "preview" ? rawSection : sections.some((x) => x.key === rawSection) ? (rawSection as PitchSectionKey) : "overview";
  const feedback = pitch.events.find((e) => (e.toStatus === "RETURNED" || e.toStatus === "REJECTED") && e.note);
  const latest = pitch.submissions[0];

  const fileIds = [pitch.deckFileId, ...pitch.imageFileIds, ...pitch.documentFileIds].filter((x): x is string => !!x);
  const fileRows = await db.storedFile.findMany({ where: { id: { in: fileIds }, ownerId: user.id }, select: { id: true, originalName: true, mimeType: true } });
  const files = Object.fromEntries(fileRows.map((f) => [f.id, f]));

  const header = (
    <PageHeader
      title={pitch.title}
      description={editable ? "Fill in each section. Every save is a draft, and nothing is shared until you submit." : "Submitted pitches are locked while RamiZeeZ reviews them."}
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <PitchStatusBadge status={pitch.status} />
          <Link href="/pitches" className="text-sm text-slate-400 hover:text-white">
            All pitches
          </Link>
          {FOUNDER_WITHDRAWABLE.includes(pitch.status) && (
            <form action={withdrawPitchAction.bind(null, pitch.id)}>
              <SubmitButton variant="ghost" className="px-2 py-1 text-xs text-rose-300" pendingText="…">
                Withdraw
              </SubmitButton>
            </form>
          )}
        </div>
      }
    />
  );

  const alerts = (
    <>
      {pitch.status === "RETURNED" && feedback && (
        <Alert tone="warn" className="mb-6">
          <p className="font-medium">RamiZeeZ asked for changes:</p>
          <p className="mt-1 whitespace-pre-line">{feedback.note}</p>
          <p className="mt-2 text-xs">Update the pitch, then submit it again from “Review & submit”.</p>
        </Alert>
      )}
      {pitch.status === "REJECTED" && feedback && (
        <Alert tone="error" className="mb-6">
          <p className="font-medium">This pitch wasn&apos;t accepted.</p>
          <p className="mt-1 whitespace-pre-line">{feedback.note}</p>
        </Alert>
      )}
    </>
  );

  if (!editable || section === "preview") {
    return (
      <>
        {header}
        {alerts}
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <PitchView pitch={data} files={files} />
          <aside className="space-y-6">
            {editable && (
              <Card>
                <Link href={`/pitches/${pitch.id}`} className="text-sm font-medium text-brand-300 hover:text-brand-200">
                  ← Back to editing
                </Link>
              </Card>
            )}
            <Card title="Progress">
              <ol className="space-y-3 text-sm">
                {pitch.events.map((e) => (
                  <li key={e.id}>
                    <p className="text-white">{PITCH_STATUS_LABEL[e.toStatus]}</p>
                    <p className="text-xs text-slate-500">{e.createdAt.toUTCString()}</p>
                    {e.note && e.toStatus !== "RETURNED" && e.toStatus !== "REJECTED" && <p className="text-xs text-slate-400">{e.note}</p>}
                  </li>
                ))}
              </ol>
            </Card>
            {pitch.status === "LISTED" && (
              <InvestorInterest pitchId={pitch.id} audience="FOUNDER" renderDecision={(id) => <AccessDecisionButtons requestId={id} />} />
            )}
            {latest && <FingerprintCard version={latest.version} fingerprint={latest.fingerprint} submittedAt={latest.submittedAt} />}
          </aside>
        </div>
      </>
    );
  }

  const target = data.amount !== null ? netOfFee(data.amount).net : null;
  const current = sections.find((x) => x.key === section);

  return (
    <>
      {header}
      {alerts}
      <div className="grid gap-6 lg:grid-cols-[250px_1fr]">
        <nav className="glass h-fit space-y-1 rounded-2xl p-3" aria-label="Pitch sections">
          {sections.map((x, i) => {
            const open = bySection[x.key]?.length ?? 0;
            const done = open === 0 && pitch.savedSections.includes(x.key);
            return (
              <Link
                key={x.key}
                href={`/pitches/${pitch.id}?s=${x.key}`}
                className={cn("flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition", x.key === section ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white")}
              >
                <span>
                  <span className="mr-2 font-mono text-xs text-slate-600">{i + 1}</span>
                  {x.label}
                </span>
                <span className={cn("text-xs", done ? "text-brand-300" : "text-slate-600")}>{done ? "✓" : open ? open : "•"}</span>
              </Link>
            );
          })}
          <div className="my-2 border-t border-white/10" />
          <Link href={`/pitches/${pitch.id}?s=submit`} className={cn("flex items-center justify-between rounded-xl px-3 py-2.5 text-sm", section === "submit" ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5")}>
            Review & submit
            <span className={cn("text-xs", issues.length ? "text-amber-300" : "text-brand-300")}>{issues.length ? `${issues.length} left` : "Ready"}</span>
          </Link>
          <Link href={`/pitches/${pitch.id}?s=preview`} className="block rounded-xl px-3 py-2.5 text-sm text-slate-400 hover:bg-white/5 hover:text-white">
            Preview the full pitch
          </Link>
        </nav>

        <Card strong title={section === "submit" ? "Review & submit" : current?.label} description={section === "submit" ? "Everything below must be complete. Submitting locks the pitch and records a fingerprint of its contents as proof of authorship." : current?.description}>
          {section !== "submit" && <IssueList issues={bySection[section] ?? []} />}
          <SectionContent section={section} pitchId={pitch.id} data={data} target={target} files={files} />
          {section === "submit" && (
            <div className="space-y-5">
              {issues.length ? (
                <Alert tone="warn">
                  <p className="font-medium">{issues.length} item(s) to complete:</p>
                  <ul className="mt-2 space-y-1">
                    {issues.map((i) => (
                      <li key={`${i.section}-${i.message}`}>
                        <Link href={`/pitches/${pitch.id}?s=${i.section}`} className="underline underline-offset-2">
                          {sections.find((x) => x.key === i.section)?.label}
                        </Link>
                        : {i.message}
                      </li>
                    ))}
                  </ul>
                </Alert>
              ) : (
                <Alert tone="success">Every section is complete.</Alert>
              )}
              {user.tier < 2 && <Alert tone="info">You can submit once your identity is verified and your full profile is complete (Tier 2).</Alert>}
              <SubmitForm pitchId={pitch.id} disabled={issues.length > 0 || user.tier < 2} />
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function FingerprintCard({ version, fingerprint, submittedAt }: { version: number; fingerprint: string; submittedAt: Date }) {
  return (
    <Card title="Proof of authorship" description={`Version ${version}, submitted ${submittedAt.toUTCString()}`}>
      <p className="text-xs text-slate-400">SHA-256 fingerprint of everything you submitted, including your files. Keep it: it proves what you pitched, and when.</p>
      <code className="mt-3 block break-all rounded-lg bg-ink-950/60 p-3 font-mono text-xs text-brand-200" data-testid="pitch-fingerprint">
        {fingerprint}
      </code>
    </Card>
  );
}

function SectionContent({
  section,
  pitchId,
  data: p,
  target,
  files,
}: {
  section: PitchSectionKey | "submit";
  pitchId: string;
  data: PitchData;
  target: number | null;
  files: Record<string, { id: string; originalName: string | null }>;
}) {
  switch (section) {
    case "overview":
      return (
        <SectionForm pitchId={pitchId} section="overview">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name="title" label="Title" required defaultValue={p.title} />
            <SelectField
              name="type"
              label="Stage"
              required
              defaultValue={p.type}
              options={[
                { value: "IDEA", label: "Idea: not operating yet" },
                { value: "EXISTING", label: "Existing, operating business" },
              ]}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField name="sector" label="Sector" required options={SECTORS.map((x) => ({ value: x, label: x }))} defaultValue={s(p.sector)} />
            <SelectField name="country" label="Country" required options={COUNTRIES.map((c) => ({ value: c.code, label: c.name }))} defaultValue={s(p.country)} />
            <TextField name="city" label="City" required defaultValue={s(p.city)} />
          </div>
          <TextField
            name="oneLiner"
            label="One-line summary"
            required
            maxLength={160}
            defaultValue={s(p.oneLiner)}
            hint="Investors see a version of this in the anonymous teaser, so don't reveal your secret sauce or business name here."
          />
          <TextArea name="problem" label="The problem" required rows={4} defaultValue={s(p.problem)} />
          <TextArea name="solution" label="Your solution" required rows={4} defaultValue={s(p.solution)} />
          <TextArea name="whyNow" label="Why now?" required rows={3} defaultValue={s(p.whyNow)} />
        </SectionForm>
      );
    case "team":
      return (
        <div className="space-y-8">
          <SectionForm pitchId={pitchId} section="team" submitLabel="Save experience">
            <TextArea
              name="teamExperience"
              label="Your experience and knowledge of this business"
              required
              rows={6}
              defaultValue={s(p.teamExperience)}
              hint="Years in this industry, relevant jobs or businesses, skills, and why your team will succeed where others haven't."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextArea name="advisors" label="Advisors & mentors" rows={3} defaultValue={s(p.advisors)} />
              <TextArea name="plannedHires" label="Key hires planned" rows={3} defaultValue={s(p.plannedHires)} />
            </div>
          </SectionForm>
          <div>
            <h3 className="mb-3 text-sm font-semibold text-white">Team members</h3>
            <ListForm
              pitchId={pitchId}
              section="team"
              currency={p.currency}
              target={null}
              initial={p.teamMembers.map((m) => ({ name: m.name, role: m.role, commitment: m.commitment, equityPercent: s(m.equityPercent) }))}
            />
          </div>
        </div>
      );
    case "market":
      return (
        <SectionForm pitchId={pitchId} section="market">
          <TextArea name="targetCustomers" label="Target customers" required rows={4} defaultValue={s(p.targetCustomers)} />
          <TextArea name="marketSize" label="Market size (TAM / SAM / SOM) with sources" required rows={4} defaultValue={s(p.marketSize)} />
          <TextArea name="competitors" label="Competitors" required rows={3} defaultValue={s(p.competitors)} />
          <TextArea name="differentiation" label="What makes you different" required rows={3} defaultValue={s(p.differentiation)} />
        </SectionForm>
      );
    case "model":
      return (
        <SectionForm pitchId={pitchId} section="model">
          <TextArea name="revenueModel" label="How the business makes money" required rows={4} defaultValue={s(p.revenueModel)} />
          <TextArea name="pricing" label="Pricing" required rows={3} defaultValue={s(p.pricing)} />
          <TextArea name="unitEconomics" label="Unit economics" required rows={4} defaultValue={s(p.unitEconomics)} hint="Cost to make or deliver one unit, selling price, margin, customer acquisition cost and lifetime value." />
          <TextArea name="channels" label="Sales & marketing channels" required rows={3} defaultValue={s(p.channels)} />
          <TextArea name="partners" label="Key suppliers & partners" rows={3} defaultValue={s(p.partners)} />
        </SectionForm>
      );
    case "traction":
      return (
        <SectionForm pitchId={pitchId} section="traction">
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField name="startedYear" label="Year started" type="number" required defaultValue={s(p.startedYear)} />
            <TextField name="employees" label="Employees" type="number" min={0} required defaultValue={s(p.employees)} />
            <TextField name="customers" label="Customers" type="number" min={0} defaultValue={s(p.customers)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField name="revenueLast12" label={`Revenue, last 12 months (${p.currency})`} type="number" min={0} step="any" required defaultValue={s(p.revenueLast12)} />
            <TextField name="expensesLast12" label={`Expenses, last 12 months (${p.currency})`} type="number" min={0} step="any" required defaultValue={s(p.expensesLast12)} />
            <TextField name="monthlyRevenue" label={`Current monthly revenue (${p.currency})`} type="number" min={0} step="any" defaultValue={s(p.monthlyRevenue)} />
          </div>
          <TextArea name="tractionNotes" label="Traction & growth" required rows={4} defaultValue={s(p.tractionNotes)} />
          <TextArea name="liabilities" label="Loans, debts & other liabilities" rows={3} defaultValue={s(p.liabilities)} />
          <TextArea name="existingInvestors" label="Existing investors & shareholders" rows={3} defaultValue={s(p.existingInvestors)} />
        </SectionForm>
      );
    case "ask":
      return (
        <AskForm
          pitchId={pitchId}
          defaults={{
            currency: p.currency,
            amount: s(p.amount),
            minTicket: s(p.minTicket),
            multipleInvestors: p.multipleInvestors ? "yes" : "no",
            dealType: s(p.dealType),
            equityPercent: s(p.equityPercent),
            valuation: s(p.valuation),
            valuationMethod: s(p.valuationMethod),
            profitSharePercent: s(p.profitSharePercent),
            founderCapital: s(p.founderCapital),
            revenueSharePercent: s(p.revenueSharePercent),
            returnCapMultiple: s(p.returnCapMultiple),
            termMonths: s(p.termMonths),
            expectedReturn: s(p.expectedReturn),
            exitOptions: s(p.exitOptions),
            nonFinancialAsks: s(p.nonFinancialAsks),
          }}
        />
      );
    case "costing":
      return (
        <ListForm
          pitchId={pitchId}
          section="costing"
          currency={p.currency}
          target={target}
          initial={p.costItems.map((c) => ({ category: c.category, item: c.item, quantity: s(c.quantity), unitCost: s(c.unitCost), timing: s(c.timing) }))}
        />
      );
    case "roadmap":
      return (
        <ListForm
          pitchId={pitchId}
          section="roadmap"
          currency={p.currency}
          target={target}
          initial={p.milestones.map((m) => ({ month: s(m.month), title: m.title, successMetric: m.successMetric, budget: s(m.budget), owner: s(m.owner) }))}
        />
      );
    case "financials":
      return (
        <div className="space-y-8">
          <ListForm
            pitchId={pitchId}
            section="financials"
            currency={p.currency}
            target={null}
            initial={[1, 2, 3, 4, 5].map((year) => {
              const y = p.projections.find((x) => x.year === year);
              return { year: String(year), revenue: s(y?.revenue), costs: s(y?.costs), cashFlow: s(y?.cashFlow) };
            })}
          />
          <SectionForm pitchId={pitchId} section="financials" submitLabel="Save assumptions">
            <TextArea name="projectionAssumptions" label="Assumptions behind these numbers" required rows={5} defaultValue={s(p.projectionAssumptions)} hint="Growth rates, prices, number of customers or outlets, and cost increases." />
          </SectionForm>
        </div>
      );
    case "risks":
      return (
        <div className="space-y-8">
          <ListForm pitchId={pitchId} section="risks" currency={p.currency} target={null} initial={p.risks.map((r) => ({ category: r.category, risk: r.risk, mitigation: r.mitigation }))} />
          <SectionForm pitchId={pitchId} section="risks" submitLabel="Save plan">
            <TextArea name="failurePlan" label="If the business fails, what happens to investors' money?" required rows={4} defaultValue={s(p.failurePlan)} hint="Assets that could be sold, insurance, personal guarantees, or how any remaining funds are returned." />
          </SectionForm>
        </div>
      );
    case "media":
      return (
        <MediaForm
          pitchId={pitchId}
          videoUrl={s(p.videoUrl)}
          deck={p.deckFileId && files[p.deckFileId] ? files[p.deckFileId] : null}
          images={p.imageFileIds.map((id) => files[id]).filter(Boolean)}
          documents={p.documentFileIds.map((id) => files[id]).filter(Boolean)}
        />
      );
    case "confidentiality":
      return (
        <ConfidentialityForm pitchId={pitchId} selected={p.confidentialFields} options={CONFIDENTIAL_CANDIDATES.map(([value, label]) => ({ value, label }))} />
      );
    default:
      return null;
  }
}
