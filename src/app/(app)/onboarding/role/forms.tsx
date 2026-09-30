"use client";

import { useActionState, useState, type ReactNode } from "react";
import { initialFormState } from "@/lib/form-state";
import { CURRENCIES } from "@/lib/countries";
import { DEAL_TYPES, ENTITY_TYPES, GEOGRAPHIES, INCOME_BANDS, INVESTOR_TYPES, NET_WORTH_BANDS, SECTORS, SOURCES_OF_FUNDS, STAGES, opts, plainOpts } from "@/lib/taxonomy";
import { RISK_QUESTIONS, ENTITY_INVESTOR_TYPES } from "@/lib/kyc/role-checks";
import { SubmitButton } from "@/components/ui/button";
import { CheckboxGroup, Form, SelectField, TextArea, TextField, YesNo, useFormState, type Option } from "@/components/ui/form";
import { saveFounderAction, saveInvestorAction } from "./actions";

type Defaults = Record<string, string | string[]>;
type FileRow = { id: string; originalName: string | null };

const s = (d: Defaults, k: string) => (typeof d[k] === "string" ? (d[k] as string) : undefined);
const a = (d: Defaults, k: string) => (Array.isArray(d[k]) ? (d[k] as string[]) : undefined);

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4 border-t border-white/10 pt-6 first:border-0 first:pt-0">
      <legend className="mb-2 text-sm font-semibold uppercase tracking-wider text-brand-300">{title}</legend>
      {children}
    </fieldset>
  );
}

function FileInput({ name, label, hint, existing, multiple = true }: { name: string; label: string; hint?: string; existing?: FileRow[]; multiple?: boolean }) {
  const state = useFormState();
  const error = state.errors?.[name];
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium text-slate-200">
        {label}
      </label>
      {!!existing?.length && (
        <ul className="space-y-1 text-xs text-slate-400">
          {existing.map((f) => (
            <li key={f.id}>
              📎{" "}
              <a href={`/api/files/${f.id}`} target="_blank" className="text-brand-300 hover:underline">
                {f.originalName ?? "document"}
              </a>
            </li>
          ))}
        </ul>
      )}
      <input
        id={name}
        name={name}
        type="file"
        multiple={multiple}
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="field-control file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-sm file:text-white"
      />
      {error ? <p className="text-xs text-rose-300">{error}</p> : hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

const currencyOptions: Option[] = CURRENCIES.map((c) => ({ value: c, label: c }));

export function InvestorForm({
  defaults,
  disabled,
  existingFiles,
}: {
  defaults: Defaults;
  disabled: boolean;
  existingFiles: { proofOfFunds: FileRow[]; entityDocs: FileRow[] };
}) {
  const [state, action] = useActionState(saveInvestorAction, initialFormState);
  const [type, setType] = useState(s(defaults, "investorType") ?? "");
  const isEntity = (ENTITY_INVESTOR_TYPES as readonly string[]).includes(type);
  return (
    <Form state={state} action={action}>
      <fieldset disabled={disabled} className="space-y-6">
        <Section title="Investor type & budget">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField name="investorType" label="I am investing as" required options={opts(INVESTOR_TYPES)} defaultValue={s(defaults, "investorType")} onChange={(e) => setType(e.target.value)} />
            <SelectField name="currency" label="Currency" required options={currencyOptions} defaultValue={s(defaults, "currency")} />
          </div>
          {isEntity && (
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField name="entityName" label="Entity name" required defaultValue={s(defaults, "entityName")} />
              <TextField name="entityRegNumber" label="Registration number" required defaultValue={s(defaults, "entityRegNumber")} />
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField name="declaredBudget" label="Total budget for the platform" type="number" min={0} step="any" required defaultValue={s(defaults, "declaredBudget")} />
            <TextField name="ticketMin" label="Minimum per deal" type="number" min={0} step="any" required defaultValue={s(defaults, "ticketMin")} />
            <TextField name="ticketMax" label="Maximum per deal" type="number" min={0} step="any" required defaultValue={s(defaults, "ticketMax")} />
          </div>
        </Section>

        <Section title="Source of funds & wealth">
          <CheckboxGroup name="sourceOfFunds" label="Where will the invested money come from?" required options={opts(SOURCES_OF_FUNDS)} defaultValue={a(defaults, "sourceOfFunds")} />
          <TextArea name="sourceOfWealth" label="How did you build your overall wealth?" required defaultValue={s(defaults, "sourceOfWealth")} hint="For example: 15 years as an engineer in the UAE, plus the sale of a property in Lahore in 2022." />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField name="annualIncomeBand" label="Annual income" required options={plainOpts(INCOME_BANDS)} defaultValue={s(defaults, "annualIncomeBand")} />
            <SelectField name="netWorthBand" label="Net worth" required options={plainOpts(NET_WORTH_BANDS)} defaultValue={s(defaults, "netWorthBand")} />
          </div>
          <FileInput
            name="proofOfFunds"
            label="Proof of funds"
            existing={existingFiles.proofOfFunds}
            hint="A bank statement or balance certificate from the last 3 months, or a wealth statement / tax return. PDF or photo."
          />
          {isEntity && <FileInput name="entityDocs" label="Entity documents" existing={existingFiles.entityDocs} hint="Certificate of incorporation, ownership register and board resolution." />}
        </Section>

        <Section title="Experience & preferences">
          <TextArea name="experience" label="Your investment experience" required defaultValue={s(defaults, "experience")} hint="Previous investments, sectors, outcomes, and any board or advisory roles." />
          <CheckboxGroup name="sectors" label="Sectors you're interested in" required options={plainOpts(SECTORS)} columns={3} defaultValue={a(defaults, "sectors")} />
          <CheckboxGroup name="stages" label="Business stages" required options={opts(STAGES)} columns={2} defaultValue={a(defaults, "stages")} />
          <CheckboxGroup name="dealTypes" label="Deal structures you accept" required options={opts(DEAL_TYPES)} columns={2} defaultValue={a(defaults, "dealTypes")} />
          <CheckboxGroup name="geographies" label="Where the business can be" required options={plainOpts(GEOGRAPHIES)} columns={4} defaultValue={a(defaults, "geographies")} />
          <YesNo name="shariahOnly" label="Show me only Shariah-compliant opportunities" defaultValue={s(defaults, "shariahOnly") === "yes"} />
        </Section>

        <Section title="Risk questionnaire">
          <YesNo name="understandsLoss" label="I understand that investing in private businesses can mean losing all the money I invest." defaultValue={defaults.understandsLoss ? true : undefined} />
          <YesNo name="understandsIlliquidity" label="I understand my money may be locked in for several years and can't easily be withdrawn." defaultValue={defaults.understandsIlliquidity ? true : undefined} />
          {(Object.entries(RISK_QUESTIONS) as [keyof typeof RISK_QUESTIONS, (typeof RISK_QUESTIONS)[keyof typeof RISK_QUESTIONS]][]).map(([key, q]) => (
            <SelectField key={key} name={key} label={q.label} required options={q.options.map(([value, label]) => ({ value, label }))} defaultValue={s(defaults, key)} />
          ))}
        </Section>
      </fieldset>
      {!disabled && <SubmitButton pendingText="Saving…">Save investor profile</SubmitButton>}
    </Form>
  );
}

export function FounderForm({
  defaults,
  disabled,
  countries,
  existingFiles,
}: {
  defaults: Defaults;
  disabled: boolean;
  countries: Option[];
  existingFiles: FileRow[];
}) {
  const [state, action] = useActionState(saveFounderAction, initialFormState);
  const [stage, setStage] = useState(s(defaults, "stage") ?? "");
  const existing = stage === "EXISTING";
  return (
    <Form state={state} action={action}>
      <fieldset disabled={disabled} className="space-y-6">
        <Section title="Business">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              name="stage"
              label="Stage"
              required
              defaultValue={s(defaults, "stage")}
              onChange={(e) => setStage(e.target.value)}
              options={[
                { value: "IDEA", label: "Idea: not operating yet" },
                { value: "EXISTING", label: "Existing, operating business" },
              ]}
            />
            <TextField name="businessName" label="Business name" required={existing} defaultValue={s(defaults, "businessName")} hint={existing ? undefined : "Optional at idea stage. Only RamiZeeZ staff can see it."} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField name="sector" label="Sector" required options={plainOpts(SECTORS)} defaultValue={s(defaults, "sector")} />
            <SelectField name="country" label="Country" required options={countries} defaultValue={s(defaults, "country")} />
            <TextField name="city" label="City" required defaultValue={s(defaults, "city")} />
          </div>
          <CheckboxGroup name="preferredDealTypes" label="Deal structures you are open to" required options={opts(DEAL_TYPES)} defaultValue={a(defaults, "preferredDealTypes")} />
          <TextArea name="coFounders" label="Co-founders" rows={3} defaultValue={s(defaults, "coFounders")} hint="Name, role and equity for each. Every co-founder must also create and verify an account." />
        </Section>
        {existing && (
          <Section title="Registration & financials">
            <div className="grid gap-4 sm:grid-cols-3">
              <SelectField name="entityType" label="Legal form" required options={opts(ENTITY_TYPES)} defaultValue={s(defaults, "entityType")} />
              <TextField name="registrationNumber" label="Registration number" required defaultValue={s(defaults, "registrationNumber")} hint="SECP number or foreign equivalent" />
              <TextField name="taxNumber" label="Tax number (NTN / VAT)" defaultValue={s(defaults, "taxNumber")} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField name="foundedYear" label="Year founded" type="number" defaultValue={s(defaults, "foundedYear")} />
              <TextField name="employees" label="Employees" type="number" min={0} defaultValue={s(defaults, "employees")} />
            </div>
            <FileInput name="registrationDocs" label="Registration certificate / partnership deed" existing={existingFiles} />
            <FileInput name="taxDocs" label="Tax registration" />
            <FileInput name="bankStatements" label="Business bank statements (last 6–12 months)" />
            <FileInput name="financials" label="Financial statements (P&L, balance sheet)" />
          </Section>
        )}
        {!existing && existingFiles.length > 0 && <FileInput name="registrationDocs" label="Supporting documents" existing={existingFiles} />}
        <Section title="Your commitment">
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <TextField name="personalCapital" label="Your own money already put in, or committed" type="number" min={0} step="any" defaultValue={s(defaults, "personalCapital")} />
            <SelectField name="currency" label="Currency" required options={currencyOptions} defaultValue={s(defaults, "currency")} />
          </div>
        </Section>
      </fieldset>
      {!disabled && <SubmitButton pendingText="Saving…">Save founder profile</SubmitButton>}
    </Form>
  );
}
