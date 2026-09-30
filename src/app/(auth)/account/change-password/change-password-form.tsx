"use client";

import { useActionState, useState } from "react";
import { initialFormState } from "@/lib/form-state";
import { SubmitButton } from "@/components/ui/button";
import { Form, TextField } from "@/components/ui/form";
import { PasswordStrength } from "@/components/password-strength";
import type { Dict } from "@/i18n/dictionaries/en";
import { changePasswordAction } from "../../actions";

export function ChangePasswordForm({ t, rules }: { t: Dict["auth"]["password"]; rules: string[] }) {
  const [state, action] = useActionState(changePasswordAction, initialFormState);
  const [pw, setPw] = useState("");
  return (
    <Form state={state} action={action}>
      <TextField name="current" label={t.current} type="password" autoComplete="current-password" required />
      <div>
        <TextField name="password" label={t.next} type="password" autoComplete="new-password" required onChange={(e) => setPw(e.target.value)} />
        <PasswordStrength password={pw} labels={rules} />
      </div>
      <TextField name="confirmPassword" label={t.confirm} type="password" autoComplete="new-password" required />
      <SubmitButton className="w-full py-3">{t.submit}</SubmitButton>
    </Form>
  );
}
