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
  | "outbox.view";

const ALL: Permission[] = [
  "cases.view", "cases.decide.identity", "cases.decide.role", "cases.decide.final", "kyc.files.view",
  "users.view", "users.suspend", "team.manage", "watchlist.manage", "audit.view", "outbox.view",
];

// Least privilege: each team role only gets what its job needs.
const MATRIX: Record<TeamRole, Permission[]> = {
  SUPER_ADMIN: ALL,
  VERIFICATION_OFFICER: ["cases.view", "cases.decide.identity", "cases.decide.role", "kyc.files.view", "users.view", "watchlist.manage", "outbox.view"],
  INVESTMENT_COMMITTEE: ["cases.view", "cases.decide.final", "users.view"],
  DEAL_ANALYST: ["users.view"],
  LEGAL: ["users.view", "audit.view"],
  FINANCE: ["users.view"],
  EXECUTION_MANAGER: ["users.view"],
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
