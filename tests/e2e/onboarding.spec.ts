import { expect, test, type Locator, type Page } from "@playwright/test";
import { base32Decode } from "../../src/lib/auth/totp";
import { createHmac } from "node:crypto";

// Full journey: investor signs up → verifies contact → 2FA → identity (live camera + liveness)
// → deep profile → role verification → final approval, with two different team members
// reviewing (the four-eyes rule on final approval).

const SHOTS = process.env.E2E_SCREENSHOTS;
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
};

function totpAt(secret: string, stepOffset = 0) {
  const counter = Math.floor(Date.now() / 30_000) + stepOffset;
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", base32Decode(secret)).update(buf).digest();
  const o = h[h.length - 1] & 0xf;
  const code = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return (code % 1_000_000).toString().padStart(6, "0");
}

/** TOTP codes can't be reused, so wait for a fresh time step after the previous login. */
async function freshTotp(secret: string, used: Set<string>) {
  for (;;) {
    const code = totpAt(secret);
    if (!used.has(code)) {
      used.add(code);
      return code;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF",
);

const stamp = Date.now().toString().slice(-7);
// Names must be letters only; make this run's applicant unique in the review queue.
const lastName = `Khan${[...stamp].map((d) => "abcdefghij"[Number(d)]).join("")}`;
const fullName = `Ahmed ${lastName}`;
const investor = { email: `investor.${stamp}@example.com`, password: "Blue-Harbor!Kite-2026x", phone: `3${stamp.padStart(9, "1")}` };
const ADMIN = { email: process.env.E2E_ADMIN_EMAIL!, password: process.env.E2E_ADMIN_PASSWORD! };

/** Answers a yes/no question, found by its group (legend) name. */
const answer = (page: Page | Locator, question: string, value: "yes" | "no") =>
  page.getByRole("group", { name: new RegExp(question) }).getByText(value, { exact: true }).click();

async function readOtp(page: Page, channel: "EMAIL" | "PHONE") {
  const line = page.locator("aside li", { hasText: channel === "EMAIL" ? "✉" : "📱" }).first();
  return (await line.innerText()).match(/\b\d{6}\b/)![0];
}

async function verifyContactAndSetup2fa(page: Page) {
  await expect(page).toHaveURL(/verify-contact/);
  await shot(page, "02-verify-contact");
  await page.getByLabel("Email code").fill(await readOtp(page, "EMAIL"));
  await page.getByRole("button", { name: "Verify" }).first().click();
  await expect(page.getByText("Verified", { exact: true })).toBeVisible();
  await page.getByLabel("Mobile (SMS) code").fill(await readOtp(page, "PHONE"));
  await page.getByRole("button", { name: "Verify" }).click();
  return setup2fa(page);
}

async function setup2fa(page: Page) {
  await expect(page).toHaveURL(/setup-2fa/);
  const secret = (await page.getByTestId("totp-secret").innerText()).replace(/\s/g, "");
  await shot(page, "03-setup-2fa");
  const used = new Set<string>();
  await page.getByLabel("Authentication code").fill(await freshTotp(secret, used));
  await page.getByRole("button", { name: "Turn on two-factor" }).click();
  await expect(page.getByTestId("recovery-codes")).toBeVisible();
  await page.getByLabel("I have stored these codes somewhere safe").check();
  await page.getByRole("link", { name: "Continue" }).click();
  return { secret, used };
}

async function login(page: Page, email: string, password: string, secret: string, used: Set<string>) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/login\/2fa/);
  await page.getByLabel("Authentication code").fill(await freshTotp(secret, used));
  await page.getByRole("button", { name: "Verify" }).click();
}

async function decide(page: Page, caseName: string, decision: string, extra?: (p: Page) => Promise<void>) {
  await page.goto("/admin/cases");
  await page.getByRole("row", { name: new RegExp(caseName) }).getByRole("link").first().click();
  await expect(page.getByText("Automated checks")).toBeVisible();
  await page.getByLabel("Decision").selectOption(decision);
  if (extra) await extra(page);
  await page.getByRole("button", { name: "Record decision" }).click();
  // Once decided, the form is replaced by a summary of the decision.
  await expect(page.getByText(new RegExp(`${decision.toLowerCase().replace("_", " ")} by`))).toBeVisible();
}

test("founder-investor onboarding, pitch, listing and a funded deal", async ({ browser }) => {
  const userCtx = await browser.newContext();
  const adminCtx = await browser.newContext();
  const committeeCtx = await browser.newContext();
  const page = await userCtx.newPage();
  const admin = await adminCtx.newPage();
  const committee = await committeeCtx.newPage();

  // ── Landing & sign-up ──
  await page.goto("/");
  await shot(page, "00-landing");
  await page.getByRole("link", { name: "I want to invest" }).click();
  await page.getByLabel("Founder: I want to pitch").check();
  await page.getByLabel("First name").fill("Ahmed");
  await page.getByLabel("Last name").fill(lastName);
  await page.getByLabel("Email").fill(investor.email);
  await page.getByLabel("Country of residence").selectOption("AE");
  await page.getByLabel("Phone country code").selectOption("PK");
  await page.getByLabel("Mobile number").fill(investor.phone);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(investor.password);
  await page.getByLabel("Confirm password").fill(investor.password);
  await page.getByLabel(/I agree to the/).check();
  await page.getByLabel(/I consent to identity verification/).check();
  await shot(page, "01-signup");
  await page.getByRole("button", { name: "Create account" }).click();

  const user2fa = await verifyContactAndSetup2fa(page);
  await expect(page).toHaveURL(/dashboard/);
  await shot(page, "04-dashboard-t0");

  // ── Tier 1: identity ──
  await page.goto("/onboarding/identity");
  await page.getByLabel("Document type").selectOption("CNIC");
  await page.getByLabel("Document number").fill(`42101${stamp}1`);
  await page.getByLabel("Date of birth").fill("1988-03-14");
  await page.getByLabel("Gender on document").selectOption("M");
  await page.getByLabel("Expiry date").fill("2032-06-30");
  await shot(page, "05-identity-details");
  await page.getByRole("button", { name: "Continue" }).click();
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: "Open camera" }).first().click();
    await page.getByRole("button", { name: "Capture", exact: true }).click();
  }
  await expect(page.getByText("✓ Captured live")).toHaveCount(2);
  await shot(page, "06-identity-photos");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Start liveness check" }).click();
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Capture this step" }).click();
    await page.waitForTimeout(3500);
  }
  await expect(page.getByText(/Liveness check captured \(3 frames\)/)).toBeVisible();
  await shot(page, "07-identity-liveness");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Address line 1").fill("Villa 12, Street 4, Al Barsha");
  await page.getByLabel("City").fill("Dubai");
  await page.getByRole("combobox", { name: "Country", exact: true }).selectOption("AE");
  await page.locator("#proofOfAddress").setInputFiles({ name: "dewa-bill.pdf", mimeType: "application/pdf", buffer: PDF });
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Submit for verification" }).click();
  await expect(page.getByText("Your documents are with our verification team")).toBeVisible();
  await shot(page, "08-identity-submitted");

  // ── Tier 2: profile (can be filled while identity is reviewed) ──
  await page.goto("/onboarding/profile?s=personal");
  await page.getByLabel("Father's / husband's name").fill("Tariq Khan");
  await page.getByLabel("Languages spoken").fill("English, Urdu");
  await page.getByLabel("LinkedIn profile").fill("https://www.linkedin.com/in/ahmed-khan-example");
  await page.getByLabel("About you").fill("Chartered accountant with 14 years in Gulf corporate finance, now investing in Pakistani SMEs I can mentor on financial discipline and growth.");
  await page.getByRole("button", { name: "Save personal details" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await shot(page, "09-profile-personal");

  await page.goto("/onboarding/profile?s=education");
  await page.getByLabel("Institution").fill("LUMS");
  await page.getByLabel("Qualification").fill("BSc Accounting & Finance");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.goto("/onboarding/profile?s=experience");
  await page.getByLabel("Employer / business").fill("Emirates Group");
  await page.getByLabel("Job title").fill("Finance Director");
  await page.getByLabel("Start year").fill("2014");
  await page.getByLabel("Responsibilities & achievements").fill("Led FP&A for a USD 400M division and built the treasury function.");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.goto("/onboarding/profile?s=goals");
  const long = (s: string) => `${s} — with specific, measurable milestones I review every quarter.`;
  for (const [label, text] of [
    ["Your goals for the next 12 months", long("Back two Pakistani food businesses")],
    ["Where do you want to be in 5 years?", long("A portfolio of ten SMEs")],
    ["Your 10-year vision", long("Return to Pakistan and run an SME fund")],
    ["Why do you want to be", long("I want my savings to create jobs at home")],
    ["Which problem in society", "Youth unemployment in smaller cities."],
    ["What does success look like", "Profitable companies that outgrow me."],
    ["Your core values", "Honesty, patience and accountability."],
    ["Describe a serious setback", long("My first restaurant investment failed after 18 months because we ignored unit economics")],
  ] as const) {
    await page.getByLabel(label).fill(text);
  }
  await page.getByLabel("Time you can commit").selectOption("PART_TIME");
  await page.getByRole("button", { name: "Save goals" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.goto("/onboarding/profile?s=references");
  const refs = page.locator("fieldset");
  for (const [i, r] of [
    ["Sara Malik", "Former manager at Emirates", "sara.malik@example.com", "+971500000001"],
    ["Omar Farooq", "Business partner", "omar.farooq@example.com", "+923001234567"],
  ].entries()) {
    await refs.nth(i).getByLabel("Full name").fill(r[0]);
    await refs.nth(i).getByLabel("Relationship").fill(r[1]);
    await refs.nth(i).getByLabel("Email").fill(r[2]);
    await refs.nth(i).getByLabel("Phone (with country code)").fill(r[3]);
  }
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.goto("/onboarding/profile?s=declarations");
  for (const q of ["convicted", "court case", "bankrupt", "politically exposed", "conflict of interest"]) {
    await answer(page, q, "no");
  }
  await page.getByLabel(/everything in my profile is true/).check();
  await page.getByLabel(/I consent to RamiZeeZ running background/).check();
  await page.getByRole("button", { name: "Sign declarations" }).click();
  await expect(page.getByText("Your profile is complete")).toBeVisible();
  await shot(page, "10-profile-complete");

  // ── Super admin reviews identity ──
  await admin.goto("/login");
  await admin.getByLabel("Email").fill(ADMIN.email);
  await admin.getByLabel("Password").fill(ADMIN.password);
  await admin.getByRole("button", { name: "Continue" }).click();
  // First sign-in of the seeded admin goes through 2FA setup; wait for the page to settle.
  const landed = admin.getByRole("heading", { name: /Turn on two-factor|Good day/ });
  await expect(landed).toBeVisible();
  if ((await landed.innerText()).includes("two-factor")) await setup2fa(admin);
  await expect(admin.getByRole("heading", { name: /Good day/ })).toBeVisible();
  await shot(admin, "11-admin-overview");

  // Settings: terms, providers and a test message through the configured email provider.
  await admin.goto("/admin/settings");
  await expect(admin.getByText("Success fee")).toBeVisible();
  await admin.getByLabel("Send to").fill("ops@example.com");
  await admin.getByRole("button", { name: "Send test" }).click();
  await expect(admin.getByText(/Test email sent to ops@example.com/)).toBeVisible();
  await shot(admin, "11b-admin-settings");

  await admin.goto("/admin/cases");
  await shot(admin, "12-admin-queue");
  await admin.getByRole("row", { name: new RegExp(fullName) }).getByRole("link").first().click();
  await expect(admin.getByText("NADRA Verisys")).toBeVisible();
  await shot(admin, "13-admin-identity-case");
  await admin.getByLabel("Decision").selectOption("APPROVED");
  await admin.getByLabel(/I checked every liveness frame/).check();
  await admin.getByLabel(/I checked the document against NADRA/).check();
  await admin.getByRole("button", { name: "Record decision" }).click();
  await expect(admin.getByText(/approved by/)).toBeVisible();

  // ── Tier 3: investor role ──
  await page.goto("/dashboard");
  await expect(page.getByText("Tier 2 · Profile complete")).toBeVisible();
  await page.goto("/onboarding/role");
  const card = (title: string) => page.locator("section").filter({ has: page.getByRole("heading", { name: title }) });
  const inv = card("Investor profile");
  await inv.getByLabel("I am investing as").selectOption("HIGH_NET_WORTH");
  await inv.getByLabel("Currency").selectOption("USD");
  await inv.getByLabel("Total budget for the platform").fill("250000");
  await inv.getByLabel("Minimum per deal").fill("10000");
  await inv.getByLabel("Maximum per deal").fill("75000");
  await inv.getByLabel("Salary / employment income").check();
  await inv.getByLabel("Overseas earnings / remittance").check();
  await inv.getByLabel("How did you build your overall wealth?").fill("Fourteen years of salary savings in Dubai plus a property sale in Lahore in 2022.");
  await inv.getByLabel("Annual income").selectOption("USD 150k–500k");
  await inv.getByRole("combobox", { name: "Net worth", exact: true }).selectOption("USD 500k–2M");
  await inv.locator("#proofOfFunds").setInputFiles({ name: "bank-statement.pdf", mimeType: "application/pdf", buffer: PDF });
  await inv.getByLabel("Your investment experience").fill("Angel investor in two Karachi startups since 2019.");
  await inv.getByLabel("Food & beverage").check();
  await inv.getByLabel("Early revenue").check();
  await inv.getByLabel("Musharakah").check();
  await inv.getByLabel("Equity", { exact: true }).check();
  await inv.getByLabel("Pakistan", { exact: true }).check();
  await answer(inv, "Shariah-compliant", "no");
  await answer(inv, "losing all the money", "yes");
  await answer(inv, "locked in", "yes");
  await inv.getByLabel(/How long can you leave money/).selectOption("GT5");
  await inv.getByLabel(/What share of your total net worth/).selectOption("10TO25");
  await inv.getByLabel(/lost half its value/).selectOption("HOLD");
  // USD 100 is below the PKR 100,000 platform minimum.
  await inv.getByLabel("Minimum per deal").fill("100");
  await inv.getByRole("button", { name: "Save investor profile" }).click();
  await expect(inv.getByText(/The minimum investment per deal is PKR 100,000 \(≈ USD \d+\)/)).toBeVisible();
  await inv.getByLabel("Minimum per deal").fill("10000");
  await inv.locator("#proofOfFunds").setInputFiles({ name: "bank-statement.pdf", mimeType: "application/pdf", buffer: PDF });
  await inv.getByRole("button", { name: "Save investor profile" }).click();
  await expect(inv.getByText("Investor profile saved.")).toBeVisible();

  // Founder side of the same account: business details and acceptance of the RamiZeeZ terms.
  const fdr = card("Founder & business details");
  await fdr.getByLabel("Stage").selectOption("IDEA");
  await fdr.getByLabel("Sector").selectOption("Food & beverage");
  await fdr.getByLabel("Country").selectOption("PK");
  await fdr.getByLabel("City").fill("Lahore");
  await fdr.getByLabel("Musharakah").check();
  await fdr.getByLabel("Currency").selectOption("PKR");
  await fdr.getByLabel(/I accept that RamiZeeZ receives 10%/).check();
  await fdr.getByRole("button", { name: "Save founder profile" }).click();
  await expect(fdr.getByText("Founder profile saved.")).toBeVisible();
  await shot(page, "14-role-investor");
  await page.getByRole("button", { name: "Submit for role verification" }).click();
  await expect(page.getByText("Our team is reviewing your details")).toBeVisible();

  await decide(admin, fullName, "APPROVED", async (p) => {
    await p.getByLabel(/Verified budget/).fill("200000");
    await shot(p, "15-admin-role-case");
  });

  // ── Super admin creates an Investment Committee member (four-eyes rule) ──
  await admin.goto("/admin/team");
  await admin.getByLabel("First name").fill("Hina");
  await admin.getByLabel("Last name").fill("Raza");
  const committeeEmail = `committee.${stamp}@ramizeez.test`;
  const committeePhone = `3${(Number(stamp) + 1).toString().padStart(9, "2")}`;
  await admin.getByLabel("Work email").fill(committeeEmail);
  await admin.getByLabel("Mobile number").fill(committeePhone);
  await admin.getByLabel("Role").selectOption("INVESTMENT_COMMITTEE");
  await admin.getByRole("button", { name: "Create account" }).click();
  const tempPassword = await admin.getByTestId("temp-password").innerText();

  // ── Tier 4: final approval ──
  await page.goto("/onboarding/final");
  await page.getByLabel("When are you available for a video call?").fill("Weekdays after 7pm Gulf time");
  await page.getByRole("button", { name: "Request final approval" }).click();
  await expect(page.getByText("We'll email you an invitation")).toBeVisible();

  // The super admin approved the role case, so they must not be able to give final approval.
  await admin.goto("/admin/cases");
  await admin.getByRole("row", { name: new RegExp(fullName) }).getByRole("link").first().click();
  await admin.getByLabel("Decision").selectOption("APPROVED");
  await admin.getByLabel(/The video interview took place/).check();
  await admin.getByRole("button", { name: "Record decision" }).click();
  await expect(admin.getByText(/A different team member must give final approval/)).toBeVisible();

  await committee.goto("/login");
  await committee.getByLabel("Email").fill(committeeEmail);
  await committee.getByLabel("Password").fill(tempPassword);
  await committee.getByRole("button", { name: "Continue" }).click();
  await verifyContactAndSetup2fa(committee);
  await expect(committee).toHaveURL(/change-password/);
  await committee.getByLabel("Current password").fill(tempPassword);
  await committee.getByRole("textbox", { name: "New password", exact: true }).fill("Quiet-Meadow!Lamp-2026");
  await committee.getByLabel("Confirm new password").fill("Quiet-Meadow!Lamp-2026");
  await committee.getByRole("button", { name: "Save password" }).click();
  await expect(committee).toHaveURL(/\/admin/);

  await decide(committee, fullName, "APPROVED", async (p) => {
    await p.getByLabel(/The video interview took place/).check();
    await shot(p, "16-committee-final-case");
  });

  await page.goto("/dashboard");
  await expect(page.getByText("Tier 4 · RamiZeeZ Verified")).toBeVisible();
  await shot(page, "17-dashboard-verified");

  // ── Phase 3: the founder builds and submits a Musharakah pitch ──
  await page.goto("/pitches");
  await page.getByLabel("Working title").fill("Traceable dairy subscriptions");
  await page.getByRole("button", { name: "Create pitch" }).click();
  await expect(page.getByRole("heading", { name: "Traceable dairy subscriptions" })).toBeVisible();
  const pitchUrl = page.url().split("?")[0];
  const section = async (key: string) => page.goto(`${pitchUrl}?s=${key}`);
  const save = async (name = "Save") => {
    const button = page.getByRole("button", { name, exact: true });
    await button.click();
    await expect(button.locator("xpath=ancestor::form").getByText("Saved.")).toBeVisible();
  };
  const exactLabel = (text: string) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\*?$`);
  const para = (s: string, n = 170) => (s + " ").repeat(Math.ceil(n / (s.length + 1))).trim();

  await page.getByLabel("One-line summary").fill("Farm-fresh milk delivered daily to Lahore homes");
  await page.getByLabel("The problem").fill(para("Families in Lahore cannot trust the purity of loose milk."));
  await page.getByLabel("Your solution").fill(para("Traceable milk from partner farms, chilled and delivered by subscription."));
  await page.getByLabel("Why now?").fill("Food safety awareness and digital payments have both grown fast.");
  await save();

  await section("team");
  await page.getByLabel("Your experience and knowledge of this business").fill(para("Ten years running my family's dairy farm and a milk distribution route of 400 homes."));
  await save("Save experience");

  await section("market");
  await page.getByLabel("Target customers").fill(para("Middle-income families in Lahore with children.", 60));
  await page.getByLabel(/Market size/).fill(para("Packaged milk in Lahore is a PKR 50bn market (PDDB 2025).", 60));
  await page.getByLabel("Competitors").fill("Nestlé, Haleeb, local milkmen");
  await page.getByLabel("What makes you different").fill(para("Farm-level traceability and a daily cold chain.", 60));
  await save();

  await section("model");
  await page.getByLabel("How the business makes money").fill(para("Monthly milk subscriptions paid in advance.", 60));
  await page.getByLabel("Pricing").fill("PKR 250 per litre");
  await page.getByLabel("Unit economics").fill(para("Cost PKR 170 per litre, margin PKR 80, acquisition cost PKR 400 per home.", 60));
  await page.getByLabel("Sales & marketing channels").fill("Instagram, school partnerships and referrals");
  await save();

  await section("ask");
  await page.getByLabel("Currency").selectOption("PKR");
  await page.getByLabel("Amount to raise").fill("1000000");
  await page.getByLabel("Minimum per investor").fill("100000");
  await expect(page.getByText("PKR 900,000")).toBeVisible();
  await page.getByLabel("Deal structure").selectOption("MUSHARAKAH");
  await page.getByLabel("Investors' share of profit (%)").fill("40");
  await page.getByLabel("Your capital in the partnership").fill("250000");
  await page.getByLabel("Partnership term (months)").fill("36");
  await page.getByLabel("Expected return for investors").fill("40% of profits, projected at 25% a year on capital.");
  await page.getByLabel("Exit or repayment options").fill("Founder buys out investors' share at year three.");
  await save();

  const fillRows = async (rows: string[][], labels: string[], group: string, addLabel?: string) => {
    for (const [i, row] of rows.entries()) {
      if (i > 0 && addLabel) await page.getByRole("button", { name: `+ ${addLabel}` }).click();
      const g = page.getByRole("group", { name: `${group} ${i + 1}` });
      for (const [j, value] of row.entries()) {
        const field = g.getByLabel(exactLabel(labels[j]));
        if ((await field.evaluate((el) => el.tagName)) === "SELECT") await field.selectOption(value);
        else await field.fill(value);
      }
    }
  };
  await section("costing");
  await fillRows(
    [["CAPEX", "Refrigerated van", "1", "500000"], ["MARKETING", "Launch campaign", "1", "200000"], ["CONTINGENCY", "Buffer", "1", "200000"]],
    ["Category", "Item", "Quantity", "Unit cost"], "Cost line", "Add cost line",
  );
  await expect(page.getByText("✓ Matches the amount the business receives.")).toBeVisible();
  await save();

  await section("roadmap");
  await fillRows(
    [["1", "Van on the road", "500000", "First 100 subscribers"], ["3", "Launch campaign", "200000", "500 paying subscribers"], ["6", "Break-even", "200000", "Positive monthly cash flow"]],
    ["Month after funding", "Milestone", "Budget released", "Measurable success metric"], "Milestone", "Add milestone",
  );
  await save();

  await section("financials");
  await fillRows([1, 2, 3, 4, 5].map((y) => [String(y * 1_200_000), String(y * 1_000_000)]), ["Revenue", "Costs"], "Year");
  await save();
  await page.getByLabel("Assumptions behind these numbers").fill(para("Subscribers grow 15% a month in year one, then 40% a year; price rises 8% a year.", 90));
  await save("Save assumptions");

  await section("risks");
  await fillRows(
    [["MARKET", "Price war with big brands", "Premium positioning"], ["OPERATIONAL", "Cold chain failure", "Backup generators"], ["FINANCIAL", "Late payments", "Prepaid subscriptions only"]],
    ["Category", "Risk", "How you will handle it"], "Risk", "Add risk",
  );
  await save();
  await page.getByLabel(/If the business fails/).fill(para("The van and chillers are sold and the proceeds returned to investors.", 60));
  await save("Save plan");

  await section("media");
  await page.locator("#deck").setInputFiles({ name: "dairy-deck.pdf", mimeType: "application/pdf", buffer: PDF });
  await save();

  await section("submit");
  await expect(page.getByText("Every section is complete.")).toBeVisible();
  await shot(page, "18-pitch-submit");
  for (const label of [/This idea, business and all the materials/, /All figures and statements are true/, /I accept the RamiZeeZ terms/, /non-circumvention/]) {
    await page.getByLabel(label).check();
  }
  await page.getByRole("button", { name: "Submit for screening" }).click();
  await expect(page.getByTestId("pitch-fingerprint")).toHaveText(/^[0-9a-f]{64}$/);
  await shot(page, "19-pitch-submitted");

  // ── Screening pipeline: the super admin screens, the committee member lists ──
  const step = async (p: Page, label: string, note = "") => {
    await p.getByLabel("Next step").selectOption({ label });
    if (note) await p.getByLabel("Note / feedback to founder").fill(note);
    await p.getByRole("button", { name: "Confirm" }).click();
  };
  await admin.goto("/admin/pitches");
  await shot(admin, "20-admin-pipeline");
  await admin.getByRole("link", { name: /Traceable dairy subscriptions/ }).first().click();
  await step(admin, "Start screening");
  await expect(admin.getByText("Moved to Screening")).toBeVisible();
  for (const criterion of ["Team & experience", "Market opportunity", "Business model", "Financials & costing", "Execution roadmap", "Risk management"]) {
    await admin.getByLabel(criterion).selectOption("4");
  }
  await admin.getByLabel("Assessment").fill("Experienced founder, credible costing and a clear route to break-even.");
  await admin.getByRole("button", { name: "Save scorecard" }).click();
  await expect(admin.getByText("Scorecard saved: 80/100.")).toBeVisible();
  await step(admin, "Move to due diligence");
  await expect(admin.getByText("Moved to Due diligence")).toBeVisible();
  for (const item of [/identities verified/, /Registration, tax/, /Financial statements/, /Cost lines checked/, /No legal disputes/, /References and key/]) {
    await admin.getByLabel(item).check();
  }
  await admin.getByRole("button", { name: "Save checklist" }).click();
  await expect(admin.getByText("Checklist saved: 6 of 6 complete.")).toBeVisible();
  await admin.getByLabel("Anonymous investor teaser").fill("Food & beverage · Lahore · idea stage. A traceable dairy subscription raising PKR 1M on Musharakah terms.");
  await admin.getByRole("button", { name: "Save teaser" }).click();
  await expect(admin.getByText("Teaser saved.")).toBeVisible();
  await step(admin, "Send to committee");
  await expect(admin.getByText("Moved to Investment committee")).toBeVisible();
  // The super admin screened this pitch, so they can't approve the listing themselves.
  await step(admin, "Approve & list");
  await expect(admin.getByText(/A different committee member must approve the listing/)).toBeVisible();

  await committee.goto("/admin/pitches");
  await committee.getByRole("link", { name: /Traceable dairy subscriptions/ }).first().click();
  await shot(committee, "21-committee-pitch-review");
  await step(committee, "Approve & list", "Approved: strong founder-market fit.");
  await expect(committee.getByText(/^Listed\. Investors will see the teaser/)).toBeVisible();

  await page.goto("/pitches");
  await expect(page.getByText("Listed", { exact: true })).toBeVisible();

  // ── Phase 4: a verified investor discovers, unlocks and requests the pitch ──
  const seeded = JSON.parse(process.env.E2E_INVESTOR!) as { email: string; password: string; secret: string; name: string };
  const inv2 = await (await browser.newContext()).newPage();
  await login(inv2, seeded.email, seeded.password, seeded.secret, new Set());
  await expect(inv2).toHaveURL(/dashboard/);
  const pitchId = pitchUrl.split("/").pop()!;
  const ref = `RZ-${pitchId.slice(-6).toUpperCase()}`;
  const businessName = () => inv2.getByRole("heading", { name: "Traceable dairy subscriptions" });
  await inv2.goto("/opportunities");
  await shot(inv2, "22-investor-opportunities");
  await inv2.getByRole("link", { name: new RegExp(ref) }).click();
  await expect(inv2.getByRole("heading", { name: "Unlock the summary" })).toBeVisible();
  await expect(businessName()).toHaveCount(0);
  await inv2.getByLabel("Type your full legal name to sign").fill(seeded.name);
  await inv2.getByLabel(/I have read and agree/).check();
  await inv2.getByRole("button", { name: /Sign NDA/ }).click();
  await expect(inv2.getByTestId("secure-view")).toBeVisible();
  await expect(inv2.getByText("Families in Lahore cannot trust", { exact: false }).first()).toBeVisible();
  await expect(businessName()).toHaveCount(0);
  await shot(inv2, "23-investor-summary");
  await inv2.getByLabel(/How much do you intend to invest/).fill("200000");
  await inv2.getByLabel(/Message to the founder/).fill("Keen on dairy. Email me at sara@example.com or call +44 7700 900123.");
  await inv2.getByRole("button", { name: "Request full data-room access" }).click();
  await expect(inv2.getByText(/Request sent: you intend to invest PKR 200,000/)).toBeVisible();

  // The founder sees an anonymous request with contact details stripped, and approves it.
  await page.goto(pitchUrl);
  await expect(page.getByText("Intends to invest PKR 200,000")).toBeVisible();
  await expect(page.getByText(/\[removed\]/)).toBeVisible();
  await expect(page.getByText(/sara@example\.com|7700/)).toHaveCount(0);
  await expect(page.getByText("Sara Qureshi")).toHaveCount(0);
  await shot(page, "24-founder-investor-interest");
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByText("approved", { exact: true })).toBeVisible();

  // Full data room: business name revealed, documents served as watermarked PDFs.
  await inv2.reload();
  await expect(businessName().first()).toBeVisible();
  const deckHref = (await inv2.getByRole("link", { name: /dairy-deck/ }).getAttribute("href"))!;
  expect(deckHref).toContain(`/api/dataroom/${pitchId}/`);
  const deck = await inv2.request.get(deckHref);
  expect(deck.headers()["content-type"]).toBe("application/pdf");
  const deckBody = await deck.body();
  expect(deckBody.subarray(0, 5).toString()).toBe("%PDF-");
  expect(deckBody.length).toBeGreaterThan(PDF.length);
  await shot(inv2, "25-investor-data-room");
  // Nobody else can fetch it — not even the founder through the investor route.
  expect((await page.request.get(deckHref)).status()).toBe(404);
  await page.reload();
  await expect(page.getByText("Opened the data room")).toBeVisible();

  // ── Phase 5: Q&A, negotiation, signatures, escrow and a milestone release ──
  const finance = JSON.parse(process.env.E2E_FINANCE!) as { email: string; password: string; secret: string; name: string };
  const fin = await (await browser.newContext()).newPage();
  const dealRoom = `${pitchUrl}/deal`;
  const opportunityUrl = inv2.url();
  const founderName = fullName;
  const adminName = "RamiZeeZ Admin";
  const signed = (p: Page, name: string) => p.getByText(`✓ ${name}`, { exact: true });
  const sign = async (p: Page, name: string, button = "Sign") => {
    const before = await signed(p, name).count();
    await p.getByLabel("Type your full legal name").fill(name);
    await p.getByLabel(/I have read this document and agree to sign/).check();
    await p.getByRole("button", { name: button, exact: true }).click();
    await expect(signed(p, name)).toHaveCount(before + 1);
  };

  // A moderated question: contact details are stripped, the team passes it on, the founder answers for everyone.
  await inv2.getByLabel("Ask the founder a question").fill("How many partner farms supply you today? Reach me on +44 7700 900123.");
  await inv2.getByRole("button", { name: "Send question" }).click();
  await expect(inv2.getByText("With RamiZeeZ for review")).toBeVisible();
  await admin.goto("/admin/deals");
  const pending = admin.getByRole("listitem").filter({ hasText: "How many partner farms" });
  await expect(pending).toContainText("[removed]");
  await pending.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(pending).toHaveCount(0);
  await page.goto(dealRoom);
  await page.getByLabel("Your answer").fill("Six farms today, with two more signed for next quarter.");
  await page.getByLabel(/Show this answer to every investor/).check();
  await page.getByRole("button", { name: "Send answer" }).click();
  await expect(page.getByText("You: Six farms today")).toBeVisible();
  await inv2.goto(opportunityUrl);
  await expect(inv2.getByText("Founder: Six farms today")).toBeVisible();

  // Offer → counter-offer → acceptance.
  await inv2.getByLabel("Amount (PKR)").fill("1000000");
  await inv2.getByLabel("Investor's share of profit (%)").fill("45");
  await inv2.getByLabel("Conditions (optional)").fill("Monthly management accounts");
  await shot(inv2, "26-investor-make-offer");
  await inv2.getByRole("button", { name: "Send offer" }).click();
  await expect(inv2).toHaveURL(/\/investments\/\w+/);
  await expect(inv2.getByText("Waiting for the founder")).toBeVisible();
  const offerUrl = inv2.url();

  await page.goto(dealRoom);
  await expect(page.getByText("Investor 1: PKR 1,000,000")).toBeVisible();
  await expect(page.getByText("Sara Qureshi")).toHaveCount(0);
  await page.getByRole("button", { name: "Counter", exact: true }).click();
  await page.getByLabel("Investor's share of profit (%)").fill("40");
  await page.getByLabel("Message", { exact: true }).fill("40% keeps enough profit in the business to grow.");
  await page.getByRole("button", { name: "Send counter-offer" }).click();
  await expect(page.getByText("Waiting for investor").first()).toBeVisible();
  await shot(page, "27-founder-deal-room-counter");

  await inv2.goto(offerUrl);
  await expect(inv2.getByText(/Founder countered with PKR 1,000,000: Musharakah: 40% of profit/)).toBeVisible();
  await inv2.getByRole("button", { name: "Accept", exact: true }).click();
  await expect(inv2.getByText(/Term sheet: RZ-/).first()).toBeVisible();

  // The term sheet is signed by all three parties; legal then issues the agreement, signed the same way.
  await sign(inv2, seeded.name);
  await page.goto(dealRoom);
  await sign(page, founderName);
  const adminDeal = `/admin/deals/${pitchId}`;
  await admin.goto(adminDeal);
  await sign(admin, adminName, "Sign for RamiZeeZ");
  await expect(admin.getByText("Signed by all", { exact: true })).toBeVisible();
  await expect(admin.getByLabel("Agreement text")).toHaveValue(/Musharakah partnership/);
  await admin.getByRole("button", { name: "Issue agreement for signature" }).click();
  await expect(admin.getByText(/Investment agreement: RZ-/).first()).toBeVisible();
  await sign(admin, adminName, "Sign for RamiZeeZ");
  await inv2.goto(offerUrl);
  await sign(inv2, seeded.name);
  await page.goto(dealRoom);
  await sign(page, founderName);
  await expect(page.getByText("Committed: agreements & deposits")).toBeVisible();

  // The signed agreement downloads as a PDF for its parties only.
  await inv2.goto(offerUrl);
  const docLinks = inv2.getByRole("link", { name: "Download PDF" });
  await expect(docLinks).toHaveCount(2);
  const agreementPdf = await inv2.request.get((await docLinks.last().getAttribute("href"))!);
  expect(agreementPdf.headers()["content-type"]).toBe("application/pdf");
  expect((await agreementPdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
  const stranger = await browser.newContext();
  expect((await stranger.request.get((await docLinks.last().getAttribute("href"))!, { maxRedirects: 0 })).status()).not.toBe(200);
  await stranger.close();
  await expect(inv2.getByText(/Use the payment reference/)).toBeVisible();
  await shot(inv2, "28-investor-deposit-instructions");

  // Escrow is maker-checker: the admin records the deposit, finance approves it.
  const recordEntry = async (p: Page, type: string, amount: string, pick: { label: string; option: string }, reference: string) => {
    await p.getByLabel(exactLabel("Entry")).selectOption(type);
    await p.getByLabel(exactLabel("Amount")).fill(amount);
    await p.getByLabel(pick.label).selectOption({ label: pick.option });
    await p.getByLabel("Bank reference").fill(reference);
    await p.getByRole("button", { name: "Record entry" }).click();
    await expect(p.getByText(`Ref ${reference}`)).toBeVisible();
  };
  await admin.goto(adminDeal);
  await recordEntry(admin, "DEPOSIT", "1000000", { label: "Investor commitment", option: "Sara Qureshi: PKR 1,000,000" }, "HBL-TT-0001");
  await expect(admin.getByText("Needs another approver")).toBeVisible();

  await login(fin, finance.email, finance.password, finance.secret, new Set());
  await expect(fin).toHaveURL(/\/admin/);
  await fin.goto(adminDeal);
  const ledgerRow = (p: Page, text: string) => p.getByRole("row").filter({ hasText: text });
  await ledgerRow(fin, "HBL-TT-0001").getByRole("button", { name: "Approve", exact: true }).click();
  await expect(ledgerRow(fin, "HBL-TT-0001")).toContainText("posted");
  // The round is funded: the 10% success fee is queued automatically and approved by finance.
  await expect(fin.getByText("Funded: in execution")).toBeVisible();
  await expect(ledgerRow(fin, "RamiZeeZ fee")).toContainText("100,000");
  await ledgerRow(fin, "RamiZeeZ fee").getByRole("button", { name: "Approve", exact: true }).click();
  await expect(ledgerRow(fin, "RamiZeeZ fee")).toContainText("posted");
  await expect(fin.getByText("PKR 900,000", { exact: true })).toBeVisible();

  // Milestone 1: the founder submits evidence, execution approves, finance records the release, the admin approves it.
  await page.goto(dealRoom);
  const m1 = page.getByRole("listitem").filter({ hasText: "Van on the road" });
  await m1.getByLabel("What was achieved?").fill("The van is registered and on the road, with 112 paying subscribers.");
  await m1.locator("input[type=file]").setInputFiles({ name: "van-registration.pdf", mimeType: "application/pdf", buffer: PDF });
  await m1.getByRole("button", { name: "Submit evidence" }).click();
  await expect(m1.getByText("Evidence under review")).toBeVisible();
  await shot(page, "29-founder-milestone-evidence");

  await admin.goto(adminDeal);
  const adminM1 = admin.getByRole("listitem").filter({ hasText: "Van on the road" });
  await expect(adminM1.getByRole("link", { name: /van-registration\.pdf/ })).toBeVisible();
  await adminM1.getByRole("button", { name: "Approve milestone" }).click();
  await expect(adminM1.getByText("Approved: release pending")).toBeVisible();

  await fin.goto(adminDeal);
  await recordEntry(fin, "RELEASE", "500000", { label: "Milestone", option: "Month 1: Van on the road" }, "HBL-TT-0002");
  await admin.goto(adminDeal);
  await ledgerRow(admin, "HBL-TT-0002").getByRole("button", { name: "Approve", exact: true }).click();
  await expect(ledgerRow(admin, "HBL-TT-0002")).toContainText("posted");
  await expect(admin.getByText("PKR 400,000", { exact: true })).toBeVisible();
  await shot(admin, "30-admin-deal-escrow");

  await inv2.goto(offerUrl);
  await expect(inv2.getByText("is held in escrow")).toBeVisible();
  await expect(inv2.getByRole("listitem").filter({ hasText: "Van on the road" }).getByText("Released")).toBeVisible();
  await shot(inv2, "31-investor-milestones");
  await page.goto(dealRoom);
  await expect(page.getByText("Funded: in execution")).toBeVisible();

  // ── Returning sign-in requires the authenticator code ──
  await page.getByRole("button", { name: "Sign out" }).click();
  await login(page, investor.email, investor.password, user2fa.secret, user2fa.used);
  await expect(page).toHaveURL(/dashboard/);
});
