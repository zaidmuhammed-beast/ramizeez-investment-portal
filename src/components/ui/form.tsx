"use client";

import { createContext, useContext, useId, useState, type ComponentProps, type ReactNode, type SubmitEvent } from "react";
import type { FormState } from "@/lib/form-state";
import { MAX_SUBMISSION_BYTES, megabytes, totalFileBytes } from "@/lib/client/shrink-image";
import { cn } from "./cn";
import { Alert } from "./alert";

const FormContext = createContext<FormState>({});

export function Form({
  state,
  action,
  children,
  className,
  onSubmit,
  ...props
}: Omit<ComponentProps<"form">, "action"> & { state: FormState; action?: (fd: FormData) => void }) {
  const [tooLarge, setTooLarge] = useState<string>();
  // Uploads over the host's request limit would fail with a bare error page; stop them here instead.
  const guard = (e: SubmitEvent<HTMLFormElement>) => {
    const total = totalFileBytes(new FormData(e.currentTarget));
    if (total > MAX_SUBMISSION_BYTES) {
      e.preventDefault();
      setTooLarge(`These files add up to ${megabytes(total)}. Upload at most ${megabytes(MAX_SUBMISSION_BYTES)} at a time: remove some, or save in smaller batches.`);
      return;
    }
    setTooLarge(undefined);
    onSubmit?.(e);
  };
  return (
    <FormContext.Provider value={state}>
      <form action={action} className={cn("space-y-5", className)} noValidate onSubmit={guard} {...props}>
        {tooLarge && <Alert tone="error">{tooLarge}</Alert>}
        {state.message && (
          <Alert tone={state.ok ? "success" : "error"} role={state.ok ? "status" : "alert"}>
            {state.message}
          </Alert>
        )}
        {state.errors?._form && <Alert tone="error">{state.errors._form}</Alert>}
        {children}
      </form>
    </FormContext.Provider>
  );
}

export const useFormState = () => useContext(FormContext);

function useFieldValue(name: string, fallback?: string | string[]) {
  const state = useFormState();
  return { error: state.errors?.[name], value: state.values?.[name] ?? fallback };
}

export function FieldShell({
  id,
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-200">
        {label}
        {required && <span aria-hidden className="ml-0.5 text-brand-300">*</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-rose-300">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-slate-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type Common = { name: string; label: ReactNode; hint?: ReactNode; className?: string };

export function TextField({ name, label, hint, className, defaultValue, ...props }: Common & Omit<ComponentProps<"input">, "name">) {
  const id = useId();
  const { error, value } = useFieldValue(name, defaultValue as string | undefined);
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={props.required} className={className}>
      <input
        id={id}
        name={name}
        defaultValue={typeof value === "string" ? value : undefined}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className="field-control"
        {...props}
      />
    </FieldShell>
  );
}

export function TextArea({ name, label, hint, className, defaultValue, ...props }: Common & Omit<ComponentProps<"textarea">, "name">) {
  const id = useId();
  const { error, value } = useFieldValue(name, defaultValue as string | undefined);
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={props.required} className={className}>
      <textarea
        id={id}
        name={name}
        rows={4}
        defaultValue={typeof value === "string" ? value : undefined}
        aria-invalid={!!error}
        className="field-control resize-y"
        {...props}
      />
    </FieldShell>
  );
}

export type Option = { value: string; label: string };

export function SelectField({
  name,
  label,
  hint,
  className,
  options,
  placeholder = "Select…",
  defaultValue,
  ...props
}: Common & Omit<ComponentProps<"select">, "name"> & { options: Option[]; placeholder?: string }) {
  const id = useId();
  const { error, value } = useFieldValue(name, defaultValue as string | undefined);
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={props.required} className={className}>
      <select
        // React applies a select's defaultValue only on mount, so remount when the echoed
        // value changes — otherwise the post-submit form reset drops the user's choice.
        key={typeof value === "string" ? value : ""}
        id={id}
        name={name}
        defaultValue={typeof value === "string" ? value : ""}
        aria-invalid={!!error}
        className="field-control"
        {...props}
      >
        {/* Optional selects can be cleared back to the placeholder. */}
        <option value="" disabled={props.required}>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

/** A group of checkboxes submitted under one name (multi-select). */
export function CheckboxGroup({
  name,
  label,
  hint,
  options,
  defaultValue = [],
  columns = 2,
  required,
}: Common & { options: Option[]; defaultValue?: string[]; columns?: 1 | 2 | 3 | 4; required?: boolean }) {
  const { error, value } = useFieldValue(name, defaultValue);
  const selected = new Set(Array.isArray(value) ? value : value ? [value] : []);
  const grid = { 1: "sm:grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4" }[columns];
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-slate-200">
        {label}
        {required && <span aria-hidden className="ml-0.5 text-brand-300">*</span>}
      </legend>
      <div className={cn("grid gap-2", grid)}>
        {options.map((o) => (
          <label
            key={o.value}
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-slate-200 transition hover:border-white/20 has-[:checked]:border-brand-400/70 has-[:checked]:bg-brand-400/10"
          >
            <input type="checkbox" name={name} value={o.value} defaultChecked={selected.has(o.value)} className="size-4 accent-brand-400" />
            {o.label}
          </label>
        ))}
      </div>
      {error ? <p className="text-xs text-rose-300">{error}</p> : hint ? <p className="text-xs text-slate-400">{hint}</p> : null}
    </fieldset>
  );
}

/** Yes/No radio pair. */
export function YesNo({ name, label, defaultValue }: { name: string; label: ReactNode; defaultValue?: boolean }) {
  const { error, value } = useFieldValue(name, defaultValue === undefined ? undefined : defaultValue ? "yes" : "no");
  return (
    <fieldset className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <legend className="sr-only">{label}</legend>
      <span className="max-w-xl text-sm text-slate-200">{label}</span>
      <div className="flex gap-2">
        {(["no", "yes"] as const).map((v) => (
          <label
            key={v}
            className="cursor-pointer rounded-lg border border-white/10 px-3 py-1.5 text-sm capitalize text-slate-300 has-[:checked]:border-brand-400/70 has-[:checked]:bg-brand-400/15 has-[:checked]:text-white"
          >
            <input type="radio" name={name} value={v} defaultChecked={value === v} className="sr-only" />
            {v}
          </label>
        ))}
      </div>
      {error && <p className="w-full text-xs text-rose-300">{error}</p>}
    </fieldset>
  );
}

export function Checkbox({ name, label, defaultChecked }: { name: string; label: ReactNode; defaultChecked?: boolean }) {
  const { error, value } = useFieldValue(name);
  return (
    <div>
      <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-300">
        <input
          type="checkbox"
          name={name}
          value="on"
          defaultChecked={value === "on" || defaultChecked}
          className="mt-0.5 size-4 shrink-0 accent-brand-400"
        />
        <span>{label}</span>
      </label>
      {error && <p className="mt-1 text-xs text-rose-300">{error}</p>}
    </div>
  );
}
