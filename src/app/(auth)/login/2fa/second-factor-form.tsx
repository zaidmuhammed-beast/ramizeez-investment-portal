"use client";

import { useActionState, useState } from "react";
import { initialFormState } from "@/lib/form-state";
import { Button, SubmitButton } from "@/components/ui/button";
import { Form, TextField } from "@/components/ui/form";
import type { Dict } from "@/i18n/dictionaries/en";
import { secondFactorAction } from "../../actions";

export function SecondFactorForm({ t, verify, verifying }: { t: Dict["auth"]["secondFactor"]; verify: string; verifying: string }) {
  const [state, action] = useActionState(secondFactorAction, initialFormState);
  const [mode, setMode] = useState<"totp" | "recovery">(state.values?.mode === "recovery" ? "recovery" : "totp");
  return (
    <Form state={state} action={action}>
      <input type="hidden" name="mode" value={mode} />
      {mode === "totp" ? (
        <TextField
          key="totp"
          name="code"
          label={t.code}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          placeholder="123456"
          autoFocus
          required
          className="[&_input]:text-center [&_input]:font-mono [&_input]:text-2xl [&_input]:tracking-[0.5em]"
        />
      ) : (
        <TextField key="recovery" name="code" label={t.recovery} placeholder="ABCD-EFGH" autoFocus required hint={t.recoveryHint} />
      )}
      <SubmitButton className="w-full py-3" pendingText={verifying}>
        {verify}
      </SubmitButton>
      <Button type="button" variant="ghost" className="w-full" onClick={() => setMode(mode === "totp" ? "recovery" : "totp")}>
        {mode === "totp" ? t.useRecovery : t.useApp}
      </Button>
    </Form>
  );
}
