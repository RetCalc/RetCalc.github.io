/* The figures chapters 3 and 4 teach with, worked out from the answers by
   the same engine functions the plan uses (doc 3, calculations 2 and 3):
   what time does to saving, what each mix has earned since 1926, where the
   savings sit, and what each claiming age pays. Plain data, no React, so
   the unit tests check them against doc 3's worked figures. */

import { BASIC_INFL, RISKS, backtest } from "@/lib/engine/typed";
import { plAtRetire, plSSParts } from "@/lib/engine/typed-plan";
import type { PlToday } from "@/lib/engine/types";
import { accts, ok, saveMo } from "./calc";
import type { Answers } from "./store";

const INFL = BASIC_INFL as number;

/** One set of balances grown to retirement by the plan's own growth
    (plAtRetire): today's balance and a monthly saving that rises with
    inflation, stopping at `stop` if it's before retirement. */
function grown(age: number, retire: number, real: number, balance: number, monthly: number, stop: number | null = null) {
  const P = plAtRetire({ status: "s", age, retire, stopAge: stop, real, infl: INFL, trad: balance, roth: 0, brok: 0,
    saveTrad: monthly, saveRoth: 0, saveBrok: 0 } as PlToday) as unknown as { fv: number; path: number[] };
  return { fv: P.fv, path: P.path };
}

/** What one dollar saved today is worth at retirement, in today's dollars. */
export function dollarAt(age: number, retire: number, real: number): number {
  return grown(age, retire, real, 1, 0).fv;
}

export interface Curve {
  id: "now" | "stop" | "late";
  /** Ages the saving runs between. */
  from: number; to: number;
  /** The balance at each birthday from today to retirement. */
  path: number[];
  fv: number;
}
/** Lesson 8's three curves for `monthly` a month: saved from now to
    retirement; saved from now but stopped `gap` years early; and started
    `gap` years late. The last two save for the same number of years, so
    the difference between them is time alone. `gap` is ten years, or half
    the saving years when there are fewer than thirteen. Null when there's
    less than two years to save. */
export function compounding(age: number, retire: number, real: number, monthly: number) {
  const yrs = retire - age;
  if (!(yrs >= 2)) return null;
  const gap = yrs > 12 ? 10 : Math.floor(yrs / 2);
  const now = grown(age, retire, real, 0, monthly), stop = grown(age, retire, real, 0, monthly, retire - gap);
  const late = grown(age + gap, retire, real, 0, monthly);
  const curves: Curve[] = [
    { id: "now", from: age, to: retire, path: now.path, fv: now.fv },
    { id: "stop", from: age, to: retire - gap, path: stop.path, fv: stop.fv },
    { id: "late", from: age + gap, to: retire, path: [...Array(Math.round(gap)).fill(0), ...late.path], fv: late.fv },
  ];
  return { gap, years: yrs, curves };
}

/** Card 6's readout: today's balance and the monthly saving, each grown to
    retirement at the mix the plan assumes, with any stop age the plan has.
    Their sum is the projection the rail shows. */
export function growthParts(a: Answers) {
  if (!ok(a.age) || !ok(a.retire) || !(a.retire > a.age) || !ok(a.saved)) return null;
  // planIn's rule: a stop age at or after retirement is no stop at all.
  const stop = ok(a.stopAge) && a.stopAge < a.retire ? Math.max(a.age, a.stopAge) : null;
  const real = a.risk || 0.045, monthly = saveMo(a);
  const A = dollarAt(a.age, a.retire, real);
  const fromSaving = grown(a.age, a.retire, real, 0, monthly, stop).fv;
  return { real, A, monthly, fromSaved: a.saved * A, fromSaving, total: a.saved * A + fromSaving };
}

export interface MixHistory {
  label: string; sub: string;
  /** The real return the plan assumes for the mix. */
  real: number;
  /** The backtest's stock share for it (the rest bonds). */
  stock: number;
  /** The real return it earned a year over the whole record. */
  cagr: number;
  /** Its ten-year stretches, a year after inflation: the worst, the middle, the best. */
  worst: number; med: number; best: number;
  first: number; last: number;
}
let history: MixHistory[] | null = null;
/** Lesson 9's range bars: each of the five mixes, rebalanced yearly, run
    through the Portfolio Backtest's record. Worked out once. */
export function mixHistory(): MixHistory[] {
  if (history) return history;
  history = RISKS.map((r, i) => {
    const stock = [20, 40, 60, 80, 100][i];
    const B = backtest({ stockPct: stock, svPct: 0, cashPct: 0, rebal: "year", rebalN: 1, rebalBand: 0, fee: 0, initial: 10000, startYear: 0, endYear: 0 });
    const ten = B.rolling.find((x) => x.len === 10)!;
    return { label: r.label, sub: r.sub, real: r.real, stock, cagr: B.realCagr, worst: ten.realWorst, med: ten.realMed, best: ten.realBest, first: B.first, last: B.last };
  });
  return history;
}

/** What the savings grow to by retirement at each mix: the number moves
    with the mix. The same growth as the plan's, so the chosen mix's figure
    is the rail's. */
export function byMix(a: Answers) {
  if (!ok(a.age) || !ok(a.retire) || !(a.retire > a.age) || !ok(a.saved)) return null;
  return RISKS.map((r) => growthParts({ ...a, risk: r.real })!.total);
}

/** Lesson 10's three boxes: the savings by how they're taxed. */
export function buckets(a: Answers) {
  const A = accts(a), total = A.trad + A.roth + A.brok;
  const share = (v: number) => (total > 0 ? v / total : 0);
  return [
    { id: "trad", name: "Traditional", v: A.trad, share: share(A.trad), tax: "Taxed as income when it comes out" },
    { id: "roth", name: "Roth", v: A.roth, share: share(A.roth), tax: "Never taxed again" },
    { id: "brok", name: "Brokerage", v: A.brok, share: share(A.brok), tax: "Taxed only on its gains" },
  ] as const;
}

/** The claiming ages lesson 13 shows. */
export const LADDER_AGES = [62, 64, 67, 70];
/** Lesson 13's ladder: a benefit of `pia` a month at 67, claimed at each
    age, by the 2026 rules (5/9 of 1% a month for the first three years
    early, 5/12 beyond; 8% a year after 67). */
export function ladder(pia: number, ages = LADDER_AGES) {
  return ages.map((age) => ({ age, mo: plSSParts({ P: { pia1: pia, pia2: 0 }, married: false, gap: 0 }, { c1: age, c2: age }).own1 / 12 }));
}
