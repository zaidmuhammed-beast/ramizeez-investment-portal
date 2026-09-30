import { PublicNav } from "@/components/public-nav";
import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MIN_AMOUNT_PKR, PLATFORM_TERMS } from "@/config/platform";
import { fill } from "@/i18n/config";
import { getDict } from "@/i18n/server";

export default async function Home() {
  const t = (await getDict()).home;
  const portals = t.portals.map((p) => ({ ...p, body: fill(p.body, { min: MIN_AMOUNT_PKR.toLocaleString("en-US"), fee: PLATFORM_TERMS.successFeePercent, share: PLATFORM_TERMS.businessSharePercent }) }));
  const now = new Date();
  return (
    <>
      <PublicNav />
      <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <section className="pt-10 pb-20 text-center sm:pt-20">
          <Badge tone="gold" className="mb-6">{t.badge}</Badge>
          <h1 className="mx-auto max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">
            {t.titleStart}{" "}
            <span className="bg-gradient-to-r from-brand-300 via-teal-200 to-gold-300 bg-clip-text text-transparent">{t.titleHighlight}</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300">
            {t.intro}
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <LinkButton href="/signup?role=FOUNDER" className="px-6 py-3 text-base">
              {t.ctaPitch}
            </LinkButton>
            <LinkButton href="/signup?role=INVESTOR" variant="secondary" className="px-6 py-3 text-base">
              {t.ctaInvest}
            </LinkButton>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-3">
          {portals.map((p) => (
            <article key={p.title} className="glass rounded-2xl p-7">
              <Badge tone="green">{p.tag}</Badge>
              <h2 className="mt-4 text-xl font-semibold text-white">{p.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">{p.body}</p>
            </article>
          ))}
        </section>

        <section className="mt-24">
          <h2 className="text-center text-3xl font-semibold tracking-tight text-white">{t.howTitle}</h2>
          <ol className="mt-10 grid gap-4 md:grid-cols-5">
            {t.steps.map(([title, body], i) => (
              <li key={title} className="glass rounded-2xl p-5">
                <span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-teal-300 text-sm font-semibold text-ink-950">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm text-slate-400">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-24 grid items-start gap-6 lg:grid-cols-2">
          <div className="glass-strong rounded-3xl p-8">
            <h2 className="text-2xl font-semibold text-white">{t.protectTitle}</h2>
            <ul className="mt-6 space-y-4 text-sm text-slate-300">
              {t.protect.map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-300" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="glass rounded-3xl p-8">
            <h2 className="text-2xl font-semibold text-white">{t.dealsTitle}</h2>
            <dl className="mt-6 space-y-5">
              {t.deals.map(([name, d]) => (
                <div key={name}>
                  <dt className="font-medium text-white">{name}</dt>
                  <dd className="mt-1 text-sm text-slate-400">{d}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>
      <footer className="border-t border-white/5 py-8 text-center text-xs text-slate-500">
        {fill(t.footer, { year: now.getFullYear() })}
      </footer>
    </>
  );
}
