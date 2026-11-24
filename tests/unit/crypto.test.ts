import { describe, expect, it } from "vitest";
import { deriveKey, isSealedRecord, open, passcodeStrength, randomBytes, saltOf, seal, PBKDF2_ITERATIONS } from "../../src/lib/security/crypto";

const FAST = 100_000; // the minimum the app accepts; keeps tests quick

describe("passcode encryption", () => {
  it("round-trips data with the right passcode", async () => {
    const salt = randomBytes(16);
    const key = await deriveKey("teh tarik at 7", salt, FAST);
    const record = await seal({ child: { name: "Test Child" }, temperatureTenths: 376 }, key, salt, FAST);
    expect(isSealedRecord(record)).toBe(true);
    expect(JSON.stringify(record)).not.toContain("Test Child");
    expect(JSON.stringify(record)).not.toContain("376");
    const again = await deriveKey("teh tarik at 7", saltOf(record), record.iterations);
    await expect(open(record, again)).resolves.toEqual({ child: { name: "Test Child" }, temperatureTenths: 376 });
  });

  it("refuses a wrong passcode", async () => {
    const salt = randomBytes(16);
    const record = await seal({ secret: 1 }, await deriveKey("right one", salt, FAST), salt, FAST);
    await expect(open(record, await deriveKey("wrong one", salt, FAST))).rejects.toThrow();
  });

  it("detects tampering", async () => {
    const salt = randomBytes(16);
    const key = await deriveKey("pass1234", salt, FAST);
    const record = await seal({ balance: 100 }, key, salt, FAST);
    const bytes = Uint8Array.from(atob(record.ct), (c) => c.charCodeAt(0));
    bytes[0] ^= 1;
    const tampered = { ...record, ct: btoa(String.fromCharCode(...bytes)) };
    await expect(open(tampered, key)).rejects.toThrow();
  });

  it("uses a fresh IV for every save and depends on the salt", async () => {
    const salt = randomBytes(16);
    const key = await deriveKey("pass1234", salt, FAST);
    const a = await seal({ x: 1 }, key, salt, FAST);
    const b = await seal({ x: 1 }, key, salt, FAST);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
    const otherSalt = await deriveKey("pass1234", randomBytes(16), FAST);
    await expect(open(a, otherSalt)).rejects.toThrow();
  });

  it("uses the strong default iteration count", async () => {
    expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(600_000);
    expect(isSealedRecord({ v: 1, kdf: "PBKDF2-SHA256", iterations: 1000, salt: "", iv: "", ct: "" })).toBe(false);
  });

  it("rates passcode strength", () => {
    expect(passcodeStrength("12345").score).toBe(0);
    expect(passcodeStrength("abcdef").score).toBe(1);
    expect(passcodeStrength("Abcdef12").score).toBe(2);
    expect(passcodeStrength("teh tarik at 7").score).toBe(3);
  });
});
