"use client";

import { useActionState, useId, useState } from "react";
import type { FormState } from "@/lib/form-state";
import { initialFormState } from "@/lib/form-state";
import { Alert } from "./ui/alert";
import { Button, SubmitButton } from "./ui/button";
import { cn } from "./ui/cn";

export type RepeaterField = {
  name: string;
  label: string;
  type?: "text" | "number" | "email" | "tel" | "textarea" | "select";
  options?: { value: string; label: string }[];
  required?: boolean;
  wide?: boolean;
  placeholder?: string;
};

type Row = Record<string, string>;

/** Edits a list of records (education, jobs, references…) and submits them together as JSON. */
export function RepeaterForm({
  action,
  fields,
  initial,
  itemLabel,
  minItems = 0,
  addLabel = "Add another",
}: {
  action: (state: FormState, fd: FormData) => Promise<FormState>;
  fields: RepeaterField[];
  initial: Row[];
  itemLabel: string;
  minItems?: number;
  addLabel?: string;
}) {
  const empty = () => Object.fromEntries(fields.map((f) => [f.name, ""])) as Row;
  const [rows, setRows] = useState<Row[]>(() => {
    const start = initial.length ? initial : [];
    while (start.length < Math.max(minItems, 1)) start.push(empty());
    return start;
  });
  const [state, formAction] = useActionState(action, initialFormState);
  const baseId = useId();

  const update = (i: number, name: string, value: string) => setRows((r) => r.map((row, j) => (j === i ? { ...row, [name]: value } : row)));

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.message && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}
      {state.errors?._form && <Alert tone="error">{state.errors._form}</Alert>}
      <input type="hidden" name="items" value={JSON.stringify(rows)} />
      {rows.map((row, i) => (
        <fieldset key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-4 flex items-center justify-between">
            <legend className="text-sm font-medium text-white">
              {itemLabel} {i + 1}
            </legend>
            {rows.length > minItems && (
              <Button type="button" variant="ghost" className="px-2 py-1 text-xs" onClick={() => setRows((r) => r.filter((_, j) => j !== i))}>
                Remove
              </Button>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((f) => {
              const id = `${baseId}-${i}-${f.name}`;
              const error = state.errors?.[`items.${i}.${f.name}`];
              const common = {
                id,
                value: row[f.name] ?? "",
                "aria-invalid": !!error,
                className: "field-control",
                placeholder: f.placeholder,
              };
              return (
                <div key={f.name} className={cn("space-y-1.5", (f.wide || f.type === "textarea") && "sm:col-span-2")}>
                  <label htmlFor={id} className="block text-sm font-medium text-slate-200">
                    {f.label}
                    {f.required && <span aria-hidden className="ml-0.5 text-brand-300">*</span>}
                  </label>
                  {f.type === "textarea" ? (
                    <textarea rows={3} {...common} onChange={(e) => update(i, f.name, e.target.value)} />
                  ) : f.type === "select" ? (
                    <select {...common} onChange={(e) => update(i, f.name, e.target.value)}>
                      <option value="">Select…</option>
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input type={f.type ?? "text"} {...common} onChange={(e) => update(i, f.name, e.target.value)} />
                  )}
                  {error && <p className="text-xs text-rose-300">{error}</p>}
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="secondary" onClick={() => setRows((r) => [...r, empty()])} disabled={rows.length >= 20}>
          + {addLabel}
        </Button>
        <SubmitButton pendingText="Saving…">Save</SubmitButton>
      </div>
    </form>
  );
}
