"use client";

import { useActionState } from "react";
import { useTimezoneOffset } from "@/components/local-time";
import { initialFormState, type FormState } from "@/lib/form-state";
import { SubmitButton } from "@/components/ui/button";
import { Checkbox, CheckboxGroup, Form, TextArea, TextField, type Option } from "@/components/ui/form";
import { cancelSeatAction, interestAction, requestSeatAction, respondInviteAction } from "@/app/(app)/sessions/actions";
import { cancelSessionAction, completeSessionAction, decideSeatAction, scheduleSessionAction, updateSessionAction } from "@/app/admin/tank/actions";

type Action = (state: FormState, fd: FormData) => Promise<FormState>;

function ActionForm({ action, children, className }: { action: Action; children: React.ReactNode; className?: string }) {
  const [state, formAction] = useActionState(action, initialFormState);
  return (
    <Form state={state} action={formAction} className={className ?? "space-y-3"}>
      {children}
    </Form>
  );
}

export function ScheduleSessionForm({ pitches, provider }: { pitches: Option[]; provider: string }) {
  const offset = useTimezoneOffset();
  return (
    <ActionForm action={scheduleSessionAction}>
      <TextField name="title" label="Title" required placeholder="e.g. Food & agri Tank: October" />
      <TextArea name="description" label="Description (public)" rows={2} hint="Shown on the public events page. Don't name the businesses." />
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField name="startsAt" label="Starts (your local time)" type="datetime-local" required />
        <TextField name="durationMin" label="Length (minutes)" type="number" min={15} max={240} defaultValue="90" required />
        <TextField name="capacity" label="Investor seats" type="number" min={1} max={500} defaultValue="20" required />
      </div>
      <input type="hidden" name="tzOffset" value={offset} />
      <CheckboxGroup name="pitchIds" label="Pitches (listed, round open)" options={pitches} columns={1} required />
      {provider === "link" && <TextField name="meetingUrl" label="Meeting link (Zoom, Meet, Teams…)" type="url" placeholder="https://" hint="You can add it later. It's stored encrypted and only revealed through each attendee's audited join button." />}
      <SubmitButton pendingText="Scheduling…">Schedule session</SubmitButton>
    </ActionForm>
  );
}

export function UpdateSessionForm({ sessionId, field, label, hint, current }: { sessionId: string; field: "meetingUrl" | "recordingUrl" | "capacity"; label: string; hint?: string; current?: string }) {
  return (
    <ActionForm action={updateSessionAction.bind(null, sessionId)} className="flex flex-wrap items-end gap-2">
      <div className="min-w-0 flex-1">
        <TextField name={field} label={label} hint={hint} type={field === "capacity" ? "number" : "url"} defaultValue={current} placeholder={field === "capacity" ? undefined : "https://"} />
      </div>
      <SubmitButton variant="secondary" pendingText="Saving…">
        Save
      </SubmitButton>
    </ActionForm>
  );
}

export const SeatDecision = ({ seatId }: { seatId: string }) => (
  <div className="flex gap-1.5">
    <ActionForm action={decideSeatAction.bind(null, seatId, true)} className="">
      <SubmitButton className="px-2.5 py-1 text-xs" pendingText="…">
        Approve seat
      </SubmitButton>
    </ActionForm>
    <ActionForm action={decideSeatAction.bind(null, seatId, false)} className="">
      <SubmitButton variant="ghost" className="px-2.5 py-1 text-xs" pendingText="…">
        Decline
      </SubmitButton>
    </ActionForm>
  </div>
);

export const CompleteSessionForm = ({ sessionId }: { sessionId: string }) => (
  <ActionForm action={completeSessionAction.bind(null, sessionId)}>
    <SubmitButton pendingText="Completing…">Mark session complete</SubmitButton>
  </ActionForm>
);

export const CancelSessionForm = ({ sessionId }: { sessionId: string }) => (
  <ActionForm action={cancelSessionAction.bind(null, sessionId)}>
    <SubmitButton variant="ghost" className="text-rose-300" pendingText="Cancelling…">
      Cancel session
    </SubmitButton>
  </ActionForm>
);

export function SeatRequestForm({ sessionId, legalName }: { sessionId: string; legalName: string }) {
  return (
    <ActionForm action={requestSeatAction.bind(null, sessionId)}>
      <TextField name="typedName" label="Type your full legal name to sign" required autoComplete="off" placeholder={legalName} />
      <Checkbox name="agree" label="I have read and agree to the session confidentiality agreement above." />
      <SubmitButton className="w-full" pendingText="Requesting…">
        Sign & request a seat
      </SubmitButton>
    </ActionForm>
  );
}

export const CancelSeatForm = ({ sessionId }: { sessionId: string }) => (
  <ActionForm action={cancelSeatAction.bind(null, sessionId)}>
    <SubmitButton variant="ghost" className="px-0 text-xs text-rose-300" pendingText="…">
      Give up my seat
    </SubmitButton>
  </ActionForm>
);

export const InterestForm = ({ sessionId, pitchId, currency, min, max, current }: { sessionId: string; pitchId: string; currency: string; min: number; max: number; current?: number }) => (
  <ActionForm action={interestAction.bind(null, sessionId, pitchId)} className="space-y-2">
    <TextField name="amount" label={`I'm in for (${currency})`} type="number" min={min} max={max} step="any" required defaultValue={current?.toString()} hint={`Between ${currency} ${min.toLocaleString("en-US")} and ${currency} ${max.toLocaleString("en-US")}. Not binding: your offer follows through the deal room.`} />
    <TextField name="note" label="Note to the founder (optional)" />
    <SubmitButton pendingText="…">{current ? "Update" : "I'm in"}</SubmitButton>
  </ActionForm>
);

export function InviteResponseForm({ tankPitchId }: { tankPitchId: string }) {
  return (
    <div className="space-y-3">
      <ActionForm action={respondInviteAction.bind(null, tankPitchId, true)}>
        <Checkbox name="grantAccess" defaultChecked label="Open my full data room to the investors who attend (they signed the session NDA)" />
        <SubmitButton pendingText="…">Confirm I&apos;ll pitch</SubmitButton>
      </ActionForm>
      <ActionForm action={respondInviteAction.bind(null, tankPitchId, false)}>
        <SubmitButton variant="ghost" className="px-0 text-xs" pendingText="…">
          Decline this session
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
