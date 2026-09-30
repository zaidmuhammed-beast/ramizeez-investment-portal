import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { BRAND } from "@/config/brand";
import { dirOf } from "@/i18n/config";
import { getLocale } from "@/i18n/server";
import { env } from "@/lib/env";
// Only the Arabic-script subset: it downloads only when Urdu text is on screen.
import "@fontsource/noto-nastaliq-urdu/arabic-400.css";
import "@fontsource/noto-nastaliq-urdu/arabic-700.css";
import "./globals.css";
import { ServiceWorkerRegistration } from "@/components/service-worker";

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description:
    "A RamiZeeZ initiative connecting verified founders with verified investors — pitch, invest and execute with RamiZeeZ in the middle.",
  applicationName: BRAND.name,
  appleWebApp: { capable: true, title: "RamiZeeZ", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0a0f24",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={locale} dir={dirOf(locale)} className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh font-sans">
        <div aria-hidden className="orb -left-40 top-24 size-[28rem] bg-brand-500" />
        <div aria-hidden className="orb -right-32 top-1/3 size-[26rem] bg-violet-600" />
        <div aria-hidden className="orb bottom-0 left-1/3 size-[22rem] bg-sky-500 opacity-20" />
        {env().APP_ENV === "staging" && (
          <div role="note" className="relative z-20 bg-amber-400/90 px-4 py-1.5 text-center text-xs font-medium text-ink-950">
            {locale === "ur"
              ? "آزمائشی ماحول: اصلی شناختی دستاویزات یا مالی معلومات درج نہ کریں۔ یہاں کوئی حقیقی سرمایہ کاری نہیں ہوتی۔"
              : "Test environment: don't enter real ID documents or financial details. No real investments happen here."}
          </div>
        )}
        <div className="relative z-10">{children}</div>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
