// Commercial terms and limits. Changing a term here? Bump PLATFORM_TERMS.version so
// founders re-accept the new terms, and keep the legal agreements in step.

export const PLATFORM_TERMS = {
  version: "2026-10",
  /** Success fee: share of every amount raised through the platform, deducted when funds are released. */
  successFeePercent: 10,
  /** RamiZeeZ's share in every business funded through the platform. */
  businessSharePercent: 25,
} as const;

/** Minimum raise per pitch and minimum investment per deal, in PKR. */
export const MIN_AMOUNT_PKR = 100_000;

/**
 * Indicative PKR value of one unit of each supported currency, used only to check
 * minimums for investors who budget in foreign currency. Review monthly (or replace with
 * a live FX feed) — they are not used to move money.
 */
export const FX_RATES_PKR: Record<string, number> = {
  PKR: 1,
  USD: 280,
  GBP: 375,
  EUR: 305,
  AED: 76,
  SAR: 75,
  QAR: 77,
  KWD: 915,
  OMR: 728,
  BHD: 745,
  CAD: 205,
  AUD: 185,
  NZD: 168,
  MYR: 66,
  SGD: 217,
  TRY: 7,
  CHF: 350,
  NOK: 27,
  SEK: 27,
  JPY: 1.9,
  CNY: 39,
};
export const FX_RATES_REVIEWED = "2026-09-30";

export const toPkr = (amount: number, currency: string) => amount * (FX_RATES_PKR[currency] ?? NaN);

/** The platform minimum expressed in `currency`, rounded up to a whole unit. */
export const minimumIn = (currency: string) => Math.ceil(MIN_AMOUNT_PKR / (FX_RATES_PKR[currency] ?? NaN));

export const meetsMinimum = (amount: number, currency: string) => toPkr(amount, currency) >= MIN_AMOUNT_PKR;

export const formatMoney = (amount: number, currency: string) => `${currency} ${amount.toLocaleString("en-US")}`;

/** What RamiZeeZ takes from a successful raise. */
export function feeBreakdown(raise: number) {
  const fee = Math.round((raise * PLATFORM_TERMS.successFeePercent) / 100);
  return { raise, fee, netToBusiness: raise - fee, businessSharePercent: PLATFORM_TERMS.businessSharePercent };
}
