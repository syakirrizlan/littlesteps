// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyCareData, type CareData } from "../../src/lib/care/types";

const sample = (name: string): CareData => ({ ...emptyCareData(), child: { name } });

async function freshVault() {
  vi.resetModules();
  return import("../../src/lib/security/vault");
}

beforeEach(() => localStorage.clear());

describe("vault", { timeout: 60_000 }, () => {
  it("stores only ciphertext", async () => {
    const v = await freshVault();
    await v.createVault("teh tarik at 7", sample("Secret Name"));
    await v.flushVault();
    const raw = Object.values(localStorage).join("");
    expect(raw).not.toContain("Secret Name");
    expect(Object.keys(localStorage)).toEqual(["ls.vault.v1"]);
  });

  it("refuses to set up a second vault over an existing one", async () => {
    const a = await freshVault();
    await a.createVault("first passcode", sample("A"));
    const b = await freshVault();
    await expect(b.createVault("second passcode", sample("B"))).rejects.toBeInstanceOf(b.VaultExistsError);
    const c = await freshVault();
    await c.unlock("first passcode");
    expect(c.vaultData()!.child!.name).toBe("A");
  });

  it("keeps an edit made right before locking, and forgets data on lock", async () => {
    const v = await freshVault();
    await v.createVault("teh tarik at 7", sample("Before"));
    v.setVaultData(sample("Af"));
    v.setVaultData(sample("After"));
    v.lock();
    expect(v.vaultData()).toBeNull();
    await v.flushVault();
    await v.unlock("teh tarik at 7");
    expect(v.vaultData()!.child!.name).toBe("After");
  });

  it("slows down repeated wrong passcodes", async () => {
    const v = await freshVault();
    await v.createVault("teh tarik at 7", sample("X"));
    v.lock();
    for (let i = 0; i < 5; i++) await expect(v.unlock("wrong guess " + i)).rejects.toBeInstanceOf(v.WrongPasscodeError);
    expect(v.lockoutRemaining()).toBeGreaterThan(20_000);
    await expect(v.unlock("teh tarik at 7")).rejects.toBeInstanceOf(v.LockedOutError);
  });

  it("re-encrypts with a new passcode without losing edits", async () => {
    const v = await freshVault();
    await v.createVault("old passcode", sample("Start"));
    const change = v.changePasscode("old passcode", "new passcode 1");
    v.setVaultData(sample("During"));
    await change;
    await v.flushVault();
    v.lock();
    await expect(v.unlock("old passcode")).rejects.toBeInstanceOf(v.WrongPasscodeError);
    await v.unlock("new passcode 1");
    expect(v.vaultData()!.child!.name).toBe("During");
  });

  it("makes an encrypted backup that restores with the passcode used at the time", async () => {
    const v = await freshVault();
    await v.createVault("teh tarik at 7", sample("Backed Up"));
    const file = await v.makeBackup(new Date("2026-11-24T10:00:00Z"));
    expect(file).not.toContain("Backed Up");
    await expect(v.readBackup(file, "wrong passcode")).rejects.toBeInstanceOf(v.WrongPasscodeError);
    await expect(v.readBackup("{\"hello\":1}", "teh tarik at 7")).rejects.toBeInstanceOf(v.NotABackupError);
    await expect(v.readBackup("not json", "teh tarik at 7")).rejects.toBeInstanceOf(v.NotABackupError);
    // restore on a fresh phone with a different passcode
    localStorage.clear();
    const w = await freshVault();
    await w.createVault("brand new phone", emptyCareData());
    const restored = await w.readBackup(file, "teh tarik at 7");
    expect(restored.data.child!.name).toBe("Backed Up");
    expect(restored.createdAt).toBe("2026-11-24T10:00:00.000Z");
    w.setVaultData(restored.data);
    await w.flushVault();
    w.lock();
    await w.unlock("brand new phone");
    expect(w.vaultData()!.child!.name).toBe("Backed Up");
  });

  it("rejects a tampered backup", async () => {
    const v = await freshVault();
    await v.createVault("teh tarik at 7", sample("X"));
    const file = JSON.parse(await v.makeBackup(new Date()));
    file.record.ct = file.record.ct.slice(0, -4) + "AAAA";
    await expect(v.readBackup(JSON.stringify(file), "teh tarik at 7")).rejects.toBeInstanceOf(v.WrongPasscodeError);
  });

  it("enforces passcode rules", async () => {
    const v = await freshVault();
    expect(v.passcodeProblem("123456")).toMatch(/8/);
    expect(v.passcodeProblem("12345678")).toMatch(/numbers/);
    expect(v.passcodeProblem("password")).toMatch(/common/);
    expect(v.passcodeProblem("aaaaaaaa")).toMatch(/repeat/);
    expect(v.passcodeProblem("teh tarik at 7")).toBeNull();
  });
});
