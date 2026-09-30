import type { Metadata } from "next";
import { requireTeam } from "@/lib/auth/rbac";
import { messagingStatus } from "@/lib/messaging";
import { FX_RATES_PKR, FX_RATES_REVIEWED, MIN_AMOUNT_PKR, PLATFORM_TERMS } from "@/config/platform";
import { BRAND } from "@/config/brand";
import { Card, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";
import { TestMessageForm } from "./test-message-form";

export const metadata: Metadata = { title: "Settings" };

const EMAIL_OPTIONS = [
  { id: "resend", name: "Resend", note: "Simple HTTPS API with a generous free tier. Needs a verified sending domain.", vars: ["RESEND_API_KEY", "EMAIL_FROM"] },
  { id: "sendgrid", name: "SendGrid (Twilio)", note: "Established provider with detailed delivery analytics.", vars: ["SENDGRID_API_KEY", "EMAIL_FROM"] },
  { id: "smtp", name: "Any SMTP server", note: "Google Workspace, Microsoft 365, Zoho, Amazon SES SMTP or your host's mail server.", vars: ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASS", "EMAIL_FROM"] },
];

const SMS_OPTIONS = [
  { id: "twilio", name: "Twilio", note: "Global coverage including Pakistan, the Gulf, the UK and North America. A number, sender ID or Messaging Service.", vars: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM"] },
  { id: "vonage", name: "Vonage", note: "Global SMS API, often cheaper for international routes.", vars: ["VONAGE_API_KEY", "VONAGE_API_SECRET", "VONAGE_FROM"] },
  { id: "http", name: "Local SMS gateway (HTTP)", note: "Any Pakistani SMS aggregator with an HTTP API, set up with a URL / body template.", vars: ["SMS_HTTP_URL", "SMS_HTTP_METHOD", "SMS_HTTP_BODY", "SMS_HTTP_CONTENT_TYPE", "SMS_HTTP_HEADERS", "SMS_HTTP_SUCCESS_MATCH"] },
];

function ProviderList({ options, active, envVar }: { options: typeof EMAIL_OPTIONS; active: string; envVar: string }) {
  return (
    <ul className="space-y-3">
      {options.map((o) => (
        <li key={o.id} className={cn("rounded-xl border p-4", active === o.id ? "border-brand-400/50 bg-brand-400/5" : "border-white/10 bg-white/[0.02]")}>
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-white">{o.name}</p>
            {active === o.id ? <Badge tone="green">Active</Badge> : <code className="text-xs text-slate-500">{envVar}={o.id}</code>}
          </div>
          <p className="mt-1 text-sm text-slate-400">{o.note}</p>
          <p className="mt-2 font-mono text-[11px] text-slate-500">{o.vars.join(" · ")}</p>
        </li>
      ))}
    </ul>
  );
}

export default async function SettingsPage() {
  await requireTeam("team.manage");
  const status = messagingStatus();

  return (
    <>
      <PageHeader
        title="Settings"
        description="Platform terms and message delivery. Values come from the deployment configuration (environment variables and src/config), so changes go through a redeploy and leave an audit trail in version control."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Platform terms" description={`Version ${PLATFORM_TERMS.version}. Founders accept these during role verification.`}>
          <dl className="grid grid-cols-3 gap-4">
            <div>
              <dt className="text-xs uppercase tracking-wider text-slate-500">Success fee</dt>
              <dd className="mt-1 text-2xl font-semibold text-white">{PLATFORM_TERMS.successFeePercent}%</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-slate-500">Business share</dt>
              <dd className="mt-1 text-2xl font-semibold text-white">{PLATFORM_TERMS.businessSharePercent}%</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-slate-500">Minimum</dt>
              <dd className="mt-1 text-2xl font-semibold text-white">PKR {(MIN_AMOUNT_PKR / 1000).toLocaleString("en-US")}k</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-slate-400">
            The minimum applies to each pitch&apos;s raise and to each investment. Brand name: <span className="text-slate-200">{BRAND.name}</span> (placeholder; set in src/config/brand.ts).
          </p>
        </Card>

        <Card title="Currency rates for minimums" description={`Indicative PKR value per unit, reviewed ${FX_RATES_REVIEWED}. Used only to check minimums for foreign-currency investors.`}>
          <div className="grid grid-cols-4 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-5">
            {Object.entries(FX_RATES_PKR)
              .filter(([c]) => c !== "PKR")
              .map(([c, r]) => (
                <div key={c} className="flex justify-between gap-2">
                  <span className="text-slate-400">{c}</span>
                  <span className="font-mono text-slate-200">{r}</span>
                </div>
              ))}
          </div>
        </Card>

        <Card
          title="Email delivery"
          actions={<Badge tone={status.email.provider === "outbox" ? "amber" : "green"}>{status.email.provider === "outbox" ? "Outbox only (testing)" : status.email.provider}</Badge>}
          description={status.email.provider === "outbox" ? "Emails are recorded in the outbox but not delivered. Choose one of the options below." : `Sending as ${status.email.from}${status.email.detail ? ` via ${status.email.detail}` : ""}.`}
        >
          <ProviderList options={EMAIL_OPTIONS} active={status.email.provider} envVar="EMAIL_PROVIDER" />
        </Card>

        <Card
          title="SMS delivery"
          actions={<Badge tone={status.sms.provider === "outbox" ? "amber" : "green"}>{status.sms.provider === "outbox" ? "Outbox only (testing)" : status.sms.provider}</Badge>}
          description={status.sms.provider === "outbox" ? "SMS messages are recorded in the outbox but not delivered. Choose one of the options below." : `Sending${status.sms.from ? ` as ${status.sms.from}` : ""}${status.sms.detail ? ` via ${status.sms.detail}` : ""}.`}
        >
          <ProviderList options={SMS_OPTIONS} active={status.sms.provider} envVar="SMS_PROVIDER" />
        </Card>

        <Card title="Send a test message" description="Check a provider after changing its configuration." className="lg:col-span-2">
          <TestMessageForm />
        </Card>
      </div>
    </>
  );
}
