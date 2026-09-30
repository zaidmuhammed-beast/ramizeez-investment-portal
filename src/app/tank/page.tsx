import type { Metadata } from "next";
import { db } from "@/lib/db";
import { formatMoney } from "@/config/platform";
import { tankPhase } from "@/lib/tank/rules";
import { PublicNav } from "@/components/public-nav";
import { fill } from "@/i18n/config";
import { getDict } from "@/i18n/server";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LocalTime } from "@/components/local-time";
import { PhasePill } from "@/components/tank/views";

export const metadata: Metadata = { title: "Live Tank sessions", description: "Upcoming live pitch sessions for verified investors." };
export const dynamic = "force-dynamic";

const DEAL: Record<string, string> = { EQUITY: "Equity", MUSHARAKAH: "Musharakah", MUDARABAH: "Mudarabah", REVENUE_SHARE: "Revenue share" };

/** Public events page. Businesses stay anonymous: only sector, stage, raise and structure are shown. */
export default async function TankEventsPage() {
  const t = (await getDict()).tank;
  const now = new Date();
  const sessions = await db.tankSession.findMany({
    where: { status: "SCHEDULED", startsAt: { gte: new Date(now.getTime() - 4 * 3600_000) } },
    orderBy: { startsAt: "asc" },
    take: 12,
    include: { pitches: { where: { status: { not: "DECLINED" } }, orderBy: { position: "asc" }, include: { pitch: { select: { sector: true, type: true, amount: true, currency: true, dealType: true } } } } },
  });
  return (
    <>
      <PublicNav />
      <main className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
        <section className="py-12 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">{t.title}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-slate-300">
            {t.intro}
          </p>
        </section>
        <div className="space-y-5">
          {sessions.map((s) => (
            <Card key={s.id} title={s.title} description={<LocalTime iso={s.startsAt.toISOString()} />} actions={<PhasePill phase={tankPhase(s, now)} />}>
              {s.description && <p className="mb-4 whitespace-pre-line text-sm text-slate-300">{s.description}</p>}
              <ul className="grid gap-2 sm:grid-cols-2">
                {s.pitches.map((tp) => (
                  <li key={tp.id} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
                    <p className="text-white">{tp.pitch.sector}</p>
                    <p className="text-xs text-slate-400">
                      {tp.pitch.type === "IDEA" ? t.idea : t.operating} · {fill(t.raising, { amount: formatMoney(Number(tp.pitch.amount ?? 0), tp.pitch.currency) })}
                      {tp.pitch.dealType && ` · ${DEAL[tp.pitch.dealType]}`}
                    </p>
                  </li>
                ))}
              </ul>
              <div className="mt-5">
                <LinkButton href={`/sessions/${s.id}`} variant="secondary">
                  {t.requestSeat}
                </LinkButton>
              </div>
            </Card>
          ))}
          {!sessions.length && (
            <Card>
              <p className="text-center text-sm text-slate-400">{t.none}</p>
            </Card>
          )}
        </div>
      </main>
    </>
  );
}
