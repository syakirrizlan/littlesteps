import { describe, expect, it } from "vitest";
import { buildDailyReport, monthSummary } from "../../src/lib/care/report";
import { addPastVisit, correctVisit, dropOff, liveVisits, pickUp } from "../../src/lib/care/attendance";
import { addEntry } from "../../src/lib/care/entries";
import { kl, klIso, must, sample } from "../fixtures/sample";

const TUE = "2026-11-24";

function day() {
  const s = sample();
  let d = must(dropOff(s.data, { at: klIso(TUE, "08:12"), by: s.mum, babysitterId: s.sitter }, kl(TUE, "08:12")));
  d = must(addEntry(d, { type: "meal", at: klIso(TUE, "09:00"), meal: "breakfast", amount: "all" }, kl(TUE, "09:00")));
  d = must(addEntry(d, { type: "nap", at: klIso(TUE, "11:30"), end: klIso(TUE, "12:50") }, kl(TUE, "13:00")));
  d = must(addEntry(d, { type: "nap", at: klIso(TUE, "15:00"), end: klIso(TUE, "15:30") }, kl(TUE, "15:30")));
  d = must(addEntry(d, { type: "incident", at: klIso(TUE, "16:00"), severity: "minor", detail: "Scraped elbow" }, kl(TUE, "16:00")));
  d = must(pickUp(d, { at: klIso(TUE, "17:34"), by: s.dad }, kl(TUE, "17:34")));
  return { ...s, data: d };
}

describe("daily report", () => {
  it("brings the day together", () => {
    const s = day();
    const r = buildDailyReport(s.data, TUE, kl(TUE, "21:00"));
    expect(r.childName).toBe("Test Child");
    expect(r.visits).toHaveLength(1);
    expect(r.visits[0]).toMatchObject({ minutes: 562, droppedOffBy: "Parent A", pickedUpBy: "Parent B", babysitter: "Sitter One", lateBy: null, earlyBy: null });
    expect(r.totalMinutes).toBe(562);
    expect(r.meals).toHaveLength(1);
    expect(r.napMinutes).toBe(110);
    expect(r.incidents.map((i) => i.detail)).toEqual(["Scraped elbow"]);
    expect(r.timeline.map((e) => e.type)).toEqual(["meal", "nap", "nap", "incident"]);
    expect(r.isEmpty).toBe(false);
  });

  it("lists corrections made that day and is empty for a day off", () => {
    const s = day();
    const id = liveVisits(s.data)[0].id;
    const d = must(correctVisit(s.data, id, { droppedOffAt: klIso(TUE, "08:05") }, "tapped late", kl(TUE, "21:00")));
    expect(buildDailyReport(d, TUE, kl(TUE, "21:00")).corrections).toHaveLength(1);
    expect(buildDailyReport(d, "2026-11-25", kl(TUE, "21:00")).isEmpty).toBe(true);
  });
});

describe("month overview", () => {
  it("counts days, hours, late and early days", () => {
    const s = day();
    let d = must(addPastVisit(s.data, { droppedOffAt: klIso("2026-11-23", "08:40"), droppedOffBy: s.mum, pickedUpAt: klIso("2026-11-23", "16:00"), pickedUpBy: s.mum, babysitterId: s.sitter }, "added later", kl(TUE, "21:00")));
    d = must(addPastVisit(d, { droppedOffAt: klIso("2026-10-30", "08:00"), droppedOffBy: s.mum, pickedUpAt: klIso("2026-10-30", "17:30"), pickedUpBy: s.mum, babysitterId: s.sitter }, "added later", kl(TUE, "21:00")));
    const m = monthSummary(d, "2026-11", kl(TUE, "21:00"));
    expect(m.days).toHaveLength(30);
    expect(m.daysAttended).toBe(2);
    expect(m.totalMinutes).toBe(562 + 440);
    expect(m.averageMinutes).toBe(501);
    expect(m.lateCount).toBe(1);
    expect(m.earlyCount).toBe(1);
    expect(m.incidentCount).toBe(1);
    expect(m.days.find((x) => x.date === "2026-11-23")).toMatchObject({ late: true, early: true });
    expect(m.days.find((x) => x.date === "2026-11-28")?.scheduled).toBe(false);
  });
});
