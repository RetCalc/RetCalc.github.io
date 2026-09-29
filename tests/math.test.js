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
    s.push({ stock: HIST_STOCK[i], bond: HIST_BOND[i], infl: HIST_INFL[i] });
  }
  return s;
}

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
  near(H.successRate, .944, .001, "success rate since 1926");
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

group("Healthcare: CMS age curve and ACA credits");
(function () {
  near(hcAgeMultiplier(40), 1.278, 1e-9, "age 40"); near(hcAgeMultiplier(60), 2.714, 1e-9, "age 60");
  near(hcAgeMultiplier(64), 3.0, 1e-9, "age 64");
  near(hcContribPctStd(2.84), .0844 + .68 * (.0996 - .0844), 1e-9, "applicable percentage at 284% FPL");
  eq(hcContribPctStd(4.01), null, "no credit above 400% FPL");
  var gross = 2 * hcGrossPremium("IL", 62, 0), R = hcCalcACA(60000, gross, 60000 / hcFPL(2), false);
  near(R.net, 60000 * R.pct / 12, .01, "a couple pays one contribution for both");
})();

endGroup();
out("\n" + passes + " checks passed, " + failures + " failed");
if (failures) throw new Error(failures + " check(s) failed");
