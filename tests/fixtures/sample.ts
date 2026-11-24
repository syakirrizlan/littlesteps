/** Synthetic test data only. Never put real names or records here. */
import { emptyCareData, type CareData } from "../../src/lib/care/types";
import { addPerson, setChild, setSchedule } from "../../src/lib/care/setup";
import { fromLocal } from "../../src/lib/care/time";

export function must<T>(r: { ok: true; data: T } | { ok: false; error: string }): T {
  if (!r.ok) throw new Error(`Expected success, got: ${r.error}`);
  return r.data;
}

export interface Sample {
  data: CareData;
  mum: string;
  dad: string;
  sitter: string;
  family: string;
}

/** A child "Test Child", two parents, one babysitter, usual times 08:00–17:30 on weekdays. */
export function sample(): Sample {
  let data = must(setChild(emptyCareData(), { name: "Test Child" }));
  const mum = must(addPerson(data, "Parent A", "family"));
  data = mum.data;
  const dad = must(addPerson(data, "Parent B", "family"));
  data = dad.data;
  const sitter = must(addPerson(data, "Sitter One", "babysitter"));
  data = sitter.data;
  for (const wd of [1, 2, 3, 4, 5]) data = must(setSchedule(data, wd, { dropOff: "08:00", pickUp: "17:30" }));
  return { data, mum: mum.id, dad: dad.id, sitter: sitter.id, family: mum.id };
}

/** KL wall-clock helper: kl("2026-11-24", "08:12") → Date. */
export const kl = (date: string, time: string) => new Date(fromLocal(date, time));
export const klIso = (date: string, time: string) => fromLocal(date, time);
