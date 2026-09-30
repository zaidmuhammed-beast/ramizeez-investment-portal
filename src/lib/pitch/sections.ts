// Pitch builder sections, in order. Client-safe (no server imports).

export const PITCH_SECTIONS = [
  { key: "overview", label: "Overview", description: "What the business is, the problem it solves, and why now." },
  { key: "team", label: "Team & experience", description: "Why this team can execute it: your experience and knowledge of this business." },
  { key: "market", label: "Market & competition", description: "Who the customers are, how big the market is, and who else serves it." },
  { key: "model", label: "Business model", description: "How the business makes money, and what each sale earns." },
  { key: "traction", label: "Current status", description: "Only for operating businesses: the last 12 months, customers and liabilities.", existingOnly: true },
  { key: "ask", label: "The proposal", description: "How much you are raising, the deal structure, and what investors get." },
  { key: "costing", label: "Costing", description: "An itemised use of funds. It must add up to what the business receives after the RamiZeeZ fee." },
  { key: "roadmap", label: "Execution roadmap", description: "Measurable milestones. Once funded, investor money is released against these." },
  { key: "financials", label: "Financial projections", description: "Five years of revenue, costs and cash flow, with your assumptions." },
  { key: "risks", label: "Risks", description: "What could go wrong, what you will do about it, and what happens if it fails." },
  { key: "media", label: "Deck & media", description: "Pitch deck, product photos, supporting documents and a pitch video." },
] as const;

export type PitchSectionKey = (typeof PITCH_SECTIONS)[number]["key"];

export const sectionsFor = (type: "IDEA" | "EXISTING") =>
  PITCH_SECTIONS.filter((s) => !("existingOnly" in s && s.existingOnly) || type === "EXISTING");

export const COST_CATEGORIES = [
  ["CAPEX", "Equipment & capex"],
  ["OPEX", "Rent & operating costs"],
  ["INVENTORY", "Inventory & raw materials"],
  ["SALARIES", "Salaries"],
  ["MARKETING", "Marketing"],
  ["TECHNOLOGY", "Technology"],
  ["LEGAL", "Legal & licences"],
  ["CONTINGENCY", "Contingency"],
  ["OTHER", "Other"],
] as const;

export const RISK_CATEGORIES = [
  ["MARKET", "Market"],
  ["OPERATIONAL", "Operational"],
  ["REGULATORY", "Regulatory"],
  ["TEAM", "Team"],
  ["FINANCIAL", "Financial"],
  ["OTHER", "Other"],
] as const;

export const PITCH_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  SCREENING: "Screening",
  DUE_DILIGENCE: "Due diligence",
  COMMITTEE: "Investment committee",
  LISTED: "Listed",
  RETURNED: "Changes requested",
  REJECTED: "Not accepted",
  WITHDRAWN: "Withdrawn",
};
