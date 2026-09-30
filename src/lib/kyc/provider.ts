import "server-only";
import type { IdDocumentType } from "@prisma/client";
import { env } from "../env";
import type { CheckResult } from "./types";
import { internalProvider } from "./internal-provider";

export type IdentitySubmission = {
  userId: string;
  accountName: string; // first + last name given at sign-up
  document: {
    type: IdDocumentType;
    number: string; // normalised
    numberIndex: string;
    issuingCountry: string;
    fullNameOnDoc: string;
    dateOfBirth: Date;
    gender?: string;
    expiryDate: Date;
    mrz?: string;
  };
  images: { role: "front" | "back" | "selfie"; sha256: string; liveCapture: boolean; fileId: string }[];
  // issuedAt is signed by the server, submittedAt is measured by the server.
  liveness: { prompts: string[]; issuedAt: number; submittedAt: number };
  aml: { result: "CLEAR" | "POTENTIAL_MATCH"; hits: unknown };
};

/**
 * A KYC provider runs the automated checks on an identity submission. The built-in
 * provider is used for testing; a Sumsub adapter implementing the same interface will
 * replace it for production (see docs/02-signup-and-verification.md).
 */
export interface KycProvider {
  name: string;
  checkIdentity(input: IdentitySubmission): Promise<CheckResult[]>;
}

export function getKycProvider(): KycProvider {
  switch (env().KYC_PROVIDER) {
    case "internal":
      return internalProvider;
  }
}
