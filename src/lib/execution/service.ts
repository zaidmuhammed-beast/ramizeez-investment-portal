import "server-only";
import type { CampaignStatus, TaskArea, TaskStatus } from "@prisma/client";
import { db } from "../db";
import { env } from "../env";
import { audit } from "../audit";
import { sendMessage } from "../messaging";
import { can } from "../auth/rbac";
import type { CurrentUser } from "../auth/session";
import { pitchRef, stripContactDetails } from "../investor/disclosure";
import { campaignErrors, duePeriods, HEALTH_LABEL, healthError, periodLabel, reportErrors, reportSchedule, type Health, type ReportInput } from "./rules";

export class ExecutionError extends Error {}
const fail = (msg: string): never => {
  throw new ExecutionError(msg);
};
const url = (path: string) => `${env().APP_URL}${path}`;

async function email(userId: string, subject: string, body: (firstName: string) => string) {
  const u = await db.user.findUnique({ where: { id: userId }, select: { email: true, firstName: true } });
  if (u) await sendMessage("EMAIL", u.email, subject, body(u.firstName));
}

const IN_EXECUTION = ["FUNDED", "COMPLETED"] as const;

async function dealFor(dealId: string) {
  const deal = await db.deal.findUnique({ where: { id: dealId }, include: { pitch: true } });
  if (!deal) fail("Round not found.");
  if (!IN_EXECUTION.includes(deal!.status as (typeof IN_EXECUTION)[number])) fail("Execution starts once the round is funded.");
  return deal!;
}

const investorsOf = (pitchId: string) => db.offer.findMany({ where: { pitchId, status: "ACCEPTED" }, select: { id: true, investorId: true } });

// ─── Manager & health ─────────────────────────────────────────────────────────

export async function assignManager(user: CurrentUser, dealId: string, managerId: string) {
  if (!can(user, "deals.execution")) fail("Your role can't assign execution managers.");
  const deal = await dealFor(dealId);
  const manager = await db.user.findUnique({ where: { id: managerId } });
  if (!manager || !can(manager, "deals.execution") || manager.status !== "ACTIVE") fail("Choose an active team member who manages execution.");
  await db.deal.update({ where: { id: dealId }, data: { managerId } });
  await audit("execution.manager.assigned", { actorId: user.id, targetType: "Deal", targetId: dealId, metadata: { managerId } });
  await email(deal.pitch.founderId, `Your RamiZeeZ execution manager: ${pitchRef(deal.pitchId)}`, (n) => `Hello ${n}, ${manager!.firstName} ${manager!.lastName} is now your execution manager at RamiZeeZ. See your plan and tasks at ${url(`/pitches/${deal.pitchId}/deal`)}.`);
}

export async function setHealth(user: CurrentUser, dealId: string, health: Health, note: string | null) {
  if (!can(user, "deals.execution")) fail("Your role can't change a company's status.");
  const deal = await dealFor(dealId);
  const err = healthError(health, note);
  if (err) return { errors: { healthNote: err } };
  await db.deal.update({ where: { id: dealId }, data: { health, healthNote: health === "GREEN" ? note?.trim() || null : note!.trim(), healthUpdatedAt: new Date() } });
  await audit("execution.health", { actorId: user.id, targetType: "Deal", targetId: dealId, metadata: { from: deal.health, to: health } });
  // Investors hear about it when a company moves to "at risk", and when it recovers.
  if (health !== deal.health && (health === "RED" || deal.health === "RED")) {
    for (const o of await investorsOf(deal.pitchId)) {
      await email(o.investorId, `Status update: ${pitchRef(deal.pitchId)} is ${HEALTH_LABEL[health].toLowerCase()}`, (n) => `Hello ${n}, RamiZeeZ has marked ${pitchRef(deal.pitchId)} as "${HEALTH_LABEL[health]}". ${note ?? ""} Details at ${url(`/investments/${o.id}`)}.`);
    }
  }
  return {};
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export type TaskInput = { title: string; detail: string | null; area: TaskArea; forFounder: boolean; assigneeId: string | null; dueDate: Date | null };

const canManageArea = (user: CurrentUser, area: TaskArea) => can(user, "deals.execution") || (area === "MARKETING" && can(user, "marketing.manage"));

export async function createTask(user: CurrentUser, dealId: string, t: TaskInput) {
  if (!canManageArea(user, t.area)) fail("Your role can't add tasks in this area.");
  const deal = await dealFor(dealId);
  const errors: Record<string, string> = {};
  if (t.title.trim().length < 3) errors.title = "At least 3 characters";
  if (t.dueDate && Number.isNaN(t.dueDate.getTime())) errors.dueDate = "Choose a valid date";
  if (Object.keys(errors).length) return { errors };
  if (t.assigneeId) {
    const a = await db.user.findUnique({ where: { id: t.assigneeId } });
    if (!a || !a.roles.includes("TEAM")) fail("Tasks can only be assigned to team members. Use “for the founder” for founder tasks.");
  }
  const task = await db.dealTask.create({
    data: { dealId, title: t.title.trim(), detail: t.detail?.trim() || null, area: t.area, forFounder: t.forFounder, assigneeId: t.assigneeId, dueDate: t.dueDate, createdById: user.id },
  });
  await audit("execution.task.created", { actorId: user.id, targetType: "Deal", targetId: dealId, metadata: { taskId: task.id, forFounder: t.forFounder } });
  if (t.forFounder) {
    await email(deal.pitch.founderId, `New task from RamiZeeZ: ${task.title}`, (n) => `Hello ${n}, RamiZeeZ added a task for you${task.dueDate ? `, due ${task.dueDate.toISOString().slice(0, 10)}` : ""}: "${task.title}". See it at ${url(`/pitches/${deal.pitchId}/deal`)}.`);
  }
  return {};
}

/** Team members update any task in their area; founders update the tasks shared with them. */
export async function updateTask(user: CurrentUser, taskId: string, status: TaskStatus, founderNote?: string | null) {
  const task = await db.dealTask.findUnique({ where: { id: taskId }, include: { deal: { include: { pitch: true } } } });
  if (!task) fail("Task not found.");
  const t = task!;
  const isFounder = t.forFounder && t.deal.pitch.founderId === user.id;
  if (!isFounder && !canManageArea(user, t.area)) fail("You can't update this task.");
  await db.dealTask.update({
    where: { id: t.id },
    data: { status, completedAt: status === "DONE" ? new Date() : null, ...(isFounder && founderNote !== undefined ? { founderNote: founderNote ? stripContactDetails(founderNote).slice(0, 1000) : null } : {}) },
  });
  await audit("execution.task.updated", { actorId: user.id, targetType: "Deal", targetId: t.dealId, metadata: { taskId, status, by: isFounder ? "FOUNDER" : "TEAM" } });
  if (isFounder && status === "BLOCKED" && t.deal.managerId) {
    await email(t.deal.managerId, `Founder is blocked: ${t.title}`, (n) => `Hello ${n}, the founder of ${pitchRef(t.deal.pitchId)} marked "${t.title}" as blocked. ${founderNote ?? ""} ${url(`/admin/execution/${t.dealId}`)}`);
  }
}

// ─── Monthly investor reports ─────────────────────────────────────────────────

export async function submitReport(user: CurrentUser, dealId: string, r: ReportInput & { keyMetric: string | null; asks: string | null; fileIds: string[] }) {
  const deal = await dealFor(dealId);
  if (deal.pitch.founderId !== user.id) fail("Only the founder can submit this company's reports.");
  const errors = reportErrors(r, duePeriods(deal.fundedAt ?? new Date(), new Date()));
  if (Object.keys(errors).length) return { errors };
  const existing = await db.investorReport.findUnique({ where: { dealId_period: { dealId, period: r.period } } });
  if (existing && existing.status !== "RETURNED") fail(`The ${periodLabel(r.period)} report has already been ${existing.status === "PUBLISHED" ? "published" : "submitted"}.`);
  const clean = (v: string | null) => (v ? stripContactDetails(v.trim()) : null);
  const data = {
    revenue: r.revenue,
    costs: r.costs,
    cashInBank: r.cashInBank,
    customers: r.customers,
    keyMetric: clean(r.keyMetric),
    highlights: clean(r.highlights)!,
    challenges: clean(r.challenges)!,
    asks: clean(r.asks),
    fileIds: [...(existing?.fileIds ?? []), ...r.fileIds].slice(0, 10),
    status: "SUBMITTED" as const,
    submittedAt: new Date(),
    returnNote: null,
  };
  const report = existing ? await db.investorReport.update({ where: { id: existing.id }, data }) : await db.investorReport.create({ data: { ...data, dealId, period: r.period } });
  await audit("report.submitted", { actorId: user.id, targetType: "InvestorReport", targetId: report.id, metadata: { period: r.period } });
  if (deal.managerId) await email(deal.managerId, `Report to review: ${pitchRef(deal.pitchId)} ${periodLabel(r.period)}`, (n) => `Hello ${n}, the founder submitted the ${periodLabel(r.period)} report. Review it at ${url(`/admin/execution/${dealId}`)}.`);
  return {};
}

export async function reviewReport(user: CurrentUser, reportId: string, publish: boolean, note: string | null) {
  if (!can(user, "deals.execution")) fail("Your role can't review reports.");
  const report = await db.investorReport.findUnique({ where: { id: reportId }, include: { deal: { include: { pitch: true } } } });
  if (!report || report.status !== "SUBMITTED") fail("This report isn't waiting for review.");
  const r = report!;
  if (!publish && (!note || note.trim().length < 10)) return { errors: { note: "Tell the founder what to fix (at least 10 characters)" } };
  await db.investorReport.update({
    where: { id: r.id },
    data: publish ? { status: "PUBLISHED", publishedAt: new Date(), reviewerId: user.id, commentary: note?.trim() || null } : { status: "RETURNED", reviewerId: user.id, returnNote: note!.trim() },
  });
  await audit(publish ? "report.published" : "report.returned", { actorId: user.id, targetType: "InvestorReport", targetId: r.id });
  const ref = pitchRef(r.deal.pitchId);
  if (publish) {
    for (const o of await investorsOf(r.deal.pitchId)) {
      await email(o.investorId, `${periodLabel(r.period)} report: ${ref}`, (n) => `Hello ${n}, the ${periodLabel(r.period)} report for ${ref} is ready, reviewed by RamiZeeZ. Read it at ${url(`/investments/${o.id}`)}.`);
    }
  } else {
    await email(r.deal.pitch.founderId, `Report returned: ${periodLabel(r.period)}`, (n) => `Hello ${n}, RamiZeeZ returned your ${periodLabel(r.period)} report: ${note}. Update it at ${url(`/pitches/${r.deal.pitchId}/deal`)}.`);
  }
  return {};
}

/**
 * Emails founders about overdue reports (and copies their execution manager), at most once a
 * week per company. Called by the scheduled job endpoint and the team's "send reminders" button.
 */
export async function sendReportReminders(now = new Date()) {
  const deals = await db.deal.findMany({ where: { status: "FUNDED", fundedAt: { not: null } }, include: { pitch: true, reports: { select: { period: true, status: true } } } });
  const weekAgo = new Date(now.getTime() - 6 * 24 * 3600_000);
  let sent = 0;
  for (const d of deals) {
    const overdue = reportSchedule(d.fundedAt!, now, d.reports).filter((x) => x.state === "OVERDUE");
    if (!overdue.length) continue;
    const recent = await db.auditLog.findFirst({ where: { action: "report.reminder", targetId: d.id, createdAt: { gte: weekAgo } } });
    if (recent) continue;
    const months = overdue.map((x) => periodLabel(x.period)).join(", ");
    await email(d.pitch.founderId, `Overdue investor report: ${pitchRef(d.pitchId)}`, (n) => `Hello ${n}, your monthly investor report is overdue for ${months}. Reports keep your investors informed and are part of your agreement. Submit it at ${url(`/pitches/${d.pitchId}/deal`)}.`);
    if (d.managerId) await email(d.managerId, `Overdue reports: ${d.pitch.title}`, (n) => `Hello ${n}, ${d.pitch.title} (${pitchRef(d.pitchId)}) is overdue for ${months}. The founder has been reminded.`);
    await audit("report.reminder", { targetType: "Deal", targetId: d.id, metadata: { periods: overdue.map((x) => x.period) } });
    sent++;
  }
  return sent;
}

// ─── Marketing ────────────────────────────────────────────────────────────────

export type CampaignInput = { name: string; channel: string; objective: string; budget: number | null; startDate: Date; endDate: Date | null };

export async function createCampaign(user: CurrentUser, dealId: string, c: CampaignInput) {
  if (!can(user, "marketing.manage")) fail("Your role can't run campaigns.");
  const deal = await dealFor(dealId);
  const errors = campaignErrors(c);
  if (Object.keys(errors).length) return { errors };
  const row = await db.campaign.create({ data: { ...c, name: c.name.trim(), objective: c.objective.trim(), dealId, currency: deal.currency, ownerId: user.id } });
  await audit("marketing.campaign.created", { actorId: user.id, targetType: "Deal", targetId: dealId, metadata: { campaignId: row.id } });
  return {};
}

export async function updateCampaign(user: CurrentUser, campaignId: string, u: { status: CampaignStatus; reach: number | null; leads: number | null; conversions: number | null; resultsNote: string | null }) {
  if (!can(user, "marketing.manage")) fail("Your role can't run campaigns.");
  const bad = (v: number | null) => v !== null && (!Number.isInteger(v) || v < 0);
  if (bad(u.reach) || bad(u.leads) || bad(u.conversions)) return { errors: { reach: "Results are whole numbers, 0 or more" } };
  const c = await db.campaign.update({ where: { id: campaignId }, data: { ...u, resultsNote: u.resultsNote?.trim() || null } });
  await audit("marketing.campaign.updated", { actorId: user.id, targetType: "Deal", targetId: c.dealId, metadata: { campaignId, status: u.status } });
  return {};
}
