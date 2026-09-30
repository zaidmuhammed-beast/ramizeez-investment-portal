"use client";

import { useActionState } from "react";
import type { IntegrityDeclaration } from "@prisma/client";
import { initialFormState } from "@/lib/form-state";
import { SubmitButton } from "@/components/ui/button";
import { Checkbox, Form, SelectField, TextArea, TextField, YesNo, type Option } from "@/components/ui/form";
import { RepeaterForm, type RepeaterField } from "@/components/repeater-form";
import { saveDeclarationsAction, saveGoalsAction, saveListAction, savePersonalAction, type ListKind } from "./actions";

type Defaults = Record<string, string>;

export function PersonalForm({ countries, defaults, isInvestor }: { countries: Option[]; defaults: Defaults; isInvestor: boolean }) {
  const [state, action] = useActionState(savePersonalAction, initialFormState);
  return (
    <Form state={state} action={action}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="preferredName" label="Preferred name" defaultValue={defaults.preferredName} />
        <TextField name="dateOfBirth" label="Date of birth" type="date" required defaultValue={defaults.dateOfBirth} />
        <TextField name="fatherOrSpouseName" label="Father's / husband's name" required defaultValue={defaults.fatherOrSpouseName} hint="As printed on your CNIC, if you have one" />
        <SelectField
          name="gender"
          label="Gender"
          defaultValue={defaults.gender}
          options={[
            { value: "Male", label: "Male" },
            { value: "Female", label: "Female" },
            { value: "Prefer not to say", label: "Prefer not to say" },
          ]}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField name="nationality1" label="Nationality" required options={countries} defaultValue={defaults.nationality1} />
        <SelectField name="nationality2" label="Second nationality" options={countries} defaultValue={defaults.nationality2} placeholder="None" />
        <SelectField name="nationality3" label="Third nationality" options={countries} defaultValue={defaults.nationality3} placeholder="None" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField
          name="maritalStatus"
          label="Marital status"
          defaultValue={defaults.maritalStatus}
          options={["Single", "Married", "Divorced", "Widowed", "Prefer not to say"].map((v) => ({ value: v, label: v }))}
        />
        <TextField name="dependants" label="Dependants" type="number" min={0} defaultValue={defaults.dependants} />
        <TextField name="languages" label="Languages spoken" required placeholder="English, Urdu, Punjabi" defaultValue={defaults.languages} hint="Separate with commas" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="linkedinUrl"
          label="LinkedIn profile"
          type="url"
          required={isInvestor}
          placeholder="https://www.linkedin.com/in/…"
          defaultValue={defaults.linkedinUrl}
          hint={isInvestor ? "Required for investors" : "Strongly recommended"}
        />
        <TextField name="websiteUrl" label="Website" type="url" placeholder="https://" defaultValue={defaults.websiteUrl} />
      </div>
      <TextArea name="otherLinks" label="Other public profiles, media coverage or awards" rows={2} defaultValue={defaults.otherLinks} />
      <TextArea
        name="bio"
        label="About you"
        required
        rows={6}
        defaultValue={defaults.bio}
        hint="At least 100 characters. Your background, what you are known for, and what you bring to a business partnership."
      />
      <SubmitButton pendingText="Saving…">Save personal details</SubmitButton>
    </Form>
  );
}

const YEAR = { type: "number" as const, placeholder: "YYYY" };

const LIST_CONFIG: Record<ListKind, { fields: RepeaterField[]; itemLabel: string; minItems: number; addLabel: string }> = {
  education: {
    itemLabel: "Qualification",
    minItems: 1,
    addLabel: "Add qualification",
    fields: [
      { name: "institution", label: "Institution", required: true },
      { name: "qualification", label: "Qualification", required: true, placeholder: "e.g. BBA, MBA, ACCA, O/A Levels" },
      { name: "fieldOfStudy", label: "Field of study" },
      { name: "startYear", label: "Start year", ...YEAR },
      { name: "endYear", label: "End year", ...YEAR },
      { name: "notes", label: "Certifications, honours or notes", wide: true },
    ],
  },
  experience: {
    itemLabel: "Position",
    minItems: 1,
    addLabel: "Add position",
    fields: [
      { name: "employer", label: "Employer / business", required: true },
      { name: "title", label: "Job title", required: true },
      { name: "startYear", label: "Start year", required: true, ...YEAR },
      { name: "endYear", label: "End year (blank if current)", ...YEAR },
      { name: "responsibilities", label: "Responsibilities & achievements", type: "textarea", required: true },
      { name: "reasonForLeaving", label: "Reason for leaving", wide: true },
    ],
  },
  ventures: {
    itemLabel: "Business",
    minItems: 0,
    addLabel: "Add business",
    fields: [
      { name: "name", label: "Business name", required: true },
      { name: "sector", label: "Sector", required: true },
      { name: "startYear", label: "Start year", required: true, ...YEAR },
      { name: "endYear", label: "End year (blank if running)", ...YEAR },
      {
        name: "outcome",
        label: "Outcome",
        type: "select",
        required: true,
        options: [
          { value: "RUNNING", label: "Still running" },
          { value: "SOLD", label: "Sold / exited" },
          { value: "CLOSED", label: "Closed" },
          { value: "OTHER", label: "Other" },
        ],
      },
      { name: "lessons", label: "What did you learn?", type: "textarea", required: true },
    ],
  },
  references: {
    itemLabel: "Reference",
    minItems: 2,
    addLabel: "Add reference",
    fields: [
      { name: "name", label: "Full name", required: true },
      { name: "relationship", label: "Relationship", required: true, placeholder: "e.g. Former manager at …" },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "phone", label: "Phone (with country code)", type: "tel", required: true, placeholder: "+44 …" },
    ],
  },
};

export function ListSection({ kind, initial }: { kind: ListKind; initial: Record<string, string>[] }) {
  const cfg = LIST_CONFIG[kind];
  return (
    <RepeaterForm
      action={saveListAction.bind(null, kind)}
      fields={cfg.fields}
      initial={initial}
      itemLabel={cfg.itemLabel}
      minItems={cfg.minItems}
      addLabel={cfg.addLabel}
    />
  );
}

export function GoalsForm({ defaults }: { defaults: Defaults }) {
  const [state, action] = useActionState(saveGoalsAction, initialFormState);
  return (
    <Form state={state} action={action}>
      <TextArea name="goals1y" label="Your goals for the next 12 months" required defaultValue={defaults.goals1y} />
      <TextArea name="goals5y" label="Where do you want to be in 5 years?" required defaultValue={defaults.goals5y} />
      <TextArea name="goals10y" label="Your 10-year vision: personal and professional" required defaultValue={defaults.goals10y} />
      <TextArea name="motivation" label="Why do you want to be an entrepreneur or investor?" required defaultValue={defaults.motivation} />
      <TextArea name="causeCare" label="Which problem in society do you care most about solving?" required defaultValue={defaults.causeCare} />
      <TextArea name="successDefinition" label="What does success look like for you?" required defaultValue={defaults.successDefinition} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          name="timeCommitment"
          label="Time you can commit"
          required
          defaultValue={defaults.timeCommitment}
          options={[
            { value: "FULL_TIME", label: "Full time" },
            { value: "PART_TIME", label: "Part time" },
            { value: "FLEXIBLE", label: "Flexible / as needed" },
          ]}
        />
        <TextField name="otherCommitments" label="Other major commitments" defaultValue={defaults.otherCommitments} placeholder="Job, studies, other businesses…" />
      </div>
      <TextArea name="values" label="Your core values and working style" required rows={3} defaultValue={defaults.values} />
      <TextArea
        name="setbackStory"
        label="Describe a serious setback or failure, and what you did next"
        required
        rows={5}
        defaultValue={defaults.setbackStory}
      />
      <SubmitButton pendingText="Saving…">Save goals</SubmitButton>
    </Form>
  );
}

export function DeclarationsForm({ existing }: { existing: IntegrityDeclaration | null }) {
  const [state, action] = useActionState(saveDeclarationsAction, initialFormState);
  return (
    <Form state={state} action={action}>
      {existing && <p className="text-xs text-slate-400">Last signed {existing.signedAt.toUTCString()}. Saving again re-signs.</p>}
      <div className="space-y-3">
        <YesNo name="hasCriminalRecord" label="Have you ever been convicted of a criminal offence in any country?" defaultValue={existing?.hasCriminalRecord} />
        <YesNo name="hasPendingLitigation" label="Are you currently party to any court case, investigation or legal dispute?" defaultValue={existing?.hasPendingLitigation} />
        <YesNo name="hasBankruptcyOrDefault" label="Have you ever been declared bankrupt, or defaulted on a loan?" defaultValue={existing?.hasBankruptcyOrDefault} />
        <YesNo
          name="isPep"
          label="Are you, or is a close family member, a politically exposed person (a senior public official, politician, judge or military officer)?"
          defaultValue={existing?.isPep}
        />
        <YesNo name="hasConflictOfInterest" label="Do you have any relationship with RamiZeeZ staff, or any other conflict of interest?" defaultValue={existing?.hasConflictOfInterest} />
      </div>
      <TextArea name="details" label="Details for any “yes” answer" defaultValue={existing?.details ?? ""} />
      <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <Checkbox
          name="truthAffirmed"
          defaultChecked={existing?.truthAffirmed}
          label="I confirm that everything in my profile is true and complete. I understand false information leads to a permanent ban and may be reported to the authorities."
        />
        <Checkbox
          name="consentBackgroundCheck"
          defaultChecked={existing?.consentBackgroundCheck}
          label="I consent to RamiZeeZ running background, reference, sanctions and adverse-media checks on me."
        />
      </div>
      <SubmitButton pendingText="Signing…">Sign declarations</SubmitButton>
    </Form>
  );
}
