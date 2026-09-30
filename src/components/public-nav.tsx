import Link from "next/link";
import { getDict } from "@/i18n/server";
import { Logo } from "./logo";
import { LinkButton } from "./ui/button";
import { LanguageSwitcher } from "./language-switcher";

export async function PublicNav() {
  const t = await getDict();
  return (
    <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6">
      <Logo />
      <nav className="flex items-center gap-2">
        <Link href="/tank" className="hidden rounded-xl px-4 py-2.5 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white sm:inline-block">
          {t.common.tankSessions}
        </Link>
        <LanguageSwitcher />
        <Link href="/login" className="rounded-xl px-4 py-2.5 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white">
          {t.common.signIn}
        </Link>
        <LinkButton href="/signup">{t.common.getStarted}</LinkButton>
      </nav>
    </header>
  );
}
