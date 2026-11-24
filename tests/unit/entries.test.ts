import { describe, expect, it } from "vitest";
import { addEntry, endNap, entriesOn, napMinutes, openNap, updateEntry, voidEntry } from "../../src/lib/care/entries";
import { dropOff } from "../../src/lib/care/attendance";
import { addMedInstruction, setMedInstructionActive } from "../../src/lib/care/setup";
import { kl, klIso, must, sample } from "../fixtures/sample";

const TUE = "2026-11-24";
const now = kl(TUE, "20:00");

describe("meals", () => {
  it("records a meal and milk in ml", () => {
    const s = sample();
    let d = must(addEntry(s.data, { type: "meal", at: klIso(TUE, "09:00"), meal: "breakfast", food: "Oats", amount: "all" }, now));
    d = must(addEntry(d, { type: "meal", at: klIso(TUE, "10:30"), meal: "milk", amount: "most", ml: 150 }, now));
    const meals = entriesOn(d, TUE);
    expect(meals.map((m) => m.type === "meal" && m.meal)).toEqual(["breakfast", "milk"]);
    expect(d.changes.filter((c) => c.target === "entry" && c.action === "create")).toHaveLength(2);
  });

  it("validates amounts and millilitres", () => {
    const s = sample();
    expect(addEntry(s.data, { type: "meal", at: klIso(TUE, "09:00"), meal: "lunch", amount: "all", ml: 100 }, now).ok).toBe(false);
    expect(addEntry(s.data, { type: "meal", at: klIso(TUE, "09:00"), meal: "milk", amount: "all", ml: 12.5 }, now).ok).toBe(false);
    expect(addEntry(s.data, { type: "meal", at: klIso(TUE, "09:00"), meal: "milk", amount: "loads" as never }, now).ok).toBe(false);
    expect(addEntry(s.data, { type: "meal", at: klIso(TUE, "21:00"), meal: "dinner", amount: "all" }, now)).toEqual({ ok: false, error: expect.stringMatching(/future/) });
  });
});

describe("naps", () => {
  it("calculates duration, including an unfinished nap and one crossing midnight", () => {
    const s = sample();
    let d = must(addEntry(s.data, { type: "nap", at: klIso(TUE, "12:30") }, kl(TUE, "12:30")));
    const n = openNap(d)!;
    expect(napMinutes(n, kl(TUE, "13:10"))).toBe(40);
    d = must(endNap(d, n.id, klIso(TUE, "14:00"), kl(TUE, "14:00")));
    expect(openNap(d)).toBeUndefined();
    const done = entriesOn(d, TUE)[0];
    expect(done.type === "nap" && napMinutes(done, now)).toBe(90);
    const late = must(addEntry(d, { type: "nap", at: klIso(TUE, "23:30"), end: klIso("2026-11-25", "00:45") }, kl("2026-11-25", "01:00")));
    const cross = entriesOn(late, TUE).at(-1)!;
    expect(cross.type === "nap" && napMinutes(cross, now)).toBe(75);
  });

  it("rejects overlapping naps, a second running nap and waking before sleeping", () => {
    const s = sample();
    const d = must(addEntry(s.data, { type: "nap", at: klIso(TUE, "12:30"), end: klIso(TUE, "14:00") }, now));
    expect(addEntry(d, { type: "nap", at: klIso(TUE, "13:30"), end: klIso(TUE, "15:00") }, now)).toEqual({ ok: false, error: expect.stringMatching(/overlaps/) });
    expect(addEntry(d, { type: "nap", at: klIso(TUE, "15:00"), end: klIso(TUE, "14:30") }, now).ok).toBe(false);
    const running = must(addEntry(d, { type: "nap", at: klIso(TUE, "16:00") }, kl(TUE, "16:10")));
    expect(addEntry(running, { type: "nap", at: klIso(TUE, "16:05") }, kl(TUE, "16:10"))).toEqual({ ok: false, error: expect.stringMatching(/still running/) });
  });
});

describe("activities, health, medication, incidents", () => {
  it("records each kind", () => {
    const s = sample();
    let d = must(addEntry(s.data, { type: "activity", at: klIso(TUE, "10:00"), kind: "outdoor", detail: "Park" }, now));
    d = must(addEntry(d, { type: "health", at: klIso(TUE, "11:00"), condition: "unsettled", temperatureTenths: 376 }, now));
    d = must(addEntry(d, { type: "incident", at: klIso(TUE, "15:00"), severity: "minor", detail: "Bumped knee on table", actionTaken: "Cold pack" }, now));
    d = must(addEntry(d, { type: "note", at: klIso(TUE, "16:00"), detail: "Said a new word" }, now));
    expect(entriesOn(d, TUE).map((e) => e.type)).toEqual(["activity", "health", "incident", "note"]);
  });

  it("rejects bad temperatures and empty incident descriptions", () => {
    const s = sample();
    expect(addEntry(s.data, { type: "health", at: klIso(TUE, "11:00"), condition: "well", temperatureTenths: 500 }, now).ok).toBe(false);
    expect(addEntry(s.data, { type: "incident", at: klIso(TUE, "11:00"), severity: "minor", detail: "  " }, now).ok).toBe(false);
    expect(addEntry(s.data, { type: "note", at: klIso(TUE, "11:00"), detail: "x".repeat(501) }, now).ok).toBe(false);
  });

  it("only allows medication you have authorised and is still active", () => {
    const s = sample();
    expect(addEntry(s.data, { type: "medication", at: klIso(TUE, "13:00"), instructionId: "none", dose: "5 ml" }, now).ok).toBe(false);
    let d = must(addMedInstruction(s.data, { medicine: "Paracetamol syrup", dose: "5 ml", when: "If temperature above 38 °C" }, now));
    const id = d.medInstructions[0].id;
    d = must(addEntry(d, { type: "medication", at: klIso(TUE, "13:00"), instructionId: id, dose: "5 ml" }, now));
    const off = must(setMedInstructionActive(d, id, false));
    expect(addEntry(off, { type: "medication", at: klIso(TUE, "14:00"), instructionId: id, dose: "5 ml" }, now)).toEqual({ ok: false, error: expect.stringMatching(/no longer authorised/) });
  });
});

describe("dates, edits and removal", () => {
  it("files an after-midnight entry under the visit's day", () => {
    const s = sample();
    let d = must(dropOff(s.data, { at: klIso(TUE, "20:00"), by: s.mum, babysitterId: s.sitter }, kl(TUE, "20:00")));
    d = must(addEntry(d, { type: "meal", at: klIso("2026-11-25", "00:30"), meal: "milk", amount: "all", ml: 120 }, kl("2026-11-25", "00:40")));
    expect(d.entries[0].careDate).toBe(TUE);
    const outside = must(addEntry(s.data, { type: "note", at: klIso("2026-11-25", "00:30"), detail: "Woke at home" }, kl("2026-11-25", "00:40")));
    expect(outside.entries[0].careDate).toBe("2026-11-25");
  });

  it("logs edits field by field and removes only with a reason", () => {
    const s = sample();
    let d = must(addEntry(s.data, { type: "meal", at: klIso(TUE, "12:00"), meal: "lunch", amount: "half" }, now));
    const id = d.entries[0].id;
    d = must(updateEntry(d, id, { type: "meal", at: klIso(TUE, "12:00"), meal: "lunch", amount: "most" }, now, "sitter corrected"));
    expect(d.changes.at(-1)).toMatchObject({ field: "amount", from: "half", to: "most", reason: "sitter corrected" });
    expect(updateEntry(d, id, { type: "note", at: klIso(TUE, "12:00"), detail: "x" }, now).ok).toBe(false);
    expect(voidEntry(d, id, "", now).ok).toBe(false);
    d = must(voidEntry(d, id, "wrong child's lunch", now));
    expect(entriesOn(d, TUE)).toHaveLength(0);
    expect(d.entries).toHaveLength(1);
  });
});
