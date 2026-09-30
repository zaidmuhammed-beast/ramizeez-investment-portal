"use client";

import { useActionState, useState } from "react";
import { initialFormState } from "@/lib/form-state";
import { DILIGENCE_ITEMS, SCORE_CRITERIA, type Diligence } from "@/lib/pitch/workflow";
import { Button, SubmitButton } from "@/components/ui/button";
import { Checkbox, Form, SelectField, TextArea, type Option } from "@/components/ui/form";
import { saveDiligenceAction, saveScorecardAction, saveTeaserAction, teamDecideAccessAction, transitionPitchAction } from "../actions";

const SCORE_OPTIONS: Option[] = [
  { value: "1", label: "1: Weak" },
  { value: "2", label: "2" },
  { value: "3", label: "3: Adequate" },
  { value: "4", label: "4" },
  { value: "5", label: "5: Excellent" },
];

export function ScorecardForm({ pitchId }: { pitchId: string }) {
  const [state, action] = useActionState(saveScorecardAction.bind(null, pitchId), initialFormState);
  return (
    <Form state={state} action={action} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {SCORE_CRITERIA.map(([key, label]) => (
          <SelectField key={key} name={key} label={label} options={SCORE_OPTIONS} required />
        ))}
      </div>
      <TextArea name="notes" label="Assessment" rows={3} required />
      <SubmitButton variant="secondary" pendingText="Saving…">
        Save scorecard
      </SubmitButton>
    </Form>
  );
}

export function DiligenceForm({ pitchId, current }: { pitchId: string; current?: Diligence }) {
  const [state, action] = useActionState(saveDiligenceAction.bind(null, pitchId), initialFormState);
  return (
    <Form state={state} action={action} className="space-y-3">
      {DILIGENCE_ITEMS.map(([key, label]) => (
        <Checkbox key={key} name={key} label={label} defaultChecked={current?.[key]} />
      ))}
      <TextArea name="notes" label="Findings" rows={3} />
      <SubmitButton variant="secondary" pendingText="Saving…">
        Save checklist
      </SubmitButton>
    </Form>
  );
}

export function TeaserForm({ pitchId, teaser }: { pitchId: string; teaser: string }) {
  const [state, action] = useActionState(saveTeaserAction.bind(null, pitchId), initialFormState);
  return (
    <Form state={state} action={action} className="space-y-3">
      <TextArea
        name="teaser"
        label="Anonymous investor teaser"
        rows={4}
        defaultValue={teaser}
        hint="What matched investors see first. Include the sector, city, stage and headline numbers. Leave out the business name, the founder's name and anything that gives away the idea's secret sauce."
      />
      <SubmitButton variant="secondary" pendingText="Saving…">
        Save teaser
      </SubmitButton>
    </Form>
  );
}

export function TransitionForm({ pitchId, options }: { pitchId: string; options: Option[] }) {
  const [state, action] = useActionState(transitionPitchAction.bind(null, pitchId), initialFormState);
  return (
    <Form state={state} action={action} className="space-y-3">
      <SelectField name="to" label="Next step" options={options} required />
      <TextArea name="note" label="Note / feedback to founder" rows={3} hint="Required when returning or rejecting. The founder sees it." />
      <SubmitButton className="w-full" pendingText="Saving…">
        Confirm
      </SubmitButton>
    </Form>
  );
}

export function TeamAccessButtons({ requestId }: { requestId: string }) {
  const [pending, setPending] = useState(false);
  const decide = async (approve: boolean) => {
    setPending(true);
    try {
      await teamDecideAccessAction(requestId, approve);
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="flex gap-2">
      <Button type="button" className="px-3 py-1.5 text-xs" disabled={pending} onClick={() => decide(true)}>
        Approve access
      </Button>
      <Button type="button" variant="ghost" className="px-3 py-1.5 text-xs" disabled={pending} onClick={() => decide(false)}>
        Decline
      </Button>
    </div>
  );
}
