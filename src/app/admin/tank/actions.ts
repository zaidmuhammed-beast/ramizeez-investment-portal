"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { requireTeam } from "@/lib/auth/rbac";
import { formValues, type FormState } from "@/lib/form-state";
import { TankError, cancelSession, completeSession, decideSeat, scheduleSession, updateSession } from "@/lib/tank/service";

async function guard(fn: () => Promise<unknown>, ok: string, fd?: FormData): Promise<FormState> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof TankError) return { message: e.message, values: fd ? formValues(fd) : undefined };
    throw e;
  }
  refresh();
  return { ok: true, message: ok };
}

export async function scheduleSessionAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requireTeam("tank.manage");
  // datetime-local has no zone; the form sends the browser's UTC offset alongside it.
  const local = String(fd.get("startsAt") ?? "");
  const offset = Number(fd.get("tzOffset") ?? 0);
  const startsAt = local ? new Date(new Date(`${local}:00Z`).getTime() + offset * 60_000) : new Date(NaN);
  let id: string | undefined;
  try {
    const r = await scheduleSession(me, {
      title: String(fd.get("title") ?? ""),
      description: String(fd.get("description") ?? "") || null,
      startsAt,
      durationMin: Number(fd.get("durationMin")),
      capacity: Number(fd.get("capacity")),
      pitchIds: fd.getAll("pitchIds").map(String),
      meetingUrl: String(fd.get("meetingUrl") ?? "") || null,
    });
    if ("errors" in r && r.errors) return { errors: r.errors, values: formValues(fd), message: "Please fix the highlighted fields." };
    id = "sessionId" in r ? r.sessionId : undefined;
  } catch (e) {
    if (e instanceof TankError) return { message: e.message, values: formValues(fd) };
    throw e;
  }
  redirect(`/admin/tank/${id}`);
}

export async function updateSessionAction(sessionId: string, _: FormState, fd: FormData): Promise<FormState> {
  const me = await requireTeam("tank.manage");
  const u: { meetingUrl?: string | null; recordingUrl?: string | null; capacity?: number } = {};
  if (fd.has("meetingUrl")) u.meetingUrl = String(fd.get("meetingUrl")) || null;
  if (fd.has("recordingUrl")) u.recordingUrl = String(fd.get("recordingUrl")) || null;
  if (fd.has("capacity")) u.capacity = Number(fd.get("capacity"));
  return guard(() => updateSession(me, sessionId, u), "Saved.", fd);
}

export async function decideSeatAction(seatId: string, approve: boolean): Promise<FormState> {
  const me = await requireTeam("tank.manage");
  return guard(() => decideSeat(me, seatId, approve), approve ? "Seat approved." : "Seat declined.");
}

export async function completeSessionAction(sessionId: string): Promise<FormState> {
  const me = await requireTeam("tank.manage");
  return guard(() => completeSession(me, sessionId), "Session completed. Attendees now have data-room access where founders allowed it.");
}

export async function cancelSessionAction(sessionId: string): Promise<FormState> {
  const me = await requireTeam("tank.manage");
  return guard(() => cancelSession(me, sessionId), "Session cancelled. Everyone involved has been emailed.");
}
