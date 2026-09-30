"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { formValues, type FormState } from "@/lib/form-state";
import { TankError, cancelSeat, expressInterest, requestSeat, respondToInvite } from "@/lib/tank/service";

async function run(fd: FormData | null, fn: () => Promise<{ errors?: Record<string, string> } | void>, ok: string): Promise<FormState> {
  try {
    const r = await fn();
    if (r?.errors && Object.keys(r.errors).length) return { errors: r.errors, values: fd ? formValues(fd) : undefined, message: "Please fix the highlighted fields." };
  } catch (e) {
    if (e instanceof TankError) return { message: e.message, values: fd ? formValues(fd) : undefined };
    throw e;
  }
  refresh();
  return { ok: true, message: ok };
}

export async function requestSeatAction(sessionId: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (fd.get("agree") !== "on") return { errors: { agree: "Confirm you agree to the session NDA" }, values: formValues(fd) };
  return run(fd, () => requestSeat(user, sessionId, String(fd.get("typedName") ?? "")), "Seat requested. RamiZeeZ will confirm by email.");
}

export async function cancelSeatAction(sessionId: string): Promise<FormState> {
  const user = await requireUser();
  return run(null, () => cancelSeat(user, sessionId), "Seat given up.");
}

export async function interestAction(sessionId: string, pitchId: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const amount = Number(fd.get("amount"));
  const note = String(fd.get("note") ?? "").trim().slice(0, 300) || null;
  return run(fd, () => expressInterest(user, sessionId, pitchId, amount, note), "You're in. The founder has been told.");
}

export async function respondInviteAction(tankPitchId: string, confirm: boolean, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  return run(null, () => respondToInvite(user, tankPitchId, confirm, fd.get("grantAccess") === "on"), confirm ? "You're confirmed to pitch." : "Invitation declined.");
}
