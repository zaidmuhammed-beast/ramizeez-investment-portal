import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, generateTotpSecret, totp, verifyTotp } from "@/lib/auth/totp";

// RFC 6238 Appendix B (SHA-1), truncated to 6 digits.
const SECRET = base32Encode(Buffer.from("12345678901234567890"));
const VECTORS: [number, string][] = [
  [59, "287082"],
  [1111111109, "081804"],
  [1111111111, "050471"],
  [1234567890, "005924"],
  [2000000000, "279037"],
];

describe("TOTP", () => {
  it("round-trips base32", () => {
    const buf = Buffer.from("hello world, 2fa!");
    expect(base32Decode(base32Encode(buf))).toEqual(buf);
    expect(SECRET).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  });

  it.each(VECTORS)("matches RFC 6238 at t=%i", (t, code) => {
    expect(totp(SECRET, t * 1000)).toBe(code);
  });

  it("accepts ±1 step of drift and rejects older codes", () => {
    const now = 1_700_000_000_000;
    expect(verifyTotp(SECRET, totp(SECRET, now - 30_000), now)).not.toBeNull();
    expect(verifyTotp(SECRET, totp(SECRET, now + 30_000), now)).not.toBeNull();
    expect(verifyTotp(SECRET, totp(SECRET, now - 90_000), now)).toBeNull();
  });

  it("returns the matched step so replays can be blocked", () => {
    const now = 1_700_000_000_000;
    expect(verifyTotp(SECRET, totp(SECRET, now), now)).toBe(Math.floor(now / 30_000));
  });

  it("rejects malformed codes", () => {
    expect(verifyTotp(SECRET, "12345", Date.now())).toBeNull();
    expect(verifyTotp(SECRET, "abcdef", Date.now())).toBeNull();
  });

  it("generates 160-bit secrets", () => {
    expect(base32Decode(generateTotpSecret())).toHaveLength(20);
  });
});
