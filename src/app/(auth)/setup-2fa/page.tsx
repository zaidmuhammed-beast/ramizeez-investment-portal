import type { Metadata } from "next";
import QRCode from "qrcode";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { homeFor, requireUser } from "@/lib/auth/session";
import { ensureTotpSecret } from "@/lib/auth/totp-store";
import { otpauthUrl } from "@/lib/auth/totp";
import { Card } from "@/components/ui/card";
import { LogoutButton } from "@/components/logout-button";
import { TotpSetupForm } from "./totp-setup-form";

export const metadata: Metadata = { title: "Secure your account" };

export default async function SetupTwoFactorPage() {
  const user = await requireUser("2fa");
  if (user.totpEnabledAt) redirect(homeFor(user));
  const secret = await ensureTotpSecret(user.id);
  const qr = await QRCode.toDataURL(otpauthUrl(secret, user.email, env().APP_NAME), {
    margin: 1,
    width: 220,
    color: { dark: "#0a0f24", light: "#ffffff" },
  });
  return (
    <Card
      strong
      title="Turn on two-factor authentication"
      description="Step 3 of 5. Required for every account. Use Google Authenticator, Microsoft Authenticator, Authy or 1Password."
      actions={<LogoutButton />}
    >
      <TotpSetupForm qr={qr} secret={secret.match(/.{1,4}/g)!.join(" ")} next={homeFor(user)} />
    </Card>
  );
}
