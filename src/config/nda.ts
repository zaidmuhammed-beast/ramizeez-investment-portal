// Deal-specific NDA shown to investors before a pitch summary unlocks.
// DRAFT wording — to be replaced with the text approved by RamiZeeZ's legal team.
// Changing the wording? Bump the version: signatures record the version and a hash of the exact text.
import { BRAND } from "./brand";

export const NDA_VERSION = "2026-10-draft";

export function ndaText(opts: { pitchRef: string; investorName: string; date: string }): string[] {
  return [
    `Mutual Non-Disclosure and Non-Circumvention Agreement: opportunity ${opts.pitchRef}`,
    `This agreement is made on ${opts.date} between ${opts.investorName} ("the Investor") and RamiZeeZ, on its own behalf and on behalf of the founder of opportunity ${opts.pitchRef} ("the Founder"), through ${BRAND.name}.`,
    "1. Confidential information. Everything disclosed about the opportunity, including the business idea, plans, financials, costing, roadmap, documents, and the identity of the Founder, is confidential. It is disclosed only so the Investor can evaluate an investment.",
    "2. Use. The Investor will use confidential information only to evaluate this opportunity. The Investor will not use it to start, fund, advise or help any competing business, directly or indirectly.",
    "3. No disclosure. The Investor will not share confidential information with anyone except professional advisers who are bound by equal confidentiality duties. The Investor is responsible for any breach by those advisers.",
    "4. No copies. The Investor will not copy, photograph, record, download for redistribution, or reverse-engineer any confidential material. The Investor accepts that documents are watermarked with their identity and that every view is logged.",
    `5. Non-circumvention. For 24 months, the Investor will not contact, negotiate with or invest in the Founder or the business except through ${BRAND.name}. Any transaction made in breach of this clause is subject to RamiZeeZ's full fees, plus damages.`,
    "6. Duration. These obligations last for 3 years from today, or until the information becomes public through no fault of the Investor.",
    "7. Remedies. A breach may cause irreparable harm. The Founder and RamiZeeZ may seek injunctions in addition to damages, and the Investor's account may be suspended.",
    "8. Governing law. This agreement is governed by the laws of Pakistan, unless RamiZeeZ's platform terms state otherwise.",
  ];
}

export const TANK_NDA_VERSION = "tank-2026-10-draft";

/** One NDA covering every pitch in a live Tank session, signed when requesting a seat. */
export function tankNdaText(opts: { sessionTitle: string; pitchRefs: string[]; investorName: string; date: string }): string[] {
  return [
    `Tank session confidentiality agreement: "${opts.sessionTitle}"`,
    `This agreement is made on ${opts.date} between ${opts.investorName} ("the Investor") and RamiZeeZ, on its own behalf and on behalf of the founders pitching in this session (opportunities ${opts.pitchRefs.join(", ")}), through ${BRAND.name}.`,
    "1. Everything shown or said in the session, and everything later disclosed about these opportunities, is confidential and subject to the same terms as the platform's deal NDA: use only to evaluate an investment, no disclosure, and no copies.",
    "2. No recording. The Investor will not record, screenshot, photograph or stream the session. RamiZeeZ may record it for the attendees and its own records.",
    "3. The join link is personal. The Investor will not share it or let anyone else watch.",
    `4. Non-circumvention. For 24 months, the Investor will not contact, negotiate with or invest in any of these founders or businesses except through ${BRAND.name}.`,
    "5. The Founder of each opportunity may let attending investors into the full data room after the session. This agreement applies to everything in it.",
    "6. Governing law. This agreement is governed by the laws of Pakistan, unless RamiZeeZ's platform terms state otherwise.",
  ];
}
