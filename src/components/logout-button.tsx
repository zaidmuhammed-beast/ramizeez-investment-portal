import { logoutAction } from "@/app/(auth)/actions";

export function LogoutButton({ className }: { className?: string }) {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className={className ?? "rounded-lg px-3 py-1.5 text-sm text-slate-400 transition hover:bg-white/5 hover:text-white"}
      >
        Sign out
      </button>
    </form>
  );
}
