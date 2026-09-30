import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireTeam } from "@/lib/auth/rbac";
import { Card, PageHeader } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Outbox" };

const STATUS: Record<string, { tone: BadgeTone; label: string }> = {
  RECORDED: { tone: "amber", label: "Recorded only" },
  SENT: { tone: "green", label: "Sent" },
  FAILED: { tone: "red", label: "Failed" },
};

export default async function OutboxPage() {
  await requireTeam("outbox.view");
  const messages = await db.outboundMessage.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return (
    <>
      <PageHeader
        title="Message log"
        description="Every email and SMS the platform sends, with the provider's result. “Recorded only” means the testing outbox is in use, so nothing was delivered."
      />
      <Card>
        <ul className="divide-y divide-white/5">
          {messages.map((m) => (
            <li key={m.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={m.channel === "EMAIL" ? "blue" : "violet"}>{m.channel === "EMAIL" ? "Email" : "SMS"}</Badge>
                <Badge tone={STATUS[m.status].tone}>{STATUS[m.status].label}</Badge>
                <span className="text-white">{m.to}</span>
                <span className="text-xs text-slate-500">
                  via {m.provider} · {m.createdAt.toUTCString()}
                </span>
              </div>
              {m.subject && <p className="mt-1 font-medium text-slate-200">{m.subject}</p>}
              <p className="mt-1 text-slate-400">{m.body.replace(/\b\d{6}\b/g, "••••••")}</p>
              {m.error && <p className="mt-1 font-mono text-xs text-rose-300">{m.error}</p>}
            </li>
          ))}
          {!messages.length && <li className="py-6 text-center text-slate-400">No messages yet.</li>}
        </ul>
      </Card>
    </>
  );
}
