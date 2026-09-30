import { countries } from "countries-list";

export type Country = { code: string; name: string; dial: string };

export const COUNTRIES: Country[] = Object.entries(countries)
  .map(([code, c]) => ({ code, name: c.name, dial: c.phone[0] ? `+${c.phone[0]}` : "" }))
  .sort((a, b) => a.name.localeCompare(b.name));

export const COUNTRY_CODES = new Set(COUNTRIES.map((c) => c.code));

export const countryName = (code: string) => COUNTRIES.find((c) => c.code === code)?.name ?? code;

export const CURRENCIES = [
  "PKR", "USD", "GBP", "EUR", "AED", "SAR", "QAR", "KWD", "OMR", "BHD",
  "CAD", "AUD", "NZD", "MYR", "SGD", "TRY", "CHF", "NOK", "SEK", "JPY", "CNY",
] as const;
