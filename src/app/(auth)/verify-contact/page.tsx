import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { DevOutbox } from "@/components/dev-outbox";
import { LogoutButton } from "@/components/logout-button";
import { getDict } from "@/i18n/server";
import { ContactCodeForm } from "./contact-code-form";

export const metadata: Metadata = { title: "Verify your contact details" };

const maskEmail = (e: string) => e.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => a + "•".repeat(Math.min(b.length, 6)) + c);
const maskPhone = (p: string) => p.slice(0, 4) + "•".repeat(Math.max(p.length - 7, 3)) + p.slice(-3);

export default async function VerifyContactPage() {
  const user = await requireUser("contact");
  if (user.emailVerifiedAt && user.phoneVerifiedAt) redirect("/setup-2fa");
  const d = await getDict();
  const t = d.auth.contact;
  const labels = { ...t, verify: d.common.verify, verified: d.common.verified };
  return (
    <Card
      strong
      title={t.title}
      description={t.description}
      actions={<LogoutButton label={d.common.signOut} />}
    >
      <div className="space-y-4">
        <ContactCodeForm channel="EMAIL" destination={maskEmail(user.email)} verified={!!user.emailVerifiedAt} t={labels} />
        <ContactCodeForm channel="PHONE" destination={maskPhone(user.phone)} verified={!!user.phoneVerifiedAt} t={labels} />
      </div>
      <DevOutbox to={[user.email, user.phone]} />
    </Card>
  );
}
