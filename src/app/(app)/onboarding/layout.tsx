import { AppNav } from "@/components/app-nav";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppNav
        className="glass mb-8 w-fit max-w-full rounded-2xl p-1.5"
        items={[
          { href: "/onboarding/identity", label: "1 · Identity" },
          { href: "/onboarding/profile", label: "2 · Profile" },
          { href: "/onboarding/role", label: "3 · Role verification" },
          { href: "/onboarding/final", label: "4 · Final approval" },
        ]}
      />
      {children}
    </>
  );
}
