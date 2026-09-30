"use client";

import { useActionState, useState } from "react";
import { initialFormState } from "@/lib/form-state";
import { BRAND } from "@/config/brand";
import { Button, LinkButton, SubmitButton } from "@/components/ui/button";
import { Form, TextField } from "@/components/ui/form";
import { Alert } from "@/components/ui/alert";
import { confirmTotpAction } from "../actions";

export function TotpSetupForm({ qr, secret, next }: { qr: string; secret: string; next: string }) {
  const [state, action] = useActionState(confirmTotpAction, initialFormState);
  const [saved, setSaved] = useState(false);
  const codes = state.data?.recoveryCodes as string[] | undefined;

  if (codes) {
    const download = () => {
      const blob = new Blob([`${BRAND.name} recovery codes\n\n${codes.join("\n")}\n`], { type: "text/plain" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "ramizeez-recovery-codes.txt";
      a.click();
      URL.revokeObjectURL(a.href);
    };
    return (
      <div className="space-y-5">
        <Alert tone="success">Two-factor authentication is on.</Alert>
        <div>
          <h3 className="font-medium text-white">Save your recovery codes</h3>
          <p className="mt-1 text-sm text-slate-400">
            If you lose your phone, each code lets you sign in once. They will not be shown again.
          </p>
        </div>
        <ul className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-ink-950/60 p-4 font-mono text-sm text-slate-100" data-testid="recovery-codes">
          {codes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={download}>
            Download
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigator.clipboard.writeText(codes.join("\n"))}>
            Copy
          </Button>
        </div>
        <label className="flex items-center gap-3 text-sm text-slate-300">
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="size-4 accent-brand-400" />
          I have stored these codes somewhere safe
        </label>
        <LinkButton href={next} aria-disabled={!saved} className={saved ? "w-full" : "pointer-events-none w-full opacity-50"}>
          Continue
        </LinkButton>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ol className="space-y-6 text-sm text-slate-300">
        <li>
          <p className="mb-3 font-medium text-white">1. Scan this QR code with your authenticator app</p>
          <div className="flex flex-wrap items-center gap-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="Authenticator QR code" width={180} height={180} className="rounded-xl bg-white p-2" />
            <div className="text-xs text-slate-400">
              <p>Can&apos;t scan? Enter this key manually:</p>
              <code className="mt-2 block rounded-lg bg-ink-950/60 px-3 py-2 font-mono text-sm tracking-wider text-brand-200" data-testid="totp-secret">
                {secret}
              </code>
            </div>
          </div>
        </li>
        <li>
          <p className="mb-3 font-medium text-white">2. Enter the 6-digit code it shows</p>
          <Form state={state} action={action}>
            <TextField
              name="code"
              label="Authentication code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              required
              className="[&_input]:font-mono [&_input]:text-xl [&_input]:tracking-[0.4em]"
            />
            <SubmitButton className="w-full py-3" pendingText="Verifying…">
              Turn on two-factor
            </SubmitButton>
          </Form>
        </li>
      </ol>
    </div>
  );
}
