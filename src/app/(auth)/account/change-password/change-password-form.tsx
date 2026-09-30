"use client";

import { useActionState, useState } from "react";
import { initialFormState } from "@/lib/form-state";
import { SubmitButton } from "@/components/ui/button";
import { Form, TextField } from "@/components/ui/form";
import { PasswordStrength } from "@/components/password-strength";
import { changePasswordAction } from "../../actions";

export function ChangePasswordForm() {
  const [state, action] = useActionState(changePasswordAction, initialFormState);
  const [pw, setPw] = useState("");
  return (
    <Form state={state} action={action}>
      <TextField name="current" label="Current password" type="password" autoComplete="current-password" required />
      <div>
        <TextField name="password" label="New password" type="password" autoComplete="new-password" required onChange={(e) => setPw(e.target.value)} />
        <PasswordStrength password={pw} />
      </div>
      <TextField name="confirmPassword" label="Confirm new password" type="password" autoComplete="new-password" required />
      <SubmitButton className="w-full py-3">Save password</SubmitButton>
    </Form>
  );
}
