# RamiZeeZ Investment Portal

A RamiZeeZ-backed platform, run like Shark Tank, that connects **founders** (people with a startup idea or an existing business that needs capital) with **verified investors** in Pakistan, overseas Pakistanis and foreign investors. RamiZeeZ sits in the middle as the trusted intermediary. It verifies everyone, screens every pitch, protects founders' ideas, and manages agreements, execution and marketing once a deal closes.

> **Status:** All six planned phases are built: secure accounts, the team portal, tiered verification (KYC), the pitch builder and screening pipeline, the investor portal with idea protection, deals (Q&A, offers, e-signed agreements, maker-checker escrow, milestone releases), and growth (live Tank sessions, execution and marketing, monthly investor reports, Urdu, and an installable mobile web app). What remains before launch is listed under [Before production](#before-production).

## Design documents

| # | Document | What it covers |
|---|----------|----------------|
| 1 | [Platform overview](docs/01-platform-overview.md) | User types, deal lifecycle, the RamiZeeZ role, revenue model |
| 2 | [Sign-up & verification](docs/02-signup-and-verification.md) | Tiered KYC, identity documents (CNIC / NICOP / passport), liveness, deep personal profile, role-specific checks |
| 3 | [Pitch submission](docs/03-pitch-submission.md) | What founders must submit (business details, proposal, costing, roadmap) and how pitches are screened |
| 4 | [Investor portal & idea protection](docs/04-investor-portal-and-idea-protection.md) | Budget-based matching, staged disclosure, NDAs, watermarking, anti-copy controls |
| 5 | [Admin & team portal](docs/05-admin-and-team-portal.md) | Team roles, review queues, deal pipeline, agreements, execution tracking |
| 6 | [Architecture, security & roadmap](docs/06-architecture-and-roadmap.md) | Tech stack, data protection, compliance, phased delivery, decisions |
| 7 | [Deploying to Netlify](docs/07-deploying-to-netlify.md) | Database, environment variables, first deploy, staging vs production |
| 8 | [Demo walkthrough](docs/08-demo-walkthrough.md) | Fictional businesses at every stage, and a 15-minute tour for clients |

## What's built

**Applicants (founders & investors)**
- Sign-up with the legal name as on the ID, the country of residence (any country), an international mobile number (validated per country), and one or both roles.
- Email **and** SMS one-time codes, then **mandatory authenticator-app 2FA** with 10 single-use recovery codes.
- **Tier 1: identity.** A CNIC, NICOP, passport (with MRZ) or other national ID, captured live with the camera. Then a **randomised liveness challenge** (3 prompted selfie frames), proof of address, and automatic sanctions/PEP screening.
- **Tier 2: deep profile.** Personal details, education, full work history, past businesses and lessons learned, 1-, 5- and 10-year life goals and motivation, values, a setback story, 2+ references, and signed integrity declarations.
- **Tier 3: role verification.**
  - Investors give their type (individual, high-net-worth, company, fund, family office), budget and ticket range, source of funds and wealth with **proof of funds**, sector, stage and region preferences, and accepted deal types (**Equity, Musharakah, Mudarabah, Revenue share**, or Shariah-only), then answer a risk and suitability questionnaire.
  - Founders give their stage, business and registration details, documents, and preferred deal types.
- **Tier 4: final approval.** A request for a video interview, re-screening against the watchlist, and a senior decision.

**Pitch builder (`/pitches`, founders)**
- Eleven guided sections: overview, team and experience, market, business model, current status (operating businesses only), the proposal, costing, roadmap, 5-year projections, risks, and deck/media.
- Deal terms with live maths for **Equity** (ownership preview including RamiZeeZ's 25%), **Musharakah**, **Mudarabah** and **Revenue share**.
- The **costing and milestone budgets must add up to the raise minus the 10% fee**, with a running total against that target. Milestones become the future escrow release schedule.
- A completeness checklist links to each open item. Submission requires Tier 2 and four declarations. It locks the pitch and stores a snapshot with a **SHA-256 fingerprint** as proof of authorship.

**Investor portal (`/opportunities`)**
- Listed pitches matched to each investor's **verified budget** (across currencies), accepted deal types and Shariah preference, ranked by fit and RamiZeeZ score, with a watchlist.
- **Three disclosure levels:**
  1. An anonymous teaser, with no name, founder or secret sauce.
  2. A summary, after e-signing a deal-specific NDA.
  3. The full data room, after an expression of interest that the founder or RamiZeeZ approves.
- Founders can mark sensitive fields as data-room only.
- **Anti-copy:**
  - An on-screen watermark with the viewer's identity.
  - Copy, right-click and print blocked.
  - Every document served as a PDF **watermarked on every page** with the viewer's name and ID.
  - Every view logged, and monthly unlock limits.
  - Contact details stripped from messages.
  - Misuse flags for the team.
- Founders see anonymous interest stats and approve requests. Matching investors are emailed when a pitch is listed.

**Pitch pipeline (`/admin/pitches`, team)**
- A board showing Submitted → Screening → Due diligence → Committee → Listed.
- A screening scorecard (6 criteria), a 6-item due-diligence checklist, and an anonymous investor teaser.
- Return or reject with feedback the founder sees. A returned pitch can be edited and resubmitted as a new version.
- Listing requires a Tier 4 founder, a teaser, and a committee approver who didn't screen the pitch or run its due diligence (four-eyes rule).

**Deals (`/investments`, `/pitches/[id]/deal`, `/admin/deals`)**
- **Moderated Q&A.** Investors with data-room access ask questions. Contact details are stripped, and the team approves each question before the founder sees it. Founders can share an answer with every data-room investor.
- **Offers and counter-offers** in the pitch's own structure:
  - Equity: % and pre-money valuation.
  - Musharakah / Mudarabah: profit share and term.
  - Revenue share: %, repayment cap and term.
  The PKR 100,000 minimum, the pitch's minimum ticket, the round's remaining capacity, single-investor rounds and the investor's verified budget are all enforced. Founders see investors only as "Investor 1, 2…".
- **Term sheet, then agreement.** Accepting an offer opens the round and issues a term sheet. Once all three parties have signed it (investor, founder, RamiZeeZ legal), legal issues the investment agreement from a structure-specific template (`src/config/agreements.ts`, a **draft for legal and Shariah review**).
  - Signing uses a typed legal name, which must match the verified name, plus consent.
  - Each document is fingerprinted with SHA-256, and a signature is refused if the text has changed.
  - Documents download as PDFs with the signature log.
- **Escrow ledger** (manual, until a licensed bank or trustee is connected):
  - Finance records deposits, releases and refunds against bank references.
  - Each entry posts only when a **different** team member approves it (maker-checker).
  - The round becomes **Funded** when every agreement is signed and every deposit posted. The 10% success fee is then queued automatically.
  - An early close scales milestone releases to the amount raised.
- **Milestone releases.** Founders submit evidence (text and files). The execution team approves it. Only then can finance release that milestone's budget, and never more than it.
- Once a round stops taking commitments, it disappears from new investors' feeds.

**Live Tank sessions (`/tank`, `/sessions`, `/admin/tank`)**
- The team (Deal Analyst, Marketing or Super Admin) schedules a session with up to 6 listed pitches whose rounds are open. Founders confirm, and choose whether attendees get their full data room afterwards.
- A public events page shows upcoming sessions with the businesses anonymised: sector, stage, raise and structure only.
- Matching Tier 4 investors are emailed. They sign one session NDA covering every pitch, and request a seat. The team approves seats up to the session's capacity.
- **Joining:**
  - Everyone joins through a personal, audited link that works from 15 minutes before the start to 15 minutes after the end.
  - The room address never appears in the page, and the redirect sends no referrer.
  - Team members join as moderators.
- **During the session**, attending investors can say “I'm in” with an amount. It isn't binding. The founder sees the interest anonymously; the team sees names.
- **Completing the session** opens the data room of each pitch whose founder allowed it to every investor who joined. This doesn't use their monthly quotas, so they can go straight to an offer. A recording link can be added for attendees, and every view of it is logged.
- **Video providers** (choose with `VIDEO_PROVIDER`, like email and SMS):
  - `link`: paste any Zoom, Google Meet or Teams link for each session.
  - `jitsi`: rooms are created automatically; with a self-hosted Jitsi, each attendee also gets a signed, expiring token.
  - `daily`: private Daily.co rooms with a personal meeting token per attendee, and optional cloud recording.

**Execution, marketing & monthly reports (`/admin/execution`, `/admin/marketing`)**
- Each funded company gets an **execution manager**, a **status** (on track / needs attention / at risk, with a note investors see; investors are emailed when a company moves to or from "at risk") and **tasks**. Founders see the tasks meant for them and update them; a blocked task alerts the manager.
- **Monthly investor reports.**
  - Each month's report is due by the 10th of the following month. It covers revenue, costs, cash in bank, customers, a key metric, highlights, challenges, asks and attachments.
  - The execution team publishes it, with optional commentary, or returns it with what to fix.
  - Investors see published reports with their **indicative return** for their structure:
    - Musharakah and Mudarabah profit or loss share
    - revenue share, capped at the agreed multiple
    - equity: profit attributable to their stake
  - Report attachments open for investors as watermarked PDFs.
  - Overdue reports trigger reminders, at most once a week per company. Send them from the team portal, or have a cron service call `POST /api/jobs/report-reminders` with `JOBS_SECRET`.
- **Marketing** runs campaigns per funded business (channel, objective, budget, dates) and records results. Reach, leads and customers give conversion rates and cost per customer. Founders and investors see campaigns; investors don't see budgets. The Marketing role never sees KYC documents or deal financials.

**Urdu & mobile**
- **English / اردو switch** on every public and applicant page. Urdu is shown right-to-left in Noto Nastaliq Urdu; numbers, codes and emails stay left-to-right.
- **Translated so far:** the landing page, the Tank events page, sign-up, sign-in, 2FA, contact verification, password change, the app navigation and the dashboard, including the messages those forms return.
- **Still in English:** the KYC forms, the pitch builder, the investor portal, deals and the team portal.
- The choice is remembered on the device and on the account.
- **Installable app (PWA):** add it to the home screen on Android and iPhone, or install it on desktop, with app icons and shortcuts. The service worker only provides an offline page. It never stores pages or files with personal or deal data.
- Checked at phone width (390 px) with no sideways scrolling on the key pages.

**Team portal (`/admin`)**
- A verification queue (oldest first) with each automated check's result, the ID images, the liveness frames next to their prompts, address proof, AML hits, internal notes, assignment and case history.
- Decisions (approve / request info / reject) with a required reason. The applicant is notified. Identity approval requires the officer to confirm that they checked liveness, face match and the document.
- **The verified budget is set by the officer** from the proof of funds. It will control which pitches an investor can see.
- **Four-eyes rule:** the person who approved an applicant's role verification cannot also give that applicant final approval.
- Role-based access for 9 team roles (least privilege), team member creation with forced password change, user suspension, the AML watchlist, the audit log, the message log, and settings (platform terms, email/SMS providers and test messages).

**Security**
- argon2id passwords with a check against breached passwords (Have I Been Pwned, k-anonymity).
- TOTP 2FA with replay protection, and an account lockout after 5 failed logins.
- Rate limits on sign-up, login, one-time codes, 2FA and KYC submissions.
- Session tokens that are rotated after 2FA and stored only as hashes, with a 1-hour idle timeout and a 12-hour absolute limit.
- ID numbers and 2FA secrets encrypted with AES-256-GCM. Duplicate IDs and images are detected through HMAC blind indexes and hashes, without storing the plain values.
- Uploaded documents encrypted at rest and served only to their owner or to authorised staff. Every staff view is audit-logged, and revealing a full ID number is logged separately.
- The real file type is checked from the file's bytes, not the name.
- Security headers: no framing, a strict referrer policy, camera limited to the site itself, and HSTS in production.

## In-house KYC (testing) → Sumsub (later)

Identity checks run through a `KycProvider` interface (`src/lib/kyc/provider.ts`). The built-in `internal` provider performs:

| Check | How |
|-------|-----|
| CNIC/NICOP format, region code, gender digit | Rules in `src/lib/kyc/cnic.ts` |
| Passport MRZ check digits and consistency with the entered details | ICAO 9303 in `src/lib/kyc/mrz.ts` |
| Expiry, age ≥ 18, name on the ID vs account name (fuzzy, transliteration-tolerant) | `src/lib/kyc/checks.ts` |
| Duplicate document or reused images across accounts | Blind index and SHA-256 |
| Liveness challenge integrity (server-signed random prompts, time window) | `src/lib/kyc/challenge.ts` |
| Sanctions / PEP screening | The in-house watchlist, managed by staff at `/admin/watchlist` |
| **Face match, liveness judgement, NADRA Verisys** | **Manual.** The officer confirms these in the review screen |

To switch to Sumsub later, implement `KycProvider` in a new adapter and select it with `KYC_PROVIDER`. Nothing else changes.

## Getting started

Requires Node.js ≥ 20.9 and PostgreSQL 14+.

```bash
npm install
cp .env.example .env        # then paste two keys from:
npm run gen:keys            # DATA_ENCRYPTION_KEY and BLIND_INDEX_KEY
npm run db:migrate          # create the schema
npm run db:seed             # super admin (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD) + test watchlist entries
npm run dev                 # http://localhost:3000
```

Sign in as the seeded admin at `/login`. You'll set up 2FA on first sign-in.

By default, email and SMS use the testing **outbox**: messages are recorded in the message log (`/admin/outbox`) but not delivered. With `DEV_SHOW_OTP=true`, the verification page also shows the latest codes. With `KYC_ALLOW_FILE_UPLOAD=true`, testers without a camera can upload photos; these are flagged "not live" to reviewers.

## Platform terms

The commercial terms live in one file, `src/config/platform.ts`:

- **Success fee:** 10% of each amount raised.
- **Business share:** 25% of each funded business.
- **Minimum:** PKR 100,000 for each raise and each investment. For foreign currencies it is checked with indicative exchange rates in the same file.

Founders accept the terms (with a version number) during role verification. Reviewers see the acceptance in the case file. The brand name is a placeholder in `src/config/brand.ts` until the final branding is chosen.

## Email & SMS providers

Pick one of each in `.env`; every option is documented in `.env.example`. **Admin → Settings** shows which providers are active and can send a test message. The message log records each delivery's status and any provider error.

| Channel | `EMAIL_PROVIDER` / `SMS_PROVIDER` | Settings needed |
|---------|-----------------------------------|-----------------|
| Email | `resend` | `RESEND_API_KEY`, `EMAIL_FROM` |
| Email | `sendgrid` | `SENDGRID_API_KEY`, `EMAIL_FROM` |
| Email | `smtp` (Google Workspace, Microsoft 365, Zoho, SES SMTP…) | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` |
| SMS | `twilio` | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` |
| SMS | `vonage` | `VONAGE_API_KEY`, `VONAGE_API_SECRET`, `VONAGE_FROM` |
| SMS | `http` (any local Pakistani gateway with an HTTP API) | `SMS_HTTP_URL` with `{to}` / `{to_digits}` / `{to_local}` / `{message}` placeholders, plus optional method, body, headers and success text |

Live Tank sessions use `VIDEO_PROVIDER` the same way:

| `VIDEO_PROVIDER` | How it works | Settings needed |
|------------------|--------------|-----------------|
| `link` (default) | The team pastes a Zoom / Google Meet / Teams link per session | none |
| `jitsi` | Rooms created automatically on meet.jit.si or your own Jitsi server | `JITSI_BASE_URL`; for signed per-attendee tokens, `JITSI_APP_ID` + `JITSI_APP_SECRET` |
| `daily` | Private Daily.co rooms, personal meeting tokens, optional cloud recording | `DAILY_API_KEY`, optional `DAILY_RECORDING=true` |

The app checks this configuration at startup and refuses to run if a chosen provider is missing a setting. With `APP_ENV=production`, it also refuses to run on the testing outbox, with `DEV_SHOW_OTP`, or with `KYC_ALLOW_FILE_UPLOAD`. When a real provider is in use, one-time codes are masked in the message log.

## Checks & tests

```bash
npm run typecheck && npm run lint
npm test                    # unit tests: TOTP (RFC 6238), MRZ (ICAO specimen), CNIC, name matching, identity, investor & founder checks, platform terms & minimums, email/SMS providers, pitch rules & workflow, investor matching, disclosure & watermarking, offer terms & capacity, escrow & round status, agreements & document PDFs, Tank timing & seats, video providers, monthly reports & indicative returns, campaigns, Urdu dictionary completeness, encryption
npm run build && npm start  # then, in another terminal:
npm run e2e                 # full journey in Chromium with a fake camera: sign-up → 2FA → T1–T4 → pitch built, screened, listed → investor NDA, request, approval, watermarked data room → live Tank session (schedule, confirm, NDA seat, audited join, “I'm in”, recording) → Q&A, offer, counter, term sheet & agreement signed by 3 parties, deposit + fee + milestone release with maker-checker → execution manager, status, founder task, monthly report published with indicative return, campaign results → Urdu pages, PWA manifest, phone-width layout
```

The E2E test seeds its own fresh super admin, a verified investor and a finance team member on every run. If you're using a pre-installed Chromium, set `E2E_CHROMIUM_PATH`. Set `E2E_SCREENSHOTS=<dir>` to save screenshots.

## Project structure

```
prisma/schema.prisma        data model (accounts, sessions, KYC, profiles, cases, audit)
src/app/(auth)/             sign-up, login + 2FA, contact verification, 2FA setup
src/app/(app)/              applicant dashboard, onboarding tiers 1–4, pitch builder
src/app/admin/              team portal
src/app/api/files/[id]      access-controlled, audited document delivery
src/lib/auth/               sessions, passwords, TOTP, one-time codes, recovery codes, role permissions
src/lib/kyc/                KYC provider interface, in-house checks, MRZ, CNIC, AML screening
src/lib/pitch/              pitch completeness rules, deal maths, screening workflow, fingerprints
src/lib/investor/           matching, disclosure levels, quotas & misuse flags, PDF watermarking, data-room access
src/lib/deals/              offer terms & capacity, escrow ledger & round status, document PDFs, the deal service
src/config/agreements.ts    term sheet & agreement templates (draft, versioned)
src/lib/tank/               Tank session rules, video providers (link / Jitsi / Daily), the session service
src/lib/execution/          execution, monthly-report and marketing rules and service
src/i18n/                   English and Urdu dictionaries, locale cookie, language switch
public/sw.js, src/app/manifest.ts   installable app (offline page only; nothing personal is cached)
src/components/ui/          glassmorphism design system (cards, forms, badges, buttons)
tests/unit, tests/e2e       Vitest and Playwright
```

## Before production

- Choose the email and SMS providers, add their keys, check them from Admin → Settings, and set `DEV_SHOW_OTP=false`.
- Replace the indicative exchange rates with a live feed, or review them monthly.
- Connect Sumsub (or NADRA Verisys through a licensed provider) and load official sanctions lists.
- Move file storage to encrypted S3, and store the encryption keys in a managed key service with a rotation plan.
- Move the in-memory rate limiter to Redis before running more than one app server.
- Choose the video provider for Tank sessions (`VIDEO_PROVIDER`), and set `JOBS_SECRET` plus a daily cron call for report reminders.
- Have a native Urdu speaker review `src/i18n/dictionaries/ur.ts`, then translate the remaining applicant pages.
- Appoint a licensed bank or trustee for escrow and connect it (the ledger is manual until then). Have legal and a Shariah advisor finalise the agreement templates, and bump `AGREEMENT_TEMPLATE_VERSION`.
- Publish the final Terms and Privacy Policy (`/legal/*` are placeholders), and run a penetration test.
