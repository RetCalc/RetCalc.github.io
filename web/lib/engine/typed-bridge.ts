/* The Early Retirement Bridge's engine, with its types, kept out of the
   other pages: it brings the retirement plan engine (plan.js) with it.
   core.js is loaded first, for the order it explains. */
import "./core.js";
import * as E from "./bridge.js";
import type { BrCtx, BrInput, BrMC, BrPlan, BrRun, BrSeq, BrTest } from "./types";

const typed = <F>(f: unknown) => f as F;

export const brCtx = typed<(inp: BrInput) => BrCtx>(E.brCtx);
export const brFlatSeq = typed<(len: number, real: number, infl: number) => BrSeq>(E.brFlatSeq);
export const brPlans = typed<(ctx: BrCtx, steady: BrSeq) => BrPlan[]>(E.brPlans);
export const brMCSeqs = typed<(ctx: BrCtx, seed: number) => BrMC>(E.brMCSeqs);
export const brSim = typed<(ctx: BrCtx, p: BrPlan, seq: BrSeq, wantRows: boolean) => BrRun>(E.brSim);
export const brTest = typed<(ctx: BrCtx, p: BrPlan, mc: BrMC | null) => BrTest>(E.brTest);
export const brBetter = typed<(a: { hold: number; cost: number; left: number }, b: { hold: number; cost: number; left: number }) => number>(E.brBetter);
export const brTax = typed<(ctx: BrCtx, ord: number, gain: number, wage: number) => number>(E.brTax);
export const brSeppBase = typed<(ctx: BrCtx) => number>(E.brSeppBase);
export const brSeppMax = typed<(ctx: BrCtx, method?: string) => number>(E.brSeppMax);
export const brSeppEnd = typed<(ctx: BrCtx) => number>(E.brSeppEnd);
export const BR_CATS = E.BR_CATS as { k: string; name: string; c: string }[];
export const BR_NOEXP = E.BR_NOEXP as Record<string, unknown>;
export const { BR_TRIALS, BR_UNLOCK } = E as unknown as { BR_TRIALS: number; BR_UNLOCK: number };
