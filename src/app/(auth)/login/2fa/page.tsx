import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { SecondFactorForm } from "./second-factor-form";

export const metadata: Metadata = { title: "Two-factor verification" };

export default async function SecondFactorPage() {
  const session = await getSession();
  if (!session) redirect("/login?expired=1");
  if (session.stage === "ACTIVE") redirect("/dashboard");
  return (
    <Card strong title="Two-factor verification" description="Enter the 6-digit code from your authenticator app.">
      <SecondFactorForm />
    </Card>
  );
}
