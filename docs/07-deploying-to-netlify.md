# 7. Deploying to Netlify

The repository is ready for Netlify: `netlify.toml` builds the app with the official Next.js
runtime, runs database migrations on every deploy, and adds a daily function that sends
report reminders. Uploaded files go to **Netlify Blobs**, encrypted by the app before they
are stored.

> **Deploy as a test (staging) site first.** Until the legal agreements, a licensed escrow
> bank, and real email/SMS/KYC providers are in place, run with `APP_ENV=staging`. Every page
> then shows a "Test environment" banner. With `DEV_SHOW_OTP=true`, sign-up codes appear on
> screen instead of being sent. **Don't let real people upload real ID documents to it.**

## 1. Create the site

1. In Netlify, choose **Add new project → Import an existing project → GitHub**.
2. Pick `ramizeez-investment-portal`, and the branch to deploy.
3. Leave the build settings as detected: they come from `netlify.toml`.

## 2. Add a PostgreSQL database

Choose one:

- **Netlify DB** (built on Neon): enable it for the site. Netlify then provides
  `NETLIFY_DATABASE_URL` and `NETLIFY_DATABASE_URL_UNPOOLED`, and the app uses them
  automatically.
- **Any other PostgreSQL 14+** (Neon, Supabase, AWS RDS…): set `DATABASE_URL` to its
  connection string.

Migrations run automatically on every deploy (`prisma migrate deploy`).

## 3. Set environment variables

Set these under **Project configuration → Environment variables**. Mark only the keys, the
database URL and passwords as secret. Ordinary settings like `APP_ENV` don't need it (the build
tells Netlify's secret scanner to ignore them either way).

| Variable | Value |
|----------|-------|
| `DATA_ENCRYPTION_KEY`, `BLIND_INDEX_KEY` | Run `npm run gen:keys` locally and paste the two values. **Never change them once data exists**: encrypted IDs and files can't be read without them. Keep a copy in a password manager. |
| `APP_ENV` | `staging` (see the note above) |
| `DEV_SHOW_OTP` | `true` while no email/SMS provider is connected |
| `KYC_ALLOW_FILE_UPLOAD` | `true` if testers have no camera (optional) |
| `STORAGE_DRIVER` | `netlify-blobs` |
| `MAX_UPLOAD_MB` | `4` (Netlify functions reject requests over about 6 MB) |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | The first super admin. **Delete `SEED_ADMIN_PASSWORD` after the first successful deploy.** |
| `JOBS_SECRET` | 32+ random characters, to switch on the daily report reminders (optional) |
| `APP_URL` | Only for a custom domain, e.g. `https://invest.ramizeez.com`. Otherwise Netlify's own URL is used. |
| `EMAIL_PROVIDER`, `SMS_PROVIDER`, `VIDEO_PROVIDER` + their keys | When you've chosen providers (see `.env.example`) |

## 4. Deploy and sign in

1. Trigger a deploy. The build log shows "Settings check passed", the migrations, then "Seeding the super admin". If a setting is missing, the log lists exactly which ones.
2. Open the site, sign in at `/login` with the seed admin, and set up 2FA.
3. Delete `SEED_ADMIN_PASSWORD` from the environment variables.
4. Add more team members from **Admin → Team**.

Every push to the deployed branch redeploys the site. Pull requests get their own preview
deploys, which share the same database unless you give them a separate one.

## Going live for real users

Switch `APP_ENV` to `production` only after the checklist in the README's "Before
production" section is done. In production, the app refuses to start while email or SMS is
on the testing outbox, `DEV_SHOW_OTP` is on, or file uploads replace the live camera.

## Known limits on Netlify

- **Upload size:** up to 4 MB per file, and 4.5 MB per submission. The app shrinks photos in
  the browser and explains the limit when a submission is too large.
- **Rate limits** (login, sign-up, codes) are kept in memory per function instance, so on
  serverless they are weaker. Move them to Redis (e.g. Upstash) before real launch.
- **Report reminders** run daily at 10:00 Pakistan time (`netlify/functions/report-reminders.mts`),
  once `JOBS_SECRET` is set.
