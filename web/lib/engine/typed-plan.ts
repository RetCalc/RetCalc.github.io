/* The retirement plan engine (plan.js), for the Retirement Plan Optimizer and the
   readiness guide, with its types. core.js is loaded first, for the order
   it explains. */
import "./core.js";
import * as E from "./plan.js";
import type { PlDone, PlHist, PlMixSpec, PlPlan, PlPrep, PlProgress, PlRow, PlSS, PlTactics, PlToday } from "./types";

const typed = <F>(f: unknown) => f as F;

export const plAtRetire = typed<(I: PlToday) => PlPlan>(E.plAtRetire);
export const plPrep = typed<(P: PlPlan) => PlPrep>(E.plPrep);
export const plBaseTactics = typed<(C: PlPrep) => PlTactics>(E.plBaseTactics);
export const plCombos = typed<(C: PlPrep, T0: PlTactics) => PlTactics[]>(E.plCombos);
export const plStarts = typed<(C: PlPrep) => number[]>(E.plStarts);
export const plMix = typed<(mix: PlMixSpec) => { real: number; infl: number }>(E.plMix);
export const plKey = typed<(T: PlTactics) => string>(E.plKey);
export const plOptimize = typed<(P: PlPlan, goal: string) => Generator<PlProgress | PlDone>>(E.plOptimize);
export const plHistory = typed<(C: PlPrep, T: PlTactics, opts: { paths?: boolean; stopAfter?: number }) => PlHist>(E.plHistory);
export const plDetail = typed<(C: PlPrep, T: PlTactics) => { rows: PlRow[] }>(E.plDetail);
export const plBands = typed<(H: PlHist, n: number) => { p10: number; p50: number; p90: number }[]>(E.plBands);
export const plSSParts = typed<(C: { P: { pia1: number; pia2: number; fra1?: number; fra2?: number }; married: boolean; gap: number }, T: { c1: number; c2: number }) => PlSS>(E.plSSParts);
export const plClaimMin = typed<(age: number) => number>(E.plClaimMin);
export const PL_HEIR = E.PL_HEIR as number;

/** One year of a run on a withdrawal budget (plRunBudget). */
export interface PlBudgetRow {
  y: number; age: number; age2: number | null; budget: number; out: number; left: number; owe: number;
  ss: number; pension: number; work: number; rmd: number; trad: number; reinvest: number; conv: number; brok: number; roth: number;
  tax: number; pen: number; aca: number; irmaa: number; agi: number; magi: number; ord: number; gain: number; taxable: number; seniors: number;
  short: number; endTrad: number; endRoth: number; endBrok: number; end: number;
}
export interface PlBudgetRun {
  ok: boolean; depleted: number; short: number; owed: number; tax: number; pen: number; aca: number; irmaa: number;
  conv: number; spent: number; end: number; trad: number; roth: number; brok: number; legacy: number;
}
/** What plRunBudget reads off the prepared plan besides PlPrep's fields. */
export interface PlPrepFull extends PlPrep { mix: { r: Float64Array; pi: Float64Array; n: number; first: number }; status: "s" | "m"; heir: number }
export const plTactics = typed<(C: PlPrep, T: PlTactics) => unknown>(E.plTactics);
export const plRunBudget = typed<(C: PlPrep, K: unknown, R: Float64Array, PI: Float64Array, off: number, W: ArrayLike<number>, out: { rows: PlBudgetRow[] } | null, floor?: ArrayLike<number>) => PlBudgetRun>(E.plRunBudget);
export const plFillLevel = typed<(st: "s" | "m", f: number) => number>(E.plFillLevel);
