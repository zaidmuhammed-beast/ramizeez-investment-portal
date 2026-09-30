"use client";

import { useActionState } from "react";
import { initialFormState, type FormState } from "@/lib/form-state";
import { CHANNELS } from "@/lib/execution/rules";
import { SubmitButton } from "@/components/ui/button";
import { Checkbox, Form, SelectField, TextArea, TextField, type Option } from "@/components/ui/form";
import { assignManagerAction, createCampaignAction, createTaskAction, reviewReportAction, sendRemindersAction, setHealthAction, updateCampaignAction, updateTaskAction } from "@/app/admin/execution/actions";
import { submitReportAction } from "@/app/(app)/pitches/[id]/deal/actions";

type Action = (state: FormState, fd: FormData) => Promise<FormState>;

function ActionForm({ action, children, className }: { action: Action; children: React.ReactNode; className?: string }) {
  const [state, formAction] = useActionState(action, initialFormState);
  return (
    <Form state={state} action={formAction} className={className ?? "space-y-3"}>
      {children}
    </Form>
  );
}

export const TASK_STATUS_OPTIONS: Option[] = [
  { value: "TODO", label: "To do" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "BLOCKED", label: "Blocked" },
  { value: "DONE", label: "Done" },
];

export const AssignManagerForm = ({ dealId, managers, current }: { dealId: string; managers: Option[]; current?: string }) => (
  <ActionForm action={assignManagerAction.bind(null, dealId)} className="flex flex-wrap items-end gap-2">
    <div className="min-w-0 flex-1">
      <SelectField name="managerId" label="Execution manager" options={managers} defaultValue={current} required />
    </div>
    <SubmitButton variant="secondary" pendingText="…">
      Assign
    </SubmitButton>
  </ActionForm>
);

export const HealthForm = ({ dealId, current, note }: { dealId: string; current: string; note?: string }) => (
  <ActionForm action={setHealthAction.bind(null, dealId)}>
    <SelectField
      name="health"
      label="Company status"
      required
      defaultValue={current}
      options={[
        { value: "GREEN", label: "On track" },
        { value: "AMBER", label: "Needs attention" },
        { value: "RED", label: "At risk (investors are emailed)" },
      ]}
    />
    <TextArea name="healthNote" label="What's happening (shown to investors)" rows={2} defaultValue={note} />
    <SubmitButton variant="secondary" pendingText="Saving…">
      Update status
    </SubmitButton>
  </ActionForm>
);

export const TaskForm = ({ dealId, assignees, areas }: { dealId: string; assignees: Option[]; areas: Option[] }) => (
  <ActionForm action={createTaskAction.bind(null, dealId)}>
    <TextField name="title" label="Task" required />
    <TextArea name="detail" label="Details" rows={2} />
    <div className="grid gap-3 sm:grid-cols-3">
      <SelectField name="area" label="Area" options={areas} defaultValue={areas[0]?.value} required />
      <SelectField name="assigneeId" label="Team owner" options={assignees} placeholder="Unassigned" />
      <TextField name="dueDate" label="Due" type="date" />
    </div>
    <Checkbox name="forFounder" label="This is for the founder (they see it and update it)" />
    <SubmitButton variant="secondary" pendingText="Adding…">
      Add task
    </SubmitButton>
  </ActionForm>
);

export const TaskStatusForm = ({ taskId, status, founder }: { taskId: string; status: string; founder?: boolean }) => (
  <ActionForm action={updateTaskAction.bind(null, taskId)} className="flex flex-wrap items-end gap-2">
    <div className="w-40">
      <SelectField name="status" label="Status" options={TASK_STATUS_OPTIONS} defaultValue={status} required />
    </div>
    {founder && (
      <div className="min-w-0 flex-1">
        <TextField name="founderNote" label="Note to RamiZeeZ" />
      </div>
    )}
    <SubmitButton variant="secondary" className="px-3 py-2 text-xs" pendingText="…">
      Save
    </SubmitButton>
  </ActionForm>
);

export const ReportForm = ({ dealId, periods, currency }: { dealId: string; periods: Option[]; currency: string }) => (
  <ActionForm action={submitReportAction.bind(null, dealId)}>
    <SelectField name="period" label="Month" options={periods} defaultValue={periods[0]?.value} required />
    <div className="grid gap-3 sm:grid-cols-2">
      <TextField name="revenue" label={`Revenue (${currency})`} type="number" min={0} step="any" required />
      <TextField name="costs" label={`Costs (${currency})`} type="number" min={0} step="any" required />
      <TextField name="cashInBank" label={`Cash in bank (${currency})`} type="number" min={0} step="any" />
      <TextField name="customers" label="Customers" type="number" min={0} step={1} />
    </div>
    <TextField name="keyMetric" label="Key metric" placeholder="e.g. 480 active subscribers (+12%)" />
    <TextArea name="highlights" label="Highlights" rows={3} required />
    <TextArea name="challenges" label="Challenges" rows={2} required />
    <TextArea name="asks" label="How investors can help (optional)" rows={2} hint="Introductions, advice, suppliers. Contact details are removed: RamiZeeZ connects you." />
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-200" htmlFor={`report-files-${dealId}`}>
        Attachments (optional: management accounts, photos)
      </label>
      <input id={`report-files-${dealId}`} name="files" type="file" multiple accept="application/pdf,image/jpeg,image/png" className="field-control" />
    </div>
    <SubmitButton pendingText="Submitting…">Submit report</SubmitButton>
  </ActionForm>
);

export const ReviewReportForm = ({ reportId }: { reportId: string }) => (
  <div className="space-y-4">
    <ActionForm action={reviewReportAction.bind(null, reportId, true)}>
      <TextArea name="note" label="RamiZeeZ commentary for investors (optional)" rows={2} />
      <SubmitButton pendingText="Publishing…">Publish to investors</SubmitButton>
    </ActionForm>
    <ActionForm action={reviewReportAction.bind(null, reportId, false)}>
      <TextArea name="note" label="What the founder must fix" rows={2} />
      <SubmitButton variant="ghost" pendingText="…">
        Return to founder
      </SubmitButton>
    </ActionForm>
  </div>
);

export const SendRemindersForm = () => (
  <ActionForm action={sendRemindersAction}>
    <SubmitButton variant="secondary" pendingText="Sending…">
      Remind founders with overdue reports
    </SubmitButton>
  </ActionForm>
);

export const CampaignForm = ({ dealId, currency }: { dealId: string; currency: string }) => (
  <ActionForm action={createCampaignAction.bind(null, dealId)}>
    <div className="grid gap-3 sm:grid-cols-2">
      <TextField name="name" label="Campaign" required />
      <SelectField name="channel" label="Channel" options={CHANNELS.map((c) => ({ value: c, label: c }))} required />
    </div>
    <TextArea name="objective" label="Objective" rows={2} required placeholder="e.g. 300 new subscribers in Gulberg and DHA" />
    <div className="grid gap-3 sm:grid-cols-3">
      <TextField name="budget" label={`Budget (${currency})`} type="number" min={0} />
      <TextField name="startDate" label="Starts" type="date" required />
      <TextField name="endDate" label="Ends" type="date" />
    </div>
    <SubmitButton variant="secondary" pendingText="Adding…">
      Add campaign
    </SubmitButton>
  </ActionForm>
);

export const CampaignResultsForm = ({ campaign }: { campaign: { id: string; status: string; reach: number | null; leads: number | null; conversions: number | null; resultsNote: string | null } }) => (
  <ActionForm action={updateCampaignAction.bind(null, campaign.id)}>
    <div className="grid gap-3 sm:grid-cols-4">
      <SelectField
        name="status"
        label="Status"
        required
        defaultValue={campaign.status}
        options={[
          { value: "PLANNED", label: "Planned" },
          { value: "LIVE", label: "Live" },
          { value: "ENDED", label: "Ended" },
        ]}
      />
      <TextField name="reach" label="Reach" type="number" min={0} defaultValue={campaign.reach?.toString()} />
      <TextField name="leads" label="Leads" type="number" min={0} defaultValue={campaign.leads?.toString()} />
      <TextField name="conversions" label="Customers won" type="number" min={0} defaultValue={campaign.conversions?.toString()} />
    </div>
    <TextField name="resultsNote" label="What we learned" defaultValue={campaign.resultsNote ?? undefined} />
    <SubmitButton variant="secondary" className="px-3 py-2 text-xs" pendingText="…">
      Save results
    </SubmitButton>
  </ActionForm>
);
