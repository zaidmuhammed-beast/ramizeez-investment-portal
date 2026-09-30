import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { expired } = await searchParams;
  return (
    <Card strong title="Welcome back" description="Sign in with your password and authenticator app.">
      {expired && (
        <Alert tone="warn" className="mb-5">
          Your sign-in attempt expired. Please start again.
        </Alert>
      )}
      <LoginForm />
      <p className="mt-6 text-center text-sm text-slate-400">
        New to RamiZeeZ Ventures?{" "}
        <Link href="/signup" className="font-medium text-brand-300 hover:text-brand-200">
          Create an account
        </Link>
      </p>
    </Card>
  );
}
