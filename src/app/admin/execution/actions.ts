"use server";

import { refresh } from "next/cache";
import type { CampaignStatus, TaskArea, TaskStatus } from "@prisma/client";
import { requireTeam } from "@/lib/auth/rbac";
import { requireUser } from "@/lib/auth/session";
import { formValues, type FormState } from "@/lib/form-state";
import type { Health } from "@/lib/execution/rules";
import { ExecutionError, assignManager, createCampaign, createTask, reviewReport, sendReportReminders, setHealth, updateCampaign, updateTask } from "@/lib/execution/service";

async function guard(fd: FormData | null, fn: () => Promise<{ errors?: Record<string, string> } | void>, ok: string): Promise<FormState> {
  try {
    const r = await fn();
    if (r?.errors && Object.keys(r.errors).length) return { errors: r.errors, values: fd ? formValues(fd) : undefined, message: "Please fix the highlighted fields." };
  } catch (e) {
    if (e instanceof ExecutionError) return { message: e.message, values: fd ? formValues(fd) : undefined };
    throw e;
  }
  refresh();
  return { ok: true, message: ok };
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim() || null;
const int = (fd: FormData, k: string) => (str(fd, k) === null ? null : Number(fd.get(k)));
const date = (fd: FormData, k: string) => (str(fd, k) ? new Date(`${str(fd, k)}T00:00:00Z`) : null);

export async function assignManagerAction(dealId: string, _: FormState, fd: FormData): Promise<FormState> {
  const me = await requireTeam("deals.execution");
  return guard(fd, () => assignManager(me, dealId, String(fd.get("managerId") ?? "")), "Manager assigned. The founder has been told.");
}

export async function setHealthAction(dealId: string, _: FormState, fd: FormData): Promise<FormState> {
  const me = await requireTeam("deals.execution");
  return guard(fd, () => setHealth(me, dealId, String(fd.get("health")) as Health, str(fd, "healthNote")), "Status updated.");
}

export async function createTaskAction(dealId: string, _: FormState, fd: FormData): Promise<FormState> {
  const me = await requireTeam();
  return guard(
    fd,
    () =>
      createTask(me, dealId, {
        title: String(fd.get("title") ?? ""),
        detail: str(fd, "detail"),
        area: (String(fd.get("area")) || "EXECUTION") as TaskArea,
        forFounder: fd.get("forFounder") === "on",
        assigneeId: str(fd, "assigneeId"),
        dueDate: date(fd, "dueDate"),
      }),
    "Task added.",
  );
}

/** Used by both the team and founders (for tasks shared with them). */
export async function updateTaskAction(taskId: string, _: FormState, fd: FormData): Promise<FormState> {
  const me = await requireUser();
  const note = fd.has("founderNote") ? str(fd, "founderNote") : undefined;
  return guard(null, () => updateTask(me, taskId, String(fd.get("status")) as TaskStatus, note), "Task updated.");
}

export async function reviewReportAction(reportId: string, publish: boolean, _: FormState, fd: FormData): Promise<FormState> {
  const me = await requireTeam("deals.execution");
  return guard(fd, () => reviewReport(me, reportId, publish, str(fd, "note")), publish ? "Published. Investors have been emailed." : "Returned to the founder.");
}

export async function sendRemindersAction(): Promise<FormState> {
  await requireTeam("deals.execution");
  const sent = await sendReportReminders();
  refresh();
  return { ok: true, message: sent ? `Reminded ${sent} founder${sent > 1 ? "s" : ""}.` : "No reminders due (each company is reminded at most once a week)." };
}

export async function createCampaignAction(dealId: string, _: FormState, fd: FormData): Promise<FormState> {
  const me = await requireTeam("marketing.manage");
  return guard(
    fd,
    () =>
      createCampaign(me, dealId, {
        name: String(fd.get("name") ?? ""),
        channel: String(fd.get("channel") ?? ""),
        objective: String(fd.get("objective") ?? ""),
        budget: int(fd, "budget"),
        startDate: date(fd, "startDate") ?? new Date(NaN),
        endDate: date(fd, "endDate"),
      }),
    "Campaign added.",
  );
}

export async function updateCampaignAction(campaignId: string, _: FormState, fd: FormData): Promise<FormState> {
  const me = await requireTeam("marketing.manage");
  return guard(
    fd,
    () => updateCampaign(me, campaignId, { status: String(fd.get("status")) as CampaignStatus, reach: int(fd, "reach"), leads: int(fd, "leads"), conversions: int(fd, "conversions"), resultsNote: str(fd, "resultsNote") }),
    "Results saved.",
  );
}
