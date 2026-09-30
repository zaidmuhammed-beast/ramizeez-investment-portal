"use client";

import { useActionState } from "react";
import { initialFormState } from "@/lib/form-state";
import { SubmitButton } from "@/components/ui/button";
import { Form, TextField } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import type { Dict } from "@/i18n/dictionaries/en";
import { verifyContactAction } from "../actions";

export function ContactCodeForm({
  channel,
  destination,
  verified,
  t,
}: {
  channel: "EMAIL" | "PHONE";
  destination: string;
  verified: boolean;
  t: Dict["auth"]["contact"] & { verify: string; verified: string };
}) {
  const [state, action] = useActionState(verifyContactAction, initialFormState);
  const title = channel === "EMAIL" ? t.email : t.phone;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="font-medium text-white">{title}</p>
          <p className="text-sm text-slate-400">{destination}</p>
        </div>
        {verified && <Badge tone="green">{t.verified}</Badge>}
      </div>
      {!verified && (
        <Form state={state} action={action} className="space-y-3">
          <input type="hidden" name="channel" value={channel} />
          <div className="flex items-start gap-3">
            <TextField
              name="code"
              label={`${title} ${t.codeSuffix}`}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              className="flex-1 [&_input]:font-mono [&_input]:tracking-[0.3em]"
              aria-label={`${title} ${t.codeSuffix}`}
            />
            <SubmitButton name="intent" value="verify" className="mt-7" pendingText="…">
              {t.verify}
            </SubmitButton>
          </div>
          {state.errors?.[`code_${channel}`] && <p className="text-xs text-rose-300">{state.errors[`code_${channel}`]}</p>}
          <SubmitButton name="intent" value="resend" variant="ghost" className="px-0 text-xs" pendingText={t.sending}>
            {t.resend}
          </SubmitButton>
        </Form>
      )}
    </div>
  );
}
