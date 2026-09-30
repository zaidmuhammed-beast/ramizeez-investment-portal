import { PublicNav } from "@/components/public-nav";
import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const portals = [
  {
    title: "For founders",
    body: "Pitch a startup idea or an existing business. Submit your experience, costing and roadmap. We screen every pitch and put the best ones in front of verified investors.",
    tag: "Pitch",
  },
  {
    title: "For investors",
    body: "See vetted opportunities that fit your verified budget, from Pakistan and around the world. Choose equity, Musharakah, Mudarabah or revenue-share deals.",
    tag: "Invest",
  },
  {
    title: "RamiZeeZ in the middle",
    body: "We verify everyone, protect founders' ideas, run the deal, hold funds in escrow against milestones, and manage execution, marketing and agreements.",
    tag: "Execute",
  },
];

const steps = [
  ["Verify", "Bank-grade identity checks: CNIC, NICOP or passport, a liveness selfie and sanctions screening."],
  ["Profile", "Your background, experience, goals and references, so we know who you are, not just your ID."],
  ["Pitch or qualify", "Founders submit a full proposal. Investors prove their funds and set their preferences."],
  ["Tank session", "Shortlisted founders pitch live to matched investors, moderated by RamiZeeZ."],
  ["Deal & execution", "Agreements, escrow and milestone-based releases, with RamiZeeZ managing delivery."],
];

const deals = [
  ["Equity", "Ownership in the business in return for capital."],
  ["Musharakah", "Shariah-compliant partnership: shared capital, shared profit and loss."],
  ["Mudarabah", "Shariah-compliant: the investor provides capital, the founder provides expertise, and profits are shared."],
  ["Revenue share", "Returns paid as an agreed share of revenue until a set multiple is reached."],
];

export default function Home() {
  return (
    <>
      <PublicNav />
      <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <section className="pt-10 pb-20 text-center sm:pt-20">
          <Badge tone="gold" className="mb-6">Pakistan · Overseas Pakistanis · Global investors</Badge>
          <h1 className="mx-auto max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">
            Where serious founders meet{" "}
            <span className="bg-gradient-to-r from-brand-300 via-teal-200 to-gold-300 bg-clip-text text-transparent">verified capital</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300">
            A Shark Tank-style investment platform by RamiZeeZ. Every founder and investor is verified, every pitch is screened,
            and every deal is managed end to end.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <LinkButton href="/signup?role=FOUNDER" className="px-6 py-3 text-base">
              I want to pitch
            </LinkButton>
            <LinkButton href="/signup?role=INVESTOR" variant="secondary" className="px-6 py-3 text-base">
              I want to invest
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
          <h2 className="text-center text-3xl font-semibold tracking-tight text-white">How it works</h2>
          <ol className="mt-10 grid gap-4 md:grid-cols-5">
            {steps.map(([title, body], i) => (
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
            <h2 className="text-2xl font-semibold text-white">Your idea stays yours</h2>
            <ul className="mt-6 space-y-4 text-sm text-slate-300">
              {[
                "Investors first see an anonymous teaser, never your name or secret sauce",
                "The full proposal opens only after a signed NDA and your approval",
                "Watermarked viewing, no downloads, and every view logged",
                "Timestamped proof of authorship when you submit",
                "No direct contact outside the platform before a signed agreement",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-300" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="glass rounded-3xl p-8">
            <h2 className="text-2xl font-semibold text-white">Deal structures</h2>
            <dl className="mt-6 space-y-5">
              {deals.map(([t, d]) => (
                <div key={t}>
                  <dt className="font-medium text-white">{t}</dt>
                  <dd className="mt-1 text-sm text-slate-400">{d}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>
      <footer className="border-t border-white/5 py-8 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} RamiZeeZ. All investments carry risk, including the loss of capital.
      </footer>
    </>
  );
}
