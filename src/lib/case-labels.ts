import type { CaseKind } from "@prisma/client";

export const KIND_LABEL: Record<CaseKind, string> = { IDENTITY: "T1 Identity", ROLE: "T3 Role", FINAL: "T4 Final" };
