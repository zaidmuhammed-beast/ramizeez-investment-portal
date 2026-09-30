"use client";

import { useActionState, useState } from "react";
import { initialFormState, type FormState } from "@/lib/form-state";
import { TERM_FIELDS, type DealType, type OfferTerms } from "@/lib/deals/offers";
import { Button, SubmitButton } from "@/components/ui/button";
import { Checkbox, Form, SelectField, TextArea, TextField, type Option } from "@/components/ui/form";
import { askQuestionAction, makeOfferAction, respondOfferAction, signDocumentAction } from "@/app/(app)/investments/actions";
import { answerQuestionAction, submitClaimAction } from "@/app/(app)/pitches/[id]/deal/actions";
import { closeRoundAction, decideEntryAction, issueAgreementAction, moderateQuestionAction, recordEntryAction, reviewClaimAction } from "@/app/admin/deals/actions";

type Action = (state: FormState, fd: FormData) => Promise<FormState>;

function TermFields({ dealType, defaults }: { dealType: DealType; defaults?: OfferTerms }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {TERM_FIELDS[dealType].map((f) => (
        <TextField key={f.key} name={f.key} label={f.label} type="number" step="any" min={f.min} max={f.max} required defaultValue={defaults?.[f.key]?.toString()} />
      ))}
    </div>
  );
}

export function MakeOfferForm({ pitchId, dealType, currency, min, max, suggested }: { pitchId: string; dealType: DealType; currency: string; min: number; max: number; suggested: OfferTerms }) {
  const [state, action] = useActionState(makeOfferAction.bind(null, pitchId), initialFormState);
  return (
    <Form state={state} action={action}>
      <TextField name="amount" label={`Amount (${currency})`} type="number" min={min} max={max} step="any" required hint={`Between ${currency} ${min.toLocaleString("en-US")} and ${currency} ${max.toLocaleString("en-US")}`} />
      <TermFields dealType={dealType} defaults={suggested} />
      <TextArea name="conditions" label="Conditions (optional)" rows={2} hint="For example: board observer seat, monthly reporting. Contact details are removed." />
      <SubmitButton className="w-full" pendingText="Sending…">
        Send offer
      </SubmitButton>
      <p className="text-xs text-slate-500">The founder can accept, decline or counter. Nothing is binding until the agreement is signed by everyone.</p>
    </Form>
  );
}

/** Accept / decline / counter (and withdraw, for investors) on the party's turn. */
export function RespondOfferForm({ offerId, as, dealType, current, canWithdraw }: { offerId: string; as: "INVESTOR" | "FOUNDER"; dealType: DealType; current: { amount: number; terms: OfferTerms }; canWithdraw?: boolean }) {
  const [state, action] = useActionState(respondOfferAction.bind(null, offerId, as), initialFormState);
  const [countering, setCountering] = useState(false);
  return (
    <Form state={state} action={action}>
      {countering ? (
        <>
          <TextField name="amount" label="Amount" type="number" step="any" required defaultValue={String(current.amount)} />
          <TermFields dealType={dealType} defaults={current.terms} />
          <TextArea name="conditions" label="Conditions" rows={2} />
          <TextArea name="note" label="Message" rows={2} />
          <div className="flex gap-2">
            <SubmitButton name="intent" value="COUNTER" pendingText="Sending…">
              Send counter-offer
            </SubmitButton>
            <Button type="button" variant="ghost" onClick={() => setCountering(false)}>
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <>
          <TextArea name="note" label="Message (optional)" rows={2} />
          <div className="flex flex-wrap gap-2">
            <SubmitButton name="intent" value="ACCEPT" pendingText="…">
              Accept
            </SubmitButton>
            <Button type="button" variant="secondary" onClick={() => setCountering(true)}>
              Counter
            </Button>
            <SubmitButton name="intent" value="DECLINE" variant="ghost" pendingText="…">
              Decline
            </SubmitButton>
          </div>
        </>
      )}
      {canWithdraw && !countering && (
        <SubmitButton name="intent" value="WITHDRAW" variant="ghost" className="px-0 text-xs text-rose-300" pendingText="…">
          Withdraw my offer
        </SubmitButton>
      )}
    </Form>
  );
}

export function WithdrawOfferForm({ offerId }: { offerId: string }) {
  const [state, action] = useActionState(respondOfferAction.bind(null, offerId, "INVESTOR"), initialFormState);
  return (
    <Form state={state} action={action}>
      <SubmitButton name="intent" value="WITHDRAW" variant="ghost" className="px-0 text-xs text-rose-300" pendingText="…">
        Withdraw my offer
      </SubmitButton>
    </Form>
  );
}

export function SignForm({ documentId, party, legalName }: { documentId: string; party: "INVESTOR" | "FOUNDER" | "RAMIZEEZ"; legalName: string }) {
  const [state, action] = useActionState(signDocumentAction.bind(null, documentId, party), initialFormState);
  const label = party === "RAMIZEEZ" ? "Sign for RamiZeeZ" : "Sign";
  return (
    <Form state={state} action={action} className="space-y-3">
      <TextField name="typedName" label="Type your full legal name" required autoComplete="off" placeholder={legalName} />
      <Checkbox name="agree" label="I have read this document and agree to sign it electronically. My signature is legally binding." />
      <SubmitButton pendingText="Signing…">{label}</SubmitButton>
    </Form>
  );
}

function SimpleForm({ action, children, className }: { action: Action; children: React.ReactNode; className?: string }) {
  const [state, formAction] = useActionState(action, initialFormState);
  return (
    <Form state={state} action={formAction} className={className ?? "space-y-3"}>
      {children}
    </Form>
  );
}

export const AskQuestionForm = ({ pitchId }: { pitchId: string }) => (
  <SimpleForm action={askQuestionAction.bind(null, pitchId)}>
    <TextArea name="body" label="Ask the founder a question" rows={3} hint="RamiZeeZ reviews every question. Contact details are removed." />
    <SubmitButton variant="secondary" pendingText="Sending…">
      Send question
    </SubmitButton>
  </SimpleForm>
);

export const AnswerQuestionForm = ({ questionId }: { questionId: string }) => (
  <SimpleForm action={answerQuestionAction.bind(null, questionId)}>
    <TextArea name="answer" label="Your answer" rows={3} />
    <Checkbox name="shared" label="Show this answer to every investor with data-room access" />
    <SubmitButton variant="secondary" pendingText="Sending…">
      Send answer
    </SubmitButton>
  </SimpleForm>
);

export const ModerateQuestionForm = ({ questionId }: { questionId: string }) => (
  <div className="flex flex-wrap items-end gap-2">
    <SimpleForm action={moderateQuestionAction.bind(null, questionId, true)} className="">
      <SubmitButton className="px-3 py-1.5 text-xs" pendingText="…">
        Approve
      </SubmitButton>
    </SimpleForm>
    <SimpleForm action={moderateQuestionAction.bind(null, questionId, false)} className="flex items-end gap-2">
      <input name="note" placeholder="Reason (sent to the investor)" className="field-control py-1.5 text-xs" />
      <SubmitButton variant="ghost" className="px-3 py-1.5 text-xs" pendingText="…">
        Reject
      </SubmitButton>
    </SimpleForm>
  </div>
);

export const ClaimForm = ({ pitchId, milestoneId }: { pitchId: string; milestoneId: string }) => (
  <SimpleForm action={submitClaimAction.bind(null, pitchId, milestoneId)}>
    <TextArea name="evidence" label="What was achieved?" rows={3} hint="Be specific, and match the milestone's success metric." />
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-200" htmlFor={`files-${milestoneId}`}>
        Evidence files (optional)
      </label>
      <input id={`files-${milestoneId}`} name="files" type="file" multiple accept="application/pdf,image/jpeg,image/png" className="field-control" />
    </div>
    <SubmitButton variant="secondary" pendingText="Submitting…">
      Submit evidence
    </SubmitButton>
  </SimpleForm>
);

export const ReviewClaimForm = ({ claimId }: { claimId: string }) => (
  <div className="space-y-2">
    <SimpleForm action={reviewClaimAction.bind(null, claimId, true)} className="">
      <SubmitButton className="px-3 py-1.5 text-xs" pendingText="…">
        Approve milestone
      </SubmitButton>
    </SimpleForm>
    <SimpleForm action={reviewClaimAction.bind(null, claimId, false)} className="flex items-end gap-2">
      <input name="note" placeholder="What's missing (sent to the founder)" className="field-control py-1.5 text-xs" />
      <SubmitButton variant="ghost" className="px-3 py-1.5 text-xs" pendingText="…">
        Send back
      </SubmitButton>
    </SimpleForm>
  </div>
);

export const IssueAgreementForm = ({ offerId, draft }: { offerId: string; draft: string }) => (
  <SimpleForm action={issueAgreementAction.bind(null, offerId)}>
    <TextArea name="body" label="Agreement text" rows={14} defaultValue={draft} hint="Generated from the template. Edit if needed before issuing. Once issued, the text is locked and fingerprinted." className="[&_textarea]:font-mono [&_textarea]:text-xs" />
    <SubmitButton pendingText="Issuing…">Issue agreement for signature</SubmitButton>
  </SimpleForm>
);

export function RecordEntryForm({ pitchId, offers, milestones }: { pitchId: string; offers: Option[]; milestones: Option[] }) {
  const [type, setType] = useState("DEPOSIT");
  return (
    <SimpleForm action={recordEntryAction.bind(null, pitchId)}>
      <div className="space-y-3">
        <SelectField
          name="type"
          label="Entry"
          required
          defaultValue="DEPOSIT"
          onChange={(e) => setType(e.target.value)}
          options={[
            { value: "DEPOSIT", label: "Deposit received from an investor" },
            { value: "RELEASE", label: "Release to the business (milestone)" },
            { value: "REFUND", label: "Refund to an investor" },
          ]}
        />
        <TextField name="amount" label="Amount" type="number" step="any" min={0} required />
      </div>
      {(type === "DEPOSIT" || type === "REFUND") && <SelectField name="offerId" label="Investor commitment" options={offers} required />}
      {type === "RELEASE" && <SelectField name="milestoneId" label="Milestone" options={milestones} required />}
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField name="reference" label="Bank reference" />
        <TextField name="note" label="Note" />
      </div>
      <SubmitButton variant="secondary" pendingText="Recording…">
        Record entry
      </SubmitButton>
    </SimpleForm>
  );
}

export const DecideEntryButtons = ({ entryId }: { entryId: string }) => (
  <div className="flex gap-1.5">
    <SimpleForm action={decideEntryAction.bind(null, entryId, true)} className="">
      <SubmitButton className="px-2.5 py-1 text-xs" pendingText="…">
        Approve
      </SubmitButton>
    </SimpleForm>
    <SimpleForm action={decideEntryAction.bind(null, entryId, false)} className="">
      <SubmitButton variant="ghost" className="px-2.5 py-1 text-xs" pendingText="…">
        Reject
      </SubmitButton>
    </SimpleForm>
  </div>
);

export const CloseRoundForm = ({ pitchId }: { pitchId: string }) => (
  <SimpleForm action={closeRoundAction.bind(null, pitchId)}>
    <SubmitButton variant="secondary" pendingText="Closing…">
      Close round at committed amount
    </SubmitButton>
  </SimpleForm>
);
