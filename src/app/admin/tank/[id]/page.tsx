import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireTeam } from "@/lib/auth/rbac";
import { formatMoney } from "@/config/platform";
import { pitchRef } from "@/lib/investor/disclosure";
import { endsAt, tankPhase } from "@/lib/tank/rules";
import { Card, PageHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/deals/views";
import { LocalTime } from "@/components/local-time";
import { JoinButton, PhasePill, SEAT, SLOT } from "@/components/tank/views";
import { CancelSessionForm, CompleteSessionForm, SeatDecision, UpdateSessionForm } from "@/components/tank/forms";

export const metadata: Metadata = { title: "Tank session" };

export default async function TankSessionAdmin({ params, searchParams }: PageProps<"/admin/tank/[id]">) {
  await requireTeam("tank.manage");
  const { id } = await params;
  const { error } = await searchParams;
  const s = await db.tankSession.findUnique({
    where: { id },
    include: {
      pitches: { orderBy: { position: "asc" }, include: { pitch: { select: { id: true, title: true, sector: true, currency: true } } } },
      seats: { orderBy: { requestedAt: "asc" }, include: { user: { select: { firstName: true, lastName: true, tier: true, countryOfResidence: true } } } },
      interests: { include: { investor: { select: { firstName: true, lastName: true } } } },
    },
  });
  if (!s) notFound();
  const phase = tankPhase(s, new Date());
  const approved = s.seats.filter((x) => x.status === "APPROVED");
  const open = phase !== "COMPLETED" && phase !== "CANCELLED";

  return (
    <>
      <Link href="/admin/tank" className="text-sm text-slate-400 hover:text-white">
        ← Tank sessions
      </Link>
      <PageHeader
        title={s.title}
        description={
          <>
            <LocalTime iso={s.startsAt.toISOString()} /> to <LocalTime iso={endsAt(s).toISOString()} withZone={false} /> · {approved.length}/{s.capacity} seats · video: {s.videoProvider}
          </>
        }
        actions={<PhasePill phase={phase} />}
      />
      {typeof error === "string" && <Alert tone="error" className="mb-6">{error}</Alert>}
      <div className="grid gap-6 [&>*]:min-w-0 lg:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <Card title="Pitches" description="Founders confirm from their pitch page. Interest is what investors said live (“I'm in”).">
            <ol className="space-y-3">
              {s.pitches.map((tp, i) => {
                const interest = s.interests.filter((x) => x.pitchId === tp.pitchId);
                return (
                  <li key={tp.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-white">
                        <span className="font-mono text-brand-300">{i + 1}.</span> {tp.pitch.title} <span className="text-slate-500">· {pitchRef(tp.pitchId)} · {tp.pitch.sector}</span>
                      </p>
                      <div className="flex gap-1.5">
                        <StatusPill map={SLOT} status={tp.status} />
                        {tp.status === "CONFIRMED" && <Badge tone={tp.grantAccess ? "gold" : "neutral"}>{tp.grantAccess ? "Data room for attendees" : "No automatic access"}</Badge>}
                      </div>
                    </div>
                    {interest.length > 0 && (
                      <ul className="mt-3 space-y-1 text-xs text-slate-300">
                        {interest.map((x) => (
                          <li key={x.id}>
                            ✋ {x.investor.firstName} {x.investor.lastName}: {formatMoney(Number(x.amount), x.currency)}
                            {x.note && <span className="text-slate-500"> · “{x.note}”</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ol>
          </Card>
          <Card title={`Seats (${approved.length}/${s.capacity})`} description="Only Tier 4 investors who match at least one pitch can request a seat. Each signed the session NDA.">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="pb-2 pr-3 font-medium">Investor</th>
                    <th className="pb-2 pr-3 font-medium">Requested</th>
                    <th className="pb-2 pr-3 font-medium">Status</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {s.seats.map((seat) => (
                    <tr key={seat.id}>
                      <td className="py-2 pr-3 text-white">
                        {seat.user.firstName} {seat.user.lastName} <span className="text-xs text-slate-500">T{seat.user.tier} · {seat.user.countryOfResidence}</span>
                      </td>
                      <td className="py-2 pr-3 text-xs text-slate-400">{seat.requestedAt.toISOString().slice(0, 10)}</td>
                      <td className="py-2 pr-3">
                        <StatusPill map={SEAT} status={seat.status} />
                        {seat.joinedAt && <span className="ml-1 text-xs text-brand-200">joined ×{seat.joinCount}</span>}
                      </td>
                      <td className="py-2 text-right">{seat.status === "REQUESTED" && open && <SeatDecision seatId={seat.id} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!s.seats.length && <p className="py-3 text-sm text-slate-500">No seat requests yet.</p>}
            </div>
          </Card>
        </div>
        <aside className="space-y-6">
          {open && (
            <Card title="Host">
              <div className="space-y-4">
                <JoinButton sessionId={s.id} label="Join as moderator" />
                {s.videoProvider === "link" && (
                  <UpdateSessionForm sessionId={s.id} field="meetingUrl" label="Meeting link" hint={s.joinUrlEnc ? "A link is set. Paste a new one to replace it." : "No link yet: attendees can't join until you add one."} />
                )}
                <UpdateSessionForm sessionId={s.id} field="capacity" label="Investor seats" current={String(s.capacity)} />
              </div>
            </Card>
          )}
          <Card title="Recording" description="Visible only to attendees, the founders and the team. Every open is logged.">
            <UpdateSessionForm sessionId={s.id} field="recordingUrl" label="Recording link" hint={s.recordingUrlEnc ? "A recording is set." : undefined} />
          </Card>
          {(phase === "LIVE" || phase === "ENDED") && (
            <Card title="Wrap up" description="Attendees get the full data room of each pitch whose founder allowed it, without using their monthly quotas.">
              <CompleteSessionForm sessionId={s.id} />
            </Card>
          )}
          {phase === "UPCOMING" || phase === "OPENING" ? <CancelSessionForm sessionId={s.id} /> : null}
        </aside>
      </div>
    </>
  );
}
