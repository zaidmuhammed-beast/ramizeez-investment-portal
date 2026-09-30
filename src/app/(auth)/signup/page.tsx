import type { Metadata } from "next";
import Link from "next/link";
import { COUNTRIES } from "@/lib/countries";
import { Card } from "@/components/ui/card";
import { getDict } from "@/i18n/server";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { role } = await searchParams;
  const preselected = role === "INVESTOR" || role === "FOUNDER" ? [role] : [];
  const d = await getDict();
  const t = d.auth.signup;
  return (
    <Card
      strong
      title={t.title}
      description={t.description}
    >
      <SignupForm countries={COUNTRIES} preselectedRoles={preselected} t={t} rules={d.passwordRules} select={d.common.select} />
      <p className="mt-6 text-center text-sm text-slate-400">
        {t.haveAccount}{" "}
        <Link href="/login" className="font-medium text-brand-300 hover:text-brand-200">
          {d.common.signIn}
        </Link>
      </p>
    </Card>
  );
}
