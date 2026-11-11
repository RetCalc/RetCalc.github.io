/* The market-history figures behind seven lesson widgets (OutcomeRange,
   StockShare, SuccessRate, Guardrails, Rebalance, CapeRate, AnnuityShare).
   Each is the engine's own run, the same one the lesson's static tables and
   charts were made from, so a widget at its default settings shows the
   lesson's figures. Kept apart from the components so node can check them. */

import { backtest, historicalRuns } from "@/lib/engine/typed";
import {
  CAPE_NOW, HIST_M_CAPE, HIST_STOCK, HIST_START, ddCuts, ddOptsFromState, ddPrep, ddQuick, ddWindows, historicalBacktest, runDrawdown,
} from "@/lib/engine/typed-drawdown";
import type { BtInput } from "@/lib/engine/types";

/** The last calendar year in the record. */
export const LAST_YEAR = HIST_START + HIST_STOCK.length - 1;

const bt = (o: Partial<BtInput>) => backtest({ stockPct: 60, svPct: 0, cashPct: 0, rebal: "year", rebalN: 1, rebalBand: 5, fee: 0, initial: 10000, startYear: HIST_START, endYear: LAST_YEAR, ...o });

/* ---- a range, not a line (OutcomeRange) and how much in stocks (StockShare) ----
   Jordan's plan: $100,000 saved, $1,000 per month raised 3% per year (about
   inflation), run through every monthly start in the record (historicalRuns),
   in today's dollars. */
const jordan = (stock: number, years: number) =>
  historicalRuns({ initial: 100000, fees: 0 }, [{ years, contrib: 1000, period: "Monthly", growth: 0.03, mix: stock / 100, lump: 0 }]);

/** The 10th, 50th and 90th percentile of Jordan's balance at each year end, and
    the steady line: $100,000 growing at the mix's own 1926–2025 return after
    inflation (backtest realCagr, to a hundredth of a point as the lesson
    quotes it), compounded monthly, plus $1,000 per month. */
export function outcomeRange(stock: number, years: number) {
  const h = jordan(stock, years);
  const rate = Math.round(bt({ stockPct: stock }).realCagr * 1e4) / 1e4;
  const rm = Math.pow(1 + rate, 1 / 12) - 1;
  const steady = [100000];
  let b = 100000;
  for (let y = 1; y <= years; y++) {
    for (let m = 0; m < 12; m++) b = b * (1 + rm) + 1000;
    steady.push(b);
  }
  const band = (k: "p10" | "p50" | "p90") => [100000, ...h.bands.map((x) => x[k])];
  return {
    x: steady.map((_, i) => i), p10: band("p10"), p50: band("p50"), p90: band("p90"), steady, rate,
    count: h.count, below: h.finals.filter((f) => f < b).length, worst: h.worst, best: h.best,
  };
}

/** Jordan after 25 years at each stock share from 0% to 100%, in steps of 10:
    the worst start and the 10th, 50th and 90th percentiles. */
export function shareOutcomes() {
  return Array.from({ length: 11 }, (_, i) => {
    const h = jordan(i * 10, 25), last = h.bands[h.bands.length - 1];
    return { share: i * 10, worst: h.worst.final, worstYear: h.worst.start, p10: last.p10, p50: last.p50, p90: last.p90 };
  });
}

/** 2008 at a mix: the engine's calendar-year return for that share in stocks
    (the rest 10-year Treasuries), and what it did to `amount`. */
export function year2008(stock: number, amount = 500000) {
  const ret = bt({ stockPct: stock, startYear: 2008, endYear: 2008 }).rows[0].ret;
  return { ret, change: amount * ret, left: amount * (1 + ret) };
}

/* ---- chance of success (SuccessRate) ----
   $1,000,000 in 60% stocks and 40% bonds for 30 years, a fixed first-year
   rate raised with inflation, every January start 1927–1996. */
export function successRun(rate: number) {
  const h = historicalBacktest(ddOptsFromState({ initial: 1000000, years: 30, stock: 60, rate, strategy: "fixed" }));
  return {
    years: h.runs.map((r) => r.startYear), left: h.runs.map((r) => (r.depleted ? 0 : r.endReal)),
    total: h.total, survived: h.survived, rate: h.successRate, median: h.medianEnd,
    above: h.runs.filter((r) => r.endReal > 1000000).length,
    fails: h.runs.filter((r) => r.depleted).map((r) => ({ year: r.startYear, ranOut: r.depletedYear as number })),
  };
}

/* ---- fixed or flexible (Guardrails) ----
   One January start, $1,000,000 in 60/40 for 30 years: guardrails from a
   starting rate (20% bands, cuts and raises of `step` percent) beside the same
   first-year amount held fixed and raised with inflation. Spending in today's
   dollars. */
export function guardrailsVsFixed(rate: number, step: number, start: number) {
  const one = (strategy: string) => {
    const o = ddOptsFromState({ initial: 1000000, years: 30, stock: 60, rate, strategy, guardBand: 20, adjust: step });
    const w = ddWindows(o).find((x) => x.year === start && x.month === 1);
    if (!w) return null;
    const P = ddPrep(o), r = runDrawdown(o, w.seq, null, P), spend = r.rows.map((x) => x.realSpend);
    return { spend, total: spend.reduce((a, v) => a + v, 0), low: Math.min(...spend), high: Math.max(...spend), end: r.endReal, ranOut: r.depletedYear, cuts: ddCuts(r.rows, P.path).length };
  };
  return { guard: one("guardrails"), fixed: one("fixed") };
}

/* ---- diversification and rebalancing (Rebalance) ----
   60% US stocks and 40% 10-year Treasuries from the start of a year to 2025,
   rebalanced every year, at a 5-point band (checked each January) or never.
   The stock share at each year end is that year's endMix from the engine's
   backtest run to it: before the next January's rebalance, so the yearly
   rule's line shows the drift it corrects. */
export type RebalRule = "year" | "band" | "never";
const RULE: Record<RebalRule, Partial<BtInput>> = { year: { rebal: "every", rebalN: 1 }, band: { rebal: "band", rebalBand: 5 }, never: { rebal: "never" } };
export function drift(start: number, rule: RebalRule) {
  const run = (r: RebalRule) => {
    const share = [0.6];
    for (let y = start; y <= LAST_YEAR; y++) share.push(bt({ ...RULE[r], startYear: start, endYear: y, initial: 100000 }).endMix[0]);
    const all = bt({ ...RULE[r], startYear: start, initial: 100000 });
    return { share, end: all.endBal, cagr: all.cagr, maxDD: all.maxDD, worst: all.worst, rebalances: all.rebalances };
  };
  const x = Array.from({ length: LAST_YEAR - start + 2 }, (_, i) => start - 1 + i);
  return { x, rule: run(rule), never: rule === "never" ? null : run("never") };
}

/* ---- CAPE and valuations (CapeRate) ----
   The CAPE rule the Drawdown Simulator opens with: a base rate plus a share
   of the earnings yield, 1 ÷ CAPE (ddOptsFromState's capeA and capeB). */
export const CAPE_RULE = (() => { const o = ddOptsFromState({}); return { base: o.capeA, share: o.capeB }; })();
export const CAPE_TODAY = CAPE_NOW;
/** The rule's first-year rate at a CAPE, as a fraction. */
export const capeRate = (cape: number) => (CAPE_RULE.base + (CAPE_RULE.share * 100) / cape) / 100;
/** The median of every monthly CAPE reading 1926–2025. */
export const CAPE_MEDIAN = (() => {
  const s = HIST_M_CAPE.slice(0, HIST_STOCK.length * 12).sort((a, b) => a - b), h = s.length / 2;
  return s.length % 2 ? s[Math.floor(h)] : (s[h - 1] + s[h]) / 2;
})();

/* ---- annuities and pensions (AnnuityShare) ----
   $42,000 in year one from $1,000,000 in 60/40, a fixed plan raised with
   inflation: part of the savings buys an annuity paying `payout` percent of
   its price, rising with inflation, and the rest stays invested at whatever
   rate brings year one to $42,000. Every January start, 30 and 35 years. */
export const ANNUITY_SPEND = 42000;
export function annuityPlan(share: number, payout: number) {
  const annuity = (share / 100) * 1000000 * (payout / 100), invested = 1000000 * (1 - share / 100);
  const withdrawal = Math.max(0, ANNUITY_SPEND - annuity), rate = invested > 0 ? (withdrawal / invested) * 100 : 0;
  const run = (years: number) => {
    const o = ddOptsFromState({ initial: 1000000, years, stock: 60, rate, strategy: "fixed", gShare: share, gType: "annuity", gPayout: payout, gInflate: true });
    return { ...ddQuick(o), n: ddWindows(o).length };
  };
  return { annuity, withdrawal, rate, y30: run(30), y35: run(35) };
}
/** The chance of lasting 30 and 35 years at every share from 0% to 50%, steps of 5. */
export function annuityCurve(payout: number) {
  return Array.from({ length: 11 }, (_, i) => { const p = annuityPlan(i * 5, payout); return { share: i * 5, s30: p.y30.successRate, s35: p.y35.successRate }; });
}
