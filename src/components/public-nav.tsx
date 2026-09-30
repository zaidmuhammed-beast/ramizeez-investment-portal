import Link from "next/link";
import { Logo } from "./logo";
import { LinkButton } from "./ui/button";

export function PublicNav() {
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
      <Logo />
      <nav className="flex items-center gap-2">
        <Link href="/login" className="rounded-xl px-4 py-2.5 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white">
          Sign in
        </Link>
        <LinkButton href="/signup">Get started</LinkButton>
      </nav>
    </header>
  );
}
