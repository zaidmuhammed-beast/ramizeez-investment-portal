"use client";

import { useActionState } from "react";
import { initialFormState } from "@/lib/form-state";
import { SubmitButton } from "@/components/ui/button";
import { Form, TextField } from "@/components/ui/form";
import type { Dict } from "@/i18n/dictionaries/en";
import { loginAction } from "../actions";

export function LoginForm({ t }: { t: Dict["auth"]["login"] }) {
  const [state, action] = useActionState(loginAction, initialFormState);
  return (
    <Form state={state} action={action}>
      <TextField name="email" label={t.email} type="email" autoComplete="username" required />
      <TextField name="password" label={t.password} type="password" autoComplete="current-password" required />
      <SubmitButton className="w-full py-3" pendingText={t.submitting}>
        {t.submit}
      </SubmitButton>
    </Form>
  );
}
