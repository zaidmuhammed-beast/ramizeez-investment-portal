// ICAO 9303 TD3 (passport) machine-readable zone parsing and check-digit validation.

const WEIGHTS = [7, 3, 1];

function charValue(ch: string): number {
  if (ch === "<") return 0;
  if (ch >= "0" && ch <= "9") return ch.charCodeAt(0) - 48;
  if (ch >= "A" && ch <= "Z") return ch.charCodeAt(0) - 55;
  throw new Error(`Invalid MRZ character: ${ch}`);
}

export function checkDigit(field: string): number {
  let sum = 0;
  for (let i = 0; i < field.length; i++) sum += charValue(field[i]) * WEIGHTS[i % 3];
  return sum % 10;
}

export type Td3 = {
  documentType: string;
  issuingCountry: string;
  surname: string;
  givenNames: string;
  documentNumber: string;
  nationality: string;
  dateOfBirth: string; // YYMMDD
  sex: string;
  expiryDate: string; // YYMMDD
  checks: { documentNumber: boolean; dateOfBirth: boolean; expiryDate: boolean; composite: boolean };
};

export function parseTd3(input: string): Td3 | null {
  const lines = input
    .toUpperCase()
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/\s/g, ""))
    .filter(Boolean);
  if (lines.length !== 2 || lines[0].length !== 44 || lines[1].length !== 44) return null;
  const [l1, l2] = lines;
  if (!/^[A-Z0-9<]+$/.test(l1 + l2) || l1[0] !== "P") return null;

  const [surname, given = ""] = l1.slice(5).split("<<");
  const digit = (s: string, at: number) => (l2[at] === "<" ? 0 : Number(l2[at])) === checkDigit(s);
  const composite = l2.slice(0, 10) + l2.slice(13, 20) + l2.slice(21, 43);

  return {
    documentType: l1.slice(0, 2).replace(/</g, ""),
    issuingCountry: l1.slice(2, 5).replace(/</g, ""),
    surname: surname.replace(/</g, " ").trim(),
    givenNames: given.replace(/</g, " ").trim(),
    documentNumber: l2.slice(0, 9).replace(/</g, ""),
    nationality: l2.slice(10, 13).replace(/</g, ""),
    dateOfBirth: l2.slice(13, 19),
    sex: l2[20],
    expiryDate: l2.slice(21, 27),
    checks: {
      documentNumber: digit(l2.slice(0, 9), 9),
      dateOfBirth: digit(l2.slice(13, 19), 19),
      expiryDate: digit(l2.slice(21, 27), 27),
      composite: digit(composite, 43),
    },
  };
}

/** Converts an MRZ YYMMDD date to ISO. Birth dates in the future roll back a century. */
export function mrzDateToIso(yymmdd: string, kind: "birth" | "expiry"): string | null {
  if (!/^\d{6}$/.test(yymmdd)) return null;
  const yy = Number(yymmdd.slice(0, 2));
  const nowYY = new Date().getUTCFullYear() % 100;
  const century = kind === "birth" ? (yy > nowYY ? 1900 : 2000) : yy >= 70 ? 1900 : 2000;
  return `${century + yy}-${yymmdd.slice(2, 4)}-${yymmdd.slice(4, 6)}`;
}
