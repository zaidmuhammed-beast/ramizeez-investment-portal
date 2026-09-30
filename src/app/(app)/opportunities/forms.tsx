"use client";

import { useActionState, useState } from "react";
import { initialFormState } from "@/lib/form-state";
import { Button, SubmitButton } from "@/components/ui/button";
import { Checkbox, Form, TextArea, TextField } from "@/components/ui/form";
import { requestAccessAction, signNdaAction, toggleWatchAction, withdrawRequestAction } from "./actions";

export function NdaForm({ pitchId, legalName, clauses, remaining }: { pitchId: string; legalName: string; clauses: string[]; remaining: number }) {
  const [state, action] = useActionState(signNdaAction.bind(null, pitchId), initialFormState);
  return (
    <Form state={state} action={action}>
      <div className="max-h-80 space-y-3 overflow-y-auto rounded-xl border border-white/10 bg-ink-950/50 p-4 text-sm text-slate-300" tabIndex={0} aria-label="Agreement text">
        <p className="font-semibold text-white">{clauses[0]}</p>
        {clauses.slice(1).map((c) => (
          <p key={c.slice(0, 24)}>{c}</p>
        ))}
      </div>
      <TextField name="typedName" label="Type your full legal name to sign" required autoComplete="off" placeholder={legalName} hint={`This must match your verified name: ${legalName}`} />
      <Checkbox name="agree" label="I have read and agree to this Non-Disclosure and Non-Circumvention Agreement. My electronic signature is legally binding." />
      <SubmitButton className="w-full" pendingText="Signing…">
        Sign NDA & unlock the summary
      </SubmitButton>
      <p className="text-center text-xs text-slate-500">This uses 1 of your {remaining} remaining unlocks this month.</p>
    </Form>
  );
}

export function AccessRequestForm({ pitchId, currency, min, max }: { pitchId: string; currency: string; min: number; max: number }) {
  const [state, action] = useActionState(requestAccessAction.bind(null, pitchId), initialFormState);
  return (
    <Form state={state} action={action}>
      <TextField
        name="intendedAmount"
        label={`How much do you intend to invest? (${currency})`}
        type="number"
        min={min}
        max={max}
        step="any"
        required
        hint={`Between ${currency} ${min.toLocaleString("en-US")} and ${currency} ${max.toLocaleString("en-US")}. This is an expression of interest, not a commitment.`}
      />
      <TextArea name="message" label="Message to the founder (optional)" rows={3} hint="Why this opportunity interests you, or what you'd like to see. Don't include contact details: they're removed." />
      <SubmitButton className="w-full" pendingText="Sending…">
        Request full data-room access
      </SubmitButton>
    </Form>
  );
}

function ActionButton({ label, run, variant = "secondary" }: { label: string; run: () => Promise<void>; variant?: "secondary" | "ghost" }) {
  const [pending, setPending] = useState(false);
  return (
    <Button
      type="button"
      variant={variant}
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          await run();
        } finally {
          setPending(false);
        }
      }}
    >
      {label}
    </Button>
  );
}

export const WatchButton = ({ pitchId, watching }: { pitchId: string; watching: boolean }) => (
  <ActionButton label={watching ? "★ Watching" : "☆ Add to watchlist"} run={() => toggleWatchAction(pitchId)} />
);

export const WithdrawRequestButton = ({ pitchId }: { pitchId: string }) => <ActionButton label="Withdraw request" variant="ghost" run={() => withdrawRequestAction(pitchId)} />;
