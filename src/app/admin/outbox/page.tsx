import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireTeam } from "@/lib/auth/rbac";
import { Card, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Outbox" };

export default async function OutboxPage() {
  await requireTeam("outbox.view");
  const messages = await db.outboundMessage.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return (
    <>
      <PageHeader
        title="Message outbox"
        description="Every email and SMS the platform sends. Real email and SMS providers aren't connected yet, so messages are recorded here."
      />
      <Card>
        <ul className="divide-y divide-white/5">
          {messages.map((m) => (
            <li key={m.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={m.channel === "EMAIL" ? "blue" : "violet"}>{m.channel === "EMAIL" ? "Email" : "SMS"}</Badge>
                <span className="text-white">{m.to}</span>
                <span className="text-xs text-slate-500">{m.createdAt.toUTCString()}</span>
              </div>
              {m.subject && <p className="mt-1 font-medium text-slate-200">{m.subject}</p>}
              <p className="mt-1 text-slate-400">{m.body.replace(/\b\d{6}\b/g, "••••••")}</p>
            </li>
          ))}
          {!messages.length && <li className="py-6 text-center text-slate-400">No messages yet.</li>}
        </ul>
      </Card>
    </>
  );
}
