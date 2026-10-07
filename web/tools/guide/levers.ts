/* The lever table (doc 3, section 3, item 8): the plan run again with one
   fixed change at a time, so the person sees what each lever does before
   any option is solved for. The changes are fixed amounts, not solved ones,
   so the table reads the same from one visit to the next. Pure: the worker
   runs it (planJobs.ts), and the baseline (scripts/baseline/guide.mjs)
   checks it against the fixture households. */

import { need, sim, type Over, type Sim } from "./calc";
import type { Answers } from "./store";

export interface Lever { id: string; over: (S: Sim) => Over }
export const LEVERS: Lever[] = [
  { id: "save+100", over: (S) => ({ monthly: S.monthly + 100 }) },
  { id: "save+250", over: (S) => ({ monthly: S.monthly + 250 }) },
  { id: "retire-3", over: (S) => ({ retire: S.retire - 3 }) },
  { id: "retire-1", over: (S) => ({ retire: S.retire - 1 }) },
  { id: "retire+1", over: (S) => ({ retire: S.retire + 1 }) },
  { id: "retire+3", over: (S) => ({ retire: S.retire + 3 }) },
  { id: "spend-5000", over: (S) => ({ spend: S.spend - 5000 }) },
  { id: "spend+5000", over: (S) => ({ spend: S.spend + 5000 }) },
  { id: "spend+10000", over: (S) => ({ spend: S.spend + 10000 }) },
];

/** One row: savings at retirement, what the plan needs there, and how often it lasted. */
export interface LeverRow { id: string; retire: number; fv: number; need: number; success: number }

/** The plan as it stands, then each lever; a lever the plan can't take
    (retiring before today) is null. */
export function leverRows(a: Answers): { now: LeverRow; rows: (LeverRow | null)[] } | null {
  const S = sim(a);
  if (!S) return null;
  const row = (id: string, T: Sim): LeverRow => ({ id, retire: T.retire, fv: T.fv, need: need(a, T), success: T.success });
  return {
    now: row("now", S),
    rows: LEVERS.map((L) => { const T = sim(a, L.over(S)); return T ? row(L.id, T) : null; }),
  };
}
