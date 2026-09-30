export type FormState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
  /** Echo of submitted values so fields keep their content after a failed submit. */
  values?: Record<string, string | string[]>;
  /** Free-form extra data returned by an action (e.g. a dev OTP code). */
  data?: Record<string, unknown>;
};

export const initialFormState: FormState = {};

export function formValues(fd: FormData): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const key of new Set(fd.keys())) {
    if (key.startsWith("$") || key === "password" || key === "confirmPassword") continue;
    const all = fd.getAll(key).filter((v): v is string => typeof v === "string");
    if (all.length === 0) continue;
    out[key] = all.length > 1 ? all : all[0];
  }
  return out;
}
