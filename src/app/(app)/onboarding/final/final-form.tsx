"use client";

import { useActionState } from "react";
import { initialFormState } from "@/lib/form-state";
import { SubmitButton } from "@/components/ui/button";
import { Form, TextArea, TextField } from "@/components/ui/form";
import { requestFinalAction } from "./actions";

export function FinalRequestForm() {
  const [state, action] = useActionState(requestFinalAction, initialFormState);
  return (
    <Form state={state} action={action}>
      <p className="text-sm text-slate-300">
        Have your original ID document ready for the call. The interview takes 15–30 minutes and can be in English or Urdu.
      </p>
      <TextArea name="availability" label="When are you available for a video call?" required placeholder="Weekdays after 6pm, Saturday mornings…" />
      <TextField
        name="timezone"
        label="Your time zone"
        required
        // Prefill from the browser once mounted (not known during server rendering).
        ref={(el) => {
          if (el && !el.value) el.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
        }}
      />
      <SubmitButton pendingText="Requesting…">Request final approval</SubmitButton>
    </Form>
  );
}
