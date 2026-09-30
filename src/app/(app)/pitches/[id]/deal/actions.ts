"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { FileRejected, saveFile } from "@/lib/storage";
import type { FormState } from "@/lib/form-state";
import { DealError, answerQuestion, submitClaim } from "@/lib/deals/service";

async function guard(fn: () => Promise<unknown>, ok: string): Promise<FormState> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof DealError || e instanceof FileRejected) return { message: e.message };
    throw e;
  }
  refresh();
  return { ok: true, message: ok };
}

export async function answerQuestionAction(questionId: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const answer = String(fd.get("answer") ?? "").trim();
  if (answer.length < 5) return { errors: { answer: "Write an answer" } };
  return guard(() => answerQuestion(user, questionId, answer, fd.get("shared") === "on"), "Answer sent.");
}

export async function submitClaimAction(pitchId: string, milestoneId: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const evidence = String(fd.get("evidence") ?? "").trim();
  if (evidence.length < 20) return { errors: { evidence: "Describe what was achieved (at least 20 characters)" } };
  const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 5);
  return guard(async () => {
    const ids: string[] = [];
    for (const file of files) ids.push((await saveFile({ ownerId: user.id, kind: "MILESTONE_EVIDENCE", file, allow: ["image", "pdf"] })).id);
    await submitClaim(user, pitchId, milestoneId, evidence, ids);
  }, "Evidence submitted. RamiZeeZ will review it before releasing funds.");
}
