"use client";

import { useActionState, useState } from "react";
import { initialFormState } from "@/lib/form-state";
import { BRAND } from "@/config/brand";
import { Button, LinkButton, SubmitButton } from "@/components/ui/button";
import { Form, TextField } from "@/components/ui/form";
import { Alert } from "@/components/ui/alert";
import type { Dict } from "@/i18n/dictionaries/en";
import { confirmTotpAction } from "../actions";

export function TotpSetupForm({ qr, secret, next, t }: { qr: string; secret: string; next: string; t: Dict["auth"]["setup"] & { continue: string; verifying: string } }) {
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
        <Alert tone="success">{t.on}</Alert>
        <div>
          <h3 className="font-medium text-white">{t.saveTitle}</h3>
          <p className="mt-1 text-sm text-slate-400">
            {t.saveBody}
          </p>
        </div>
        <ul className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-ink-950/60 p-4 font-mono text-sm text-slate-100" data-testid="recovery-codes">
          {codes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={download}>
            {t.download}
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigator.clipboard.writeText(codes.join("\n"))}>
            {t.copy}
          </Button>
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-300">
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="size-4 accent-brand-400" />
          {t.stored}
        </label>
        <LinkButton href={next} aria-disabled={!saved} className={saved ? "w-full" : "pointer-events-none w-full opacity-50"}>
          {t.continue}
        </LinkButton>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ol className="space-y-6 text-sm text-slate-300">
        <li>
          <p className="mb-3 font-medium text-white">{t.scan}</p>
          <div className="flex flex-wrap items-center gap-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt={t.qrAlt} width={180} height={180} className="rounded-xl bg-white p-2" />
            <div className="text-xs text-slate-400">
              <p>{t.cantScan}</p>
              <code className="mt-2 block rounded-lg bg-ink-950/60 px-3 py-2 font-mono text-sm tracking-wider text-brand-200" data-testid="totp-secret">
                {secret}
              </code>
            </div>
          </div>
        </li>
        <li>
          <p className="mb-3 font-medium text-white">{t.enter}</p>
          <Form state={state} action={action}>
            <TextField
              name="code"
              label={t.code}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              required
              className="[&_input]:font-mono [&_input]:text-xl [&_input]:tracking-[0.4em]"
            />
            <SubmitButton className="w-full py-3" pendingText={t.verifying}>
              {t.submit}
            </SubmitButton>
          </Form>
        </li>
      </ol>
    </div>
  );
}
