"use client";

import { startTransition, useActionState, useRef, useState, type FormEvent } from "react";
import { MAX_SUBMISSION_BYTES, megabytes, shrinkImage, totalFileBytes } from "@/lib/client/shrink-image";
import { initialFormState } from "@/lib/form-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Form, SelectField, TextArea, TextField, type Option } from "@/components/ui/form";
import { CameraCapture, type Capture } from "@/components/camera-capture";
import { LivenessCapture, type LivenessResult } from "@/components/liveness-capture";
import { cn } from "@/components/ui/cn";
import { startLivenessAction, submitIdentityAction } from "./actions";

const STEPS = ["Document details", "Document photos", "Liveness check", "Address", "Review"] as const;

const FIELD_STEP: Record<string, number> = {
  docType: 0, issuingCountry: 0, docNumber: 0, fullNameOnDoc: 0, dateOfBirth: 0, gender: 0, issueDate: 0, expiryDate: 0, mrz: 0,
  front: 1, back: 1,
  liveness: 2, livenessPrompts: 2, livenessToken: 2,
  addressLine1: 3, addressLine2: 3, city: 3, region: 3, postalCode: 3, addressCountry: 3, proofOfAddress: 3,
};

const DOC_TYPES: Option[] = [
  { value: "CNIC", label: "CNIC: Pakistani national identity card" },
  { value: "NICOP", label: "NICOP: card for overseas Pakistanis" },
  { value: "PASSPORT", label: "Passport (any country)" },
  { value: "NATIONAL_ID", label: "Other national ID card" },
];

export function IdentityWizard({
  countries,
  defaultCountry,
  allowUpload,
  accountName,
}: {
  countries: Option[];
  defaultCountry: string;
  allowUpload: boolean;
  accountName: string;
}) {
  const [state, formAction, pending] = useActionState(submitIdentityAction, initialFormState);
  const [step, setStep] = useState(0);
  const [docType, setDocType] = useState<string>("");
  const [front, setFront] = useState<Capture>();
  const [back, setBack] = useState<Capture>();
  const [liveness, setLiveness] = useState<LivenessResult>();
  const [proofName, setProofName] = useState<string>();
  const [localError, setLocalError] = useState<string>();
  const formRef = useRef<HTMLFormElement>(null);

  const errorSteps = new Set(Object.keys(state.errors ?? {}).map((k) => FIELD_STEP[k]).filter((s) => s !== undefined));
  const isPassport = docType === "PASSPORT";

  function canLeave(s: number): string | undefined {
    const form = formRef.current!;
    const val = (n: string) => (form.elements.namedItem(n) as HTMLInputElement | null)?.value?.trim();
    if (s === 0) {
      const missing = ["docType", "issuingCountry", "docNumber", "fullNameOnDoc", "dateOfBirth", "expiryDate"].filter((n) => !val(n));
      if (isPassport && !val("mrz")) missing.push("mrz");
      if (missing.length) return "Fill in all required document details.";
    }
    if (s === 1 && (!front || (!isPassport && !back))) return isPassport ? "Capture your passport photo page." : "Capture both sides of your card.";
    if (s === 2 && !liveness) return "Complete the liveness check.";
    if (s === 3 && (!val("addressLine1") || !val("city") || !val("addressCountry") || !proofName)) return "Enter your address and upload a proof of address.";
  }

  function go(to: number) {
    if (to > step) {
      const err = canLeave(step);
      if (err) return setLocalError(err);
    }
    setLocalError(undefined);
    setStep(to);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const proof = fd.get("proofOfAddress");
    if (proof instanceof File && proof.size > 0) {
      const small = await shrinkImage(proof);
      if (small !== proof) fd.set("proofOfAddress", new File([small], "proof-of-address.jpg", { type: small.type }));
    }
    if (front) fd.set("front", new File([front.blob], "front.jpg", { type: front.blob.type }));
    fd.set("front_live", front?.live ? "1" : "0");
    if (back && !isPassport) {
      fd.set("back", new File([back.blob], "back.jpg", { type: back.blob.type }));
      fd.set("back_live", back.live ? "1" : "0");
    }
    if (liveness) {
      fd.set("livenessPrompts", JSON.stringify(liveness.challenge.prompts));
      fd.set("livenessIssuedAt", String(liveness.challenge.issuedAt));
      fd.set("livenessToken", liveness.challenge.token);
      liveness.frames.forEach((f, i) => {
        fd.set(`selfie_${i}`, new File([f.blob], `selfie_${i}.jpg`, { type: f.blob.type }));
        fd.set(`selfie_${i}_live`, f.live ? "1" : "0");
      });
    }
    const total = totalFileBytes(fd);
    if (total > MAX_SUBMISSION_BYTES) {
      setLocalError(`Your photos and documents add up to ${megabytes(total)}, more than we can accept at once (${megabytes(MAX_SUBMISSION_BYTES)}). Use a smaller proof-of-address file, for example a photo instead of a scanned PDF.`);
      return;
    }
    startTransition(() => formAction(fd));
  }

  return (
    <div className="grid gap-6 [&>*]:min-w-0 lg:grid-cols-[240px_1fr]">
      <ol className="glass h-fit space-y-1 rounded-2xl p-3" aria-label="Steps">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => (i < step ? go(i) : undefined)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition",
                i === step ? "bg-white/10 text-white" : i < step ? "text-slate-300 hover:bg-white/5" : "cursor-default text-slate-500",
              )}
              aria-current={i === step ? "step" : undefined}
            >
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full text-xs",
                  errorSteps.has(i) ? "bg-rose-400/80 text-white" : i < step ? "bg-brand-400 text-ink-950" : "bg-white/10",
                )}
              >
                {i < step && !errorSteps.has(i) ? "✓" : i + 1}
              </span>
              {label}
            </button>
          </li>
        ))}
      </ol>

      <Card strong>
        <Form state={state} ref={formRef} onSubmit={onSubmit}>
          {localError && <Alert tone="warn">{localError}</Alert>}

          {/* Step 1: document details */}
          <div className={cn("space-y-5", step !== 0 && "hidden")}>
            <SelectField name="docType" label="Document type" options={DOC_TYPES} required onChange={(e) => setDocType(e.target.value)} />
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                name="issuingCountry"
                label="Issuing country"
                options={countries}
                required
                defaultValue={docType === "CNIC" || docType === "NICOP" ? "PK" : defaultCountry}
                key={docType === "CNIC" || docType === "NICOP" ? "pk" : "any"}
              />
              <TextField
                name="docNumber"
                label="Document number"
                required
                placeholder={docType === "CNIC" || docType === "NICOP" ? "35202-1234567-1" : ""}
                autoComplete="off"
              />
            </div>
            <TextField name="fullNameOnDoc" label="Full name as printed on the document" required defaultValue={accountName} />
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField name="dateOfBirth" label="Date of birth" type="date" required />
              <SelectField
                name="gender"
                label="Gender on document"
                options={[
                  { value: "M", label: "Male" },
                  { value: "F", label: "Female" },
                  { value: "X", label: "Other / not stated" },
                ]}
              />
              <TextField name="issueDate" label="Issue date" type="date" />
            </div>
            <TextField name="expiryDate" label="Expiry date" type="date" required />
            {isPassport && (
              <TextArea
                name="mrz"
                label="Machine-readable zone (MRZ)"
                rows={2}
                required
                hint="The 2 lines of 44 characters at the bottom of your photo page, including the < symbols. One line per row."
                className="[&_textarea]:font-mono [&_textarea]:text-xs sm:[&_textarea]:text-sm"
                placeholder={"P<PAKKHAN<<AHMED<ALI<<<<<<<<<<<<<<<<<<<<<<<<\nAB12345674PAK9001015M3001012<<<<<<<<<<<<<<04"}
              />
            )}
          </div>

          {/* Step 2: document photos */}
          <div className={cn("space-y-6", step !== 1 && "hidden")}>
            <Alert tone="info">
              Place the document on a dark, flat surface in good light. All 4 corners must be visible, with no glare over the text or photo.
            </Alert>
            <CameraCapture
              facing="environment"
              label={isPassport ? "Passport photo page" : "Front of card"}
              value={front}
              onChange={setFront}
              allowUpload={allowUpload}
            />
            {state.errors?.front && <p className="text-xs text-rose-300">{state.errors.front}</p>}
            {!isPassport && (
              <>
                <CameraCapture facing="environment" label="Back of card" value={back} onChange={setBack} allowUpload={allowUpload} />
                {state.errors?.back && <p className="text-xs text-rose-300">{state.errors.back}</p>}
              </>
            )}
          </div>

          {/* Step 3: liveness */}
          <div className={cn("space-y-4", step !== 2 && "hidden")}>
            <p className="text-sm text-slate-300">
              Remove glasses, hats and masks. Hold your phone at eye level and follow each prompt. The prompts are random every time.
            </p>
            <LivenessCapture start={startLivenessAction} value={liveness} onChange={setLiveness} allowUpload={allowUpload} />
            {state.errors?.liveness && <p className="text-xs text-rose-300">{state.errors.liveness}</p>}
          </div>

          {/* Step 4: address */}
          <div className={cn("space-y-5", step !== 3 && "hidden")}>
            <TextField name="addressLine1" label="Address line 1" required autoComplete="address-line1" />
            <TextField name="addressLine2" label="Address line 2" autoComplete="address-line2" />
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField name="city" label="City" required autoComplete="address-level2" />
              <TextField name="region" label="Province / state" autoComplete="address-level1" />
              <TextField name="postalCode" label="Postal code" autoComplete="postal-code" />
            </div>
            <SelectField name="addressCountry" label="Country" options={countries} required defaultValue={defaultCountry} />
            <div className="space-y-1.5">
              <label htmlFor="proofOfAddress" className="block text-sm font-medium text-slate-200">
                Proof of address<span aria-hidden className="ml-0.5 text-brand-300">*</span>
              </label>
              <input
                id="proofOfAddress"
                name="proofOfAddress"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => setProofName(e.target.files?.[0]?.name)}
                className="field-control file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-sm file:text-white"
              />
              <p className="text-xs text-slate-400">
                A utility bill, bank statement or government letter from the last 3 months that shows your name and this address. PDF or photo (photos are resized automatically).
              </p>
              {state.errors?.proofOfAddress && <p className="text-xs text-rose-300">{state.errors.proofOfAddress}</p>}
            </div>
          </div>

          {/* Step 5: review */}
          <div className={cn("space-y-4", step !== 4 && "hidden")}>
            <h3 className="font-medium text-white">Ready to submit</h3>
            <ul className="space-y-2 text-sm text-slate-300">
              <li>✓ Document details entered</li>
              <li>✓ {isPassport ? "Passport photo page" : "Both sides of card"} captured{front && !front.live ? " (uploaded)" : ""}</li>
              <li>✓ Liveness check: {liveness?.frames.length ?? 0} frames</li>
              <li>✓ Address & proof ({proofName})</li>
            </ul>
            <p className="text-xs text-slate-400">
              By submitting you confirm the documents are yours and genuine. Submitting forged documents is a criminal offence and results in a permanent ban.
            </p>
          </div>

          <div className="flex items-center justify-between border-t border-white/10 pt-5">
            <Button type="button" variant="ghost" onClick={() => go(step - 1)} disabled={step === 0}>
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              // Distinct keys stop React reusing this node as the submit button mid-click,
              // which would submit the form straight from the address step.
              <Button key="next" type="button" onClick={() => go(step + 1)}>
                Continue
              </Button>
            ) : (
              <Button key="submit" type="submit" disabled={pending} aria-busy={pending}>
                {pending ? "Running checks…" : "Submit for verification"}
              </Button>
            )}
          </div>
        </Form>
      </Card>
    </div>
  );
}
