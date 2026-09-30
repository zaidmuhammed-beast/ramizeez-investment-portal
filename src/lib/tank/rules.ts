// Tank session rules: timing, seats and interest. Pure and unit-tested.

export const JOIN_OPENS_MIN = 15; // the join link works this long before the start…
export const JOIN_GRACE_MIN = 15; // …and this long after the scheduled end
export const MAX_PITCHES = 6;

export type Phase = "UPCOMING" | "OPENING" | "LIVE" | "ENDED" | "COMPLETED" | "CANCELLED";

export type Timing = { startsAt: Date; durationMin: number; status: "SCHEDULED" | "COMPLETED" | "CANCELLED" };

const min = 60_000;
export const endsAt = (s: Timing) => new Date(s.startsAt.getTime() + s.durationMin * min);

export function tankPhase(s: Timing, now: Date): Phase {
  if (s.status === "CANCELLED") return "CANCELLED";
  if (s.status === "COMPLETED") return "COMPLETED";
  const t = now.getTime();
  const start = s.startsAt.getTime();
  if (t < start - JOIN_OPENS_MIN * min) return "UPCOMING";
  if (t < start) return "OPENING";
  if (t < endsAt(s).getTime()) return "LIVE";
  return "ENDED";
}

/** The join link works from shortly before the start until shortly after the end. */
export function joinWindowOpen(s: Timing, now: Date): boolean {
  const phase = tankPhase(s, now);
  if (phase === "OPENING" || phase === "LIVE") return true;
  return phase === "ENDED" && now.getTime() < endsAt(s).getTime() + JOIN_GRACE_MIN * min;
}

export type SeatInput = {
  isInvestor: boolean;
  tier: number;
  ready: boolean;
  /** Pitches in the session this investor may see (matched to their budget, or already unlocked). */
  eligiblePitches: number;
  phase: Phase;
  existing: "REQUESTED" | "APPROVED" | "DECLINED" | "CANCELLED" | null;
};

/** Why this investor can't request a seat, or null. */
export function seatBlocker(s: SeatInput): string | null {
  if (!s.isInvestor) return "Only investors can request a seat.";
  if (s.tier < 4 || !s.ready) return "Tank sessions are open to RamiZeeZ-approved (Tier 4) investors.";
  if (s.phase === "CANCELLED") return "This session was cancelled.";
  if (s.phase !== "UPCOMING" && s.phase !== "OPENING") return "Seat requests are closed for this session.";
  if (s.existing === "REQUESTED" || s.existing === "APPROVED") return "You've already requested a seat.";
  if (s.existing === "DECLINED") return "Your seat request for this session was declined.";
  if (s.eligiblePitches === 0) return "None of this session's pitches match your verified budget and preferences.";
  return null;
}

export function approveSeatBlocker(approved: number, capacity: number, phase: Phase): string | null {
  if (phase === "CANCELLED" || phase === "COMPLETED") return "This session is closed.";
  if (approved >= capacity) return `All ${capacity} seats are taken. Raise the capacity or decline a request first.`;
  return null;
}

/** "I'm in" is allowed while the session runs and until it is marked complete, for attendees only. */
export function interestBlocker(i: { phase: Phase; joined: boolean; amount: number; minTicket: number; maxAmount: number }): string | null {
  if (i.phase !== "LIVE" && i.phase !== "ENDED") return "Interest opens when the session starts.";
  if (!i.joined) return "Join the session first.";
  if (!(i.amount > 0)) return "Enter an amount";
  if (i.amount < i.minTicket) return "That's below this pitch's minimum investment.";
  if (i.amount > i.maxAmount) return "That's more than the round, or your verified budget, allows.";
  return null;
}

export function scheduleErrors(s: { title: string; startsAt: Date; durationMin: number; capacity: number; pitchIds: string[] }, now: Date): Record<string, string> {
  const out: Record<string, string> = {};
  if (s.title.trim().length < 5) out.title = "At least 5 characters";
  if (Number.isNaN(s.startsAt.getTime())) out.startsAt = "Choose a date and time";
  else if (s.startsAt.getTime() < now.getTime() + 60 * min) out.startsAt = "Schedule at least an hour ahead";
  if (!Number.isInteger(s.durationMin) || s.durationMin < 15 || s.durationMin > 240) out.durationMin = "Between 15 and 240 minutes";
  if (!Number.isInteger(s.capacity) || s.capacity < 1 || s.capacity > 500) out.capacity = "Between 1 and 500";
  if (s.pitchIds.length < 1) out.pitchIds = "Choose at least one listed pitch";
  else if (s.pitchIds.length > MAX_PITCHES) out.pitchIds = `At most ${MAX_PITCHES} pitches per session`;
  return out;
}
