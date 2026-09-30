import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { getLocale } from "@/i18n/server";

export const metadata: Metadata = { title: "Offline" };

const TEXT = {
  en: { title: "You're offline", body: "Check your internet connection and try again. For your security, pages with your account and deal information are never stored on this device.", retry: "Try again" },
  ur: { title: "آپ آف لائن ہیں", body: "اپنا انٹرنیٹ کنکشن چیک کر کے دوبارہ کوشش کریں۔ آپ کی حفاظت کے لیے اکاؤنٹ اور ڈیل کی معلومات والے صفحات اس ڈیوائس پر محفوظ نہیں کیے جاتے۔", retry: "دوبارہ کوشش کریں" },
};

export default async function OfflinePage() {
  const t = TEXT[await getLocale()];
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo />
      <div className="glass max-w-md rounded-2xl p-8">
        <h1 className="text-2xl font-semibold text-white">{t.title}</h1>
        <p className="mt-3 text-sm text-slate-300">{t.body}</p>
        {/* A plain link reloads without JavaScript. */}
        <a href="/dashboard" className="mt-6 inline-block rounded-xl bg-gradient-to-r from-brand-500 to-teal-400 px-5 py-2.5 text-sm font-medium text-ink-950">
          {t.retry}
        </a>
      </div>
    </main>
  );
}
