"use client";

import { useActionState } from "react";
import { initialFormState } from "@/lib/form-state";
import { SubmitButton } from "@/components/ui/button";
import { Form, SelectField, TextField, type Option } from "@/components/ui/form";
import { addWatchlistAction } from "../actions";

const LISTS: Option[] = [
  { value: "UN_SC", label: "UN Security Council" },
  { value: "OFAC", label: "US OFAC SDN" },
  { value: "EU", label: "EU consolidated" },
  { value: "UK_HMT", label: "UK HM Treasury" },
  { value: "NACTA_4TH_SCHEDULE", label: "NACTA Fourth Schedule (Pakistan)" },
  { value: "PEP", label: "Politically exposed person" },
  { value: "INTERNAL", label: "Internal blacklist" },
];

export function WatchlistForm({ countries }: { countries: Option[] }) {
  const [state, action] = useActionState(addWatchlistAction, initialFormState);
  return (
    <Form state={state} action={action}>
      <TextField name="fullName" label="Full name" required />
      <TextField name="aliases" label="Aliases" hint="Separate with commas" />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="dateOfBirth" label="Date of birth" type="date" />
        <SelectField name="country" label="Country" options={countries} placeholder="Any" />
      </div>
      <SelectField name="listSource" label="List" options={LISTS} required />
      <TextField name="reason" label="Reason / reference" />
      <SubmitButton className="w-full">Add to watchlist</SubmitButton>
    </Form>
  );
}
