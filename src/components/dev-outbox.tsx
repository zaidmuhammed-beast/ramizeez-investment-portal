import "server-only";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

/** Development helper: shows the latest codes "sent" to this user, since no real email/SMS provider is wired yet. */
export async function DevOutbox({ to }: { to: string[] }) {
  if (!env().DEV_SHOW_OTP) return null;
  const messages = await db.outboundMessage.findMany({
    where: { to: { in: to } },
    orderBy: { createdAt: "desc" },
    take: 4,
  });
  if (!messages.length) return null;
  return (
    <aside className="mt-6 rounded-xl border border-dashed border-amber-400/40 bg-amber-400/5 p-4 text-xs text-amber-100">
      <p className="mb-2 font-semibold uppercase tracking-wider text-amber-300">Development mode: outbox</p>
      <ul className="space-y-1.5">
        {messages.map((m) => (
          <li key={m.id} className="font-mono">
            <span className="text-amber-300">{m.channel === "EMAIL" ? "✉" : "📱"} {m.to}</span>{" "}
            {m.body.match(/\b\d{6}\b/)?.[0] ?? m.body}
          </li>
        ))}
      </ul>
    </aside>
  );
}
