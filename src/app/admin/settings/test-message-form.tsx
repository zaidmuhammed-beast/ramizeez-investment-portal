"use client";

import { useActionState } from "react";
import { initialFormState } from "@/lib/form-state";
import { SubmitButton } from "@/components/ui/button";
import { Form, SelectField, TextField } from "@/components/ui/form";
import { sendTestMessageAction } from "../actions";

export function TestMessageForm() {
  const [state, action] = useActionState(sendTestMessageAction, initialFormState);
  return (
    <Form state={state} action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[200px_1fr_auto] sm:items-end">
        <SelectField
          name="channel"
          label="Channel"
          required
          defaultValue="EMAIL"
          options={[
            { value: "EMAIL", label: "Email" },
            { value: "PHONE", label: "SMS" },
          ]}
        />
        <TextField name="to" label="Send to" required placeholder="you@example.com or +923001234567" />
        <SubmitButton pendingText="Sending…">Send test</SubmitButton>
      </div>
    </Form>
  );
}
