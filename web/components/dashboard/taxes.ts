/* Taxes in retirement: which accounts each year's withdrawal comes from, and
   how much traditional money to convert to Roth in the low-tax years.

   One plan, as the Bridge works: Retirement's withdrawal strategy decides how
   much comes out of savings each year, in every historical start (the same
   January starts the Drawdown Simulator runs); this only decides where it
   comes from and what to convert (the plan engine's bracket fill, conversion
   window and income guards), and the year's tax and income-linked premiums
   are paid out of it. A conversion moves money from traditional to Roth, so
   the accounts' total follows the strategy's own path and the chance of
   success doesn't change; what changes is how much of each withdrawal you
   keep, and what's left for your heirs after their tax. Retiring before 59½,
   the Bridge plans the years until then (its own conversions included) and
   this picks up from there, with each market's balances as the bridge left
   them. */

import { HIST_START } from "@/lib/engine/typed";
import { ddWindows, runDrawdown } from "@/lib/engine/typed-drawdown";
import { plPrep, plRunBudget, plTactics, plFillLevel, type PlBudgetRow, type PlBudgetRun, type PlPrepFull } from "@/lib/engine/typed-plan";
import { yearData } from "@/lib/engine/typed";
import { drawdownSetup } from "@/tools/drawdown/model";
import { bridgeInput } from "@/tools/bridge/model";
import { runBridge } from "@/tools/bridge/run";
import type { PlPlan } from "@/lib/engine/types";
import { drawdownFor, retireMix } from "./flows";
import { results, type Results } from "./model";
import { OUTSIDE_US, type Entry, type Profile } from "./store";
import { UNLOCK, bridgeBudget, bridgeFor, earlyRetirees } from "./bridge";

/** The choices: f how far traditional withdrawals fill the brackets (0 none,
    1 the standard deduction, 2 the 10% bracket, 3 12%, 4 22%, 5 24%); u how
    long the unspent part of that room is converted (0 never, 1 until Social
    Security starts, 2 until required withdrawals start); im keep income under
    Medicare's first surcharge line from 63; ac under the marketplace credit's
    limit before 65. */
export interface TaxPlan { f: number; u: number; im: number; ac: number }
export const NO_PLAN: TaxPlan = { f: 0, u: 0, im: 0, ac: 0 };
export const FILL_NAMES = ["Nothing extra", "The standard deduction", "The top of the 10% bracket", "The top of the 12% bracket", "The top of the 22% bracket", "The top of the 24% bracket"];
export const UNTIL_NAMES = ["Don't convert, only draw it", "Until Social Security starts", "Until required withdrawals start"];
export const samePlan = (a: TaxPlan, b: TaxPlan) => a.f === b.f && (a.f === 0 || (a.u === b.u && a.im === b.im && a.ac === b.ac));
export const planOf = (pr: Profile): TaxPlan => (pr.taxPlan ? { f: pr.taxPlan.f, u: pr.taxPlan.u, im: pr.taxPlan.im, ac: pr.taxPlan.ac } : NO_PLAN);

/** A plan in words: "Fill the 12% bracket, converting until Social Security starts". */
export function planWords(t: TaxPlan): string {
  if (!t.f) return "No conversions: brokerage first, then traditional, then Roth";
  const fill = ["", "the standard deduction", "the 10% bracket", "the 12% bracket", "the 22% bracket", "the 24% bracket"][t.f];
  const guards = [t.im ? "under Medicare's surcharge line from 63" : "", t.ac ? "under the marketplace credit's limit" : ""].filter(Boolean);
  return `Fill ${fill} with traditional money${t.u === 1 ? ", converting the rest until Social Security starts" : t.u === 2 ? ", converting the rest until required withdrawals start" : ", spending it, not converting"}${guards.length ? ", staying " + guards.join(" and ") : ""}`;
}

interface Start { year: number; off: number; W: Float64Array; FL: Float64Array; acc: { trad: number; roth: number; rothBasis: number; brok: number; brokBasis: number } | null }
export interface TaxSetup {
  C: PlPrepFull; starts: Start[]; T0: { c1: number; c2: number };
  /** The first year planned here, counted from retirement (the bridge's end for early retirees), its age and calendar year. */
  y0: number; age0: number; year0: number; years: number; bridged: boolean;
  /** Any years with marketplace cover, and any reaching 63 (when the guards matter). */
  hasAca: boolean; hasIrmaa: boolean;
}

const setups = new Map<string, TaxSetup | null>();

/** Everything a run needs, from the plan: null when there's no plan yet, or outside the US. */
export function taxSetup(pr: Profile, entries: Entry[], R: Results = results(pr, entries)): TaxSetup | null {
  if (pr.state === OUTSIDE_US || R.abroad || !R.S || !R.ddPlan || pr.p1.by == null || pr.p1.retire == null) return null;
  const d = drawdownFor(pr, R.ddPlan), early = earlyRetirees(pr)[0];
  const budget = early ? bridgeBudget(pr, R) : null, bIn = early ? bridgeFor(pr, entries, R) : null;
  const S = R.S, mix = retireMix(pr);
  const key = JSON.stringify([d, mix, S.key, S.T, bIn, budget?.steady]);
  if (setups.has(key)) return setups.get(key)!;
  const out = build();
  if (setups.size > 12) setups.clear();
  setups.set(key, out);
  return out;

  function build(): TaxSetup | null {
    const { o, P: Pd } = drawdownSetup(d);
    if (!(o.years > 0) || !(Pd.initial > 0)) return null;
    // The years the bridge plans first, and each of its markets' balances at the end.
    let y0 = 0;
    const ends = new Map<number, Start["acc"]>();
    if (early && bIn) {
      const k = Math.round(early.from - (pr.p1.by! + pr.p1.retire!)), nB = Math.max(1, Math.ceil(UNLOCK - Math.round(early.retire)));
      y0 = Math.max(0, k + nB);
      const { run } = runBridge({ ...bridgeInput(bIn), ...(budget ? { budget } : {}) }, "hist", 0);
      if (run) for (const r of run.best.hist.runs) {
        const e = r.end;
        // Keyed by the drawdown's start: the bridge's start less the years before it.
        ends.set(r.start! - Math.max(0, k), { trad: e.trad, roth: e.roth, rothBasis: e.rothIn, brok: e.brok, brokBasis: e.bBasis });
      }
    }
    const years = o.years - y0;
    if (!(years > 0)) return null;
    const P0 = S.P as PlPlan & { extra?: number[]; work2?: { years: number } | null };
    const P = {
      ...P0, mix, years, strategy: "fixed",
      age1: P0.age1 + y0, age2: P0.age2 != null ? P0.age2 + y0 : null,
      ...(P0.extra ? { extra: P0.extra.slice(y0) } : {}),
      ...(P0.work2 ? { work2: { ...P0.work2, years: Math.max(0, P0.work2.years - y0) } } : {}),
    } as PlPlan;
    const C = plPrep(P) as PlPrepFull;
    const starts: Start[] = [];
    for (const w of ddWindows(o)) {
      if (w.month !== 1) continue;
      const off = w.year - (HIST_START as number) + y0;
      if (off < 0 || off + years > C.mix.n) continue;
      const acc = y0 > 0 ? ends.get(w.year) ?? null : null;
      if (y0 > 0 && !acc) continue;
      const rows = runDrawdown(o, w.seq, null, Pd).rows;
      // The withdrawal, and the floor under each year's spending: what the
      // strategy spends less the tax the plan sets aside for it, so a
      // conversion only uses that room.
      const W = new Float64Array(years), FL = new Float64Array(years);
      for (let y = 0; y < years; y++) {
        const r = rows[y + y0];
        W[y] = Math.max(0, r?.realWithdrawal ?? 0);
        FL[y] = Math.max(0, (r?.realSpend ?? 0) - S.taxYr);
      }
      starts.push({ year: w.year, off, W, FL, acc });
    }
    if (!starts.length) return null;
    let hasAca = false;
    const ca = (C as unknown as { acaGross: Float64Array }).acaGross;
    for (let y = 0; y < years; y++) if (ca[y] > 0) hasAca = true;
    return {
      C, starts, T0: { c1: S.T.c1, c2: S.T.c2 }, y0, age0: C.age1, year0: pr.p1.by! + pr.p1.retire! + y0, years, bridged: y0 > 0,
      hasAca, hasIrmaa: C.age1 + years > 63,
    };
  }
}

export interface StartRun { year: number; res: PlBudgetRun; total: number; out: number }
export interface TaxRuns { T: TaxPlan; runs: StartRun[] }

function prepFor(s: TaxSetup, st: Start): PlPrepFull {
  return st.acc ? { ...s.C, trad: st.acc.trad, roth: st.acc.roth, rothBasis: Math.min(st.acc.roth, st.acc.rothBasis), brok: st.acc.brok, brokBasis: Math.min(st.acc.brok, st.acc.brokBasis) } as PlPrepFull : s.C;
}

/** One plan in one market, year by year. */
export function taxDetail(s: TaxSetup, T: TaxPlan, year: number): { res: PlBudgetRun; rows: PlBudgetRow[] } | null {
  const st = s.starts.find((x) => x.year === year);
  if (!st) return null;
  const C = prepFor(s, st), K = plTactics(C, { ...s.T0, ...T }), out = { rows: [] as PlBudgetRow[] };
  const res = plRunBudget(C, K, C.mix.r, C.mix.pi, st.off, st.W, out, st.FL);
  return { res, rows: out.rows };
}

const runMemo = new WeakMap<TaxSetup, Map<string, TaxRuns>>();
/** One plan in every market. `total` is what it's judged on: everything
    spent over retirement plus what's left for heirs after their tax. */
export function taxRuns(s: TaxSetup, T: TaxPlan): TaxRuns {
  const key = [T.f, T.u, T.im, T.ac].join(","), memo = runMemo.get(s) ?? new Map<string, TaxRuns>();
  runMemo.set(s, memo);
  const hit = memo.get(key);
  if (hit) return hit;
  const runs = s.starts.map((st) => {
    const C = prepFor(s, st), K = plTactics(C, { ...s.T0, ...T });
    const res = plRunBudget(C, K, C.mix.r, C.mix.pi, st.off, st.W, null, st.FL);
    let out = 0;
    for (let y = 0; y < st.W.length; y++) out += st.W[y];
    return { year: st.year, res, total: res.spent + res.legacy, out };
  });
  const r = { T, runs };
  memo.set(key, r);
  return r;
}

const median = (a: number[]) => { const v = a.slice().sort((x, y) => x - y); return v.length ? v[Math.floor(v.length / 2)] : 0; };

export interface Compare {
  /** Medians across markets. */
  spent: number; legacy: number; tax: number; prem: number; conv: number;
  base: { spent: number; legacy: number; tax: number; prem: number };
  /** Markets where the plan left more (spent + for heirs) than no conversions, of all. */
  ahead: number; of: number; gain: number;
}
/** A plan against no conversions, market by market. */
export function compare(s: TaxSetup, T: TaxPlan): Compare {
  const A = taxRuns(s, T).runs, B = taxRuns(s, NO_PLAN).runs;
  const gains = A.map((a, i) => a.total - B[i].total);
  return {
    spent: median(A.map((a) => a.res.spent)), legacy: median(A.map((a) => a.res.legacy)), tax: median(A.map((a) => a.res.tax)),
    prem: median(A.map((a) => a.res.irmaa + a.res.aca)), conv: median(A.map((a) => a.res.conv)),
    base: { spent: median(B.map((b) => b.res.spent)), legacy: median(B.map((b) => b.res.legacy)), tax: median(B.map((b) => b.res.tax)), prem: median(B.map((b) => b.res.irmaa + b.res.aca)) },
    ahead: gains.filter((g) => g > 500).length, of: gains.length, gain: median(gains),
  };
}

/** The plans worth trying, simplest first. */
export function candidates(s: TaxSetup): TaxPlan[] {
  const out: TaxPlan[] = [NO_PLAN];
  for (let f = 1; f <= 5; f++) for (let u = 0; u <= 2; u++) for (const im of s.hasIrmaa && f >= 4 ? [0, 1] : [0]) for (const ac of s.hasAca ? [0, 1] : [0]) out.push({ f, u, im, ac });
  return out;
}

/** The plan that leaves the most over a lifetime (spent, and for heirs after
    their tax) in the median market, with how it does against no conversions. */
export function bestPlan(s: TaxSetup): { T: TaxPlan; median: number } {
  let best = NO_PLAN, top = -Infinity;
  for (const T of candidates(s)) {
    const m = median(taxRuns(s, T).runs.map((r) => r.total));
    // A plan has to beat the simpler ones by more than rounding to be worth it.
    if (m > top + 1000) { top = m; best = T; }
  }
  return { T: best, median: top };
}

export type MarketKey = "p90" | "p75" | "p50" | "p25" | "p10";
export const MARKETS: { k: MarketKey; q: number; name: string }[] = [
  { k: "p90", q: 0.9, name: "90th" }, { k: "p75", q: 0.75, name: "75th" }, { k: "p50", q: 0.5, name: "Median" }, { k: "p25", q: 0.25, name: "25th" }, { k: "p10", q: 0.1, name: "10th" },
];
/** The historical start each market follows: ranked, as the Bridge ranks
    them, by how much the strategy withdraws over these years. */
export function marketYear(s: TaxSetup, k: MarketKey): number {
  const sum = (st: Start) => st.W.reduce((a, v) => a + v, 0);
  const v = s.starts.slice().sort((a, b) => sum(a) - sum(b));
  const q = MARKETS.find((m) => m.k === k)!.q;
  return v[Math.min(v.length - 1, Math.floor(v.length * q))].year;
}

/** Each year's taxable-income lines, in income before deductions: where the
    deduction (with the senior additions) ends, and where each bracket ends. */
export function bracketLines(s: TaxSetup, row: PlBudgetRow): { name: string; at: number }[] {
  const Y = yearData(), st = s.C.status, b = Y.fed[st];
  const ded = Y.fedStd[st] + Y.seniorAddl[st] * row.seniors + (row.seniors > 0 ? row.seniors * Math.max(0, Y.seniorBonus.amount - Y.seniorBonus.rate * Math.max(0, row.agi - Y.seniorBonus.start[st])) : 0);
  // Each line with the rate of the band under it.
  const pct = (r: number) => Math.round(r * 100) + "%";
  return [
    { name: "0%", at: ded },
    ...[1, 2, 3, 4].map((k) => ({ name: pct(b[k - 1][1]), at: ded + b[k][0] })),
  ];
}

/** The rate above bracket line k (k from bracketLines: 0 the deduction's). */
export const rateAbove = (s: TaxSetup, k: number) => Math.round(yearData().fed[s.C.status][k][1] * 100) + "%";

/** The fill level a plan aims at, as taxable income (for words). */
export const fillLevel = (s: TaxSetup, f: number) => plFillLevel(s.C.status, f);

/** A year's income split the way the tax sees it, stacked: pay and pensions,
    the taxed part of Social Security, required withdrawals, other traditional
    withdrawals, conversions, then capital gains on top. */
export function incomeParts(r: PlBudgetRow) {
  const other = Math.max(0, r.trad + r.reinvest - r.rmd), tss = Math.max(0, r.agi - r.ord - r.gain);
  const pay = Math.max(0, r.ord - r.rmd - other - r.conv);
  return { pay, tss, rmd: r.rmd, other, conv: r.conv, gain: r.gain };
}
