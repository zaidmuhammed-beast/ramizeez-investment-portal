// Pakistani CNIC / NICOP number rules (13 digits, printed as XXXXX-XXXXXXX-X).

export function normalizeCnic(input: string): string | null {
  const digits = input.replace(/[\s-]/g, "");
  if (!/^\d{13}$/.test(digits)) return null;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

/** The first digit is the province/region code; 1–7 are issued, 0/8/9 are not. */
export function hasValidRegionCode(cnic: string): boolean {
  return /^[1-7]/.test(cnic);
}

/** By NADRA convention the final digit is odd for males and even for females. */
export function genderFromCnic(cnic: string): "M" | "F" {
  return Number(cnic.at(-1)) % 2 === 1 ? "M" : "F";
}
