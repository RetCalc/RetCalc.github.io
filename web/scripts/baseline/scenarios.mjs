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
const TP = await import("@/lib/engine/typed-plan");
const { MORTGAGE_DEFAULTS, mortgageInput } = await import("@/tools/mortgage/model");
const { DEBT_DEFAULTS, debtList } = await import("@/tools/debt/model");
const { COLLEGE_DEFAULTS, collegeInput, collegeMonthly } = await import("@/tools/college/model");
const { BUDGET_DEFAULTS, budgetTotals } = await import("@/tools/budget/model");
const { HC_IRMAA, HC_PARTD_BASE, HC_MEDIGAP_LOW, HC_MEDIGAP_HIGH, irmaaTier } = await import("@/tools/healthcare/model");
const { FIRE_DEFAULTS, fireInput, fireSolve } = await import("@/tools/fire/model");
const { BRIDGE_DEFAULTS, bridgeInput } = await import("@/tools/bridge/model");
const { runBridge, bridgeScenarios, firstYearAfter } = await import("@/tools/bridge/run");
const { BT_DEFAULTS, runBacktest, decadeInflation } = await import("@/tools/backtest/model");
const { OP_DEFAULTS, opToolIn } = await import("@/tools/optimizer/model");
const { STAGES_DEFAULTS, stagesPlan, stagesTargetRate, effectiveStages, stageFields } = await import("@/tools/stages/model");
const G = await import("@/tools/guide/calc");

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

const FIRST_SCENARIOS = [
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

/* ---- the other tools ----
   Where a screen does arithmetic of its own between the model and the
   engine (Stages, Healthcare, Rent vs. Buy, FIRE's history slider, Debt's
   "$100 more" line, Mortgage's extra-payment comparison), it's copied here
   from the screen named, as Advanced's compute() is. */

function mortgageTool(fields) {
  const m = mortgageInput({ ...MORTGAGE_DEFAULTS, ...fields });
  const R = T.mortgage(m);
  // Mortgage.tsx: the same loan without extras, and the refinance comparison.
  const base = R.extraActive ? T.mortgage({ ...m, extraMonthly: 0, extraOnce: 0, extraOnceMonth: 0, recast: false }) : null;
  const RF = m.refiOn ? T.refiCompare(m, { rate: m.refiRate, term: m.refiTerm, cost: m.refiCost }) : null;
  return {
    full: { R, base, RF },
    out: { loan: R.loan, monthlyPI: R.pi, monthlyTotal: R.total, totalInterest: R.totalInterest, payoffMonth: R.payoffMonth,
      pmiPaid: R.pmiPaid, recastPI: R.recastPI, interestSaved: base ? Math.max(0, base.totalInterest - R.totalInterest) : null,
      monthsSooner: base ? base.payoffMonth - R.payoffMonth : null },
  };
}

function debt(fields) {
  const s = { ...DEBT_DEFAULTS, ...fields };
  const debts = debtList(s.rows), extra = parseNum(s.extra);
  // Debt.tsx: both orders and minimums only, the warning, and "$100 more a month".
  const av = T.debtRun(debts, extra, "avalanche"), sn = T.debtRun(debts, extra, "snowball"), mn = T.debtRun(debts, 0, "min");
  const under = T.debtUnderwater(debts).map((u) => u.desc);
  const bump = T.debtRun(debts, extra + 100, s.mode);
  const pick = (r) => r && { months: r.monthsTotal, totalInterest: r.totalInterest, totalPaid: r.totalPaid, stalled: r.stalled };
  return { full: { av, sn, mn, under, bump }, out: { avalanche: pick(av), snowball: pick(sn), minimumsOnly: pick(mn), underwater: under.join(", "), plus100: pick(bump) } };
}

function rentBuy(fields) {
  // RentBuy.tsx keeps its defaults and parsing in the screen.
  const s = { price: "450,000", down: "20", rate: String(T.MORT_RATE_30), term: "30", propTax: "1.1", ins: "1,800", maint: "1",
    close: "3", sell: "3", rent: "1,800", rentInc: "3.2", appr: "4", invest: "7", horizon: "30", gainTax: "15", status: "m", ...fields };
  const n = (k) => parseNum(s[k]);
  const inp = {
    price: n("price"), downPct: n("down"), rate: n("rate"), term: parseFloat(s.term), propTax: n("propTax"),
    ins: n("ins"), maint: n("maint"), closePct: n("close"), sellPct: n("sell"), rent: n("rent"), rentInc: n("rentInc"),
    appr: n("appr"), invest: n("invest"),
    horizon: Math.min(40, Math.max(1, Math.round(n("horizon")))),
    gainTax: Math.min(50, Math.max(0, n("gainTax") || 0)),
    status: s.status === "s" ? "s" : "m",
  };
  const R = inp.price > 0 ? T.rentBuyCalc(inp) : null;
  const last = R.years[R.years.length - 1];
  return { full: R, out: { breakEven: R.breakEven, monthlyBuy: R.monthlyBuy, monthlyPI: R.pi, initialInvest: R.initialInvest, lastYear: last } };
}

function college(fields) {
  const inp = collegeInput({ ...COLLEGE_DEFAULTS, ...fields });
  const multi = inp.kids.length > 1;
  const R = multi ? T.collegePlanCalc(inp) : T.collegeSavingsCalc(inp);
  return {
    full: R,
    out: multi ? { monthly: collegeMonthly(inp), totalFuture: R.totalFuture, pvToday: R.pvToday, phases: R.phases.length }
      : { monthly: collegeMonthly(inp), totalFuture: R.totalFuture, targetAtStart: R.targetAtStart, shortfall: R.shortfall },
  };
}

function budget(fields, household) {
  const s = { ...BUDGET_DEFAULTS, ...fields };
  const totals = budgetTotals(s);
  // Budget.tsx: the household's take-home pay, filled in as income.
  let net = null;
  if (household) {
    const h = household, married = h.status === "m", inc2 = married ? h.income2 ?? 0 : 0;
    net = T.computeTax({ status: married ? "m" : "s", gross: h.income, gross2: inc2, pre: 0, dedType: "std", item: 0, state: h.state }).net;
  }
  return { full: { totals, net }, out: { ...totals, householdTakeHome: net } };
}

/* Healthcare.tsx works out everything in the screen; this is that code. */
function healthcare(fields) {
  const s = { retireAge: "62", status: "s", household: "2", spouseAge: "62", state: "IL", income: "", ss: "", premium: "", ...fields };
  const retireAge = Math.round(parseNum(s.retireAge)) || 62;
  const joint = s.status === "m";
  const household = parseInt(s.household) || (joint ? 2 : 1);
  const state = s.state || "IL";
  const manualPremium = parseNum(s.premium) || 0;
  const magi = parseNum(s.income) || 0;
  const ssGross = parseNum(s.ss) || 0;
  let ssTaxed = 0;
  for (let it = 0; it < 150 && ssGross > 0; it++) ssTaxed = T.ssTaxable(ssGross, Math.max(0, magi - ssTaxed), joint ? "m" : "s").taxable;
  const acaMagi = magi + Math.max(0, ssGross - ssTaxed);
  const bridgeYears = Math.max(0, 65 - retireAge);
  const fpl = T.hcFPL(household);
  const pctFPL = acaMagi > 0 ? acaMagi / fpl : 0;
  const acaAge = Math.min(64, Math.max(21, retireAge));
  const spouseAge = Math.round(parseNum(s.spouseAge)) || retireAge;
  const spouseOn = joint && spouseAge < 65;
  const acaAge2 = Math.min(64, Math.max(21, spouseAge));
  const kids = Math.min(3, Math.max(0, household - (joint ? 2 : 1)));
  const childPrem = ((T.HC_STATE_PREMIUM_40[state] || 500) / T.HC_AGE40_MULT) * 0.765;
  const grossMonthly = manualPremium > 0 ? manualPremium
    : T.hcGrossPremium(state, acaAge, 0) + (spouseOn ? T.hcGrossPremium(state, acaAge2, 0) : 0) + kids * childPrem;
  const std = T.hcCalcACA(acaMagi, grossMonthly, pctFPL, false);
  const enh = T.hcCalcACA(acaMagi, grossMonthly, pctFPL, true);
  const tier = irmaaTier(magi, joint);
  const [, , partB, partDIrmaa] = HC_IRMAA[tier];
  const partD = HC_PARTD_BASE + partDIrmaa;
  const medicare = { tier, partB, partD, totalLow: partB + partD + HC_MEDIGAP_LOW, totalHigh: partB + partD + HC_MEDIGAP_HIGH };
  return {
    full: { acaMagi, fpl, grossMonthly, std, enh, medicare },
    out: { bridgeYears, acaMagi, pctFPL, benchmarkMonthly: grossMonthly, netPremium: std.eligible ? std.net : grossMonthly, credit: std.credit,
      enhancedNet: enh.net, irmaaTier: tier, medicareLow: medicare.totalLow, medicareHigh: medicare.totalHigh },
  };
}

function fire(fields) {
  const p = fireInput({ ...FIRE_DEFAULTS, ...fields });
  const S = fireSolve(p);
  // Fire.tsx: with the history chart, the success-rate slider's year.
  let cr = null, histYears = null;
  if (fields.chart === "hist") {
    cr = p.mode === "coast" ? T.fiComputeCoastCrossings(p) : T.fiComputeCrossings(p, S.maxYears);
    if (cr) histYears = T.fiYearsFromCrossings(cr.crossings, cr.total, p.successRate);
  }
  return { full: { S, cr }, out: { yearsUntil: S.fireYear, realThen: S.real, nominalThen: S.nominal, contribs: S.contribs, target: p.target, histYears } };
}

function bridge(fields, mode = "hist", seed = 1) {
  const { ctx, run } = runBridge(bridgeInput({ ...BRIDGE_DEFAULTS, ...fields }), mode, seed);
  const best = run.best;
  const sc = bridgeScenarios(ctx, best);
  const after = firstYearAfter(ctx, best.steady.end);
  return {
    full: { ctx, run, sc, after },
    out: { bestPlan: best.name, holds: best.score.hold, taxCost: best.score.cost, leftAt59: best.score.left,
      plans: run.live.map((p) => `${p.name}: ${p.score.hold}%`).join("; "), firstYearGross: after.gross },
  };
}

function backtest(fields) {
  const B = runBacktest({ ...BT_DEFAULTS, ...fields });
  return { full: { B, dec: decadeInflation(B) },
    out: { cagr: B.cagr, realCagr: B.realCagr, vol: B.vol, endBal: B.endBal, endReal: B.endReal, maxDrawdown: B.maxDD, rebalances: B.rebalances } };
}

function stages(fields) {
  // compute() in tools/stages/Stages.tsx, which lives in the screen file.
  const s = { ...STAGES_DEFAULTS, ...fields };
  const P = stagesPlan(s, null);
  const R = T.projectSeries(P.g, P.eff);
  const target = parseNum(s.target);
  const rate = stagesTargetRate(P, s.solveFor, target);
  const portToday = s.solveFor === "After-Tax Withdrawal" ? target / (P.g.withdrawal * (1 - rate)) : target;
  const F = P.stages.length ? T.finalStageSolve(P.g, P.eff, portToday) : null;
  const feeCost = (P.g.fees || 0) > 0 ? T.projectSeries(P.g, effectiveStages({ ...P.g, fees: 0 }, P.stages)).fv - R.fv : 0;
  return { full: { P, R, F, portToday, rate, feeCost },
    out: { atRetirement: R.fv, todaysDollars: R.fvReal, firstYearAfterTax: R.afterTax, monthlyAfterTax: R.afterTaxMo, portfolioNeeded: portToday, feeCost } };
}

/* The Optimizer's full search, as its worker runs it (plOptimize to the end). */
function optimizer(fields, goal) {
  const P = TP.plAtRetire(opToolIn({ ...OP_DEFAULTS, ...fields }));
  const g = TP.plOptimize(P, goal);
  let s, done = null;
  while (!(s = g.next()).done) if (s.value.type === "done") done = s.value;
  const { ms, ...R } = done; // how long it took isn't a result
  return { full: R, out: { tried: R.tried, windows: R.windows, bestSpend: R.best.spend, bestStats: R.best.stats, steps: R.steps.length, alts: R.alts.length } };
}

/* The readiness guide: its plan, score and savings target from a set of answers. */
function guide(a) {
  const S = G.sim(a);
  const sc = G.score(a);
  return { full: { S, sc, need: G.need(a, S), strats: G.strats(a, S) },
    out: { atRetirement: S.fv, success: S.success, coverage: S.coverage, taxPerYear: S.taxYr, score: sc.score, needAtRetirement: G.need(a, S) } };
}

const GUIDE_COUPLE = { status: "m", age: 40, spouseAge: 38, retire: 62, state: "IL", income: 120000, income2: 60000, saved: 250000,
  contrib: 1500, employer: 300, risk: 0.045, retSpend: 80000, cash: 30000, debtHas: "no", home: "own", spend: 6000 };

export const MORE_SCENARIOS = [
  { tool: "Mortgage", name: "defaults: $450,000, 20% down, 30 years",
    run: () => mortgageTool({}) },
  { tool: "Mortgage", name: "10% down with PMI, $300/month extra, $10,000 at month 24, recast, refinance to 5.5%",
    run: () => mortgageTool({ downPct: "10", downAmt: "45,000", pmi: "0.6", extrasOn: "1", extraMo: "300", extraOnce: "10,000", extraWhen: "24",
      recast: "1", refiRate: "5.5", refiTerm: "15", refiCost: "4,000" }) },

  { tool: "Debt Payoff", name: "defaults: four debts, $300 extra, avalanche",
    run: () => debt({}) },
  { tool: "Debt Payoff", name: "snowball, $0 extra, one debt whose minimum doesn't cover interest",
    run: () => debt({ mode: "snowball", extra: "0", rows: [...DEBT_DEFAULTS.rows, { desc: "Payday loan", balance: "5,000", apr: "36", min: "100" }] }) },

  { tool: "Rent vs. Buy", name: "defaults: $450,000 home vs $1,800 rent, 30 years",
    run: () => rentBuy({}) },
  { tool: "Rent vs. Buy", name: "$700,000 home vs $3,000 rent, 7 years, single, 2% appreciation",
    run: () => rentBuy({ price: "700,000", rent: "3,000", horizon: "7", status: "s", appr: "2" }) },

  { tool: "College", name: "defaults: one child, public in-state, 18 years",
    run: () => college({}) },
  { tool: "College", name: "two children (private in 10 years, Ivy in 4), $40,000 saved",
    run: () => college({ saved: "40,000", kids: [
      { preset: "59000", cost: "59,000", years: "10", collegeYrs: "4" }, { preset: "82000", cost: "82,000", years: "4", collegeYrs: "4" }] }) },

  { tool: "Budget", name: "$6,500/month income with typical rows",
    run: () => budget({ income: "6,500", incomeFreq: 12, rows: BUDGET_DEFAULTS.rows.map((r) => ({ ...r, amount: (
      { "Rent / Mortgage": "2,100", "Utilities": "220", "Groceries": "650", "Car insurance": "140", "Travel": "4,000", "Savings & investments": "500" })[r.desc] ?? "0" })) }) },
  { tool: "Budget", name: "income filled from the household: married, $150,000 + $70,000, California",
    run: () => budget({}, { status: "m", income: 150000, income2: 70000, state: "CA" }) },

  { tool: "Healthcare", name: "single, retire at 60, $55,000 MAGI, Illinois",
    run: () => healthcare({ retireAge: "60", status: "s", household: "1", income: "55,000" }) },
  { tool: "Healthcare", name: "couple, retire at 58, $90,000 MAGI + $30,000 Social Security, Florida, one child",
    run: () => healthcare({ retireAge: "58", status: "m", household: "3", spouseAge: "56", state: "FL", income: "90,000", ss: "30,000" }) },
  { tool: "Healthcare", name: "couple over the 400% cliff and in an IRMAA tier",
    run: () => healthcare({ retireAge: "63", status: "m", household: "2", spouseAge: "66", state: "NY", income: "260,000" }) },

  { tool: "FIRE", name: "defaults: $40,000 a year at 4%",
    run: () => fire({}) },
  { tool: "FIRE", name: "Coast FIRE, $150,000 saved at 35, history chart at 80% success",
    run: () => fire({ mode: "coast", curAge: "35", initial: "150,000", chart: "hist", successRate: "80" }) },

  { tool: "Early Retirement Bridge (and /72t)", name: "defaults: 50, married, $60,000 spending, history",
    run: () => bridge({}) },
  { tool: "Early Retirement Bridge (and /72t)", name: "56, single, rule of 55, fill to 12%, Monte Carlo seed 7",
    run: () => bridge({ age: "56", status: "s", household: "1", k401: "500,000", fill: "b12", spend: "70,000" }, "mc", 7) },

  { tool: "Portfolio Backtest", name: "defaults: 80/20, rebalanced yearly, 1926-2025",
    run: () => backtest({}) },
  { tool: "Portfolio Backtest", name: "60/30/10 with small-cap value, 5% drift bands, 1966-2000",
    run: () => backtest({ stock: "60", sv: "10", cash: "10", rebal: "band", rebalBand: "5", from: "1966", to: "2000" }) },

  { tool: "Stages", name: "defaults: two stages",
    run: () => stages({}) },
  { tool: "Stages", name: "three stages with fees, a glide and a portfolio target",
    run: () => stages({ fees: "0.4", solveFor: "Portfolio Needed", target: "2,000,000", stages: [
      ...STAGES_DEFAULTS.stages,
      stageFields({ years: 8, contrib: 0, period: "Monthly", growth: 0, nominal: 0.07, vol: 0.1, glide: { on: true, endRate: 0.05, years: 5 } }),
    ] }) },

  { tool: "Plan Optimizer", name: "defaults, goal: leave the most",
    run: () => optimizer({}, "legacy") },
  { tool: "Plan Optimizer", name: "single, from today at 50, goal: spend the most",
    run: () => optimizer({ mode: "now", status: "s", age: "50", retire: "60", spend: "70,000", ss2: "0" }, "spend") },

  { tool: "Guide", name: "couple, 40 and 38, retiring at 62",
    run: () => guide(GUIDE_COUPLE) },
  { tool: "Guide", name: "single, 55, little saved, retiring at 67",
    run: () => guide({ status: "s", age: 55, retire: 67, state: "TX", income: 70000, saved: 60000, contrib: 600, employer: 200, risk: 0.03,
      retSpend: 45000, cash: 5000, debtHas: "no", home: "rent", spend: 4200 }) },
];

export const SCENARIOS = [...FIRST_SCENARIOS, ...MORE_SCENARIOS];
