import { describe, expect, it } from "vitest";
import { addPastVisit, correctVisit, dropOff, liveVisits, openVisit, pickUp, statusNow, visitFlags, visitMinutes, voidVisit } from "../../src/lib/care/attendance";
import { kl, klIso, must, sample } from "../fixtures/sample";

const TUE = "2026-11-24";

describe("drop-off and pickup", () => {
  it("records a normal day with duration, people and expected times", () => {
    const s = sample();
    let d = must(dropOff(s.data, { at: klIso(TUE, "08:12"), by: s.mum, babysitterId: s.sitter }, kl(TUE, "08:12")));
    const v = openVisit(d)!;
    expect(v.careDate).toBe(TUE);
    expect(v.expected).toEqual({ dropOff: "08:00", pickUp: "17:30" });
    d = must(pickUp(d, { at: klIso(TUE, "17:34"), by: s.dad }, kl(TUE, "17:34")));
    const done = liveVisits(d)[0];
    expect(done.pickedUpBy).toBe(s.dad);
    expect(visitMinutes(done, kl(TUE, "20:00"))).toBe(562);
    expect(openVisit(d)).toBeUndefined();
    expect(d.changes.map((c) => c.field)).toEqual(["droppedOffAt", "pickedUpAt"]);
  });

  it("blocks a duplicate drop-off", () => {
    const s = sample();
    const d = must(dropOff(s.data, { at: klIso(TUE, "08:12"), by: s.mum, babysitterId: s.sitter }, kl(TUE, "08:12")));
    const again = dropOff(d, { at: klIso(TUE, "08:20"), by: s.mum, babysitterId: s.sitter }, kl(TUE, "08:20"));
    expect(again).toEqual({ ok: false, error: expect.stringMatching(/already dropped off/) });
  });

  it("blocks a pickup with no drop-off", () => {
    const s = sample();
    expect(pickUp(s.data, { at: klIso(TUE, "17:00"), by: s.mum }, kl(TUE, "17:00"))).toEqual({ ok: false, error: expect.stringMatching(/no drop-off/) });
  });

  it("blocks a pickup before drop-off and times in the future", () => {
    const s = sample();
    const d = must(dropOff(s.data, { at: klIso(TUE, "08:12"), by: s.mum, babysitterId: s.sitter }, kl(TUE, "08:15")));
    expect(pickUp(d, { at: klIso(TUE, "08:00"), by: s.mum }, kl(TUE, "09:00")).ok).toBe(false);
    expect(dropOff(s.data, { at: klIso(TUE, "09:00"), by: s.mum, babysitterId: s.sitter }, kl(TUE, "08:00"))).toEqual({ ok: false, error: expect.stringMatching(/future/) });
    // a minute of clock drift is fine
    expect(dropOff(s.data, { at: klIso(TUE, "08:01"), by: s.mum, babysitterId: s.sitter }, kl(TUE, "08:00")).ok).toBe(true);
  });

  it("requires a known babysitter and person", () => {
    const s = sample();
    expect(dropOff(s.data, { at: klIso(TUE, "08:00"), by: "nobody", babysitterId: s.sitter }, kl(TUE, "08:00")).ok).toBe(false);
    expect(dropOff(s.data, { at: klIso(TUE, "08:00"), by: s.mum, babysitterId: s.dad }, kl(TUE, "08:00"))).toEqual({ ok: false, error: expect.stringMatching(/isn't saved as a babysitter/) });
  });

  it("keeps a visit that runs past midnight on the drop-off date", () => {
    const s = sample();
    let d = must(dropOff(s.data, { at: klIso(TUE, "20:00"), by: s.mum, babysitterId: s.sitter }, kl(TUE, "20:00")));
    d = must(pickUp(d, { at: klIso("2026-11-25", "01:30"), by: s.mum }, kl("2026-11-25", "01:30")));
    const v = liveVisits(d)[0];
    expect(v.careDate).toBe(TUE);
    expect(visitMinutes(v, new Date())).toBe(330);
    // the late flag uses the drop-off day's usual times; an after-midnight pickup is never "early"
    expect(visitFlags(v, 15)).toEqual({ lateBy: 720, earlyBy: null });
  });

  it("flags late drop-off and early pickup beyond the grace period", () => {
    const s = sample();
    let d = must(dropOff(s.data, { at: klIso(TUE, "08:15"), by: s.mum, babysitterId: s.sitter }, kl(TUE, "08:15")));
    d = must(pickUp(d, { at: klIso(TUE, "17:15"), by: s.mum }, kl(TUE, "17:15")));
    expect(visitFlags(liveVisits(d)[0], 15)).toEqual({ lateBy: null, earlyBy: null });
    expect(visitFlags(liveVisits(d)[0], 10)).toEqual({ lateBy: 15, earlyBy: 15 });
  });

  it("rejects visits longer than 24 hours and overlapping visits", () => {
    const s = sample();
    const d = must(addPastVisit(s.data, { droppedOffAt: klIso("2026-11-23", "08:00"), droppedOffBy: s.mum, pickedUpAt: klIso("2026-11-23", "17:00"), pickedUpBy: s.mum, babysitterId: s.sitter }, "forgot to tap", kl(TUE, "09:00")));
    const overlap = addPastVisit(d, { droppedOffAt: klIso("2026-11-23", "16:00"), droppedOffBy: s.mum, pickedUpAt: klIso("2026-11-23", "18:00"), pickedUpBy: s.mum, babysitterId: s.sitter }, "forgot again", kl(TUE, "09:00"));
    expect(overlap).toEqual({ ok: false, error: expect.stringMatching(/overlaps/) });
    const long = addPastVisit(s.data, { droppedOffAt: klIso("2026-11-20", "08:00"), droppedOffBy: s.mum, pickedUpAt: klIso("2026-11-21", "09:00"), pickedUpBy: s.mum, babysitterId: s.sitter }, "forgot to tap", kl(TUE, "09:00"));
    expect(long).toEqual({ ok: false, error: expect.stringMatching(/24 hours/) });
  });
});

describe("corrections", () => {
  it("needs a reason and logs every changed field with old and new values", () => {
    const s = sample();
    let d = must(dropOff(s.data, { at: klIso(TUE, "08:30"), by: s.mum, babysitterId: s.sitter }, kl(TUE, "08:30")));
    const id = openVisit(d)!.id;
    expect(correctVisit(d, id, { droppedOffAt: klIso(TUE, "08:10") }, "", kl(TUE, "09:00"))).toEqual({ ok: false, error: expect.stringMatching(/reason/) });
    d = must(correctVisit(d, id, { droppedOffAt: klIso(TUE, "08:10"), droppedOffBy: s.dad }, "tapped late", kl(TUE, "09:00")));
    const lines = d.changes.filter((c) => c.reason === "tapped late");
    expect(lines.map((c) => c.field).sort()).toEqual(["droppedOffAt", "droppedOffBy"]);
    expect(lines.find((c) => c.field === "droppedOffAt")).toMatchObject({ from: klIso(TUE, "08:30"), to: klIso(TUE, "08:10") });
  });

  it("fixes a forgotten pickup, which shows as needing correction until then", () => {
    const s = sample();
    let d = must(dropOff(s.data, { at: klIso("2026-11-23", "08:00"), by: s.mum, babysitterId: s.sitter }, kl("2026-11-23", "08:00")));
    const status = statusNow(d, kl(TUE, "07:00"));
    expect(status.kind).toBe("fix");
    const id = openVisit(d)!.id;
    expect(correctVisit(d, id, { pickedUpAt: klIso("2026-11-23", "17:40") }, "forgot pickup", kl(TUE, "07:00"))).toEqual({ ok: false, error: expect.stringMatching(/who picked/) });
    d = must(correctVisit(d, id, { pickedUpAt: klIso("2026-11-23", "17:40"), pickedUpBy: s.dad }, "forgot pickup", kl(TUE, "07:00")));
    expect(statusNow(d, kl(TUE, "07:00")).kind).toBe("waiting");
  });

  it("moves a visit to a new date when the drop-off date is corrected", () => {
    const s = sample();
    let d = must(addPastVisit(s.data, { droppedOffAt: klIso("2026-11-21", "09:00"), droppedOffBy: s.mum, pickedUpAt: klIso("2026-11-21", "12:00"), pickedUpBy: s.mum, babysitterId: s.sitter }, "added later", kl(TUE, "09:00")));
    const id = liveVisits(d)[0].id;
    d = must(correctVisit(d, id, { droppedOffAt: klIso("2026-11-20", "09:00"), pickedUpAt: klIso("2026-11-20", "12:00") }, "wrong day", kl(TUE, "09:00")));
    const v = liveVisits(d)[0];
    expect(v.careDate).toBe("2026-11-20");
    expect(v.expected).toEqual({ dropOff: "08:00", pickUp: "17:30" }); // Friday's usual times, not Saturday's
  });

  it("voids a visit with a reason and keeps it in history", () => {
    const s = sample();
    let d = must(dropOff(s.data, { at: klIso(TUE, "08:00"), by: s.mum, babysitterId: s.sitter }, kl(TUE, "08:00")));
    const id = openVisit(d)!.id;
    d = must(voidVisit(d, id, "tapped by mistake", kl(TUE, "08:01")));
    expect(liveVisits(d)).toHaveLength(0);
    expect(d.visits).toHaveLength(1);
    expect(d.changes.at(-1)).toMatchObject({ action: "void", reason: "tapped by mistake" });
    // and a fresh drop-off is allowed again
    expect(dropOff(d, { at: klIso(TUE, "08:05"), by: s.mum, babysitterId: s.sitter }, kl(TUE, "08:05")).ok).toBe(true);
  });
});

describe("today's status", () => {
  it("moves through waiting, at babysitter and picked up", () => {
    const s = sample();
    expect(statusNow(s.data, kl(TUE, "07:30"))).toEqual({ kind: "waiting", expected: "08:00" });
    let d = must(dropOff(s.data, { at: klIso(TUE, "08:12"), by: s.mum, babysitterId: s.sitter }, kl(TUE, "08:12")));
    expect(statusNow(d, kl(TUE, "11:52"))).toMatchObject({ kind: "in", minutes: 220 });
    d = must(pickUp(d, { at: klIso(TUE, "17:34"), by: s.mum }, kl(TUE, "17:34")));
    expect(statusNow(d, kl(TUE, "18:00"))).toMatchObject({ kind: "out", minutes: 562, totalMinutes: 562 });
    expect(statusNow(d, kl("2026-11-25", "07:00"))).toEqual({ kind: "waiting", expected: "08:00" });
    expect(statusNow(d, kl("2026-11-28", "07:00"))).toEqual({ kind: "waiting", expected: undefined }); // Saturday
  });

  it("asks for a correction when a visit is left open for too long", () => {
    const s = sample();
    const d = must(dropOff(s.data, { at: klIso(TUE, "06:00"), by: s.mum, babysitterId: s.sitter }, kl(TUE, "06:00")));
    expect(statusNow(d, kl(TUE, "22:30")).kind).toBe("fix");
  });
});
