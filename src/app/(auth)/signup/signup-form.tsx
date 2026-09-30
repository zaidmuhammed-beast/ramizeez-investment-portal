"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { Country } from "@/lib/countries";
import { initialFormState } from "@/lib/form-state";
import { SubmitButton } from "@/components/ui/button";
import { Checkbox, CheckboxGroup, Form, SelectField, TextField } from "@/components/ui/form";
import { PasswordStrength } from "@/components/password-strength";
import type { Dict } from "@/i18n/dictionaries/en";
import { signupAction } from "../actions";

export function SignupForm({ countries, preselectedRoles, t, rules, select }: { countries: Country[]; preselectedRoles: string[]; t: Dict["auth"]["signup"]; rules: string[]; select: string }) {
  const [state, action] = useActionState(signupAction, initialFormState);
  const [password, setPassword] = useState("");
  const countryOptions = countries.map((c) => ({ value: c.code, label: c.name }));
  const dialOptions = countries.filter((c) => c.dial).map((c) => ({ value: c.code, label: `${c.name} (${c.dial})` }));

  return (
    <Form state={state} action={action}>
      <CheckboxGroup
        name="roles"
        label={t.joiningAs}
        required
        defaultValue={preselectedRoles}
        options={[
          { value: "FOUNDER", label: t.founder },
          { value: "INVESTOR", label: t.investor },
        ]}
        hint={t.rolesHint}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="firstName" label={t.firstName} autoComplete="given-name" required hint={t.asOnId} />
        <TextField name="lastName" label={t.lastName} autoComplete="family-name" required hint={t.asOnId} />
      </div>
      <TextField name="email" label={t.email} type="email" autoComplete="email" required />
      <SelectField name="countryOfResidence" label={t.country} options={countryOptions} required defaultValue="PK" placeholder={select} />
      <div className="grid gap-4 sm:grid-cols-[1fr_1.2fr]">
        <SelectField name="phoneCountry" label={t.phoneCountry} options={dialOptions} required defaultValue="PK" placeholder={select} />
        <TextField name="phone" label={t.phone} type="tel" autoComplete="tel-national" required placeholder="300 1234567" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <TextField
            name="password"
            label={t.password}
            type="password"
            autoComplete="new-password"
            required
            onChange={(e) => setPassword(e.target.value)}
          />
          <PasswordStrength password={password} labels={rules} />
        </div>
        <TextField name="confirmPassword" label={t.confirmPassword} type="password" autoComplete="new-password" required />
      </div>
      <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <Checkbox
          name="acceptTerms"
          label={
            <>
              {t.termsBefore}{" "}
              <Link href="/legal/terms" className="text-brand-300 underline-offset-2 hover:underline" target="_blank">
                {t.termsLink}
              </Link>
              {t.termsAfter}
            </>
          }
        />
        <Checkbox
          name="acceptPrivacy"
          label={
            <>
              {t.privacyBefore}{" "}
              <Link href="/legal/privacy" className="text-brand-300 underline-offset-2 hover:underline" target="_blank">
                {t.privacyLink}
              </Link>
              {t.privacyAfter}
            </>
          }
        />
      </div>
      <SubmitButton className="w-full py-3" pendingText={t.submitting}>
        {t.submit}
      </SubmitButton>
    </Form>
  );
}
