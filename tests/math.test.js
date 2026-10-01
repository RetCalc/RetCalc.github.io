/* Calculation tests for RetCalc. Run with: python3 tests/run.py
   (it bundles the engine out of index.html in front of this file).

   Each check compares the site's math against something independent: a
   closed-form formula, a published IRS/SSA/CMS figure, or a second, plain
   re-implementation written here. A few pin a result that was verified by
   hand in the September 2026 audit, so a later change can't move it
   without someone noticing. When a law or dataset changes on purpose
   (next year's brackets, a new year of market data), update the expected
   value here in the same commit. */

var out = typeof print === "function" ? print : function (s) { console.log(s); };
var failures = 0, passes = 0, groupFails = 0, groupName = "";
function group(name) { endGroup(); groupName = name; groupFails = 0; }
function endGroup() {
  if (groupName) out((groupFails ? "  FAIL  " : "  ok    ") + groupName);
}
function ok(cond, label, detail) {
  if (cond) { passes++; return; }
  failures++; groupFails++;
  out("        x " + label + (detail ? ": " + detail : ""));
}
function near(got, want, tol, label) {
  ok(Math.abs(got - want) <= tol, label, "got " + got + ", expected " + want + " (within " + tol + ")");
}
function eq(got, want, label) { ok(got === want, label, "got " + JSON.stringify(got) + ", expected " + JSON.stringify(want)); }
function seqFrom(start, years) {
  var s = [];
  for (var k = 0; k < years; k++) {
    var i = start - HIST_START + k;
    s.push({ stock: HIST_STOCK[i], bond: HIST_BOND[i], infl: HIST_INFL[i], cape: HIST_M_CAPE[i * 12] });
  }
  return s;
}

/* Each page's "about this tool" article works an example through the
   calculator. The figures it quotes are computed in the article groups at
   the end and must appear in its text, so an example can't drift from what
   the calculator shows. */
function dollars(x) { return "$" + String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
function pct1(x) { return (Math.round(x * 1000) / 10).toFixed(1) + "%"; }
function says(page, s) { ok(ARTICLES[page].indexOf(s) >= 0, "/" + page + " article says " + s); }

out("RetCalc calculation tests");

/* ---------------- accumulation engine ---------------- */
group("Future value: project() matches the annuity formula");
(function () {
  var p = { period: "Monthly", years: 30, initial: 10000, contrib: 500, growth: 0, nominal: .07,
            inflation: .03, withdrawal: .04, taxRate: .1 };
  var R = project(p), r = Math.pow(1.07, 1 / 12) - 1, n = 360;
  near(R.fv, 10000 * Math.pow(1 + r, n) + 500 * (Math.pow(1 + r, n) - 1) / r, .01, "FV, no contribution growth");
  near(R.fvReal, R.fv / Math.pow(1.03, 30), .01, "today's dollars");
  p.growth = .03; R = project(p);
  var b = 10000;
  for (var i = 1; i <= 360; i++) b = b * (1 + r) + 500 * Math.pow(1.03, Math.ceil(i / 12) - 1);
  near(R.fv, b, .01, "FV with yearly contribution raises");
  near(R.years[0].contrib, 6000, .001, "year 1 holds 12 contributions");
  eq(R.years.length, 30, "one row per year");
})();

group("Solvers: goalSolve, solveYears and coastFire agree with project()");
(function () {
  var p = { period: "Monthly", years: 30, initial: 10000, contrib: 500, growth: .03, nominal: .07,
            inflation: .03, withdrawal: .04, taxRate: .1 };
  var G = goalSolve(p, "Portfolio", 2000000);
  near(project(Object.assign({}, p, { contrib: G.perPeriod })).fvReal, 2000000, .01, "solved contribution hits the target");
  p.glide = { on: true, years: 10, endRate: .04 };
  G = goalSolve(p, "Portfolio", 2000000);
  near(project(Object.assign({}, p, { contrib: G.perPeriod })).fvReal, 2000000, .01, "same under a glide path");
  p.glide = { on: false };
  var Y = solveYears(p, 1500000, 100);
  ok(project(Object.assign({}, p, { years: Y.years })).fvReal >= 1500000, "solved timeline reaches the target");
  ok(project(Object.assign({}, p, { years: Y.years - .1 })).fvReal < 1500000, "and not sooner");
  var target = 300000 * Math.pow(1.03, 30);
  var C = coastFire(p, target);
  eq(C.state, "reachable", "coast point found");
  var coasted = C.balance * Math.pow(1.07, (360 - C.periods) / 12);
  ok(coasted >= target * .999, "coasting from there reaches the goal", coasted + " vs " + target);
})();

group("Monte Carlo: lognormal draws keep the mean and volatility entered");
(function () {
  var L = lognormalParams(.07, .15, 12);
  near(Math.exp(12 * L.m + 12 * L.s * L.s / 2), 1.07, 1e-9, "annual mean return");
  near(Math.sqrt((Math.exp(12 * L.s * L.s) - 1) * Math.exp(2 * 12 * L.m + 12 * L.s * L.s)), .15, 1e-9, "annual volatility");
  var g = { initial: 10000, inflation: .03, withdrawal: .04, taxRate: .1 };
  var st = [{ period: "Monthly", years: 30, contrib: 500, growth: .03, nominal: .07, vol: 0 }];
  near(monteCarlo(g, st, 20, 1).median, projectSeries(g, st).fvReal, .01, "zero volatility equals the projection");
  st[0].vol = .15;
  eq(monteCarlo(g, st, 200, 42).median, monteCarlo(g, st, 200, 42).median, "same seed, same result");
})();

/* ---------------- tax ---------------- */
group("Tax data: 2026 federal figures (Rev. Proc. 2025-32) and table shape");
(function () {
  eq(FED_STD.s, 16100, "standard deduction, single");
  eq(FED_STD.m, 32200, "standard deduction, joint");
  eq(FED_2026.s[1][0], 12400, "12% bracket starts, single");
  eq(FED_2026.m[6][0], 768700, "37% bracket starts, joint");
  eq(FICA.ssCap, 184500, "Social Security wage base");
  eq(LTCG_2026.s[0], 49450, "0% gain band, single");
  eq(SENIOR_ADDL.s, 2050, "age-65 add-on, single");
  ["s", "m"].forEach(function (k) {
    var b = FED_2026[k];
    for (var i = 1; i < b.length; i++) ok(b[i][0] > b[i - 1][0] && b[i][1] > b[i - 1][1], "federal brackets ascend (" + k + ")");
  });
  Object.keys(STATES).forEach(function (code) {
    var S = STATES[code];
    if (S.none) return;
    ["s", "m"].forEach(function (k) {
      var b = S.b[k];
      ok(b && b[0][0] === 0, code + " brackets start at 0 (" + k + ")");
      for (var i = 1; b && i < b.length; i++) ok(b[i][0] > b[i - 1][0], code + " thresholds ascend (" + k + ")");
    });
  });
})();

group("Income tax: federal, FICA and state on wages");
(function () {
  var T = computeTax({ status: "s", gross: 100000, pre: 0, dedType: "std", item: 0, state: "TX" });
  near(T.federal, 13170, .01, "single $100k: 1,240 + 4,560 + 7,370");
  near(T.fica, 7650, .01, "FICA 7.65% below the wage base");
  T = computeTax({ status: "m", gross: 200000, gross2: 0, pre: 0, dedType: "std", item: 0, state: "TX" });
  near(T.federal, 26340, .01, "joint $200k");
  T = computeTax({ status: "m", gross: 200000, gross2: 200000, pre: 0, dedType: "std", item: 0, state: "TX" });
  near(T.fica, 2 * 184500 * .062 + 400000 * .0145 + 150000 * .009, .01, "two earners: wage base per person, 0.9% over $250k joint");
  T = computeTax({ status: "s", gross: 100000, pre: 0, dedType: "std", item: 0, state: "PA" });
  near(T.state, 3070, .01, "Pennsylvania flat 3.07%");
})();

group("Retirement tax: Social Security, capital gains, NIIT, senior deduction");
(function () {
  near(ssTaxable(20000, 18000, "s").taxable, 1500, .01, "50% tier");
  near(ssTaxable(20000, 30000, "s").taxable, 9600, .01, "85% tier");
  near(ssTaxable(40000, 200000, "m").taxable, 34000, .01, "capped at 85% of benefits");
  var base = { roth: 0, ss: 0, pension: 0, penPublic: false, other: 0, pre: 0, dedType: "std", item: 0,
               state: "TX", seniors: 0, _noMarginal: true };
  var T = computeRetireTax(Object.assign({}, base, { status: "s", trad: 0, brok: 60000, gainPct: 1 }));
  near(T.federal, 0, .01, "gain inside the 0% band is untaxed");
  T = computeRetireTax(Object.assign({}, base, { status: "s", trad: 50000, brok: 30000, gainPct: 1 }));
  near(T.federal, 3820 + 14450 * .15, .01, "gain stacks on ordinary income");
  T = computeRetireTax(Object.assign({}, base, { status: "s", trad: 0, brok: 0, gainPct: 0, other: 300000 }));
  near(T.niit, 3800, .01, "3.8% NIIT on income over $200k");
  T = computeRetireTax(Object.assign({}, base, { status: "m", seniors: 2, trad: 200000, brok: 0, gainPct: 0 }));
  near(T.seniorBonus, 6000, .01, "senior deduction phases out per spouse");
  T = computeRetireTax(Object.assign({}, base, { status: "s", seniors: 1, trad: 100000, brok: 0, gainPct: 0 }));
  near(T.seniorBonus, 4500, .01, "single: $6,000 less 6% over $75k");
  T = computeRetireTax(Object.assign({}, base, { status: "s", trad: 100000, brok: 0, gainPct: 0, state: "IL" }));
  near(T.state, 0, .01, "Illinois exempts retirement withdrawals");
})();

/* ---------------- Social Security ---------------- */
group("Social Security: 2026 bend points, claiming ages, spousal benefits");
(function () {
  eq(SS_BEND1, 1286, "first bend point"); eq(SS_BEND2, 7749, "second bend point");
  near(ssEstimate(80000, 35, 67).monthly, .9 * 1286 + .32 * (80000 / 12 - 1286), .01, "PIA at full retirement age");
  near(ssEstimate(80000, 35, 62).adjustment, .70, 1e-9, "claiming at 62: 30% less");
  near(ssEstimate(80000, 35, 70).adjustment, 1.24, 1e-9, "claiming at 70: 24% more");
  near(ssSpousalAdj(62), .65, 1e-9, "spousal benefit at 62: 35% less");
  near(ssSpousalAdj(70), 1, 1e-9, "no delayed credits on a spousal benefit");
  var S = ssDrawdownStreams(100000, 67, 0, 67, true, 65, 0);
  near(S.annual3, .5 * ssEstimate(100000, 40, 67).pia * 12, .01, "one-earner couple: half the earner's benefit");
  eq(S.delay3, 2, "top-up starts once both have claimed");
})();

/* ---------------- RMDs and Roth conversions ---------------- */
group("RMDs: IRS Uniform Lifetime Table and start age");
(function () {
  eq(ultDivisor(73), 26.5, "divisor at 73"); eq(ultDivisor(85), 16.0, "divisor at 85");
  eq(ultDivisor(72), 27.4, "age 72 factor (born before 1951)"); eq(ultDivisor(71), 0, "none before 72");
  eq(rmdStartAge(67), 73, "born 1959: 73"); eq(rmdStartAge(66), 75, "born 1960: 75");
  for (var a = 73; a < 100; a++) ok(ULT[a + 1] < ULT[a], "divisors fall with age");
})();

group("Roth conversions: RMDs, withholding and the 59½ penalty");
(function () {
  function inp(o) {
    return Object.assign({ age: 62, spouseAge: 62, status: "m", state: "TX", endAge: 92, trad: 1500000, roth: 150000,
      brokerage: 400000, basisPct: .6, ret: .05, spend: 100000, ss: 36000, ssAge: 67, spSS: 22000, spSSAge: 67,
      other: 0, otherStart: 62, deathYear: 0, strategy: "brk", bracket: .22, irmaaTarget: 0, fixedAmt: 75000,
      pctAmt: .08, startAge: 62, stopAge: 72, payFrom: "taxable", heirRate: .32, disc: .03, irmaaOn: true }, o || {});
  }
  var B = runRoth(inp(), false);
  var first = B.rows.filter(function (r) { return r.rmd > 0; })[0];
  eq(first.age, 75, "first RMD at 75 for someone 62 in 2026");
  near(first.rmd, first.tradBegin / 24.6, .01, "RMD = balance / divisor");
  // Other income gives the year a tax bill of its own, so "the conversion's
  // tax" and "the whole year's tax" are different numbers.
  var W = runRoth(inp({ age: 68, spouseAge: 68, startAge: 68, ssAge: 67, spSSAge: 67, other: 40000, payFrom: "withhold" }), true);
  var r = W.rows[0], withheld = r.conv - (r.roth - 150000);
  // The year's tax without the conversion, everything else the same.
  var T0 = rcTax({ status: "m", trad: r.rmd + r.extraTrad, roth: r.rothW, brok: r.sale,
    gainPct: .4, ss: r.ss, other: 40000, state: "TX", seniors: 2 });
  near(withheld, r.tax - T0.total, 5, "withholding covers only the tax the conversion adds");
  ok(withheld < r.tax - 1, "not the whole year's tax");
  eq(r.penalty, 0, "no penalty at 68");
  var E = runRoth(inp({ age: 50, spouseAge: 50, startAge: 50, brokerage: 0, payFrom: "withhold" }), true).rows[0];
  near(E.penalty, .1 * ((E.conv - (E.roth - 150000)) + E.extraTrad), 20, "10% on withheld and spent traditional dollars before 59½");
})();

/* ---------------- mortgage and debt ---------------- */
group("Mortgage: payment, amortization schedule, PMI");
(function () {
  var R = mortgage({ price: 450000, down: 90000, rate: .0671, term: 30, taxPct: .011, ins: 1500, pmiPct: .006, hoa: 0 });
  var r = .0671 / 12, pi = 360000 * r / (1 - Math.pow(1 + r, -360));
  near(R.pi, pi, .001, "principal and interest");
  var bal = 360000, yi = 0, yrs = [];
  for (var i = 1; i <= 360; i++) { var it = bal * r; bal -= pi - it; yi += it; if (i % 12 === 0) { yrs.push([yi, bal]); yi = 0; } }
  near(R.years[0].interest, yrs[0][0], .01, "year 1 interest is exactly 12 months");
  near(R.years[0].balance, yrs[0][1], .01, "year 1 closing balance");
  near(R.years[9].balance, yrs[9][1], .01, "year 10 closing balance");
  eq(R.years.length, 30, "30 rows"); eq(R.payoffMonth, 360, "pays off in month 360");
  var sum = R.years.reduce(function (a, y) { return a + y.interest; }, 0);
  near(sum, R.totalInterest, .01, "yearly interest adds up to the total");
  var X = mortgage({ price: 450000, down: 90000, rate: .0671, term: 30, taxPct: .011, ins: 1500, pmiPct: .006, hoa: 0, extraMonthly: 200 });
  ok(X.payoffMonth < 360 && X.totalInterest < R.totalInterest, "extra payments finish sooner and cost less");
  var P = mortgage({ price: 400000, down: 20000, rate: .0671, term: 30, taxPct: .011, ins: 1500, pmiPct: .006, hoa: 0 });
  var b2 = 380000, piP = P.pi, m = 0;
  while (b2 / 400000 > .8) { m++; b2 -= piP - b2 * r; }
  eq(P.pmiEndMonth, m, "PMI ends the month the balance reaches 80%");
  var RF = refiCompare({ price: 450000, down: 90000, rate: .0671, term: 30, taxPct: .011, ins: 1500, pmiPct: .006, hoa: 0 }, { rate: .06, term: 30, cost: 6000 });
  eq(RF.breakEvenMonths, Math.ceil(6000 / RF.monthlyDelta), "refinance break-even");
})();

group("Debt payoff: matches the loan formula; avalanche costs least");
(function () {
  var R = debtRun([{ desc: "a", balance: 10000, apr: 18, min: 250 }], 0, "avalanche");
  eq(R.monthsTotal, Math.ceil(-Math.log(1 - 10000 * .015 / 250) / Math.log(1.015)), "months to pay off");
  var b = 10000, interest = 0;
  while (b > .005) { var it = b * .015; interest += it; b = b + it - Math.min(250, b + it); }
  near(R.totalInterest, interest, .01, "total interest");
  var D = [{ desc: "Card", balance: 9800, apr: 22.9, min: 245 }, { desc: "Store", balance: 1900, apr: 8.9, min: 60 },
           { desc: "Car", balance: 16200, apr: 7.4, min: 395 }, { desc: "Student", balance: 21500, apr: 5.5, min: 230 }];
  var av = debtRun(D, 200, "avalanche"), sn = debtRun(D, 200, "snowball"), mn = debtRun(D, 0, "min");
  ok(av.totalInterest <= sn.totalInterest, "avalanche interest <= snowball");
  ok(av.monthsTotal < mn.monthsTotal, "a plan beats minimums");
  eq(av.order[0].desc, "Card", "avalanche targets the highest rate");
  eq(sn.order[0].desc, "Store", "snowball targets the smallest balance");
})();

/* ---------------- drawdown and history ---------------- */
group("Historical data: 100 years, long-run returns");
(function () {
  eq(HIST_M_STOCK.length, 1200, "stock months"); eq(HIST_M_BOND.length, 1200, "bond months"); eq(HIST_M_INFL.length, 1200, "inflation months");
  var B = backtest({ stockPct: 100, fee: 0, initial: 10000, startYear: 1926, endYear: 2025 });
  near(B.cagr, .1045, .0005, "stocks 1926-2025, about 10.45% a year");
  near(B.inflCagr, .0294, .0005, "inflation, about 2.94% a year");
})();

group("Drawdown: the 4% rule, replicated independently");
(function () {
  var o = { initial: 1e6, years: 30, stockPct: 60, initialPct: 4, strategy: "fixed", fee: 0 };
  function bengen(start) {   // withdraw at the start of each year, raise by last year's CPI
    var bal = 1e6, w = 40000;
    for (var k = 0; k < 30; k++) {
      var i = start - 1926 + k;
      if (k > 0) w *= 1 + HIST_INFL[i - 1] / 100;
      bal -= w;
      if (bal < 0) return { fail: k + 1 };
      bal *= 1 + (.6 * HIST_STOCK[i] + .4 * HIST_BOND[i]) / 100;
    }
    return { end: bal };
  }
  [1929, 1937, 1966, 1969, 1973, 1990].forEach(function (y) {
    var R = runDrawdown(o, seqFrom(y, 30)), I = bengen(y);
    if (I.fail) eq(R.depletedYear, I.fail, y + ": runs out the same year");
    else near(R.endBalance, I.end, .01, y + ": same ending balance");
    eq(R.rows[0].withdrawal, 40000, y + ": year 1 withdrawal is 4% of today's dollars");
  });
  var H = historicalBacktest(o);
  near(H.successRate, 66 / 70, .001, "success rate, starting July 1926: every January from 1927");
  eq(H.failYears.join(","), "1965,1966,1968,1969", "the retirements that failed");
})();

group("Drawdown: every strategy starts at its stated spending; income offsets it");
(function () {
  var base = { initial: 1e6, years: 30, stockPct: 60, initialPct: 4, fee: 0, guardBand: 20, adjustPct: 10,
               floorPct: 5, ceilPct: 10, yaleRate: 4, yaleWeight: 70 };
  ["fixed", "pct", "guardrails", "floorceil", "yale"].forEach(function (s) {
    near(runDrawdown(Object.assign({}, base, { strategy: s }), seqFrom(1974, 30)).rows[0].realSpend, 40000, .01, s);
  });
  var R = runDrawdown(Object.assign({}, base, { strategy: "fixed", ssAnnual: 15000, ssDelayYears: 0 }), seqFrom(1990, 30));
  near(R.rows[0].withdrawal, 25000, .01, "Social Security covers part of year 1");
  var V = runDrawdown(Object.assign({}, base, { strategy: "vpw", vpwRate: 3, vpwFV: 0 }), seqFrom(1950, 30));
  ok(!V.depleted, "VPW spending down to zero is the plan, not a failure");
  var M1 = monteCarloDrawdown(base, 200, 7), M2 = monteCarloDrawdown(base, 200, 7);
  eq(M1.successRate, M2.successRate, "Monte Carlo is repeatable with the same seed");
})();

group("Drawdown: guardrails set apart, and no cuts in the final years");
(function () {
  var base = { initial: 1e6, years: 30, stockPct: 60, initialPct: 5, fee: 0, strategy: "guardrails", guardBand: 20, adjustPct: 10 };
  function run(x, from) { return runDrawdown(Object.assign({}, base, x), seqFrom(from, 30)).rows; }
  function steps(rows) { return rows.map(function (r, i) { return i ? r.realSpend / rows[i - 1].realSpend : 1; }); }
  var S = run({}, 1966), E = run({ guardBandLo: 20, raisePct: 10 }, 1966);
  ok(S.every(function (r, i) { return Math.abs(r.realSpend - E[i].realSpend) < 1e-6; }), "a lower guardrail left unset matches the upper one");

  var cutsLate = steps(S).slice(15).filter(function (x) { return x < .999; }).length;
  ok(cutsLate > 0, "1966: without the rule, spending is cut in the final 15 years", cutsLate + " cuts");
  var F = run({ gkFinalYears: 15 }, 1966), fs = steps(F);
  ok(fs.slice(15).every(function (x) { return x > .999; }), "with it, no cut in the final 15 years");
  ok(F.slice(0, 15).every(function (r, i) { return Math.abs(r.realSpend - S[i].realSpend) < 1e-6; }), "the first 15 years are unchanged");
  // This one runs dry, and what's spent then falls to what's left, so it's
  // the plan's own spending that must never be cut.
  ok(run({ gkFinalYears: 30 }, 1966).every(function (r, i, a) { return !i || r.realPlanned >= a[i - 1].realPlanned - 1e-6; }), "final years covering the whole plan: never a cut");

  var up = steps(run({}, 1982)), i = up.findIndex(function (x) { return x > 1.001; });
  near(up[i], 1.10, 1e-9, "1982: the first raise is 10%");
  var up5 = steps(run({ raisePct: 5 }, 1982));
  near(up5[i], 1.05, 1e-9, "a 5% raise when the lower guardrail says so");
  var wide = steps(run({ guardBandLo: 60 }, 1982));
  ok(wide.findIndex(function (x) { return x > 1.001; }) > i || wide.every(function (x) { return x <= 1.001; }), "a wider lower guardrail raises later");
})();

group("Drawdown: a retirement starting every month, and the CAPE record");
(function () {
  eq(HIST_M_CAPE.length, 1200, "CAPE: one reading a month, 1926-2025");
  eq(HIST_M_CAPE[3 * 12 + 8], 32.56, "September 1929, the peak before the crash");
  eq(HIST_M_CAPE[73 * 12 + 11], 44.19, "December 1999, the highest on record");
  eq(HIST_M_CAPE[83 * 12 + 2], 13.32, "March 2009");
  near(HIST_M_CAPE.reduce(function (a, b) { return a + b; }, 0), 22939.76, 1e-6, "every reading as copied");
  ok(HIST_STOCK.every(function (v, y) { return HIST_Y12_STOCK[12 * y] === v && HIST_Y12_BOND[12 * y] === HIST_BOND[y] &&
    HIST_Y12_INFL[12 * y] === HIST_INFL[y]; }), "a year from January is the calendar year, exactly");
  var o = { initial: 1e6, years: 30, stockPct: 60, initialPct: 4, fee: 0, strategy: "fixed" };
  var A = historicalBacktest(o), M = historicalBacktest(Object.assign({}, o, { monthly: true }));
  eq(M.total, 835, "835 thirty-year retirements, one a month from July 1926");
  var jan = M.runs.filter(function (r) { return r.startMonth === 1; });
  eq(jan.length, A.total, "one in each January");
  ok(jan.every(function (r, i) { return r.endReal === A.runs[i].endReal && r.depleted === A.runs[i].depleted; }), "and those match the annual test");
  // one start by hand: September 1929, compounding twelve months at a time
  var r29 = M.runs.filter(function (r) { return r.startYear === 1929 && r.startMonth === 9; })[0], bal = 1e6, lvl = 1;
  for (var k = 0; k < 30 && bal > 0; k++) {
    var i = 3 * 12 + 8 + 12 * k, gs = 1, gb = 1, gi = 1;
    for (var m = 0; m < 12; m++) { gs *= 1 + HIST_M_STOCK[i + m] / 100; gb *= 1 + HIST_M_BOND[i + m] / 100; gi *= 1 + HIST_M_INFL[i + m] / 100; }
    bal = Math.max(0, (bal - Math.min(bal, 40000 * lvl)) * (1 + .6 * (gs - 1) + .4 * (gb - 1)));
    lvl *= gi;
  }
  near(r29.endReal, bal / lvl, 1e-3, "September 1929, worked independently");
  ok(M.failYears.every(function (y, i, a) { return a.indexOf(y) === i; }), "each failed start year listed once");
})();

group("Drawdown: the new strategies, year one and their rules");
(function () {
  var base = { initial: 1e6, years: 30, stockPct: 60, initialPct: 4, fee: 0, vpwRate: 3.8, vpwFV: 0, kitThresh: 50, kitRaise: 10,
    kitGap: 3, clyFloor: 95, hebWeight: 75, hebRate: 3, sensExtra: 10, capeA: 1.75, capeB: .5, vgFloor: 2.5, vgCeil: 5,
    floorPct: 2.5, ceilPct: 5, rgTarget: 90, rgLo: 70, rgHi: 99 };
  function run(x, from, n) { var o = Object.assign({}, base, x); return runDrawdown(o, seqFrom(from, n || o.years)); }
  near(run({ strategy: "oneovern" }, 1950).rows[0].realSpend, 1e6 / 30, 1e-6, "1/N: a thirtieth in year one");
  var N = run({ strategy: "oneovern" }, 1966);
  ok(!N.depleted && N.endReal < 1, "1/N ends at zero, by plan, not as a failure");
  near(run({ strategy: "rmd", retireAge: 75 }, 1950).rows[0].realSpend, 1e6 / ultDivisor(75), 1e-6, "RMD method: the IRS divisor at 75");
  near(run({ strategy: "rmd", retireAge: 65 }, 1950).rows[0].realSpend, 1e6 / (27.4 + 7 * .9), 1e-6, "below 72, the table's trend carried down");
  var C = run({ strategy: "clyatt" }, 1973).rows;
  ok(C.every(function (r, i) { return !i || r.spend >= .95 * C[i - 1].spend - 1e-6; }), "95% rule: never under 95% of last year, in dollars");
  ok(C.some(function (r, i) { return i && r.spend < C[i - 1].spend - 1; }), "but it does cut");
  var K = run({ strategy: "kitces" }, 1982).rows, raised = 0;
  K.forEach(function (r, i) { if (i && r.realSpend > K[i - 1].realSpend * 1.05) raised++; });
  ok(raised > 0 && K.every(function (r, i) { return !i || r.realSpend >= K[i - 1].realSpend - 1e-6; }), "Kitces ratchet: raises in a good run, never a cut");
  var K66 = run({ strategy: "kitces" }, 1966).rows, F66 = run({ strategy: "fixed" }, 1966).rows;
  ok(K66.every(function (r, i) { return Math.abs(r.realSpend - F66[i].realSpend) < 1e-6; }), "and in 1966, the same as fixed");
  near(run({ strategy: "hebeler" }, 1950).rows[0].realSpend, pmtStart(.03, 30, 1e6, 0), 1e-6, "Autopilot II: year one is the payment");
  var Se = run({ strategy: "sensible" }, 1950).rows;
  near(Se[0].realSpend, 40000, 1e-6, "Sensible withdrawals: the base in year one");
  ok(Se.every(function (r) { return r.realSpend >= 40000 - 1e-6; }) && Se.some(function (r) { return r.realSpend > 40001; }), "and the base plus a share of gains after");
  near(run({ strategy: "cape" }, 1966).rows[0].realSpend, 1e6 * (1.75 + .5 * 100 / HIST_M_CAPE[40 * 12]) / 100, 1e-6, "CAPE rule: 1.75% plus half of 1/CAPE (January 1966)");
  var V = run({ strategy: "vanguard" }, 1973).rows, Fc = run({ strategy: "floorceil" }, 1973).rows;
  ok(V.every(function (r, i) { return Math.abs(r.realSpend - Fc[i].realSpend) < 1e-6; }), "Vanguard's rule is floor and ceiling at +5% / -2.5%");
  // risk-based guardrails start at the spending with the target chance of lasting
  var o = Object.assign({}, base, { strategy: "riskgr" }), T = ddRiskTable(o), w1 = run({ strategy: "riskgr" }, 1950).rows[0].realSpend;
  near(ddRiskP(T, w1 / 1e6, 30), .9, .02, "risk-based guardrails: year one has about a 90% chance");
  ok(ddRiskP(T, w1 / 1e6 * 1.05, 30) < .9, "and a little more would have less");
  // the table's safe rate really is the edge for a fixed withdrawal
  var safe66 = 1 / (function () { var s = 0, D = 1; for (var k = 0; k < 30; k++) { s += D; var i = 40 + k;
    D /= (1 + (.6 * HIST_STOCK[i] + .4 * HIST_BOND[i]) / 100) / (1 + HIST_INFL[i] / 100); } return s; })();
  ok(!run({ strategy: "fixed", initialPct: safe66 * 100 - .001 }, 1966).depleted, "1966's safe rate lasts");
  ok(run({ strategy: "fixed", initialPct: safe66 * 100 + .01 }, 1966).depleted, "and a hair more doesn't");
  var skip = run({ strategy: "fixed", skipRaise: true }, 1973).rows;
  ok(skip[2].realSpend < skip[1].realSpend, "skipping the raise after a losing year (1974) lowers real spending");
})();

group("Drawdown: spending path, guaranteed income and what was really spent");
(function () {
  var base = { initial: 1e6, years: 30, stockPct: 60, initialPct: 4, fee: 0, strategy: "fixed" };
  function run(x, from) { var o = Object.assign({}, base, x); return runDrawdown(o, seqFrom(from, o.years)); }
  var flat = run({}, 1950).rows, st = run({ path: "stages", pathStages: [{ start: 11, level: 75 }] }, 1950).rows;
  near(st[10].realSpend, 30000, 1e-6, "a stage at 75% from year 11");
  ok(st.slice(0, 10).every(function (r, i) { return Math.abs(r.realSpend - flat[i].realSpend) < 1e-6; }), "and the first ten years as before");
  var conv = ddOptsFromState({ initial: 1e6, rate: 4, strategy: "fixed", wdStages: [{ start: 11, rate: 3, name: "Slower" }] });
  eq(conv.path, "stages", "old spending stages load as a path");
  near(conv.pathStages[0].level, 75, 1e-9, "3% of a 4% start is a 75% stage");
  eq(ddOptsFromState({ initial: 1e6, rate: 4, strategy: "pct", wdStages: [{ start: 11, rate: 3 }] }).path, "flat", "stages only ever belonged to fixed");
  var gr = { strategy: "guardrails", guardBand: 20, adjustPct: 10 };
  var gFlat = run(gr, 1966).rows, gEase = run(Object.assign({ path: "ease", pathEase: 2 }, gr), 1966).rows;
  ok(gEase.every(function (r, i) { return r.realSpend === gFlat[i].realSpend; }), "the path shapes only the steady strategies; guardrails ignore it");
  var kE = run({ strategy: "kitces", path: "ease", pathEase: 1 }, 1950).rows;
  ok(kE[10].realSpend < kE[0].realSpend, "the ratchet takes it");
  var ease = run({ path: "ease", pathEase: 1 }, 1950).rows;
  near(ease[10].realSpend, 40000 * Math.pow(.99, 10), 1e-6, "easing 1% a year");
  var sm = ddPath({ years: 35, path: "smile", retireAge: 65 }, 50000);
  ok(sm[13] < sm[5] && sm[34] / sm[33] > sm[14] / sm[13], "the smile: down through the 70s, recovering late");
  near(ddBlanchett(78, 50000), Math.min.apply(null, [70, 74, 78, 82, 86].map(function (a) { return ddBlanchett(a, 50000); })), 1e-12, "steepest decline near 78");
  // guaranteed income: 30% buys a TIPS ladder; the rest runs the strategy
  var G = run({ gShare: 30, gType: "tips", gYield: 2 }, 1966), pay = 300000 * pmtStart(.02, 30, 1, 0);
  near(G.rows[0].realSpend, .04 * 700000 + pay, 1e-6, "year one: 4% of what's invested plus the ladder");
  ok(G.rows.every(function (r) { return r.realSpend >= pay - 1e-6; }), "the ladder's income never falls in real terms");
  var A = run({ gShare: 30, gType: "annuity", gPayout: 7 }, 1966).rows;
  ok(A[29].guaranteed === A[0].guaranteed && A[29].realSpend < A[0].realSpend, "an annuity without raises loses value to inflation");
  // what was really spent once the money ran out
  var F = run({ initialPct: 6, ssAnnual: 12000, ssDelayYears: 0 }, 1966);
  ok(F.depleted, "6% from 1966 runs dry");
  var last = F.rows[F.rows.length - 1];
  near(last.realSpend, 12000, 1e-6, "after that, only Social Security is spent");
  ok(last.realPlanned > 50000, "though the plan still called for more");
})();

group("Drawdown: four asset classes and how often to rebalance");
(function () {
  eq(HIST_M_CASH.length, 1194, "cash: July 1926 to December 2025");
  eq(HIST_M_SV.length, 1194, "small value: the same months");
  near(HIST_M_CASH[0], .22, 1e-9, "July 1926's T-bill return, as published");
  var base = { initial: 1e6, years: 30, stockPct: 60, initialPct: 4, fee: 0, strategy: "fixed" };
  var o = function (x) { return Object.assign({}, base, x); };
  var mix = ddMixAt(o({ stockPct: 50, svPct: 10, cashPct: 5 }), 0);
  ok(Math.abs(mix[0] - .5) < 1e-12 && Math.abs(mix[1] - .1) < 1e-12 && Math.abs(mix[2] - .35) < 1e-12 && Math.abs(mix[3] - .05) < 1e-12, "bonds are what the rest leave");
  var g = ddMixAt(o({ stockPct: 50, svPct: 10, cashPct: 10, stockPctEnd: 30 }), 29);
  ok(Math.abs(g[0] + g[1] - .3) < 1e-9 && Math.abs(g[1] / (g[0] + g[1]) - 1 / 6) < 1e-9 && Math.abs(g[3] / (g[2] + g[3]) - .25) < 1e-9,
    "a glide moves the stocks' total, each part keeping its share");
  var yr = historicalBacktest(o({})), ev1 = historicalBacktest(o({ rebal: "every", rebalN: 1 }));
  ok(yr.runs.every(function (r, i) { return r.endReal === ev1.runs[i].endReal; }), "rebalancing every 1 year is every year");
  var band0 = historicalBacktest(o({ rebal: "band", rebalBand: 0 }));
  ok(yr.runs.every(function (r, i) { return Math.abs(r.endReal - band0.runs[i].endReal) < 1e-3; }), "a zero band rebalances every year");
  var allS = historicalBacktest(o({ stockPct: 100 })), allSn = historicalBacktest(o({ stockPct: 100, rebal: "never" }));
  ok(allS.runs.every(function (r, i) { return Math.abs(r.endReal - allSn.runs[i].endReal) < 1e-3; }), "one asset never needs rebalancing");
  var nv = historicalBacktest(o({ rebal: "never" })), drift = nv.runs.filter(function (r, i) { return Math.abs(r.endReal - yr.runs[i].endReal) > 1; }).length;
  ok(drift > nv.runs.length / 2, "never rebalancing lets the mix drift and changes results");
  var cash = historicalBacktest(o({ stockPct: 0, cashPct: 100 })), sv = historicalBacktest(o({ stockPct: 0, svPct: 100 }));
  ok(cash.successRate < yr.successRate && sv.medianEnd > yr.medianEnd, "all cash lasts less often; all small value ends higher");
})();

group("Drawdown: a minimum that changes with age");
(function () {
  var o = { initial: 5.5e6, years: 40, stockPct: 60, initialPct: 5.5, fee: 0, strategy: "guardrails", guardBand: 20, adjustPct: 10,
    spendFloor: 200000, retireAge: 47, floorSteps: [{ start: 17, amount: 175000, glide: 0 }] };
  var f = ddFloorSched(o);
  ok(f[15] === 200000 && f[16] === 175000 && f[39] === 175000, "$200,000 to 62, then $175,000 from 63");
  var g = ddFloorSched(Object.assign({}, o, { floorSteps: [{ start: 14, amount: 175000, glide: 4 }] }));
  ok(g[12] === 200000 && g[13] === 195000 && g[16] === 180000 && g[17] === 175000, "or eased in over four years");
  var a = historicalBacktest(Object.assign({}, o, { floorSteps: [] })), b = historicalBacktest(o);
  ok(b.successRate >= a.successRate, "a lower minimum later lasts at least as often", a.successRate + " -> " + b.successRate);
  ok(b.runs.every(function (r) { return r.rows.every(function (w, y) { return w.short > 0 || w.realReg >= f[y] - .5; }); }),
    "spending holds the year's minimum unless the money runs short");
  var c = ddComfort(o);
  ok(Array.isArray(c) && c[0] === 200000 && c[39] === 175000, "the comfort line follows it");
})();

group("Drawdown: Monte Carlo draws years in blocks, and can take your own returns");
(function () {
  var o = ddOptsFromState({ initial: 1000000, years: 30, stock: 60, rate: 4, strategy: "fixed" });
  ok(o.mcBlock === 1 && !o.mcOwn, "one year at a time, history's returns, unless asked");
  // Pinned before blocks existed: one-year blocks draw exactly as they did.
  var M = monteCarloDrawdown(o, 2000, 12345);
  near(M.successRate, 0.9235, 1e-9, "blocks of one draw the same years as before");
  near(M.medianEnd, 1905275.57, 0.01, "and end the same");
  // Each block is consecutive years of the record, carrying on from 1927 past 2025.
  var H = HIST_STOCK, n = H.length - 1, seq = [], rng = mulberry32(99);
  for (var k = 0; k < 40; k++) seq.push({});
  var sh = { stock: 0, sv: 0, bond: 0, cash: 0, infl: 0 };
  ddMCFill(seq, 40, 10, rng, sh);
  var idx = seq.map(function (q) { for (var i = 1; i <= n; i++) if (H[i] === q.stock && HIST_BOND[i] === q.bond && HIST_INFL[i] === q.infl) return i; return -1; });
  ok(idx.every(function (i) { return i >= 1; }), "every drawn year is one from 1927 on");
  ok([0, 10, 20, 30].every(function (b) {
    for (var j = 1; j < 10; j++) if (idx[b + j] !== 1 + (idx[b + j - 1] % n)) return false;
    return true;
  }), "ten in a row, as they happened", JSON.stringify(idx));
  var odd = []; ddMCFill(odd = [{}, {}, {}, {}, {}, {}, {}], 7, 5, mulberry32(3), sh);
  ok(odd.every(function (q) { return q.stock != null; }), "a last block cut short still fills the run");
  // Your own returns: the record compounds to them, its swings kept.
  var own = Object.assign({}, o, { mcOwn: true, mcRet: { stock: 7, sv: 9, bond: 4, cash: 3, infl: 2.5 } });
  var S = ddMCShift(own);
  near(ddMCCompound(HIST_STOCK, S.stock), 7, 1e-6, "stocks compound to 7%");
  near(ddMCCompound(HIST_BOND, S.bond), 4, 1e-6, "bonds to 4%");
  near(ddMCCompound(HIST_INFL, S.infl), 2.5, 1e-6, "inflation to 2.5%");
  var hist = ddMCHistory(), same = ddMCShift(Object.assign({}, o, { mcOwn: true, mcRet: hist }));
  ok(Math.abs(same.stock) < 1e-6 && Math.abs(same.infl) < 1e-6, "history's own figures move nothing");
  near(hist.stock, 10.4, 0.05, "US stocks compounded 10.4% a year, 1927-2025");
  near(hist.infl, 3.0, 0.05, "inflation 3.0%");
  var lean = monteCarloDrawdown(own, 2000, 12345);
  ok(lean.successRate < M.successRate - 0.05, "a leaner future lasts less often", M.successRate + " -> " + lean.successRate);
  eq(monteCarloDrawdown(Object.assign({}, o, { mcOwn: true, mcRet: hist }), 2000, 12345).successRate, M.successRate,
    "history's figures as your own give history's result");
  ok(ddOptsFromState({ mcBlock: 5, mcRet: "own", mcStock: 6 }).mcRet.stock === 6, "saved settings read back");
})();

group("Drawdown: saved inputs become options the same way everywhere");
(function () {
  var o = ddOptsFromState({ initial: "1,000,000", years: 30, stock: 0, rate: 0, floor: 0, ceil: 0, yaleWeight: 0, strategy: "floorceil" });
  ok(o.stockPct === 0 && o.initialPct === 0 && o.floorPct === 0 && o.ceilPct === 0 && o.yaleWeight === 0, "a 0 stays 0 (it used to become a default)");
  eq(o.initial, 1e6, "grouped digits read");
  var old = ddOptsFromState({ initial: 1e6, guardBand: 25, adjust: 15, strategy: "guardrails" });
  ok(old.guardBandLo === 25 && old.raisePct === 15 && old.gkFinalYears === 0, "saved before the guardrails split: the lower matches the upper");
  var d = ddOptsFromState({ ssMode: "manual", ssWho: "couple", ssAmount: 30000, ssAmount2: 15000, ssDelay: 67, retireAge: "62" });
  ok(d.ssAnnual === 45000 && d.ssDelayYears === 5 && d.retireAge === 62, "known benefits from an age");
  eq(ddOptsFromState({ strategy: "nope" }).strategy, "fixed", "an unknown strategy falls back to fixed");
  ok(ddOptsFromState({ starts: "month" }).monthly && !ddOptsFromState({}).monthly, "every month only when asked");
})();

group("Drawdown: the searches meet the target they're given");
(function () {
  var o = ddOptsFromState({ initial: 1e6, years: 30, stock: 60, rate: 4, strategy: "fixed" });
  var T = { crit: "lasts", conf: 1, comfort: 0 };
  var cal = ddCalibrate(o, T);
  ok(cal.met && historicalBacktest(ddWithDial(o, cal.v)).successRate === 1, "fixed: the found rate lasts every time");
  ok(historicalBacktest(ddWithDial(o, cal.v + .02)).successRate < 1, "and a little more doesn't", "rate " + cal.v);
  var safe = ddSafeByStart(o, T), min = Math.min.apply(null, safe.map(function (s) { return s.v; }));
  near(min, cal.v, .002, "the lowest start's safe rate is the plan's safe rate");
  // 10% cuts scale with wherever spending started, so on their own they can't
  // promise a line: under "comfort" the line is each strategy's minimum.
  var gr = Object.assign({}, o, { strategy: "guardrails", guardBand: 20, adjustPct: 10 });
  var T2 = { crit: "comfort", conf: 1, comfort: 32000 };
  var g = ddCalibrate(gr, T2), gx = ddWithDial(ddForTarget(gr, T2), g.v), H = historicalBacktest(gx);
  ok(g.met && gx.floorLine && gx.floorLine[0] === 32000, "guardrails, held at $32,000 or more", JSON.stringify(g));
  ok(H.runs.every(function (r) { return r.rows.every(function (w) { return w.realReg >= 32000 - .5; }); }), "never fall under it at the rate found");
  var Hup = historicalBacktest(ddWithDial(ddForTarget(gr, T2), g.v + .05));
  ok(Hup.runs.some(function (r) { return r.rows.some(function (w) { return w.realReg < 32000 - .5; }); }), "and a little more would run dry somewhere", "rate " + g.v);
  var P = ddSolvePortfolio(Object.assign({}, o, { initialPct: 4 }), T);
  var px = Object.assign({}, o, { initial: P.portfolio, initialPct: 40000 / P.portfolio * 100 });
  ok(historicalBacktest(px).successRate === 1 && Math.abs(P.portfolio * cal.v / 100 - 40000) < 40, "the portfolio needed for $40,000 at the safe rate");
  var S = ddShowdown(o, T2);
  eq(S.list.length, DD_ORDER.length, "the showdown runs every strategy");
  ok(S.list.every(function (x) { return !x.tuned || !x.met || x.share === 1; }), "each one tuned meets the target");
  var Hq = historicalBacktest(Object.assign({}, o, { monthly: true })), Q = ddQuick(Object.assign({}, o, { monthly: true }));
  ok(Q.successRate === Hq.successRate && Q.medianEnd === Hq.medianEnd, "the quick summary agrees with the full test");
  var hc = ddHeatmap(o, { crit: "comfort", conf: 1, comfort: 32000 }, "stock");
  ok(hc.grid[0][6] === -1 && hc.grid[12][6] >= 0, "a fixed amount starting under the comfort line is marked, not scored");
  var heat = ddHeatmap(o, T, "stock");
  eq(heat.cols.length, 11, "the grid runs 0% to 100% stocks");
  ok(heat.rows.length === 13 && heat.grid[0][6] >= heat.grid[12][6], "lower rates succeed at least as often");
})();

group("Historical accumulation: every monthly window, one trace per year");
(function () {
  var H = historicalRuns({ initial: 10000, fees: 0 }, [{ years: 30, contrib: 500, period: "Monthly", growth: .03, nominal: .085, mix: .8, glide: { on: false } }]);
  eq(H.count, 1200 - 360 + 1, "841 windows of 30 years");
  eq(H.traces.length, Math.ceil(H.count / 12), "one trace per starting year");
  near(H.traces[0][H.traces[0].length - 1], H.windows[0].final, 1e-6, "trace ends where its window ends");
})();

/* ---------------- other calculators ---------------- */
group("Rent vs. buy: appreciation, paid-off loans, taxes on gains");
(function () {
  var b = { price: 450000, downPct: 20, rate: 6.71, term: 15, propTax: 1.1, ins: 1800, maint: 1, closePct: 3, sellPct: 3,
            rent: 1800, rentInc: 3.2, appr: 4, invest: 7, horizon: 30, gainTax: 0, status: "m" };
  var R = rentBuyCalc(b), y15 = R.years[14], y16 = R.years[15];
  near(R.years[29].homeVal, 450000 * Math.pow(1.04, 30), .01, "home value compounds at the rate entered");
  ok(y16.monthBuy < y15.monthBuy - .9 * R.pi, "the payment stops once the loan is paid off");
  // With rent at zero the buyer never has a cheaper month to invest, so the
  // only tax that differs between the two runs is the one on the home sale.
  var nr = Object.assign({}, b, { rent: 0, term: 30 });
  var A0 = rentBuyCalc(nr).years[29], A1 = rentBuyCalc(Object.assign({}, nr, { gainTax: 15 })).years[29];
  var gain = A0.homeVal * .97 - 450000 - 13500;
  near(A0.buyerNW - A1.buyerNW, Math.max(0, gain - 500000) * .15, .01, "home gain taxed only above the $500k exclusion");
  var S1 = rentBuyCalc(Object.assign({}, nr, { gainTax: 15, status: "s" })).years[29];
  near(A1.buyerNW - S1.buyerNW, 250000 * .15, .01, "single filers exclude $250k less");
})();

group("College savings: the saved balance lands on the target");
(function () {
  var C = collegeSavingsCalc({ yearsUntil: 18, annualCost: 27000, tuitionInfl: .04, investRet: .06, saved: 5000, collegeYrs: 4 });
  near(C.rows[17].balance, C.targetAtStart, .01, "final balance equals what's needed");
})();

group("College savings: several children from one account");
(function () {
  var base = { tuitionInfl: .04, investRet: .06, saved: 5000 };
  function plan(kids) { return collegePlanCalc(Object.assign({ kids: kids }, base)); }
  function kid(y, cost) { return { yearsUntil: y, annualCost: cost || 27000, collegeYrs: 4 }; }
  // Month by month, the lowest the account gets and where it ends.
  function lowest(P) {
    var g = Math.pow(1.06, 1 / 12), bills = [], low = Infinity, bal = 5000;
    P.kids.forEach(function (k) { k.yearCosts.forEach(function (c, j) { bills.push({ m: k.start + 12 * j, amt: c }); }); });
    var end = Math.max.apply(null, bills.map(function (b) { return b.m; }));
    for (var m = 1; m <= end; m++) { bal = collegeWalk(bal, P.phases, bills, g, m, m - 1).bal; low = Math.min(low, bal); }
    return { low: low, end: bal };
  }
  var one = collegeSavingsCalc({ yearsUntil: 18, annualCost: 27000, tuitionInfl: .04, investRet: .06, saved: 5000, collegeYrs: 4 });
  var P1 = plan([kid(18)]);
  near(P1.monthly, one.monthly, 1e-6, "one child: same amount as the single-child plan");
  eq(P1.phases.length, 1, "one child: one level amount");
  var twin = collegeSavingsCalc({ yearsUntil: 18, annualCost: 27000, tuitionInfl: .04, investRet: .06, saved: 2500, collegeYrs: 4 });
  near(plan([kid(18), kid(18)]).monthly, 2 * twin.monthly, 1e-6, "twins: twice one child with half the savings each");

  var P2 = plan([kid(18), kid(20)]), L2 = lowest(P2);
  eq(P2.phases.length, 1, "two years apart: one level amount");
  ok(L2.low > -0.01, "two years apart: the account never runs short");
  near(L2.end, 0, .01, "two years apart: the account ends empty");
  near(P2.rows[P2.rows.length - 1].balance, 0, .01, "the year-by-year table ends empty too");
  near(P2.totalFuture, P2.kids[0].total + P2.kids[1].total, 1e-6, "total is both children's bills");

  var P3 = plan([kid(2), kid(18)]), L3 = lowest(P3);
  ok(P3.phases.length === 2 && P3.phases[1].monthly < P3.phases[0].monthly, "one starting in 2 years: the amount steps down after");
  eq(P3.phases[0].to, 24 + 36, "the step comes after the older child's last bill");
  ok(L3.low > -0.01, "stepped plan: the account never runs short");
  near(L3.end, 0, .01, "stepped plan: the account ends empty");

  eq(collegePlanCalc({ kids: [kid(18), kid(20)], tuitionInfl: .04, investRet: .06, saved: 1e7 }).monthly, 0, "enough saved: nothing more to add");
  var P4 = plan([kid(18), { yearsUntil: 0, annualCost: 27000, collegeYrs: 4 }]);
  ok(P4.kids.length === 1 && P4.skipped === 1, "a child with no years until college is left out");
})();

group("Healthcare: CMS age curve and ACA credits");
(function () {
  near(hcAgeMultiplier(40), 1.278, 1e-9, "age 40"); near(hcAgeMultiplier(60), 2.714, 1e-9, "age 60");
  near(hcAgeMultiplier(64), 3.0, 1e-9, "age 64");
  near(hcContribPctStd(2.84), .0844 + .68 * (.0996 - .0844), 1e-9, "applicable percentage at 284% FPL");
  eq(hcContribPctStd(4.01), null, "no credit above 400% FPL");
  var gross = 2 * hcGrossPremium("IL", 62, 0), R = hcCalcACA(60000, gross, 60000 / hcFPL(2), false);
  near(R.net, 60000 * R.pct / 12, .01, "a couple pays one contribution for both");
})();

group("72(t): payment formulas and the /72t worked example");
(function () {
  eq(brLE(52), 34.3, "IRS Single Life Table, age 52");
  eq(brLE(50), 36.2, "IRS Single Life Table, age 50");
  var n = brLE(52), f = brAmortFactor(.05, 52);
  near(f, .05 / (1 - Math.pow(1.05, -n)), 1e-12, "amortization is the loan-payment formula over life expectancy");
  // The level payment pays the balance off exactly after n years at 5%.
  var b = 900000;
  for (var y = 0; y < 34; y++) b = b * 1.05 - 900000 * f;
  near(b * Math.pow(1.05, n - 34) - 900000 * f * (Math.pow(1.05, n - 34) - 1) / .05, 0, 1, "payments exhaust the balance at life expectancy");
  var split = 40000 / f, tax = 0, taxable = 40000 - FED_STD.s, br = FED_2026.s;
  for (var i = 0; i < br.length; i++) {
    var top = i + 1 < br.length ? br[i + 1][0] : Infinity;
    if (taxable > br[i][0]) tax += (Math.min(taxable, top) - br[i][0]) * br[i][1];
  }
  says("72t", "is " + n + " years");
  says("72t", "at 5%: " + dollars(900000 * f));
  says("72t", "shows " + dollars(900000 * f));
  says("72t", dollars(900000 / n) + " the first year");
  says("72t", "move " + dollars(split));
  says("72t", "The other " + dollars(900000 - split));
  says("72t", "about " + dollars(tax) + " of federal income tax");
  says("72t", "would otherwise have added " + dollars(40000 * .10));
  says("72t", "about " + dollars(Math.round(40000 / Math.pow(1.03, 7) / 100) * 100) + " in today's dollars");
  says("72t", "she'd owe " + dollars(4 * 40000 * .10));
})();

/* ---------------- the articles' worked examples ---------------- */
group("Articles: home and Advanced");
(function () {
  var bal = RISK_LEVELS[2].real;
  eq(bal, .045, "Balanced is 4.5% after inflation");
  function basic(o) { return projectBasic(Object.assign({ years: 35, real: bal, initial: 10000, contrib: 500, period: "Monthly", withdrawal: .04 }, o)); }
  var R = basic({});
  says("home", "At 65: " + dollars(R.fv) + " in today's dollars");
  says("home", "4% of that is " + dollars(R.fv * .04) + " a year, or " + dollars(R.fv * .04 / 12) + " a month");
  says("home", "Sam puts in the $10,000 plus " + dollars(R.contribTotal) + " of contributions");
  says("home", "growth supplies the other " + dollars(R.growth));
  says("home", "$750 a month instead of $500: " + dollars(basic({ contrib: 750 }).fv));
  eq(RISK_LEVELS[3].real, .0575, "Growth is 5.75% after inflation");
  says("home", "instead of balanced: " + dollars(basic({ real: RISK_LEVELS[3].real }).fv));
  var r60 = basic({ years: 30 }).fv;
  says("home", "Retire at 60 instead of 65: " + dollars(r60) + ", about " + Math.round((1 - r60 / R.fv) * 100) + "% less");
  says("home", "savings need to cover $26,000: about " + dollars(26000 * 25));
  says("home", "buys what about " + dollars(Math.round(1e6 / Math.pow(1.03, 35) / 1000) * 1000) + " buys today");

  var p = { period: "Monthly", years: 35, initial: 10000, contrib: 500, growth: .03, nominal: .085, inflation: .03, withdrawal: .04, taxRate: .1 };
  var a = project(p).fvReal, b = project(Object.assign({}, p, { nominal: .085 - .01 })).fvReal;   // fees come off the return
  says("advanced", "With no fees: " + dollars(a));
  says("advanced", "actively managed fund: " + dollars(b));
  says("advanced", "The difference: " + dollars(a - b) + ", or " + Math.round((1 - b / a) * 100) + "%");
  var B60 = backtest({ stockPct: 60, fee: 0, initial: 1e4, startYear: 1926, endYear: 2025 });
  var B100 = backtest({ stockPct: 100, fee: 0, initial: 1e4, startYear: 1926, endYear: 2025 });
  says("advanced", "the " + pct1(B60.cagr) + " a year that 60% stocks and 40% bonds earned");
  says("advanced", "All stocks earned " + pct1(B100.cagr));
})();

group("Articles: Stages");
(function () {
  var g = { initial: 10000, inflation: .03, withdrawal: .04, taxRate: .1, fees: 0 };
  function st(c) { return { years: 10, contrib: c, period: "Monthly", growth: 0, nominal: .085, vol: .15 }; }
  var up = projectSeries(g, [st(400), st(900), st(1500)]).fvReal;
  var down = projectSeries(g, [st(1500), st(900), st(400)]).fvReal;
  var flat = projectSeries(g, [{ years: 30, contrib: 336000 / 360, period: "Monthly", growth: 0, nominal: .085, vol: .15 }]).fvReal;
  eq(400 * 120 + 900 * 120 + 1500 * 120, 336000, "the three patterns save the same total");
  says("stages", "ends with " + dollars(up) + " in today's dollars");
  says("stages", "$933 a month for 30 years ends with " + dollars(flat));
  says("stages", dollars(down) + ", " + Math.round((down / up - 1) * 100) + "% more");
  says("stages", "anywhere from " + dollars(up) + " to " + dollars(down));
})();

group("Articles: Drawdown");
(function () {
  var o = { initial: 1e6, years: 30, stockPct: 60, initialPct: 4, strategy: "fixed", fee: 0, guardBand: 20, adjustPct: 10,
            floorPct: 10, ceilPct: 10, yaleRate: 5, yaleWeight: 70, vpwRate: 3.8, vpwFV: 0 };
  var H = historicalBacktest(o);
  says("drawdown", "survived " + pct1(H.successRate) + " of the 30-year retirements");
  says("drawdown", "began in " + H.failYears.slice(0, 3).join(", ") + " and " + H.failYears[3]);
  var y66 = runDrawdown(o, seqFrom(1966, 30));
  says("drawdown", "Retiring in 1966, the money ran out in year " + y66.depletedYear);
  says("drawdown", "about $" + (Math.round(H.medianEnd / 1e5) / 10) + " million left after 30 years");
  var H35 = historicalBacktest(Object.assign({}, o, { initialPct: 3.5 }));
  eq(H35.successRate, 1, "3.5% never failed");
  says("drawdown", "At 3.5%: $35,000 a year, and the plan survived 100%");
  says("drawdown", "4% survived " + pct1(historicalBacktest(Object.assign({}, o, { years: 40 })).successRate));
  var G = Object.assign({}, o, { strategy: "guardrails", initialPct: 5 });
  eq(historicalBacktest(G).successRate, 1, "5% guardrails lasted every time");
  var g66 = runDrawdown(G, seqFrom(1966, 30));
  says("drawdown", "cut as low as " + dollars(Math.min.apply(null, g66.rows.map(function (r) { return r.realSpend; }))) + " a year");
})();

group("Articles: Bridge");
(function () {
  says("bridge", "$540,000 in all");
  says("bridge", "five years of spending from other sources first, " + dollars(5 * 60000));
  says("bridge", "from the whole $1,000,000 is " + dollars(1e6 * brAmortFactor(.05, 50)) + " a year");
  says("bridge", "taxable income stays under " + dollars(LTCG_2026.m[0]));
  says("bridge", "ACA credits stop above " + dollars(hcFPL(2) * 4) + " for a household of two");
})();

group("Articles: Roth conversions and RMDs");
(function () {
  var d = RC_DEFAULTS, inp = { age: d.age, spouseAge: d.spouseAge, status: d.status, state: d.state, endAge: d.endAge,
    trad: d.trad, roth: d.roth, brokerage: d.brok, basisPct: d.basis / 100, ret: d.ret / 100, spend: d.spend,
    ss: d.ss, ssAge: d.ssAge, spSS: d.spSS, spSSAge: d.spSSAge, other: d.other, otherStart: d.otherStart,
    deathYear: d.death, strategy: d.strategy, bracket: parseFloat(d.bracket), irmaaTarget: 0, fixedAmt: d.fixed,
    pctAmt: d.pct / 100, startAge: d.startAge, stopAge: d.stopAge, payFrom: d.payFrom, heirRate: d.heir / 100,
    disc: d.disc / 100, irmaaOn: true };
  var P = runRoth(inp, true), B = runRoth(inp, false);
  says("roth", "that's " + dollars(P.rows[0].conv) + " in the first year");
  near(P.rows[0].conv, FED_2026.m[3][0] + FED_STD.m, .01, "fills the 22% bracket: its top plus the standard deduction");
  says("roth", "22% bracket for a couple (" + dollars(FED_2026.m[3][0]) + ") plus the " + dollars(FED_STD.m));
  var lastConv = P.rows.filter(function (r) { return r.conv > 0; }).pop();
  says("roth", "By " + lastConv.age + " the traditional accounts are empty, " + dollars(P.totalConv) + " converted");
  eq(P.peakRMD, 0, "no RMDs with conversions");
  says("roth", "would have peaked at " + dollars(B.peakRMD) + " a year");
  says("roth", dollars(P.lifeTax) + " with conversions against " + dollars(B.lifeTax) + " without");
  says("roth", "converting saves " + dollars(B.lifeTaxPV - P.lifeTaxPV));
  says("roth", "IRMAA totals " + dollars(P.lifeIrmaa) + " instead of " + dollars(B.lifeIrmaa));
  says("roth", "at " + P.rows.filter(function (r) { return r.irmaa > 0; }).map(function (r) { return r.age; }).join(", ").replace(/, (\d+)$/, " and $1") + ",");
  says("roth", "What's left at " + d.endAge + ": " + dollars(P.endAfterTax - B.endAfterTax) + " more");
  says("roth", "at " + Math.round((1 - d.heir / 100) * 100) + " cents");

  var first = B.rows.filter(function (r) { return r.rmd > 0; })[0];
  eq(first.age, 75, "RMDs start at 75 for someone 62 in 2026");
  says("rmd", "reaches " + dollars(first.tradBegin) + " by 75");
  says("rmd", dollars(first.tradBegin) + " ÷ " + ultDivisor(75) + ", the IRS factor at 75, is " + dollars(first.rmd));
  says("rmd", "about " + dollars(d.ss + d.spSS) + " of Social Security");
  says("rmd", "peak at " + dollars(B.peakRMD) + " in a single year");
  says("rmd", "a $1,000,000 balance means an RMD of about " + dollars(1e6 / ultDivisor(75)));
  says("rmd", "IRMAA line (" + dollars(IRMAA.tiers[0].m) + " joint)");
})();

group("Articles: Healthcare");
(function () {
  var gross = 2 * hcGrossPremium("IL", 62, 0), fpl = hcFPL(2);
  function aca(m) { return hcCalcACA(m, gross, m / fpl, false); }
  says("healthcare", "lists at " + dollars(gross) + " a month");
  var lo = aca(40000);
  says("healthcare", "they pay " + (lo.pct * 100).toFixed(2) + "% of it, " + dollars(lo.net) + " a month");
  var under = aca(84000), over = aca(85000);
  eq(over.eligible, false, "no credit over the cliff");
  says("healthcare", dollars(under.net) + " a month or " + dollars(under.net * 12) + " a year");
  says("healthcare", "pay the full " + dollars(over.net) + " a month, " + dollars(over.net * 12) + " a year");
  says("healthcare", "costs them " + dollars((over.net - under.net) * 12) + " in premiums");
  says("healthcare", dollars(hcFPL(1) * 4) + " for one person and " + dollars(fpl * 4) + " for a household of two");
  says("healthcare", "$" + (IRMAA.tiers[1].b - IRMAA.partB).toFixed(2) + " a month more per person");
  says("healthcare", "$" + IRMAA.partB.toFixed(2) + " a month in 2026");
})();

group("Articles: FIRE");
(function () {
  // The FIRE tool's steady path: project() in today's dollars, the crossing
  // interpolated within its year.
  var real = (1.085 / 1.03) - 1;
  function cross(contrib, coast) {
    var pp = project({ initial: 10000, contrib: contrib, period: "Monthly", growth: 0, nominal: .085, inflation: .03,
                       years: 70, withdrawal: 0, taxRate: 0 });
    var prev = 10000, prevCn = 1e6 / Math.pow(1 + real, 35);
    for (var i = 0; i < pp.years.length; i++) {
      var y = pp.years[i], rb = y.end / Math.pow(1.03, y.year);
      if (!coast) { if (rb >= 1e6) return (y.year - 1) + (1e6 - prev) / (rb - prev); prev = rb; continue; }
      var cn = 1e6 / Math.pow(1 + real, 35 - y.year);
      if (rb >= cn) { var pd = prev - prevCn, cd = rb - cn; return (y.year - 1) - pd / (cd - pd); }
      prev = rb; prevCn = cn;
    }
  }
  function f1(x) { return x.toFixed(1); }
  says("fire", "about " + pct1(real) + " a year after inflation");
  [[1000, "in "], [2000, ""], [2500, ""]].forEach(function (c) {
    var y = cross(c[0], false);
    says("fire", c[1] + f1(y) + " years, at " + f1(30 + y));
  });
  says("fire", "stop saving entirely at " + f1(30 + cross(2000, true)));
})();

group("Articles: Backtest");
(function () {
  function bt(s) { return backtest({ stockPct: s, fee: 0, initial: 1e4, startYear: 1926, endYear: 2025 }); }
  function roll(B, len) { return B.rolling.filter(function (r) { return r.len === len; })[0]; }
  var S = bt(100), M = bt(60), N = bt(0);
  says("backtest", "All stocks: " + pct1(S.cagr) + " a year, or " + pct1(S.realCagr) + " after inflation");
  says("backtest", "rose in " + S.upYears + " of the 100 years");
  says("backtest", "worst single year was " + pct1(roll(S, 1).nomWorst).replace("-", "−"));
  says("backtest", "from the " + S.ddFrom + " peak to the " + S.ddTo + " bottom the portfolio lost " + Math.round(-S.maxDD * 100) + "%");
  says("backtest", pct1(M.cagr) + " a year, " + pct1(M.realCagr) + " after inflation. The worst year was " + pct1(roll(M, 1).nomWorst).replace("-", "−"));
  says("backtest", "the deepest fall " + Math.round(-M.maxDD * 100) + "%");
  says("backtest", "Giving up " + pct1(S.cagr - M.cagr).replace("%", "") + " points");
  says("backtest", "about " + Math.round((1 - M.maxDD / S.maxDD) * 10) * 10 + "%");
  says("backtest", "All bonds: " + pct1(N.cagr) + " a year, but only " + pct1(N.realCagr) + " after inflation");
  says("backtest", Math.round(-N.maxDD * 100) + "% from " + N.ddFrom + " to " + N.ddTo);
  says("backtest", "still earned " + pct1(roll(S, 20).realWorst) + " a year after inflation, and the worst 30-year stretch earned " + pct1(roll(S, 30).realWorst));
  near(roll(M, 20).realWorst, 0, .001, "60/40's worst 20 years roughly broke even after inflation");
  says("backtest", "worst 30 years earned " + pct1(roll(M, 30).realWorst));
  eq(HIST_STOCK.indexOf(Math.min.apply(null, HIST_STOCK)) + 1926, 1931, "the worst year is 1931");
  says("backtest", "2008 came close, at about −" + Math.round(-HIST_STOCK[2008 - 1926]) + "%");
})();

group("Articles: Income tax");
(function () {
  var T = computeTax({ status: "s", gross: 100000, pre: 0, dedType: "std", item: 0, state: "IL" });
  says("incometax", "less the " + dollars(FED_STD.s) + " standard deduction leaves " + dollars(100000 - FED_STD.s) + " taxable");
  says("incometax", "comes to " + dollars(T.federal));
  says("incometax", "7.65% of wages, " + dollars(T.fica));
  says("incometax", "a small exemption, " + dollars(T.state));
  says("incometax", "Take-home: " + dollars(T.takeHome) + " a year, after " + dollars(T.total) + " in total tax");
  eq(T.marginal, .22, "22% bracket");
  says("incometax", "federal income tax is only " + pct1(T.federal / 100000) + " of pay");
  var K = computeTax({ status: "s", gross: 100000, pre: 10000, dedType: "std", item: 0, state: "IL" });
  says("incometax", "drops Taylor's federal tax to " + dollars(K.federal) + " and Illinois tax to " + dollars(K.state));
  says("incometax", "Take-home falls by only " + dollars(T.takeHome - K.takeHome));
  eq(K.fica, T.fica, "FICA unchanged by a 401(k) contribution");
  var R = computeRetireTax({ status: "m", seniors: 2, trad: 60000, roth: 0, brok: 0, gainPct: 0, ss: 48000, pension: 0,
    penPublic: false, other: 0, pre: 0, dedType: "std", item: 0, state: "IL", _noMarginal: true });
  says("incometax", "pays " + dollars(R.federal) + " of federal tax");
  eq(R.state, 0, "Illinois taxes none of it");
  var b = FED_2026.s, m = FED_2026.m;
  says("incometax", "10% to " + dollars(b[1][0]) + ", 12% to " + dollars(b[2][0]) + ", 22% to " + dollars(b[3][0]) + ", 24% to " + dollars(b[4][0]) +
    ", 32% to " + dollars(b[5][0]) + ", 35% to " + dollars(b[6][0]));
  says("incometax", "10% to " + dollars(m[1][0]) + ", 12% to " + dollars(m[2][0]) + ", 22% to " + dollars(m[3][0]) + ", 24% to " + dollars(m[4][0]) +
    ", 32% to " + dollars(m[5][0]) + ", 35% to " + dollars(m[6][0]));
  says("incometax", "under " + dollars(LTCG_2026.s[0]) + " single or " + dollars(LTCG_2026.m[0]) + " joint");
  says("incometax", "wages up to " + dollars(FICA.ssCap));
})();

group("Articles: Mortgage and rent vs. buy");
(function () {
  var m = { price: 450000, down: 90000, rate: .065, term: 30, taxPct: .011, ins: 1800, pmiPct: 0, hoa: 0, maintPct: .01, util: 300 };
  var M = mortgage(m);
  says("mortgage", "Principal and interest: " + dollars(M.pi) + " a month");
  says("mortgage", "(" + dollars(M.tax) + " a month) and $1,800 a year of insurance (" + dollars(M.ins) + "), the housing payment is " + dollars(M.pi + M.tax + M.ins));
  says("mortgage", dollars(M.totalInterest) + " over 30 years");
  var X = mortgage(Object.assign({}, m, { extraMonthly: 200 }));
  says("mortgage", "gone in " + X.payoffMonth + " months");
  says("mortgage", "saves " + dollars(M.totalInterest - X.totalInterest) + " of interest");
  var F = mortgage(Object.assign({}, m, { rate: .0575, term: 15 }));
  says("mortgage", dollars(F.pi) + " a month, " + dollars(F.pi - M.pi) + " more, but total interest of " + dollars(F.totalInterest));
  ok(F.totalInterest < .4 * M.totalInterest, "15-year interest under 40% of the 30-year's");
  var P = mortgage(Object.assign({}, m, { down: 45000, pmiPct: .006 }));
  says("mortgage", "adds " + dollars(P.pmi) + " a month");
  says("mortgage", "in month " + P.pmiEndMonth + ", " + dollars(P.pmiPaid) + " in all");

  var rb = { price: 450000, downPct: 20, rate: 6.5, term: 30, propTax: 1.1, ins: 1800, maint: 1, closePct: 3, sellPct: 3,
             rent: 1800, rentInc: 3.2, appr: 4, invest: 7, horizon: 30, gainTax: 15, status: "m" };
  var R = rentBuyCalc(rb), L = R.years[29];
  says("rentbuy", dollars(R.monthlyBuy) + " a month in the first year: " + dollars(R.pi) + " of principal and interest");
  says("rentbuy", "also spends " + dollars(R.initialInvest) + " on the down payment");
  eq(R.breakEven, null, "at $1,800 rent, renting stays ahead");
  says("rentbuy", "worth " + dollars(L.renterNW) + " against the buyer's " + dollars(L.buyerNW) + " in home equity and savings, a " + dollars(L.renterNW - L.buyerNW) + " lead");
  var R2 = rentBuyCalc(Object.assign({}, rb, { rent: 2400 }));
  says("rentbuy", "buying pulls ahead in year " + R2.breakEven + " and leads by " + dollars(R2.years[29].buyerNW - R2.years[29].renterNW));
  says("rentbuy", "At $1,800 a month it's about " + Math.round(450000 / 21600) + "; at $2,400 it's about " + Math.round(450000 / 28800));
})();

group("Articles: College, budget and debt");
(function () {
  function cs(o) { return collegeSavingsCalc(Object.assign({ yearsUntil: 18, annualCost: 27000, tuitionInfl: .04, investRet: .06, saved: 0, collegeYrs: 4 }, o)); }
  var C = cs({});
  says("college", "make the first year " + dollars(C.yearCosts[0]));
  says("college", dollars(C.monthly) + " a month from birth covers all four years");
  says("college", "hold " + dollars(C.targetAtStart) + " on the first day");
  says("college", "it's " + dollars(cs({ yearsUntil: 10 }).monthly) + " a month for the same school");
  says("college", "would take " + dollars(cs({ annualCost: 59000 }).monthly) + " a month from birth");
  says("college", "about $" + Math.round(C.monthly / 10) * 10 + " a month from birth");
  says("college", "closer to $" + Math.round(cs({ yearsUntil: 10 }).monthly / 10) * 10);

  says("budget", "would put " + dollars(6000 * .5) + " toward needs");
  says("budget", dollars(6000 * .3) + " toward wants");
  says("budget", "and " + dollars(6000 * .2) + " toward saving");
  says("budget", "six months of spending is " + dollars(6 * 4000));

  var D = DEBT_DEFAULTS;
  var tot = D.reduce(function (a, x) { return a + x.balance; }, 0), mins = D.reduce(function (a, x) { return a + x.min; }, 0);
  says("debt", "owes " + dollars(tot) + " across four debts");
  says("debt", "add up to " + dollars(mins) + " a month");
  var av = debtRun(D, 300, "avalanche"), sn = debtRun(D, 300, "snowball"), mn = debtRun(D, 0, "min"), av4 = debtRun(D, 400, "avalanche");
  says("debt", "Minimums only: " + mn.monthsTotal + " months");
  says("debt", "and " + dollars(mn.totalInterest) + " of interest");
  says("debt", "debt-free in " + av.monthsTotal + " months");
  says("debt", "paying " + dollars(av.totalInterest) + " of interest. That's " + dollars(mn.totalInterest - av.totalInterest) + " less");
  says("debt", "Debt-free in " + sn.monthsTotal + " months with " + dollars(sn.totalInterest) + " of interest");
  says("debt", dollars(sn.totalInterest - av.totalInterest) + " more than avalanche");
  says("debt", "finishes in " + av4.monthsTotal + " months with " + dollars(av4.totalInterest));
  eq(av.order[0].desc, "Credit card", "avalanche starts with the card");
  eq(sn.order[0].desc, "Store card", "snowball starts with the store card");
})();

group("Plan engine: taxes, accounts and the rules");
(function () {
  // The tax cache reads the whole return back within a few dollars.
  var c = plTaxCache("m", "CA");
  [[0, 0, 0, 0], [61234, 0, 0, 0], [84321, 23456, 0, 1], [150000, 40000, 42000, 2], [233210, 12000, 30000, 2]].forEach(function (t) {
    var want = computeRetireTax({status: "m", state: "CA", trad: t[0], roth: 0, brok: t[1], gainPct: 1, ss: t[2], pension: 0,
      penPublic: false, other: 0, pre: 0, dedType: "std", item: 0, seniors: t[3], _noMarginal: true}).total;
    near(plTax(c, t[3], t[2], t[0], t[1]), want, 6, "cached tax at " + t.join("/"));
  });
  // The fast federal pieces agree with the full return.
  [[40000, 5000, 30000, 0], [70000, 0, 45000, 2], [20000, 10000, 60000, 1]].forEach(function (t) {
    var R = computeRetireTax({status: "m", state: "TX", trad: t[0], roth: 0, brok: t[1], gainPct: 1, ss: t[2], pension: 0,
      penPublic: false, other: 0, pre: 0, dedType: "std", item: 0, seniors: t[3], _noMarginal: true});
    near(plAgi(t[0], t[1], t[2], "m"), R.agi, 0.01, "AGI at " + t.join("/"));
    near(plOrdTaxable(t[0], t[1], t[2], "m", t[3]), R.ordTaxable, 0.01, "ordinary taxable income at " + t.join("/"));
  });
  // Saving: the same projection the Basic tab makes (Sam, from the home article).
  near(plGrow(10000, 500, .045, 35, 35, BASIC_INFL).fv, projectBasic({years: 35, real: .045, initial: 10000, contrib: 500, period: "Monthly", withdrawal: .04}).fv, 0.01, "plGrow is Basic's projection");

  function flat(n, r, pi) { var a = new Float64Array(100), b = new Float64Array(100); a.fill(r); b.fill(pi); return {r: a, pi: b}; }
  function run(P, T, r, pi, want) {
    var C = plPrep(Object.assign({status: "s", state: "TX", years: 20, spend: 0, mix: 60, heirRate: .24, rmdAge: 75}, P));
    var K = plTactics(C, Object.assign(plBaseTactics(C), T || {}));
    var F = flat(C.years, r || 0, pi || 0), out = {rows: []};
    var res = plRun(C, K, F.r, F.pi, 0, out);
    res.rows = out.rows;
    return res;
  }
  // Roth money only, no growth: $10,000 a year from $100,000 lasts ten years, tax-free.
  var A = run({age1: 66, roth: 100000, rothBasis: 100000, spend: 10000, years: 15});
  eq(A.depleted, 11, "a $100,000 Roth spending $10,000 a year runs short in year 11");
  near(A.tax, 0, 0.01, "Roth withdrawals owe no tax");
  // Before 59½ a traditional withdrawal carries the 10% additional tax, unless
  // the rule of 55 opens the 401(k).
  var B = run({age1: 56, trad: 400000, spend: 30000, years: 3});
  ok(B.pen > 0 && Math.abs(B.rows[0].pen - B.rows[0].trad * .10) < 1, "10% on early traditional withdrawals", "pen " + B.rows[0].pen + " of " + B.rows[0].trad);
  var B2 = run({age1: 56, trad: 400000, spend: 30000, years: 3, rule55: true});
  near(B2.pen, 0, 0.01, "no penalty under the rule of 55");
  // Required distributions: the Uniform Lifetime Table divisor, from the first year.
  var D = run({age1: 76, trad: 1000000, spend: 0, years: 2});
  near(D.rows[0].rmd, 1000000 / ultDivisor(76), 0.01, "RMD at 76 is the balance over " + ultDivisor(76));
  near(D.rows[0].surplus, D.rows[0].rmd - D.rows[0].tax, 1, "an RMD you don't need, less its tax, is reinvested");
  // A conversion made before 59½ can be spent five years later, not sooner.
  var E = run({age1: 50, trad: 600000, roth: 0, rothBasis: 0, brok: 150000, brokBasis: 150000, spend: 40000, years: 12},
    {f: 3, u: 2});
  ok(E.rows[0].conv > 1000, "converts in the first year", "conv " + E.rows[0].conv);
  var firstRoth = E.rows.findIndex(function (r) { return r.roth > 1; });
  ok(firstRoth >= 5 || firstRoth < 0, "Roth money spent no sooner than five years on", "first Roth draw in year " + (firstRoth + 1));
  // The ACA guard keeps a converting plan under the subsidy cliff.
  var G = run({age1: 60, state: "IL", trad: 900000, brok: 100000, brokBasis: 80000, spend: 45000, years: 5, aca: true, household: 1},
    {f: 5, u: 2, ac: 1});
  ok(G.rows.every(function (r) { return r.fplPct == null || r.fplPct <= 4; }), "income stays under 400% of the poverty line",
    G.rows.map(function (r) { return r.fplPct && r.fplPct.toFixed(2); }).join(" "));
  var G2 = run({age1: 60, state: "IL", trad: 900000, brok: 100000, brokBasis: 80000, spend: 45000, years: 5, aca: true, household: 1},
    {f: 5, u: 2, ac: 0});
  ok(G2.health > G.health, "without the guard, filling the 24% bracket loses the subsidy", G2.health + " vs " + G.health);
  // Social Security: own benefits by claiming age, and the spousal top-up.
  var S = plSSParts({P: {pia1: 3000, pia2: 500}, married: true, gap: 0}, {c1: 67, c2: 67});
  near(S.own1, 36000, 0.01, "full benefit at 67");
  near(S.top2, 12000, 0.01, "spousal top-up to half the higher benefit");
  var S2 = plSSParts({P: {pia1: 3000, pia2: 500}, married: true, gap: 0}, {c1: 70, c2: 62});
  near(S2.own1, 36000 * 1.24, 0.01, "8% a year past 67");
  near(S2.own2, 6000 * .7, 0.01, "30% less at 62");
  near(S2.top2, 12000, 0.01, "the spousal top-up waits for both claims, and at 70 it's unreduced");
})();

group("Plan Optimizer");
(function () {
  var P = plAtRetire({status: "s", state: "IL", age: 62, retire: 62, trad: 800000, roth: 50000, rothBasis: 30000,
    brok: 150000, brokBasis: 90000, saveTrad: 0, saveRoth: 0, saveBrok: 0, real: .045, infl: BASIC_INFL,
    spend: 55000, pia1: 2400, claim1: 67, pension: 0, aca: true, household: 1, heirRate: .24, mix: 60, years: 33, target: .9});
  var R = plOptimizeNow(P, "legacy");
  eq(R.of, 9 * 61, "every claiming age and every way of drawing it down: " + R.of + " plans");
  eq(R.windows, 100 - 33 + 1, "each through every historical start");
  ok(R.best.stats.medLegacy >= R.base.stats.medLegacy, "the best plan leaves at least as much as the usual way");
  ok(R.best.stats.successRate >= R.base.stats.successRate - 1e-9, "and lasts as often");
  var T = R.best.T;
  eq(T.c1 + "," + T.f + "," + T.u + "," + T.ac, "70,3,1,1", "Maria: claim at 70, fill the 12% bracket, convert until Social Security, under the ACA cliff");
  says("optimizer", dollars(R.base.stats.medTax));
  says("optimizer", dollars(R.base.stats.medLegacy));
  says("optimizer", dollars(R.best.stats.medTax));
  says("optimizer", dollars(R.best.stats.medLegacy));
  says("optimizer", dollars(R.base.stats.medTax - R.best.stats.medTax) + " less");
  says("optimizer", dollars(R.best.stats.medLegacy - R.base.stats.medLegacy) + " more");
  eq(R.base.stats.successRate + R.best.stats.successRate, 2, "both last in every market, as the article says");
  // The steps add up to the whole gain.
  var sum = R.steps.reduce(function (a, s) { return a + s.to.medLegacy - s.from.medLegacy; }, 0);
  near(sum, R.best.stats.medLegacy - R.base.stats.medLegacy, 0.01, "what each change is worth adds up to the total");
})();

group("Articles: the readiness guide's score");
(function () {
  var w = {};
  GD_FACTORS.forEach(function (f) { w[f.id] = f.w; });
  says("guide", "Retirement outlook, " + w.outlook + " points");
  says("guide", "Savings rate, " + w.rate + " points");
  says("guide", "Emergency fund, " + w.cushion + " points");
  says("guide", "Debt, " + w.debt + " points");
  says("guide", "Monthly cash flow, " + w.flow + " points");
  eq(gdRating(85).label, "On track", "85 is on track"); eq(gdRating(84).label, "Nearly there", "84 is nearly there");
  eq(gdRating(70).label, "Nearly there", "70"); eq(gdRating(69).label, "Getting there", "69");
  eq(gdRating(50).label, "Getting there", "50"); eq(gdRating(49).label, "Needs work", "49");
  eq(gdRating(30).label, "Needs work", "30"); eq(gdRating(29).label, "Needs attention", "29");
})();

endGroup();
out("\n" + passes + " checks passed, " + failures + " failed");
if (failures) throw new Error(failures + " check(s) failed");
