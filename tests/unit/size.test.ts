// Measures stored size for a busy year of synthetic records (guards the storage budget in docs/known-limitations.md).
import { describe, expect, it } from "vitest";
import { addPastVisit, liveVisits } from "../../src/lib/care/attendance";
import { addEntry } from "../../src/lib/care/entries";
import { addDays, weekdayOf } from "../../src/lib/care/time";
import { deriveKey, randomBytes, seal } from "../../src/lib/security/crypto";
import { kl, klIso, must, sample } from "../fixtures/sample";

describe("storage budget", () => {
  it("a busy year (250 days, 8 entries a day) stays under 0.5 MB encrypted", { timeout: 120_000 }, async () => {
    const s = sample();
    let d = s.data;
    let date = "2025-01-01";
    let days = 0;
    while (days < 250) {
      date = addDays(date, 1);
      const wd = weekdayOf(date);
      if (wd === 0 || wd === 6) continue;
      days++;
      const now = kl(addDays(date, 1), "09:00");
      d = must(addPastVisit(d, { droppedOffAt: klIso(date, "08:05"), droppedOffBy: s.mum, pickedUpAt: klIso(date, "17:40"), pickedUpBy: s.dad, babysitterId: s.sitter }, "test data", now));
      d = must(addEntry(d, { type: "meal", at: klIso(date, "09:00"), meal: "breakfast", food: "Oats with banana", amount: "most" }, now));
      d = must(addEntry(d, { type: "meal", at: klIso(date, "10:30"), meal: "milk", amount: "all", ml: 150 }, now));
      d = must(addEntry(d, { type: "meal", at: klIso(date, "12:30"), meal: "lunch", food: "Rice, chicken soup, carrots", amount: "half" }, now));
      d = must(addEntry(d, { type: "nap", at: klIso(date, "13:15"), end: klIso(date, "14:45") }, now));
      d = must(addEntry(d, { type: "activity", at: klIso(date, "15:00"), kind: "outdoor", detail: "Played in the garden with bubbles" }, now));
      d = must(addEntry(d, { type: "meal", at: klIso(date, "16:00"), meal: "snack", food: "Apple slices", amount: "all" }, now));
      d = must(addEntry(d, { type: "health", at: klIso(date, "16:30"), condition: "well" }, now));
      d = must(addEntry(d, { type: "note", at: klIso(date, "17:00"), detail: "Happy day, said a few new words and sang along to songs." }, now));
    }
    expect(liveVisits(d)).toHaveLength(250);
    const salt = randomBytes(16);
    const sealed = JSON.stringify(await seal(d, await deriveKey("x", salt, 100_000), salt, 100_000));
    const mb = sealed.length / 1_000_000;
    console.log(`plain ${(JSON.stringify(d).length / 1e6).toFixed(2)} MB, encrypted ${mb.toFixed(2)} MB for 250 days`);
    expect(mb).toBeLessThan(0.5);
  });
});
