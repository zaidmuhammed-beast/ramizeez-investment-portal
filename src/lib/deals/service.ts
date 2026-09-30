import "server-only";
import type { EscrowEntryType, OfferParty, Prisma } from "@prisma/client";
import { db } from "../db";
import { env } from "../env";
import { audit } from "../audit";
import { sha256Hex } from "../crypto";
import { requestMeta } from "../request";
import { sendMessage } from "../messaging";
import { can } from "../auth/rbac";
import type { CurrentUser } from "../auth/session";
import { nameSimilarity } from "../kyc/names";
import { pitchAccess } from "../investor/access";
import { pitchRef, stripContactDetails } from "../investor/disclosure";
import { formatMoney, toPkr } from "@/config/platform";
import { AGREEMENT_TEMPLATE_VERSION, agreementText, termSheetText, type DocContext } from "@/config/agreements";
import { amountBlocker, pickTerms, termErrors, turnOf, type DealType, type OfferTerms } from "./offers";
import { approvalBlocker, balance, entryBlocker, evaluateRound, feeFor, releaseAmount, releasedFor, type Entry } from "./escrow";

export class DealError extends Error {}
const fail = (msg: string): never => {
  throw new DealError(msg);
};

const num = (d: Prisma.Decimal | number | null | undefined) => (d === null || d === undefined ? 0 : Number(d));
const today = () => new Date().toISOString().slice(0, 10);
const url = (path: string) => `${env().APP_URL}${path}`;

async function email(userId: string, subject: string, body: (firstName: string) => string) {
  const u = await db.user.findUnique({ where: { id: userId }, select: { email: true, firstName: true } });
  if (u) await sendMessage("EMAIL", u.email, subject, body(u.firstName));
}

// ─── Capacity ─────────────────────────────────────────────────────────────────

/** Accepted commitments in this round and the investor's commitments elsewhere, for amount checks. */
async function capacity(pitchId: string, investorId: string, excludeOfferId?: string) {
  const [pitch, inv, acceptedHere, investorAccepted] = await Promise.all([
    db.pitch.findUniqueOrThrow({ where: { id: pitchId } }),
    db.investorProfile.findUnique({ where: { userId: investorId } }),
    db.offer.findMany({ where: { pitchId, status: "ACCEPTED", id: { not: excludeOfferId } }, select: { amount: true } }),
    db.offer.findMany({ where: { investorId, status: "ACCEPTED", id: { not: excludeOfferId } }, select: { amount: true, currency: true } }),
  ]);
  return {
    pitch,
    input: (amount: number) => ({
      amount,
      currency: pitch.currency,
      minTicket: num(pitch.minTicket),
      raiseTarget: num(pitch.amount),
      multipleInvestors: pitch.multipleInvestors,
      acceptedElsewhere: acceptedHere.reduce((s, o) => s + num(o.amount), 0),
      investorBudgetPkr: inv?.verifiedBudget ? toPkr(num(inv.verifiedBudget), inv.currency) : 0,
      investorCommittedPkr: investorAccepted.reduce((s, o) => s + toPkr(num(o.amount), o.currency), 0),
    }),
  };
}

function validate(dealType: DealType, amountBlock: string | null, terms: OfferTerms) {
  const errors = termErrors(dealType, terms);
  if (amountBlock) errors.amount = amountBlock;
  return errors;
}

// ─── Offers ───────────────────────────────────────────────────────────────────

export async function createOffer(user: CurrentUser, pitchId: string, amount: number, terms: OfferTerms, conditions: string | null) {
  const access = await pitchAccess(user, pitchId);
  if (!access.pitch || access.level !== "FULL") fail("Offers can be made once you have full data-room access.");
  const pitch = access.pitch!;
  if (!pitch.dealType) fail("This pitch has no deal structure.");
  const open = await db.offer.count({ where: { pitchId, investorId: user.id, status: { in: ["AWAITING_FOUNDER", "AWAITING_INVESTOR", "ACCEPTED"] } } });
  if (open) fail("You already have an offer on this pitch. Continue that negotiation instead.");
  const cap = await capacity(pitchId, user.id);
  const dealType = pitch.dealType as DealType;
  const clean = pickTerms(dealType, terms);
  const errors = validate(dealType, amountBlocker(cap.input(amount)), clean);
  if (Object.keys(errors).length) return { errors };

  const offer = await db.offer.create({
    data: {
      pitchId,
      investorId: user.id,
      status: "AWAITING_FOUNDER",
      amount,
      currency: pitch.currency,
      terms: clean,
      conditions: conditions ? stripContactDetails(conditions) : null,
      lastBy: "INVESTOR",
      revisions: { create: { by: "INVESTOR", actorId: user.id, action: "OFFER", amount, terms: clean, conditions: conditions ? stripContactDetails(conditions) : null } },
    },
  });
  await audit("offer.created", { actorId: user.id, targetType: "Offer", targetId: offer.id, metadata: { amount, pitchId } });
  await email(pitch.founderId, `New offer on ${pitch.title}`, (n) => `Hello ${n}, a verified investor offered ${formatMoney(amount, pitch.currency)} for "${pitch.title}". Review it at ${url(`/pitches/${pitch.id}/deal`)}.`);
  return { offerId: offer.id };
}

export type OfferResponse = { action: "ACCEPT" | "DECLINE" | "COUNTER" | "WITHDRAW"; amount?: number; terms?: OfferTerms; conditions?: string | null; note?: string };

export async function respondToOffer(user: CurrentUser, offerId: string, as: OfferParty, r: OfferResponse): Promise<{ errors?: Record<string, string> }> {
  const offer = await db.offer.findUnique({ where: { id: offerId }, include: { pitch: { include: { deal: true } } } });
  if (!offer) fail("Offer not found.");
  const o = offer!;
  const isParty = as === "INVESTOR" ? o.investorId === user.id : o.pitch.founderId === user.id;
  if (!isParty) fail("You are not a party to this offer.");
  if (o.pitch.status !== "LISTED" || o.pitch.deal?.status === "CANCELLED") fail("This round is no longer open.");
  const turn = turnOf(o.status);
  const note = r.note ? stripContactDetails(r.note).slice(0, 1000) : null;
  const other = as === "INVESTOR" ? o.pitch.founderId : o.investorId;
  const otherPath = as === "INVESTOR" ? `/pitches/${o.pitchId}/deal` : `/investments/${o.id}`;
  const ref = pitchRef(o.pitchId);

  if (r.action === "WITHDRAW") {
    if (as !== "INVESTOR" || !turn) fail("Only an open offer can be withdrawn by the investor.");
    await db.offer.update({ where: { id: o.id }, data: { status: "WITHDRAWN", revisions: { create: { by: as, actorId: user.id, action: "WITHDRAW", amount: o.amount, terms: o.terms as Prisma.InputJsonValue, note } } } });
    await audit("offer.withdrawn", { actorId: user.id, targetType: "Offer", targetId: o.id });
    await email(other, `Offer withdrawn: ${ref}`, (n) => `Hello ${n}, the investor withdrew their offer on ${ref}.`);
    return {};
  }
  if (turn !== as) fail("It's not your turn to respond to this offer.");

  if (r.action === "DECLINE") {
    await db.offer.update({ where: { id: o.id }, data: { status: "DECLINED", revisions: { create: { by: as, actorId: user.id, action: "DECLINE", amount: o.amount, terms: o.terms as Prisma.InputJsonValue, note } } } });
    await audit("offer.declined", { actorId: user.id, targetType: "Offer", targetId: o.id, metadata: { as } });
    await email(other, `Offer declined: ${ref}`, (n) => `Hello ${n}, the offer on ${ref} was declined.${note ? ` Note: ${note}` : ""} Details: ${url(otherPath)}`);
    return {};
  }

  const dealType = o.pitch.dealType as DealType;
  const cap = await capacity(o.pitchId, o.investorId, o.id);

  if (r.action === "COUNTER") {
    const amount = r.amount ?? num(o.amount);
    const terms = pickTerms(dealType, r.terms ?? {});
    const errors = validate(dealType, amountBlocker(cap.input(amount)), terms);
    if (Object.keys(errors).length) return { errors };
    const conditions = r.conditions ? stripContactDetails(r.conditions) : null;
    await db.offer.update({
      where: { id: o.id },
      data: {
        status: as === "INVESTOR" ? "AWAITING_FOUNDER" : "AWAITING_INVESTOR",
        amount,
        terms,
        conditions,
        lastBy: as,
        revisions: { create: { by: as, actorId: user.id, action: "COUNTER", amount, terms, conditions, note } },
      },
    });
    await audit("offer.countered", { actorId: user.id, targetType: "Offer", targetId: o.id, metadata: { as, amount } });
    await email(other, `Counter-offer on ${ref}`, (n) => `Hello ${n}, there's a counter-offer of ${formatMoney(amount, o.currency)} on ${ref}. Respond at ${url(otherPath)}.`);
    return {};
  }

  // ACCEPT: re-check capacity, since other offers may have been accepted meanwhile.
  const block = amountBlocker(cap.input(num(o.amount)));
  if (block) fail(block);
  await db.$transaction(async (tx) => {
    await tx.offer.update({
      where: { id: o.id },
      data: { status: "ACCEPTED", acceptedAt: new Date(), revisions: { create: { by: as, actorId: user.id, action: "ACCEPT", amount: o.amount, terms: o.terms as Prisma.InputJsonValue, conditions: o.conditions, note } } },
    });
    await tx.deal.upsert({
      where: { pitchId: o.pitchId },
      create: { pitchId: o.pitchId, target: num(o.pitch.amount), currency: o.pitch.currency },
      update: {},
    });
  });
  await issueDocument(o.id, "TERM_SHEET", null);
  await audit("offer.accepted", { actorId: user.id, targetType: "Offer", targetId: o.id, metadata: { as, amount: num(o.amount) } });
  await email(other, `Offer accepted: ${ref}`, (n) => `Hello ${n}, the offer of ${formatMoney(num(o.amount), o.currency)} on ${ref} was accepted. The term sheet is ready to sign at ${url(otherPath)}.`);
  await refreshDeal(o.pitchId);
  return {};
}

// ─── Documents ────────────────────────────────────────────────────────────────

async function docContext(offerId: string): Promise<DocContext> {
  const o = await db.offer.findUniqueOrThrow({
    where: { id: offerId },
    include: { investor: true, pitch: { include: { founder: true, milestones: { orderBy: { position: "asc" } } } } },
  });
  return {
    ref: pitchRef(o.pitchId),
    businessTitle: o.pitch.title,
    founderName: `${o.pitch.founder.firstName} ${o.pitch.founder.lastName}`,
    investorName: `${o.investor.firstName} ${o.investor.lastName}`,
    amount: num(o.amount),
    currency: o.currency,
    dealType: o.pitch.dealType as DealType,
    terms: o.terms as OfferTerms,
    conditions: o.conditions,
    milestones: o.pitch.milestones.map((m) => ({ month: m.month, title: m.title, budget: num(m.budget) })),
    date: today(),
  };
}

export async function issueDocument(offerId: string, kind: "TERM_SHEET" | "AGREEMENT", issuedById: string | null, bodyOverride?: string) {
  const ctx = await docContext(offerId);
  const body = bodyOverride?.trim() || (kind === "TERM_SHEET" ? termSheetText(ctx) : agreementText(ctx));
  const title = kind === "TERM_SHEET" ? `Term sheet: ${ctx.ref}` : `Investment agreement: ${ctx.ref}`;
  return db.dealDocument.create({ data: { offerId, kind, title, body, bodyHash: sha256Hex(body), templateVersion: AGREEMENT_TEMPLATE_VERSION, issuedById } });
}

/** The agreement text a legal officer can review and edit before issuing it. */
export async function agreementDraft(offerId: string) {
  return agreementText(await docContext(offerId));
}

export async function issueAgreement(user: CurrentUser, offerId: string, body: string) {
  if (!can(user, "deals.legal")) fail("Only legal can issue agreements.");
  const docs = await db.dealDocument.findMany({ where: { offerId, status: { not: "VOID" } } });
  if (!docs.some((d) => d.kind === "TERM_SHEET" && d.status === "SIGNED")) fail("The term sheet must be signed by everyone first.");
  if (docs.some((d) => d.kind === "AGREEMENT")) fail("An agreement has already been issued for this offer.");
  const doc = await issueDocument(offerId, "AGREEMENT", user.id, body);
  const o = await db.offer.findUniqueOrThrow({ where: { id: offerId }, include: { pitch: true } });
  await audit("agreement.issued", { actorId: user.id, targetType: "DealDocument", targetId: doc.id });
  for (const [id, path] of [[o.investorId, `/investments/${o.id}`], [o.pitch.founderId, `/pitches/${o.pitchId}/deal`]] as const) {
    await email(id, `Agreement ready to sign: ${pitchRef(o.pitchId)}`, (n) => `Hello ${n}, the investment agreement for ${pitchRef(o.pitchId)} is ready for your e-signature at ${url(path)}.`);
  }
  return doc;
}

const PARTIES = ["INVESTOR", "FOUNDER", "RAMIZEEZ"] as const;
export type SigningParty = (typeof PARTIES)[number];

export async function signDocument(user: CurrentUser, documentId: string, party: SigningParty, typedName: string) {
  const doc = await db.dealDocument.findUnique({ where: { id: documentId }, include: { signatures: true, offer: { include: { pitch: true } } } });
  if (!doc) fail("Document not found.");
  const d = doc!;
  const allowed =
    party === "INVESTOR" ? d.offer.investorId === user.id : party === "FOUNDER" ? d.offer.pitch.founderId === user.id : can(user, "deals.legal");
  if (!allowed) fail("You can't sign this document for that party.");
  if (d.status !== "SIGNING") fail("This document isn't open for signature.");
  if (d.signatures.some((s) => s.party === party)) fail("Already signed for this party.");
  const legalName = `${user.firstName} ${user.lastName}`;
  if (nameSimilarity(typedName, legalName) < 0.9) return { errors: { typedName: `Type your full legal name: ${legalName}` } };
  if (sha256Hex(d.body) !== d.bodyHash) fail("The document text has changed since it was issued. Contact RamiZeeZ.");

  const { ip } = await requestMeta();
  await db.documentSignature.create({ data: { documentId: d.id, party, userId: user.id, typedName: typedName.trim(), bodyHash: d.bodyHash, ip } });
  const signedParties = new Set([...d.signatures.map((s) => s.party), party]);
  const complete = PARTIES.every((p) => signedParties.has(p));
  if (complete) await db.dealDocument.update({ where: { id: d.id }, data: { status: "SIGNED", signedAt: new Date() } });
  await audit("document.signed", { actorId: user.id, targetType: "DealDocument", targetId: d.id, metadata: { party, complete } });
  if (complete && d.kind === "AGREEMENT") await refreshDeal(d.offer.pitchId);
  return { complete };
}

// ─── Round status ─────────────────────────────────────────────────────────────

export async function refreshDeal(pitchId: string) {
  const deal = await db.deal.findUnique({
    where: { pitchId },
    include: {
      entries: true,
      pitch: { include: { milestones: true, offers: { where: { status: "ACCEPTED" }, include: { documents: true } } } },
    },
  });
  if (!deal) return null;
  const entries: Entry[] = deal.entries.map((e) => ({ ...e, amount: num(e.amount) }));
  const state = evaluateRound({
    cancelled: deal.status === "CANCELLED",
    target: num(deal.target),
    closedEarly: deal.closedEarly,
    accepted: deal.pitch.offers.map((o) => ({ offerId: o.id, amount: num(o.amount), agreementSigned: o.documents.some((d) => d.kind === "AGREEMENT" && d.status === "SIGNED") })),
    entries,
    milestones: deal.pitch.milestones.map((m) => ({ id: m.id, budget: num(m.budget) })),
  });
  // Once funded, the round stays funded (the fee and releases reduce the balance, not the funding).
  const status = deal.status === "FUNDED" && state.status === "COMMITTED" ? "FUNDED" : state.status;
  if (status === deal.status) return deal;
  const becameFunded = status === "FUNDED" && !deal.fundedAt;
  const updated = await db.deal.update({
    where: { id: deal.id },
    data: {
      status,
      ...(becameFunded ? { fundedTotal: state.fundedTotal, fundedAt: new Date() } : {}),
      ...(status === "COMPLETED" ? { completedAt: new Date() } : {}),
    },
  });
  if (becameFunded) {
    // The success fee is queued automatically; finance approves it like any other entry.
    await db.escrowEntry.create({
      data: { dealId: deal.id, type: "FEE", amount: feeFor(state.fundedTotal), currency: deal.currency, note: "RamiZeeZ success fee (automatic)", recordedById: null },
    });
    const ref = pitchRef(pitchId);
    await email(deal.pitch.founderId, `Round funded: ${ref}`, (n) => `Hello ${n}, your round is fully funded and in escrow. Submit milestone evidence at ${url(`/pitches/${pitchId}/deal`)} to receive funds.`);
    for (const o of deal.pitch.offers) await email(o.investorId, `Round funded: ${ref}`, (n) => `Hello ${n}, the round for ${ref} is fully funded. Follow the milestones at ${url(`/investments/${o.id}`)}.`);
  }
  await audit("deal.status.changed", { targetType: "Deal", targetId: deal.id, metadata: { from: deal.status, to: status } });
  return updated;
}

export async function closeRoundEarly(user: CurrentUser, pitchId: string) {
  if (!can(user, "pitches.approve")) fail("Only the investment committee can close a round early.");
  const deal = await db.deal.findUnique({ where: { pitchId } });
  if (!deal || deal.status !== "OPEN") fail("Only an open round can be closed early.");
  await db.deal.update({ where: { id: deal!.id }, data: { closedEarly: true } });
  await audit("deal.closed_early", { actorId: user.id, targetType: "Deal", targetId: deal!.id });
  return refreshDeal(pitchId);
}

// ─── Escrow ledger ────────────────────────────────────────────────────────────

export async function recordEntry(
  user: CurrentUser,
  pitchId: string,
  e: { type: EscrowEntryType; amount: number; offerId?: string | null; milestoneId?: string | null; reference?: string | null; note?: string | null },
) {
  if (!can(user, "escrow.record")) fail("Your role can't record escrow entries.");
  if (e.type === "FEE") fail("The success fee is created automatically when the round is funded.");
  const deal = await db.deal.findUnique({ where: { pitchId }, include: { entries: true, claims: true, pitch: { include: { milestones: true } } } });
  if (!deal) fail("There is no round for this pitch yet.");
  const d = deal!;
  if (e.offerId) {
    const offer = await db.offer.findFirst({ where: { id: e.offerId, pitchId, status: "ACCEPTED" } });
    if (!offer) fail("That offer isn't an accepted commitment in this round.");
  }
  const entries: Entry[] = d.entries.map((x) => ({ ...x, amount: num(x.amount) }));
  const milestone = e.milestoneId ? d.pitch.milestones.find((m) => m.id === e.milestoneId) : undefined;
  if (e.milestoneId && !milestone) fail("Unknown milestone.");
  const block = entryBlocker(
    { type: e.type, amount: e.amount, status: "PENDING", offerId: e.offerId, milestoneId: e.milestoneId },
    {
      balance: balance(entries),
      dealStatus: d.status,
      claimApproved: !!e.milestoneId && d.claims.some((c) => c.milestoneId === e.milestoneId && c.status === "APPROVED"),
      alreadyReleased: e.milestoneId ? releasedFor(entries, e.milestoneId) + entries.filter((x) => x.status === "PENDING" && x.type === "RELEASE" && x.milestoneId === e.milestoneId).reduce((s, x) => s + x.amount, 0) : 0,
      releaseCap: milestone ? releaseAmount(num(milestone.budget), num(d.fundedTotal ?? d.target), num(d.target)) : undefined,
    },
  );
  if (block) fail(block);
  const entry = await db.escrowEntry.create({
    data: { dealId: d.id, type: e.type, amount: e.amount, currency: d.currency, offerId: e.offerId || null, milestoneId: e.milestoneId || null, reference: e.reference || null, note: e.note || null, recordedById: user.id },
  });
  await audit("escrow.recorded", { actorId: user.id, targetType: "EscrowEntry", targetId: entry.id, metadata: { type: e.type, amount: e.amount } });
  return entry;
}

export async function decideEntry(user: CurrentUser, entryId: string, approve: boolean) {
  if (!can(user, "escrow.approve")) fail("Your role can't approve escrow entries.");
  const entry = await db.escrowEntry.findUnique({ where: { id: entryId }, include: { deal: { include: { entries: true, pitch: true } } } });
  if (!entry) fail("Entry not found.");
  const en = entry!;
  const block = approvalBlocker({ ...en, amount: num(en.amount) }, user.id);
  if (block) fail(block);
  if (approve && en.type !== "DEPOSIT") {
    const bal = balance(en.deal.entries.map((x) => ({ ...x, amount: num(x.amount) })));
    if (num(en.amount) > bal + 0.01) fail("Not enough money in escrow to post this entry.");
  }
  await db.escrowEntry.update({ where: { id: en.id }, data: { status: approve ? "POSTED" : "REJECTED", approvedById: user.id, approvedAt: new Date() } });
  await audit(approve ? "escrow.posted" : "escrow.rejected", { actorId: user.id, targetType: "EscrowEntry", targetId: en.id, metadata: { type: en.type, amount: num(en.amount) } });
  if (approve) {
    const ref = pitchRef(en.deal.pitchId);
    if (en.type === "DEPOSIT" && en.offerId) {
      const o = await db.offer.findUniqueOrThrow({ where: { id: en.offerId } });
      await email(o.investorId, `Deposit received: ${ref}`, (n) => `Hello ${n}, we received ${formatMoney(num(en.amount), en.currency)} into escrow for ${ref}.`);
    }
    if (en.type === "RELEASE") {
      await email(en.deal.pitch.founderId, `Funds released: ${ref}`, (n) => `Hello ${n}, ${formatMoney(num(en.amount), en.currency)} was released from escrow for a completed milestone.`);
    }
  }
  await refreshDeal(en.deal.pitchId);
}

// ─── Q&A ──────────────────────────────────────────────────────────────────────

export async function askQuestion(user: CurrentUser, pitchId: string, body: string) {
  const access = await pitchAccess(user, pitchId);
  if (!access.pitch || access.level !== "FULL") fail("Questions open once you have full data-room access.");
  const pending = await db.pitchQuestion.count({ where: { pitchId, investorId: user.id, status: { in: ["PENDING", "OPEN"] } } });
  if (pending >= 5) fail("You have 5 unanswered questions on this pitch. Wait for answers before asking more.");
  const q = await db.pitchQuestion.create({ data: { pitchId, investorId: user.id, body: stripContactDetails(body).slice(0, 2000) } });
  await audit("question.asked", { actorId: user.id, targetType: "PitchQuestion", targetId: q.id });
  return q;
}

export async function moderateQuestion(user: CurrentUser, questionId: string, approve: boolean, note?: string) {
  if (!can(user, "deals.moderate")) fail("Your role can't moderate questions.");
  const q = await db.pitchQuestion.findUnique({ where: { id: questionId }, include: { pitch: true } });
  if (!q || q.status !== "PENDING") fail("This question has already been moderated.");
  await db.pitchQuestion.update({ where: { id: questionId }, data: { status: approve ? "OPEN" : "REJECTED", moderatedById: user.id, moderatedAt: new Date(), moderationNote: note || null } });
  await audit(approve ? "question.approved" : "question.rejected", { actorId: user.id, targetType: "PitchQuestion", targetId: questionId });
  if (approve) await email(q!.pitch.founderId, `Investor question on ${q!.pitch.title}`, (n) => `Hello ${n}, an investor asked a question about "${q!.pitch.title}". Answer it at ${url(`/pitches/${q!.pitchId}/deal`)}.`);
  else await email(q!.investorId, `Your question on ${pitchRef(q!.pitchId)}`, (n) => `Hello ${n}, your question wasn't passed to the founder.${note ? ` Reason: ${note}` : ""}`);
}

export async function answerQuestion(user: CurrentUser, questionId: string, answer: string, shared: boolean) {
  const q = await db.pitchQuestion.findUnique({ where: { id: questionId }, include: { pitch: true } });
  if (!q || q.pitch.founderId !== user.id) fail("Question not found.");
  if (q!.status !== "OPEN") fail("This question can't be answered now.");
  await db.pitchQuestion.update({ where: { id: questionId }, data: { status: "ANSWERED", answer: stripContactDetails(answer).slice(0, 4000), answeredAt: new Date(), shared } });
  await audit("question.answered", { actorId: user.id, targetType: "PitchQuestion", targetId: questionId, metadata: { shared } });
  await email(q!.investorId, `Your question was answered: ${pitchRef(q!.pitchId)}`, (n) => `Hello ${n}, the founder answered your question. See it at ${url(`/opportunities/${q!.pitchId}`)}.`);
}

// ─── Milestone claims ─────────────────────────────────────────────────────────

export async function submitClaim(user: CurrentUser, pitchId: string, milestoneId: string, evidence: string, fileIds: string[]) {
  const deal = await db.deal.findUnique({ where: { pitchId }, include: { pitch: { include: { milestones: true } }, claims: true } });
  if (!deal || deal.pitch.founderId !== user.id) fail("Round not found.");
  if (deal!.status !== "FUNDED") fail("Milestone evidence can be submitted once the round is funded.");
  if (!deal!.pitch.milestones.some((m) => m.id === milestoneId)) fail("Unknown milestone.");
  if (deal!.claims.some((c) => c.milestoneId === milestoneId && c.status !== "REJECTED")) fail("Evidence for this milestone is already submitted or approved.");
  const claim = await db.milestoneClaim.create({ data: { dealId: deal!.id, milestoneId, evidence: evidence.slice(0, 4000), fileIds } });
  await audit("milestone.claimed", { actorId: user.id, targetType: "MilestoneClaim", targetId: claim.id });
  return claim;
}

export async function reviewClaim(user: CurrentUser, claimId: string, approve: boolean, note?: string) {
  if (!can(user, "deals.execution")) fail("Your role can't review milestones.");
  const claim = await db.milestoneClaim.findUnique({ where: { id: claimId }, include: { deal: { include: { pitch: true } }, milestone: true } });
  if (!claim || claim.status !== "SUBMITTED") fail("This claim has already been reviewed.");
  if (!approve && !note?.trim()) fail("Explain what's missing. The founder sees it.");
  await db.milestoneClaim.update({ where: { id: claimId }, data: { status: approve ? "APPROVED" : "REJECTED", reviewedById: user.id, reviewedAt: new Date(), reviewNote: note || null } });
  await audit(approve ? "milestone.approved" : "milestone.rejected", { actorId: user.id, targetType: "MilestoneClaim", targetId: claimId });
  await email(
    claim!.deal.pitch.founderId,
    `Milestone ${approve ? "approved" : "needs more evidence"}: ${claim!.milestone.title}`,
    (n) => `Hello ${n}, your evidence for "${claim!.milestone.title}" was ${approve ? "approved. Finance will now release the milestone's funds." : `not accepted yet. ${note}`}`,
  );
}
