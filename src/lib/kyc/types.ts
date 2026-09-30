export type CheckStatus = "PASS" | "WARN" | "FAIL" | "MANUAL";

export type CheckResult = {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
};

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export function riskFrom(checks: CheckResult[]): RiskLevel {
  if (checks.some((c) => c.status === "FAIL")) return "HIGH";
  if (checks.some((c) => c.status === "WARN")) return "MEDIUM";
  return "LOW";
}

export const LIVENESS_PROMPTS = [
  "Look straight at the camera",
  "Turn your head slightly to the left",
  "Turn your head slightly to the right",
  "Tilt your head up a little",
  "Smile",
  "Blink slowly, then look at the camera",
] as const;
