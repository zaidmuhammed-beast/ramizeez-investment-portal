import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { FX_RATES_PKR, formatMoney, toPkr } from "@/config/platform";
import { pitchRef } from "@/lib/investor/disclosure";
import { investorContext } from "@/lib/investor/access";
import { endsAt, joinWindowOpen, seatBlocker, tankPhase } from "@/lib/tank/rules";
import { sessionNda, visiblePitches } from "@/lib/tank/service";
import { teaserFacts } from "@/components/investor/teaser";
import { Card, PageHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { StatusPill } from "@/components/deals/views";
import { LocalTime } from "@/components/local-time";
import { JoinButton, PhasePill, SEAT, SLOT } from "@/components/tank/views";
import { CancelSeatForm, InterestForm, InviteResponseForm, SeatRequestForm } from "@/components/tank/forms";

export const metadata: Metadata = { title: "Tank session" };

export default async function SessionPage({ params, searchParams }: PageProps<"/sessions/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const { error } = await searchParams;
  const s = await db.tankSession.findUnique({
    where: { id },
    include: {
      pitches: { orderBy: { position: "asc" }, include: { pitch: { include: { offers: { where: { status: "ACCEPTED" }, select: { amount: true } }, accessRequests: { where: { investorId: user.id } } } } } },
      seats: { where: { userId: user.id } },
      interests: true,
    },
  });
  if (!s) notFound();
  const now = new Date();
  const phase = tankPhase(s, now);
  const seat = s.seats[0] ?? null;
  const mySlots = s.pitches.filter((p) => p.pitch.founderId === user.id);
  const visible = user.roles.includes("INVESTOR") ? await visiblePitches(user, s.id) : [];
  if (!mySlots.length && !seat && !visible.length) notFound();

  const ctx = user.roles.includes("INVESTOR") ? await investorContext(user) : null;
  const legalName = `${user.firstName} ${user.lastName}`;
  const block = seatBlocker({ isInvestor: user.roles.includes("INVESTOR"), tier: ctx?.tier ?? 0, ready: !!ctx?.ready, eligiblePitches: visible.length, phase, existing: seat?.status ?? null });
  const nda = sessionNda(s.title, s.pitches.filter((p) => p.status !== "DECLINED").map((p) => p.pitchId), legalName, now.toISOString().slice(0, 10));
  const attending = seat?.status === "APPROVED";
  const joined = attending && !!seat?.joinedAt;
  const canJoin = joinWindowOpen(s, now) && (attending || mySlots.some((p) => p.status === "CONFIRMED"));
  const investorSlots = s.pitches.filter((p) => visible.some((v) => v.slotId === p.id));
  const budgetIn = (ccy: string) => (ctx?.prefs ? Math.floor(toPkr(ctx.prefs.verifiedBudget ?? 0, ctx.prefs.currency) / (FX_RATES_PKR[ccy] ?? 1)) : 0);

  return (
    <>
      <Link href="/sessions" className="text-sm text-slate-400 hover:text-white">
        ← Tank sessions
      </Link>
      <PageHeader
        title={s.title}
        description={
          <>
            <LocalTime iso={s.startsAt.toISOString()} /> to <LocalTime iso={endsAt(s).toISOString()} withZone={false} />
          </>
        }
        actions={<PhasePill phase={phase} />}
      />
      {typeof error === "string" && <Alert tone="error" className="mb-6">{error}</Alert>}
      <div className="grid gap-6 [&>*]:min-w-0 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {s.description && (
            <Card>
              <p className="whitespace-pre-line text-sm text-slate-300">{s.description}</p>
            </Card>
          )}

          {mySlots.map((slot) => {
            const interest = s.interests.filter((x) => x.pitchId === slot.pitchId);
            return (
              <Card key={slot.id} title={`Your pitch: ${slot.pitch.title}`} actions={<StatusPill map={SLOT} status={slot.status} />}>
                {slot.status === "INVITED" && (phase === "UPCOMING" || phase === "OPENING") ? (
                  <InviteResponseForm tankPitchId={slot.id} />
                ) : slot.status === "CONFIRMED" ? (
                  <p className="text-sm text-slate-300">
                    You&apos;re pitching {slot.position + 1 === 1 ? "first" : `in slot ${slot.position + 1}`}. Prepare a 5-minute pitch, then take questions. Never share contact details: offers come through your deal room.
                  </p>
                ) : null}
                {interest.length > 0 && (
                  <p className="mt-4 text-sm text-brand-200">
                    ✋ {interest.length} investor{interest.length > 1 ? "s" : ""} said “I&apos;m in”, for {formatMoney(interest.reduce((t, x) => t + Number(x.amount), 0), slot.pitch.currency)} in total.
                  </p>
                )}
              </Card>
            );
          })}

          {investorSlots.length > 0 && (
            <Card title="Pitching in this session" description="Anonymous until the founder presents live. Everything is covered by the session NDA.">
              <ul className="space-y-4">
                {investorSlots.map((slot) => {
                  const p = slot.pitch;
                  const mine = s.interests.find((x) => x.pitchId === p.id && x.investorId === user.id);
                  const remaining = Number(p.amount ?? 0) - p.offers.reduce((t, o) => t + Number(o.amount), 0);
                  const full = p.accessRequests[0]?.status === "APPROVED";
                  return (
                    <li key={slot.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-white">
                          <span className="font-mono text-xs text-brand-300">{pitchRef(p.id)}</span> · {p.sector} · {p.city}
                        </p>
                        {slot.status === "INVITED" && <StatusPill map={{ INVITED: { tone: "neutral", label: "To be confirmed" } }} status="INVITED" />}
                      </div>
                      {p.teaser && <p className="mt-2 text-sm text-slate-300">{p.teaser}</p>}
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
                        {teaserFacts(p)
                          .slice(2, 6)
                          .map(([k, v]) => (
                            <div key={k}>
                              <dt className="text-slate-500">{k}</dt>
                              <dd className="text-slate-200">{v}</dd>
                            </div>
                          ))}
                      </dl>
                      {joined && slot.status === "CONFIRMED" && (phase === "LIVE" || phase === "ENDED") && (
                        <div className="mt-4 border-t border-white/10 pt-4">
                          <InterestForm sessionId={s.id} pitchId={p.id} currency={p.currency} min={Number(p.minTicket ?? 0)} max={Math.max(0, Math.min(remaining, budgetIn(p.currency)))} current={mine ? Number(mine.amount) : undefined} />
                        </div>
                      )}
                      {mine && phase === "COMPLETED" && <p className="mt-3 text-sm text-brand-200">You said “I&apos;m in” for {formatMoney(Number(mine.amount), mine.currency)}.</p>}
                      {full && (
                        <Link href={`/opportunities/${p.id}`} className="mt-3 inline-block text-sm font-medium text-brand-300 hover:underline">
                          Open the data room & make an offer →
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>

        <aside className="space-y-6">
          {canJoin && (
            <Card strong title="The session is open">
              <p className="mb-4 text-sm text-slate-300">Your join link is personal and every join is logged. Don&apos;t record or share the session.</p>
              <JoinButton sessionId={s.id} />
            </Card>
          )}
          {user.roles.includes("INVESTOR") && (
            <Card title="Your seat" actions={seat ? <StatusPill map={SEAT} status={seat.status} /> : undefined}>
              {seat?.status === "REQUESTED" && (
                <>
                  <p className="text-sm text-slate-400">RamiZeeZ reviews every request. We&apos;ll email you when it&apos;s decided.</p>
                  <div className="mt-3">
                    <CancelSeatForm sessionId={s.id} />
                  </div>
                </>
              )}
              {attending && !canJoin && (phase === "UPCOMING" || phase === "OPENING") && (
                <>
                  <p className="text-sm text-slate-300">The join button appears here 15 minutes before the start.</p>
                  <div className="mt-3">
                    <CancelSeatForm sessionId={s.id} />
                  </div>
                </>
              )}
              {phase === "COMPLETED" && attending && !joined && <p className="text-sm text-slate-400">You didn&apos;t join this session.</p>}
              {(!seat || seat.status === "CANCELLED") &&
                (block ? (
                  <p className="text-sm text-slate-400">{block}</p>
                ) : (
                  <>
                    <details className="mb-4 rounded-xl border border-white/10 bg-ink-950/40 p-4" open>
                      <summary className="cursor-pointer text-sm text-slate-300">Session confidentiality agreement</summary>
                      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto text-xs text-slate-300">
                        {nda.map((line) => (
                          <p key={line}>{line}</p>
                        ))}
                      </div>
                    </details>
                    <SeatRequestForm sessionId={s.id} legalName={legalName} />
                  </>
                ))}
            </Card>
          )}
          {s.recordingUrlEnc && (joined || mySlots.some((p) => p.status === "CONFIRMED")) && (
            <Card title="Recording">
              <a href={`/api/tank/${s.id}/recording`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-brand-300 hover:underline">
                Watch the recording →
              </a>
              <p className="mt-2 text-xs text-slate-500">For attendees only. Every view is logged.</p>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
