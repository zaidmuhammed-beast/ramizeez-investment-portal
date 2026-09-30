// E2E helper: moves a Tank session's start, or a round's funding date, relative to now, so the
// test can reach "live" and "report overdue" states without waiting. Run with the app's .env loaded.
//   npx tsx --env-file=.env tests/e2e/time-travel.ts session <sessionId> <minutesFromNow>
//   npx tsx --env-file=.env tests/e2e/time-travel.ts deal <pitchId> <minutesFromNow>
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const [kind, id, minutes] = process.argv.slice(2);
  const when = new Date(Date.now() + Number(minutes) * 60_000);
  if (kind === "session") await db.tankSession.update({ where: { id }, data: { startsAt: when } });
  else if (kind === "deal") await db.deal.update({ where: { pitchId: id }, data: { fundedAt: when } });
  else throw new Error(`Unknown kind ${kind}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
