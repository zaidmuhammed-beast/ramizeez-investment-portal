"use client";

import { useActionState } from "react";
import { initialFormState } from "@/lib/form-state";
import { SubmitButton } from "@/components/ui/button";
import { Form, TextField } from "@/components/ui/form";
import { loginAction } from "../actions";

export function LoginForm() {
  const [state, action] = useActionState(loginAction, initialFormState);
  return (
    <Form state={state} action={action}>
      <TextField name="email" label="Email" type="email" autoComplete="username" required />
      <TextField name="password" label="Password" type="password" autoComplete="current-password" required />
      <SubmitButton className="w-full py-3" pendingText="Signing in…">
        Continue
      </SubmitButton>
    </Form>
  );
}
