# 8. Demo walkthrough for clients

A script for showing the platform on the **test site**. Every business, person and figure in
the demo is fictional.

## Setting it up

In Netlify, under **Environment variables**:

1. `DEMO_USERS_PASSWORD`: a password for the three demo logins (see docs/07). Remove it once the accounts exist.
2. `DEMO_SCENARIOS` = `create`. This adds the fictional businesses below. It's safe to leave on: a later deploy doesn't change anything.
   - Set it to `reset` for one deploy to wipe and recreate everything with fresh dates (for example before an important meeting). Then set it back to `create`.
   - Set it to `remove` to delete the demo data.

Then **Trigger deploy**. The log shows "Created demo scenarios".

Use a separate browser profile (or a private window) for each login, so you can switch between
the investor, the founder and the team during the meeting.

## What's in it

| Business | Stage | What it shows |
|----------|-------|---------------|
| Chai Chowk | Submitted | A new pitch waiting for an analyst |
| AgriSense | Screening | Scorecard 72/100 in progress |
| Karachi Cold Chain | Due diligence | Checklist 4 of 6 done |
| Hunarmand | Investment committee | Scored 84/100, diligence complete, teaser written: ready for a second person to approve the listing |
| Sehat Ghar | Returned | Feedback the founder must address before resubmitting |
| Solar Chhat | Listed, collecting commitments | PKR 2M of 5M committed (term sheet signed), a new PKR 1.5M offer waiting for the founder, moderated Q&A, a data-room request to approve, an upcoming Tank slot |
| Pak Parcel | Newly listed | No offers yet; invited to the upcoming Tank (founder hasn't confirmed); on the demo investor's watchlist |
| Doodh Direct | Committed | Offer, counter-offer and acceptance; term sheet signed; agreement waiting for the founder's signature |
| Kapra Loom | Funded, in execution | PKR 4M in escrow, 10% fee taken, milestone 1 released, milestone 2 evidence to review, monthly reports, tasks, a live marketing campaign, status "Needs attention" |

**Tank sessions:** "Clean energy & logistics Tank" in 6 days (two seats confirmed, one request
to approve) and "Food & dairy Tank", completed 30 days ago (attendance, "I'm in" interest, a recording).

## A 15-minute tour

**1. The public site** (no login): home page, then **Tank sessions** (`/tank`). Businesses stay
anonymous. Switch to **اردو** to show Urdu.

**2. Investor** (`demo.investor@ramizeez.test`):
- **Opportunities**: matched to a PKR 5M verified budget. Open **Pak Parcel**: an anonymous teaser only.
- **Investments**:
  - **Solar Chhat**: an offer waiting for the founder.
  - **Doodh Direct**: the negotiation, the signed term sheet, and the agreement with its signature boxes.
  - **Kapra Loom**: escrow, milestones, monthly reports with the investor's indicative return, and marketing results.
- **Tank**: a confirmed seat in the upcoming session, and the recording of the past one.

**3. Founder** (`demo.founder@ramizeez.test`):
- **Pitches → Solar Chhat → Open the deal room**: investors appear only as "Investor 1, 2". **Accept** or **Counter** the PKR 1.5M offer live, and answer the investor's question.
- On the Solar Chhat page: the Tank invitation, and a data-room request to approve.
- **Kapra Loom → deal room**: tasks from RamiZeeZ, milestone evidence, monthly reports, escrow.

**4. RamiZeeZ team**, as your admin login:
- **Pitches**: the pipeline board. Open **Hunarmand** to show the scorecard and the four-eyes rule.
- **Deals**: the question to moderate, the evidence and payments waiting, and every round.
- **Deals → Kapra Loom**: the escrow ledger, with each entry approved by a second person.
- **Tank**: approve the waiting seat request in "Clean energy & logistics Tank".

**5. Execution manager** (`demo.manager@ramizeez.test`):
- **Execution → Kapra Loom**: publish the latest monthly report, update the company's status, add a task.
- **Marketing**: campaign results and conversion rates.

## Afterwards

Anything you click during a demo changes the data (for example accepting an offer). Set
`DEMO_SCENARIOS=reset` and redeploy to start again from the same starting point.
