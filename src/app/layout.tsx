import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { BRAND } from "@/config/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description:
    "A RamiZeeZ initiative connecting verified founders with verified investors — pitch, invest and execute with RamiZeeZ in the middle.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh font-sans">
        <div aria-hidden className="orb -left-40 top-24 size-[28rem] bg-brand-500" />
        <div aria-hidden className="orb -right-32 top-1/3 size-[26rem] bg-violet-600" />
        <div aria-hidden className="orb bottom-0 left-1/3 size-[22rem] bg-sky-500 opacity-20" />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
