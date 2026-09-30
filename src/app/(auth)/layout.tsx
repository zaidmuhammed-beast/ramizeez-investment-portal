import { Logo } from "@/components/logo";
import { LanguageSwitcher } from "@/components/language-switcher";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-10">
      <div className="flex w-full max-w-xl items-center justify-between gap-3">
        <Logo />
        <LanguageSwitcher />
      </div>
      <main className="mt-10 w-full max-w-xl">{children}</main>
    </div>
  );
}
