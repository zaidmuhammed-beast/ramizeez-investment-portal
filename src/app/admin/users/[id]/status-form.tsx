"use client";

import { useActionState } from "react";
import { initialFormState } from "@/lib/form-state";
import { SubmitButton } from "@/components/ui/button";
import { Form, TextArea } from "@/components/ui/form";
import { setUserStatusAction } from "../../actions";

export function UserStatusForm({ userId, status, reason }: { userId: string; status: string; reason: string | null }) {
  const [state, action] = useActionState(setUserStatusAction.bind(null, userId), initialFormState);
  return (
    <Form state={state} action={action} className="space-y-3">
      {status === "ACTIVE" ? (
        <>
          <input type="hidden" name="status" value="SUSPENDED" />
          <TextArea name="reason" label="Reason for suspension" rows={2} hint="The user sees this reason." />
          <SubmitButton variant="danger" pendingText="Suspending…">
            Suspend account
          </SubmitButton>
        </>
      ) : (
        <>
          <p className="text-sm text-slate-300">Suspended: {reason}</p>
          <input type="hidden" name="status" value="ACTIVE" />
          <SubmitButton variant="secondary">Reactivate account</SubmitButton>
        </>
      )}
    </Form>
  );
}
