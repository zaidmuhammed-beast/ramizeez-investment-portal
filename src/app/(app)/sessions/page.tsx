import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { tankPhase } from "@/lib/tank/rules";
import { visiblePitches } from "@/lib/tank/service";
import { Card, PageHeader } from "@/components/ui/card";
import { StatusPill } from "@/components/deals/views";
import { LocalTime } from "@/components/local-time";
import { PhasePill, SEAT } from "@/components/tank/views";

export const metadata: Metadata = { title: "Tank sessions" };

export default async function SessionsPage() {
  const user = await requireUser();
  const now = new Date();
  const since = new Date(now.getTime() - 45 * 24 * 3600_000);
  const sessions = await db.tankSession.findMany({
    where: { status: { not: "CANCELLED" }, startsAt: { gte: since } },
    orderBy: { startsAt: "asc" },
    include: { seats: { where: { userId: user.id } }, pitches: { where: { pitch: { founderId: user.id } }, select: { status: true, pitch: { select: { title: true } } } } },
  });
  const rows = [];
  for (const s of sessions) {
    const seat = s.seats[0];
    const mine = s.pitches.filter((p) => p.status !== "DECLINED");
    const phase = tankPhase(s, now);
    const openToMe = user.roles.includes("INVESTOR") && (phase === "UPCOMING" || phase === "OPENING") && (await visiblePitches(user, s.id)).length > 0;
    if (seat || mine.length || openToMe) rows.push({ s, seat, mine, phase });
  }

  return (
    <>
      <PageHeader title="Tank sessions" description="Live pitch sessions, moderated by RamiZeeZ. Approved investors watch founders pitch, ask questions and say “I'm in”." />
      <div className="grid gap-4 md:grid-cols-2">
        {rows.map(({ s, seat, mine, phase }) => (
          <Link key={s.id} href={`/sessions/${s.id}`} className="glass block rounded-2xl p-6 transition hover:bg-white/10">
            <div className="flex items-start justify-between gap-3">
              <p className="text-lg font-semibold text-white">{s.title}</p>
              <PhasePill phase={phase} />
            </div>
            <p className="mt-1 text-sm text-slate-400">
              <LocalTime iso={s.startsAt.toISOString()} /> · {s.durationMin} min
            </p>
            {s.description && <p className="mt-3 line-clamp-2 text-sm text-slate-300">{s.description}</p>}
            <div className="mt-4 flex flex-wrap gap-1.5">
              {seat && <StatusPill map={SEAT} status={seat.status} />}
              {mine.map((p) => (
                <StatusPill key={p.pitch.title} map={{ INVITED: { tone: "gold", label: `Invited: ${p.pitch.title}` }, CONFIRMED: { tone: "green", label: `Pitching: ${p.pitch.title}` } }} status={p.status} />
              ))}
            </div>
          </Link>
        ))}
      </div>
      {!rows.length && (
        <Card>
          <p className="text-sm text-slate-400">No sessions for you right now. Investors see sessions whose pitches match their verified budget; founders see sessions they&apos;re invited to.</p>
        </Card>
      )}
    </>
  );
}
