import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { getDict } from "@/i18n/server";
import { SecondFactorForm } from "./second-factor-form";

export const metadata: Metadata = { title: "Two-factor verification" };

export default async function SecondFactorPage() {
  const session = await getSession();
  if (!session) redirect("/login?expired=1");
  if (session.stage === "ACTIVE") redirect("/dashboard");
  const d = await getDict();
  const t = d.auth.secondFactor;
  return (
    <Card strong title={t.title} description={t.description}>
      <SecondFactorForm t={t} verify={d.common.verify} verifying={d.common.verifying} />
    </Card>
  );
}
