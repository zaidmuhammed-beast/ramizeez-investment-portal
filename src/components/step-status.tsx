import type { StepStatus } from "@/lib/onboarding";
import { Badge, type BadgeTone } from "./ui/badge";

const MAP: Record<StepStatus, { tone: BadgeTone; label: string }> = {
  locked: { tone: "neutral", label: "Locked" },
  todo: { tone: "violet", label: "To do" },
  in_review: { tone: "blue", label: "In review" },
  needs_info: { tone: "amber", label: "Action needed" },
  rejected: { tone: "red", label: "Rejected" },
  done: { tone: "green", label: "Complete" },
};

export function StepStatusBadge({ status }: { status: StepStatus }) {
  return <Badge tone={MAP[status].tone}>{MAP[status].label}</Badge>;
}
