import { PITCH_STATUS_LABEL } from "@/lib/pitch/sections";
import { Badge, type BadgeTone } from "@/components/ui/badge";

const TONE: Record<string, BadgeTone> = {
  DRAFT: "neutral",
  SUBMITTED: "blue",
  SCREENING: "blue",
  DUE_DILIGENCE: "blue",
  COMMITTEE: "violet",
  LISTED: "gold",
  RETURNED: "amber",
  REJECTED: "red",
  WITHDRAWN: "neutral",
};

export function PitchStatusBadge({ status }: { status: string }) {
  return <Badge tone={TONE[status] ?? "neutral"}>{PITCH_STATUS_LABEL[status] ?? status}</Badge>;
}
