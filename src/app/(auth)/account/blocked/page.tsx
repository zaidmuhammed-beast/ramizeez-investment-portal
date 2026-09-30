import { redirect } from "next/navigation";
import { BRAND } from "@/config/brand";
import { getSession } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { LogoutButton } from "@/components/logout-button";
import { fill } from "@/i18n/config";
import { getDict } from "@/i18n/server";

export default async function BlockedPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const { status, statusReason } = session.user;
  if (status === "ACTIVE") redirect("/dashboard");
  const d = await getDict();
  const t = d.auth.blocked;
  return (
    <Card strong title={status === "SUSPENDED" ? t.suspended : t.unavailable} actions={<LogoutButton label={d.common.signOut} />}>
      <p className="text-sm text-slate-300">
        {statusReason ?? t.fallback} {fill(t.contact, { email: BRAND.supportEmail })}
      </p>
    </Card>
  );
}
