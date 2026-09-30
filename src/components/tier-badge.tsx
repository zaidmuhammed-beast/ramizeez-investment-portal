import { Badge } from "./ui/badge";

export const TIER_LABELS = ["Registered", "Identity verified", "Profile complete", "Role verified", "RamiZeeZ Verified"];

export function TierBadge({ tier, labels = TIER_LABELS, word = "Tier" }: { tier: number; labels?: string[]; word?: string }) {
  return (
    <Badge tone={tier >= 4 ? "gold" : tier >= 1 ? "green" : "neutral"}>
      {tier >= 4 && "★ "}
      {word} {tier}: {labels[tier]}
    </Badge>
  );
}
