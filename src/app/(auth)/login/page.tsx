import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/config/brand";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { fill } from "@/i18n/config";
import { getDict } from "@/i18n/server";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { expired } = await searchParams;
  const t = (await getDict()).auth.login;
  return (
    <Card strong title={t.title} description={t.description}>
      {expired && (
        <Alert tone="warn" className="mb-5">
          {t.expired}
        </Alert>
      )}
      <LoginForm t={t} />
      <p className="mt-6 text-center text-sm text-slate-400">
        {fill(t.newHere, { brand: BRAND.name })}{" "}
        <Link href="/signup" className="font-medium text-brand-300 hover:text-brand-200">
          {t.create}
        </Link>
      </p>
    </Card>
  );
}
