import { setLocaleAction } from "@/i18n/actions";
import { getLocale } from "@/i18n/server";

/** Toggles between English and Urdu. Works without JavaScript (a plain form post). */
export async function LanguageSwitcher({ className }: { className?: string }) {
  const locale = await getLocale();
  const other = locale === "ur" ? "en" : "ur";
  return (
    <form action={setLocaleAction.bind(null, other)}>
      <button
        type="submit"
        lang={other}
        className={className ?? "rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white"}
        aria-label={other === "ur" ? "اردو میں دیکھیں (View in Urdu)" : "View in English"}
      >
        {other === "ur" ? "اردو" : "English"}
      </button>
    </form>
  );
}
