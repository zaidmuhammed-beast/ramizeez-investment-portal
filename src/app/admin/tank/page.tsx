import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireTeam } from "@/lib/auth/rbac";
import { pitchRef } from "@/lib/investor/disclosure";
import { tankPhase } from "@/lib/tank/rules";
import { videoStatus } from "@/lib/tank/service";
import { Card, PageHeader } from "@/components/ui/card";
import { LocalTime } from "@/components/local-time";
import { PhasePill } from "@/components/tank/views";
import { ScheduleSessionForm } from "@/components/tank/forms";

export const metadata: Metadata = { title: "Tank sessions" };

export default async function TankAdminPage() {
  await requireTeam("tank.manage");
  const [sessions, pitches] = await Promise.all([
    db.tankSession.findMany({
      orderBy: { startsAt: "desc" },
      take: 50,
      include: { _count: { select: { pitches: true } }, seats: { select: { status: true } } },
    }),
    db.pitch.findMany({
      where: { status: "LISTED", OR: [{ deal: null }, { deal: { status: "OPEN" } }] },
      orderBy: { listedAt: "desc" },
      select: { id: true, title: true, sector: true },
    }),
  ]);
  const video = videoStatus();
  const now = new Date();

  return (
    <>
      <PageHeader title="Tank sessions" description="Live pitch events: founders pitch to matched, Tier 4 investors who have signed the session NDA, moderated by RamiZeeZ." />
      <div className="grid gap-6 [&>*]:min-w-0 lg:grid-cols-[1fr_440px]">
        <Card title="Sessions">
          <ul className="divide-y divide-white/5">
            {sessions.map((s) => {
              const approved = s.seats.filter((x) => x.status === "APPROVED").length;
              const requested = s.seats.filter((x) => x.status === "REQUESTED").length;
              return (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <Link href={`/admin/tank/${s.id}`} className="font-medium text-white hover:text-brand-200">
                      {s.title}
                    </Link>
                    <p className="text-xs text-slate-400">
                      <LocalTime iso={s.startsAt.toISOString()} /> · {s._count.pitches} pitches · {approved}/{s.capacity} seats
                      {requested > 0 && <span className="text-brand-300"> · {requested} to review</span>}
                    </p>
                  </div>
                  <PhasePill phase={tankPhase(s, now)} />
                </li>
              );
            })}
            {!sessions.length && <li className="py-3 text-sm text-slate-500">No sessions yet.</li>}
          </ul>
        </Card>
        <Card title="Schedule a session" description={`Video: ${video.detail}.`}>
          {pitches.length ? (
            <ScheduleSessionForm provider={video.provider} pitches={pitches.map((p) => ({ value: p.id, label: `${pitchRef(p.id)} · ${p.title} (${p.sector ?? "—"})` }))} />
          ) : (
            <p className="text-sm text-slate-400">There are no listed pitches with an open round to invite.</p>
          )}
        </Card>
      </div>
    </>
  );
}
