import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { sendReportReminders } from "@/lib/execution/service";

/**
 * Scheduled job: emails founders whose monthly investor reports are overdue.
 * Call daily or weekly from a cron service with `Authorization: Bearer <JOBS_SECRET>`.
 */
export async function POST(req: Request) {
  const secret = env().JOBS_SECRET;
  if (!secret) return new Response("Jobs are disabled: set JOBS_SECRET.", { status: 503 });
  const given = Buffer.from((req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, ""));
  const want = Buffer.from(secret);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return new Response("Unauthorized", { status: 401 });
  const sent = await sendReportReminders();
  return Response.json({ ok: true, reminded: sent });
}
