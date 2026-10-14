/* Where the monthly saving goes: a percentage for each of the three tax
   buckets. Kept apart from calc.ts, and light, so a saved guide can be read
   back (stored.ts) without loading the plan engine. Pure. */

import type { Answers, Sources } from "./store";

export const SPLIT_KEYS = ["splitTrad", "splitRoth", "splitBrok"] as const;
export type SplitKey = (typeof SPLIT_KEYS)[number];
/** What the split starts as: half traditional, a quarter each Roth and taxable. */
export const SPLIT_DEFAULT: Record<SplitKey, number> = { splitTrad: 50, splitRoth: 25, splitBrok: 25 };
/** The four choices the three percentages replaced. */
const LEGACY: Record<string, Record<SplitKey, number>> = {
  trad: { splitTrad: 100, splitRoth: 0, splitBrok: 0 }, roth: { splitTrad: 0, splitRoth: 100, splitBrok: 0 },
  half: { splitTrad: 50, splitRoth: 50, splitBrok: 0 }, brok: { splitTrad: 0, splitRoth: 0, splitBrok: 100 },
};

const num = (v: unknown): v is number => typeof v === "number" && isFinite(v);

/** A guide saved before the split (it kept one of four choices, `saveTo`)
    gets the same money in percentages. A choice the guide had filled in
    itself, not the person, gives way to the new default instead. Changes
    the answers in place; the old key is dropped either way. */
export function migrateSplit(a: Answers, src?: Sources): void {
  const old = a.saveTo;
  if (old === undefined) return;
  const theirs = src?.saveTo?.kind !== "default";
  delete a.saveTo;
  if (src) delete src.saveTo;
  const mine = LEGACY[old as string];
  if (!mine || !theirs || SPLIT_KEYS.some((k) => num(a[k]))) return;
  for (const k of SPLIT_KEYS) a[k] = mine[k];
}
