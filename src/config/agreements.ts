// Term sheet and agreement templates. DRAFT wording for RamiZeeZ's legal (and, for
// Musharakah/Mudarabah, Shariah) advisers to replace. Changing a template? Bump the version.
import { BRAND } from "./brand";
import { PLATFORM_TERMS, formatMoney } from "./platform";
import { describeTerms, type DealType, type OfferTerms } from "@/lib/deals/offers";

export const AGREEMENT_TEMPLATE_VERSION = "2026-10-draft";

export type DocContext = {
  ref: string;
  businessTitle: string;
  founderName: string;
  investorName: string;
  amount: number;
  currency: string;
  dealType: DealType;
  terms: OfferTerms;
  conditions: string | null;
  milestones: { month: number; title: string; budget: number }[];
  date: string;
};

const money = (c: DocContext, n: number) => formatMoney(n, c.currency);

const STRUCTURE_CLAUSES: Record<DealType, (c: DocContext) => string[]> = {
  EQUITY: (c) => [
    `The Investor subscribes for shares representing ${c.terms.equityPercent}% of the Company on a fully diluted basis, at a pre-money valuation of ${money(c, c.terms.valuation ?? 0)}.`,
    "The Investor has standard pre-emption and information rights and tag-along rights. Drag-along applies on a sale approved by holders of 75% of the shares.",
  ],
  MUSHARAKAH: (c) => [
    `The Investor and the Founder form a Musharakah partnership. The Investor contributes ${money(c, c.amount)} of capital.`,
    `Profits are shared ${c.terms.profitSharePercent}% to the Investor and ${100 - (c.terms.profitSharePercent ?? 0)}% to the Founder. Losses are borne in proportion to each partner's capital. No partner is guaranteed a fixed return.`,
    `The partnership runs for ${c.terms.termMonths} months. The Founder may buy the Investor's share progressively (diminishing Musharakah) at a fair value agreed at the time of each purchase.`,
  ],
  MUDARABAH: (c) => [
    `The Investor (rabb-ul-mal) provides ${money(c, c.amount)} of capital, and the Founder (mudarib) provides management and expertise.`,
    `Profits are shared ${c.terms.profitSharePercent}% to the Investor and ${100 - (c.terms.profitSharePercent ?? 0)}% to the Founder. Financial losses are borne by the capital, unless they result from the Founder's negligence, misconduct or breach of these terms.`,
    `The Mudarabah runs for ${c.terms.termMonths} months.`,
  ],
  REVENUE_SHARE: (c) => [
    `The Company pays the Investor ${c.terms.revenueSharePercent}% of its monthly gross revenue until the Investor has received ${c.terms.returnCapMultiple}× the amount invested (${money(c, c.amount * (c.terms.returnCapMultiple ?? 1))}), or for ${c.terms.termMonths} months, whichever comes first.`,
    "Payments are made monthly, within 15 days of month end, through RamiZeeZ, with a revenue statement.",
  ],
};

const common = (c: DocContext) => [
  `Platform terms: RamiZeeZ receives a success fee of ${PLATFORM_TERMS.successFeePercent}% of the amount invested, deducted from escrow when the round is funded, and holds a ${PLATFORM_TERMS.businessSharePercent}% share in the business. It manages agreements, execution and marketing.`,
  `Escrow: the Investor pays ${money(c, c.amount)} into the escrow account designated by RamiZeeZ. The funds are released to the business against the milestones below once RamiZeeZ has verified each one:`,
  ...c.milestones.map((m, i) => `   ${i + 1}. Month ${m.month}: ${m.title}. Budget ${money(c, m.budget)} (scaled to the amount raised).`),
  `Non-circumvention: for 24 months, neither party will deal with the other in relation to this business except through ${BRAND.name}.`,
  ...(c.conditions ? [`Special conditions: ${c.conditions}`] : []),
];

export function termSheetText(c: DocContext): string {
  return [
    `TERM SHEET: ${c.ref} (${c.businessTitle})`,
    `Date: ${c.date}. This term sheet is not binding, except for the confidentiality, non-circumvention and exclusivity clauses. Definitive terms are set out in the investment agreement.`,
    `Investor: ${c.investorName}. Founder: ${c.founderName}. Facilitator: RamiZeeZ, through ${BRAND.name}.`,
    `Investment: ${money(c, c.amount)}. Structure: ${describeTerms(c.dealType, c.terms, c.currency)}.`,
    ...STRUCTURE_CLAUSES[c.dealType](c),
    ...common(c),
    "Exclusivity: the Founder will not accept conflicting offers for this allocation for 30 days while the definitive agreement is prepared.",
    "Governing law: Pakistan, unless RamiZeeZ's platform terms state otherwise.",
  ].join("\n\n");
}

const AGREEMENT_TITLE: Record<DealType, string> = {
  EQUITY: "SHARE SUBSCRIPTION AGREEMENT",
  MUSHARAKAH: "MUSHARAKAH AGREEMENT",
  MUDARABAH: "MUDARABAH AGREEMENT",
  REVENUE_SHARE: "REVENUE SHARE AGREEMENT",
};

export function agreementText(c: DocContext): string {
  return [
    `${AGREEMENT_TITLE[c.dealType]}: ${c.ref} (${c.businessTitle})`,
    `This agreement is made on ${c.date} between ${c.investorName} ("the Investor"), ${c.founderName} on behalf of the business ("the Founder"), and RamiZeeZ ("the Facilitator"). It is binding once signed by all three.`,
    `1. Investment. The Investor invests ${money(c, c.amount)} on these terms: ${describeTerms(c.dealType, c.terms, c.currency)}.`,
    ...STRUCTURE_CLAUSES[c.dealType](c).map((t, i) => `${i + 2}. ${t}`),
    ...common(c),
    "Reporting: the Founder provides monthly progress and financial reports through the platform. The Investor may inspect the books on reasonable notice.",
    "Warranties: the Founder warrants that the pitch, the financials and the documents provided are true and complete. Misrepresentation entitles the Investor to rescind and recover any unreleased funds.",
    "Default: if a milestone isn't met within 90 days of its target date, RamiZeeZ may pause further releases. With the Investor's consent, it may return unreleased funds.",
    "Disputes: the parties will first try mediation through RamiZeeZ, then arbitration in Lahore under the Arbitration Act 1940, unless RamiZeeZ's platform terms state otherwise.",
  ].join("\n\n");
}
