"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { Country } from "@/lib/countries";
import { initialFormState } from "@/lib/form-state";
import { SubmitButton } from "@/components/ui/button";
import { Checkbox, CheckboxGroup, Form, SelectField, TextField } from "@/components/ui/form";
import { PasswordStrength } from "@/components/password-strength";
import { signupAction } from "../actions";

export function SignupForm({ countries, preselectedRoles }: { countries: Country[]; preselectedRoles: string[] }) {
  const [state, action] = useActionState(signupAction, initialFormState);
  const [password, setPassword] = useState("");
  const countryOptions = countries.map((c) => ({ value: c.code, label: c.name }));
  const dialOptions = countries.filter((c) => c.dial).map((c) => ({ value: c.code, label: `${c.name} (${c.dial})` }));

  return (
    <Form state={state} action={action}>
      <CheckboxGroup
        name="roles"
        label="I am joining as"
        required
        defaultValue={preselectedRoles}
        options={[
          { value: "FOUNDER", label: "Founder: I want to pitch" },
          { value: "INVESTOR", label: "Investor: I want to invest" },
        ]}
        hint="You can hold both roles. Each role is verified separately."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="firstName" label="First name" autoComplete="given-name" required hint="Exactly as on your ID" />
        <TextField name="lastName" label="Last name" autoComplete="family-name" required hint="Exactly as on your ID" />
      </div>
      <TextField name="email" label="Email" type="email" autoComplete="email" required />
      <SelectField name="countryOfResidence" label="Country of residence" options={countryOptions} required defaultValue="PK" />
      <div className="grid gap-4 sm:grid-cols-[1fr_1.2fr]">
        <SelectField name="phoneCountry" label="Phone country code" options={dialOptions} required defaultValue="PK" />
        <TextField name="phone" label="Mobile number" type="tel" autoComplete="tel-national" required placeholder="300 1234567" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <TextField
            name="password"
            label="Password"
            type="password"
            autoComplete="new-password"
            required
            onChange={(e) => setPassword(e.target.value)}
          />
          <PasswordStrength password={password} />
        </div>
        <TextField name="confirmPassword" label="Confirm password" type="password" autoComplete="new-password" required />
      </div>
      <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <Checkbox
          name="acceptTerms"
          label={
            <>
              I agree to the{" "}
              <Link href="/legal/terms" className="text-brand-300 underline-offset-2 hover:underline" target="_blank">
                Terms of Use
              </Link>
              , including the non-circumvention rules.
            </>
          }
        />
        <Checkbox
          name="acceptPrivacy"
          label={
            <>
              I consent to identity verification, sanctions screening and background checks, as described in the{" "}
              <Link href="/legal/privacy" className="text-brand-300 underline-offset-2 hover:underline" target="_blank">
                Privacy Policy
              </Link>
              .
            </>
          }
        />
      </div>
      <SubmitButton className="w-full py-3" pendingText="Creating account…">
        Create account
      </SubmitButton>
    </Form>
  );
}
