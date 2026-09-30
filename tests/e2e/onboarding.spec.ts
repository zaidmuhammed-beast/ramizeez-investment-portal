import { expect, test, type Page } from "@playwright/test";
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
const answer = (page: Page, question: string, value: "yes" | "no") =>
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

test("investor onboarding through all verification tiers", async ({ browser }) => {
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
  await page.getByLabel("I am investing as").selectOption("HIGH_NET_WORTH");
  await page.getByLabel("Currency").selectOption("USD");
  await page.getByLabel("Total budget for the platform").fill("250000");
  await page.getByLabel("Minimum per deal").fill("10000");
  await page.getByLabel("Maximum per deal").fill("75000");
  await page.getByLabel("Salary / employment income").check();
  await page.getByLabel("Overseas earnings / remittance").check();
  await page.getByLabel("How did you build your overall wealth?").fill("Fourteen years of salary savings in Dubai plus a property sale in Lahore in 2022.");
  await page.getByLabel("Annual income").selectOption("USD 150k–500k");
  await page.getByRole("combobox", { name: "Net worth", exact: true }).selectOption("USD 500k–2M");
  await page.locator("#proofOfFunds").setInputFiles({ name: "bank-statement.pdf", mimeType: "application/pdf", buffer: PDF });
  await page.getByLabel("Your investment experience").fill("Angel investor in two Karachi startups since 2019.");
  await page.getByLabel("Food & beverage").check();
  await page.getByLabel("Early revenue").check();
  await page.getByLabel("Musharakah").check();
  await page.getByLabel("Equity", { exact: true }).check();
  await page.getByLabel("Pakistan", { exact: true }).check();
  await answer(page, "Shariah-compliant", "no");
  await answer(page, "losing all the money", "yes");
  await answer(page, "locked in", "yes");
  await page.getByLabel(/How long can you leave money/).selectOption("GT5");
  await page.getByLabel(/What share of your total net worth/).selectOption("10TO25");
  await page.getByLabel(/lost half its value/).selectOption("HOLD");
  // USD 100 is below the PKR 100,000 platform minimum.
  await page.getByLabel("Minimum per deal").fill("100");
  await page.getByRole("button", { name: "Save investor profile" }).click();
  await expect(page.getByText(/The minimum investment per deal is PKR 100,000 \(≈ USD \d+\)/)).toBeVisible();
  await page.getByLabel("Minimum per deal").fill("10000");
  await page.locator("#proofOfFunds").setInputFiles({ name: "bank-statement.pdf", mimeType: "application/pdf", buffer: PDF });
  await page.getByRole("button", { name: "Save investor profile" }).click();
  await expect(page.getByText("Investor profile saved.")).toBeVisible();
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

  // ── Returning sign-in requires the authenticator code ──
  await page.getByRole("button", { name: "Sign out" }).click();
  await login(page, investor.email, investor.password, user2fa.secret, user2fa.used);
  await expect(page).toHaveURL(/dashboard/);
});
