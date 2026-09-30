// Screening pipeline rules. Pure, so they can be unit-tested and shown in the UI.
import type { PitchStatus } from "@prisma/client";

export type PitchPermission = "pitches.screen" | "pitches.approve";

/** Moves the RamiZeeZ team can make, and who can make them. */
export const TEAM_TRANSITIONS: Partial<Record<PitchStatus, { to: PitchStatus; permission: PitchPermission; label: string }[]>> = {
  SUBMITTED: [
    { to: "SCREENING", permission: "pitches.screen", label: "Start screening" },
    { to: "RETURNED", permission: "pitches.screen", label: "Return to founder" },
  ],
  SCREENING: [
    { to: "DUE_DILIGENCE", permission: "pitches.screen", label: "Move to due diligence" },
    { to: "RETURNED", permission: "pitches.screen", label: "Return to founder" },
    { to: "REJECTED", permission: "pitches.screen", label: "Reject" },
  ],
  DUE_DILIGENCE: [
    { to: "COMMITTEE", permission: "pitches.screen", label: "Send to committee" },
    { to: "RETURNED", permission: "pitches.screen", label: "Return to founder" },
    { to: "REJECTED", permission: "pitches.screen", label: "Reject" },
  ],
  COMMITTEE: [
    { to: "LISTED", permission: "pitches.approve", label: "Approve & list" },
    { to: "RETURNED", permission: "pitches.approve", label: "Return to founder" },
    { to: "REJECTED", permission: "pitches.approve", label: "Reject" },
  ],
};

export const FOUNDER_EDITABLE: PitchStatus[] = ["DRAFT", "RETURNED"];
export const FOUNDER_WITHDRAWABLE: PitchStatus[] = ["DRAFT", "RETURNED", "SUBMITTED", "SCREENING", "DUE_DILIGENCE", "COMMITTEE"];
export const IN_REVIEW: PitchStatus[] = ["SUBMITTED", "SCREENING", "DUE_DILIGENCE", "COMMITTEE"];

export const SCORE_CRITERIA = [
  ["team", "Team & experience"],
  ["market", "Market opportunity"],
  ["model", "Business model"],
  ["financials", "Financials & costing"],
  ["roadmap", "Execution roadmap"],
  ["risk", "Risk management"],
] as const;

export type Scores = Record<(typeof SCORE_CRITERIA)[number][0], number>;

/** Scorecard total as a percentage (each criterion scored 1–5). */
export const scorePercent = (s: Scores) => Math.round((SCORE_CRITERIA.reduce((sum, [k]) => sum + s[k], 0) / (SCORE_CRITERIA.length * 5)) * 100);

export const DILIGENCE_ITEMS = [
  ["identity", "Founder and co-founder identities verified (Tier 4)"],
  ["documents", "Registration, tax and supporting documents checked"],
  ["financials", "Financial statements and bank statements match the pitch"],
  ["costing", "Cost lines checked against quotations or market prices"],
  ["legal", "No legal disputes, liens or IP ownership problems found"],
  ["references", "References and key customers or suppliers contacted"],
] as const;

export type Diligence = Record<(typeof DILIGENCE_ITEMS)[number][0], boolean>;

export type TransitionContext = {
  from: PitchStatus;
  to: PitchStatus;
  actorId: string;
  note?: string;
  hasScreeningReview: boolean;
  diligenceComplete: boolean;
  founderTier: number;
  teaser?: string | null;
  /** Team members who scored the pitch or ran due diligence (four-eyes rule at committee). */
  earlierReviewerIds: string[];
};

/** Returns why a move isn't allowed, or null if it is. */
export function transitionBlocker(c: TransitionContext): string | null {
  const allowed = TEAM_TRANSITIONS[c.from]?.some((t) => t.to === c.to);
  if (!allowed) return `A pitch can't move from ${c.from} to ${c.to}.`;
  if ((c.to === "RETURNED" || c.to === "REJECTED") && !c.note?.trim()) return "Write feedback for the founder. They will see it.";
  if (c.to === "DUE_DILIGENCE" && !c.hasScreeningReview) return "Save a screening scorecard first.";
  if (c.to === "COMMITTEE" && !c.diligenceComplete) return "Complete every due-diligence check first.";
  if (c.to === "LISTED") {
    if (c.founderTier < 4) return "The founder must be RamiZeeZ Verified (Tier 4) before the pitch can be listed.";
    if (!c.teaser || c.teaser.trim().length < 40) return "Write the anonymous investor teaser (at least 40 characters) before listing.";
    if (c.earlierReviewerIds.includes(c.actorId)) return "You screened or ran due diligence on this pitch. A different committee member must approve the listing.";
  }
  return null;
}
