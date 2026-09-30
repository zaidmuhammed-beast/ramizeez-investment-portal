"use client";

import { useActionState, useId, useState, type ReactNode } from "react";
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
  maxItems = 20,
  addLabel = "Add another",
  fixed = false,
  columns = 2,
  rowLabel,
  summary,
}: {
  action: (state: FormState, fd: FormData) => Promise<FormState>;
  fields: RepeaterField[];
  initial: Row[];
  itemLabel: string;
  minItems?: number;
  maxItems?: number;
  addLabel?: string;
  /** A fixed set of rows (no add/remove), e.g. five projection years. */
  fixed?: boolean;
  columns?: 2 | 3 | 4;
  rowLabel?: (row: Row, index: number) => string;
  /** Live summary under the rows, e.g. running totals. */
  summary?: (rows: Row[]) => ReactNode;
}) {
  const empty = () => Object.fromEntries(fields.map((f) => [f.name, ""])) as Row;
  const [rows, setRows] = useState<Row[]>(() => {
    const start = [...initial];
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
        <fieldset key={i} className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          {/* The legend must be the fieldset's first child to name the row for assistive tech. */}
          <legend className="float-left mb-4 w-full pr-20 text-sm font-medium text-white">{rowLabel ? rowLabel(row, i) : `${itemLabel} ${i + 1}`}</legend>
          {!fixed && rows.length > minItems && (
            <Button type="button" variant="ghost" className="absolute right-3 top-3 px-2 py-1 text-xs" onClick={() => setRows((r) => r.filter((_, j) => j !== i))}>
              Remove
            </Button>
          )}
          <div className={cn("clear-both grid gap-4", { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[columns])}>
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
                <div key={f.name} className={cn("space-y-1.5", (f.wide || f.type === "textarea") && "sm:col-span-full")}>
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
      {summary?.(rows)}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {fixed ? (
          <span />
        ) : (
          <Button type="button" variant="secondary" onClick={() => setRows((r) => [...r, empty()])} disabled={rows.length >= maxItems}>
            + {addLabel}
          </Button>
        )}
        <SubmitButton pendingText="Saving…">Save</SubmitButton>
      </div>
    </form>
  );
}
