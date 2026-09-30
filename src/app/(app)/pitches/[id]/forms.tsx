"use client";

import { useActionState, useState, type ReactNode } from "react";
import { initialFormState } from "@/lib/form-state";
import { CURRENCIES } from "@/lib/countries";
import { MIN_AMOUNT_PKR, PLATFORM_TERMS, formatMoney, minimumIn } from "@/config/platform";
import { MAX_INVESTOR_EQUITY, costTotal, impliedPreMoney, matchesTarget, milestoneTotal, netOfFee, ownershipAfter, revenueShareTotal } from "@/lib/pitch/deal";
import { COST_CATEGORIES, RISK_CATEGORIES } from "@/lib/pitch/sections";
import { Button, SubmitButton } from "@/components/ui/button";
import { Checkbox, Form, SelectField, TextArea, TextField, YesNo, useFormState } from "@/components/ui/form";
import { RepeaterForm, type RepeaterField } from "@/components/repeater-form";
import { cn } from "@/components/ui/cn";
import { removeFileAction, saveListAction, saveMediaAction, saveSectionAction, submitPitchAction } from "../actions";

type FieldSection = "overview" | "team" | "market" | "model" | "traction" | "ask" | "financials" | "risks";
type ListSection = "team" | "costing" | "roadmap" | "risks" | "financials";
type Row = Record<string, string>;

const n = (v: string | undefined) => (v === undefined || v.trim() === "" ? NaN : Number(v));

/** A section of plain fields, saved as a draft. */
export function SectionForm({ pitchId, section, children, submitLabel = "Save" }: { pitchId: string; section: FieldSection; children: ReactNode; submitLabel?: string }) {
  const [state, action] = useActionState(saveSectionAction.bind(null, pitchId, section), initialFormState);
  return (
    <Form state={state} action={action}>
      {children}
      <SubmitButton pendingText="Saving…">{submitLabel}</SubmitButton>
    </Form>
  );
}

// ─── The proposal, with live deal maths ─────────────────────────────────────────

export function AskForm({ pitchId, defaults }: { pitchId: string; defaults: Row }) {
  const [v, setV] = useState<Row>(defaults);
  const set = (k: string) => (e: { target: { value: string } }) => setV((cur) => ({ ...cur, [k]: e.target.value }));
  const amount = n(v.amount);
  const fee = Number.isFinite(amount) ? netOfFee(amount) : null;
  const equity = n(v.equityPercent);
  const own = ownershipAfter(Number.isFinite(equity) ? equity : null);
  const money = (x: number) => formatMoney(Math.round(x), v.currency);
  const minHint = `At least PKR ${MIN_AMOUNT_PKR.toLocaleString("en-US")}${v.currency !== "PKR" ? ` (≈ ${formatMoney(minimumIn(v.currency), v.currency)})` : ""}`;

  return (
    <SectionForm pitchId={pitchId} section="ask">
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField name="currency" label="Currency" required options={CURRENCIES.map((c) => ({ value: c, label: c }))} defaultValue={defaults.currency} onChange={set("currency")} />
        <TextField name="amount" label="Amount to raise" type="number" min={0} step="any" required defaultValue={defaults.amount} onChange={set("amount")} hint={minHint} />
        <TextField name="minTicket" label="Minimum per investor" type="number" min={0} step="any" required defaultValue={defaults.minTicket} hint={minHint} />
      </div>
      <YesNo name="multipleInvestors" label="Can several investors join this round?" defaultValue={defaults.multipleInvestors !== "no"} />

      {fee && (
        <div className="grid gap-3 rounded-xl border border-brand-400/30 bg-brand-400/5 p-4 text-sm sm:grid-cols-3">
          <p>
            <span className="block text-xs text-slate-400">You raise</span>
            <span className="font-semibold text-white">{money(fee.amount)}</span>
          </p>
          <p>
            <span className="block text-xs text-slate-400">RamiZeeZ fee ({PLATFORM_TERMS.successFeePercent}%)</span>
            <span className="font-semibold text-white">{money(fee.fee)}</span>
          </p>
          <p>
            <span className="block text-xs text-slate-400">Business receives. Your costing must add up to this.</span>
            <span className="font-semibold text-brand-200">{money(fee.net)}</span>
          </p>
        </div>
      )}

      <SelectField
        name="dealType"
        label="Deal structure"
        required
        defaultValue={defaults.dealType}
        onChange={set("dealType")}
        options={[
          { value: "EQUITY", label: "Equity: investors buy shares" },
          { value: "MUSHARAKAH", label: "Musharakah: partnership, shared profit and loss" },
          { value: "MUDARABAH", label: "Mudarabah: investor capital, your expertise, shared profit" },
          { value: "REVENUE_SHARE", label: "Revenue share: repaid from revenue up to a cap" },
        ]}
      />

      {v.dealType === "EQUITY" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name="equityPercent" label="Equity offered to investors (%)" type="number" min={0} max={MAX_INVESTOR_EQUITY} step="0.01" required defaultValue={defaults.equityPercent} onChange={set("equityPercent")} hint={`Up to ${MAX_INVESTOR_EQUITY}%`} />
            <TextField name="valuation" label="Pre-money valuation" type="number" min={0} step="any" required defaultValue={defaults.valuation} onChange={set("valuation")} />
          </div>
          <TextArea name="valuationMethod" label="How did you arrive at this valuation?" required rows={3} defaultValue={defaults.valuationMethod} />
          {Number.isFinite(equity) && equity > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
              <p className="text-xs uppercase tracking-wider text-slate-500">Ownership after the raise</p>
              <div className="mt-2 flex h-3 overflow-hidden rounded-full">
                <span className="bg-brand-400" style={{ width: `${Math.max(own.founders, 0)}%` }} />
                <span className="bg-sky-400" style={{ width: `${own.investors}%` }} />
                <span className="bg-gold-400" style={{ width: `${own.ramizeez}%` }} />
              </div>
              <p className={cn("mt-2", own.founders < 10 ? "text-rose-300" : "text-slate-300")}>
                Founders {own.founders}% · Investors {own.investors}% · RamiZeeZ {own.ramizeez}%
              </p>
              {fee && <p className="mt-1 text-slate-400">Implied pre-money valuation: {money(impliedPreMoney(fee.amount, equity))}</p>}
            </div>
          )}
        </>
      )}

      {(v.dealType === "MUSHARAKAH" || v.dealType === "MUDARABAH") && (
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField name="profitSharePercent" label="Investors' share of profit (%)" type="number" min={1} max={99} step="0.01" required defaultValue={defaults.profitSharePercent} />
          {v.dealType === "MUSHARAKAH" && (
            <TextField name="founderCapital" label="Your capital in the partnership" type="number" min={0} step="any" required defaultValue={defaults.founderCapital} hint="Losses are shared in proportion to capital" />
          )}
          <TextField name="termMonths" label="Partnership term (months)" type="number" min={6} required defaultValue={defaults.termMonths} />
        </div>
      )}
      {v.dealType === "MUDARABAH" && <p className="text-xs text-slate-400">In Mudarabah, financial losses are borne by the investors&apos; capital, unless they come from the founder&apos;s negligence or misconduct.</p>}

      {v.dealType === "REVENUE_SHARE" && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField name="revenueSharePercent" label="Share of monthly revenue (%)" type="number" min={0} max={50} step="0.01" required defaultValue={defaults.revenueSharePercent} />
            <TextField name="returnCapMultiple" label="Repayment cap (× amount raised)" type="number" min={1} max={5} step="0.05" required defaultValue={defaults.returnCapMultiple} onChange={set("returnCapMultiple")} />
            <TextField name="termMonths" label="Maximum term (months)" type="number" min={6} required defaultValue={defaults.termMonths} />
          </div>
          {fee && Number.isFinite(n(v.returnCapMultiple)) && (
            <p className="text-sm text-slate-300">Investors receive at most {money(revenueShareTotal(fee.amount, n(v.returnCapMultiple)))} in total.</p>
          )}
        </>
      )}

      <TextArea name="expectedReturn" label="Expected return for investors" required rows={3} defaultValue={defaults.expectedReturn} />
      <TextArea name="exitOptions" label="Exit or repayment options" required rows={3} defaultValue={defaults.exitOptions} hint="For example: a buy-back after 5 years, a sale, dividends, or repayment from revenue." />
      <TextArea name="nonFinancialAsks" label="What do you need beyond money?" rows={2} defaultValue={defaults.nonFinancialAsks} hint="Mentorship, introductions, RamiZeeZ marketing support…" />
      <p className="text-xs text-slate-400">
        RamiZeeZ also holds a {PLATFORM_TERMS.businessSharePercent}% share in every funded business, in return for managing agreements, execution and marketing.
      </p>
    </SectionForm>
  );
}

// ─── Lists ────────────────────────────────────────────────────────────────────

const opts = (list: readonly (readonly [string, string])[]) => list.map(([value, label]) => ({ value, label }));

const LISTS: Record<ListSection, { fields: RepeaterField[]; itemLabel: string; addLabel: string; minItems: number; maxItems: number; columns?: 2 | 3 | 4 }> = {
  team: {
    itemLabel: "Team member",
    addLabel: "Add team member",
    minItems: 1,
    maxItems: 20,
    columns: 4,
    fields: [
      { name: "name", label: "Name", required: true },
      { name: "role", label: "Role", required: true, placeholder: "CEO, operations…" },
      { name: "commitment", label: "Commitment", type: "select", required: true, options: [{ value: "FULL_TIME", label: "Full time" }, { value: "PART_TIME", label: "Part time" }] },
      { name: "equityPercent", label: "Current equity %", type: "number" },
    ],
  },
  costing: {
    itemLabel: "Cost line",
    addLabel: "Add cost line",
    minItems: 1,
    maxItems: 100,
    columns: 4,
    fields: [
      { name: "category", label: "Category", type: "select", required: true, options: opts(COST_CATEGORIES) },
      { name: "item", label: "Item", required: true, placeholder: "e.g. Commercial oven" },
      { name: "quantity", label: "Quantity", type: "number", required: true },
      { name: "unitCost", label: "Unit cost", type: "number", required: true },
      { name: "timing", label: "When needed", placeholder: "Month 1, monthly…", wide: true },
    ],
  },
  roadmap: {
    itemLabel: "Milestone",
    addLabel: "Add milestone",
    minItems: 1,
    maxItems: 30,
    columns: 4,
    fields: [
      { name: "month", label: "Month after funding", type: "number", required: true },
      { name: "title", label: "Milestone", required: true, placeholder: "Shop opened" },
      { name: "budget", label: "Budget released", type: "number", required: true },
      { name: "owner", label: "Owner" },
      { name: "successMetric", label: "Measurable success metric", required: true, wide: true, placeholder: "500 customers and PKR 1M monthly revenue" },
    ],
  },
  risks: {
    itemLabel: "Risk",
    addLabel: "Add risk",
    minItems: 1,
    maxItems: 30,
    fields: [
      { name: "category", label: "Category", type: "select", required: true, options: opts(RISK_CATEGORIES) },
      { name: "risk", label: "Risk", required: true },
      { name: "mitigation", label: "How you will handle it", type: "textarea", required: true },
    ],
  },
  financials: {
    itemLabel: "Year",
    addLabel: "",
    minItems: 5,
    maxItems: 5,
    columns: 3,
    fields: [
      { name: "revenue", label: "Revenue", type: "number", required: true },
      { name: "costs", label: "Costs", type: "number", required: true },
      { name: "cashFlow", label: "Cash flow", type: "number" },
    ],
  },
};

function Totals({ label, total, target, currency }: { label: string; total: number; target: number | null; currency: string }) {
  const ok = target !== null && matchesTarget(total, target);
  return (
    <div className={cn("rounded-xl border p-4 text-sm", target === null ? "border-white/10" : ok ? "border-brand-400/40 bg-brand-400/5" : "border-amber-400/40 bg-amber-400/5")} aria-live="polite">
      <p className="text-white">
        {label}: <span className="font-mono">{formatMoney(total, currency)}</span>
        {target !== null && (
          <>
            {" "}of <span className="font-mono">{formatMoney(target, currency)}</span> after the RamiZeeZ fee
          </>
        )}
      </p>
      {target === null ? (
        <p className="text-slate-400">Set the amount to raise in “The proposal” first.</p>
      ) : ok ? (
        <p className="text-brand-200">✓ Matches the amount the business receives.</p>
      ) : (
        <p className="text-amber-200">
          {total < target ? `${formatMoney(target - total, currency)} not yet allocated.` : `${formatMoney(total - target, currency)} over.`}
        </p>
      )}
    </div>
  );
}

export function ListForm({ pitchId, section, initial, currency, target }: { pitchId: string; section: ListSection; initial: Row[]; currency: string; target: number | null }) {
  const cfg = LISTS[section];
  const summary =
    section === "costing"
      ? (rows: Row[]) => (
          <Totals label="Cost lines total" currency={currency} target={target} total={costTotal(rows.map((r) => ({ quantity: Number(r.quantity) || 0, unitCost: Number(r.unitCost) || 0 })))} />
        )
      : section === "roadmap"
        ? (rows: Row[]) => <Totals label="Milestone budgets" currency={currency} target={target} total={milestoneTotal(rows.map((r) => ({ budget: Number(r.budget) || 0 })))} />
        : undefined;
  return (
    <RepeaterForm
      action={saveListAction.bind(null, pitchId, section)}
      fields={cfg.fields}
      initial={initial}
      itemLabel={cfg.itemLabel}
      addLabel={cfg.addLabel}
      minItems={cfg.minItems}
      maxItems={cfg.maxItems}
      columns={cfg.columns}
      fixed={section === "financials"}
      rowLabel={section === "financials" ? (_, i) => `Year ${i + 1}` : undefined}
      summary={summary}
    />
  );
}

// ─── Media ────────────────────────────────────────────────────────────────────

type FileRow = { id: string; originalName: string | null };

function FilePicker({ name, label, accept, multiple, hint }: { name: string; label: string; accept: string; multiple?: boolean; hint: string }) {
  const state = useFormState();
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium text-slate-200">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="file"
        accept={accept}
        multiple={multiple}
        className="field-control file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-sm file:text-white"
      />
      {state.errors?.[name] ? <p className="text-xs text-rose-300">{state.errors[name]}</p> : <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function MediaForm({ pitchId, videoUrl, deck, images, documents }: { pitchId: string; videoUrl: string; deck: FileRow | null; images: FileRow[]; documents: FileRow[] }) {
  const [state, action] = useActionState(saveMediaAction.bind(null, pitchId), initialFormState);
  const list = (rows: FileRow[]) =>
    rows.length > 0 && (
      <ul className="space-y-1 text-sm">
        {rows.map((f) => (
          <li key={f.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-1.5">
            <a href={`/api/files/${f.id}`} target="_blank" className="truncate text-brand-300 hover:underline">
              📎 {f.originalName ?? "file"}
            </a>
            <Button type="button" variant="ghost" className="px-2 py-1 text-xs" onClick={() => removeFileAction(pitchId, f.id)}>
              Remove
            </Button>
          </li>
        ))}
      </ul>
    );
  return (
    <Form state={state} action={action}>
      <div className="space-y-2">
        {list(deck ? [deck] : [])}
        <FilePicker name="deck" label={deck ? "Replace pitch deck" : "Pitch deck"} accept="application/pdf" hint="PDF, up to 8 MB. Required." />
      </div>
      <div className="space-y-2">
        {list(images)}
        <FilePicker name="images" label="Product or premises photos" accept="image/jpeg,image/png,image/webp" multiple hint="Up to 6 images." />
      </div>
      <div className="space-y-2">
        {list(documents)}
        <FilePicker name="documents" label="Supporting documents" accept="application/pdf,image/jpeg,image/png,image/webp" multiple hint="Quotations, invoices, licences, letters of intent. Up to 10 files." />
      </div>
      <TextField
        name="videoUrl"
        label="Pitch video link"
        type="url"
        defaultValue={videoUrl}
        placeholder="https://…"
        hint="A 2–5 minute unlisted video (YouTube, Vimeo, Google Drive). It's required before the live Tank session. Keep it unlisted: anyone with the link can watch it."
      />
      <SubmitButton pendingText="Uploading…">Save</SubmitButton>
    </Form>
  );
}

// ─── Submit ───────────────────────────────────────────────────────────────────

export function SubmitForm({ pitchId, disabled }: { pitchId: string; disabled: boolean }) {
  const [state, action] = useActionState(submitPitchAction.bind(null, pitchId), initialFormState);
  return (
    <Form state={state} action={action}>
      <fieldset disabled={disabled} className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <Checkbox name="ownsIdea" label="This idea, business and all the materials are mine (or my team's) to pitch, and don't infringe anyone else's rights." />
        <Checkbox name="truthful" label="All figures and statements are true to the best of my knowledge. I understand misrepresentation ends my listing and can lead to legal action." />
        <Checkbox
          name="acceptTerms"
          label={`I accept the RamiZeeZ terms: a ${PLATFORM_TERMS.successFeePercent}% success fee on the amount raised and a ${PLATFORM_TERMS.businessSharePercent}% share in the business.`}
        />
        <Checkbox name="nonCircumvention" label="I will not deal with investors introduced by RamiZeeZ outside the platform (non-circumvention)." />
      </fieldset>
      <SubmitButton disabled={disabled} className="w-full py-3" pendingText="Submitting…">
        Submit for screening
      </SubmitButton>
    </Form>
  );
}
