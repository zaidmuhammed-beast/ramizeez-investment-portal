import type { Metadata } from "next";
import QRCode from "qrcode";
import { redirect } from "next/navigation";
import { BRAND } from "@/config/brand";
import { homeFor, requireUser } from "@/lib/auth/session";
import { ensureTotpSecret } from "@/lib/auth/totp-store";
import { otpauthUrl } from "@/lib/auth/totp";
import { Card } from "@/components/ui/card";
import { LogoutButton } from "@/components/logout-button";
import { getDict } from "@/i18n/server";
import { TotpSetupForm } from "./totp-setup-form";

export const metadata: Metadata = { title: "Secure your account" };

export default async function SetupTwoFactorPage() {
  const user = await requireUser("2fa");
  if (user.totpEnabledAt) redirect(homeFor(user));
  const secret = await ensureTotpSecret(user.id);
  const d = await getDict();
  const t = d.auth.setup;
  const qr = await QRCode.toDataURL(otpauthUrl(secret, user.email, BRAND.name), {
    margin: 1,
    width: 220,
    color: { dark: "#0a0f24", light: "#ffffff" },
  });
  return (
    <Card
      strong
      title={t.title}
      description={t.description}
      actions={<LogoutButton label={d.common.signOut} />}
    >
      <TotpSetupForm qr={qr} secret={secret.match(/.{1,4}/g)!.join(" ")} next={homeFor(user)} t={{ ...t, continue: d.common.continue, verifying: d.common.verifying }} />
    </Card>
  );
}
