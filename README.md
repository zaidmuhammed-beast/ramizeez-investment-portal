# RamiZeeZ Investment Portal

A RamiZeeZ-backed platform, run like Shark Tank, that connects **founders** (people with a startup idea or an existing business that needs capital) with **verified investors** in Pakistan, overseas Pakistanis and foreign investors. RamiZeeZ sits in the middle as the trusted intermediary. It verifies everyone, screens every pitch, protects founders' ideas, and manages agreements, execution and marketing once a deal closes.

> **Status:** Phases 1–2 are built: secure accounts, the team portal and the full tiered verification (KYC) system. Pitch submission (Phase 3) is next.

## Design documents

| # | Document | What it covers |
|---|----------|----------------|
| 1 | [Platform overview](docs/01-platform-overview.md) | User types, deal lifecycle, the RamiZeeZ role, revenue model |
| 2 | [Sign-up & verification](docs/02-signup-and-verification.md) | Tiered KYC, identity documents (CNIC / NICOP / passport), liveness, deep personal profile, role-specific checks |
| 3 | [Pitch submission](docs/03-pitch-submission.md) | What founders must submit (business details, proposal, costing, roadmap) and how pitches are screened |
| 4 | [Investor portal & idea protection](docs/04-investor-portal-and-idea-protection.md) | Budget-based matching, staged disclosure, NDAs, watermarking, anti-copy controls |
| 5 | [Admin & team portal](docs/05-admin-and-team-portal.md) | Team roles, review queues, deal pipeline, agreements, execution tracking |
| 6 | [Architecture, security & roadmap](docs/06-architecture-and-roadmap.md) | Tech stack, data protection, compliance, phased delivery, decisions |

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

**Team portal (`/admin`)**
- A verification queue (oldest first) with each automated check's result, the ID images, the liveness frames next to their prompts, address proof, AML hits, internal notes, assignment and case history.
- Decisions (approve / request info / reject) with a required reason. The applicant is notified. Identity approval requires the officer to confirm that they checked liveness, face match and the document.
- **The verified budget is set by the officer** from the proof of funds. It will control which pitches an investor can see.
- **Four-eyes rule:** the person who approved an applicant's role verification cannot also give that applicant final approval.
- Role-based access for 9 team roles (least privilege), team member creation with forced password change, user suspension, the AML watchlist, the audit log, and the message outbox.

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

Until real email and SMS providers are connected, every message is written to the **outbox** (`/admin/outbox`). With `DEV_SHOW_OTP=true`, the verification page also shows the latest codes. With `KYC_ALLOW_FILE_UPLOAD=true`, testers without a camera can upload photos; these are flagged "not live" to reviewers. The app refuses to start with either setting on when `APP_ENV=production`.

## Checks & tests

```bash
npm run typecheck && npm run lint
npm test                    # unit tests: TOTP (RFC 6238), MRZ (ICAO specimen), CNIC, name matching, identity, investor & founder checks, encryption
npm run build && npm start  # then, in another terminal:
npm run e2e                 # full journey in Chromium with a fake camera: sign-up → 2FA → T1–T4 approvals by two team members
```

The E2E test seeds its own fresh super admin on every run. If you're using a pre-installed Chromium, set `E2E_CHROMIUM_PATH`. Set `E2E_SCREENSHOTS=<dir>` to save screenshots.

## Project structure

```
prisma/schema.prisma        data model (accounts, sessions, KYC, profiles, cases, audit)
src/app/(auth)/             sign-up, login + 2FA, contact verification, 2FA setup
src/app/(app)/              applicant dashboard and onboarding tiers 1–4
src/app/admin/              team portal
src/app/api/files/[id]      access-controlled, audited document delivery
src/lib/auth/               sessions, passwords, TOTP, one-time codes, recovery codes, role permissions
src/lib/kyc/                KYC provider interface, in-house checks, MRZ, CNIC, AML screening
src/components/ui/          glassmorphism design system (cards, forms, badges, buttons)
tests/unit, tests/e2e       Vitest and Playwright
```

## Before production

- Connect real email and SMS providers in `src/lib/messaging.ts`, and set `DEV_SHOW_OTP=false`.
- Connect Sumsub (or NADRA Verisys through a licensed provider) and load official sanctions lists.
- Move file storage to encrypted S3, and store the encryption keys in a managed key service with a rotation plan.
- Move the in-memory rate limiter to Redis before running more than one app server.
- Publish the final Terms and Privacy Policy (`/legal/*` are placeholders), and run a penetration test.
