export const SECTORS = [
  "Agriculture & livestock", "Food & beverage", "Retail & e-commerce", "Textiles & apparel", "Manufacturing",
  "Technology & software", "Fintech", "Education", "Healthcare", "Real estate & construction", "Logistics & transport",
  "Energy & renewables", "Tourism & hospitality", "Media & entertainment", "Beauty & personal care", "Services", "Other",
] as const;

export const STAGES = [
  ["IDEA", "Idea / pre-launch"],
  ["EARLY", "Early revenue"],
  ["GROWTH", "Growing business"],
  ["ESTABLISHED", "Established business"],
] as const;

export const GEOGRAPHIES = ["Pakistan", "GCC", "United Kingdom", "Europe", "North America", "Asia-Pacific", "Africa", "Global"] as const;

export const DEAL_TYPES = [
  ["EQUITY", "Equity", "Ownership shares in the business"],
  ["MUSHARAKAH", "Musharakah", "Shariah partnership: shared capital, profit and loss"],
  ["MUDARABAH", "Mudarabah", "Shariah: investor capital, founder expertise, shared profit"],
  ["REVENUE_SHARE", "Revenue share", "Returns paid from a share of revenue"],
] as const;

export const INVESTOR_TYPES = [
  ["INDIVIDUAL", "Individual"],
  ["HIGH_NET_WORTH", "High-net-worth individual"],
  ["COMPANY", "Company"],
  ["FUND", "Fund"],
  ["FAMILY_OFFICE", "Family office"],
] as const;

export const SOURCES_OF_FUNDS = [
  ["SALARY", "Salary / employment income"],
  ["BUSINESS", "Business profits"],
  ["INVESTMENTS", "Investment returns"],
  ["PROPERTY", "Sale of property"],
  ["INHERITANCE", "Inheritance / gift"],
  ["SAVINGS", "Personal savings"],
  ["REMITTANCE", "Overseas earnings / remittance"],
  ["OTHER", "Other"],
] as const;

export const INCOME_BANDS = ["Under USD 25k", "USD 25k–75k", "USD 75k–150k", "USD 150k–500k", "Over USD 500k"] as const;
export const NET_WORTH_BANDS = ["Under USD 100k", "USD 100k–500k", "USD 500k–2M", "USD 2M–10M", "Over USD 10M"] as const;

export const ENTITY_TYPES = [
  ["SOLE_PROPRIETOR", "Sole proprietorship"],
  ["PARTNERSHIP", "Partnership / AOP"],
  ["PRIVATE_LIMITED", "Private limited company"],
  ["LLP", "LLP"],
  ["OTHER", "Other"],
] as const;

export const opts = (list: readonly (readonly [string, string, ...string[]])[]) => list.map(([value, label]) => ({ value, label }));
export const plainOpts = (list: readonly string[]) => list.map((v) => ({ value: v, label: v }));
