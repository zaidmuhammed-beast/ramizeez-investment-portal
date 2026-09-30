import { redirect } from "next/navigation";
import { BRAND } from "@/config/brand";
import { getSession } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { LogoutButton } from "@/components/logout-button";

export default async function BlockedPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const { status, statusReason } = session.user;
  if (status === "ACTIVE") redirect("/dashboard");
  return (
    <Card strong title={status === "SUSPENDED" ? "Account suspended" : "Account unavailable"} actions={<LogoutButton />}>
      <p className="text-sm text-slate-300">
        {statusReason ?? "Your account can't be used right now."} If you believe this is a mistake, contact {BRAND.supportEmail} and
        quote your registered email address.
      </p>
    </Card>
  );
}
