"use client";

import { useActionState, useState, useTransition } from "react";
import type { CaseKind } from "@prisma/client";
import { initialFormState } from "@/lib/form-state";
import { Button, SubmitButton } from "@/components/ui/button";
import { Checkbox, Form, SelectField, TextArea, TextField } from "@/components/ui/form";
import { addCaseNoteAction, decideCaseAction, revealDocumentNumberAction, saveInterviewAction } from "../../actions";

export function RevealNumber({ docId, last4 }: { docId: string; last4: string }) {
  const [value, setValue] = useState<string>();
  const [pending, start] = useTransition();
  return value ? (
    <span className="font-mono">{value}</span>
  ) : (
    <span className="flex items-center gap-2">
      <span className="font-mono">••••{last4}</span>
      <button type="button" className="text-xs text-brand-300 hover:underline" disabled={pending} onClick={() => start(async () => setValue(await revealDocumentNumberAction(docId)))}>
        {pending ? "…" : "Reveal (logged)"}
      </button>
    </span>
  );
}

export function DecisionForm({
  caseId,
  kind,
  investor,
}: {
  caseId: string;
  kind: CaseKind;
  investor?: { currency: string; declaredBudget: string };
}) {
  const [state, action] = useActionState(decideCaseAction.bind(null, caseId), initialFormState);
  return (
    <Form state={state} action={action}>
      <SelectField
        name="decision"
        label="Decision"
        required
        options={[
          { value: "APPROVED", label: "Approve" },
          { value: "NEEDS_INFO", label: "Request more information" },
          { value: "REJECTED", label: "Reject" },
        ]}
      />
      {kind === "IDENTITY" && (
        <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <Checkbox name="confirmLiveness" label="I checked every liveness frame shows a live person doing the prompt, and the face matches the document photo." />
          <Checkbox name="confirmDocument" label="I checked the document against NADRA / the issuer's template, and saw no signs of tampering." />
        </div>
      )}
      {kind === "ROLE" && investor && (
        <TextField
          name="verifiedBudget"
          label={`Verified budget (${investor.currency})`}
          type="number"
          min={0}
          step="any"
          hint={`Declared: ${investor.currency} ${Number(investor.declaredBudget).toLocaleString("en-US")}. Set this to what the proof of funds supports; it controls which pitches this investor can see.`}
        />
      )}
      {kind === "FINAL" && <Checkbox name="confirmInterview" label="The video interview took place and the applicant's identity was confirmed live." />}
      <TextArea name="reason" label="Reason / message to applicant" rows={3} hint="Required unless approving. The applicant sees this." />
      <SubmitButton className="w-full" pendingText="Saving…">
        Record decision
      </SubmitButton>
    </Form>
  );
}

export function NoteForm({ caseId }: { caseId: string }) {
  const [state, action] = useActionState(addCaseNoteAction.bind(null, caseId), initialFormState);
  return (
    <Form state={{ ...state, message: undefined }} action={action} className="space-y-3">
      <TextArea name="body" label="Internal note" rows={2} hint="Visible to the team only." />
      <SubmitButton variant="secondary" pendingText="Adding…">
        Add note
      </SubmitButton>
    </Form>
  );
}

export function InterviewForm({ caseId, interviewAt, notes }: { caseId: string; interviewAt?: string; notes?: string }) {
  const [state, action] = useActionState(saveInterviewAction.bind(null, caseId), initialFormState);
  return (
    <Form state={state} action={action}>
      <TextField name="interviewAt" label="Interview date & time" type="datetime-local" defaultValue={interviewAt} />
      <Checkbox name="notify" label="Email the applicant the scheduled time" />
      <TextArea name="interviewNotes" label="Interview notes" rows={4} defaultValue={notes} />
      <Button type="submit" variant="secondary">
        Save interview
      </Button>
    </Form>
  );
}
