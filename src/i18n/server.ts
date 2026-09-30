import "server-only";
import { cookies } from "next/headers";
import type { FormState } from "@/lib/form-state";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";
import { en, type Dict } from "./dictionaries/en";
import { ur } from "./dictionaries/ur";

const DICTS: Record<Locale, Dict> = { en, ur };

export async function getLocale(): Promise<Locale> {
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : DEFAULT_LOCALE;
}

export async function getDict(): Promise<Dict> {
  return DICTS[await getLocale()];
}

/** Translates a server message, keeping the English text when there's no translation yet. */
export function translate(dict: Dict, message: string): string {
  const exact = dict.messages[message];
  if (exact) return exact;
  // Messages with numbers ("… in 3 minute(s).") are matched by their pattern.
  for (const [pattern, out] of Object.entries(dict.patterns)) {
    const m = message.match(new RegExp(`^${pattern}$`));
    if (m) return out.replace(/\$(\d)/g, (_, i: string) => m[Number(i)] ?? "");
  }
  return message;
}

/** Localises an action's result (message and field errors) for the current locale. */
export async function localize(state: FormState): Promise<FormState> {
  const dict = await getDict();
  if (dict === en) return state;
  return {
    ...state,
    message: state.message && translate(dict, state.message),
    errors: state.errors && Object.fromEntries(Object.entries(state.errors).map(([k, v]) => [k, translate(dict, v)])),
  };
}
