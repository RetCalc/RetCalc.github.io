/* The saved scenarios for the redesign's numbers check. Each one feeds the
   tool's own input parsing (tools/<tool>/model.ts) and the engine the screen
   calls, with the same functions in the same order, so a change to either
   shows up. Screens (.tsx) aren't loaded: the redesign may rewrite them, and
   the e2e checks cover what they display.

   `out` is what a person reads off the page (the headline figures); the check
   also fingerprints every field of the full results, so a change anywhere
   in them is caught. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const T = await import("@/lib/engine/typed");
const D = await import("@/lib/engine/typed-drawdown");
const E = await import("@/lib/engine/core.js");
const { BASIC_INPUTS, basicInput } = await import("@/tools/basic/model");
const { ADVANCED_DEFAULTS, advancedPlan, solvePlan } = await import("@/tools/advanced/model");
const { TAX_DEFAULTS, taxInput, runTax } = await import("@/tools/tax/model");
const { ROTH_DEFAULTS, rothInput } = await import("@/tools/roth/model");
const { parseNum } = await import("@/lib/format");

/* The Drawdown screen's defaults (DD_STATE in tools/drawdown/fields.ts),
   read from the file's text: fields.ts also imports the React tool state,
   which plain Node can't load. */
function drawdownDefaults() {
  const src = readFileSync(join(WEB, "tools/drawdown/fields.ts"), "utf8");
  const block = src.slice(src.indexOf("export const DD_STATE"), src.indexOf("];", src.indexOf("export const DD_STATE")));
  const d = { incomeItems: [], expenseItems: [], pathStages: [], floorSteps: [] };
  for (const m of block.matchAll(/\["(\w+)",\s*"\w+",\s*"\w+",\s*([^\]]+?)\]/g)) d[m[1]] = JSON.parse(m[2]);
  if (Object.keys(d).length < 40) throw new Error("couldn't read DD_STATE from tools/drawdown/fields.ts; update drawdownDefaults()");
  return d;
}

/* ---- each tool, as its screen runs it ---- */

function basic(fields) {
  const p = basicInput({ ...BASIC_INPUTS, ...fields });
  const R = T.projectBasic(p);
  return { full: R, out: { atRetirement: R.fv, invested: R.invested, growth: R.growth, yearlyIncome: R.wd, monthlyIncome: R.afterTaxMo } };
}

/* compute() in tools/advanced/Advanced.tsx, which lives in the screen file. */
function advanced(fields) {
  const s = { ...ADVANCED_DEFAULTS, ...fields };
  const P = advancedPlan(s, null), p = P.p;
  const R = T.project(p);
  const target = parseNum(s.target);
  const S = T.goalSolve(solvePlan(P, s.solveFor, target), s.solveFor, target);
  const C = T.coastFire(p, S.portFuture);
  const Y = T.solveYears(p, S.portToday);
  const feeCost = p.fees > 0 ? T.project({ ...p, nominal: p.gross }).fv - R.fv : 0;
  return {
    full: { plan: p, R, S, C, Y, feeCost, B: P.B },
    out: { atRetirement: R.fv, todaysDollars: R.fvReal, firstYearAfterTax: R.afterTax, monthlyAfterTax: R.afterTaxMo,
      goalPortfolioToday: S.portToday, goalPerYear: S.perYear, feeCost },
  };
}

function drawdown(fields, mc) {
  const d = { ...drawdownDefaults(), ...fields };
  const o = D.ddOptsFromState(d), P = D.ddPrep(o), comfort = D.ddComfort(o, P);
  if (mc) {
    // The job the screen sends its worker (lib/engine/jobs.ts).
    const M = E.ddJob("mc", { o, trials: mc.trials, seed: mc.seed, comfort });
    return { full: M, out: { trials: mc.trials, seed: mc.seed, successRate: M.successRate, medianEnd: M.medianEnd,
      p10End: M.p10End, p90End: M.p90End } };
  }
  const H = D.historicalBacktest(o);
  const sc = D.ddScorecard(H.runs, o, comfort, H.prep.path);
  return {
    full: { o, H, sc },
    out: { periods: H.total, survived: H.survived, successRate: H.successRate, medianEnd: H.medianEnd,
      worstEnd: H.worstEnd, bestEnd: H.bestEnd, failYears: H.failYears.length,
      firstFailStart: H.firstFail ? `${H.firstFail.startYear}-${H.firstFail.startMonth}` : null, lowestSpendRatio: sc.lowRatio },
  };
}

function tax(fields) {
  const R = runTax(taxInput({ ...TAX_DEFAULTS, ...fields }));
  return {
    full: R,
    out: { federal: R.federal, state: R.state, fica: R.fica, total: R.total, net: R.net, takeHome: R.takeHome,
      effectiveRate: R.effTotal, marginal: R.marginal },
  };
}

function roth(fields) {
  const inp = rothInput({ ...ROTH_DEFAULTS, ...fields });
  const withConv = T.runRoth(inp, true), without = T.runRoth(inp, false);
  const pick = (r) => ({ lifeTax: r.lifeTax, lifeTaxPV: r.lifeTaxPV, lifeIrmaa: r.lifeIrmaa, totalConv: r.totalConv,
    peakRMD: r.peakRMD, endAfterTax: r.endAfterTax });
  return { full: { withConv, without }, out: { convert: pick(withConv), noConvert: pick(without) } };
}

/* ---- the scenarios ---- */

export const SCENARIOS = [
  { tool: "Basic", name: "worked example: 30 to 65, $10,000 saved, $500/month, balanced 4.5%",
    run: () => basic({ age: "30", retire: "65", saved: "10,000", contrib: "500", period: "Monthly", risk: "0.045" }),
    expect: { atRetirement: 537803 } },
  { tool: "Basic", name: "older saver, conservative 3%",
    run: () => basic({ age: "52", retire: "67", saved: "340,000", contrib: "1,500", risk: "0.03" }) },
  { tool: "Basic", name: "weekly $125, aggressive 7%",
    run: () => basic({ period: "Weekly", contrib: "125", risk: "0.07" }) },

  { tool: "Advanced", name: "defaults",
    run: () => advanced({}) },
  { tool: "Advanced", name: "monthly, 25 years, 0.5% fees, glide to 5% over 10 years, solve portfolio needed",
    run: () => advanced({ period: "Monthly", contrib: "1,200", years: "25", fees: "0.5", glideOn: true, glideEnd: "5",
      glideYears: "10", solveFor: "Portfolio Needed", target: "1,500,000" }) },

  { tool: "Drawdown", name: "defaults: $1M, 30 years, 60% stocks, fixed 4%, history",
    run: () => drawdown({}) },
  { tool: "Drawdown", name: "guardrails 5%, 40 years, couple with estimated Social Security, history",
    run: () => drawdown({ strategy: "guardrails", rate: 5, years: 40, ssMode: "est", ssWho: "couple", retireAge: "60" }) },
  { tool: "Drawdown", name: "defaults, Monte Carlo 1,000 trials, seed 12345",
    run: () => drawdown({}, { trials: 1000, seed: 12345 }) },

  { tool: "Income Tax", name: "defaults: single, Illinois, $100,000",
    run: () => tax({}) },
  { tool: "Income Tax", name: "married, California, $180,000 + $95,000, $23,000 pre-tax, itemized $40,000",
    run: () => tax({ status: "m", state: "CA", gross: "180,000", gross2: "95,000", pre: "23,000", dedType: "item", item: "40,000" }) },
  { tool: "Income Tax", name: "retirement mode defaults",
    run: () => tax({ mode: "retire" }) },

  { tool: "Roth Conversion", name: "defaults: married, fill the 22% bracket",
    run: () => roth({}) },
  { tool: "Roth Conversion", name: "single, Texas, $50,000 a year from 65 to 72",
    run: () => roth({ status: "s", state: "TX", age: "65", strategy: "fix", fixed: "50,000", startAge: "65", stopAge: "72" }) },
];
