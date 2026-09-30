import "server-only";
import { redirect } from "next/navigation";
import type { CaseKind, TeamRole } from "@prisma/client";
import { requireUser, type CurrentUser } from "./session";

export type Permission =
  | "cases.view"
  | "cases.decide.identity"
  | "cases.decide.role"
  | "cases.decide.final"
  | "kyc.files.view"
  | "users.view"
  | "users.suspend"
  | "team.manage"
  | "watchlist.manage"
  | "audit.view"
  | "outbox.view"
  | "pitches.view"
  | "pitches.screen"
  | "pitches.approve"
  | "deals.view"
  | "deals.moderate"
  | "deals.legal"
  | "deals.execution"
  | "escrow.record"
  | "escrow.approve";

const ALL: Permission[] = [
  "cases.view", "cases.decide.identity", "cases.decide.role", "cases.decide.final", "kyc.files.view",
  "users.view", "users.suspend", "team.manage", "watchlist.manage", "audit.view", "outbox.view",
  "pitches.view", "pitches.screen", "pitches.approve",
  "deals.view", "deals.moderate", "deals.legal", "deals.execution", "escrow.record", "escrow.approve",
];

// Least privilege: each team role only gets what its job needs.
const MATRIX: Record<TeamRole, Permission[]> = {
  SUPER_ADMIN: ALL,
  VERIFICATION_OFFICER: ["cases.view", "cases.decide.identity", "cases.decide.role", "kyc.files.view", "users.view", "watchlist.manage", "outbox.view"],
  INVESTMENT_COMMITTEE: ["cases.view", "cases.decide.final", "users.view", "pitches.view", "pitches.approve", "deals.view"],
  DEAL_ANALYST: ["users.view", "pitches.view", "pitches.screen", "deals.view", "deals.moderate"],
  LEGAL: ["users.view", "audit.view", "pitches.view", "deals.view", "deals.legal"],
  // Finance can both record and approve, but never approve an entry they recorded themselves.
  FINANCE: ["users.view", "pitches.view", "deals.view", "escrow.record", "escrow.approve"],
  EXECUTION_MANAGER: ["users.view", "pitches.view", "deals.view", "deals.execution"],
  MARKETING: [],
  SUPPORT: ["users.view", "outbox.view"],
};

/** Which permission is needed to decide each kind of verification case. */
export const DECIDE_PERMISSION: Record<CaseKind, Permission> = {
  IDENTITY: "cases.decide.identity",
  ROLE: "cases.decide.role",
  FINAL: "cases.decide.final",
};

export function can(user: Pick<CurrentUser, "roles" | "teamRole">, permission: Permission): boolean {
  if (!user.roles.includes("TEAM") || !user.teamRole) return false;
  return MATRIX[user.teamRole].includes(permission);
}

export async function requireTeam(permission?: Permission): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.roles.includes("TEAM") || !user.teamRole) redirect("/dashboard");
  if (permission && !can(user, permission)) redirect("/admin?denied=1");
  return user;
}

export const TEAM_ROLE_LABELS: Record<TeamRole, string> = {
  SUPER_ADMIN: "Super Admin",
  VERIFICATION_OFFICER: "Verification Officer",
  DEAL_ANALYST: "Deal Analyst",
  INVESTMENT_COMMITTEE: "Investment Committee",
  LEGAL: "Legal",
  FINANCE: "Finance",
  EXECUTION_MANAGER: "Execution Manager",
  MARKETING: "Marketing",
  SUPPORT: "Support",
};
