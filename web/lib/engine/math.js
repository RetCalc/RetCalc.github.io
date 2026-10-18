/* The calculation engine: projections, Monte Carlo, taxes, Social Security, RMDs and Roth
   conversions, ACA premiums, mortgages, debt and the historical data.

   Moved from src/js/math.js without changes to the math: the only edits are
   `export` on each top-level name and the imports below. Import the engine
   through typed.ts (core.js), not this file: math.js and drawdown.js read
   each other's names, and core.js loads them in the order that works. */
import {
  HIST_CASH, HIST_SV
} from "./drawdown.js";
import {
  yearData, HIST_START, HIST_M_STOCK, HIST_M_BOND, HIST_M_INFL, ULT
} from "./data/index.js";

// ===MATH START===
/* Type notes for the calculation engine below (checked with `tsc --checkJs`,
   not used at runtime — browsers ignore these comments entirely). Grouping
   the shared shapes here means a typo in a property name anywhere below
   (e.g. p.grwoth) gets flagged instead of silently producing NaN or a wrong
   number. Run: tsc --checkJs --noEmit --allowJs <extracted script> */

/**
 * @typedef {Object} GlidePath
 * @property {boolean} on - whether the return glides down toward an end rate
 * @property {number} years - final N years of the plan over which the rate ramps down
 * @property {number} endRate - annual nominal return at the end of the glide, as a decimal (0.05 = 5%)
 */

/**
 * A single plan or stage's own assumptions. `growth` and `inflation` are
 * independent inputs — growth is never combined with inflation automatically;
 * setting growth equal to inflation is what keeps contributions flat in real terms.
 * @typedef {Object} PlanParams
 * @property {string} period - contribution frequency, a key into PPY (e.g. "Monthly")
 * @property {number} years - length of this plan or stage, in years
 * @property {number} initial - starting balance, in dollars
 * @property {number} contrib - contribution per period, in dollars
 * @property {number} growth - annual growth rate of the contribution amount itself, as a decimal (0.04 = 4%)
 * @property {number} nominal - annual rate of return before inflation, as a decimal
 * @property {number} inflation - annual inflation rate, as a decimal
 * @property {number|""|null} [inflYears] - years to deflate over when converting to today's dollars; blank/null defaults to `years`
 * @property {number} [withdrawal] - annual withdrawal rate applied to the ending balance, as a decimal (only needed by project/goalSolve)
 * @property {number} [taxRate] - flat tax rate applied to the withdrawal, as a decimal (only needed by project/goalSolve)
 * @property {GlidePath} [glide] - optional declining-return glide path
 */

/**
 * The parts of a staged plan that don't belong to any one stage.
 * @typedef {Object} GlobalParams
 * @property {number} initial - starting balance, in dollars
 * @property {number} inflation - annual inflation rate, as a decimal
 * @property {number|""|null} [inflYears] - years to deflate over; blank/null defaults to the total plan length
 * @property {number} withdrawal - annual withdrawal rate applied to the ending balance, as a decimal
 * @property {number} taxRate - flat tax rate applied to the withdrawal, as a decimal
 */

/**
 * One stage in a multi-stage plan. Same shape as PlanParams minus `initial`
 * (stages chain off the prior stage's ending balance) plus optional `vol`
 * for Monte Carlo.
 * @typedef {Object} StageParams
 * @property {string} period
 * @property {number} years
 * @property {number} contrib
 * @property {number} growth
 * @property {number} nominal
 * @property {number} [vol] - annual return volatility (standard deviation), as a decimal, used only by monteCarlo
 * @property {GlidePath} [glide]
 */

/**
 * A one-time or recurring income/expense line item in the Drawdown tool
 * (the "Add income source" / "Add future expense" popups).
 * @typedef {Object} CustomItem
 * @property {string} name
 * @property {number} annual - amount in today's dollars
 * @property {boolean} inflate - whether this amount rises with inflation each year
 * @property {number} startYear - 1-based year it begins, matching runDrawdown's row numbering
 * @property {{type: "once"|"years"|"forever", years?: number}} duration
 * @property {boolean} [on] - if explicitly false, this item is ignored
 */

/**
 * Inputs to one retirement drawdown run.
 * @typedef {Object} DrawdownOptions
 * @property {number} initial - starting portfolio balance, in dollars
 * @property {number} years - length of the retirement, in years
 * @property {number} stockPct - stock allocation, 0-100 (not a decimal)
 * @property {number} initialPct - starting withdrawal rate, 0-100 (not a decimal)
 * @property {"fixed"|"pct"|"guardrails"|"floorceil"|"yale"|"vpw"} strategy
 * @property {number} [guardBand] - guardrails: how far above the starting rate the upper guardrail sits, percent
 * @property {number} [adjustPct] - guardrails: the cut when the upper guardrail is crossed, percent
 * @property {number} [guardBandLo] - guardrails: how far below the starting rate the lower guardrail sits, percent (defaults to guardBand)
 * @property {number} [raisePct] - guardrails: the raise when the lower guardrail is crossed, percent (defaults to adjustPct)
 * @property {number} [gkFinalYears] - guardrails: no cuts in this many final years of the plan (0 or missing: cuts all the way)
 * @property {number} [floorPct] - floor-and-ceiling max cut, percent
 * @property {number} [ceilPct] - floor-and-ceiling max raise, percent
 * @property {number} [yaleRate] - Yale rule target percentage of current balance
 * @property {number} [yaleWeight] - Yale rule weight on last year's spending, 0-100
 * @property {number} [spendFloor] - absolute dollar floor on spending, in today's dollars (0 disables)
 * @property {number} [spendCeil] - absolute dollar cap on the strategy's spending, in today's dollars (0 disables); custom expenses can still take a year past it
 * @property {number} [vpwRate] - VPW's expected real rate of return, percent
 * @property {number} [vpwFV] - VPW's future value: what the plan aims to leave at the end, in today's dollars
 * @property {number} [fee] - annual fee drag, percent
 * @property {number} [ssAnnual] - primary Social Security benefit, in today's dollars
 * @property {number} [ssDelayYears] - years into retirement before the primary benefit starts
 * @property {number} [ssAnnual2] - spouse's Social Security benefit, in today's dollars (only ever set apart from ssAnnual when retireAge lets each spouse's benefit start at their own claiming age)
 * @property {number} [ssDelayYears2] - years into retirement before the spouse's benefit starts
 * @property {number} [ssAnnual3] - a spousal top-up, in today's dollars, which starts only once both spouses have claimed
 * @property {number} [ssDelayYears3] - years into retirement before the spousal top-up starts
 * @property {number|null} [retireAge] - age at retirement; when set, tables/charts show age instead of years into retirement, and Social Security timing is driven by claiming age(s) instead of ssDelayYears
 * @property {CustomItem[]} [expenseItems]
 * @property {CustomItem[]} [incomeItems]
 */

export const PPY = {"Weekly":52,"Bi-Weekly":26,"Monthly":12,"Quarterly":4,"Annually":1};

// Period-by-period engine. Contributions post at the end of each period; the
// contribution amount steps up once per year. A partial final period is dropped.
/* Glide path: the annual return steps down linearly from the plan's own rate
   to a chosen end rate over its final N years, then stays flat before that.
   Interpolating the ANNUAL rate (not the periodic one) keeps "8% down to 5%"
   meaning what it sounds like, regardless of contribution frequency; each
   period within a year uses that year's blended annual rate converted to a
   periodic one, the same granularity contribution growth already uses. */
/**
 * @param {number} yearNo - which year of the plan this is (1-based)
 * @param {number} totalYears - total length of the plan/stage, in years
 * @param {number} glideYears - final N years over which the rate ramps down
 * @param {number} startRate - annual nominal return before the glide starts, as a decimal
 * @param {number} endRate - annual nominal return at the end of the glide, as a decimal
 * @returns {number} the blended annual rate for yearNo, as a decimal
 */
export function glideAnnualRate(yearNo, totalYears, glideYears, startRate, endRate){
  if (!glideYears || glideYears <= 0) return startRate;
  const glideStart = totalYears - glideYears;
  if (yearNo <= glideStart) return startRate;
  if (yearNo >= totalYears) return endRate;
  const progress = (yearNo - glideStart) / glideYears;
  return startRate + (endRate - startRate) * progress;
}

/* Future-value factors for a plan of a given length, walked with exactly the
   arithmetic project() uses, dropped partial final period included. The ending
   balance is linear in the contribution no matter what the rate does year to
   year, so one walk yields both halves of it:

       FV = initial * initFactor + contrib * annuity

   That linearity is what lets the backward solves invert a glide path instead
   of assuming a single constant rate: divide rather than iterate. The glide is
   anchored to `len`, the length being tested, so it always covers the FINAL N
   years of that timeline -- move the end date and the ramp moves with it. */
/**
 * @param {PlanParams|StageParams} p
 * @param {number} [years] - length to walk; defaults to p.years
 * @param {number} [periods] - exact period count, when the caller already has
 *   it and `years` would round badly (i/ppy*ppy is not always i)
 * @returns {{ppy:number, n:number, initFactor:number, annuity:number, periodicRate:number}}
 */
export function fvFactors(p, years, periods){
  const len = (years === undefined || years === null) ? p.years : years;
  const ppy = PPY[p.period];
  const n = (periods === undefined || periods === null) ? Math.floor(len * ppy) : periods;
  const glideOn = !!(p.glide && p.glide.on);
  const gYears = glideOn ? Math.min(p.glide.years, len) : 0;
  const r = Math.pow(1 + p.nominal, 1 / ppy) - 1;
  let periodicR = r, initFactor = 1, annuity = 0;
  for (let i = 1; i <= n; i++){
    const yearNo = Math.ceil(i / ppy);
    if (glideOn){
      const yearRate = glideAnnualRate(yearNo, len, gYears, p.nominal, p.glide.endRate);
      periodicR = Math.pow(1 + yearRate, 1 / ppy) - 1;
    }
    initFactor *= (1 + periodicR);
    annuity = annuity * (1 + periodicR) + Math.pow(1 + p.growth, yearNo - 1);
  }
  return {ppy, n, initFactor, annuity, periodicRate:r};
}

/**
 * Single-plan projection: compounds one initial balance and one contribution
 * schedule to a future value, period by period.
 * @param {PlanParams} p
 * @returns {Object} year-by-year rows plus summary totals (fv, fvReal, wd, wdReal, afterTax, ...)
 */
export function project(p){
  const ppy = PPY[p.period];
  const n = Math.floor(p.years * ppy);
  const glideOn = !!(p.glide && p.glide.on);
  // Clamped the same way fvFactors, solveYears and coastFire clamp it. The UI
  // caps this on entry, but the solvers invert THIS function, so if the two
  // ever disagree about a glide longer than the plan the solved contribution
  // silently misses its target.
  const gYears = glideOn ? Math.min(p.glide.years, p.years) : 0;
  const r = Math.pow(1 + p.nominal, 1 / ppy) - 1;
  let bal = p.initial, contribTotal = 0, lastContrib = 0, lastAt = 0;
  const years = [];
  let yearStart = p.initial, yearContrib = 0, curYear = 1;
  let periodicR = r;
  for (let i = 1; i <= n; i++){
    const yearNo = Math.ceil(i / ppy);
    if (yearNo !== curYear){
      years.push({year:curYear, start:yearStart, contrib:yearContrib,
                  growth:bal - yearStart - yearContrib, end:bal});
      yearStart = bal; yearContrib = 0; curYear = yearNo;
    }
    if (glideOn){
      const yearRate = glideAnnualRate(yearNo, p.years, gYears, p.nominal, p.glide.endRate);
      periodicR = Math.pow(1 + yearRate, 1 / ppy) - 1;
    }
    const c = p.contrib * Math.pow(1 + p.growth, yearNo - 1);
    bal = bal * (1 + periodicR) + c;
    contribTotal += c; yearContrib += c; lastContrib = c; lastAt = yearNo - 1;
  }
  if (n > 0) years.push({year:curYear, start:yearStart, contrib:yearContrib,
                         growth:bal - yearStart - yearContrib, end:bal});

  const fv = bal;
  const invested = p.initial + contribTotal;
  const inflYears = (p.inflYears === null || p.inflYears === undefined || p.inflYears === "")
                    ? p.years : p.inflYears;
  const deflator = Math.pow(1 + p.inflation, inflYears);
  const fvReal = fv / deflator;
  const wd = fv * p.withdrawal;
  const wdReal = fvReal * p.withdrawal;
  const afterTax = wdReal * (1 - p.taxRate);
  return {
    ppy, periods:n, periodicRate:r, years,
    fv, invested, growth: fv - invested, contribTotal, lastContrib,
    // The last payment in today's dollars. Contributions step up once a
    // year and hold flat through it, so it's deflated to the start of the
    // year it's paid in: growth equal to inflation gives back the amount typed.
    lastContribReal: lastContrib / Math.pow(1 + p.inflation, lastAt),
    inflYears, fvReal, wd, wdReal, afterTax, afterTaxMo: afterTax / 12,
    realReturn: (1 + p.nominal) / (1 + p.inflation) - 1
  };
}

/**
 * What contribution per period reaches the target? Inverts the projection
 * directly: fvFactors walks the plan's actual rate path once, and the answer
 * falls out of (goal - what the starting balance becomes) / (what a $1-per-
 * period schedule becomes). Works under a glide for the same reason it works
 * without one, and agrees with project() period for period either way.
 * @param {PlanParams} p
 * @param {string} solveFor - "After-Tax Withdrawal" or a portfolio-dollar target
 * @param {number} target - the goal amount, in the units solveFor implies
 * @returns {Object} perPeriod/perYear contribution needed, plus intermediate values
 */
export function goalSolve(p, solveFor, target){
  const F = fvFactors(p, p.years);
  const ppy = F.ppy;
  const portToday = solveFor === "After-Tax Withdrawal"
      ? target / (p.withdrawal * (1 - p.taxRate))
      : target;
  const pays = portToday * p.withdrawal * (1 - p.taxRate);
  const inflYears = (p.inflYears === null || p.inflYears === undefined || p.inflYears === "")
                    ? p.years : p.inflYears;
  const portFuture = portToday * Math.pow(1 + p.inflation, inflYears);
  const initFactor = F.initFactor;
  const initGrows = p.initial * initFactor;
  const annuity = F.annuity;
  const perPeriod = (annuity <= 0 || portFuture <= initGrows)
      ? 0 : (portFuture - initGrows) / annuity;
  return {ppy, periodicRate:F.periodicRate, portToday, pays, portFuture, initFactor, initGrows,
          annuity, perPeriod, perYear: perPeriod * ppy, change: perPeriod - p.contrib};
}
// How long until the plan reaches the target? Walks period by period using the
// same engine as the projection, so the answer agrees with it rather than
// coming from a separate closed form. When the inflation window is left blank
// the target itself recedes as the timeline stretches, which this accounts for.
/**
 * @param {PlanParams} p
 * @param {number} portToday - target portfolio value, in today's dollars
 * @param {number} capYears - stop searching after this many years
 * @returns {{reached: boolean, years: number, periods?: number, real: number, exact?: number}}
 */
export function solveYears(p, portToday, capYears){
  const ppy = PPY[p.period];
  const glideOn = !!(p.glide && p.glide.on);
  const r = Math.pow(1 + p.nominal, 1 / ppy) - 1;
  const cap = Math.round((capYears || 100) * ppy);
  const fixed = (p.inflYears === null || p.inflYears === undefined || p.inflYears === "")
                ? null : p.inflYears;
  const defl = yrs => Math.pow(1 + p.inflation, fixed === null ? yrs : fixed);

  if (p.initial / defl(0) >= portToday) return {reached:true, years:0, periods:0, real:p.initial};

  // Round up to the displayed precision so re-running at this value still
  // clears the target instead of landing one period short.
  const hit = (i, real) => ({reached:true, years: Math.ceil((i / ppy) * 100) / 100,
                             exact: i / ppy, periods:i, real:real});

  if (!glideOn){
    let bal = p.initial;
    for (let i = 1; i <= cap; i++){
      const yearNo = Math.ceil(i / ppy);
      bal = bal * (1 + r) + p.contrib * Math.pow(1 + p.growth, yearNo - 1);
      const real = bal / defl(i / ppy);
      if (real >= portToday) return hit(i, real);
    }
    return {reached:false, years:cap / ppy, periods:cap, real: bal / defl(cap / ppy)};
  }

  /* Under a glide the running balance can't simply be carried forward one
     period at a time, because the glide belongs to the final N years of
     whatever timeline is being tested -- stretch the plan and the ramp moves
     with the end date rather than extending behind it. So every candidate
     length gets its own rate path. That is what makes the answer reproduce
     itself: apply the years this returns and the projection lands here too.

     Rebuilding each candidate from scratch is O(n^2) and visibly janky on a
     weekly schedule. Only the TAIL actually differs, though: every candidate
     runs flat at the start rate until its own final N years, so that prefix is
     one shared walk carried forward across candidates, and each candidate
     re-walks only its glide tail -- N years long at most. Same arithmetic as
     fvFactors, same order, so the two agree bit for bit. */
  /* Both the rate and the contribution factor hold steady across a whole year,
     so they are looked up once per year rather than once per period. Same
     values, two orders of magnitude fewer Math.pow calls. */
  const grow = [];
  const growAt = k => {
    const y = Math.ceil(k / ppy);
    if (grow[y] === undefined) grow[y] = Math.pow(1 + p.growth, y - 1);
    return grow[y];
  };
  let flatIF = 1, flatAN = 0, flatK = 0;
  let real = 0;
  for (let i = 1; i <= cap; i++){
    const len = i / ppy;
    const gYears = Math.min(p.glide.years, len);
    const flatPeriods = Math.min(i, Math.max(0, Math.floor(len - gYears)) * ppy);
    while (flatK < flatPeriods){
      flatK++;
      flatIF *= (1 + r);
      flatAN = flatAN * (1 + r) + growAt(flatK);
    }
    let initFactor = flatIF, annuity = flatAN;
    let tailYear = -1, q = 0, gf = 1;
    for (let k = flatPeriods + 1; k <= i; k++){
      const yearNo = Math.ceil(k / ppy);
      if (yearNo !== tailYear){
        tailYear = yearNo;
        q = Math.pow(1 + glideAnnualRate(yearNo, len, gYears, p.nominal, p.glide.endRate), 1 / ppy) - 1;
        gf = growAt(k);
      }
      initFactor *= (1 + q);
      annuity = annuity * (1 + q) + gf;
    }
    real = (p.initial * initFactor + p.contrib * annuity) / defl(len);
    if (real >= portToday) return hit(i, real);
  }
  return {reached:false, years:cap / ppy, periods:cap, real:real};
}
// A run of consecutive stages. Each stage keeps its own contribution, schedule,
// growth and rate of return; the closing balance of one becomes the opening
// balance of the next. Contribution growth restarts each stage, since each
// stage states its own starting contribution.
/**
 * @param {GlobalParams} g
 * @param {StageParams[]} stages
 * @returns {Object} rows (year-by-year), summary (per-stage), and total fv/fvReal/wd/wdReal/afterTax
 */
/* Where the Stages charts put a point: after the last period of every whole
   year, and at the exact end of each stage, so a fractional stage adds one
   point (16.92) between two whole years (16, 17) rather than shifting every
   point after it. Returns, per stage, a map of period index -> chart year. */
export function seriesSnaps(stages){
  let elapsed = 0;
  return stages.map(st => {
    const ppy = PPY[st.period], n = Math.floor(st.years * ppy), at = new Map();
    const calOf = i => Math.max(1, Math.ceil(elapsed + i / ppy - 1e-9));
    for (let i = 1; i <= n; i++){
      if (i === n) at.set(i, elapsed + st.years);
      else if (calOf(i + 1) !== calOf(i)) at.set(i, calOf(i));
    }
    elapsed += st.years;
    return at;
  });
}
/* A stage ending partway through a year can leave the next whole year with
   no period of its own (stage 2's first monthly payment after 16.92 falls
   at 17.003). Nothing is paid or earned between the boundary and that year,
   so its point repeats the boundary's value. `copy(pt, year)` makes one. */
export function fillWholeYears(pts, copy){
  const out = [];
  pts.forEach((pt, i) => {
    out.push(pt);
    const next = pts[i + 1];
    if (!next) return;
    for (let y = Math.floor(pt.year) + 1; y < next.year - 1e-9; y++)
      if (y > pt.year + 1e-9) out.push(copy(pt, y));
  });
  return out;
}
export function projectSeries(g, stages){
  let bal = g.initial, contribTotal = 0, elapsed = 0, lastContrib = 0, lastPeriod = null, lastAt = 0;
  const rows = [], summary = [];
  /* `rows` follow each stage's own years, so after a fractional stage they
     land on 16.92, 17.92... (the charts and Monte Carlo bands line up with
     them). `calRows` regroup the same periods by whole calendar year for
     the tables: year 17 holds the rest of stage 1 and the start of stage 2. */
  const calRows = [], chartRows = [], snaps = seriesSnaps(stages);
  let cal = null;
  for (let si = 0; si < stages.length; si++){
    const st = stages[si];
    const ppy = PPY[st.period];
    const n = Math.floor(st.years * ppy);
    const glideOn = !!(st.glide && st.glide.on);
    const r = Math.pow(1 + st.nominal, 1 / ppy) - 1;
    let periodicR = r;
    const stageStart = bal;
    let stageContrib = 0, yearStart = bal, yearContrib = 0, curYear = 1;
    for (let i = 1; i <= n; i++){
      const yearNo = Math.ceil(i / ppy);
      if (yearNo !== curYear){
        rows.push({stage:si + 1, endYear: elapsed + curYear, start:yearStart,
                   contrib:yearContrib, growth: bal - yearStart - yearContrib, end:bal});
        yearStart = bal; yearContrib = 0; curYear = yearNo;
      }
      if (glideOn){
        const yearRate = glideAnnualRate(yearNo, st.years, st.glide.years, st.nominal, st.glide.endRate);
        periodicR = Math.pow(1 + yearRate, 1 / ppy) - 1;
      }
      const c = st.contrib * Math.pow(1 + st.growth, yearNo - 1);
      const t = elapsed + i / ppy, calYear = Math.max(1, Math.ceil(t - 1e-9));
      if (!cal || cal.year !== calYear){
        if (cal) calRows.push(cal);
        cal = {year:calYear, stageFrom:si + 1, stage:si + 1, start:bal, contrib:0, t};
      }
      bal = bal * (1 + periodicR) + c;
      contribTotal += c; stageContrib += c; yearContrib += c;
      lastContrib = c; lastPeriod = st.period; lastAt = elapsed + yearNo - 1;
      cal.stage = si + 1; cal.contrib += c; cal.end = bal; cal.t = t;
      cal.growth = cal.end - cal.start - cal.contrib;
      if (snaps[si].has(i)) chartRows.push({year:snaps[si].get(i), stage:si + 1, end:bal});
    }
    if (n > 0){
      // a fractional stage ends partway through its final year
      rows.push({stage:si + 1, endYear: elapsed + Math.min(curYear, st.years),
                 start:yearStart, contrib:yearContrib,
                 growth: bal - yearStart - yearContrib, end:bal});
    }
    elapsed += st.years;
    summary.push({stage:si + 1, years:st.years, endYear:elapsed, start:stageStart,
                  contrib:stageContrib, growth: bal - stageStart - stageContrib,
                  end:bal, nominal:st.nominal, periods:n});
  }

  if (cal) calRows.push(cal);
  const totalYears = elapsed;
  const inflY = (g.inflYears === null || g.inflYears === undefined || g.inflYears === "")
                ? totalYears : g.inflYears;
  const fvReal = bal / Math.pow(1 + g.inflation, inflY);
  const wdReal = fvReal * g.withdrawal;
  const afterTax = wdReal * (1 - g.taxRate);
  return {
    rows, calRows, summary,
    chartRows: fillWholeYears(chartRows, (pt, year) => Object.assign({}, pt, {year})), totalYears, inflYears:inflY,
    fv:bal, invested: g.initial + contribTotal, contribTotal, lastContrib, lastPeriod,
    lastContribReal: lastContrib / Math.pow(1 + (g.inflation || 0), lastAt),
    growth: bal - g.initial - contribTotal,
    fvReal, wd: bal * g.withdrawal, wdReal, afterTax, afterTaxMo: afterTax / 12
  };
}
/* ---------- Monte Carlo ---------- */

// Seeded so a chart stays put while you talk about it. Re-roll changes the seed.
export function mulberry32(a){
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function gaussFrom(rng){
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/* Returns are drawn lognormally, so a draw can never lose more than the whole
   balance and compounding stays well behaved. Parameters are chosen so the
   expected annual return equals the rate entered, which means volatility 0
   reproduces the deterministic projection exactly. */
export function lognormalParams(mu, sigma, ppy){
  const s2 = Math.log(1 + (sigma * sigma) / Math.pow(1 + mu, 2));
  return {m: (Math.log(1 + mu) - s2 / 2) / ppy, s: Math.sqrt(s2 / ppy)};
}
export function pctl(sorted, q){
  const n = sorted.length;
  if (!n) return 0;
  const idx = (n - 1) * q, lo = Math.floor(idx), hi = Math.ceil(idx);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/* Same stage chain as projectSeries, but each period's growth is drawn at
   random. Samples at exactly the year boundaries projectSeries reports, so the
   percentile fan lines up with the deterministic curve. */
/**
 * @param {GlobalParams} g
 * @param {StageParams[]} stages
 * @param {number} trials - number of random paths to simulate
 * @param {number} seed - PRNG seed, so the same inputs always draw the same paths
 * @returns {Object} percentile bands over time plus the sorted real final-balance distribution
 */
export function monteCarlo(g, stages, trials, seed){
  /* A stage that glides doesn't have one expected return, it has a different
     one every year, so the lognormal parameters have to be rebuilt per year
     rather than once per stage. Without this the fan is drawn off a flat rate
     while the deterministic line underneath it glides, and the two separate --
     at zero volatility they must land on exactly the same number. Volatility
     is held at the stage's own figure throughout; only the mean drifts. */
  const meta = stages.map(st => {
    const ppy = PPY[st.period];
    const n = Math.floor(st.years * ppy);
    const glideOn = !!(st.glide && st.glide.on);
    const gYears = glideOn ? Math.min(st.glide.years, st.years) : 0;
    const flat = lognormalParams(st.nominal, st.vol || 0, ppy);
    // one {m, s} per year of the stage, indexed by year number
    let byYear = null;
    if (glideOn){
      byYear = [];
      const lastYear = Math.ceil(st.years);
      for (let y = 1; y <= lastYear; y++){
        const yr = glideAnnualRate(y, st.years, gYears, st.nominal, st.glide.endRate);
        byYear[y] = lognormalParams(yr, st.vol || 0, ppy);
      }
    }
    return {ppy, n, m: flat.m, s: flat.s, byYear, st};
  });
  // the same points the projection line uses (see seriesSnaps)
  const snaps = seriesSnaps(stages);
  const marks = [];
  snaps.forEach(at => at.forEach(y => marks.push(y)));
  const totalYears = stages.reduce((a, st) => a + st.years, 0), M = marks.length;
  if (!M) return {marks:[], bands:[], finals:[], totalYears:0, trials:0, median:0};

  const paths = [];
  for (let k = 0; k < M; k++) paths.push(new Float64Array(trials));
  const finals = new Float64Array(trials);
  const rng = mulberry32(seed >>> 0);

  for (let t = 0; t < trials; t++){
    let bal = g.initial, mi = 0;
    for (let si = 0; si < meta.length; si++){
      const mt = meta[si], st = mt.st;
      let curYear = 1;
      let m = mt.byYear ? mt.byYear[1].m : mt.m;
      let s = mt.byYear ? mt.byYear[1].s : mt.s;
      for (let i = 1; i <= mt.n; i++){
        const y = Math.ceil(i / mt.ppy);
        if (y !== curYear){
          curYear = y;
          if (mt.byYear && mt.byYear[y]){ m = mt.byYear[y].m; s = mt.byYear[y].s; }
        }
        bal = bal * Math.exp(m + s * gaussFrom(rng))
            + st.contrib * Math.pow(1 + st.growth, y - 1);
        if (snaps[si].has(i)) paths[mi++][t] = bal;
      }
    }
    finals[t] = bal;
  }

  const bands = [];
  for (let k = 0; k < M; k++){
    const sorted = paths[k].slice().sort();
    const d = Math.pow(1 + g.inflation, marks[k]);
    bands.push({year: marks[k],
      p10: pctl(sorted, .10) / d, p25: pctl(sorted, .25) / d,
      p50: pctl(sorted, .50) / d, p75: pctl(sorted, .75) / d,
      p90: pctl(sorted, .90) / d});
  }
  const filled = fillWholeYears(bands, (b, year) => {
    const k = Math.pow(1 + g.inflation, b.year - year);
    return {year, p10:b.p10 * k, p25:b.p25 * k, p50:b.p50 * k, p75:b.p75 * k, p90:b.p90 * k};
  });
  bands.length = 0; filled.forEach(b => bands.push(b));
  const fd = Math.pow(1 + g.inflation, totalYears);
  const finalsReal = finals.slice().sort();
  for (let i = 0; i < finalsReal.length; i++) finalsReal[i] /= fd;
  return {marks, bands, finals:finalsReal, totalYears, trials,
          median: pctl(finalsReal, .5)};
}
/* ---------- Coast FIRE ---------- */
/* The first moment you could stop contributing entirely and still drift to the
   target by the date already set. Walks the real contribution schedule, and at
   each period asks whether the balance alone, compounded for the years that
   remain, would clear the goal. */
/**
 * @param {PlanParams} p
 * @param {number} targetFuture - the goal, already inflated to its future-dollar value
 * @returns {{state: "already"|"reachable"|"never", years: number, balance: number, periods?: number}}
 */
export function coastFire(p, targetFuture){
  const ppy = PPY[p.period];
  const n = Math.floor(p.years * ppy);
  const glideOn = !!(p.glide && p.glide.on);
  const gYears = glideOn ? Math.min(p.glide.years, p.years) : 0;
  const r = Math.pow(1 + p.nominal, 1 / ppy) - 1;
  const round2 = v => Math.ceil(v * 100) / 100;

  /* The retirement date doesn't move here, so the glide stays anchored where it
     already is; coasting only stops the contributions. Period i therefore keeps
     whatever rate the projection gives it. The rate holds across a year and the
     coast test re-walks the tail from every candidate stop year, so the yearly
     figures are worked out once up front -- a few dozen entries against a
     couple of million lookups. */
  const rateByYear = [];
  if (glideOn){
    const lastYear = Math.ceil(p.years);
    for (let y = 1; y <= lastYear; y++){
      rateByYear[y] = Math.pow(1 + glideAnnualRate(y, p.years, gYears, p.nominal, p.glide.endRate), 1 / ppy) - 1;
    }
  }
  const rateAt = i => glideOn ? rateByYear[Math.ceil(i / ppy)] : r;

  /* Coasting is checked with the same period-by-period arithmetic the staged
     run uses, including its dropped partial period. Testing against smooth
     annual compounding instead would report a year that then falls just short
     once the two-stage version is actually built. The coasting stretch is the
     TAIL of the plan, so it draws the last `left` periods' rates -- the low end
     of the glide, which is the whole point of checking it this way. */
  const coastsFrom = (bal, stopYears) => {
    const left = Math.floor((p.years - stopYears) * ppy);
    if (!glideOn) return bal * Math.pow(1 + r, left) >= targetFuture;
    let b = bal;
    for (let i = n - left + 1; i <= n; i++) b *= (1 + rateAt(i));
    return b >= targetFuture;
  };

  if (coastsFrom(p.initial, 0)) return {state:"already", years:0, balance:p.initial};

  let bal = p.initial;
  for (let i = 1; i <= n; i++){
    const yearNo = Math.ceil(i / ppy);
    bal = bal * (1 + rateAt(i)) + p.contrib * Math.pow(1 + p.growth, yearNo - 1);
    const stop = round2(i / ppy);
    if (stop < p.years && coastsFrom(bal, stop))
      return {state:"reachable", years:stop, periods:i, balance:bal};
  }
  return {state:"never", years:p.years, balance:bal};
}

/* ---------- staged target solving (final stage only) ---------- */
/* Everything before the last stage is fixed, so the run is collapsed to the
   balance at the final stage's start and the last stage is solved on its own. */
/**
 * @param {GlobalParams} g
 * @param {StageParams[]} stages
 * @returns {number} balance at the start of the final stage
 */
export function balanceBeforeLast(g, stages){
  if (stages.length < 2) return g.initial;
  const head = stages.slice(0, -1);
  return projectSeries(g, head).fv;
}
/**
 * @param {GlobalParams} g
 * @param {StageParams[]} stages
 * @param {number} portToday - target portfolio value, in today's dollars
 * @returns {Object|null} two routes to the target: a required contribution, or a required final-stage length
 */
export function finalStageSolve(g, stages, portToday){
  if (!stages.length) return null;
  const last = stages[stages.length - 1];
  const startBal = balanceBeforeLast(g, stages);
  const priorYears = stages.slice(0, -1).reduce((a, x) => a + x.years, 0);
  const totalYears = priorYears + last.years;
  const targetFuture = portToday * Math.pow(1 + g.inflation, totalYears);

  // route 1: hold the timeline, change the final stage's contribution.
  // Same inversion as the Advanced tab, over the final stage's own rate path.
  const F = fvFactors(last, last.years);
  const ppy = F.ppy;
  const grown = startBal * F.initFactor;
  const annuity = F.annuity;
  const perPeriod = (annuity <= 0 || targetFuture <= grown)
    ? 0 : (targetFuture - grown) / annuity;

  // route 2: hold the contribution, stretch the final stage. The stage carries
  // its glide along, re-anchored to whatever length the solve lands on.
  const yrs = solveYears({initial:startBal, contrib:last.contrib, period:last.period,
    growth:last.growth, nominal:last.nominal, inflation:g.inflation,
    inflYears:"", years:last.years, glide:last.glide},
    portToday * Math.pow(1 + g.inflation, priorYears), 100);

  return {startBal, priorYears, totalYears, targetFuture, grown,
          perPeriod, perYear: perPeriod * ppy, change: perPeriod - last.contrib,
          stageYears: yrs.reached ? yrs.years : null,
          totalIfStretched: yrs.reached ? priorYears + yrs.years : null,
          reached: yrs.reached, ppy};
}

/* ---------- taxes ----------
   The figures that change each year (brackets, deductions, FICA, the states'
   rules) are in data/, one file per tax year, and come from yearData(year).
   The Income Tax tool says which year (inp.year); everything else gets the
   newest. The figures below are statutory and have never been indexed. */

/* IRC sec. 1411. The thresholds are statutory and have never been indexed. */
export const NIIT = {rate:.038, threshold:{s:200000, m:250000}};

/* IRC sec. 86. Provisional income = AGI + tax-exempt interest + half of
   benefits. Between the two thresholds up to 50% of benefits become taxable;
   above the second, up to 85%. Neither figure has ever been indexed. */
export const SS_PROV = {t1:{s:25000, m:32000}, t2:{s:34000, m:44000}};

/* Progressive tax over [threshold, rate] pairs, plus the band-by-band detail. */
/**
 * @param {number} income - taxable income, in dollars
 * @param {number[][]} brackets - [threshold, rate] pairs; rate is a decimal
 * @returns {{tax: number, bands: Array<Object>}}
 */
export function bracketTax(income, brackets){
  let tax = 0; const bands = [];
  for (let i = 0; i < brackets.length; i++){
    const lo = brackets[i][0], rate = brackets[i][1];
    const hi = (i + 1 < brackets.length) ? brackets[i + 1][0] : Infinity;
    const inBand = Math.max(0, Math.min(income, hi) - lo);
    if (inBand > 0){ tax += inBand * rate; }
    bands.push({lo, hi, rate, amount:inBand, tax:inBand * rate});
  }
  return {tax, bands};
}
/**
 * @param {number} income - taxable income, in dollars
 * @param {number[][]} brackets - [threshold, rate] pairs; rate is a decimal
 * @returns {number} the top marginal rate that applies to this income, as a decimal
 */
export function marginalRate(income, brackets){
  let r = brackets[0][1];
  for (let i = 0; i < brackets.length; i++) if (income > brackets[i][0]) r = brackets[i][1];
  return r;
}

/* Public pensions are exempt in some states and not others, so the tool has to
   be told which kind the pension is. Everything else about a pension --
   ordinary rates, no FICA -- is the same either way. */

/**
 * State-level retirement tax. Returns the tax, the base it was computed on,
 * and the taxable amount each source contributed, so the per-source table can
 * split the bill without guessing.
 *
 * @param {Object} S - the state's entry in its year's states.tax
 * @param {Object} c - context: year, status, idx, seniors, trad, pension, penPublic,
 *                     other, gain, taxableSS, ssGross, agi, pre, dedType, item
 * @returns {{tax:number, base:number, taxable:number, parts:Object, ssIn:number,
 *            excluded:number, notes:string}}
 */
export function stateRetireTax(S, c){
  const SD = yearData(c.year).states;
  const R = SD.retire[c.code] || {};
  const st = c.status, idx = c.idx;
  const zero = {tax:0, base:0, taxable:0, ssIn:0, excluded:0, ded:0, credit:0,
                parts:{trad:0, pension:0, other:0, gain:0, ss:0},
                note:R.note || "", ssTaxed:false};
  if (S.none || !S.b) return zero;

  // --- 1. Social Security ---------------------------------------------------
  // Default is full exemption: 42 states and DC leave benefits out entirely.
  let ssIn = 0, ssTaxed = false;
  if (SD.ssTaxed[c.code]){
    ssTaxed = true;
    ssIn = c.taxableSS;
    if (R.ssFullAge && c.seniors > 0) ssIn = 0;
    else if (R.ssCap){
      const cap = R.ssCap[idx], range = R.ssRange || 0;
      if (c.agi <= cap) ssIn = 0;
      else if (R.ssStep)
        // Minnesota: the subtraction falls 10% for each full or partial step
        // of AGI over the threshold, so it is gone ten steps above it.
        ssIn = c.taxableSS * Math.min(1, Math.ceil((c.agi - cap) / R.ssStep) * .10);
      else if (range > 0 && c.agi < cap + range)
        ssIn = c.taxableSS * ((c.agi - cap) / range);
      if (c.agi > cap && R.ssPct) ssIn = Math.min(ssIn, c.taxableSS * R.ssPct);
      if (ssIn <= 0) ssTaxed = false;
    }
  }

  // --- 2. source-level exemptions ------------------------------------------
  let trad = R.tradFull ? 0 : c.trad;
  let pension = c.pension;
  if (R.penFull) pension = 0;
  else if (R.pubFull && c.penPublic){
    // A pubFull state with exCap (and no exAmt) would income-test this;
    // none currently does, but the machinery stays for the next one.
    const cap = R.exCap && !R.exAmt ? R.exCap[idx] : Infinity;
    if (c.agi <= cap) pension = 0;
  }
  let other = c.other;

  // --- 3. long-term gain ----------------------------------------------------
  let gain = c.gain;
  if (R.cgPct) gain = gain * (1 - R.cgPct);
  if (R.cgFlat) gain = Math.max(0, gain - R.cgFlat[idx]);

  // --- 4. the retirement income exclusion -----------------------------------
  let excluded = 0;
  if (R.exAmt){
    const people = R.exPer ? (R.exAge ? c.seniors : (st === "m" ? 2 : 1)) : 1;
    let room = R.exAmt[idx] * (R.exPer ? people : 1);
    if (R.exAge && c.seniors === 0) room = 0;
    if (R.exLessSS)
      room = Math.max(0, room - (R.exLessSS === "gross" ? c.ssGross : c.taxableSS));
    if (R.exCap){
      const cap = R.exCap[idx];
      if (R.exPhase === "nj"){
        /* New Jersey: the full exclusion only below $100,000 of income. From
           there it becomes a share of the retirement income itself -- 50%
           joint / 37.5% single to $125,000, half that to $150,000 -- and
           zero above $150,000 (N.J.S.A. 54A:6-10; GIT-1&2). */
        const g = c.grossForTest, qual = trad + pension;
        if (g > cap + 50000) room = 0;
        else if (g > cap + 25000) room = Math.min(room, qual * (st === "m" ? .25 : .1875));
        else if (g > cap) room = Math.min(room, qual * (st === "m" ? .5 : .375));
      } else if (R.exPhase === "lin"){
        const range = R.exRange || 1;
        room *= c.agi <= cap ? 1
              : c.agi >= cap + range ? 0
              : 1 - (c.agi - cap) / range;
      } else if (c.agi > cap) room = 0;
    }
    const order = R.exSrc === "t" ? ["trad"]
                : R.exSrc === "p" ? ["pension"]
                : R.exSrc === "pub" ? (c.penPublic ? ["pension"] : [])
                : R.exSrc === "all" ? ["trad", "pension", "other", "gain"]
                : ["trad", "pension"];
    const box = {trad, pension, other, gain};
    order.forEach(k => {
      const take = Math.min(room, box[k]);
      box[k] -= take; room -= take; excluded += take;
    });
    trad = box.trad; pension = box.pension; other = box.other; gain = box.gain;
  }

  // --- 5. the base ----------------------------------------------------------
  const parts = {trad, pension, other, gain, ss:ssIn};
  const preRaw = Math.max(0, c.pre);
  const gross = trad + pension + other + gain + ssIn;
  const base = Math.max(0, gross - preRaw);
  // Pre-tax deductions shrink every surviving source proportionally, so the
  // per-source split still adds up to the base the tax was computed on.
  const keep = gross > 0 ? base / gross : 0;
  Object.keys(parts).forEach(k => parts[k] *= keep);

  // --- 6. deductions, exemptions and age add-ons ----------------------------
  let ded = 0;
  if (c.dedType === "item" && S.sd) ded = Math.max(c.item, 0);
  else if (S.sd) ded = S.sd[idx];
  if (S.pe) ded += S.pe[idx];
  if (S.peAge) ded += S.peAge * c.seniors;      // Illinois
  if (R.peAge) ded += R.peAge * c.seniors;
  if (R.sdAge) ded += R.sdAge[idx] * c.seniors;
  if (R.agePh){
    // Virginia: a flat deduction withdrawn against income above a threshold.
    const over = Math.max(0, c.agi - R.agePh.cap[idx]) * R.agePh.rate;
    ded += Math.max(0, R.agePh.amt * c.seniors - over);
  }
  if (S.agiCap && c.agi > S.agiCap[idx]) ded = 0;   // Illinois-style cliff

  const taxable = Math.max(0, base - ded);

  // --- 7. rates -------------------------------------------------------------
  let tax = bracketTax(taxable, S.b[st]).tax;
  // A handful of states run gain through its own rate schedule. Both do it as
  // an alternative computation, so the taxpayer never pays more than ordinary.
  const gainInTaxable = Math.min(parts.gain, taxable);
  if ((R.cgMax || R.cgB) && gainInTaxable > 0){
    const ordPart = taxable - gainInTaxable;
    const alt = bracketTax(ordPart, S.b[st]).tax + (R.cgMax
      ? gainInTaxable * R.cgMax
      : bracketTax(ordPart + gainInTaxable, R.cgB[st]).tax -
        bracketTax(ordPart, R.cgB[st]).tax);
    tax = Math.min(tax, alt);
  }

  // --- 8. credits -----------------------------------------------------------
  if (S.pec) tax = Math.max(0, tax - S.pec[idx]);
  if (S.sdc) tax = Math.max(0, tax - S.sdc[idx]);
  let credit = 0;
  if (R.credAge && c.seniors > 0 &&
      (!R.ohRet || !R.exCap || c.agi <= R.exCap[idx]))
    credit += R.credAge[idx] * c.seniors;
  if (R.ohRet && (!R.exCap || c.agi <= R.exCap[idx])){
    // Ohio's retirement income credit, a flat dollar amount by band.
    const r = trad + pension;
    credit += r >= 8000 ? 200 : r >= 5000 ? 130 : r >= 3000 ? 80
            : r >= 1500 ? 50 : r >= 500 ? 25 : 0;
  }
  if (R.ssCredit && ssIn > 0){
    const k = R.ssCredit;
    const full = ssIn * k.rate;
    credit += Math.max(0, full - Math.max(0, c.agi - k.cap[idx]) * k.phase);
  }
  tax = Math.max(0, tax - credit);

  return {tax, base, taxable, ssIn, excluded, ded, credit, parts,
          note:R.note || "", ssTaxed};
}

/** The kinds of pre-tax deduction the Income Tax tool asks for, in order. */
export const PRE_KINDS = ["k401", "ira", "hsa", "health", "other"];

/**
 * What a household's pre-tax deductions, by kind and earner, take off each tax.
 *   k401    401(k), 403(b) or 457 deferrals: off income tax, not FICA
 *   ira     a traditional IRA: off income tax, as far as the deduction allows.
 *           Covered by a plan at work (a 401(k) line above zero, as inferred
 *           here), it phases out across the year's limits.iraPhase ranges.
 *   hsa     HSA contributions, taken as through payroll: off income tax and FICA
 *   health  health, dental and vision premiums through work (Section 125):
 *           off income tax and FICA
 *   other   anything else pre-tax: off income tax, not FICA
 * A state in the year's states.preTaxed keeps the kinds it names in its base.
 * @param {Array<Object>} ded - [you, spouse], each {k401, ira, hsa, health, other}
 * @param {number[]} wages - [your gross, spouse's gross]
 * @param {"s"|"m"} st - filing status
 * @param {string} state - two-letter state code
 * @param {Object} Y - the year's figures (yearData)
 * @returns {{people: Object[], paid: number, fed: number, addBack: number,
 *   ficaOff: number[], magi: number}} people: each earner's amounts, with the
 *   IRA's deductible part (iraDed), its limit (iraMax) and whether they're
 *   taken as covered at work (a person's `covered`, when given, says so
 *   outright: a Roth 401(k) counts as much as a traditional one); paid: everything set aside; fed: what comes off
 *   federal income tax; addBack: what the state puts back; ficaOff: what
 *   comes off each earner's FICA wages; magi: the income the IRA test reads.
 */
export function preTaxSplit(ded, wages, st, state, Y){
  const n = st === "m" ? 2 : 1, L = Y.limits;
  const v = x => Math.max(0, +x || 0);
  const people = [0, 1].map(i => {
    const d = i < n ? ded[i] || {} : {};
    return {k401:v(d.k401), ira:v(d.ira), hsa:v(d.hsa), health:v(d.health), other:v(d.other), coveredIn:d.covered};
  });
  // Income for the IRA test: AGI before the IRA deduction itself.
  const payroll = people.reduce((a, p) => a + p.k401 + p.hsa + p.health + p.other, 0);
  const magi = Math.max(0, wages[0] + (n > 1 ? wages[1] : 0) - payroll);
  // Covered first, for both: one's IRA test reads the other's coverage.
  people.forEach(p => { p.covered = p.coveredIn == null ? p.k401 > 0 : !!p.coveredIn; delete p.coveredIn; });
  people.forEach((p, i) => {
    const other = people[1 - i];
    const range = p.covered ? L.iraPhase.cov[st] : st === "m" && other.covered ? L.iraPhase.spouse : null;
    // Over the base limit reads as a catch-up from 50.
    const limit = p.ira > L.ira.base ? L.ira.base + L.ira.catch50 : L.ira.base;
    let max = limit;
    if (range){
      const f = Math.min(1, Math.max(0, (magi - range[0]) / (range[1] - range[0])));
      // IRS worksheet: rounded up to $10, and at least $200 until it's gone.
      max = f >= 1 ? 0 : Math.max(200, Math.ceil(limit * (1 - f) / 10) * 10);
      max = Math.min(max, limit);
    }
    p.iraMax = max;
    p.iraDed = Math.min(p.ira, max);
  });
  const sum = (k) => people.reduce((a, p) => a + p[k], 0);
  const paid = PRE_KINDS.reduce((a, k) => a + sum(k), 0);
  const fed = sum("k401") + sum("iraDed") + sum("hsa") + sum("health") + sum("other");
  const keep = (Y.states.preTaxed || {})[state] || {};
  const addBack = (keep.k401 ? sum("k401") : 0) + (keep.ira ? sum("iraDed") : 0) +
                  (keep.hsa ? sum("hsa") : 0) + (keep.health ? sum("health") : 0);
  const ficaOff = people.map((p, i) => Math.min(p.hsa + p.health, Math.max(0, wages[i] || 0)));
  return {people, paid, fed, addBack, ficaOff, magi};
}

/**
 * @param {Object} inp
 * @param {"s"|"m"} inp.status - filing status: single or married
 * @param {number} inp.gross - gross income, in dollars. The sole earner's income for a
 *   single filer, or earner 1's own income on a joint return with inp.gross2 given.
 * @param {number} [inp.gross2] - spouse's own gross income, in dollars (joint returns
 *   only). Summed with inp.gross for tax purposes, but kept separate for FICA: the
 *   Social Security wage-base cap applies per earner, so running the household total
 *   through the cap once (the pre-split behavior) understates a two-earner couple's tax.
 * @param {number} inp.pre - pre-tax deductions (e.g. 401k), in dollars: one household
 *   figure, off income tax (federal and state) but not FICA. Ignored when inp.ded is given.
 * @param {Array<Object>} [inp.ded] - each earner's pre-tax deductions by kind, instead
 *   of inp.pre: [you, spouse], each {k401, ira, hsa, health, other} in dollars (the
 *   spouse's only on a joint return). See preTaxSplit for how each kind is treated.
 * @param {"std"|"item"} inp.dedType - standard vs. itemized deduction
 * @param {number} inp.item - itemized deduction total, in dollars (used only if dedType is "item")
 * @param {string} inp.state - two-letter state code, a key into the year's states.tax
 * @param {number} [inp.year] - tax year (data/); the newest when left off
 * @returns {Object} federal/state/FICA breakdown, net income, and effective/marginal rates
 */
export function computeTax(inp){
  const st = inp.status, idx = st === "m" ? 1 : 0;
  const Y = yearData(inp.year), FICA = Y.fica;
  const earner1 = Math.max(0, inp.gross);
  const earner2 = Math.max(0, inp.gross2 || 0);
  const gross = earner1 + earner2;
  // What comes off before each tax. One household figure (pre) comes off
  // federal and state income tax alike; by kind (ded), each comes off what
  // the law lets it, per earner for FICA.
  const P = inp.ded ? preTaxSplit(inp.ded, [earner1, earner2], st, inp.state, Y) : null;
  const pre = P ? Math.min(P.fed, gross) : Math.min(Math.max(0, inp.pre), gross);
  const afterPre = gross - pre;

  // federal
  const fedDed = inp.dedType === "item" ? Math.max(0, inp.item) : Y.fedStd[st];
  const fedTaxable = Math.max(0, afterPre - fedDed);
  const fedCalc = bracketTax(fedTaxable, Y.fed[st]);
  const federal = fedCalc.tax;

  // state
  const S = Y.states.tax[inp.state] || {none:1};
  let state = 0, stateTaxable = 0;
  if (!S.none && S.b){
    let ded = 0;
    if (inp.dedType === "item" && S.sd) ded = Math.max(inp.item, 0);
    else if (S.sd) ded = S.sd[idx];
    if (S.pe) ded += S.pe[idx];
    // Illinois-style cliff: some states drop the personal exemption entirely,
    // rather than phasing it out, once AGI crosses a threshold. afterPre is
    // this tool's stand-in for federal AGI (gross minus pre-tax deferrals).
    if (S.agiCap && afterPre > S.agiCap[idx]) ded = 0;
    // A state that keeps some deductions in its base starts higher.
    stateTaxable = Math.max(0, afterPre + (P ? P.addBack : 0) - ded);
    state = bracketTax(stateTaxable, S.b[st]).tax;
    if (S.pec) state = Math.max(0, state - S.pec[idx]);
    if (S.sdc) state = Math.max(0, state - S.sdc[idx]);
  }

  // FICA is on gross wages; most pre-tax retirement deferrals do not reduce it.
  // The Social Security wage-base cap applies separately to each earner's own
  // wages -- an employer stops withholding once *that employee's* pay crosses
  // it -- so a two-earner household is run through the cap once per earner,
  // not once against the combined total. Medicare's 1.45% is flat with no cap,
  // so aggregating doesn't change it, and the 0.9% Additional Medicare surtax
  // is genuinely a joint-return test against combined income (IRC 3101(b)(2)),
  // so that one correctly stays on the household total either way.
  // HSA contributions and health premiums through a Section 125 plan come
  // off FICA wages too, each earner's off their own.
  const wage1 = earner1 - (P ? P.ficaOff[0] : 0), wage2 = earner2 - (P ? P.ficaOff[1] : 0);
  const ss1 = Math.min(wage1, FICA.ssCap) * FICA.ssRate;
  const ss2 = Math.min(wage2, FICA.ssCap) * FICA.ssRate;
  const ss = ss1 + ss2;
  const med = (wage1 + wage2) * FICA.medRate;
  const addl = Math.max(0, wage1 + wage2 - FICA.addlThreshold[st]) * FICA.addlRate;
  const fica = ss + med + addl;

  const total = federal + state + fica;
  // Take-home: what's left once the taxes and everything set aside before
  // the paycheck (deductible or not) are out.
  const setAside = P ? Math.min(P.paid, gross) : pre;
  const net = gross - total - setAside;
  const rate = v => gross > 0 ? v / gross : 0;
  return {gross, earner1, earner2, pre: setAside, preFed: pre, afterPre, fedDed, fedTaxable, federal, state, stateTaxable,
          preTax: P,
          fica, ss, ss1, ss2, med, addl, total, net, takeHome: net,
          effFed:rate(federal), effState:rate(state), effFica:rate(fica),
          effTotal:rate(total), effNet:rate(net),
          marginal: marginalRate(fedTaxable, Y.fed[st]),
          bands: fedCalc.bands, stateName: S.n || "", stateNone: !!S.none};
}

/**
 * Taxable portion of Social Security benefits under IRC sec. 86.
 * @param {number} ss - gross benefits for the year, in dollars
 * @param {number} otherAgi - AGI excluding any Social Security, in dollars
 * @param {"s"|"m"} st - filing status
 * @returns {{taxable: number, provisional: number, tier: number}}
 */
export function ssTaxable(ss, otherAgi, st){
  if (!(ss > 0)) return {taxable:0, provisional:Math.max(0, otherAgi), tier:0};
  const t1 = SS_PROV.t1[st], t2 = SS_PROV.t2[st];
  const prov = Math.max(0, otherAgi) + ss / 2;
  if (prov <= t1) return {taxable:0, provisional:prov, tier:0};
  if (prov <= t2)
    return {taxable:Math.min(.5 * (prov - t1), .5 * ss), provisional:prov, tier:50};
  const lower = Math.min(.5 * (t2 - t1), .5 * ss);
  return {taxable:Math.min(.85 * (prov - t2) + lower, .85 * ss), provisional:prov, tier:85};
}

/**
 * Retirement-year tax. Withdrawals are bucketed by account type, because the
 * same dollar is taxed three different ways depending on where it comes from:
 * ordinary rates from a traditional account, nothing at all from a Roth, and
 * preferential capital-gain rates on the growth inside a taxable brokerage.
 * There are no wages, so no FICA; the 3.8% net investment income tax takes its
 * place as the surtax that can appear at higher incomes.
 *
 * @param {Object} inp
 * @param {number} inp.trad - traditional 401(k)/IRA withdrawal, in dollars
 * @param {number} inp.roth - Roth withdrawal, in dollars (qualified, untaxed)
 * @param {number} inp.brok - taxable brokerage withdrawal, in dollars
 * @param {number} inp.gainPct - share of that withdrawal that is gain, 0-1
 * @param {number} inp.ss - gross Social Security benefits, in dollars
 * @param {number} inp.pension - pension / annuity income, in dollars
 * @param {boolean} inp.penPublic - true if that pension is a government pension
 * @param {number} inp.other - interest, non-qualified dividends, rent, in dollars
 * @param {"s"|"m"} inp.status - filing status
 * @param {string} inp.state - two-letter state code, a key into the year's states.tax
 * @param {number} [inp.year] - tax year (data/); the newest when left off
 * @param {number} inp.pre - above-the-line deductions, in dollars
 * @param {"std"|"item"} inp.dedType - standard vs. itemized deduction
 * @param {number} inp.item - itemized total, in dollars
 * @param {number} inp.seniors - people age 65+ on the return, 0-2
 * @param {boolean} [inp._noMarginal] - internal, stops the marginal-rate probe recursing
 * @returns {Object} the same shape computeTax returns, plus retirement detail
 */
export function computeRetireTax(inp){
  const st = inp.status, idx = st === "m" ? 1 : 0;
  const Y = yearData(inp.year), FED = Y.fed[st], SENIOR_BONUS = Y.seniorBonus;
  const seniors = Math.max(0, Math.min(st === "m" ? 2 : 1, Math.round(inp.seniors || 0)));

  const trad  = Math.max(0, inp.trad);
  const roth  = Math.max(0, inp.roth);
  const brok  = Math.max(0, inp.brok);
  const ssGross = Math.max(0, inp.ss);
  const pension = Math.max(0, inp.pension || 0);
  const penPublic = !!inp.penPublic;
  const other = Math.max(0, inp.other);
  const gainPct = Math.max(0, Math.min(1, inp.gainPct));
  const gain = brok * gainPct;             // long-term; basis comes back untaxed
  const basis = brok - gain;
  const gross = trad + roth + brok + ssGross + pension + other;

  // Above-the-line deductions can only offset income that actually shows up on
  // the return, so cap them at everything except the Roth and the basis.
  const pre = Math.min(Math.max(0, inp.pre),
                       trad + pension + other + gain + ssGross);

  // Social Security is the circular part: how much of it is taxable depends on
  // AGI, which depends on how much of it is taxable. Everything else is fixed,
  // so one pass over the sec. 86 formula settles it.
  const otherAgi = trad + pension + other + gain - pre;
  const SS = ssTaxable(ssGross, otherAgi, st);
  const taxableSS = SS.taxable;

  const ordinaryAgi = trad + pension + other + taxableSS - pre;
  const agi = ordinaryAgi + gain;

  // deductions
  let ded = inp.dedType === "item" ? Math.max(0, inp.item) : Y.fedStd[st];
  const ageAddl = inp.dedType === "item" ? 0 : Y.seniorAddl[st] * seniors;
  ded += ageAddl;
  // The 6% reduction comes off each qualifying person's own $6,000 (Schedule
  // 1-A works it once and claims the result per spouse), so a couple who both
  // qualify lose it twice as fast and it is gone by $250,000 joint either way.
  let bonus = 0;
  if (seniors > 0){
    bonus = seniors * Math.max(0, SENIOR_BONUS.amount - SENIOR_BONUS.rate *
      Math.max(0, agi - SENIOR_BONUS.start[st]));
  }
  const fedDed = ded + bonus;

  // Ordinary income fills the brackets first; the gain stacks on top of it.
  // The deduction is applied against ordinary income first, spilling into the
  // gain only once ordinary income is used up.
  const taxableIncome = Math.max(0, agi - fedDed);
  const ordTaxable = Math.max(0, ordinaryAgi - fedDed);
  const gainTaxable = Math.max(0, taxableIncome - ordTaxable);

  const fedCalc = bracketTax(ordTaxable, FED);
  const fedOrdinary = fedCalc.tax;

  const c0 = Y.ltcg[st][0], c15 = Y.ltcg[st][1];
  const lo = ordTaxable, hi = ordTaxable + gainTaxable;
  const g0  = Math.max(0, Math.min(hi, c0) - lo);
  const g15 = Math.max(0, Math.min(hi, c15) - Math.max(lo, c0));
  const g20 = Math.max(0, hi - Math.max(lo, c15));
  const ltcg = g15 * .15 + g20 * .20;
  const ltcgRate = gainTaxable > 0 ? ltcg / gainTaxable : 0;

  // sec. 1411: 3.8% on the lesser of net investment income and the MAGI excess.
  // NII is the capital gain plus the "other ordinary income" bucket, which the
  // field describes as interest, dividends, rent and royalties -- all of it
  // investment income under sec. 1411. Traditional withdrawals, pensions and
  // Social Security are statutorily excluded and stay out of the base.
  const nii = gain + other;
  const niitBase = Math.min(nii, Math.max(0, agi - NIIT.threshold[st]));
  const niit = niitBase * NIIT.rate;
  // Split the surtax back across the two sources that generated it, so the
  // per-bucket column still adds up to the federal total.
  const niitOnGain  = nii > 0 ? niit * (gain / nii) : 0;
  const niitOnOther = niit - niitOnGain;

  const federal = fedOrdinary + ltcg + niit;

  // state
  // Everything state-specific -- Social Security, pension and traditional
  // exclusions, senior deductions, state capital-gain treatment, credits --
  // lives in stateRetireTax() and the year's states.retire, so this only has to hand it a
  // context and take back the answer.
  const S = Y.states.tax[inp.state] || {none:1};
  const ST = stateRetireTax(S, {
    year:Y.year, code:inp.state, status:st, idx, seniors,
    trad, pension, penPublic, other, gain,
    taxableSS, ssGross, agi, pre, dedType:inp.dedType, item:inp.item,
    grossForTest: trad + pension + other + gain
  });
  const state = ST.tax, stateTaxable = ST.taxable, stateBase = ST.base;
  const stateTaxesSS = ST.ssTaxed;

  const total = federal + state;
  const net = gross - total - pre;
  const rate = v => gross > 0 ? v / gross : 0;

  // The bracket a retiree sits in and the rate on their next dollar are often
  // not the same number. Another $1,000 from the traditional account can drag
  // more Social Security into the tax base with it, and can push gain from the
  // 0% band into the 15% band, so the real marginal rate runs above the
  // nominal bracket through a wide middle band. Probing the whole calculation
  // with an extra $1,000 is the only honest way to report it.
  let effMarginal = marginalRate(ordTaxable, FED);
  if (!inp._noMarginal){
    const step = 1000;
    const bumped = computeRetireTax(Object.assign({}, inp,
      {trad: trad + step, _noMarginal: true}));
    effMarginal = (bumped.federal - federal) / step;
  }

  // Attribution: the ordinary federal tax is split across the ordinary sources
  // in proportion to what each one contributed to ordinary taxable income.
  const ordSum = trad + pension + other + taxableSS;
  const shareOf = amt => ordSum > 0 ? amt / ordSum : 0;
  // The state base is not the federal one. A state that exempts Social
  // Security -- or pensions, or traditional withdrawals, or 44% of the gain --
  // has a different pool of income to spread its tax across, so the state
  // split runs off what actually survived into the state base, source by
  // source. stateRetireTax() hands those amounts back in ST.parts, which is
  // why the state column adds up to the state total however odd the rules.
  const sBase = ST.base;
  const sShare = amt => sBase > 0 ? amt / sBase : 0;
  const sTax = amt => state * sShare(amt);
  const bucket = (label, withdrawn, taxable, fed, stt) => ({
    label, withdrawn, taxable, federal:fed, state:stt, tax:fed + stt,
    eff: withdrawn > 0 ? (fed + stt) / withdrawn : 0});
  const buckets = [
    bucket("Traditional 401(k) / IRA", trad, trad,
           fedOrdinary * shareOf(trad), sTax(ST.parts.trad)),
    bucket("Roth account", roth, 0, 0, 0),
    bucket("Taxable brokerage", brok, gain, ltcg + niitOnGain, sTax(ST.parts.gain)),
    bucket("Social Security", ssGross, taxableSS,
           fedOrdinary * shareOf(taxableSS), sTax(ST.parts.ss)),
    bucket("Pension / annuity", pension, pension,
           fedOrdinary * shareOf(pension), sTax(ST.parts.pension)),
    bucket("Other ordinary income", other, other,
           fedOrdinary * shareOf(other) + niitOnOther, sTax(ST.parts.other))
  ];

  return {
    gross, pre, afterPre:agi, fedDed, fedTaxable:taxableIncome, federal, state,
    stateTaxable, fica:0, ss:0, med:0, addl:0, total, net, takeHome:net,
    effFed:rate(federal), effState:rate(state), effFica:0,
    effTotal:rate(total), effNet:rate(net),
    marginal:effMarginal,
    nominalMarginal:marginalRate(ordTaxable, FED),
    bands:fedCalc.bands, stateName:S.n || "", stateNone:!!S.none,
    // retirement detail
    retirement:true, trad, roth, brok, gain, basis, ssGross, pension, penPublic,
    other, taxableSS, ssTier:SS.tier, provisional:SS.provisional,
    ssStateTaxed:stateTaxesSS, stateBase, stateNote:ST.note,
    stateExcluded:ST.excluded, stateDed:ST.ded, stateCredit:ST.credit,
    stateParts:ST.parts, stateSSIn:ST.ssIn,
    agi, ordinaryAgi, ordTaxable, gainTaxable, fedOrdinary, ltcg, ltcgRate,
    ltcgBands:[{rate:0, amount:g0, tax:0}, {rate:.15, amount:g15, tax:g15 * .15},
               {rate:.20, amount:g20, tax:g20 * .20}],
    ltcgCut:[c0, c15], niit, niitBase, seniors, ageAddl, seniorBonus:bonus,
    zeroRoom:Math.max(0, c0 - hi), buckets
  };
}


/* ---------- Roth conversion & RMD ---------- */
/* Two projections of the same household, run side by side: one that converts
   traditional dollars to Roth on a schedule, and one that never converts. The
   annual tax in both comes from computeRetireTax(), so Social Security's
   provisional-income formula, capital-gain stacking, NIIT and every state rule
   already modeled elsewhere apply here unchanged.

   Everything is in today's dollars. Brackets, the standard deduction and the
   IRMAA thresholds are all indexed to inflation in real life, so holding them
   fixed in real terms is the same assumption the rest of the app makes about
   real returns -- and it keeps the output comparable to every other tool. */

/* The IRS Uniform Lifetime Table's divisor (ULT, data/tables.js). */
export function ultDivisor(age){
  if (age < 72) return 0;
  if (age >= 100) return 6.4;
  return ULT[age] || 0;
}
/* SECURE 2.0: age 73 for those born 1951-1959, age 75 for 1960 and later.
   The birth year is counted back from the newest tax year. */
export function rmdStartAge(currentAge){
  return (yearData().year - currentAge) >= 1960 ? 75 : 73;
}

/* Medicare's income surcharge (IRMAA), by the newest year's tiers
   (yearData().medicare.irmaa). The tiers are cliffs, not phase-ins -- one
   dollar over a line costs the whole tier -- and they run on a two-year
   lookback, so a conversion today sets the premium two years out. */
export function irmaaTier(magi, status){
  const key = status === "m" ? "m" : "s", tiers = yearData().medicare.irmaa.tiers;
  for (let i = 0; i < tiers.length; i++)
    if (magi <= tiers[i][key]) return i;
  return tiers.length - 1;
}
/**
 * @param {number} magi - modified AGI from two years earlier, in dollars
 * @param {"s"|"m"} status - filing status in the premium year
 * @param {number} people - how many on the return are enrolled in Medicare
 * @returns {number} the annual surcharge above standard premiums, in dollars
 */
export function irmaaAnnual(magi, status, people){
  if (people <= 0) return 0;
  const IRMAA = yearData().medicare.irmaa, t = IRMAA.tiers[irmaaTier(magi, status)];
  return (t.b - IRMAA.partB + t.partD) * 12 * people;
}
/* Top of a federal bracket = where the next one starts. */
/* How much more ordinary taxable income fits before crossing into the next
   federal bracket -- the room a Roth conversion or extra withdrawal has to
   work with before the marginal rate jumps. Null once already in the top
   bracket, since there's no next threshold to report. The newest year's
   brackets, or `year`'s. */
export function bracketRoom(taxable, status, year){
  const b = yearData(year).fed[status];
  let i = 0;
  for (let k = 0; k < b.length; k++) if (taxable > b[k][0]) i = k;
  if (i + 1 >= b.length) return null;
  return {room:b[i + 1][0] - taxable, nextRate:b[i + 1][1]};
}
export function bracketTopFor(status, rate){
  const b = yearData().fed[status];
  for (let i = 0; i < b.length; i++)
    if (Math.abs(b[i][1] - rate) < 1e-9)
      return (i + 1 < b.length) ? b[i + 1][0] : Infinity;
  return Infinity;
}

export const RC_STRATS = {
  none:  "No conversions",
  brk:   "Fill to the top of a bracket",
  irm:   "Fill to an IRMAA threshold",
  fix:   "A fixed amount each year",
  pct:   "A share of the balance each year"
};

/**
 * One year of tax, with the marginal probe switched off. The probe re-enters
 * computeRetireTax, and this runs inside a bisection loop inside a year loop.
 */
export function rcTax(o){
  return computeRetireTax(Object.assign({pre:0, dedType:"std", item:0,
    _noMarginal:true}, o));
}

/**
 * Largest conversion that keeps probe(conv) at or below zero. probe is
 * monotonically increasing in conv, so plain bisection settles it.
 */
export function rcBisect(probe, maxConv){
  if (maxConv <= 0) return 0;
  if (probe(0) > 0) return 0;          // already over the line before converting
  if (probe(maxConv) <= 0) return maxConv;
  let lo = 0, hi = maxConv;
  for (let i = 0; i < 44; i++){
    const mid = (lo + hi) / 2;
    if (probe(mid) <= 0) lo = mid; else hi = mid;
  }
  return lo;
}

/**
 * Project one household year by year.
 *
 * @param {Object} inp - the form state, already parsed
 * @param {boolean} doConvert - false runs the same plan with conversions off,
 *   which is the baseline every headline figure is measured against
 * @returns {Object} per-year rows plus the lifetime totals
 */
export function runRoth(inp, doConvert){
  const rows = [];
  const r = inp.ret;
  const startRMD = rmdStartAge(inp.age);
  let trad = Math.max(0, inp.trad);
  let roth = Math.max(0, inp.roth);
  let brok = Math.max(0, inp.brokerage);
  let basis = brok * Math.max(0, Math.min(1, inp.basisPct));
  const magiHist = [];
  let lifeTax = 0, lifeTaxPV = 0, lifeIrmaa = 0, totalConv = 0, peakRMD = 0;
  const span = inp.endAge - inp.age + 1;
  const n = (isFinite(span) && span > 0) ? Math.min(71, Math.round(span)) : 1;

  for (let i = 0; i < n; i++){
    const age = inp.age + i;
    const spAge = inp.spouseAge + i;
    // The survivor files single from the year of the first death onward. That
    // is the widow's penalty: the same income, half the brackets.
    const widowed = inp.status === "m" && inp.deathYear > 0 && i >= inp.deathYear;
    const status = (inp.status === "m" && !widowed) ? "m" : "s";
    const seniors = status === "m"
      ? (age >= 65 ? 1 : 0) + (spAge >= 65 ? 1 : 0)
      : (age >= 65 ? 1 : 0);

    const mySS = age >= inp.ssAge ? inp.ss : 0;
    const spSS = (inp.status === "m" && spAge >= inp.spSSAge) ? inp.spSS : 0;
    // A surviving spouse keeps the larger of the two benefits, not both.
    const ss = widowed ? Math.max(mySS, spSS) : mySS + spSS;
    const other = age >= inp.otherStart ? inp.other : 0;

    const tradBegin = trad;
    const rmd = (age >= startRMD && trad > 0)
      ? Math.min(trad, trad / ultDivisor(age)) : 0;
    if (rmd > peakRMD) peakRMD = rmd;

    // IRMAA runs two years behind. For the first two years of the projection
    // there is no history to look back on, so the current year stands in.
    const lookback = magiHist.length >= 2
      ? magiHist[magiHist.length - 2] : null;
    const medicare = inp.irmaaOn
      ? (status === "m" ? (age >= 65 ? 1 : 0) + (spAge >= 65 ? 1 : 0)
                        : (age >= 65 ? 1 : 0))
      : 0;

    const gainPct = brok > 0 ? Math.max(0, Math.min(1, (brok - basis) / brok)) : 0;
    const canConvert = doConvert && inp.strategy !== "none" &&
      age >= inp.startAge && age <= inp.stopAge;

    let conv = 0, extraTrad = 0, sale = 0, rothW = 0, surplus = 0;
    let T = null, irm = 0, taxDue = 0, rothCredit = 0, penalty = 0;
    // A year that starts before 59 ends before 59 1/2, so traditional dollars
    // taken out that year for spending or withheld tax carry the 10%
    // additional tax (IRC sec. 72(t)). Converted dollars that reach the Roth
    // do not.
    const early = age < 59;

    // Conversion size and the funding waterfall depend on each other: a bigger
    // conversion means a bigger tax bill, which may force another withdrawal,
    // which changes the room left in the bracket. Two passes settle it.
    for (let pass = 0; pass < 2; pass++){
      const fixedOrd = rmd + extraTrad;

      if (canConvert){
        const maxConv = Math.max(0, trad - rmd);
        if (inp.strategy === "fix"){
          conv = Math.min(inp.fixedAmt, maxConv);
        } else if (inp.strategy === "pct"){
          conv = maxConv * Math.max(0, Math.min(1, inp.pctAmt));
        } else if (inp.strategy === "brk"){
          const top = bracketTopFor(status, inp.bracket);
          conv = rcBisect(c => rcTax({status, trad:fixedOrd + c, roth:0,
            brok:sale, gainPct, ss, other, state:inp.state, seniors})
            .ordTaxable - top, maxConv);
        } else if (inp.strategy === "irm"){
          const key = status === "m" ? "m" : "s";
          const tiers = yearData().medicare.irmaa.tiers;
          const lim = tiers[Math.min(inp.irmaaTarget,
            tiers.length - 1)][key];
          conv = rcBisect(c => rcTax({status, trad:fixedOrd + c, roth:0,
            brok:sale, gainPct, ss, other, state:inp.state, seniors})
            .agi - lim, maxConv);
        }
      }

      // Funding: settle tax and withdrawals together, since extra traditional
      // dollars pulled to pay the bill are themselves taxable.
      extraTrad = 0; sale = 0; rothW = 0; surplus = 0;
      for (let iter = 0; iter < 6; iter++){
        const gp = brok > 0 ? Math.max(0, Math.min(1, (brok - basis) / brok)) : 0;
        T = rcTax({status, trad:rmd + conv + extraTrad, roth:rothW, brok:sale,
          gainPct:gp, ss, other, state:inp.state, seniors});
        irm = (medicare > 0)
          ? irmaaAnnual(lookback == null ? T.agi : lookback, status, medicare) : 0;

        // Withholding mode pays the conversion's tax out of the conversion
        // itself, so fewer dollars actually land in the Roth. That is the
        // single largest lever in the whole decision. Only the tax the
        // conversion adds is withheld: the bill the year would have had
        // anyway is paid the way every other year's is.
        // Withholding is income tax only: any Medicare surcharge the
        // conversion triggers is billed separately and paid like other costs.
        let fromConv = 0;
        if (inp.payFrom === "withhold" && conv > 0){
          const T0 = rcTax({status, trad:rmd + extraTrad, roth:rothW, brok:sale,
            gainPct:gp, ss, other, state:inp.state, seniors});
          const added = Math.max(0, T.total - T0.total);
          // Under 59 1/2 the withheld dollars are themselves penalized, so
          // covering the bill takes added / 0.9.
          fromConv = Math.min(conv, early ? added / .9 : added);
        }
        penalty = early ? .10 * (fromConv + extraTrad) : 0;
        taxDue = T.total + irm + penalty;
        rothCredit = conv - fromConv;

        const cashIn = rmd + ss + other;
        const outflow = inp.spend + taxDue - fromConv;
        let short = outflow - cashIn;

        let nSale = 0, nTrad = 0, nRoth = 0, nSurplus = 0;
        if (short <= 0){
          nSurplus = -short;                       // banked in the brokerage
        } else {
          nSale = Math.min(short, Math.max(0, brok));
          short -= nSale;
          if (short > 0){
            nTrad = Math.min(short, Math.max(0, trad - rmd - conv));
            short -= nTrad;
          }
          if (short > 0) nRoth = Math.min(short, Math.max(0, roth + rothCredit));
        }
        const settled = Math.abs(nSale - sale) < 1 && Math.abs(nTrad - extraTrad) < 1;
        sale = nSale; extraTrad = nTrad; rothW = nRoth; surplus = nSurplus;
        if (settled) break;
      }
    }

    const gp = brok > 0 ? Math.max(0, Math.min(1, (brok - basis) / brok)) : 0;
    const magi = T.agi;
    magiHist.push(magi);

    // Move the money.
    trad = Math.max(0, trad - rmd - conv - extraTrad);
    roth = Math.max(0, roth + rothCredit - rothW);
    basis = Math.max(0, basis - sale * (1 - gp) + surplus);
    brok = Math.max(0, brok - sale + surplus);

    lifeTax += T.total + penalty;
    lifeIrmaa += irm;
    lifeTaxPV += taxDue / Math.pow(1 + inp.disc, i);
    totalConv += conv;

    const afterTax = roth + brok + trad * (1 - inp.heirRate);
    rows.push({i, age, spAge, status, widowed, rmd, conv, extraTrad, sale, rothW,
      ss, other, ordinary:T.ordinaryAgi, magi, fed:T.federal + penalty, state:T.state,
      tax:T.total + penalty, penalty, irmaa:irm, irmaaTier:medicare > 0
        ? irmaaTier(lookback == null ? magi : lookback, status) : 0,
      marginal:T.marginal, trad, roth, brok, afterTax, tradBegin});

    // Real growth, applied once everything has moved.
    trad *= (1 + r); roth *= (1 + r); brok *= (1 + r); basis = Math.min(basis, brok);
  }

  const last = rows[rows.length - 1];
  return {rows, lifeTax, lifeTaxPV, lifeIrmaa, totalConv, peakRMD,
    endAfterTax:last.afterTax, endTrad:last.trad, endRoth:last.roth,
    endBrok:last.brok, rmdStart:startRMD};
}


/* ---------- debt payoff ---------- */
/* Month-by-month simulation of a set of debts under three orderings. Interest
   accrues first, then every debt takes its minimum, then whatever is left in
   the monthly pool lands entirely on one target debt. The pool is held fixed
   at the sum of the original minimums plus anything extra, so a debt that gets
   cleared frees its minimum for the next one down the list. That rollover is
   the whole mechanism -- it is why both strategies beat paying minimums, and
   the two differ only in which debt they aim at. */
export const DEBT_CAP = 720;    // 60 years; past this a plan is not a plan

/**
 * @param {Array} list - [{desc, balance, apr (percent), min}]
 * @param {number} extra - additional dollars per month, beyond the minimums
 * @param {"avalanche"|"snowball"|"min"} mode - avalanche targets the highest
 *   rate, snowball the smallest balance, min pays minimums with no rollover
 * @returns {Object|null} monthly series, per-debt detail and totals
 */
export function debtRun(list, extra, mode){
  const d = (list || []).filter(x => x.balance > 0).map(x => ({
    desc:x.desc || "Debt", apr:Math.max(0, x.apr) / 100,
    min:Math.max(0, x.min), bal:x.balance, start:x.balance,
    interest:0, paidMonth:0}));
  if (!d.length) return null;

  const roll = mode !== "min";
  const order = mode === "avalanche"
    ? d.slice().sort((a, b) => b.apr - a.apr || a.bal - b.bal)
    : mode === "snowball"
      ? d.slice().sort((a, b) => a.bal - b.bal || b.apr - a.apr)
      : d.slice();

  // The pool never shrinks as debts are cleared -- that is the rollover.
  const baseMin = d.reduce((a, x) => a + x.min, 0);
  const pool0 = baseMin + (roll ? Math.max(0, extra) : 0);

  const months = [{m:0, balance:d.reduce((a, x) => a + x.start, 0), interest:0, cleared:0}];
  let m = 0, totalInterest = 0, stalled = false;

  while (d.some(x => x.bal > 0.005)){
    m++;
    if (m > DEBT_CAP){ stalled = true; break; }
    d.forEach(x => {
      if (x.bal > 0){
        const i = x.bal * x.apr / 12;
        x.bal += i; x.interest += i; totalInterest += i;
      }
    });
    let pool = roll ? pool0 : d.reduce((a, x) => a + (x.bal > 0 ? x.min : 0), 0);
    d.forEach(x => {
      if (x.bal > 0 && pool > 0){
        const p = Math.min(x.min, x.bal, pool);
        x.bal -= p; pool -= p;
      }
    });
    if (roll){
      for (let k = 0; k < order.length; k++){
        if (pool <= 0.005) break;
        const x = order[k];
        if (x.bal > 0.005){ const p = Math.min(pool, x.bal); x.bal -= p; pool -= p; }
      }
    }
    d.forEach(x => { if (x.bal <= 0.005 && !x.paidMonth){ x.bal = 0; x.paidMonth = m; } });
    months.push({m, balance:d.reduce((a, x) => a + x.bal, 0), interest:totalInterest,
      cleared:d.filter(x => x.paidMonth && x.paidMonth <= m).length});
  }

  const cleared = d.filter(x => x.paidMonth).map(x => x.paidMonth);
  return {months, debts:d, order, totalInterest, monthsTotal:m, stalled,
    monthlyPool:pool0, baseMin,
    firstCleared: cleared.length ? Math.min.apply(null, cleared) : 0,
    totalPaid: d.reduce((a, x) => a + x.start, 0) + totalInterest};
}

/* A minimum that doesn't cover the first month's interest means the balance
   grows no matter how long you wait. Worth saying out loud rather than
   showing a payoff date sixty years out. */
export function debtUnderwater(list){
  return (list || []).filter(x => x.balance > 0 &&
    x.min <= x.balance * (Math.max(0, x.apr) / 100) / 12);
}
export function debtDate(monthsOut){
  const dt = new Date();
  dt.setDate(1);
  dt.setMonth(dt.getMonth() + Math.max(0, Math.round(monthsOut)));
  return dt.toLocaleDateString("en-US", {month:"short", year:"numeric"});
}
export function debtDur(m){
  if (!(m > 0)) return "\u2014";
  const y = Math.floor(m / 12), mo = m % 12;
  if (!y) return mo + (mo === 1 ? " month" : " months");
  if (!mo) return y + (y === 1 ? " year" : " years");
  return y + "y " + mo + "m";
}

/* ---------- mortgage ---------- */
/**
 * @param {Object} m
 * @param {number} m.price - home price, in dollars
 * @param {number} m.down - down payment, in dollars
 * @param {number} m.rate - annual interest rate, as a decimal
 * @param {number} m.term - loan term, in years
 * @param {number} m.taxPct - annual property tax rate, as a decimal of price
 * @param {number} m.ins - annual homeowners insurance, in dollars
 * @param {number} m.pmiPct - annual PMI rate, as a decimal of the loan, applied above 80% LTV
 * @param {number} m.hoa - monthly HOA dues, in dollars
 * @param {number} [m.maintPct] - annual maintenance, as a decimal of price
 * @param {number} [m.util] - monthly utilities, in dollars
 * @returns {Object} monthly payment breakdown plus year-by-year amortization
 */
export function mortgage(m){
  const loan = Math.max(0, m.price - m.down);
  const r = m.rate / 12, n = Math.round(m.term * 12);
  const pi = (r === 0) ? (n ? loan / n : 0) : loan * r / (1 - Math.pow(1 + r, -n));
  const tax = m.price * m.taxPct / 12;
  const ins = m.ins / 12;
  const ltv = m.price > 0 ? loan / m.price : 0;
  const pmiMonthly = (ltv > .80) ? loan * m.pmiPct / 12 : 0;
  const hoa = m.hoa;
  const maint = m.price * (m.maintPct || 0) / 12;
  const util = m.util || 0;
  const total = pi + tax + ins + pmiMonthly + hoa + maint + util;

  // Extra payments, a recast, and PMI's end date all fall out of the same
  // month-by-month walk, so one loop produces all of it. A lump sum only
  // ever shortens the loan, so the original term is a safe upper bound on
  // how many months this can run.
  const extraMo = Math.max(0, m.extraMonthly || 0);
  const lumpAmt = Math.max(0, m.extraOnce || 0);
  const lumpMonth = lumpAmt > 0 ? Math.max(1, Math.round(m.extraOnceMonth || 0)) : 0;
  const doRecast = !!m.recast && lumpAmt > 0;
  const pmiWasActive = ltv > .80 && m.pmiPct > 0;

  let bal = loan, totalInterest = 0, pmiPaid = 0, curPI = pi, recastPI = null;
  let pmiEndMonth = pmiWasActive ? null : 0;   // 0 = PMI never applied
  let payoffMonth = n;
  const years = [];
  let yi = 0, yp = 0, ypmi = 0, curYear = 1;

  for (let i = 1; i <= n && bal > 0.005; i++){
    // Close out the previous year before this month's payment is counted, so
    // each year holds exactly its own twelve months and its closing balance
    // is the one after month 12, 24, 36...
    const yearNo = Math.ceil(i / 12);
    if (yearNo !== curYear){
      years.push({year:curYear, interest:yi, principal:yp, paid:yi + yp,
                  balance:bal, pmi:ypmi});
      yi = 0; yp = 0; ypmi = 0; curYear = yearNo;
    }
    const interest = bal * r;
    let extra = extraMo + (i === lumpMonth ? lumpAmt : 0);
    let principal = curPI - interest + extra;
    if (principal > bal) principal = bal;
    bal = Math.max(0, bal - principal);
    totalInterest += interest;
    yi += interest; yp += principal;

    if (m.price > 0 && bal / m.price > .80 && m.pmiPct > 0){
      ypmi += pmiMonthly; pmiPaid += pmiMonthly;
    } else if (pmiWasActive && pmiEndMonth === null){
      pmiEndMonth = i;
    }

    // Recasting re-derives the required payment from the balance right after
    // the lump sum lands, spread over whatever's left of the original term
    // -- same rate, same payoff date, smaller check every month after.
    if (doRecast && i === lumpMonth && bal > 0){
      const remaining = Math.max(1, n - i);
      curPI = (r === 0) ? bal / remaining : bal * r / (1 - Math.pow(1 + r, -remaining));
      recastPI = curPI;
    }

    if (bal <= 0.005) payoffMonth = i;
  }
  if (yi > 0 || yp > 0 || !years.length)
    years.push({year:curYear, interest:yi, principal:yp, paid:yi + yp,
                balance:bal, pmi:ypmi});

  return {loan, pi, tax, ins, pmi:pmiMonthly, hoa, maint, util, total, years,
          totalInterest, pmiPaid, ltv, n, payoffMonth, pmiEndMonth, recastPI,
          extraActive: extraMo > 0 || lumpAmt > 0};
}

/* A refinance is compared as if it closed today, on the balance and terms
   already entered: the new loan gets the same extra-payment plan as the
   current one, so the comparison isolates the rate and term change rather
   than mixing in a change in payment behavior too. */
export function refiCompare(m, refi){
  const now = mortgage(m);
  const then = mortgage(Object.assign({}, m, {rate:refi.rate, term:refi.term}));
  const monthlyDelta = now.pi - then.pi;               // positive = payment drops
  const breakEvenMonths = monthlyDelta > 0.005
    ? Math.ceil(refi.cost / monthlyDelta) : null;
  const allInNow = now.totalInterest + now.pmiPaid;
  const allInThen = then.totalInterest + then.pmiPaid + refi.cost;
  return {now, then, monthlyDelta, breakEvenMonths,
          lifetimeDelta: allInNow - allInThen};      // positive = refinancing wins
}


/* Calendar-year returns compounded from the monthly series (data/history.js), so the
   annual engines (drawdown, backtest) and the monthly engine can never drift
   apart: there is one dataset, aggregated two ways. */
export function histAnnual(m){
  var out = [], y, k, g;
  for (y = 0; y * 12 < m.length; y++){
    g = 1;
    for (k = 0; k < 12; k++) g *= (1 + m[y * 12 + k] / 100);
    out.push((g - 1) * 100);
  }
  return out;
}
export var HIST_STOCK = histAnnual(HIST_M_STOCK);
export var HIST_BOND = histAnnual(HIST_M_BOND);
export var HIST_INFL = histAnnual(HIST_M_INFL);

/* Spreadsheet PMT with payments at the start of each period (type 1): the
   level payment that takes pv down to fv over n periods at rate r. The
   drawdown engine (drawdown.js) and the plan engine both use it. */
export function pmtStart(r, n, pv, fv){
  if (n <= 0) return 0;
  if (Math.abs(r) < 1e-12) return (pv - fv) / n;
  const g = Math.pow(1 + r, n);
  return (pv * g - fv) * r / ((g - 1) * (1 + r));
}

/* ---------- Social Security estimator ----------
   Uses the real PIA formula: average indexed monthly earnings run through two
   bend points, then adjusted for claiming age. This assumes a roughly steady
   career at the income entered. A statement from ssa.gov reflects your actual
   35-year earnings record, so the manual figure is always more accurate.
   The bend points and the earnings cap (the FICA wage base) are the newest
   year's (yearData()). */
export var SS_FRA = 67;

/**
 * @param {number} income - annual income, in dollars
 * @param {number} careerYears - years worked at this income (capped at 35, the number Social Security averages over)
 * @param {number} claimAge - age benefits start, 62-70
 * @returns {{aime: number, pia: number, adjustment: number, monthly: number, annual: number, atFRA: number, fra: number}}
 */
export function ssEstimate(income, careerYears, claimAge) {
  var Y = yearData(), SS_BEND1 = Y.ss.bend1, SS_BEND2 = Y.ss.bend2;
  var capped = Math.min(Math.max(0, income), Y.fica.ssCap);
  // Social Security averages your best 35 years; a shorter career means zeros
  // get averaged in, which drags the benefit down.
  var yrs = Math.max(1, Math.min(35, careerYears || 35));
  var aime = (capped / 12) * (yrs / 35);
  var pia;
  if (aime <= SS_BEND1) {
    pia = 0.90 * aime;
  } else if (aime <= SS_BEND2) {
    pia = 0.90 * SS_BEND1 + 0.32 * (aime - SS_BEND1);
  } else {
    pia = 0.90 * SS_BEND1 + 0.32 * (SS_BEND2 - SS_BEND1) + 0.15 * (aime - SS_BEND2);
  }
  var age = Math.min(70, Math.max(62, claimAge || SS_FRA));
  var adj = 1;
  if (age < SS_FRA) {
    var early = (SS_FRA - age) * 12;
    var first36 = Math.min(36, early);
    var beyond = Math.max(0, early - 36);
    adj = 1 - (first36 * (5 / 9) / 100) - (beyond * (5 / 12) / 100);
  } else if (age > SS_FRA) {
    adj = 1 + (age - SS_FRA) * 0.08;
  }
  return {
    aime: aime, pia: pia, adjustment: adj,
    monthly: pia * adj, annual: pia * adj * 12,
    atFRA: pia * 12, fra: SS_FRA
  };
}
/* A spousal benefit's own claiming adjustment: it is cut more steeply than a
   worker's for an early claim (25/36 of 1% a month for the first 36 months,
   5/12 of 1% after, so 35% at 62 rather than 30%) and earns no delayed
   retirement credits past full retirement age. */
export function ssSpousalAdj(claimAge) {
  var age = Math.min(70, Math.max(62, claimAge || SS_FRA));
  if (age >= SS_FRA) return 1;
  var early = (SS_FRA - age) * 12;
  return 1 - Math.min(36, early) * (25 / 36) / 100 - Math.max(0, early - 36) * (5 / 12) / 100;
}
/* Estimate-mode Social Security for the Drawdown tool, as the streams
   runDrawdown takes. In a couple, a spouse whose own full benefit is less
   than half the other's gets the difference as a spousal top-up. It can only
   start once both have claimed (the worker has to file first), it is reduced
   on the spousal schedule for the age it starts at, and both spouses are
   taken to be the same age, as everywhere else in the tool. Without a
   retirement age the tool runs one shared delay, so everything folds into
   the first stream. */
export function ssDrawdownStreams(inc1, claim1, inc2, claim2, couple, retireAge, sharedDelay) {
  claim1 = Math.min(70, Math.max(62, claim1 || SS_FRA));
  claim2 = Math.min(70, Math.max(62, claim2 || SS_FRA));
  var delayFor = function (c) {
    return retireAge != null ? Math.max(0, Math.round(c - retireAge))
                             : Math.max(0, Math.round(sharedDelay || 0));
  };
  var e1 = ssEstimate(inc1, 40, claim1);
  var out = {annual: e1.annual, delay: delayFor(claim1), annual2: 0, delay2: 0,
             annual3: 0, delay3: 0, own1: e1.annual, own2: 0, top1: 0, top2: 0};
  if (couple) {
    var e2 = ssEstimate(inc2, 40, claim2);
    var both = Math.max(claim1, claim2), adj = ssSpousalAdj(both);
    out.own2 = e2.annual;
    out.top1 = Math.max(0, 0.5 * e2.pia - e1.pia) * adj * 12;
    out.top2 = Math.max(0, 0.5 * e1.pia - e2.pia) * adj * 12;
    if (retireAge != null) {
      out.annual2 = e2.annual; out.delay2 = delayFor(claim2);
      out.annual3 = out.top1 + out.top2; out.delay3 = delayFor(both);
    } else {
      out.annual += e2.annual + out.top1 + out.top2;
    }
  }
  out.total = out.own1 + out.own2 + out.top1 + out.top2;
  return out;
}

/* ---------- Historical sequences ---------- */
/* Runs the plan's own contribution schedule through every rolling window of
   real market history. The rate-of-return and inflation inputs are ignored
   here on purpose: this mode asks what the plan would have done through the
   actual past, so returns come from the stock/bond mix and the deflator comes
   from that window's own CPI. Fees still come off every year, and the
   contribution schedule, growth and glide are whatever the plan says.
 * @param {Object} g - {initial, fees}
 * @param {StageParams[]} stages - each may carry .mix (stock share, 0-1) and
 *   .glide {on, years, endMix}
 * @returns {Object} bands (percentiles per year), traces (one path per starting
 *   year, aligned with bands), windows, finals, count
 */
export function historicalRuns(g, stages){
  const avail = HIST_M_STOCK.length;            // months of real data
  let totalYears = 0;
  for (let i = 0; i < stages.length; i++) totalYears += stages[i].years;
  const N = Math.ceil(totalYears * 12 - 1e-9);  // months the plan runs
  const base = {bands:[], windows:[], finals:[], totalYears, N,
                count:0, median:0, first:HIST_START,
                last:HIST_START + Math.floor(avail / 12) - 1,
                span:Math.floor(avail / 12), tooLong:false};
  if (!(N > 0)) return base;
  if (N > avail) return Object.assign(base, {tooLong:true});

  /* One entry per month of the plan: what goes in that month and how much of
     it sits in stocks. Contributions land on the months they actually happen —
     a quarterly contributor buys in March, June, September and December, not in
     twelve equal slices — which is the whole point of running this monthly. */
  const plan = [];
  let elapsedM = 0;
  for (let si = 0; si < stages.length; si++){
    const st = stages[si];
    const ppy = PPY[st.period];
    const mix = (st.mix == null ? .8 : st.mix);
    const glideOn = !!(st.glide && st.glide.on);
    const gYears = glideOn ? Math.min(st.glide.years, st.years) : 0;
    const endMix = glideOn
      ? (st.glide.endMix == null ? Math.min(mix, .4) : st.glide.endMix) : mix;
    const months = Math.ceil(st.years * 12 - 1e-9);
    for (let k = 1; k <= months; k++){
      const yearNo = Math.ceil(k / 12);                 // year within the stage
      const w = glideOn
        ? glideAnnualRate(yearNo, st.years, gYears, mix, endMix) : mix;
      const grown = st.contrib * Math.pow(1 + st.growth, yearNo - 1);
      let amount;
      if (ppy >= 12) amount = grown * (ppy / 12);       // weekly, bi-weekly, monthly
      else if (ppy === 4) amount = (k % 3 === 0) ? grown : 0;   // quarterly
      else amount = (k % 12 === 0) ? grown : 0;                 // annually
      plan.push({stage: si + 1,
                 year: (elapsedM + k) / 12,
                 amount,
                 w: Math.max(0, Math.min(1, w))});
    }
    elapsedM += months;
  }

  const M = plan.length;
  if (!M) return base;
  const count = avail - N + 1;
  const feeM = Math.pow(1 + (g.fees || 0), 1 / 12) - 1;   // annual fee, monthly
  /* Band points once a year keeps the chart the same shape it has always been;
     the arithmetic underneath is still month by month. */
  const marks = [];
  for (let k = 0; k < M; k++)
    if ((k + 1) % 12 === 0 || k === M - 1 || plan[k + 1].stage !== plan[k].stage) marks.push(k);
  const paths = marks.map(() => new Float64Array(count));
  const finals = new Float64Array(count);
  const windows = [];

  for (let wi = 0; wi < count; wi++){
    let bal = g.initial, cum = 1, mi = 0;
    for (let k = 0; k < M; k++){
      const pl = plan[k], idx = wi + k;
      let r = (pl.w * HIST_M_STOCK[idx] + (1 - pl.w) * HIST_M_BOND[idx]) / 100 - feeM;
      if (r <= -0.999) r = -0.999;
      bal = bal * (1 + r) + pl.amount;
      cum *= (1 + HIST_M_INFL[idx] / 100);
      if (mi < marks.length && marks[mi] === k){ paths[mi][wi] = bal / cum; mi++; }
    }
    finals[wi] = bal / cum;
    const y0 = HIST_START + Math.floor(wi / 12);
    windows.push({start: y0, startMonth: (wi % 12) + 1,
                  end: HIST_START + Math.floor((wi + N - 1) / 12),
                  final: bal / cum});
  }

  const asc = (a, b) => a - b;
  const bands = [];
  for (let j = 0; j < marks.length; j++){
    const sorted = paths[j].slice().sort(asc);
    bands.push({year: plan[marks[j]].year, stage: plan[marks[j]].stage,
                p10: pctl(sorted, .10), p25: pctl(sorted, .25),
                p50: pctl(sorted, .50), p75: pctl(sorted, .75),
                p90: pctl(sorted, .90)});
  }
  /* One path per starting year (the January start) for the charts' faint
     every-start lines. A start every month would be twelve times as many,
     too dense to read as lines; the percentiles above still use them all. */
  const traces = [];
  for (let wi = 0; wi < count; wi += 12){
    const t = new Array(marks.length);
    for (let j = 0; j < marks.length; j++) t[j] = paths[j][wi];
    traces.push(t);
  }
  const sortedFinals = finals.slice().sort(asc);
  let worst = windows[0], best = windows[0];
  windows.forEach(w => { if (w.final < worst.final) worst = w;
                         if (w.final > best.final) best = w; });

  return {bands, traces, windows, finals:sortedFinals, totalYears, N, count,
          median: pctl(sortedFinals, .5), worst, best,
          first: HIST_START, last: HIST_START + Math.floor(avail / 12) - 1,
          span: Math.floor(avail / 12), tooLong:false};
}

/* ---------- Portfolio backtest ---------- */
/* A fixed mix, rebalanced once a year, run across a slice of the historical
   record: US stocks, small-cap value and cash at their shares, bonds the
   rest. Everything here is descriptive: no projection, no assumption, just
   what this mix did. */
/**
 * @param {Object} o - {stockPct, svPct, cashPct, rebal, rebalN, rebalBand, fee, initial, startYear, endYear}
 * @returns {Object} per-year rows, summary statistics and rolling-window tables
 */
export function backtest(o){
  const avail = HIST_STOCK.length;
  let s0 = Math.round((o.startYear || HIST_START) - HIST_START);
  let s1 = Math.round((o.endYear || (HIST_START + avail - 1)) - HIST_START);
  /* Small-cap value and cash (drawdown.js's calendar years) start in July
     1926, so a mix holding either starts in 1927, its first full year. */
  const ws = Math.max(0, Math.min(1, (o.svPct || 0) / 100)), wc = Math.max(0, Math.min(1, (o.cashPct || 0) / 100));
  const minIdx = ws > 0 || wc > 0 ? 1 : 0;
  s0 = Math.max(minIdx, Math.min(avail - 1, s0));
  s1 = Math.max(s0, Math.min(avail - 1, s1));
  const w = Math.max(0, Math.min(1 - ws - wc, (o.stockPct || 0) / 100));
  const wb = Math.max(0, 1 - w - ws - wc);
  const fee = (o.fee || 0) / 100;
  const start = Math.max(1, o.initial || 10000);
  /* Rebalancing, as the Drawdown Simulator does it: back to the mix every
     year (one blended return), every rebalN years, when any holding is more
     than rebalBand points off its target (checked each year), or never. Each
     holding is tracked between rebalances; a year begins with any rebalance
     due. */
  const rb = o.rebal === "every" || o.rebal === "band" || o.rebal === "never" ? o.rebal : "year";
  const rbN = Math.max(1, Math.round(o.rebalN || 1)), rbBand = Math.max(0, o.rebalBand || 0) / 100;
  const wts = [w, ws, wb, wc];
  let hold = null, rebalances = 0;

  const rows = [], rets = [], reals = [];
  let bal = start, cum = 1, peak = start, maxDD = 0, ddFrom = 0, ddTo = 0;
  let curPeakYear = HIST_START + s0;
  for (let i = s0; i <= s1; i++){
    const sv = ws > 0 ? HIST_SV[i] : 0, cash = wc > 0 ? HIST_CASH[i] : 0;
    let r;
    if (rb === "year") r = (w * HIST_STOCK[i] + ws * sv + wb * HIST_BOND[i] + wc * cash) / 100 - fee;
    else {
      const k = i - s0;
      if (!hold) hold = wts.map(x => x * bal);
      else {
        const due = rb === "every" ? k % rbN === 0
          : rb === "band" && bal > 0 && hold.some((h, j) => Math.abs(h / bal - wts[j]) > rbBand + 1e-12);
        if (due){ hold = wts.map(x => x * bal); rebalances++; }
      }
      const rr = [HIST_STOCK[i], sv, HIST_BOND[i], cash];
      hold = hold.map((h, j) => Math.max(0, h * (1 + rr[j] / 100 - fee)));
      const nb = hold[0] + hold[1] + hold[2] + hold[3];
      r = bal > 0 ? nb / bal - 1 : 0;
    }
    const infl = HIST_INFL[i] / 100;
    const real = (1 + r) / (1 + infl) - 1;
    bal = bal * (1 + r);
    cum *= (1 + infl);
    if (bal > peak){ peak = bal; curPeakYear = HIST_START + i; }
    const dd = peak > 0 ? bal / peak - 1 : 0;
    if (dd < maxDD){ maxDD = dd; ddFrom = curPeakYear; ddTo = HIST_START + i; }
    rets.push(r); reals.push(real);
    rows.push({year: HIST_START + i, stock: HIST_STOCK[i], bond: HIST_BOND[i], sv, cash,
               ret: r, infl, real, end: bal, endReal: bal / cum});
  }

  const n = rets.length;
  const mean = rets.reduce((a, b) => a + b, 0) / n;
  let ss = 0;
  rets.forEach(r => { ss += (r - mean) * (r - mean); });
  const vol = n > 1 ? Math.sqrt(ss / (n - 1)) : 0;
  const cagr = Math.pow(bal / start, 1 / n) - 1;
  const realCagr = Math.pow((bal / cum) / start, 1 / n) - 1;
  const inflCagr = Math.pow(cum, 1 / n) - 1;

  let bestYr = rows[0], worstYr = rows[0];
  rows.forEach(r => { if (r.ret > bestYr.ret) bestYr = r;
                      if (r.ret < worstYr.ret) worstYr = r; });
  const up = rets.filter(r => r > 0).length;

  /* Inflation is its own story in this data, not just a deflator. */
  let inflHigh = rows[0], inflLow = rows[0];
  rows.forEach(r => { if (r.infl > inflHigh.infl) inflHigh = r;
                      if (r.infl < inflLow.infl) inflLow = r; });
  const deflationYears = rows.filter(r => r.infl < 0).length;

  /* Rolling windows, annualized, from the selected slice only. */
  const mid = arr => {
    const a = arr.slice().sort((x, y) => x - y);
    const h = Math.floor(a.length / 2);
    return a.length % 2 ? a[h] : (a[h - 1] + a[h]) / 2;
  };
  const rolling = [1, 5, 10, 20, 30].map(L => {
    if (L > n) return {len:L, count:0};
    const nom = [], rl = [];
    for (let i = 0; i + L <= n; i++){
      let gN = 1, gR = 1;
      for (let k = i; k < i + L; k++){ gN *= (1 + rets[k]); gR *= (1 + reals[k]); }
      nom.push(Math.pow(gN, 1 / L) - 1);
      rl.push(Math.pow(gR, 1 / L) - 1);
    }
    return {len:L, count:nom.length,
            nomWorst: Math.min.apply(null, nom), nomBest: Math.max.apply(null, nom),
            nomMed: mid(nom), nomPos: nom.filter(v => v > 0).length / nom.length,
            realWorst: Math.min.apply(null, rl), realBest: Math.max.apply(null, rl),
            realMed: mid(rl), realPos: rl.filter(v => v > 0).length / rl.length};
  }).filter(x => x.count > 0);

  return {rows, years:n, first: HIST_START + s0, last: HIST_START + s1,
          stockPct: w * 100, svPct: ws * 100, bondPct: wb * 100, cashPct: wc * 100, minYear: HIST_START + minIdx, rebal: rb, rebalances,
          endMix: hold && bal > 0 ? hold.map(h => h / bal) : wts.slice(), cagr, realCagr, inflCagr, vol,
          endBal: bal, endReal: bal / cum, start,
          best: bestYr, worst: worstYr, upYears: up, downYears: n - up,
          maxDD, ddFrom, ddTo, rolling,
          inflHigh, inflLow, deflationYears, priceLevel: cum};
}

/* ---------- ACA marketplace premiums ----------
   The Healthcare Cost Planner's calculations, here in the engine because the
   Early Retirement Bridge and the retirement plan engine price health
   insurance before Medicare with them too. The poverty line, benchmark
   premiums and applicable percentages are the newest year's
   (yearData().aca). */
// Federal default standard age curve, ages 21-64 (21 = 1.000, 64+ = 3.000).
// CMS, "Final Guidance Regarding Age Curves and State Reporting", 16 Dec 2016,
// Appendix I; in force for plan years 2018 on. A handful of states (and DC)
// set their own curve, which runs somewhat flatter.
export var HC_AGE_MULT = [
  1.000,1.000,1.000,1.000, // 21-24
  1.004,1.024,1.048,1.087, // 25-28
  1.119,1.135,1.159,1.183, // 29-32
  1.198,1.214,1.222,1.230, // 33-36
  1.238,1.246,1.262,1.278, // 37-40
  1.302,1.325,1.357,1.397, // 41-44
  1.444,1.500,1.563,1.635, // 45-48
  1.706,1.786,1.865,1.952, // 49-52
  2.040,2.135,2.230,2.333, // 53-56
  2.437,2.548,2.603,2.714, // 57-60
  2.810,2.873,2.952,3.000  // 61-64
];
export var HC_AGE40_MULT = 1.278; // index 19 = age 40 - 21

export function hcFPL(size){
  var A = yearData().aca;
  size = Math.max(1, Math.round(size));
  if (size <= 8) return A.fplBase[size];
  return A.fplBase[8] + (size - 8) * A.fplPerAddl;
}

export function hcAgeMultiplier(age){
  age = Math.max(21, Math.min(64, Math.round(age)));
  return HC_AGE_MULT[age - 21];
}

// Gross monthly benchmark Silver premium for given state & age
export function hcGrossPremium(state, age, manualOverride){
  if (manualOverride > 0) return manualOverride;
  var base = yearData().aca.premium40[state] || 500;
  return base / HC_AGE40_MULT * hcAgeMultiplier(age);
}

// Standard ACA contribution % of income: the newest year's applicable
// percentage table (yearData().aca.contrib), with its subsidy cliff.
// Returns null when income is too high for subsidy.
export function hcContribPctStd(pctFPL){
  var A = yearData().aca, t = A.contrib, i = 0;
  if (pctFPL < t[0][0]) return 0;
  if (pctFPL > A.cliff) return null;
  while (i + 1 < t.length && !(pctFPL < t[i + 1][0])) i++;
  if (t[i][2] === t[i][3]) return t[i][2];
  return t[i][2] + (pctFPL - t[i][0]) / t[i][1] * (t[i][3] - t[i][2]);
}

// Enhanced contribution % (ARP/IRA rules, 2021-2025: 8.5% cap, no cliff above
// 400% FPL). Expired after 2025; kept to show what a restoration would mean.
export function hcContribPctEnhanced(pctFPL){
  if (pctFPL < 1.0) return 0;
  if (pctFPL < 1.50) return 0;
  if (pctFPL < 2.00) return (pctFPL - 1.50) / 0.50 * 0.020;
  if (pctFPL < 2.50) return 0.020 + (pctFPL - 2.00) / 0.50 * 0.020;
  if (pctFPL < 3.00) return 0.040 + (pctFPL - 2.50) / 0.50 * 0.020;
  if (pctFPL < 4.00) return 0.060 + (pctFPL - 3.00) / 1.00 * 0.025;
  return 0.085;
}

// Returns {credit, net, eligible, pct} — monthly figures
export function hcCalcACA(income, grossPremium, pctFPL, enhanced){
  var pct = enhanced ? hcContribPctEnhanced(pctFPL) : hcContribPctStd(pctFPL);
  if (pct === null) return {credit:0, net:grossPremium, eligible:false, pct:0};
  var maxContrib = income * pct / 12;
  var credit = Math.max(0, grossPremium - maxContrib);
  var net = Math.max(0, grossPremium - credit);
  return {credit:credit, net:net, eligible:true, pct:pct};
}


// ===MATH END===
