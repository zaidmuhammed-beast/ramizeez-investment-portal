import type { Phase } from "@/lib/tank/rules";
import { Badge, type BadgeTone } from "@/components/ui/badge";

export const PHASE: Record<Phase, { tone: BadgeTone; label: string }> = {
  UPCOMING: { tone: "blue", label: "Upcoming" },
  OPENING: { tone: "gold", label: "Starting soon" },
  LIVE: { tone: "green", label: "● Live now" },
  ENDED: { tone: "violet", label: "Ended" },
  COMPLETED: { tone: "neutral", label: "Completed" },
  CANCELLED: { tone: "red", label: "Cancelled" },
};

export const PhasePill = ({ phase }: { phase: Phase }) => <Badge tone={PHASE[phase].tone}>{PHASE[phase].label}</Badge>;

export const SEAT: Record<string, { tone: BadgeTone; label: string }> = {
  REQUESTED: { tone: "blue", label: "Seat requested" },
  APPROVED: { tone: "green", label: "Seat confirmed" },
  DECLINED: { tone: "red", label: "Not offered a seat" },
  CANCELLED: { tone: "neutral", label: "Seat given up" },
};

export const SLOT: Record<string, { tone: BadgeTone; label: string }> = {
  INVITED: { tone: "blue", label: "Awaiting founder" },
  CONFIRMED: { tone: "green", label: "Confirmed" },
  DECLINED: { tone: "red", label: "Declined" },
};

/** A join button that goes through the audited redirect, so the room link never appears in the page. */
export function JoinButton({ sessionId, label = "Join the session" }: { sessionId: string; label?: string }) {
  return (
    <a href={`/api/tank/${sessionId}/join`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-400 to-teal-300 px-5 py-2.5 text-sm font-semibold text-ink-950 shadow-lg shadow-brand-500/20 transition hover:brightness-110">
      ▶ {label}
    </a>
  );
}
