/* Runs every plan for the Early Retirement Bridge, and the three markets the
   detail views follow. From renderBridge() and brScenarios() in
   src/js/app/36-bridge.js. */
import { BR_UNLOCK, HIST_START, brBetter, brCtx, brFlatSeq, brMCSeqs, brPlans, brSim, brTax, brTest } from "@/lib/engine/typed";
import type { BrCtx, BrEnd, BrInput, BrPlan, BrRun, BrTest } from "@/lib/engine/types";

export interface RunPlan extends BrPlan {
  steady: BrRun; hist: BrTest; test: BrTest;
  score: { hold: number; cost: number; left: number };
}
export type AnyPlan = BrPlan & Partial<RunPlan>;

export interface BridgeRun {
  ctx: BrCtx;
  plans: AnyPlan[];
  live: RunPlan[];
  best: RunPlan;
  mc: boolean;
}

export type PathKey = "above" | "avg" | "below";
export interface Scenario { run: BrRun; label: string; head: string; year?: number; pct?: string }
export type Scenarios = Partial<Record<PathKey, Scenario>>;

/** Every plan, tested; null until there's spending and a balance to plan with. */
export function runBridge(inp: BrInput, mode: "hist" | "mc"): { ctx: BrCtx; run: BridgeRun | null } {
  const ctx = brCtx(inp);
  if (ctx.trad + ctx.roth + ctx.brok + ctx.g457 <= 0 || !(ctx.spend > 0)) return { ctx, run: null };
  const steady = brFlatSeq(ctx.nB, ctx.real, ctx.infl);
  const mc = mode === "mc" ? brMCSeqs(ctx) : null;
  const plans: AnyPlan[] = brPlans(ctx, steady).map((p) => {
    if (p.off) return p;
    const st = brSim(ctx, p, steady, true), hist = brTest(ctx, p, null), test = mc ? brTest(ctx, p, mc) : hist;
    return { ...p, steady: st, hist, test, score: { hold: Math.round(test.hold / Math.max(1, test.of) * 100), cost: st.cost, left: st.end.total } };
  });
  const live = plans.filter((p): p is RunPlan => !p.off);
  // The penalty plan is there for comparison, not as a recommendation.
  const pool = live.filter((p) => !p.penaltyPlanned);
  const best = (pool.length ? pool : live).slice().sort((a, b) => brBetter(b.score, a.score))[0];
  return { ctx, run: { ctx, plans, live, best, mc: !!mc } };
}

/** The three markets the detail views can follow, all real historical
    starts ranked by what's left at 59½: the 75th percentile, the median and
    the 25th. */
export function bridgeScenarios(ctx: BrCtx, sel: RunPlan): Scenarios {
  const runs = sel.hist.runs.slice().sort((a, b) => a.end.total - b.end.total);
  if (!runs.length) return { avg: { run: sel.steady, label: "average returns", head: "Average" } };
  const pick = (q: number, head: string, label: string, pct: string): Scenario => {
    const r = runs[Math.min(runs.length - 1, Math.floor(runs.length * q))];
    return {
      run: brSim(ctx, sel, { r: ctx.mix.r, pi: ctx.mix.pi, off: r.start! - (HIST_START as number), len: ctx.nB }, true),
      year: r.start, head, pct, label: label + ", like retiring in " + r.start,
    };
  };
  return {
    above: pick(0.75, "Above average", "an above-average market", "75th percentile"),
    avg: pick(0.5, "Average", "an average market", "median"),
    below: pick(0.25, "Below average", "a below-average market", "25th percentile"),
  };
}

/** A first year after 59½ that pays for the same spending, drawn from each
    account in proportion to what's in it: the gross amount comes from the
    tax on the traditional share and on the gain inside the brokerage share. */
export function firstYearAfter(ctx: BrCtx, e: BrEnd) {
  const tot = e.total, wT = e.trad / tot, wR = e.roth / tot, wB = e.brok / tot;
  const gs = e.brok > 0 ? 1 - e.bBasis / e.brok : 0;
  let G = ctx.spend;
  for (let i = 0; i < 12; i++) G = ctx.spend + brTax(ctx, G * wT, G * wB * gs, 0);
  return { trad: G * wT, roth: G * wR, brok: G * wB, gainPct: gs, gross: G };
}

export const UNLOCK = BR_UNLOCK as number;
