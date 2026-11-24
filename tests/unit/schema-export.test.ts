import { describe, expect, it } from "vitest";
import { parseCareData } from "../../src/lib/care/schema";
import { csvCell, toCsv } from "../../src/lib/care/export";
import { emptyCareData } from "../../src/lib/care/types";
import { dropOff, pickUp, voidVisit, liveVisits } from "../../src/lib/care/attendance";
import { addEntry } from "../../src/lib/care/entries";
import { kl, klIso, must, sample } from "../fixtures/sample";

const TUE = "2026-11-24";

describe("data checks", () => {
  it("accepts valid data, including after a JSON round trip", () => {
    const s = sample();
    const d = must(dropOff(s.data, { at: klIso(TUE, "08:00"), by: s.mum, babysitterId: s.sitter }, kl(TUE, "08:00")));
    expect(parseCareData(JSON.parse(JSON.stringify(d)))).toEqual(d);
    expect(parseCareData(emptyCareData())).not.toBeNull();
  });

  it("rejects other shapes and newer versions", () => {
    expect(parseCareData(null)).toBeNull();
    expect(parseCareData({ version: 2, payments: [] })).toBeNull(); // e.g. a Finance Tracker file
    expect(parseCareData({ ...emptyCareData(), version: 99 })).toBeNull();
    expect(parseCareData({ ...emptyCareData(), visits: [{ id: "x" }] })).toBeNull();
    expect(parseCareData({ ...emptyCareData(), entries: [{ id: "x", type: "party" }] })).toBeNull();
  });
});

describe("CSV export", () => {
  it("lists visits and entries in time order and leaves out removed ones", () => {
    const s = sample();
    let d = must(dropOff(s.data, { at: klIso(TUE, "08:12"), by: s.mum, babysitterId: s.sitter }, kl(TUE, "08:12")));
    d = must(addEntry(d, { type: "meal", at: klIso(TUE, "12:00"), meal: "lunch", food: "Rice, chicken", amount: "most" }, kl(TUE, "12:00")));
    d = must(pickUp(d, { at: klIso(TUE, "17:34"), by: s.dad }, kl(TUE, "17:34")));
    const csv = toCsv(d);
    const lines = csv.trim().split("\r\n");
    expect(lines[0]).toBe("date,record,start,end,minutes,details,by,babysitter,voided_reason");
    expect(lines[1]).toBe("2026-11-24,visit,08:12,17:34,562,picked up by Parent B,Parent A,Sitter One,");
    expect(lines[2]).toBe('2026-11-24,meal,12:00,,,"lunch; Rice, chicken; ate most",,,');
    const voided = must(voidVisit(d, liveVisits(d)[0].id, "mistake", kl(TUE, "18:00")));
    expect(toCsv(voided)).not.toContain("visit,08:12");
    expect(toCsv(voided, { includeVoided: true })).toContain("mistake");
  });

  it("neutralises spreadsheet formulas and quotes", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+60123")).toBe("'+60123");
    expect(csvCell("plain")).toBe("plain");
  });
});
