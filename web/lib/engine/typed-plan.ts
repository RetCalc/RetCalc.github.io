/* The retirement plan engine (plan.js), for the Plan Optimizer and the
   readiness guide, with its types. core.js is loaded first, for the order
   it explains. */
import "./core.js";
import * as E from "./plan.js";
import type { PlDone, PlHist, PlPlan, PlPrep, PlProgress, PlRow, PlSS, PlTactics, PlToday } from "./types";

const typed = <F>(f: unknown) => f as F;

export const plAtRetire = typed<(I: PlToday) => PlPlan>(E.plAtRetire);
export const plPrep = typed<(P: PlPlan) => PlPrep>(E.plPrep);
export const plBaseTactics = typed<(C: PlPrep) => PlTactics>(E.plBaseTactics);
export const plCombos = typed<(C: PlPrep, T0: PlTactics) => PlTactics[]>(E.plCombos);
export const plStarts = typed<(C: PlPrep) => number[]>(E.plStarts);
export const plMix = typed<(stock: number) => { real: number; infl: number }>(E.plMix);
export const plKey = typed<(T: PlTactics) => string>(E.plKey);
export const plOptimize = typed<(P: PlPlan, goal: string) => Generator<PlProgress | PlDone>>(E.plOptimize);
export const plHistory = typed<(C: PlPrep, T: PlTactics, opts: { paths?: boolean; stopAfter?: number }) => PlHist>(E.plHistory);
export const plDetail = typed<(C: PlPrep, T: PlTactics) => { rows: PlRow[] }>(E.plDetail);
export const plBands = typed<(H: PlHist, n: number) => { p10: number; p50: number; p90: number }[]>(E.plBands);
export const plSSParts = typed<(C: { P: { pia1: number; pia2: number }; married: boolean; gap: number }, T: { c1: number; c2: number }) => PlSS>(E.plSSParts);
export const plClaimMin = typed<(age: number) => number>(E.plClaimMin);
export const PL_HEIR = E.PL_HEIR as number;
