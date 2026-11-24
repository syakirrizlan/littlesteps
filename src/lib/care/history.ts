import type { CareData, Change } from "./types";

export function newId(): string {
  return crypto.randomUUID();
}

type ChangeInput = Omit<Change, "id" | "at">;

/** Appends lines to the change history. */
export function withChanges(data: CareData, now: Date, changes: ChangeInput[]): CareData {
  if (!changes.length) return data;
  const at = now.toISOString();
  return { ...data, changes: [...data.changes, ...changes.map((c) => ({ ...c, id: newId(), at }))] };
}

/** Field-by-field differences between two records, as change lines. */
export function fieldChanges<T extends object>(before: T, after: T, fields: (keyof T)[]): { field: string; from?: string; to?: string }[] {
  const out: { field: string; from?: string; to?: string }[] = [];
  for (const f of fields) {
    const a = before[f];
    const b = after[f];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    out.push({ field: String(f), from: a === undefined ? undefined : String(a), to: b === undefined ? undefined : String(b) });
  }
  return out;
}

export function changesFor(data: CareData, targetId: string): Change[] {
  return data.changes.filter((c) => c.targetId === targetId);
}
