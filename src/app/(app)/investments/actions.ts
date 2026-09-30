"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { formValues, type FormState } from "@/lib/form-state";
import { parseOfferForm } from "@/lib/deals/form";
import { DealError, askQuestion, createOffer, respondToOffer, signDocument, type SigningParty } from "@/lib/deals/service";

/** Runs a deal operation, turning rule violations into form messages. */
async function run(fd: FormData | null, fn: () => Promise<{ errors?: Record<string, string> } | unknown>, ok: string): Promise<FormState> {
  try {
    const r = (await fn()) as { errors?: Record<string, string> } | undefined;
    if (r?.errors && Object.keys(r.errors).length) return { errors: r.errors, values: fd ? formValues(fd) : undefined, message: "Please fix the highlighted fields." };
  } catch (e) {
    if (e instanceof DealError) return { message: e.message, values: fd ? formValues(fd) : undefined };
    throw e;
  }
  refresh();
  return { ok: true, message: ok };
}

export async function askQuestionAction(pitchId: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const body = String(fd.get("body") ?? "").trim();
  if (body.length < 10) return { errors: { body: "Write your question (at least 10 characters)" } };
  return run(fd, () => askQuestion(user, pitchId, body), "Question sent. RamiZeeZ checks every question before it reaches the founder.");
}

export async function makeOfferAction(pitchId: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const f = parseOfferForm(fd);
  let offerId: string | undefined;
  const state = await run(fd, async () => {
    const r = await createOffer(user, pitchId, f.amount, f.terms, f.conditions);
    offerId = r.offerId;
    return r;
  }, "Offer sent.");
  if (offerId) redirect(`/investments/${offerId}`);
  return state;
}

export async function respondOfferAction(offerId: string, as: "INVESTOR" | "FOUNDER", _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const action = String(fd.get("intent") ?? "") as "ACCEPT" | "DECLINE" | "COUNTER" | "WITHDRAW";
  if (!["ACCEPT", "DECLINE", "COUNTER", "WITHDRAW"].includes(action)) return { message: "Choose a response." };
  const f = parseOfferForm(fd);
  const labels = { ACCEPT: "Offer accepted. The term sheet is ready to sign.", DECLINE: "Offer declined.", COUNTER: "Counter-offer sent.", WITHDRAW: "Offer withdrawn." };
  return run(fd, () => respondToOffer(user, offerId, as === "FOUNDER" ? "FOUNDER" : "INVESTOR", { action, amount: f.amount, terms: f.terms, conditions: f.conditions, note: f.note ?? undefined }), labels[action]);
}

export async function signDocumentAction(documentId: string, party: SigningParty, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (fd.get("agree") !== "on") return { errors: { agree: "Confirm you have read the document" } };
  return run(fd, () => signDocument(user, documentId, party, String(fd.get("typedName") ?? "")), "Signed.");
}
