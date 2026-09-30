import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { DevOutbox } from "@/components/dev-outbox";
import { LogoutButton } from "@/components/logout-button";
import { ContactCodeForm } from "./contact-code-form";

export const metadata: Metadata = { title: "Verify your contact details" };

const maskEmail = (e: string) => e.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => a + "•".repeat(Math.min(b.length, 6)) + c);
const maskPhone = (p: string) => p.slice(0, 4) + "•".repeat(Math.max(p.length - 7, 3)) + p.slice(-3);

export default async function VerifyContactPage() {
  const user = await requireUser("contact");
  if (user.emailVerifiedAt && user.phoneVerifiedAt) redirect("/setup-2fa");
  return (
    <Card
      strong
      title="Verify your email and mobile"
      description="Step 2 of 5. We sent a 6-digit code to each. Codes expire after 10 minutes."
      actions={<LogoutButton />}
    >
      <div className="space-y-4">
        <ContactCodeForm channel="EMAIL" destination={maskEmail(user.email)} verified={!!user.emailVerifiedAt} />
        <ContactCodeForm channel="PHONE" destination={maskPhone(user.phone)} verified={!!user.phoneVerifiedAt} />
      </div>
      <DevOutbox to={[user.email, user.phone]} />
    </Card>
  );
}
