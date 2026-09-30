import { Badge } from "./ui/badge";

export const TIER_LABELS = ["Registered", "Identity verified", "Profile complete", "Role verified", "RamiZeeZ Verified"];

export function TierBadge({ tier }: { tier: number }) {
  return (
    <Badge tone={tier >= 4 ? "gold" : tier >= 1 ? "green" : "neutral"}>
      {tier >= 4 && "★ "}Tier {tier}: {TIER_LABELS[tier]}
    </Badge>
  );
}
