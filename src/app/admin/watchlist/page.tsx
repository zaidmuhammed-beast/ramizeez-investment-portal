import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireTeam } from "@/lib/auth/rbac";
import { COUNTRIES } from "@/lib/countries";
import { Card, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/button";
import { deleteWatchlistAction } from "../actions";
import { WatchlistForm } from "./watchlist-form";

export const metadata: Metadata = { title: "Watchlist" };

export default async function WatchlistPage() {
  await requireTeam("watchlist.manage");
  const entries = await db.watchlistEntry.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
  return (
    <>
      <PageHeader
        title="AML watchlist"
        description="Every sign-up is screened against these names, and again at final approval. Load sanctions, proscribed-person and PEP lists here until an external screening provider (e.g. Sumsub) is connected."
      />
      <div className="grid gap-6 [&>*]:min-w-0 lg:grid-cols-[1fr_380px]">
        <Card>
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="pb-3 font-medium">Name</th>
                <th className="pb-3 font-medium">List</th>
                <th className="pb-3 font-medium">DOB / country</th>
                <th className="pb-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="py-3">
                    <p className="text-white">{e.fullName}</p>
                    {e.aliases.length > 0 && <p className="text-xs text-slate-500">aka {e.aliases.join(", ")}</p>}
                  </td>
                  <td className="py-3">
                    <Badge tone="amber">{e.listSource}</Badge>
                  </td>
                  <td className="py-3 text-slate-400">
                    {e.dateOfBirth?.toISOString().slice(0, 10) ?? "—"} / {e.country ?? "—"}
                  </td>
                  <td className="py-3 text-right">
                    <form action={deleteWatchlistAction.bind(null, e.id)}>
                      <SubmitButton variant="ghost" className="px-2 py-1 text-xs">
                        Remove
                      </SubmitButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!entries.length && <p className="py-6 text-center text-sm text-slate-400">The watchlist is empty.</p>}
        </Card>
        <Card title="Add entry" strong>
          <WatchlistForm countries={COUNTRIES.map((c) => ({ value: c.code, label: c.name }))} />
        </Card>
      </div>
    </>
  );
}
