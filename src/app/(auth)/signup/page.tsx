import type { Metadata } from "next";
import Link from "next/link";
import { COUNTRIES } from "@/lib/countries";
import { Card } from "@/components/ui/card";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { role } = await searchParams;
  const preselected = role === "INVESTOR" || role === "FOUNDER" ? [role] : [];
  return (
    <Card
      strong
      title="Create your account"
      description="Step 1 of 5. Every account is identity-verified before it can pitch or invest."
    >
      <SignupForm countries={COUNTRIES} preselectedRoles={preselected} />
      <p className="mt-6 text-center text-sm text-slate-400">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand-300 hover:text-brand-200">
          Sign in
        </Link>
      </p>
    </Card>
  );
}
