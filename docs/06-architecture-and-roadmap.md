# 6. Architecture, security & roadmap

## 6.1 Proposed tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| Web app (all 3 portals) | **Next.js + TypeScript** | One codebase, fast, good for SEO on public pages |
| API / backend | Next.js Server Actions and route handlers (a separate service can be split out later if needed) | One deployable, with auth checked in every action |
| Database | **PostgreSQL** + Prisma ORM | Relational data, transactions, reliable |
| File storage | S3-compatible, **encrypted**, private buckets, signed URLs | KYC documents, pitch files |
| Cache / queues | Redis + a job queue | OTPs, rate limits, background KYC and AML checks |
| Auth | Email + phone OTP, TOTP / **passkeys**, short-lived sessions | Top-level account security |
| KYC / AML | A third-party provider (Shufti Pro / Sumsub / Veriff) + NADRA Verisys | Document forensics, liveness, sanctions and PEP |
| E-signature | A provider (for example DocuSign, or a local option) | NDAs, term sheets, agreements |
| Video | A video API for interviews and Tank sessions | Recording, watermarking |
| Mobile | A responsive web app first → React Native app later | Camera-based KYC works on mobile web |
| Hosting | A cloud provider with a data centre region that meets our data-residency needs | Compliance |

## 6.2 Security baseline

- HTTPS everywhere, a strict security header policy, and a web application firewall
- Field-level encryption for CNIC/passport numbers and financial data, with keys held in a key management service
- Role-based access control for everything, least privilege, and maker-checker for high-risk actions
- An audit log of every read and write on sensitive data that cannot be edited
- Rate limiting and bot protection on sign-up, login, OTP and unlock endpoints
- Regular dependency scanning, a penetration test before launch, then yearly
- Backups with encryption and tested restore, plus a disaster recovery plan

## 6.3 Legal & compliance (confirm with a lawyer before launch)

- **Regulation:** raising money from the public for businesses may need approval or a licence from the **SECP** (for example under its crowdfunding or regulatory sandbox framework). Get legal advice on RamiZeeZ's exact role (platform, broker, advisor or fund) before accepting investor money.
- **AML/CFT:** follow Pakistan's anti-money-laundering rules (customer due diligence, beneficial ownership, record keeping, suspicious transaction reporting to the FMU) and international sanctions screening.
- **Escrow:** investor money should be held by a **licensed bank or trustee**, never in RamiZeeZ's operating account.
- **Data protection:** follow Pakistan's data protection requirements, plus GDPR if we accept EU users. Publish a clear privacy policy.
- **Documents:** Terms of Use, Privacy Policy, Founder Listing Agreement, Investor Agreement, NDA, Non-Circumvention Agreement, risk disclosures, and Shariah board review for Islamic structures (if offered).

## 6.4 Phased delivery

| Phase | Scope | Result |
|-------|-------|--------|
| **1: Foundation** ✅ | Project setup, design system, auth (OTP + 2FA/passkey), roles, admin login, audit log | Secure accounts for all 3 user types |
| **2: Verification** ✅ | Tiers 0–4, KYC provider integration, deep profile forms, verification queue, AML screening | Only verified users on the platform |
| **3: Pitching** ✅ | Pitch builder (all sections, costing table, roadmap), drafts, submission, screening pipeline | Founders can submit, the team can screen |
| **4: Investor portal** ✅ | Investor profile & verified budget, matching, blind teasers, NDA e-sign, secure viewer & watermarking, unlock quotas | Investors browse safely |
| **5: Deals** ✅ | Q&A, offers, term sheets, agreements, e-signature, escrow & milestone tracking | Deals close on the platform |
| **6: Tank & growth** ✅ | Live pitch sessions, execution and marketing module, investor reports, mobile app, Urdu language | The full Shark Tank experience |

## 6.5 Decisions

| # | Topic | Decision |
|---|-------|----------|
| 1 | Legal status | Legal agreements are in progress. The `/legal/*` pages are placeholders until they're final. |
| 2 | Launch market | Pakistan, **all overseas Pakistanis and foreign investors** from launch: any country of residence, international phone numbers, CNIC / NICOP / passport / national ID, multi-currency budgets. |
| 3 | Identity-check provider | **In-house checks for testing now** (see the README), behind a `KycProvider` interface, so **Sumsub** can be plugged in later without changing the flow. |
| 4 | Deal types | Users choose any mix of **Equity, Musharakah, Mudarabah, Revenue share**. Investors can also ask to see only Shariah-compliant deals. |
| 5 | RamiZeeZ revenue | **10% of each raise** (success fee) plus **a 25% share in each business**. Founders accept these terms during role verification. The terms carry a version, so changing them makes founders re-accept. Set in `src/config/platform.ts`. |
| 6 | Tech stack | **Next.js + TypeScript + PostgreSQL** (Prisma ORM), with a clean **glassmorphic** UI. |
| 7 | Minimum amount | **PKR 100,000** for each pitch's raise and each investment. Foreign-currency amounts are checked with indicative exchange rates in `src/config/platform.ts`; review them monthly or connect a live feed. |
| 8 | Branding | **To be decided.** "RamiZeeZ Ventures" is a placeholder set in one place (`src/config/brand.ts`, plus the logo mark). |
| 9 | Email & SMS providers | **To be chosen later.** Three options for each are built in, selected with environment variables: email via **Resend, SendGrid or any SMTP server**; SMS via **Twilio, Vonage, or a generic HTTP gateway** for Pakistani aggregators. Admin → Settings shows the active providers and sends test messages. |
| 10 | Escrow | Until a licensed bank or trustee is appointed, escrow is a **manual ledger** kept by finance: every deposit, release and refund is recorded against a bank reference and posts only after a second team member approves it. The bank integration will replace the manual recording step, not the rules. |
| 11 | Live video | **To be chosen later.** Three options are built in, selected with `VIDEO_PROVIDER`: paste any **Zoom / Meet / Teams link**, **Jitsi** (public or self-hosted with signed tokens), or **Daily.co** (private rooms, personal tokens, optional recording). |
| 12 | Languages | English and **Urdu** (right-to-left). The language is chosen with a switch and stored in a cookie and on the account, rather than in the URL, so no page moves. |
| 13 | Mobile | An **installable web app (PWA)** instead of a separate native app for now. It works on Android, iPhone and desktop, with the camera-based KYC on mobile web. A React Native app can follow if needed. |

## 6.6 Remaining open questions

1. How the 25% business share applies to non-equity deals (Musharakah, Mudarabah, revenue share), for example as a 25% share of the profit or revenue. Confirm with legal and the Shariah advisor.
2. Whether the success fee and business share will ever vary by deal size. They are fixed for now.
3. The final name and branding.
4. The final wording of the term sheet and agreement templates (`src/config/agreements.ts`), including Shariah board sign-off for Musharakah and Mudarabah.
5. Which bank or trustee will hold escrow.
6. Which email and SMS providers to use.
7. Which video provider to use for Tank sessions.
8. A native-speaker review of the Urdu text, and which remaining pages to translate first.
9. Whether to add push notifications to the installable app (needs VAPID keys and a subscription store) or a native app.
10. How profit distributions to Musharakah, Mudarabah and revenue-share investors are paid out. Reports show indicative amounts only.
