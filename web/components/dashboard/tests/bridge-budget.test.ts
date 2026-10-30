/* The Bridge on a withdrawal budget (the Dashboard's): each year takes out
   what Retirement's strategy does and spends what's left after its costs;
   every historical start takes its own withdrawals; five markets to follow.
   And what bridgeBudget() leans on: a strategy's withdrawals in a year don't
   depend on the markets after it. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { brCtx, brFlatSeq, brSim, brWd } from "@/lib/engine/typed-bridge";
import type { BrInput, BrPlan } from "@/lib/engine/types";
import { bridgeScenarios, runBridge } from "@/tools/bridge/run";
import { DRAWDOWN_DEFAULTS, drawdownSetup, type DrawdownState } from "@/tools/drawdown/model";
import { ddWindows, runDrawdown } from "@/lib/engine/typed-drawdown";

const INP: BrInput = {
  status: "m", state: "IL", age: 50, spend: 60000, trad: 1e6, k401: 0, roth: 150000, rothBasis: 90000,
  brok: 450000, basisPct: 0.6, g457: 0, stock: 70, work: 0, workUntil: 0, aca: true, household: 2, premium: 0,
  seppMethod: "amort", seppRate: 0.05, fill: "none",
};
const PLAN = { key: "brok", conv: "none", order: ["brok", "roth", "g457", "r55", "tradPen", "rungEarly", "rothEarn"], sepp: 0 } as unknown as BrPlan;
const near = (a: number, b: number, tol: number, msg: string) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test("each year takes out its budget and spends what's left after tax, penalty and premium", () => {
  const nB = brCtx(INP).nB, wd = Array.from({ length: nB }, (_, y) => (y < 3 ? 80000 : 95000));
  const ctx = brCtx({ ...INP, budget: { steady: wd, byStart: {} } });
  const run = brSim(ctx, PLAN, { ...brFlatSeq(ctx.nB, ctx.real, ctx.infl), wd }, true);
  run.rows!.forEach((r, y) => {
    const drawn = r.d.brok + r.d.rothBasis + r.d.rung + r.d.r55 + r.d.early + r.sp - r.surplus;
    near(drawn, wd[y], 1, `age ${r.age} takes out the budget`);
    near(r.spend, wd[y] - r.tax - r.pen - r.health - r.fica, 1, `age ${r.age} spends the rest`);
    assert.equal(r.wd, wd[y]);
  });
});

test("a historical start takes its own withdrawals, others the steady path's; no budget, no change", () => {
  const steady = [70000, 70000], own = [35000, 35000];
  const ctx = brCtx({ ...INP, budget: { steady, byStart: { 1966: own } } });
  assert.equal(brWd(ctx, 1966), own);
  assert.equal(brWd(ctx, 1967), steady);
  assert.equal(brWd(ctx), steady);
  const plain = brCtx(INP);
  assert.equal(brWd(plain, 1966), undefined);
  const run = brSim(plain, PLAN, brFlatSeq(plain.nB, plain.real, plain.infl), true);
  assert.ok(run.rows!.every((r) => r.spend === 60000 && r.wd === null));
});

test("on a budget there are five markets to follow, the 90th to the 10th; spending a set amount, three", () => {
  const nB = brCtx(INP).nB, steady = Array(nB).fill(70000);
  const byStart: Record<number, number[]> = {};
  for (let y = 1926; y < 2020; y++) byStart[y] = Array(nB).fill(50000 + (y % 7) * 5000);
  const { run, ctx } = runBridge({ ...INP, budget: { steady, byStart } }, "hist", 0);
  assert.ok(run);
  const S = bridgeScenarios(ctx, run.best);
  assert.deepEqual(Object.keys(S), ["p90", "above", "avg", "below", "p10"]);
  const total = (k: keyof typeof S) => S[k]!.run.rows!.reduce((a, r) => a + (r.wd ?? 0), 0);
  assert.ok(total("p90") >= total("avg") && total("avg") >= total("p10"), "ranked by what the strategy withdraws");
  const plain = runBridge(INP, "hist", 0);
  assert.deepEqual(Object.keys(bridgeScenarios(plain.ctx, plain.run!.best)), ["above", "avg", "below"]);
});

test("a strategy's withdrawals don't depend on the markets after them (every strategy)", () => {
  const nB = 10;
  for (const strategy of ["fixed", "kitces", "pct", "clyatt", "oneovern", "rmd", "vpw", "guardrails", "riskgr", "floorceil", "vanguard", "yale", "hebeler", "sensible", "cape"]) {
    const { o, P } = drawdownSetup({ ...DRAWDOWN_DEFAULTS, strategy, retireAge: "50", years: "45" } as unknown as DrawdownState);
    const full = new Map(ddWindows(o).filter((w) => w.month === 1).map((w) => [w.year, w]));
    for (const w of ddWindows({ ...o, years: nB })) {
      const f = full.get(w.year);
      if (w.month !== 1 || !f) continue;
      const a = runDrawdown(o, f.seq, null, P).rows, b = runDrawdown(o, w.seq.concat(Array(o.years - nB).fill(w.seq[nB - 1])), null, P).rows;
      for (let y = 0; y < nB; y++) near(b[y].realWithdrawal, a[y].realWithdrawal, 1e-6, `${strategy} from ${w.year}, year ${y + 1}`);
    }
  }
});
