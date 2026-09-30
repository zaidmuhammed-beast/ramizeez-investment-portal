"use client";

import { useActionState, useState } from "react";
import { initialFormState } from "@/lib/form-state";
import { Button, SubmitButton } from "@/components/ui/button";
import { Form, TextField } from "@/components/ui/form";
import { secondFactorAction } from "../../actions";

export function SecondFactorForm() {
  const [state, action] = useActionState(secondFactorAction, initialFormState);
  const [mode, setMode] = useState<"totp" | "recovery">(state.values?.mode === "recovery" ? "recovery" : "totp");
  return (
    <Form state={state} action={action}>
      <input type="hidden" name="mode" value={mode} />
      {mode === "totp" ? (
        <TextField
          key="totp"
          name="code"
          label="Authentication code"
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
        <TextField key="recovery" name="code" label="Recovery code" placeholder="ABCD-EFGH" autoFocus required hint="Each recovery code works only once." />
      )}
      <SubmitButton className="w-full py-3" pendingText="Verifying…">
        Verify
      </SubmitButton>
      <Button type="button" variant="ghost" className="w-full" onClick={() => setMode(mode === "totp" ? "recovery" : "totp")}>
        {mode === "totp" ? "Lost your phone? Use a recovery code" : "Use authenticator app instead"}
      </Button>
    </Form>
  );
}
