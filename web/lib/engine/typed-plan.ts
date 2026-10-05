/* The retirement plan engine (plan.js), for the Plan Optimizer and the
   readiness guide, with its types. core.js is loaded first, for the order
   it explains. */
import "./core.js";
import * as E from "./plan.js";
import type { PlDone, PlPlan, PlPrep, PlProgress, PlTactics, PlToday } from "./types";

const typed = <F>(f: unknown) => f as F;

export const plAtRetire = typed<(I: PlToday) => PlPlan>(E.plAtRetire);
export const plPrep = typed<(P: PlPlan) => PlPrep>(E.plPrep);
export const plBaseTactics = typed<(C: PlPrep) => PlTactics>(E.plBaseTactics);
export const plCombos = typed<(C: PlPrep, T0: PlTactics) => PlTactics[]>(E.plCombos);
export const plStarts = typed<(C: PlPrep) => number[]>(E.plStarts);
export const plMix = typed<(stock: number) => { real: number; infl: number }>(E.plMix);
export const plKey = typed<(T: PlTactics) => string>(E.plKey);
export const plOptimize = typed<(P: PlPlan, goal: string) => Generator<PlProgress | PlDone>>(E.plOptimize);
export const PL_HEIR = E.PL_HEIR as number;
