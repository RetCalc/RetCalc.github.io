/* Calculators that lived in the app's screen code rather than the engine:
   college savings and rent vs. buy, from src/js/app/14-college-rentbuy.js,
   the default PMI rate from 12-mortgage.js, and the Basic calculator's
   projection and defaults from 20-basic.js and 00-core.js. Moved without changes to the
   math: only `export` is added. Tested by tests/math.test.js
   (python3 tests/run.py --web). */

import { PPY } from "./math.js";

/* PMI only exists below 20% down; this is the rate assumed when it applies. */
export const PMI_DEFAULT = 0.6;

/* ---------- college and rent-vs-buy math ---------- */
/* College savings engine.
   Projects 4 annual tuition bills growing at tuition inflation, finds the
   present value of all payments at the start of college, then solves for the
   monthly contribution that — compounded at the investment return — covers the
   shortfall after existing savings have grown. */
export function collegeSavingsCalc(inp) {
  var yearsUntil  = inp.yearsUntil;
  var annualCost  = inp.annualCost;
  var tuitionInfl = inp.tuitionInfl;
  var investRet   = inp.investRet;
  var saved       = inp.saved;
  var collegeYrs  = inp.collegeYrs;

  // Geometric, not investRet/12: the stated return is an effective annual rate
  // everywhere else in the app, so converting it the simple way would quietly
  // compound to a higher annual return here than the same input produces in
  // the retirement engine.
  var rm = Math.pow(1 + investRet, 1 / 12) - 1;
  var n  = Math.round(yearsUntil * 12);

  // Project the cost of each year of college
  var yearCosts = [];
  for (var y = 0; y < collegeYrs; y++) {
    yearCosts.push(annualCost * Math.pow(1 + tuitionInfl, yearsUntil + y));
  }
  var totalFuture = yearCosts.reduce(function(a, v){ return a + v; }, 0);

  // PV at college start: discount each payment back to year 0 of college
  var targetAtStart = 0;
  for (var i = 0; i < collegeYrs; i++) {
    targetAtStart += yearCosts[i] / Math.pow(1 + investRet, i);
  }

  // How much existing savings grow to by college start
  var savingsAtStart = saved * Math.pow(1 + investRet, yearsUntil);
  var shortfall      = Math.max(0, targetAtStart - savingsAtStart);

  // Monthly contribution needed
  var monthly = 0;
  if (n > 0 && shortfall > 0) {
    monthly = (rm > 0)
      ? shortfall * rm / (Math.pow(1 + rm, n) - 1)
      : shortfall / n;
  }

  // Year-by-year accumulation, walked with the SAME month-by-month arithmetic
  // the contribution was solved with. Compounding annually here instead (with
  // a half-year convention on contributions) left the final row short of the
  // target the headline figure was solved to hit, so the table contradicted
  // the answer above it.
  var bal       = saved;
  var contribYr = monthly * 12;
  var rows      = [];
  var months    = 0;
  for (var yr = 1; yr <= yearsUntil; yr++) {
    var yearStart = bal;
    var yearContrib = 0;
    for (var k = 0; k < 12 && months < n; k++) {
      bal = bal * (1 + rm) + monthly;
      yearContrib += monthly;
      months++;
    }
    var growth = bal - yearStart - yearContrib;
    contribYr = yearContrib;
    rows.push({
      year: yr,
      balance: bal,
      contribs: contribYr,
      growth: growth,
      projCost: annualCost * Math.pow(1 + tuitionInfl, yr)
    });
  }

  return {
    monthly: monthly,
    totalFuture: totalFuture,
    targetAtStart: targetAtStart,
    savingsAtStart: savingsAtStart,
    shortfall: shortfall,
    yearCosts: yearCosts,
    rows: rows
  };
}

/* College savings for several children from one shared account. Each
   child's bills (one a year, at tuition inflation, the first when that child
   starts) are paid from the account as they fall due, and the account takes
   one monthly amount from now until the youngest starts college.
   One level amount for that whole stretch doesn't always fit: a child
   starting soon needs money much faster than a newborn, and a level amount
   big enough for that would keep over-saving for years afterwards. So the
   amount is the smallest level one that never leaves the account short when
   a bill is paid. If the bill that sets it isn't the last one, the account is
   exactly empty just after that bill, and the rest is solved again from
   there, so the amount can step down but never up. With one child this is
   collegeSavingsCalc's answer: the last bill always sets it.
   Same month-by-month arithmetic as collegeSavingsCalc: the return compounds
   geometrically, a contribution lands at each month's end, and a bill due
   that month is paid after it. */
export function collegePlanCalc(inp) {
  var g = Math.pow(1 + inp.investRet, 1 / 12), rm = g - 1;
  var kids = [], bills = [], skipped = 0;
  inp.kids.forEach(function(k, index) {
    if (!(k.annualCost > 0 && k.yearsUntil > 0)) { skipped++; return; }
    var start = Math.max(1, Math.round(k.yearsUntil * 12)), costs = [];
    for (var y = 0; y < k.collegeYrs; y++) {
      var amt = k.annualCost * Math.pow(1 + inp.tuitionInfl, k.yearsUntil + y);
      costs.push(amt);
      bills.push({m: start + 12 * y, amt: amt});
    }
    kids.push({index: index, yearsUntil: k.yearsUntil, start: start, yearCosts: costs,
      total: costs.reduce(function(a, v) { return a + v; }, 0),
      targetAtStart: costs.reduce(function(a, v, j) { return a + v / Math.pow(g, 12 * j); }, 0)});
  });
  if (!kids.length) return null;
  bills.sort(function(a, b) { return a.m - b.m; });
  var endC = Math.max.apply(null, kids.map(function(k) { return k.start; }));
  var endM = bills[bills.length - 1].m;

  // A level contribution c from month s+1 to endC, on a balance b0 at month s,
  // leaves b0*g^(m-s) + c*A(m) - (bills since s, grown) just after month m's
  // bill. Each bill's need for that to be >= 0 is linear in c.
  var phases = [], s = 0, b0 = inp.saved;
  while (s < endC) {
    var best = 0, at = -1;
    for (var i = 0, owed = 0, prevM = s; i < bills.length; i++) {
      var b = bills[i];
      if (b.m <= s) continue;
      owed = owed * Math.pow(g, b.m - prevM) + b.amt; prevM = b.m;
      var k = Math.min(b.m, endC) - s;
      var A = k > 0 ? (rm > 0 ? (Math.pow(g, k) - 1) / rm : k) * Math.pow(g, b.m - s - k) : 0;
      var need = owed - b0 * Math.pow(g, b.m - s);
      if (A <= 0) continue;
      var c = need / A;
      // the latest bill that sets the amount, so a tie doesn't split a phase
      if (c >= best * (1 - 1e-12) && c > 0) { best = Math.max(best, c); at = b.m; }
    }
    if (at < 0 || at >= endC) { phases.push({from: s, to: endC, monthly: Math.max(0, best)}); break; }
    phases.push({from: s, to: at, monthly: best});
    // walk the account to month `at` so the next phase starts from what's
    // really there (zero, up to rounding)
    b0 = collegeWalk(inp.saved, phases, bills, g, at).bal;
    s = at;
  }
  if (!phases.length) phases.push({from: 0, to: endC, monthly: 0});

  // Year by year to the last bill, with what the bills still ahead need
  // at each year's end.
  var rows = [], W = {bal: inp.saved, m: 0};
  for (var yr = 1; yr * 12 - 12 < endM; yr++) {
    var y0 = W.bal, w = collegeWalk(W.bal, phases, bills, g, yr * 12, W.m);
    var needed = 0;
    bills.forEach(function(x) { if (x.m > yr * 12) needed += x.amt / Math.pow(g, x.m - yr * 12); });
    rows.push({year: yr, balance: w.bal, contribs: w.added, paid: w.paid,
      growth: w.bal - y0 - w.added + w.paid, needed: needed});
    W = {bal: w.bal, m: yr * 12};
  }
  var pvToday = bills.reduce(function(a, x) { return a + x.amt / Math.pow(g, x.m); }, 0);
  return {
    monthly: phases[0].monthly,
    phases: phases,
    kids: kids,
    skipped: skipped,
    totalFuture: bills.reduce(function(a, x) { return a + x.amt; }, 0),
    pvToday: pvToday,
    rows: rows
  };
}
/* The shared account from month `from` (default 0) to month `to`, on the
   contribution schedule `phases`. */
export function collegeWalk(bal, phases, bills, g, to, from) {
  var added = 0, paid = 0;
  for (var m = (from || 0) + 1; m <= to; m++) {
    bal *= g;
    for (var p = 0; p < phases.length; p++)
      if (m > phases[p].from && m <= phases[p].to) { bal += phases[p].monthly; added += phases[p].monthly; break; }
    for (var i = 0; i < bills.length; i++) if (bills[i].m === m) { bal -= bills[i].amt; paid += bills[i].amt; }
  }
  return {bal: bal, added: added, paid: paid};
}

/* Rent-vs-buy engine.
   Runs month by month. The side that pays less that month invests the
   difference at the investment return. At each year-end we compute:
   - Buyer net worth = home equity after a hypothetical sale + any savings
   - Renter net worth = invested alternative (down + closing) + any savings
   The break-even year is the first year buyer NW exceeds renter NW. */
export function rentBuyCalc(inp) {
  var price    = inp.price;
  var downPct  = inp.downPct;
  var rate     = inp.rate;
  var term     = inp.term;
  var propTax  = inp.propTax;
  var ins      = inp.ins;
  var maint    = inp.maint;
  var closePct = inp.closePct;
  var sellPct  = inp.sellPct;
  var rent     = inp.rent;
  var rentInc  = inp.rentInc;
  var appr     = inp.appr;
  var invest   = inp.invest;
  var horizon  = inp.horizon;
  // Both sides are valued as if cashed out at each year's end, so each pays
  // tax on its gains then: the portfolios on growth above what went in, the
  // home on gain above the sec. 121 exclusion. Older saved inputs without a
  // rate fall back to 15%, the long-term rate most households pay.
  var gainTax  = (inp.gainTax == null ? 15 : inp.gainTax) / 100;
  var exclusion = inp.status === "s" ? 250000 : 500000;

  var down       = price * downPct / 100;
  var closeAmt   = price * closePct / 100;
  var loan       = price - down;
  var r          = rate / 100 / 12;
  var totalMo    = Math.round(term * 12);
  var pi         = (r > 0 && loan > 0)
    ? loan * r / (1 - Math.pow(1 + r, -totalMo))
    : (totalMo > 0 ? loan / totalMo : 0);
  // Geometric monthly rates, as everywhere else in the app: the inputs are
  // effective annual rates, and dividing by 12 would quietly compound both
  // the home and the portfolio a little faster than stated.
  var ir         = Math.pow(1 + invest / 100, 1 / 12) - 1;
  var apprMo     = Math.pow(1 + appr / 100, 1 / 12) - 1;

  // Property tax, insurance and maintenance were held flat at their entered,
  // today's-dollar amount for the whole horizon while rent climbed every
  // year -- a thumb on the scale for buying that grows with the horizon.
  // This tool has no inflation input of its own for these, so the least
  // invasive fix ties them to the home's own value: property tax literally
  // is a percentage of assessed value, and insurance/maintenance scale with
  // what the home is worth to rebuild or upkeep, not with the dollar figure
  // picked at closing. Insurance is entered as a flat $/yr, so it's carried
  // forward as a fraction of the original price and scaled by the same
  // appreciation ratio property tax and maintenance already move with.
  var insBase    = ins / 12;
  var maintRate  = maint / 100 / 12;

  var renterPort  = down + closeAmt;
  var renterBasis = renterPort;
  var buyerSavings = 0;
  var buyerBasis  = 0;
  var balance     = loan;
  var homeVal     = price;
  var monthRent   = rent;

  // PMI, same rate the mortgage tool defaults to when none is entered, and
  // the same convention it drops PMI with: based on the balance against the
  // ORIGINAL price, matching how a lender's amortization-schedule PMI
  // cancellation actually works, not a moving appraisal.
  var initPmi = (price > 0 && loan / price > .80) ? loan * PMI_DEFAULT / 100 / 12 : 0;
  var initFixedCost = price * propTax / 100 / 12 + insBase + price * maintRate + initPmi;

  var years = [];
  for (var yr = 1; yr <= horizon; yr++) {
    var taxMo = 0, insMo = 0, maintMo = 0, pmiMo = 0;
    for (var mo = 0; mo < 12; mo++) {
      // Once the loan is paid off (a 15-year loan on a 30-year horizon) the
      // payment stops, and so does the cost of owning that it stood for.
      var interest  = balance * r;
      var payment   = Math.min(pi, balance + interest);
      var principal = payment - interest;
      balance = Math.max(0, balance - principal);

      homeVal *= (1 + apprMo);

      pmiMo = (price > 0 && balance / price > .80) ? loan * PMI_DEFAULT / 100 / 12 : 0;
      taxMo = homeVal * propTax / 100 / 12;
      insMo = insBase * (homeVal / price);
      maintMo = homeVal * maintRate;
      var fixedBuyCost = taxMo + insMo + maintMo + pmiMo;

      var buyCostMo  = payment + fixedBuyCost;
      var rentCostMo = monthRent;
      var diff       = rentCostMo - buyCostMo;

      if (diff > 0) {
        buyerSavings += diff; buyerBasis += diff;
      } else {
        renterPort += (-diff); renterBasis += (-diff);
      }
      renterPort   *= (1 + ir);
      buyerSavings *= (1 + ir);
    }
    monthRent *= (1 + rentInc / 100);

    // Closing costs paid at purchase and selling costs both come off the
    // taxable gain on the home.
    var homeGain = homeVal * (1 - sellPct / 100) - price - closeAmt;
    var homeTax  = Math.max(0, homeGain - exclusion) * gainTax;
    var saleNet  = homeVal * (1 - sellPct / 100) - balance - homeTax;
    var buyerNW  = saleNet + buyerSavings - Math.max(0, buyerSavings - buyerBasis) * gainTax;
    var renterNW = renterPort - Math.max(0, renterPort - renterBasis) * gainTax;

    years.push({
      year: yr,
      buyerNW: buyerNW,
      renterNW: renterNW,
      homeVal: homeVal,
      balance: balance,
      monthBuy: payment + taxMo + insMo + maintMo + pmiMo,
      monthRent: monthRent / (1 + rentInc / 100)
    });
  }

  var breakEven = null;
  for (var k = 0; k < years.length; k++) {
    if (years[k].buyerNW >= years[k].renterNW) { breakEven = years[k].year; break; }
  }

  return {
    years: years,
    breakEven: breakEven,
    loan: loan,
    pi: pi,
    initialInvest: down + closeAmt,
    monthlyBuy: pi + initFixedCost
  };
}


/* ---------- the Basic calculator, from src/js/app/20-basic.js and 00-core.js ---------- */
// Starting point when nothing is saved.
export const DEFAULTS = {initial:10000, contrib:500, period:"Bi-Weekly", growth:.04, nominal:.085,
  inflation:.03, years:30, withdrawal:.04, taxRate:.10, vol:.15, fees:0};
export const BASIC_DEFAULTS = {age:30, retire:65, saved:10000, contrib:500, period:"Monthly", risk:.045};

/* Everything in Basic is modeled in real terms: the rate of return already
   has inflation taken out, so every figure is in today's dollars. */
export const RISK_LEVELS = [
  {label:"Very conservative", sub:"mostly cash and bonds",      real:.020},
  {label:"Conservative",      sub:"bond heavy",                 real:.030},
  {label:"Balanced",          sub:"a mix of stocks and bonds",  real:.045},
  {label:"Growth",            sub:"mostly stocks",              real:.0575},
  {label:"Aggressive",        sub:"nearly all stocks",          real:.070}
];
export const BASIC_BAND = .015;

/* Basic's own real-return engine, replacing the old flat-forever contribution
   with one that steps up once a year, the way Advanced's does.

   Basic never asks for an inflation rate -- it only ever shows a single real
   (after-inflation) return. But "the contribution keeps pace with inflation"
   is not a free-standing fact; it has a shape. Held perfectly flat in real
   dollars every single month, a contribution is implicitly rising in nominal
   terms every month too -- continuously, at the same frequency the plan
   compounds. Advanced does something different: it steps the nominal
   contribution up once a year and only converts to today's dollars at the
   very end. Those two are not the same plan, and the gap between them is
   exactly what produced the mismatch: Basic's number was quietly larger
   because "continuously" compounds more advantageously than "once a year."

   To close it without ever surfacing an inflation input, BASIC_INFL is used
   purely to shape the timing of the step -- it cancels out of the return the
   person actually sees. Expressed in today's dollars, a contribution that is
   flat in nominal terms for twelve months and then jumps at the year mark
   loses a little ground every month within that year and recovers it all at
   once at the boundary. The real-dollar contribution multiplier at month j
   of a year (j = 1..periods-per-year) works out to (1+infl)^(-j/ppy) --
   independent of which year it is, so it can be applied directly without
   tracking nominal dollars anywhere. Run that multiplier through the same
   periodic real return Basic has always used, and the result lands within
   a rounding error of Advanced's own fvReal for the same real return and the
   BASIC_INFL is intentionally the same figure "Open in Advanced" assumes when
   it splits the real rate back into a return and an inflation rate, and the
   same inflation Advanced itself starts with, so the tabs agree everywhere. */
export const BASIC_INFL = DEFAULTS.inflation;

export function projectBasic(p){
  const ppy = PPY[p.period];
  const n = Math.floor(p.years * ppy);
  const periodicReal = Math.pow(1 + p.real, 1 / ppy) - 1;
  let bal = p.initial, contribTotal = 0;
  const years = [];
  let yearStart = p.initial, yearContrib = 0, curYear = 1;

  for (let i = 1; i <= n; i++){
    const yearNo = Math.ceil(i / ppy);
    if (yearNo !== curYear){
      years.push({year:curYear, start:yearStart, contrib:yearContrib,
                  growth:bal - yearStart - yearContrib, end:bal});
      yearStart = bal; yearContrib = 0; curYear = yearNo;
    }
    const j = i - (yearNo - 1) * ppy;             // 1..ppy, resets every year
    const c = p.contrib / Math.pow(1 + BASIC_INFL, j / ppy);
    bal = bal * (1 + periodicReal) + c;
    contribTotal += c; yearContrib += c;
  }
  if (n > 0) years.push({year:curYear, start:yearStart, contrib:yearContrib,
                         growth:bal - yearStart - yearContrib, end:bal});

  const fv = bal;
  const invested = p.initial + contribTotal;
  const wd = fv * p.withdrawal;
  return {ppy, periods:n, years, fv, fvReal:fv, invested, growth:fv - invested,
    contribTotal, wd, wdReal:wd, afterTax:wd, afterTaxMo:wd / 12};
}
