"use client";

import { useActionState } from "react";
import { initialFormState } from "@/lib/form-state";
import { SubmitButton } from "@/components/ui/button";
import { Form, SelectField, TextField, type Option } from "@/components/ui/form";
import { createTeamMemberAction } from "../actions";

export function TeamMemberForm({ roles, countries }: { roles: Option[]; countries: Option[] }) {
  const [state, action] = useActionState(createTeamMemberAction, initialFormState);
  const temp = state.data?.tempPassword as string | undefined;
  return (
    <Form state={state} action={action}>
      {temp && (
        <div className="rounded-xl border border-gold-400/40 bg-gold-400/10 p-4 text-sm">
          <p className="text-gold-300">Temporary password (shown once):</p>
          <code className="mt-1 block font-mono text-base text-white" data-testid="temp-password">
            {temp}
          </code>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="firstName" label="First name" required />
        <TextField name="lastName" label="Last name" required />
      </div>
      <TextField name="email" label="Work email" type="email" required />
      <SelectField name="phoneCountry" label="Phone country" options={countries} required defaultValue="PK" />
      <TextField name="phone" label="Mobile number" type="tel" required />
      <SelectField name="teamRole" label="Role" options={roles} required />
      <SubmitButton className="w-full" pendingText="Creating…">
        Create account
      </SubmitButton>
    </Form>
  );
}
