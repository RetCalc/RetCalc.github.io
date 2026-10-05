/* The calculation engine: projections, Monte Carlo, taxes, Social Security, RMDs and Roth
   conversions, ACA premiums, mortgages, debt and the historical data.

   Moved from src/js/math.js without changes to the math: the only edits are
   `export` on each top-level name and the imports below. Import the engine
   through typed.ts (core.js), not this file: math.js and drawdown.js read
   each other's names, and core.js loads them in the order that works. */
import {
  HIST_CASH, HIST_SV
} from "./drawdown.js";

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

/* ---------- 2026 tax data ----------
   Federal brackets, standard deduction and FICA limits are tax year 2026
   (IRS Rev. Proc. 2025-32). State brackets, standard deductions and personal
   exemptions are as of January 1, 2026 per the Tax Foundation's annual survey.
   Brackets are [threshold, rate] pairs; the rate applies to income above the
   threshold. Local income taxes are not included. Retirement-specific rules --
   exclusions, senior deductions, state capital-gain treatment -- are separate,
   in RET_STATE below. */
export const FED_2026 = {
  s: [[0,.10],[12400,.12],[50400,.22],[105700,.24],[201775,.32],[256225,.35],[640600,.37]],
  m: [[0,.10],[24800,.12],[100800,.22],[211400,.24],[403550,.32],[512450,.35],[768700,.37]]
};
export const FED_STD = {s:16100, m:32200};
export const FICA = {ssRate:.062, ssCap:184500, medRate:.0145, addlRate:.009,
              addlThreshold:{s:200000, m:250000}};

/* ---------- retirement-specific 2026 data ----------
   Long-term capital gain / qualified dividend breakpoints are the maximum
   zero-rate and maximum 15% amounts from IRS Rev. Proc. 2025-32 sec. 3.03,
   stated as taxable income including the gain. Above the second figure the
   rate is 20%. */
export const LTCG_2026 = {s:[49450, 545500], m:[98900, 613700]};

/* IRC sec. 1411. The thresholds are statutory and have never been indexed. */
export const NIIT = {rate:.038, threshold:{s:200000, m:250000}};

/* Two separate age-65 benefits stack in 2026:
   - the long-standing additional standard deduction (Rev. Proc. 2025-32),
     $2,050 for a single filer, $1,650 per qualifying spouse on a joint
     return. Standard-deduction filers only.
   - the OBBBA sec. 70103 "senior deduction", $6,000 per qualifying person for
     tax years 2025-2028, available to itemizers too, reduced by 6% of MAGI
     above $75,000 single / $150,000 joint. */
export const SENIOR_ADDL = {s:2050, m:1650};
export const SENIOR_BONUS = {amount:6000, rate:.06, start:{s:75000, m:150000}};

/* IRC sec. 86. Provisional income = AGI + tax-exempt interest + half of
   benefits. Between the two thresholds up to 50% of benefits become taxable;
   above the second, up to 85%. Neither figure has ever been indexed. */
export const SS_PROV = {t1:{s:25000, m:32000}, t2:{s:34000, m:44000}};

/* States that still include any Social Security in taxable income for 2026.
   Every other state, plus DC, fully exempts benefits. West Virginia completed
   its phase-out effective tax year 2026; Missouri, Kansas and Nebraska
   dropped off in earlier years. Each of these eight has its own income-based
   exemption that this does not model — see the About tab. Colorado is the one
   exception handled here, because its subtraction is a clean full exemption
   at 65 and over. */
export const SS_TAX_STATES = {CO:1, CT:1, MN:1, MT:1, NM:1, RI:1, UT:1, VT:1};
export const MORT_RATE_ASOF = "Freddie Mac weekly average, 3 September 2026";
export const MORT_RATE_30 = 6.71;

/* sd/pe: [single, married]. pec = exemption delivered as a credit instead.
   sdc = standard deduction delivered as a credit. */
export const STATES = {
  AL:{n:"Alabama",sd:[3000,8500],pe:[1500,3000],b:{s:[[0,.02],[500,.04],[3000,.05]],m:[[0,.02],[1000,.04],[6000,.05]]}},
  AK:{n:"Alaska",none:1},
  AZ:{n:"Arizona",sd:[8350,16700],b:{s:[[0,.025]],m:[[0,.025]]}},
  AR:{n:"Arkansas",sd:[2470,4940],pec:[29,58],b:{s:[[0,.02],[4600,.039]],m:[[0,.02],[4600,.039]]}},
  CA:{n:"California",sd:[5540,11080],pec:[153,306],b:{s:[[0,.01],[11079,.02],[26264,.04],[41452,.06],[57542,.08],[72724,.093],[371479,.103],[445771,.113],[742953,.123],[1000000,.133]],m:[[0,.01],[22158,.02],[52528,.04],[82904,.06],[115084,.08],[145448,.093],[742958,.103],[891542,.113],[1000000,.123],[1485906,.133]]}},
  CO:{n:"Colorado",sd:[16100,32200],b:{s:[[0,.044]],m:[[0,.044]]}},
  CT:{n:"Connecticut",pe:[15000,24000],b:{s:[[0,.02],[10000,.045],[50000,.055],[100000,.06],[200000,.065],[250000,.069],[500000,.0699]],m:[[0,.02],[20000,.045],[100000,.055],[200000,.06],[400000,.065],[500000,.069],[1000000,.0699]]}},
  DE:{n:"Delaware",sd:[3250,6500],pec:[110,220],b:{s:[[0,0],[2000,.022],[5000,.039],[10000,.048],[20000,.052],[25000,.0555],[60000,.066]],m:[[0,0],[2000,.022],[5000,.039],[10000,.048],[20000,.052],[25000,.0555],[60000,.066]]}},
  FL:{n:"Florida",none:1},
  GA:{n:"Georgia",sd:[12000,24000],b:{s:[[0,.0519]],m:[[0,.0519]]}},
  HI:{n:"Hawaii",sd:[4400,8800],pe:[1144,2288],b:{s:[[0,.014],[9600,.032],[14400,.055],[19200,.064],[24000,.068],[36000,.072],[48000,.076],[125000,.079],[175000,.0825],[225000,.09],[275000,.10],[325000,.11]],m:[[0,.014],[19200,.032],[28800,.055],[38400,.064],[48000,.068],[72000,.072],[96000,.076],[250000,.079],[350000,.0825],[450000,.09],[550000,.10],[650000,.11]]}},
  ID:{n:"Idaho",sd:[16100,32200],b:{s:[[0,0],[4811,.053]],m:[[0,0],[9622,.053]]}},
  /* Illinois is modeled precisely rather than through the generic state
     machinery, since it is the tool's default state. Flat 4.95% rate, applied
     to federal AGI rather than federal taxable income (the federal std/item
     deduction never reduces the Illinois base, which the generic afterPre
     figure already respects). $2,925 personal exemption per person for 2026,
     +$1,000 per person 65 or older, and the exemption disappears entirely
     -- a cliff, not a phase-out -- once federal AGI exceeds $250,000 single
     or $500,000 joint (35 ILCS 5/204). What Illinois does to retirement
     income specifically now lives with every other state's rules, in
     RET_STATE below. */
  IL:{n:"Illinois",pe:[2925,5850],peAge:1000,agiCap:[250000,500000],
      b:{s:[[0,.0495]],m:[[0,.0495]]}},
  IN:{n:"Indiana",pe:[1000,2000],b:{s:[[0,.0295]],m:[[0,.0295]]}},
  IA:{n:"Iowa",sd:[16100,32200],pec:[40,80],b:{s:[[0,.038]],m:[[0,.038]]}},
  KS:{n:"Kansas",sd:[3605,8240],pe:[9160,18320],b:{s:[[0,.052],[23000,.0558]],m:[[0,.052],[46000,.0558]]}},
  KY:{n:"Kentucky",sd:[3360,3360],b:{s:[[0,.035]],m:[[0,.035]]}},
  LA:{n:"Louisiana",sd:[12875,25750],b:{s:[[0,.03]],m:[[0,.03]]}},
  ME:{n:"Maine",sd:[8350,16700],pe:[5300,10600],b:{s:[[0,.058],[27399,.0675],[64849,.0715]],m:[[0,.058],[54849,.0675],[129749,.0715]]}},
  MD:{n:"Maryland",sd:[3350,6700],pe:[3200,6400],b:{s:[[0,.02],[1000,.03],[2000,.04],[3000,.0475],[100000,.05],[125000,.0525],[150000,.055],[250000,.0575],[500000,.0625],[1000000,.065]],m:[[0,.02],[1000,.03],[2000,.04],[3000,.0475],[150000,.05],[175000,.0525],[225000,.055],[300000,.0575],[600000,.0625],[1200000,.065]]}},
  MA:{n:"Massachusetts",pe:[4400,8800],b:{s:[[0,.05],[1083150,.09]],m:[[0,.05],[1083150,.09]]}},
  MI:{n:"Michigan",pe:[5900,11800],b:{s:[[0,.0425]],m:[[0,.0425]]}},
  MN:{n:"Minnesota",sd:[15300,30600],b:{s:[[0,.0535],[33310,.068],[109430,.0785],[203150,.0985]],m:[[0,.0535],[48700,.068],[193480,.0785],[337930,.0985]]}},
  MS:{n:"Mississippi",sd:[2300,4600],pe:[6000,12000],b:{s:[[0,0],[10000,.04]],m:[[0,0],[10000,.04]]}},
  MO:{n:"Missouri",sd:[16100,32200],b:{s:[[0,0],[1348,.02],[2696,.025],[4044,.03],[5392,.035],[6740,.04],[8088,.045],[9436,.047]],m:[[0,0],[1348,.02],[2696,.025],[4044,.03],[5392,.035],[6740,.04],[8088,.045],[9436,.047]]}},
  MT:{n:"Montana",sd:[16100,32200],b:{s:[[0,.047],[47500,.0565]],m:[[0,.047],[95000,.0565]]}},
  NE:{n:"Nebraska",sd:[8850,17700],pec:[176,352],b:{s:[[0,.0246],[4130,.0351],[24760,.0455]],m:[[0,.0246],[8250,.0351],[49530,.0455]]}},
  NV:{n:"Nevada",none:1},
  NH:{n:"New Hampshire",none:1},
  NJ:{n:"New Jersey",pe:[1000,2000],b:{s:[[0,.014],[20000,.0175],[35000,.035],[40000,.0553],[75000,.0637],[500000,.0897],[1000000,.1075]],m:[[0,.014],[20000,.0175],[50000,.0245],[70000,.035],[80000,.0553],[150000,.0637],[500000,.0897],[1000000,.1075]]}},
  NM:{n:"New Mexico",sd:[16100,32200],b:{s:[[0,.015],[5500,.032],[16500,.043],[33500,.047],[66500,.049],[210000,.059]],m:[[0,.015],[8000,.032],[25000,.043],[50000,.047],[100000,.049],[315000,.059]]}},
  NY:{n:"New York",sd:[8000,16050],b:{s:[[0,.039],[8500,.044],[11700,.0515],[13900,.054],[80650,.059],[215400,.0685],[1077550,.0965],[5000000,.103],[25000000,.109]],m:[[0,.039],[17150,.044],[23600,.0515],[27900,.054],[161550,.059],[323200,.0685],[2155350,.0965],[5000000,.103],[25000000,.109]]}},
  NC:{n:"North Carolina",sd:[12750,25500],b:{s:[[0,.0399]],m:[[0,.0399]]}},
  ND:{n:"North Dakota",sd:[16100,32200],b:{s:[[0,0],[48475,.0195],[244825,.025]],m:[[0,0],[80975,.0195],[298075,.025]]}},
  OH:{n:"Ohio",pe:[2400,4800],b:{s:[[0,0],[26050,.0275]],m:[[0,0],[26050,.0275]]}},
  OK:{n:"Oklahoma",sd:[6350,12700],pe:[1000,2000],b:{s:[[0,0],[3750,.025],[4900,.035],[7200,.045]],m:[[0,0],[7500,.025],[9800,.035],[14400,.045]]}},
  OR:{n:"Oregon",sd:[2910,5820],pec:[256,512],b:{s:[[0,.0475],[4550,.0675],[11400,.0875],[125000,.099]],m:[[0,.0475],[9100,.0675],[22800,.0875],[250000,.099]]}},
  PA:{n:"Pennsylvania",b:{s:[[0,.0307]],m:[[0,.0307]]}},
  RI:{n:"Rhode Island",sd:[11200,22400],pe:[5250,10500],b:{s:[[0,.0375],[82050,.0475],[186450,.0599]],m:[[0,.0375],[82050,.0475],[186450,.0599]]}},
  SC:{n:"South Carolina",sd:[8350,16700],b:{s:[[0,0],[3640,.03],[18230,.06]],m:[[0,0],[3640,.03],[18230,.06]]}},
  SD:{n:"South Dakota",none:1},
  TN:{n:"Tennessee",none:1},
  TX:{n:"Texas",none:1},
  UT:{n:"Utah",sdc:[966,1932],b:{s:[[0,.045]],m:[[0,.045]]}},
  VT:{n:"Vermont",sd:[7650,15300],pe:[5300,10600],b:{s:[[0,.0335],[49400,.066],[119700,.076],[249700,.0875]],m:[[0,.0335],[82500,.066],[199450,.076],[304000,.0875]]}},
  VA:{n:"Virginia",sd:[8750,17500],pe:[930,1860],b:{s:[[0,.02],[3000,.03],[5000,.05],[17000,.0575]],m:[[0,.02],[3000,.03],[5000,.05],[17000,.0575]]}},
  WA:{n:"Washington",none:1},
  WV:{n:"West Virginia",pe:[2000,4000],b:{s:[[0,.0222],[10000,.0296],[25000,.0333],[40000,.0444],[60000,.0482]],m:[[0,.0222],[10000,.0296],[25000,.0333],[40000,.0444],[60000,.0482]]}},
  WI:{n:"Wisconsin",sd:[13960,25840],pe:[700,1400],b:{s:[[0,.035],[15110,.044],[51950,.053],[332720,.0765]],m:[[0,.035],[20150,.044],[69260,.053],[443630,.0765]]}},
  WY:{n:"Wyoming",none:1},
  DC:{n:"Washington DC",sd:[16100,32200],b:{s:[[0,.04],[10000,.06],[40000,.065],[60000,.085],[250000,.0925],[500000,.0975],[1000000,.1075]],m:[[0,.04],[10000,.06],[40000,.065],[60000,.085],[250000,.0925],[500000,.0975],[1000000,.1075]]}}
};

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

/* ---------- state retirement rules, tax year 2026 ----------
   The bracket tables in STATES above describe how a state taxes a dollar of
   ordinary income. They say nothing about the three things that actually
   decide a retiree's state bill: whether Social Security is in the base,
   whether pension and traditional-account withdrawals are excluded from it,
   and what extra deduction, exemption or credit arrives at 65. That is what
   this table adds. Rules are stated as of 1 January 2026 and reflect the
   phase-ins that complete for this tax year.

   Every key is optional. Amounts are [single, married filing jointly].

     penFull   all pension and annuity income is exempt
     tradFull  all traditional 401(k)/IRA withdrawals are exempt
     pubFull   government / public-employer pensions are exempt
     exAmt     retirement-income exclusion ceiling
     exPer     1 = exAmt applies per person rather than per return
     exAge     1 = the exclusion requires a person marked 65 or older
     exSrc     what the exclusion may be applied against, in order:
                 "tp"  traditional, then pension            (default)
                 "t"   traditional only
                 "p"   pension only
                 "pub" public pension only
                 "all" traditional, pension, other income, then gain
     exLessSS  "gross" or "taxable" -- the exclusion is reduced dollar for
               dollar by Social Security received on that basis
     exCap     AGI above which the exclusion is lost
     exPhase   "cliff" (default), "lin" over exRange, or "nj"
     exRange   dollars over which a linear phase-out runs
     sdAge     extra deduction per person 65 or older
     peAge     extra personal exemption per person 65 or older
     credAge   credit per person 65 or older
     agePh     {amt, cap, rate} deduction per senior with a dollar-for-dollar
               (or rate-scaled) phase-out above cap
     ssFullAge 1 = benefits are fully exempt once a person is 65 or older
     ssCap     AGI below which Social Security is fully exempt
     ssRange   dollars over which that exemption phases out
     ssPct     share of federally taxable benefits still taxed above the cap
     ssCredit  {rate, cap, phase} credit offsetting the tax on benefits
     cgPct     share of long-term gain excluded from the state base
     cgFlat    flat long-term gain exclusion
     cgMax     maximum rate on long-term gain (alternative-tax computation)
     cgB       separate bracket table applied to long-term gain
     ohRet     Ohio's retirement income credit table
     note      one line shown under the per-source table

   What is deliberately not modeled: narrow occupational carve-outs (military,
   police, fire, railroad, federal Civil Service), rules that turn on a birth
   year rather than an age, per-spouse ownership of the excluded income, and
   local income taxes. */
export const RET_STATE = {
  AL:{penFull:1, exAmt:[6000,6000], exPer:1, exAge:1, exSrc:"t",
      note:"Alabama exempts defined-benefit pension income in full, public or private, and exempts the first $6,000 of 401(k) and IRA withdrawals per person aged 65 or over."},
  AZ:{exAmt:[2500,2500], exPer:1, exSrc:"pub",
      note:"Arizona exempts $2,500 per person of federal, state and local government pension income. Private pensions and retirement-account withdrawals are fully taxable at the flat 2.5% rate."},
  AR:{exAmt:[6000,6000], exPer:1, exSrc:"tp", cgPct:.50,
      note:"Arkansas exempts $6,000 per person of pension and retirement-account income, and excludes 50% of net long-term capital gain from the state base."},
  CA:{credAge:[153,153],
      note:"California taxes pension and retirement-account withdrawals in full at ordinary rates, with no retirement exclusion. Social Security is exempt, and there is an extra exemption credit at 65."},
  CO:{exAmt:[24000,24000], exPer:1, exAge:1, exSrc:"tp", exLessSS:"taxable", ssFullAge:1,
      note:"Colorado gives each person 65 or older a subtraction of up to $24,000 of pension and annuity income. Taxable Social Security comes out of that ceiling first, which in practice exempts benefits in full and leaves whatever is left for the rest."},
  CT:{exAmt:[1e12,1e12], exSrc:"tp", exCap:[75000,100000], exPhase:"lin", exRange:25000,
      ssCap:[75000,100000], ssPct:.25,
      note:"Connecticut exempts pension, annuity and IRA income in full below $75,000 of AGI single or $100,000 joint, phasing the exemption out over the next $25,000. Social Security is exempt below the same thresholds; above them a quarter of the federally taxable benefit stays in the base."},
  DE:{exAmt:[12500,12500], exPer:1, exAge:1, exSrc:"tp", sdAge:[2500,2500], credAge:[110,110],
      note:"Delaware excludes $12,500 per person of pension and retirement-account income from age 60, and adds a $2,500 standard deduction and a $110 credit at 65."},
  GA:{exAmt:[65000,65000], exPer:1, exAge:1, exSrc:"all",
      note:"Georgia's retirement income exclusion is $65,000 per person at 65 and over -- $35,000 from 62 -- and it covers pensions, retirement-account withdrawals, interest, dividends, capital gain and rent alike."},
  HI:{penFull:1, peAge:1144, cgMax:.0725,
      note:"Hawaii exempts employer-funded pension income in full, public or private, but taxes the part of a 401(k) or IRA that came from your own contributions. Long-term gain is capped at 7.25%."},
  ID:{note:"Idaho taxes pension and retirement-account income at ordinary rates. Its retirement benefits deduction is limited to specific federal, military and public-safety retirees and is not modeled here."},
  IL:{penFull:1, tradFull:1,
      note:"Illinois excludes qualified retirement income from its base entirely -- pensions, annuities, 401(k) and IRA withdrawals and Social Security alike. Only the taxable gain on a brokerage withdrawal and other ordinary income are actually subject to the 4.95% rate."},
  IN:{peAge:1000,
      note:"Indiana taxes pension and retirement-account income at the flat rate, with an extra $1,000 exemption per person at 65."},
  IA:{exAmt:[1e12,1e12], exAge:1, exSrc:"tp",
      note:"Iowa has exempted all retirement income -- pensions, annuities, 401(k) and IRA withdrawals -- for taxpayers 55 and over since 2023."},
  KS:{pubFull:1, sdAge:[2320,2320],
      note:"Kansas exempts federal, state and local government pensions in full, taxes private pensions and retirement-account withdrawals, and adds a $2,320 standard deduction per person at 65."},
  KY:{exAmt:[31110,31110], exPer:1, exSrc:"tp",
      note:"Kentucky excludes $31,110 per person of pension and retirement-account income, at any age."},
  LA:{pubFull:1, exAmt:[12000,12000], exPer:1, exAge:1, exSrc:"tp",
      note:"Louisiana exempts federal and state government pensions in full, and exempts $12,000 per person of other retirement income at 65 and over."},
  ME:{exAmt:[35000,35000], exPer:1, exSrc:"tp", exLessSS:"gross", sdAge:[2050,1650],
      note:"Maine's pension income deduction is up to $35,000 per person and covers retirement-account withdrawals, but it is reduced dollar for dollar by the Social Security you receive -- a large benefit can consume it outright."},
  MD:{exAmt:[39500,39500], exPer:1, exAge:1, exSrc:"p", exLessSS:"gross", peAge:1000,
      note:"Maryland's $39,500 pension exclusion at 65 covers employer plans but not IRAs, and is reduced by the Social Security you receive. Maryland's county income taxes -- roughly 2.25% to 3.2% on top of the state rate -- are not included here."},
  MA:{pubFull:1, peAge:700,
      note:"Massachusetts exempts Massachusetts and federal government pensions in full, taxes private pensions and retirement-account withdrawals at 5%, and adds a $700 exemption per person at 65."},
  MI:{exAmt:[68000,136000], exSrc:"tp",
      note:"Michigan's retirement and pension deduction is fully restored for tax year 2026, the last step of the 2023 phase-in: roughly $68,000 single and $136,000 joint of pension and retirement-account income comes out of the base."},
  MN:{ssCap:[85000,109000], ssRange:30000,
      note:"Minnesota exempts Social Security in full below about $85,000 of AGI single or $109,000 joint and phases the subtraction out above that. Pension and retirement-account income is taxed at ordinary rates."},
  MS:{penFull:1, tradFull:1,
      note:"Mississippi exempts all qualified retirement income -- pensions, annuities, 401(k) and IRA withdrawals -- once you have reached the plan's retirement age."},
  MO:{exAmt:[47000,47000], exPer:1, exSrc:"pub", exCap:[85000,100000],
      exPhase:"lin", exRange:47000,
      note:"Missouri exempts up to about $47,000 per person of public pension income, withdrawn dollar for dollar above $85,000 of AGI single or $100,000 joint. Its separate $6,000 private pension exemption cuts off at $25,000 / $32,000 and is not modeled."},
  MT:{sdAge:[5800,5800], cgB:{s:[[0,.03],[20500,.041]], m:[[0,.03],[41000,.041]]},
      note:"Montana is one of the states that still taxes Social Security, on the federal taxable amount. It gives an extra $5,800 subtraction per person at 65 and taxes long-term gain at reduced rates of 3.0% and 4.1%."},
  NE:{note:"Nebraska finished exempting Social Security in 2024. Pension and retirement-account income is taxed at ordinary rates."},
  NJ:{exAmt:[75000,100000], exAge:1, exSrc:"tp", exCap:[150000,150000], exPhase:"nj", peAge:1000,
      note:"New Jersey's pension and retirement income exclusion is $75,000 single or $100,000 joint from age 62, but it is a hard income test: full below $150,000 of gross income, half to $175,000, a quarter to $200,000, and nothing above."},
  NM:{ssCap:[100000,150000], exAmt:[8000,8000], exPer:1, exAge:1, exSrc:"all",
      exCap:[28500,51000], cgPct:.40,
      note:"New Mexico exempts Social Security below $100,000 of AGI single or $150,000 joint and taxes it above. It excludes 40% of net capital gain, and gives an $8,000 exemption at 65 that only survives at quite low incomes."},
  NY:{pubFull:1, exAmt:[20000,20000], exPer:1, exSrc:"tp",
      note:"New York exempts New York and federal government pensions in full, and excludes $20,000 per person of private pension and retirement-account income from age 59 and a half. New York City and Yonkers resident taxes are not included here."},
  NC:{note:"North Carolina taxes pension and retirement-account income at its flat rate. The Bailey exemption for certain long-vested government retirees is too narrow to model."},
  ND:{cgPct:.40,
      note:"North Dakota taxes pension and retirement-account income at ordinary rates, but excludes 40% of net long-term capital gain."},
  OH:{credAge:[50,50], ohRet:1, exCap:[100000,100000],
      note:"Ohio taxes pension and retirement-account income at ordinary rates, offset only by a small retirement income credit of up to $200 and a $50 senior credit, both lost above $100,000 of Ohio income."},
  OK:{exAmt:[10000,10000], exPer:1, exSrc:"tp",
      note:"Oklahoma excludes $10,000 per person of pension and retirement-account income."},
  OR:{sdAge:[1200,1000],
      note:"Oregon taxes pension and retirement-account income at ordinary rates. Its retirement income credit applies only at low household incomes and is not modeled, nor are Portland-area local taxes."},
  PA:{penFull:1, tradFull:1,
      note:"Pennsylvania does not tax retirement income at all once you have retired -- pensions, annuities, 401(k) and IRA distributions are all outside the base. Interest, dividends and capital gain are still taxed at 3.07%."},
  RI:{ssCap:[108000,135000], exAmt:[20000,20000], exPer:1, exAge:1, exSrc:"tp",
      exCap:[108000,135000],
      note:"Rhode Island exempts Social Security and up to $20,000 per person of pension and retirement-account income, but both require full retirement age and both cut off above roughly $108,000 of AGI single or $135,000 joint."},
  SC:{sdAge:[15000,15000], cgPct:.44,
      note:"South Carolina's age-65 deduction is $15,000 per person against any income, which absorbs its separate $10,000 retirement deduction. It also excludes 44% of net long-term capital gain."},
  UT:{ssCredit:{rate:.045, cap:[54000,90000], phase:.025},
      note:"Utah taxes Social Security but then hands back a credit for the tax on it, withdrawn at 2.5 cents per dollar of income above $54,000 single or $90,000 joint. Pension and retirement-account income is taxed at the flat 4.5% rate."},
  VT:{ssCap:[50000,65000], ssRange:10000, cgFlat:[5000,5000],
      note:"Vermont exempts Social Security below $50,000 of AGI single or $65,000 joint, phasing out over the next $10,000. It excludes $5,000 of long-term gain and otherwise taxes retirement income at ordinary rates."},
  VA:{agePh:{amt:12000, cap:[50000,75000], rate:1},
      note:"Virginia's age deduction is $12,000 per person at 65, but it is withdrawn dollar for dollar above $50,000 of income single or $75,000 joint, so it disappears entirely by $62,000 / $87,000."},
  WV:{sdAge:[8000,8000],
      note:"West Virginia completed its Social Security phase-out this year. It gives an $8,000 exemption per person at 65, applied against any income."},
  WI:{exAmt:[24000,24000], exPer:1, exAge:1, exSrc:"tp", cgPct:.30,
      note:"Wisconsin's 2025 retirement income exclusion is $24,000 per person from age 67, covering pensions and retirement-account withdrawals. It also excludes 30% of net long-term capital gain."},
  DC:{note:"The District taxes pension and retirement-account income at ordinary rates. Its $3,000 government-pension exclusion at 62 is too narrow to model."}
};

/* Public pensions are exempt in some states and not others, so the tool has to
   be told which kind the pension is. Everything else about a pension --
   ordinary rates, no FICA -- is the same either way. */

/**
 * State-level retirement tax. Returns the tax, the base it was computed on,
 * and the taxable amount each source contributed, so the per-source table can
 * split the bill without guessing.
 *
 * @param {Object} S - the STATES entry
 * @param {Object} c - context: status, idx, seniors, trad, pension, penPublic,
 *                     other, gain, taxableSS, ssGross, agi, pre, dedType, item
 * @returns {{tax:number, base:number, taxable:number, parts:Object, ssIn:number,
 *            excluded:number, notes:string}}
 */
export function stateRetireTax(S, c){
  const R = RET_STATE[c.code] || {};
  const st = c.status, idx = c.idx;
  const zero = {tax:0, base:0, taxable:0, ssIn:0, excluded:0, ded:0, credit:0,
                parts:{trad:0, pension:0, other:0, gain:0, ss:0},
                note:R.note || "", ssTaxed:false};
  if (S.none || !S.b) return zero;

  // --- 1. Social Security ---------------------------------------------------
  // Default is full exemption: 42 states and DC leave benefits out entirely.
  let ssIn = 0, ssTaxed = false;
  if (SS_TAX_STATES[c.code]){
    ssTaxed = true;
    ssIn = c.taxableSS;
    if (R.ssFullAge && c.seniors > 0) ssIn = 0;
    else if (R.ssCap){
      const cap = R.ssCap[idx], range = R.ssRange || 0;
      if (c.agi <= cap) ssIn = 0;
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
    // Missouri's public-pension exemption is the one with an income test.
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
        // New Jersey steps the exclusion down rather than phasing it linearly.
        const g = c.grossForTest;
        room *= g <= cap ? 1 : g <= cap + 25000 ? .5 : g <= cap + 50000 ? .25 : 0;
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

/**
 * @param {Object} inp
 * @param {"s"|"m"} inp.status - filing status: single or married
 * @param {number} inp.gross - gross income, in dollars. The sole earner's income for a
 *   single filer, or earner 1's own income on a joint return with inp.gross2 given.
 * @param {number} [inp.gross2] - spouse's own gross income, in dollars (joint returns
 *   only). Summed with inp.gross for tax purposes, but kept separate for FICA: the
 *   Social Security wage-base cap applies per earner, so running the household total
 *   through the cap once (the pre-split behavior) understates a two-earner couple's tax.
 * @param {number} inp.pre - pre-tax deductions (e.g. 401k), in dollars
 * @param {"std"|"item"} inp.dedType - standard vs. itemized deduction
 * @param {number} inp.item - itemized deduction total, in dollars (used only if dedType is "item")
 * @param {string} inp.state - two-letter state code, a key into STATES
 * @returns {Object} federal/state/FICA breakdown, net income, and effective/marginal rates
 */
export function computeTax(inp){
  const st = inp.status, idx = st === "m" ? 1 : 0;
  const earner1 = Math.max(0, inp.gross);
  const earner2 = Math.max(0, inp.gross2 || 0);
  const gross = earner1 + earner2;
  const pre = Math.min(Math.max(0, inp.pre), gross);
  const afterPre = gross - pre;

  // federal
  const fedDed = inp.dedType === "item" ? Math.max(0, inp.item) : FED_STD[st];
  const fedTaxable = Math.max(0, afterPre - fedDed);
  const fedCalc = bracketTax(fedTaxable, FED_2026[st]);
  const federal = fedCalc.tax;

  // state
  const S = STATES[inp.state] || {none:1};
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
    stateTaxable = Math.max(0, afterPre - ded);
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
  const ss1 = Math.min(earner1, FICA.ssCap) * FICA.ssRate;
  const ss2 = Math.min(earner2, FICA.ssCap) * FICA.ssRate;
  const ss = ss1 + ss2;
  const med = gross * FICA.medRate;
  const addl = Math.max(0, gross - FICA.addlThreshold[st]) * FICA.addlRate;
  const fica = ss + med + addl;

  const total = federal + state + fica;
  const net = gross - total - pre;
  const rate = v => gross > 0 ? v / gross : 0;
  return {gross, earner1, earner2, pre, afterPre, fedDed, fedTaxable, federal, state, stateTaxable,
          fica, ss, ss1, ss2, med, addl, total, net, takeHome: net,
          effFed:rate(federal), effState:rate(state), effFica:rate(fica),
          effTotal:rate(total), effNet:rate(net),
          marginal: marginalRate(fedTaxable, FED_2026[st]),
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
 * @param {string} inp.state - two-letter state code, a key into STATES
 * @param {number} inp.pre - above-the-line deductions, in dollars
 * @param {"std"|"item"} inp.dedType - standard vs. itemized deduction
 * @param {number} inp.item - itemized total, in dollars
 * @param {number} inp.seniors - people age 65+ on the return, 0-2
 * @param {boolean} [inp._noMarginal] - internal, stops the marginal-rate probe recursing
 * @returns {Object} the same shape computeTax returns, plus retirement detail
 */
export function computeRetireTax(inp){
  const st = inp.status, idx = st === "m" ? 1 : 0;
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
  let ded = inp.dedType === "item" ? Math.max(0, inp.item) : FED_STD[st];
  const ageAddl = inp.dedType === "item" ? 0 : SENIOR_ADDL[st] * seniors;
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

  const fedCalc = bracketTax(ordTaxable, FED_2026[st]);
  const fedOrdinary = fedCalc.tax;

  const c0 = LTCG_2026[st][0], c15 = LTCG_2026[st][1];
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
  // lives in stateRetireTax() and RET_STATE, so this only has to hand it a
  // context and take back the answer.
  const S = STATES[inp.state] || {none:1};
  const ST = stateRetireTax(S, {
    code:inp.state, status:st, idx, seniors,
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
  let effMarginal = marginalRate(ordTaxable, FED_2026[st]);
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
    nominalMarginal:marginalRate(ordTaxable, FED_2026[st]),
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

/* IRS Uniform Lifetime Table, Treas. Reg. sec. 1.401(a)(9)-9 (Pub. 590-B
   Table III). These divisors took effect for distribution years from 2022 and
   are unchanged for 2026. */
export const ULT = {72:27.4, 73:26.5, 74:25.5, 75:24.6, 76:23.7, 77:22.9, 78:22.0,
  79:21.1, 80:20.2, 81:19.4, 82:18.5, 83:17.7, 84:16.8, 85:16.0, 86:15.2,
  87:14.4, 88:13.7, 89:12.9, 90:12.2, 91:11.5, 92:10.8, 93:10.1, 94:9.5,
  95:8.9, 96:8.4, 97:7.8, 98:7.3, 99:6.8, 100:6.4};
export function ultDivisor(age){
  if (age < 72) return 0;
  if (age >= 100) return 6.4;
  return ULT[age] || 0;
}
/* SECURE 2.0: age 73 for those born 1951-1959, age 75 for 1960 and later. */
export function rmdStartAge(currentAge){
  return (2026 - currentAge) >= 1960 ? 75 : 73;
}

/* 2026 Medicare IRMAA. Standard Part B is $202.90/month; higher brackets pay a
   multiple of it, plus a flat Part D surcharge. Source: CMS 2026 Parts A & B
   premiums fact sheet. The brackets are cliffs, not phase-ins -- one dollar
   over a line costs the whole tier -- and they run on a two-year lookback, so
   a conversion today sets the premium two years out. */
export const IRMAA = {
  partB: 202.90,
  // b is the total monthly Part B premium CMS publishes for the tier (the
  // multiple of the standard premium, rounded as CMS rounds it)
  tiers: [
    {s:109000,   m:218000,   mult:1.0, b:202.90, partD:0},
    {s:137000,   m:274000,   mult:1.4, b:284.10, partD:14.50},
    {s:171000,   m:342000,   mult:2.0, b:405.80, partD:37.50},
    {s:205000,   m:410000,   mult:2.6, b:527.50, partD:60.40},
    {s:499999.99, m:749999.99, mult:3.2, b:649.20, partD:83.30},
    {s:Infinity, m:Infinity, mult:3.4, b:689.90, partD:91.00}
  ]
};
export function irmaaTier(magi, status){
  const key = status === "m" ? "m" : "s";
  for (let i = 0; i < IRMAA.tiers.length; i++)
    if (magi <= IRMAA.tiers[i][key]) return i;
  return IRMAA.tiers.length - 1;
}
/**
 * @param {number} magi - modified AGI from two years earlier, in dollars
 * @param {"s"|"m"} status - filing status in the premium year
 * @param {number} people - how many on the return are enrolled in Medicare
 * @returns {number} the annual surcharge above standard premiums, in dollars
 */
export function irmaaAnnual(magi, status, people){
  if (people <= 0) return 0;
  const t = IRMAA.tiers[irmaaTier(magi, status)];
  return (t.b - IRMAA.partB + t.partD) * 12 * people;
}
/* Top of a federal bracket = where the next one starts. */
/* How much more ordinary taxable income fits before crossing into the next
   federal bracket -- the room a Roth conversion or extra withdrawal has to
   work with before the marginal rate jumps. Null once already in the top
   bracket, since there's no next threshold to report. */
export function bracketRoom(taxable, status){
  const b = FED_2026[status];
  let i = 0;
  for (let k = 0; k < b.length; k++) if (taxable > b[k][0]) i = k;
  if (i + 1 >= b.length) return null;
  return {room:b[i + 1][0] - taxable, nextRate:b[i + 1][1]};
}
export function bracketTopFor(status, rate){
  const b = FED_2026[status];
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
          const lim = IRMAA.tiers[Math.min(inp.irmaaTarget,
            IRMAA.tiers.length - 1)][key];
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

export var HIST_START = 1926;
/* Monthly total returns, January 1926 through December 2025 (1,200 months).
   Stocks: S&P 500 monthly price with that month's dividend reinvested.
   Bonds: 10-year Treasury, one month of coupon plus the price move implied
   by the change in yield. Inflation: CPI-U, month over month.
   Sources: Robert Shiller (Yale) via multpl for prices, yields and dividend
   yields; US BLS for CPI-U. Prices are monthly averages of daily closes,
   Shiller's convention — see the About tab. */
export var HIST_M_STOCK = [
  1.9310,0.5629,-6.3783,-2.3495,1.1592,5.2231,4.6604,4.3977,1.9483,-1.8303,1.7421,2.7100,
  -0.2367,2.3778,1.9706,2.8816,3.8724,1.7061,2.6285,5.7292,6.0670,-1.1623,2.6592,2.7208,
  0.7716,-0.8258,5.7497,6.6655,3.4381,-4.5624,1.0937,3.5938,7.3769,2.3602,7.0849,0.6973,
  7.6962,0.8144,2.0541,-0.2983,1.8001,2.2051,9.2033,5.9603,4.2467,-10.3225,-26.1882,4.3770,
  1.8265,6.6372,4.1222,6.6878,-5.6512,-9.7693,-1.7600,-0.8954,0.3434,-13.3709,-6.7992,-6.1872,
  3.5497,8.1315,2.3738,-9.0862,-9.1673,-2.6866,3.8495,-2.4931,-14.3765,-12.7595,2.0433,-18.1101,
  -0.8753,-0.0733,1.1139,-23.2512,-11.3501,-12.4317,6.1378,51.3089,10.3363,-13.2433,-0.3668,-2.6715,
  4.5636,-11.2717,0.3263,11.2363,29.3123,17.5776,8.4576,-4.6454,-0.4882,-9.3811,2.7967,2.3174,
  6.0854,7.7494,-4.7979,2.0200,-9.8257,1.7035,-4.3544,-3.5139,-2.0077,1.2091,3.2113,1.0598,
  0.4050,-2.6189,-5.9299,7.9336,8.2629,4.1711,5.5993,7.1049,2.4333,2.9935,9.7178,0.3000,
  5.8284,6.0382,2.4165,0.4241,-5.0101,4.5833,6.2455,2.3085,1.4545,5.5695,3.1202,-1.3825,
  3.4633,3.3071,0.2350,-5.6105,-4.0715,-3.3231,6.3816,1.4250,-13.7743,-14.0920,-8.2590,-1.0119,
  3.2311,-1.8073,-6.0232,-3.4542,1.5449,2.9227,20.4649,1.0396,-4.1021,11.5815,0.4335,-2.5822,
  -1.1599,-0.4553,0.2691,-12.2390,4.0987,2.1745,2.8433,-1.0600,11.0634,1.3968,-1.3950,-1.9602,
  -0.1458,-0.2257,-0.1428,1.4244,-13.3365,-8.0893,3.8748,2.6552,4.7628,1.4656,2.8501,-3.5901,
  0.7226,-5.7216,1.1793,-2.5432,-1.5850,4.1093,5.7151,0.0782,0.8655,-3.4319,-4.0806,-5.8783,
  2.6100,-2.4857,-4.7684,-3.4640,1.8602,5.7374,4.3680,0.0319,1.6490,7.9594,2.1463,1.0474,
  6.5041,6.4338,4.0147,3.7867,4.3632,2.1800,2.4744,-4.5368,2.5550,-0.4980,-4.2044,1.7723,
  3.6686,-0.2414,3.2424,-1.3064,2.2055,5.1444,3.0210,-1.0534,-1.2230,2.8838,-0.2842,2.6005,
  3.3864,3.7354,0.3172,2.9013,4.1612,2.1876,-1.6936,0.7087,7.1817,4.5139,3.6058,2.0248,
  4.3021,0.5892,-2.6747,6.7690,0.5183,-0.3387,-2.5457,-1.6220,-14.4211,-1.8687,-0.0092,3.3978,
  0.9217,4.2720,-3.6708,-3.2911,-1.3544,3.9283,6.6990,-1.5532,-2.1611,3.0359,-0.7211,-1.1132,
  -0.8628,-4.4471,1.9205,8.1877,5.3298,4.5869,-1.9535,-2.4848,-0.6744,3.1993,-5.0907,-0.1474,
  1.6382,-3.3187,1.5006,0.4209,-0.1754,-4.9054,6.2678,4.1743,1.8745,3.1593,1.9649,3.2586,
  2.6348,2.5276,1.3797,3.3906,3.9188,2.1689,-6.7046,6.6582,4.1282,4.7419,0.3958,0.2141,
  8.0198,4.3150,-1.1058,1.9319,0.6334,-1.1399,2.3612,4.9603,3.1306,0.0154,-2.2665,3.5995,
  3.8348,-1.3313,0.7506,0.2062,0.4635,3.2486,3.3667,0.8806,-1.1088,-1.6155,3.6632,4.5042,
  0.9892,-0.7737,0.9575,-4.4718,1.0036,-3.1065,1.9140,0.8987,-4.1071,3.5206,2.7119,1.8402,
  3.0260,2.6782,2.5843,4.4487,4.4205,1.2214,4.4588,2.3959,2.7413,2.7168,4.3086,4.9588,
  2.1697,3.7061,-0.4352,3.8090,-0.0777,6.1461,7.6479,-0.2960,4.8194,-4.7238,7.0671,1.2380,
  -2.3825,0.9554,7.2115,1.4869,-2.8342,-0.2579,5.7515,-0.2822,-3.0864,-0.9593,-0.7181,1.8032,
  -1.8634,-3.9962,1.6200,2.6440,4.1604,1.9543,2.3241,-5.2032,-3.7378,-5.8949,-1.7985,0.3203,
  2.3276,0.7009,2.4173,0.8939,3.5553,2.7330,3.0705,4.0546,2.9434,4.3603,3.3273,2.1634,
  4.2559,-1.2640,2.8070,1.9373,1.7667,-0.6049,4.2288,-0.3172,-3.7025,0.1780,0.6704,3.4642,
  -1.4803,-3.6042,-1.0723,1.5850,-0.6237,3.9890,-2.1963,1.4908,-2.7206,-1.6739,3.5412,2.6904,
  5.4265,4.3740,3.3970,2.9193,1.2636,-1.0799,-0.0275,3.8397,-0.5412,1.3454,4.7742,1.1657,
  -3.4867,1.9107,0.3416,-2.9440,-7.1842,-11.4121,2.7186,3.0238,-0.5921,-2.8541,7.2033,4.6260,
  4.1472,1.5963,-0.1078,4.9802,2.2713,0.2188,-1.2215,3.0316,2.8937,0.5027,-0.3037,2.3957,
  3.3317,1.4818,2.0731,1.6952,1.2223,-0.3486,3.9628,-1.2238,1.9679,1.9723,0.9387,-1.4882,
  2.8222,0.9767,0.3374,1.5594,1.7344,-4.5054,0.1042,2.1205,3.5981,2.4985,1.0778,-0.2094,
  1.9826,-0.4284,-3.8604,3.3223,-5.0062,-0.5578,0.0203,-5.7674,-3.2231,-0.5650,5.3152,0.7152,
  4.1313,3.7312,2.6344,1.9926,2.0575,-0.9920,1.9934,1.8520,1.6547,0.0972,-2.8818,3.1114,
  -0.0169,-4.2561,-1.5584,7.6632,2.5587,2.9422,0.0497,-1.9332,3.5087,2.7181,1.7868,1.2861,
  -3.9843,-0.2381,-1.9131,2.2751,3.5141,-4.9703,-4.2049,-0.2828,0.6289,1.3466,0.9977,-5.0271,
  -0.5890,-3.1960,2.0129,-2.7476,-11.1984,-0.2693,0.5226,3.2562,6.3214,2.4877,0.2055,7.1570,
  4.1099,4.1499,2.8308,3.6739,-1.1085,-1.5960,-0.4631,-1.5175,2.4862,-1.8642,-4.3718,7.1634,
  4.4224,2.0871,2.6196,1.2588,-0.7759,0.5159,-0.5033,3.7838,-1.2098,0.4191,5.2563,2.3131,
  0.9902,-3.3247,-1.3449,-1.6320,-2.5684,-1.9887,1.2116,-1.6345,1.9969,4.2381,-6.8499,-6.8020,
  1.7024,-2.4711,4.5764,-4.8151,-2.7039,0.4593,-11.3441,-3.7618,-10.0103,2.3769,3.7435,-6.0912,
  8.6353,10.8100,4.9760,1.4886,6.7137,2.8963,0.4319,-6.9961,-0.8528,4.9705,2.0410,-1.1805,
  9.5453,4.1780,0.8027,1.0970,-0.3816,0.9022,2.6680,-0.5581,2.4404,-3.1032,-0.3609,3.7922,
  -0.5333,-2.3650,-0.0499,-1.1888,0.0695,0.9045,1.2865,-2.0744,-1.1711,-2.1930,0.9859,-0.0749,
  -3.3867,-0.9676,0.2694,4.8337,5.5074,0.6769,-0.0591,7.3316,0.4025,-2.7719,-5.4359,1.9247,
  4.1892,-1.0533,2.3444,2.4349,-1.8890,2.4215,1.4251,5.0191,1.5445,-3.3487,-0.3190,4.4076,
  3.3163,4.3999,-8.7742,-1.1580,5.0397,6.8660,4.9722,3.5077,2.8389,3.3272,4.6168,-1.2433,
  0.0123,-3.0677,4.1455,1.2961,-1.6153,0.8599,-2.0138,0.8056,-8.3000,1.7296,3.0459,1.1822,
  -4.8019,-1.9120,-2.7428,5.4712,0.5714,-5.2683,0.2451,0.7948,12.0977,8.8821,4.5003,1.3560,
  3.9265,2.1310,3.8665,4.1981,4.4243,1.7540,0.7093,-2.4060,3.3152,0.6493,-1.1402,-0.1268,
  1.5776,-5.1103,0.4438,0.5092,-0.2503,-1.8464,-0.9074,9.2074,1.4079,-0.4098,1.2886,-0.7048,
  4.6995,5.7894,-0.4763,1.0263,2.7367,2.5124,2.2489,-1.8435,-1.8834,1.4964,6.4214,5.2953,
  0.7530,5.6991,6.1841,2.7423,0.4932,3.1340,-1.8025,2.2822,-2.4551,-0.0896,3.5334,1.7095,
  6.6742,6.4623,4.3769,-0.8550,0.1749,4.5005,3.1232,6.4548,-3.0290,-11.8525,-12.3016,-1.3326,
  4.2485,3.3302,3.2337,-0.8834,-2.1851,6.0013,-0.3044,-1.7160,1.9296,3.8042,-2.0173,2.3297,
  3.5156,3.3035,-0.1584,3.5681,4.1202,3.3970,2.8032,4.6953,0.4600,0.2889,-1.8098,2.7398,
  -2.2091,-2.5248,2.7090,0.1987,3.8539,3.1729,0.1715,-7.8601,-4.3399,-2.3135,2.9861,4.5888,
  -0.6847,11.6066,3.0443,2.2589,-0.1788,0.3471,0.7817,2.6797,-0.3023,0.1813,0.0154,0.9345,
  7.3587,-0.5998,-1.0111,0.2640,2.0683,-1.3289,1.9123,0.9423,0.3786,-1.1826,2.7570,3.2710,
  0.1432,1.7251,2.1506,-1.3415,0.7251,0.8651,0.0611,1.7627,1.3553,1.2420,0.0076,0.8876,
  1.7368,-0.0746,-1.4231,-3.3457,1.0592,1.1086,-0.5184,3.0827,0.8181,-0.4428,-0.3685,-1.0247,
  2.4511,3.8187,2.5579,3.2170,3.3488,3.1795,3.5486,0.5145,3.7190,0.9134,2.3591,3.3898,
  0.1639,5.9062,-0.1993,0.1980,2.3556,1.2798,-3.4746,3.0772,2.0252,4.1204,5.0526,1.1987,
  3.2580,4.3618,-0.6232,-3.4046,9.2186,5.3372,5.7361,0.3485,1.1929,1.6461,-1.1519,2.6351,
  0.2372,6.4023,5.3130,3.4069,-0.2211,0.1173,4.4677,-6.9703,-4.8981,1.2914,10.9741,4.1041,
  5.0479,-0.0664,2.9238,4.2498,-0.0992,-0.6121,4.5232,-3.7739,-0.5978,-1.2725,7.1062,2.8090,
  -0.1190,-2.4775,3.9409,1.4249,-2.8388,3.1632,0.8500,0.9392,-1.0806,-5.2147,-0.7729,-3.3204,
  0.4543,-2.1369,-9.0803,0.4477,6.8785,-2.3890,-2.6604,-2.0461,-11.2470,3.1839,5.0529,1.4656,
  -0.2977,-3.3527,4.9450,-3.5140,-2.8193,-5.9203,-10.7589,1.1380,-4.7585,-1.3661,6.6268,-1.0340,
  -0.2220,-6.4145,1.3087,5.2856,5.3121,5.7043,0.5968,-0.1653,3.1626,2.0298,1.2126,3.0660,
  4.9362,1.0884,-1.5639,0.9698,-2.5628,2.8590,-2.2373,-1.3864,2.7837,0.1030,4.7750,2.7280,
  -1.3472,1.6827,-0.2540,-2.4071,1.3378,2.1823,1.8093,0.3113,0.2808,-2.6227,3.9637,2.1458,
  1.4678,-0.0154,1.4873,0.8001,-0.7852,-2.7044,0.7217,2.2928,2.5327,3.6178,2.0030,2.1501,
  0.6939,1.5972,-2.4729,4.1819,3.3933,0.3463,0.5762,-4.1993,3.0761,2.9931,-4.8048,1.2393,
  -6.6337,-1.5632,-2.6254,4.2451,2.5638,-4.2458,-6.0780,2.1110,-4.8473,-20.1948,-8.6068,-0.3531,
  -1.0988,-6.7063,-5.6914,12.3158,6.6546,2.8635,1.2722,8.1155,3.6459,2.3990,2.0900,2.2222,
  1.3557,-2.8994,5.9417,4.0880,-5.8825,-3.5436,-0.1583,0.8647,3.3718,4.5785,2.4922,3.7145,
  3.4637,3.1527,-1.1107,2.2227,0.6615,-3.6608,3.1037,-10.3989,-0.7869,3.0218,1.7699,1.5579,
  4.7850,4.1646,2.8858,-0.0359,-3.0888,-1.1504,2.9234,3.3904,3.0237,-0.2136,-2.8344,2.1791,
  4.2704,2.3343,2.7240,1.4560,4.5767,-1.1154,3.2567,0.2546,1.1944,2.1184,3.8609,1.5230,
  0.9695,-0.1282,2.7238,0.2031,1.5339,3.1980,1.4971,-0.4257,1.7795,-2.6455,5.7067,0.6352,
  -1.1080,2.8294,0.0570,0.8794,0.9800,-0.4341,-0.0782,-2.4235,-4.5058,4.3180,2.9336,-1.1020,
  -6.4190,-0.5488,6.3634,2.8318,-0.3038,1.0670,3.2984,1.2004,-0.4377,-0.5053,1.2020,3.9465,
  1.4386,2.5772,1.7501,-0.1528,1.6934,1.7774,0.9892,0.2490,1.6541,2.7353,1.5907,2.8846,
  4.8633,-2.8852,0.0657,-1.6627,1.9631,2.1139,1.5820,2.4525,1.6807,-3.8473,-2.0744,-5.5614,
  1.7372,5.8302,1.9493,3.7239,-1.5308,1.4058,3.8279,-3.1333,3.0865,0.0104,4.4341,2.4701,
  3.3474,0.1228,-18.9163,4.3192,5.8868,6.5083,3.4756,5.8925,-0.6275,1.7257,3.9538,4.2600,
  2.7948,2.4910,0.8207,6.0214,0.7606,1.8110,3.0693,2.1862,-0.0840,0.4533,4.7458,0.2658,
  -2.0510,-2.9013,-0.8916,0.1199,-7.8713,-3.3681,0.4657,6.4482,-7.2762,-3.0898,5.2859,0.0119,
  1.3774,3.1475,-2.5843,3.9967,0.7376,4.9424,3.8767,-1.6878,-0.2569,-3.2728,4.8583,5.1759,
  2.6750,4.4408,3.2824,-1.3377,2.8603,3.5512,2.4709,-0.6246,2.3635,3.0639,2.4822,1.4705,
  -0.4178,1.0947,-5.7688,-5.4202,8.3399,3.8800,4.5275,1.8894,2.8335,2.4034,0.1748,1.7610
];
export var HIST_M_BOND = [
  0.3899,0.5543,0.5522,0.4672,0.5486,0.5465,0.5444,0.5422,0.5401,0.5380,0.4522,0.5345,
  0.5324,0.2783,0.2783,0.2783,0.2783,0.2783,0.2783,0.3622,0.2775,0.2775,0.2775,0.2775,
  0.2775,0.1099,0.0282,0.1145,0.1163,0.1182,0.1200,0.0387,0.1246,0.1264,0.0454,0.1310,
  0.1328,0.5486,0.4634,0.5451,0.4597,0.5415,0.5394,0.4537,0.5359,0.4499,0.5324,0.4462,
  0.5288,0.2742,0.1902,0.2750,0.1910,0.2758,0.1919,0.2767,0.2767,0.1928,0.2775,0.1937,
  0.2783,0.0272,0.0301,0.1163,0.0349,0.0378,0.0406,0.0435,0.0464,0.0493,0.1347,0.0540,
  0.0569,0.5543,0.5522,0.5500,0.5479,0.5458,0.6270,0.5408,0.5387,0.5366,0.5345,0.5324,
  0.5302,0.4439,0.3583,0.4417,0.3559,0.4395,0.4380,0.3519,0.4357,0.3496,0.4335,0.3472,
  0.4312,0.5147,0.4275,0.5112,0.5091,0.5070,0.5049,0.4170,0.5014,0.4993,0.4111,0.4958,
  0.4937,0.3188,0.3180,0.3172,0.4029,0.3148,0.3140,0.3132,0.3125,0.3984,0.3101,0.3093,
  0.3085,0.2208,0.2208,0.1340,0.2217,0.2217,0.2217,0.1349,0.2225,0.2225,0.2225,0.1358,
  0.2233,0.3101,0.3093,0.3085,0.3077,0.3069,0.3061,0.3054,0.3046,0.3038,0.3030,0.3022,
  0.3014,0.3880,0.2991,0.3858,0.3843,0.2951,0.3821,0.3806,0.2912,0.3784,0.3769,0.2872,
  0.3746,0.2849,0.2841,0.3717,0.2817,0.2809,0.2801,0.3680,0.2778,0.2770,0.3650,0.2746,
  0.2738,0.3620,0.3606,0.4483,0.3569,0.3554,0.3539,0.3524,0.3509,0.3495,0.4380,0.3458,
  0.3443,-0.1970,-0.2824,-0.1878,-0.1837,-0.1796,-0.1756,-0.2600,-0.1664,-0.1623,-0.2462,-0.1532,
  -0.1491,0.2050,0.2050,0.2050,0.2050,0.2050,0.2050,0.1173,0.2058,0.2058,0.2058,0.2058,
  0.2058,0.2058,0.2058,0.2058,0.2058,0.2058,0.2058,0.1182,0.2067,0.2067,0.2067,0.2067,
  0.2067,0.2943,0.2935,0.2927,0.2920,0.2912,0.2904,0.2017,0.2896,0.2888,0.2880,0.2872,
  0.2864,0.2857,0.3732,0.2833,0.3709,0.2809,0.3687,0.2786,0.3665,0.3650,0.2746,0.3628,
  0.2723,0.1825,0.0936,0.1833,0.0945,0.1842,0.0954,0.1850,0.0962,0.1858,0.0971,0.1867,
  0.0980,0.0104,0.1006,0.0131,0.1033,0.0159,0.0178,0.1077,0.0205,0.1103,0.0233,0.1129,
  0.0261,0.2912,0.2904,0.2896,0.2888,0.2880,0.2872,0.3746,0.2849,0.2841,0.2833,0.2825,
  0.2817,0.1925,0.1925,0.1925,0.1925,0.1925,0.1042,0.1933,0.1933,0.1933,0.1933,0.1933,
  0.1933,0.0168,0.0187,0.0205,0.0224,0.0242,0.0261,-0.0596,0.0307,0.0325,0.0344,0.0362,
  0.0381,0.1270,0.1279,0.1288,0.1296,0.1305,0.2183,0.1314,0.1323,0.1332,0.1340,0.1349,
  0.1358,0.1367,0.1375,0.0519,0.1402,0.1411,0.0556,0.1437,0.1446,0.1454,0.0602,0.1481,
  0.1490,0.4944,0.4923,-0.2854,-1.6360,-0.2548,1.8001,0.0731,0.9328,2.0620,0.0482,1.0074,
  1.1796,0.2943,1.0869,0.9053,-0.5141,0.1094,0.9058,-0.3373,0.0205,-0.2409,-0.2356,-0.0558,
  -0.6611,-0.1299,-0.0393,-0.3815,0.1428,0.0575,-0.7972,-0.3564,0.2475,1.0199,0.1542,-0.3575,
  0.7611,0.7577,-0.7891,-1.6129,1.2000,0.8529,-0.6831,-1.5863,-0.1409,0.6170,-0.9698,-0.5371,
  1.3825,1.2944,-0.3065,-0.2986,-0.7030,-1.3385,-0.7414,0.3275,0.4089,-0.0795,2.3871,4.6141,
  1.2864,0.5978,0.8519,1.1066,-0.1026,-0.1838,-1.6946,-2.5553,-1.5109,-0.0144,0.8097,-0.6685,
  -0.9748,0.8226,0.0866,-0.7156,-1.1742,0.1199,-0.1154,0.1285,-1.5916,1.5752,0.3775,-0.8768,
  0.1560,2.2142,2.2968,0.1142,-0.2013,1.9726,2.3837,1.1442,0.3167,-0.4173,-0.0014,1.0633,
  0.3200,0.8120,0.6437,-0.0164,0.8910,-1.0780,-0.0024,-0.6447,0.8238,0.8203,0.1640,-0.6421,
  0.1768,0.6638,1.2320,1.0633,0.0751,-0.0034,-0.4849,0.5777,0.3317,0.7386,0.4089,0.8167,
  0.5671,-0.4137,0.2453,0.0026,0.6564,-0.1594,0.0894,0.4972,-0.3130,0.0980,0.2619,0.2627,
  0.0225,0.5085,-0.2158,0.2715,0.5934,0.5913,0.1868,0.3492,0.2689,0.4303,0.6712,0.1047,
  0.2680,0.1886,0.3508,0.4311,0.2697,0.3508,0.4311,-0.0505,0.0344,-0.1208,-0.4307,-0.9664,
  0.4637,-1.3287,0.0917,1.3438,0.1617,0.1645,-1.2192,-1.1096,0.7412,1.7437,-0.7318,2.9203,
  2.4526,-0.0115,1.0966,-0.0156,-1.6399,-0.9073,-0.6544,-0.4841,0.2878,-0.9164,-1.5543,0.8525,
  1.7546,0.2354,-0.8780,1.2271,-1.2333,1.6080,2.1349,1.0637,0.1496,-0.4461,-0.4309,-1.9504,
  0.4290,-0.5908,-0.2824,1.4742,-0.5733,-1.2647,-0.5198,0.7738,-2.7193,1.0161,0.3125,-2.8818,
  -0.3109,4.4696,1.7935,-1.6184,-2.8876,1.1323,3.2665,0.1418,1.5933,1.0309,4.0780,3.8217,
  1.6241,1.4718,3.5702,-0.4896,-3.5607,-0.4012,-0.9502,1.6351,3.7654,2.0624,1.3854,-0.4020,
  0.3466,-0.4574,0.5800,-0.3695,0.9547,0.6573,0.5092,-0.2196,-1.9210,1.0495,1.9927,-0.0556,
  -0.1902,-0.7472,0.0550,0.8444,-0.7172,0.2180,-1.0308,-1.2676,2.7849,2.7185,0.9926,0.4897,
  -1.1950,0.7936,-1.1590,-1.4575,0.1471,0.9057,-1.1990,-0.8897,0.6700,1.6137,2.1561,2.3615,
  0.1387,1.3839,-1.6936,-2.6763,1.8235,2.0222,-0.6834,-1.5692,0.5025,2.6362,1.2809,1.0063,
  2.4319,0.3063,1.0567,1.8079,-1.6618,0.9284,0.8579,1.0593,1.8780,1.8731,1.4491,3.5752,
  -1.7925,-0.6409,0.1345,1.2431,-0.0047,1.8697,0.2608,0.1281,1.0315,-0.6227,0.2163,-0.1169,
  -1.1742,0.1943,0.6022,-0.0631,-0.6419,-0.0272,-0.4687,2.2352,0.6350,-0.7329,-0.3802,-0.5488,
  0.1758,0.7583,0.6307,0.3780,0.3207,2.9615,0.4852,0.2331,-1.1451,-5.1067,-1.2335,2.4587,
  -1.5691,-8.0462,-0.8293,8.4544,8.8214,3.3296,-2.0422,-4.1308,-1.4388,-0.4109,-4.1324,0.1829,
  2.5606,-2.2914,1.4772,-1.8645,-1.0422,4.5303,-3.0568,-2.1300,-0.6391,2.1250,10.6657,-0.6245,
  -3.2921,2.0366,4.1920,1.1026,2.4794,-2.3708,3.0209,5.9803,5.1005,9.4818,3.0699,0.9392,
  1.3603,-0.6777,2.1559,1.5403,0.9876,-1.9204,-2.1680,-1.7237,2.1339,1.6042,0.1033,0.1776,
  1.9022,0.0056,-1.6903,-0.6806,-3.1115,0.3215,2.1998,4.6253,2.1664,3.0642,4.4065,1.3679,
  1.6539,0.1988,-1.0298,3.4757,4.3898,5.1149,-0.0629,0.7380,0.6189,1.6548,3.7067,4.1143,
  1.2172,3.9524,6.9600,3.9734,-2.1792,0.0331,4.1136,1.5143,-1.3288,0.7586,1.8689,1.5825,
  0.8024,-0.5903,0.6042,-4.5579,-3.1840,2.1015,0.3712,-1.3065,-3.4285,0.1577,5.0552,-0.0963,
  2.8330,3.7801,-0.3718,-1.5766,-1.6385,1.8524,-0.1528,-0.5140,2.5702,1.9138,-0.2953,-0.2113,
  0.8870,0.2479,-0.4361,1.9261,2.8314,4.5815,2.4330,0.0674,0.1436,1.8898,1.6124,0.8586,
  -1.8061,-1.0241,-0.0784,-0.5796,0.9271,2.5688,0.7724,-1.1111,-0.1737,1.8454,2.9026,2.8396,
  0.5388,2.2955,-1.0818,1.1447,0.4693,-0.7190,0.7563,3.1831,2.3627,1.4601,1.3853,2.9265,
  1.0117,-1.5577,-0.7586,1.0406,1.2442,1.5180,3.5768,2.3597,1.7759,-0.6820,-1.4293,1.2824,
  1.7806,3.0219,2.5844,0.5720,-0.0167,1.0933,1.6107,1.4557,2.9017,0.6747,-2.4647,0.1046,
  0.6298,-1.1424,-3.1722,-2.9063,-0.8819,1.1576,-0.7938,1.0251,-0.9095,-1.2794,-0.7673,1.6100,
  0.8541,2.7791,2.5015,1.5806,3.6608,3.9110,-0.2848,-0.9870,2.6552,1.6921,1.3156,2.1359,
  0.9249,-0.7175,-2.8586,-1.2020,-1.0925,-0.6373,0.8585,2.2152,-0.7917,2.7228,2.9501,-0.2090,
  -1.4804,1.7029,-1.3888,-0.8544,1.8555,2.1414,2.5075,-0.0622,1.1809,1.8404,1.6128,1.0099,
  2.5154,0.2363,-0.1345,0.5457,0.3952,1.6015,0.7604,1.3665,4.5755,2.6131,-1.9583,1.8956,
  -0.2396,-1.7688,-1.3397,0.8186,-2.2767,-2.2006,1.3094,-0.6247,0.6428,-0.8978,1.0971,-1.3134,
  -2.1881,1.5605,2.4336,2.5098,-2.7449,3.0273,0.8755,2.1365,0.7087,0.9304,0.6275,4.1403,
  1.0496,0.8911,2.0553,-1.5099,-1.4661,1.2871,0.7453,2.5246,2.2919,1.6559,-0.2475,-2.9953,
  0.8095,1.4282,-2.4094,0.9751,0.8173,2.2121,2.6101,3.5102,3.5388,-0.2470,-0.5616,0.4995,
  0.1740,1.5602,1.0619,-0.9016,3.5621,2.3107,-4.9998,-3.3965,1.8114,0.1959,0.2776,0.5984,
  1.3219,0.9113,2.3850,-3.8260,-2.5338,0.3151,2.2141,2.1348,1.5655,0.5863,-0.3815,0.0284,
  0.4327,0.7538,-2.2637,1.6511,1.9726,1.4805,-1.1136,-0.2922,0.8368,-1.7114,-0.1814,0.8530,
  0.7697,-0.8145,-0.7933,-1.6925,-0.5058,0.4258,0.5796,2.0552,1.6591,0.3151,1.4178,0.6989,
  -1.1825,0.7098,1.6556,-0.6391,-0.0781,-2.2937,1.1972,3.0062,1.5749,0.2977,3.4368,0.7494,
  3.2998,0.3117,2.2235,-1.0268,-1.4077,-1.4522,1.0713,1.3128,1.9717,-0.6751,2.6426,10.0492,
  -0.6726,-2.7955,0.6696,-0.7067,-2.7818,-3.2626,1.6366,0.0483,1.8873,0.3670,0.1989,-1.2897,
  -0.8518,0.6403,-0.0213,-0.6698,3.9114,2.1426,1.8866,2.9361,0.6592,1.1816,-1.6882,-4.2248,
  -0.5621,-1.2913,1.7186,-0.0493,2.6554,1.7143,0.2500,6.4402,3.0691,-1.3501,1.4361,0.4373,
  0.2550,0.1642,-1.6165,1.2559,2.4402,1.7995,0.9637,-1.2427,-0.2246,-0.1297,1.0608,-0.5006,
  -1.5714,-0.4703,0.3450,1.9826,-1.3860,-3.1112,-2.2488,-1.1681,-0.3746,1.8868,-0.6470,-1.3166,
  0.5853,1.5370,0.1393,0.3132,1.5346,-0.1349,0.7407,1.2663,-0.7596,2.2448,-0.0732,1.2603,
  3.1671,-0.7425,-0.3728,1.1617,-2.2393,-1.2272,0.5500,1.5288,0.1808,1.0758,-1.5112,0.3657,
  1.5277,2.9911,-0.8455,0.8833,0.1508,1.7070,1.4278,-0.4266,-0.5111,-1.0467,-3.2418,-2.8865,
  0.7345,0.2904,-0.3240,1.7984,0.1917,1.1700,-0.9659,1.1706,0.2731,-1.2272,0.2849,-0.2440,
  -1.3689,-2.1906,0.4103,-0.0209,-0.7001,0.8482,0.4141,0.2408,-0.6975,-1.0198,0.5168,2.7554,
  1.2748,0.4860,1.1826,0.5637,1.4431,3.0631,0.2620,4.1100,-0.5029,0.0505,-0.7648,-0.3016,
  1.0646,2.5444,6.1337,2.0982,-0.0414,-0.5208,1.1242,-0.2379,-0.2349,-0.9970,-0.6972,-0.4979,
  -1.3371,-1.5913,-3.1040,-0.0490,0.2275,1.0562,1.9888,0.4832,-0.7291,-1.8143,0.3155,0.9613,
  -2.5155,-1.3860,-1.6235,-5.1793,-1.0569,-1.7910,2.3194,0.2417,-4.9094,-3.4414,1.0657,2.5561,
  1.0490,-1.5126,1.0550,1.9717,-0.6233,-1.1808,-0.9102,-1.8465,-1.3240,-2.9099,2.7738,4.2644,
  0.0115,-0.8657,0.3508,-2.2552,0.8536,1.7312,0.8398,3.4564,1.5563,-2.7569,-1.7299,0.1247,
  -1.5211,1.8136,1.7307,0.3567,-0.7555,0.6867,0.2854,1.4067,1.4838,0.8285,0.0961,-0.0619
];
export var HIST_M_INFL = [
  0.0000,0.0000,-0.5587,0.5618,-0.5587,-0.5618,-1.1299,-0.5714,0.5747,0.5714,0.5682,0.0000,
  -1.1299,-0.5714,-0.5747,0.0000,0.5780,1.1494,-1.7045,-0.5780,0.5814,0.5780,-0.5747,0.0000,
  0.0000,-1.1561,0.0000,0.0000,0.5848,-0.5814,0.0000,0.0000,1.1696,-0.5780,0.0000,-0.5814,
  0.0000,0.0000,-0.5848,-0.5882,0.5917,0.5882,1.1696,0.0000,0.0000,0.0000,0.0000,-0.5780,
  -0.5814,-0.5848,-0.5882,0.5917,-0.5882,-0.5917,-1.1905,-0.6024,0.6061,-0.6024,-0.6061,-1.8293,
  -1.2422,-1.2579,-0.6369,-0.6410,-1.2903,-1.3072,0.0000,0.0000,-0.6623,-0.6667,-1.3423,-0.6803,
  -2.0548,-1.3986,-0.7092,-0.7143,-1.4388,-0.7299,0.0000,-0.7353,-0.7407,-0.7463,-0.7519,-0.7576,
  -1.5267,-1.5504,-0.7874,0.0000,0.0000,0.7937,3.1496,0.7634,0.0000,0.0000,0.0000,0.0000,
  0.0000,0.7576,0.0000,0.0000,0.0000,0.7519,0.0000,0.0000,1.4925,-0.7353,0.0000,-0.7407,
  1.4925,0.7353,0.0000,0.7299,0.0000,-0.7246,0.0000,0.0000,0.0000,0.0000,0.7299,0.0000,
  0.0000,0.0000,-0.7246,0.0000,0.0000,0.7299,0.7246,0.7194,0.0000,0.0000,0.0000,0.0000,
  0.7143,0.0000,0.7092,0.7042,0.6993,0.0000,0.6944,0.0000,0.6897,0.0000,-0.6849,-0.6897,
  -1.3889,-0.7042,0.0000,0.7092,-0.7042,0.0000,0.0000,0.0000,0.0000,-0.7092,0.0000,0.0000,
  0.0000,-0.7143,0.0000,-0.7194,0.0000,0.0000,0.0000,0.0000,2.1739,-0.7092,0.0000,0.0000,
  -0.7143,0.7194,0.0000,0.0000,0.0000,0.7143,-0.7092,0.0000,0.0000,0.0000,0.0000,0.7143,
  0.0000,0.0000,0.7092,0.7042,0.6993,2.0833,0.0000,1.3605,1.3423,1.3245,0.6536,0.6494,
  1.2903,0.6369,1.2658,0.6250,1.2422,0.0000,0.6135,0.6098,0.0000,1.2121,0.5988,0.5952,
  0.0000,0.0000,1.7751,1.1628,0.5747,0.0000,-0.5714,-0.5747,0.5780,0.0000,0.0000,0.0000,
  0.0000,0.0000,0.0000,0.5747,0.0000,0.5714,0.5682,0.0000,0.0000,0.0000,0.0000,0.5650,
  0.0000,0.0000,0.0000,0.0000,0.5618,1.1173,0.0000,0.0000,0.0000,0.0000,0.0000,0.5525,
  0.0000,-0.5495,1.1050,0.5464,0.5435,1.0811,5.8824,2.0202,0.9901,1.9608,2.4038,0.9390,
  0.0000,0.0000,1.8605,0.0000,0.0000,0.4566,0.9091,1.3514,2.2222,0.0000,0.4348,1.2987,
  1.2821,-0.8439,-0.4255,1.7094,0.4202,0.8368,1.2448,0.4098,0.0000,-0.4082,-0.8197,-0.4132,
  -0.4149,-0.8333,0.0000,0.4202,-0.4184,0.4202,-0.8368,0.4219,0.4202,-0.8368,0.4219,-0.8403,
  -0.4237,0.0000,0.4255,0.0000,0.4237,0.4219,1.2605,0.8299,0.4115,0.8197,0.4065,1.2146,
  1.6000,1.1811,0.3891,0.0000,0.3876,0.0000,0.0000,0.0000,0.7722,0.3831,0.7634,0.3788,
  0.0000,-0.7547,0.0000,0.3802,0.0000,0.3788,0.7547,0.0000,0.0000,0.0000,0.0000,0.0000,
  -0.3745,-0.3759,0.3774,0.0000,0.3759,0.3745,0.0000,0.3731,0.0000,0.3717,-0.3704,0.0000,
  0.0000,0.0000,0.0000,-0.3717,0.3731,0.0000,0.0000,0.0000,-0.3717,0.0000,0.0000,-0.3731,
  0.0000,0.0000,0.0000,0.0000,0.0000,0.0000,0.3745,0.0000,0.3731,0.0000,0.0000,-0.3717,
  0.0000,0.0000,0.0000,0.3731,0.3717,0.7407,0.7353,-0.3650,0.3663,0.3650,0.0000,0.3636,
  0.0000,0.3623,0.3610,0.3597,0.3584,0.3571,0.7117,0.0000,0.0000,0.0000,0.3534,0.0000,
  0.7042,0.0000,0.6993,0.3472,0.0000,0.0000,0.3460,-0.3448,0.0000,0.0000,0.3460,-0.3448,
  0.3460,-0.3448,0.0000,0.3460,0.0000,0.3448,0.3436,0.0000,0.3425,0.3413,0.0000,0.0000,
  -0.3401,0.3413,0.0000,0.3401,0.0000,0.3390,0.0000,0.0000,0.0000,0.6757,0.0000,0.0000,
  0.0000,0.0000,0.0000,0.0000,0.0000,0.0000,0.6711,-0.3333,0.3344,0.0000,0.0000,0.0000,
  0.0000,0.3333,0.0000,0.3322,0.0000,0.0000,0.3311,0.0000,0.3300,0.0000,0.0000,0.0000,
  0.0000,0.0000,0.3289,0.0000,0.0000,0.3279,0.3268,0.0000,0.0000,0.3257,0.0000,0.3247,
  0.0000,0.0000,0.0000,0.0000,0.0000,0.3236,0.3226,-0.3215,0.3226,0.0000,0.3215,0.0000,
  0.0000,0.0000,0.3205,0.3195,0.0000,0.6369,0.0000,0.0000,0.0000,0.3165,0.0000,0.3155,
  0.0000,0.6289,0.3125,0.6231,0.0000,0.3096,0.3086,0.6154,0.0000,0.6116,0.0000,0.0000,
  0.0000,0.0000,0.3040,0.3030,0.3021,0.3012,0.3003,0.2994,0.2985,0.2976,0.2967,0.2959,
  0.5900,0.2933,0.2924,0.2915,0.2907,0.5797,0.5764,0.2865,0.2857,0.5698,0.2833,0.2825,
  0.2817,0.5618,0.8380,0.5540,0.2755,0.5495,0.5464,0.5435,0.2703,0.5391,0.5362,0.5333,
  0.2653,0.5291,0.5263,0.7853,0.2597,0.5181,0.5155,0.0000,0.5128,0.5102,0.5076,0.5051,
  0.0000,0.2513,0.2506,0.2500,0.4988,0.7444,0.2463,0.2457,0.0000,0.2451,0.0000,0.4890,
  0.0000,0.4866,0.2421,0.2415,0.2410,0.2404,0.4796,0.2387,0.2381,0.4751,0.2364,0.2358,
  0.2353,0.7042,0.9324,0.6928,0.6881,0.6834,0.2262,1.8059,0.2217,0.8850,0.6579,0.6536,
  0.8658,1.2876,1.2712,0.4184,1.2500,0.8230,0.8163,1.2146,1.2000,0.9881,0.7828,0.7767,
  0.3854,0.7678,0.3810,0.3795,0.5671,0.7519,1.1194,0.1845,0.5525,0.5495,0.7286,0.3617,
  0.1802,0.3597,0.1792,0.3578,0.7130,0.5310,0.5282,0.5254,0.3484,0.5208,0.1727,0.3448,
  0.5155,1.0256,0.6768,0.8403,0.5000,0.6633,0.4942,0.3279,0.3268,0.3257,0.4870,0.3231,
  0.6441,0.6400,0.7949,0.7886,0.9390,1.0853,0.7669,0.4566,0.7576,0.9023,0.4471,0.4451,
  0.8863,1.1713,1.0130,1.1461,1.2748,1.1189,1.1065,0.9576,1.0840,0.8043,0.9309,1.0540,
  1.4342,1.4139,1.5209,1.1236,0.9877,1.1002,0.0000,0.7255,0.8403,0.9524,0.8255,0.9357,
  0.8111,1.0345,0.6826,0.6780,0.7856,0.8909,1.1038,0.7642,0.9751,0.2146,0.3212,0.3202,
  0.3191,0.3181,-0.1057,0.4233,0.9484,1.2526,0.5155,0.2051,0.2047,0.3064,-0.2037,-0.4082,
  0.2049,0.1022,0.0000,0.7150,0.6085,0.3024,0.4020,0.3003,0.4990,0.2979,0.1980,0.0988,
  0.5923,0.4907,0.1953,0.4873,0.2910,0.2901,0.3857,0.3842,0.4785,0.2857,0.0000,0.0000,
  0.1899,0.4739,0.3774,0.4699,0.3742,0.2796,0.1859,0.1855,0.2778,0.3693,0.2760,0.2752,
  0.2745,-0.2737,-0.4575,-0.1838,0.2762,0.5510,0.0000,0.1826,0.4558,0.0907,0.0907,0.0906,
  0.6335,0.3597,0.4480,0.5352,0.3549,0.3537,0.2643,0.5272,0.5245,0.2609,0.0867,0.0000,
  0.2600,0.2593,0.4310,0.5150,0.3416,0.4255,0.4237,0.4219,0.6723,0.3339,0.0832,0.1663,
  0.4979,0.4129,0.5757,0.6541,0.5686,0.2423,0.2417,0.1608,0.3210,0.4800,0.2389,0.1589,
  1.0309,0.4710,0.5469,0.1554,0.2327,0.5418,0.3849,0.9202,0.8359,0.6029,0.2247,0.0000,
  0.5979,0.1486,0.1484,0.1481,0.2959,0.2950,0.1471,0.2937,0.4392,0.1458,0.2911,0.0726,
  0.1450,0.3621,0.5051,0.1436,0.1434,0.3579,0.2140,0.2847,0.2839,0.3539,0.1410,-0.0704,
  0.4933,0.3506,0.3494,0.2786,0.1389,0.1387,0.0000,0.2770,0.2072,0.4135,0.0686,0.0000,
  0.2743,0.3420,0.3408,0.1359,0.0678,0.3390,0.2703,0.4043,0.2685,0.0669,0.1338,0.0000,
  0.4008,0.3992,0.3313,0.3303,0.1975,0.1971,0.0000,0.2623,0.1962,0.3264,-0.0651,-0.0651,
  0.5863,0.3238,0.5165,0.3854,0.1919,0.0639,0.1914,0.1911,0.3179,0.3169,0.1895,0.0000,
  0.3153,0.3143,0.2506,0.1250,-0.0624,0.1249,0.1248,0.1869,0.2488,0.2481,-0.0619,-0.1238,
  0.1860,0.1856,0.1853,0.1850,0.1846,0.1229,0.1227,0.1225,0.1224,0.2445,0.0000,-0.0610,
  0.2441,0.1217,0.3040,0.7273,0.0000,0.0000,0.3008,0.2400,0.4788,0.1787,0.0595,0.0000,
  0.2971,0.5924,0.8245,0.0584,0.1168,0.5248,0.2320,0.0000,0.5208,0.1727,0.0575,-0.0574,
  0.6322,0.3998,0.2275,0.3973,0.4522,0.1688,-0.2809,0.0000,0.4507,-0.3365,-0.1688,-0.3946,
  0.2264,0.3953,0.5624,0.5593,0.0000,0.0556,0.1112,0.3331,0.1660,0.1657,0.0000,-0.2206,
  0.4422,0.7705,0.6008,-0.2172,-0.1632,0.1090,0.1089,0.3806,0.3250,-0.1080,-0.2703,-0.1084,
  0.4883,0.5400,0.6445,0.3202,0.5851,0.3173,-0.1581,0.0528,0.2111,0.5266,0.0524,-0.3665,
  0.2102,0.5768,0.7821,0.6725,-0.1028,0.0514,0.4627,0.5118,1.2220,0.2012,-0.8032,-0.4049,
  0.7622,0.2017,0.5536,0.8509,0.4963,0.1975,0.2957,0.1966,-0.4904,-0.5421,-0.1487,0.1489,
  0.3072,0.5335,0.9091,0.6525,0.6096,0.1924,-0.0240,-0.1824,0.2741,0.2158,0.5935,-0.0666,
  0.4951,0.2890,0.8692,0.6041,0.8426,1.0109,0.5210,-0.3955,-0.1415,-1.0101,-1.9116,-1.0356,
  0.4329,0.4973,0.2451,0.2492,0.2908,0.8557,-0.1576,0.2229,0.0649,0.0972,0.0694,-0.1757,
  0.3427,0.0231,0.4106,0.1746,0.0780,-0.1008,0.0229,0.1376,0.0595,0.1236,0.0412,0.1737,
  0.4745,0.4950,0.9760,0.6444,0.4669,-0.1062,0.0886,0.2744,0.1545,-0.2071,-0.0839,-0.2475,
  0.4387,0.4412,0.7599,0.3052,-0.1173,-0.1479,-0.1656,0.5587,0.4471,-0.0389,-0.4755,-0.2693,
  0.2962,0.8207,0.2584,-0.1031,0.1806,0.2361,0.0428,0.1199,0.1154,-0.2562,-0.2055,-0.0086,
  0.3733,0.3676,0.6432,0.3301,0.3501,0.1850,-0.0378,-0.1679,0.0757,-0.2521,-0.5391,-0.5674,
  -0.4685,0.4322,0.5965,0.2033,0.5072,0.3532,0.0042,-0.1383,-0.1553,-0.0462,-0.2102,-0.3455,
  0.1691,0.0802,0.4302,0.4745,0.4054,0.3289,-0.1618,0.0914,0.2408,0.1243,-0.1572,0.0331,
  0.5840,0.3130,0.0821,0.2953,0.0859,0.0940,-0.0694,0.2982,0.5295,-0.0648,0.0041,-0.0608,
  0.5476,0.4518,0.2249,0.4007,0.4151,0.1590,0.0079,0.0556,0.1150,0.1743,-0.3322,-0.3214,
  0.1911,0.4251,0.5618,0.5311,0.2113,0.0195,0.1679,-0.0039,0.0780,0.2298,-0.0544,-0.0933,
  0.3892,0.2752,-0.2203,-0.6664,0.0000,0.5499,0.5043,0.3165,0.1385,0.0423,-0.0614,0.0922,
  0.4262,0.5467,0.7110,0.8192,0.8051,0.9287,0.4785,0.2088,0.2705,0.8312,0.4917,0.3058,
  0.8429,0.9141,1.3323,0.5600,1.1034,1.3719,-0.0101,-0.0371,0.2161,0.4043,-0.1007,-0.3057,
  0.7985,0.5582,0.3324,0.5036,0.2538,0.3222,0.1901,0.4384,0.2475,-0.0390,-0.2015,-0.0977,
  0.5444,0.6193,0.6445,0.3906,0.1658,0.0318,0.1178,0.0827,0.1588,0.1142,-0.0539,0.0380,
  0.6527,0.4439,0.2256,0.3127,0.2057,0.3422,0.1519,0.2879,0.2531,-0.1047,-0.1048,-0.0216
];

/* Calendar-year returns compounded from the monthly series above, so the
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

/* Shiller's cyclically adjusted P/E (CAPE), January 1926 through December
   2025, one per month in step with the returns above: the month's S&P 500
   price over the average of the ten years of earnings before it, both after
   inflation. A high reading means stocks are dear against their earnings.
   Source: Robert Shiller (Yale), via multpl. */
export var HIST_M_CAPE = [
  11.34,11.39,10.71,10.40,10.58,11.20,11.87,12.49,12.69,12.43,12.62,13.01,
  13.19,13.63,14.03,14.49,15.00,15.12,15.82,16.86,17.82,17.54,18.13,18.65,
  18.81,18.87,19.94,21.26,21.83,20.91,21.08,21.76,23.00,23.58,25.12,25.30,
  27.08,27.13,27.68,27.57,27.70,27.94,29.93,31.48,32.56,28.96,21.17,22.01,
  22.31,23.70,24.59,25.84,24.31,21.87,21.55,21.30,21.07,18.21,16.94,16.06,
  16.71,18.16,18.58,16.87,15.40,15.06,15.52,15.01,12.82,11.15,11.42,9.31,
  9.31,9.34,9.41,7.19,6.39,5.57,5.84,8.83,9.76,8.48,8.46,8.26,
  8.73,7.83,7.87,8.72,11.25,13.10,13.75,13.00,12.92,11.70,12.01,12.28,
  13.03,13.93,13.25,13.52,12.18,12.29,11.74,11.32,10.91,11.11,11.45,11.64,
  11.50,11.09,10.40,11.10,11.99,12.54,13.20,14.11,14.42,14.83,16.13,16.16,
  17.09,18.10,18.66,18.72,17.75,18.39,19.36,19.62,19.86,20.91,21.50,21.13,
  21.62,22.24,22.04,20.56,19.47,18.71,19.65,19.81,16.85,14.36,13.16,13.01,
  13.51,13.26,12.38,11.79,11.99,12.29,14.77,14.90,14.28,16.06,16.15,15.76,
  15.60,15.66,15.73,13.92,14.50,14.83,15.27,15.12,16.45,16.82,16.60,16.28,
  16.38,16.22,16.17,16.37,14.14,12.84,13.37,13.65,14.21,14.33,14.64,13.91,
  13.90,13.00,12.96,12.43,12.04,12.16,12.74,12.46,12.28,11.58,10.91,10.09,
  10.10,9.68,9.00,8.54,8.51,8.91,9.15,9.01,9.08,9.60,9.66,9.62,
  10.15,10.71,10.85,11.04,11.36,11.52,11.77,11.21,11.34,11.19,10.63,10.74,
  11.05,10.95,11.22,10.94,11.10,11.53,11.74,11.54,11.33,11.58,11.48,11.64,
  11.96,12.34,12.32,12.63,13.04,13.13,12.87,12.92,13.80,14.37,14.85,15.02,
  15.62,15.76,15.13,16.04,16.01,15.77,14.51,13.98,11.84,11.39,11.11,11.37,
  11.47,11.95,11.29,10.90,10.73,11.08,11.70,11.34,10.83,11.13,10.98,10.68,
  10.42,10.00,10.19,10.78,11.24,11.58,11.13,10.72,10.55,10.83,10.25,10.16,
  10.25,9.87,9.90,9.78,9.69,9.07,9.61,9.85,9.88,10.17,10.22,10.53,
  10.75,10.91,10.91,11.18,11.46,11.55,10.54,11.04,11.34,11.66,11.54,11.31,
  11.90,12.14,11.84,11.95,11.86,11.62,11.78,12.26,12.44,12.31,11.85,12.15,
  12.53,12.36,12.36,12.24,12.20,12.45,12.67,12.68,12.43,12.13,12.47,12.93,
  13.01,12.86,12.83,12.16,12.14,11.62,11.75,11.72,11.14,11.39,11.64,11.75,
  12.00,12.22,12.42,12.91,13.31,13.36,13.83,14.04,14.36,14.62,15.12,15.79,
  15.99,16.44,16.22,16.69,16.52,17.37,18.45,18.22,18.84,17.77,18.84,18.94,
  18.29,18.27,19.37,19.37,18.54,18.16,18.86,18.67,17.84,17.42,17.12,17.20,
  16.72,15.84,15.90,16.12,16.60,16.73,16.87,15.87,15.16,14.15,13.74,13.67,
  13.79,13.78,13.93,13.91,14.32,14.64,14.96,15.54,15.93,16.56,16.99,17.36,
  17.98,17.76,18.20,18.43,18.69,18.45,19.09,18.96,18.12,18.02,18.07,18.62,
  18.34,17.55,17.29,17.43,17.26,17.82,17.38,17.58,17.05,16.61,17.15,17.56,
  18.47,19.23,19.84,20.38,20.60,20.33,20.15,20.94,20.71,20.92,21.86,22.04,
  21.20,21.45,21.44,20.66,19.09,16.83,17.14,17.57,17.32,16.74,17.85,18.59,
  19.26,19.47,19.29,20.15,20.51,20.38,19.97,20.47,20.96,20.89,20.72,21.04,
  21.63,21.83,22.17,22.42,22.57,22.30,22.98,22.65,22.89,23.21,23.23,22.75,
  23.27,23.37,23.25,23.42,23.71,22.39,22.30,22.67,23.37,23.78,23.93,23.69,
  24.06,23.70,22.61,23.11,21.85,21.56,21.38,19.91,19.16,18.83,19.71,19.74,
  20.43,21.07,21.44,21.69,21.95,21.55,21.80,22.03,22.22,22.07,21.26,21.75,
  21.51,20.42,19.93,21.28,21.63,22.00,21.75,21.14,21.68,22.00,22.20,22.28,
  21.19,20.90,20.20,20.43,20.97,19.71,18.68,18.43,18.40,18.45,18.44,17.33,
  17.09,16.37,16.53,15.87,13.98,13.80,13.73,14.10,14.84,15.06,14.95,15.87,
  16.46,17.03,17.40,17.92,17.56,17.08,16.89,16.52,16.86,16.43,15.64,16.60,
  17.26,17.46,17.81,17.92,17.66,17.64,17.40,17.94,17.61,17.53,18.34,18.65,
  18.71,17.89,17.41,16.94,16.31,15.81,15.89,15.28,15.48,15.91,14.65,13.49,
  13.53,12.96,13.31,12.55,12.00,11.89,10.39,9.82,8.68,8.74,8.95,8.29,
  8.92,9.76,10.16,10.23,10.82,11.01,10.90,10.09,9.92,10.33,10.44,10.25,
  11.19,11.59,11.63,11.69,11.53,11.54,11.76,11.60,11.81,11.35,11.25,11.60,
  11.44,11.01,10.90,10.64,10.55,10.53,10.57,10.27,10.07,9.77,9.77,9.68,
  9.24,9.05,8.95,9.26,9.63,9.55,9.43,10.02,9.94,9.53,8.93,9.01,
  9.26,9.00,9.07,9.13,8.79,8.85,8.83,9.13,9.11,8.68,8.52,8.75,
  8.85,9.05,8.08,7.84,8.10,8.51,8.88,9.07,9.20,9.36,9.65,9.39,
  9.26,8.83,9.08,9.09,8.82,8.77,8.45,8.40,7.58,7.65,7.81,7.83,
  7.39,7.18,6.95,7.26,7.19,6.69,6.64,6.64,7.40,8.00,8.35,8.47,
  8.76,8.91,9.23,9.53,9.87,10.00,10.01,9.73,9.98,10.00,9.85,9.82,
  9.89,9.32,9.33,9.31,9.23,9.01,8.87,9.62,9.69,9.60,9.69,9.60,
  10.00,10.49,10.37,10.40,10.61,10.81,11.00,10.74,10.47,10.55,11.16,11.69,
  11.72,12.39,13.19,13.55,13.56,13.89,13.62,13.89,13.47,13.43,13.87,14.09,
  14.92,15.82,16.43,16.20,16.16,16.83,17.31,18.33,17.68,15.53,13.59,13.39,
  13.90,14.30,14.67,14.43,14.03,14.77,14.61,14.24,14.37,14.81,14.45,14.70,
  15.09,15.47,15.30,15.69,16.19,16.64,17.01,17.73,17.71,17.64,17.24,17.65,
  17.05,16.51,16.83,16.81,17.39,17.82,17.75,16.17,15.30,14.82,15.19,15.85,
  15.61,17.36,17.82,18.16,18.03,18.01,18.10,18.51,18.36,18.35,18.29,18.44,
  19.77,19.58,19.28,19.30,19.66,19.31,19.62,19.72,19.71,19.37,19.83,20.45,
  20.32,20.54,20.85,20.46,20.52,20.61,20.56,20.81,20.99,21.11,21.04,21.16,
  21.41,21.26,20.83,20.05,20.19,20.29,20.07,20.53,20.57,20.39,20.21,19.91,
  20.22,20.80,21.15,21.64,22.19,22.72,23.37,23.28,23.94,23.93,24.35,25.03,
  24.76,25.97,25.63,25.42,25.81,25.96,24.86,25.41,25.68,26.48,27.58,27.72,
  28.33,29.26,28.80,27.58,29.93,31.25,32.76,32.58,32.66,32.90,32.33,33.03,
  32.86,34.71,36.29,37.27,36.95,36.80,38.26,35.42,33.53,33.77,37.37,38.82,
  40.57,40.40,41.35,42.70,42.55,42.18,43.83,41.93,41.32,40.55,43.21,44.19,
  43.77,42.18,43.22,43.53,41.96,42.78,42.75,42.87,41.89,39.37,38.78,37.27,
  36.98,35.83,32.32,32.17,34.07,33.07,32.16,31.40,27.67,28.58,30.01,30.50,
  30.28,29.09,30.29,29.01,28.13,26.39,23.46,23.59,22.36,21.96,23.35,23.10,
  22.90,21.21,21.31,22.43,23.59,24.83,24.87,24.64,25.24,25.68,25.95,26.64,
  27.66,27.65,26.89,26.90,25.90,26.40,25.70,25.17,25.67,25.41,26.47,27.14,
  26.59,26.74,26.34,25.41,25.65,26.07,26.29,26.10,25.73,24.88,25.93,26.44,
  26.47,26.25,26.33,26.15,25.65,24.75,24.70,25.05,25.64,26.54,26.93,27.28,
  27.21,27.32,26.23,26.98,27.55,27.42,27.41,26.15,26.73,27.32,25.73,25.96,
  24.02,23.50,22.61,23.36,23.70,22.42,20.91,21.40,20.36,16.39,15.26,15.38,
  15.17,14.12,13.32,14.98,16.00,16.38,16.69,18.09,18.83,19.36,19.81,20.32,
  20.53,19.92,21.00,21.80,20.48,19.74,19.67,19.77,20.38,21.24,21.70,22.40,
  22.98,23.49,22.90,23.14,23.06,22.10,22.61,20.05,19.70,20.16,20.35,20.52,
  21.21,21.80,22.05,21.78,20.94,20.55,21.00,21.41,21.78,21.58,20.90,21.24,
  21.90,22.05,22.42,22.60,23.41,22.93,23.49,23.36,23.44,23.83,24.64,24.86,
  24.86,24.59,24.96,24.79,24.94,25.56,25.82,25.62,25.92,25.16,26.61,26.79,
  26.49,27.00,26.73,26.79,26.81,26.50,26.38,25.69,24.50,25.49,26.23,25.97,
  24.21,24.00,25.37,25.92,25.69,25.84,26.69,26.95,26.73,26.53,26.85,27.87,
  28.06,28.66,29.09,28.90,29.31,29.75,30.00,29.91,30.17,30.92,31.30,32.09,
  33.31,32.04,31.81,30.97,31.24,31.63,31.89,32.39,32.62,31.04,30.20,28.29,
  28.38,29.54,29.58,30.13,29.24,29.28,29.99,28.71,29.23,28.84,29.84,30.33,
  30.99,30.73,24.82,25.93,27.33,28.84,29.60,31.16,30.84,31.28,32.47,33.77,
  34.51,35.10,35.04,36.72,36.55,36.70,37.44,37.97,37.62,37.25,38.58,38.31,
  36.94,35.29,34.27,33.89,30.67,29.05,29.00,30.70,28.23,27.08,28.38,28.32,
  28.34,28.92,27.94,28.77,28.76,29.94,30.89,30.09,29.80,28.70,30.01,31.45,
  31.97,33.04,33.76,33.03,33.78,34.81,35.48,35.08,35.70,36.59,37.36,37.72,
  37.14,37.19,34.79,32.63,35.08,36.12,37.48,37.85,38.59,39.31,39.16,39.59
];
/* Two more asset classes, monthly from July 1926 (Kenneth French's records
   start there) through December 2025, in percent. Cash is the one-month
   Treasury bill. Small value is small-company value stocks: the small,
   high book-to-market portfolio of the Fama-French 2x3 sorts, value
   weighted. Source: Kenneth R. French Data Library (Dartmouth), from CRSP;
   T-bills from Ibbotson Associates until May 2024, ICE BofA after. */
export var HIST_FF_START = 6;   // July 1926, as a month of the series above
export var HIST_M_CASH = [
  0.22,0.25,0.23,0.32,0.31,0.28,
  0.25,0.26,0.3,0.25,0.3,0.26,0.3,0.28,0.21,0.25,0.21,0.22,
  0.25,0.33,0.29,0.22,0.32,0.31,0.32,0.32,0.27,0.41,0.38,0.06,
  0.34,0.36,0.34,0.36,0.44,0.52,0.33,0.4,0.35,0.46,0.37,0.37,
  0.14,0.3,0.35,0.21,0.26,0.27,0.2,0.09,0.22,0.09,0.13,0.14,
  0.15,0.04,0.13,0.08,0.09,0.08,0.06,0.03,0.03,0.1,0.17,0.12,
  0.23,0.23,0.16,0.11,0.06,0.02,0.02,0.03,0.03,0.02,0.02,0.01,
  0.01,-0.03,0.04,0.1,0.04,0.02,0.02,0.03,0.02,0.01,0.02,0.02,
  0.05,0.02,0.02,0.01,0.01,0.01,0.01,0.01,0.01,0.01,0.01,0.01,
  0.01,0.02,0.01,0.01,0.01,0.01,0.01,0.01,0.01,0.01,0.02,0.01,
  0.01,0.01,0.02,0.02,0.02,0.03,0.01,0.02,0.01,0.02,0.01,0,
  0.01,0.02,0.01,0.03,0.06,0.03,0.03,0.02,0.04,0.02,0.02,0,
  0,0,-0.01,0.01,0,0,-0.01,0,0.02,0.01,-0.06,0,
  -0.01,0.01,-0.01,0,0.01,0.01,0,-0.01,0.01,0,0,0,
  0,0,0,0,-0.02,0,0.01,-0.01,0,0,0,0,
  -0.01,-0.01,0.01,-0.01,0,0,0.03,0.01,0.01,0,0,0.01,
  0.02,0.01,0.01,0.01,0.03,0.02,0.03,0.03,0.03,0.03,0.03,0.03,
  0.03,0.03,0.03,0.03,0.02,0.03,0.03,0.03,0.03,0.03,0.03,0.03,
  0.03,0.03,0.02,0.03,0.03,0.03,0.03,0.03,0.02,0.03,0.03,0.02,
  0.03,0.02,0.02,0.03,0.03,0.02,0.03,0.03,0.03,0.03,0.02,0.03,
  0.03,0.03,0.03,0.03,0.03,0.03,0.03,0.03,0.03,0.03,0.03,0.03,
  0.03,0.03,0.03,0.03,0.03,0.03,0.03,0.03,0.06,0.06,0.06,0.08,
  0.07,0.07,0.09,0.08,0.08,0.09,0.08,0.09,0.04,0.04,0.04,0.04,
  0.1,0.09,0.1,0.09,0.1,0.1,0.09,0.09,0.09,0.09,0.08,0.09,
  0.09,0.09,0.1,0.09,0.1,0.1,0.1,0.1,0.1,0.12,0.11,0.11,
  0.13,0.1,0.11,0.13,0.12,0.12,0.13,0.13,0.12,0.16,0.11,0.12,
  0.15,0.12,0.11,0.12,0.13,0.15,0.15,0.15,0.16,0.14,0.1,0.16,
  0.16,0.14,0.18,0.16,0.17,0.18,0.15,0.17,0.16,0.13,0.08,0.13,
  0.11,0.07,0.08,0.09,0.05,0.06,0.05,0.05,0.09,0.07,0.06,0.08,
  0.08,0.09,0.1,0.1,0.14,0.1,0.1,0.16,0.16,0.18,0.17,0.18,
  0.22,0.19,0.15,0.19,0.23,0.2,0.22,0.17,0.18,0.25,0.2,0.24,
  0.27,0.24,0.23,0.25,0.26,0.24,0.3,0.25,0.26,0.29,0.28,0.24,
  0.28,0.12,0.09,0.08,0.11,0.03,0.07,0.04,0.19,0.18,0.11,0.22,
  0.21,0.19,0.22,0.2,0.22,0.24,0.25,0.19,0.31,0.3,0.26,0.34,
  0.33,0.29,0.35,0.19,0.27,0.24,0.13,0.17,0.16,0.22,0.13,0.16,
  0.19,0.14,0.2,0.17,0.18,0.2,0.18,0.14,0.17,0.19,0.15,0.19,
  0.24,0.2,0.2,0.22,0.24,0.2,0.27,0.23,0.21,0.26,0.2,0.23,
  0.25,0.23,0.23,0.25,0.24,0.23,0.27,0.25,0.27,0.29,0.27,0.29,
  0.3,0.26,0.31,0.29,0.26,0.3,0.3,0.28,0.28,0.29,0.29,0.31,
  0.28,0.3,0.36,0.31,0.31,0.35,0.31,0.33,0.31,0.31,0.35,0.33,
  0.38,0.35,0.38,0.34,0.41,0.38,0.35,0.41,0.4,0.45,0.4,0.4,
  0.43,0.36,0.39,0.32,0.33,0.27,0.32,0.31,0.32,0.39,0.36,0.33,
  0.4,0.39,0.38,0.43,0.45,0.43,0.48,0.42,0.43,0.44,0.42,0.43,
  0.53,0.46,0.46,0.53,0.48,0.51,0.53,0.5,0.62,0.6,0.52,0.64,
  0.6,0.62,0.57,0.5,0.53,0.58,0.52,0.53,0.54,0.46,0.46,0.42,
  0.38,0.33,0.3,0.28,0.29,0.37,0.4,0.47,0.37,0.37,0.37,0.37,
  0.29,0.25,0.27,0.29,0.3,0.29,0.31,0.29,0.34,0.4,0.37,0.37,
  0.44,0.42,0.46,0.52,0.51,0.51,0.64,0.7,0.68,0.65,0.56,0.64,
  0.63,0.58,0.56,0.75,0.75,0.6,0.7,0.6,0.81,0.51,0.54,0.7,
  0.58,0.43,0.41,0.44,0.44,0.41,0.48,0.48,0.53,0.56,0.41,0.48,
  0.47,0.34,0.4,0.42,0.37,0.43,0.47,0.42,0.44,0.41,0.4,0.4,
  0.36,0.35,0.38,0.38,0.37,0.4,0.42,0.44,0.43,0.49,0.5,0.49,
  0.49,0.46,0.53,0.54,0.51,0.54,0.56,0.56,0.62,0.68,0.7,0.78,
  0.77,0.73,0.81,0.8,0.82,0.81,0.77,0.77,0.83,0.87,0.99,0.95,
  0.8,0.89,1.21,1.26,0.81,0.61,0.53,0.64,0.75,0.95,0.96,1.31,
  1.04,1.07,1.21,1.08,1.15,1.35,1.24,1.28,1.24,1.21,1.07,0.87,
  0.8,0.92,0.98,1.13,1.06,0.96,1.05,0.76,0.51,0.59,0.63,0.67,
  0.69,0.62,0.63,0.71,0.69,0.67,0.74,0.76,0.76,0.76,0.7,0.73,
  0.76,0.71,0.73,0.81,0.78,0.75,0.82,0.83,0.86,1,0.73,0.64,
  0.65,0.58,0.62,0.72,0.66,0.55,0.62,0.55,0.6,0.65,0.61,0.65,
  0.56,0.53,0.6,0.52,0.49,0.52,0.52,0.46,0.45,0.46,0.39,0.49,
  0.42,0.43,0.47,0.44,0.38,0.48,0.46,0.47,0.45,0.6,0.35,0.39,
  0.29,0.46,0.44,0.46,0.51,0.49,0.51,0.59,0.62,0.61,0.57,0.63,
  0.55,0.61,0.67,0.67,0.79,0.71,0.7,0.74,0.65,0.68,0.69,0.61,
  0.57,0.57,0.64,0.69,0.68,0.63,0.68,0.66,0.6,0.68,0.57,0.6,
  0.52,0.48,0.44,0.53,0.47,0.42,0.49,0.46,0.46,0.42,0.39,0.38,
  0.34,0.28,0.34,0.32,0.28,0.32,0.31,0.26,0.26,0.23,0.23,0.28,
  0.23,0.22,0.25,0.24,0.22,0.25,0.24,0.25,0.26,0.22,0.25,0.23,
  0.25,0.21,0.27,0.27,0.32,0.31,0.28,0.37,0.37,0.38,0.37,0.44,
  0.42,0.4,0.46,0.44,0.54,0.47,0.45,0.47,0.43,0.47,0.42,0.49,
  0.43,0.39,0.39,0.46,0.42,0.4,0.45,0.41,0.44,0.42,0.41,0.46,
  0.45,0.39,0.43,0.43,0.49,0.37,0.43,0.41,0.44,0.42,0.39,0.48,
  0.43,0.39,0.39,0.43,0.4,0.41,0.4,0.43,0.46,0.32,0.31,0.38,
  0.35,0.35,0.43,0.37,0.34,0.4,0.38,0.39,0.39,0.39,0.36,0.44,
  0.41,0.43,0.47,0.46,0.5,0.4,0.48,0.5,0.51,0.56,0.51,0.5,
  0.54,0.38,0.42,0.39,0.32,0.28,0.3,0.31,0.28,0.22,0.17,0.15,
  0.14,0.13,0.13,0.15,0.14,0.13,0.15,0.14,0.14,0.14,0.12,0.11,
  0.1,0.09,0.1,0.1,0.09,0.1,0.07,0.07,0.08,0.07,0.07,0.08,
  0.07,0.06,0.09,0.08,0.06,0.08,0.1,0.11,0.11,0.11,0.15,0.16,
  0.16,0.16,0.21,0.21,0.24,0.23,0.24,0.3,0.29,0.27,0.31,0.32,
  0.35,0.34,0.37,0.36,0.43,0.4,0.4,0.42,0.41,0.41,0.42,0.4,
  0.44,0.38,0.43,0.44,0.41,0.4,0.4,0.42,0.32,0.32,0.34,0.27,
  0.21,0.13,0.17,0.18,0.18,0.17,0.15,0.13,0.15,0.08,0.03,0,
  0,0.01,0.02,0.01,0,0.01,0.01,0.01,0.01,0,0,0.01,
  0,0,0.01,0.01,0.01,0.01,0.01,0.01,0.01,0.01,0.01,0.01,
  0.01,0.01,0.01,0,0,0,0,0.01,0,0,0,0,
  0,0,0,0,0.01,0,0,0.01,0.01,0.01,0.01,0.01,
  0,0,0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,0,0.01,
  0.01,0.02,0.02,0.01,0.01,0.02,0.02,0.02,0.02,0.02,0.01,0.03,
  0.04,0.04,0.03,0.05,0.06,0.06,0.07,0.09,0.09,0.09,0.08,0.09,
  0.11,0.11,0.12,0.14,0.14,0.14,0.16,0.16,0.15,0.19,0.18,0.19,
  0.21,0.18,0.19,0.21,0.21,0.18,0.19,0.16,0.18,0.15,0.12,0.14,
  0.13,0.12,0.12,0,0.01,0.01,0.01,0.01,0.01,0.01,0.01,0.01,
  0,0,0,0,0,0,0,0,0,0,0,0.01,
  0,0,0,0,0.03,0.06,0.08,0.19,0.19,0.23,0.29,0.33,
  0.35,0.34,0.36,0.35,0.36,0.4,0.45,0.45,0.43,0.47,0.44,0.43,
  0.47,0.42,0.43,0.47,0.44,0.41,0.45,0.48,0.4,0.39,0.4,0.37,
  0.37,0.33,0.34,0.35,0.38,0.34,0.34,0.38,0.33,0.37,0.3,0.34
];
export var HIST_M_SV = [
  -0.1275,5.4422,-0.4399,-2.0128,2.0877,3.27,
  3.9875,6.4416,-3.1144,3.4837,13.4556,-4.089,4.0181,0.7332,0.3714,-6.0935,10.4641,2.4534,
  3.6043,-4.1263,9.4431,9.9758,2.6118,-6.799,-0.9736,3.7666,6.1849,1.6663,12.1856,-0.5797,
  1.7793,0.3953,-4.3437,0.7306,-12.8944,6.456,3.8676,-0.4807,-3.607,-21.2218,-10.9661,-1.1822,
  8.4726,4.5687,10.6873,-3.4819,-2.9869,-19.0393,2.5703,-2.321,-19.5014,-10.4086,-2.5025,-17.8435,
  16.164,17.0097,-7.2163,-18.1804,-13.716,21.3688,-5.7544,-3.7563,-35.3242,8.1969,-9.5721,-23.201,
  11.9357,1.5241,-10.778,-16.0788,-17.8429,1.9075,63.1226,83.3873,-12.4547,-24.1384,-13.5787,-10.3743,
  8.045,-20.862,15.4219,56.9113,72.3588,18.5855,-7.2303,8.4113,-20.8876,-14.0569,6.1167,-0.23,
  39.6638,4.8488,-0.0115,-1.7047,-12.0918,-2.1893,-24.6948,11.5686,-3.484,-3.9835,12.7483,1.6042,
  -3.0465,-6.3227,-11.3386,10.5543,1.8154,0.839,13.3415,14.5514,0.4703,6.9368,19.7932,1.7938,
  23.5566,5.6394,0.8801,-15.5268,8.7363,-1.1537,9.3731,4.1959,4.4692,6.5179,12.2081,7.5173,
  10.1026,4.6089,3.3096,-13.1058,-4.121,-10.6147,10.7982,-5.5971,-23.0745,-9.7359,-11.7428,-12.6143,
  3.8517,4.8697,-30.4414,20.8018,-5.5145,27.6313,15.514,-9.4011,-2.7807,16.9041,-5.8897,1.5146,
  -10.1444,6.2924,-22.8623,1.9784,9.8728,-10.6791,13.6464,-12.6408,54.9803,-5.0122,-13.7537,0.2893,
  -2.7816,3.1487,2.2809,4.0867,-32.4369,7.9796,3.3197,1.874,5.1994,6.2991,0.2185,-2.3194,
  -0.3185,-2.8938,3.777,-5.2124,1.5397,8.4665,18.5092,-0.3921,-1.9575,-6.06,-2.7573,-12.7114,
  14.4644,-1.6886,-5.7168,-3.7306,1.6402,2.1428,5.147,2.4946,5.9938,14.5034,-4.0445,2.6111,
  23.8295,17.4933,14.9968,8.1682,13.2962,0.418,-8.9051,0.7072,5.4039,0.825,-10.4323,11.4105,
  5.4614,0.7064,7.4552,-3.9171,7.0596,10.7165,-1.4416,1.9162,-0.2286,-0.5164,3.7232,10.5409,
  4.1166,10.7095,-6.2843,10.0659,4.0736,6.8558,-5.4586,4.9048,6.4483,7.2211,11.5432,1.6275,
  12.3686,-7.2977,5.8097,6.3892,5.7632,-6.0013,-5.0492,-7.3792,-15.86,0.7456,1.412,4.2294,
  3.2543,0.8545,-2.3887,-8.1115,-3.6018,4.9714,7.0361,-1.1958,2.6266,2.9493,-2.6336,3.0711,
  -0.1732,-5.8434,12.2751,4.6936,7.484,0.4793,-5.4885,-0.3453,-5.5319,5.3933,-12.9649,0.1041,
  2.976,-5.6183,8.2132,-3.3768,-5.1369,-1.1177,5.7431,1.9547,4.1666,4.098,0.2029,8.8106,
  4.7005,0.5672,-1.9727,7.5064,3.0334,-9.1003,11.5659,5.1254,5.0281,0.069,4.8664,12.5626,
  10.6498,-0.0477,-5.6857,6.3858,-3.4954,-7.2689,6.6166,4.961,2.7764,-3.4192,0.3429,0.6857,
  1.3001,-1.9498,3.4195,-4.0038,2.686,3.3681,-0.1708,0.3016,-2.1209,-1.9806,6.0728,1.7248,
  3.8294,1.8288,-2.0104,-1.1389,0.7182,-3.9993,1.4679,-6.3057,-2.2839,3.1846,1.2851,-2.7507,
  8.2521,1.4458,2.2403,0.3092,5.0968,1.3936,9.1171,-0.9026,4.6729,-0.7163,9.6779,11.4234,
  2.3036,4.6612,0.6744,2.644,0.408,3.5391,1.3722,0.2592,-0.3405,-1.213,5.2563,2.5341,
  -1.7564,2.4771,5.1751,0.1164,-4.5586,1.3503,3.4489,-2.1297,-2.1458,0.4204,2.2152,2.1708,
  2.0537,-2.7225,2.2856,2.2715,1.7595,0.7265,0.4311,-5.2109,-5.0233,-8.2717,1.1037,-5.8957,
  11.926,-0.49,3.112,4.3078,4.2901,2.9522,7.1373,3.1805,7.7016,3.0315,4.1107,3.8486,
  5.6119,2.8743,1.7344,2.1065,1.3418,1.8411,3.5658,-1.9732,-4.1067,1.262,0.6321,2.1183,
  -2.9912,0.6531,-3.7505,-2.9735,2.5542,1.5629,-1.3578,4.176,-6.002,-2.7753,3.1169,2.401,
  9.4694,7.4536,5.7396,2.4132,4.819,-5.499,1.3374,1.097,-3.3141,0.2788,4.7377,0.3185,
  2.2588,1.7942,-0.5658,-6.8415,-9.4814,-7.0685,6.5771,2.5209,-6.1043,-2.0426,14.1414,-2.1185,
  9.7775,-0.1251,2.4629,4.9078,5.4099,-1.9054,-1.1716,5.8206,-2.0676,2.7412,-0.2705,0.1812,
  3.879,4.0979,5.1497,-1.4805,2.0793,2.0348,2.6349,-1.2893,3.579,2.32,-0.0094,-1.4481,
  6.5866,4.1917,1.5126,5.2849,-1.3247,-8.6234,4.1223,5.0617,3.803,6.3737,4.7078,4.8627,
  6.9166,3.4164,-2.2547,5.8245,-10.3469,-0.0465,-0.7015,-10.4868,-1.4482,-0.1382,2.4133,0.9273,
  17.5183,3.1071,5.6003,3.4153,-2.2857,7.9938,10.4014,0.4603,4.6461,-3.4128,-0.8761,8.0996,
  3.5254,-5.0257,-0.5195,13.232,8.7068,1.5001,0.2387,4.7453,6.4462,1.3378,6.7665,-1.0389,
  -0.7167,-7.6269,3.2525,1.2622,-0.1112,-10.9702,-7.4344,3.8287,-2.7652,7.268,-6.4574,-6.3597,
  -2.2612,6.2483,0.1912,-11.2906,-8.1599,-6.0966,6.771,6.9145,9.4485,-4.1177,2.6305,9.2411,
  12.7744,2.2959,4.6852,3.4681,-5.0099,-2.3642,-5.9499,6.5203,-2.0369,-6.5731,-3.9833,12.1314,
  10.3472,2.6374,-0.4566,0.4767,-2.6749,-3.1227,-2.1148,2.6006,-3.1779,-1.1508,6.4213,-2.305,
  -3.6643,-5.8529,-1.2461,-4.9989,-7.4077,-2.7099,9.0446,-4.0413,8.533,0.8956,-16.147,-1.4542,
  13.8007,1.9282,0.4541,-3.5822,-6.8872,-1.1415,-3.0654,-7.3743,-7.46,8.0104,-5.5914,-7.6126,
  30.5559,3.7207,8.3486,3.1393,6.9734,6.3207,-2.5385,-6.5818,-3.5465,1.9756,3.7761,-0.8652,
  24.851,12.1275,1.8129,-1.3028,-3.4759,3.8534,0.7199,-1.4108,2.3287,-2.1394,3.903,10.1621,
  3.0833,-0.0111,0.2349,2.4117,0.616,6.8601,0.4458,-1.5258,0.9116,-1.8721,8.0148,1.5843,
  -1.1018,2.475,7.0626,7.1586,5.7948,0.3872,6.0064,8.4768,-0.6398,-18.8107,4.4664,1.9786,
  9.5218,-1.9379,8.5328,3.3135,-0.4329,6.0467,3.1825,7.3189,-1.0671,-11.4225,6.8615,5.0725,
  8.5159,-2.7072,-17.4948,6.0807,8.0593,4.3049,7.1822,3.7824,1.0692,2.8012,2.981,-1.1717,
  2.1547,2.5971,7.6698,3.6383,1.6969,1.3943,-1.515,-4.8094,-4.9564,5.8014,4.5525,-1.4481,
  -0.8403,-0.7474,1.5557,4.0179,-1.4859,-1.2973,-1.0157,8.0634,5.0767,11.7911,9.2224,0.6494,
  5.0581,6.979,6.1907,7.4204,5.1106,2.4692,1.2254,-0.3309,3.925,-2.2163,4.3157,0.2822,
  2.0497,-3.495,2.3377,-0.0496,-4.3948,1.04,-3.3759,9.3955,2.1749,0.2288,0.1047,1.8887,
  9.0344,1.4572,1.1902,1.5356,3.2257,2.1822,1.182,0.2684,-4.2507,3.3837,6.2683,3.1477,
  2.4964,7.0603,5.3229,0.4786,3.3126,1.8378,-5.9155,4.4528,-4.6342,1.6793,0.5379,-1.911,
  9.2023,5.0916,3.7428,-3.6084,0.7364,3.8037,5.7371,2.8311,-1.3685,-27.8776,-3.5039,4.5259,
  6.1895,7.2863,3.2021,2.2978,-0.214,6.043,0.22,-1.3076,2.4967,0.5492,-2.5142,2.7017,
  5.3347,1.3926,3.4831,3.809,3.775,-0.0608,3.3417,2.6173,-0.7721,-6.3962,-0.0329,-0.2988,
  -7.7711,2.1833,2.2177,-4.3754,4.2551,-0.0995,-4.2588,-11.2483,-8.4176,-6.1204,5.1913,2.8451,
  8.0089,11.3003,6.5794,1.6453,2.7529,-4.1939,3.0325,4.3252,-1.151,1.7781,-5.5204,7.3657,
  10.6665,7.1323,-0.7332,-0.9764,2.3606,-2.7897,3.7678,-2.6879,1.5623,1.9434,6.6558,5.0322,
  6.3194,1.0808,3.5948,-2.5057,3.1505,1.3379,2.159,3.5225,2.6096,2.6117,-2.4946,2.4128,
  4.8245,-1.0851,-4.2512,1.3617,0.2005,-1.7469,2.1871,3.931,-0.0132,-1.5113,-3.6213,1.5548,
  0.9093,4.2075,1.2685,3.2939,2.9581,4.2966,4.9005,3.8753,1.6863,-3.7872,3.6374,2.2684,
  0.6717,2.781,2.6303,4.5661,5.3541,-2.3488,-5.4673,4.4704,3.2911,1.0103,3.93,2.2594,
  2.8544,1.2256,-1.807,-0.4687,8.3552,6.8454,5.5021,2.899,8.1805,-1.8702,0.4635,2.3639,
  -1.1307,6.7893,4.5898,2.2201,-2.441,-0.1467,-7.3451,-18.5466,3.6687,3.1723,5.527,2.6778,
  1.0609,-8.4062,-2.6941,9.0077,3.7472,6.3032,-1.1142,-3.4068,-2.8035,-2.7262,4.3606,6.5485,
  0.3652,13.1314,-1.2937,-4.1515,-5.0754,8.6625,1.8414,6.5605,-0.4695,-1.6065,-2.8444,8.5925,
  6.82,-0.1345,-1.5294,5.0014,6.3753,3.1245,-1.1586,-1.3838,-14.1084,4.7974,8.9081,6.7554,
  3.2629,-0.995,9.7339,4.1434,-2.6905,-2.3608,-15.0336,-0.5765,-7.1947,0.6932,7.7653,-3.6914,
  -1.2497,-3.6807,1.1439,9.6399,10.8144,3.5259,6.2041,5.8965,0.9479,10.8227,4.6092,3.0046,
  7.1538,0.3121,0.3795,-6.1856,0.6909,4.4168,-5.1777,-0.6785,3.6713,1.1972,8.7983,3.689,
  -2.5637,2.5944,-1.504,-5.7657,5.753,4.6987,5.9692,-1.244,0.2652,-2.2493,3.9882,-0.3192,
  8.1688,-0.5966,5.2439,0.8245,-4.1166,-0.0397,-2.1049,2.4923,1.3113,4.6084,2.6157,1.9703,
  1.8746,-0.9698,0.2683,0.9131,3.0877,-1.6674,-8.2447,-0.7386,0.0615,0.1342,-7.8909,-0.9025,
  -3.8009,-3.9374,0.2864,1.3714,2.9478,-8.7816,5.0635,6.7736,-7.1655,-20.0909,-14.3764,5.3835,
  -15.8576,-14.7893,10.852,18.3841,2.7828,0.5823,13.2865,8.0971,7.5823,-9.2954,3.9928,8.4145,
  -2.7174,7.4479,8.9415,9.2553,-10.3799,-10.9297,7.1319,-8.5733,10.9241,3.6171,3.2453,9.3338,
  0.4118,5.5048,1.4147,1.0301,-3.201,-1.8739,-3.0241,-9.6096,-10.2858,12.7026,-0.2062,1.1913,
  5.7847,2.8792,3.1575,-0.8066,-5.992,4.7247,-1.7068,3.6947,4.0943,-0.8325,0.8113,4.4895,
  5.8456,1.3603,4.5371,-0.109,5.337,-0.1645,7.8666,-3.8317,5.6076,3.9547,4.4652,1.889,
  -3.6779,5.1794,1.3297,-2.6802,0.076,4.4411,-5.4068,4.4588,-6.4667,5.1491,-1.0462,3.2203,
  -5.1742,5.1776,1.1958,-0.6868,0.9509,0.6348,-5.6538,-3.3119,-4.7033,5.7143,3.6356,-6.7883,
  -6.9385,0.3672,8.4056,3.8426,0.5333,-0.0494,5.7207,3.2584,1.6961,-3.0215,14.9336,4.4654,
  -0.6869,0.2892,-0.6877,0.6439,-3.7997,3.3905,0.6084,-2.3949,8.3321,0.9564,2.609,-0.0086,
  1.7317,-3.7691,1.9093,2.3296,5.7217,0.5879,1.0789,2.3459,-2.8169,-9.1622,0.9389,-12.6404,
  10.9497,3.6065,-4.3175,3.2808,-9.8601,6.3386,-0.5672,-8.1016,5.5824,0.6561,3.451,4.8009,
  -8.1554,-9.9621,-27.8606,15.6046,4.0385,3.5395,2.5213,5.379,-5.8077,6.1986,19.6377,8.4115,
  10.5172,9.3476,7.1991,1.2146,6.0539,-1.3579,-3.6443,2.8112,0.3737,3.7721,-3.6708,4.4662,
  -0.9903,2.1431,0.5473,-5.5853,4.0799,-11.2006,8.7845,-2.3389,-9.8245,13.8038,2.5889,-5.5393,
  8.1888,-1.7617,-9.3994,-2.6426,-4.3546,8.2166,9.167,-5.4194,-6.07,-6.1687,10.4042,15.2717,
  -5.102,2.3798,3.676,-6.3135,4.2676,-1.727,13.0269,-2.2353,-0.1132,-1.0417,11.2187,-7.1094,
  1.9118,-3.5186,-6.3221,-4.4015,5.3216,4.6811,2.0821,9.1109,0.7802,-1.5645,3.5508,0.3878
];
/* The latest reading, to set today's market against the record. */
export var CAPE_NOW = 41.0, CAPE_NOW_ASOF = "30 September 2026";

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
   2026 bend points; taxable maximum matches the FICA wage base. */
export var SS_BEND1 = 1286;
export var SS_BEND2 = 7749;
export var SS_CAP = 184500;
export var SS_FRA = 67;

/**
 * @param {number} income - annual income, in dollars
 * @param {number} careerYears - years worked at this income (capped at 35, the number Social Security averages over)
 * @param {number} claimAge - age benefits start, 62-70
 * @returns {{aime: number, pia: number, adjustment: number, monthly: number, annual: number, atFRA: number, fra: number}}
 */
export function ssEstimate(income, careerYears, claimAge) {
  var capped = Math.min(Math.max(0, income), SS_CAP);
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
   The Healthcare Cost Planner's 2026 tables, here in the engine because the
   Early Retirement Bridge and the retirement plan engine price health
   insurance before Medicare with them too. */
// Federal poverty level for 2026 coverage. Premium tax credits run a year
// behind, so 2026 plans are priced against the 2025 HHS poverty guidelines:
// $15,650 for one person plus $5,500 for each additional person, contiguous
// 48 states and DC. Alaska and Hawaii are higher; this uses the 48-state line.
export var HC_FPL_BASE = [0,15650,21150,26650,32150,37650,43150,48650,54150];
export var HC_FPL_PER_ADDL = 5500;

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

// 2026 average benchmark premium (second-lowest-cost Silver) for a 40-year-old,
// monthly, by state. Source: KFF, Marketplace Average Benchmark Premiums, 2026
// (US average $625, up from $497 in 2025). Averages across each state's rating
// areas; a county quote can differ a lot. Scaled by the HHS age multiplier.
export var HC_STATE_PREMIUM_40 = {
  AL:645,AK:1032,AZ:532,AR:774,CA:570,CO:557,CT:870,DC:610,
  DE:691,FL:683,GA:615,HI:541,ID:490,IL:646,IN:474,IA:501,
  KS:670,KY:590,LA:646,ME:709,MD:414,MA:494,MI:523,MN:448,
  MS:662,MO:605,MT:692,NE:710,NV:497,NH:401,NJ:545,NM:623,
  NY:817,NC:638,ND:570,OH:513,OK:604,OR:543,PA:572,RI:506,
  SC:564,SD:655,TN:711,TX:661,UT:640,VT:1299,VA:455,WA:612,
  WV:1073,WI:611,WY:1090
};

export function hcFPL(size){
  size = Math.max(1, Math.round(size));
  if (size <= 8) return HC_FPL_BASE[size];
  return HC_FPL_BASE[8] + (size - 8) * HC_FPL_PER_ADDL;
}

export function hcAgeMultiplier(age){
  age = Math.max(21, Math.min(64, Math.round(age)));
  return HC_AGE_MULT[age - 21];
}

// Gross monthly benchmark Silver premium for given state & age
export function hcGrossPremium(state, age, manualOverride){
  if (manualOverride > 0) return manualOverride;
  var base = HC_STATE_PREMIUM_40[state] || 500;
  return base / HC_AGE40_MULT * hcAgeMultiplier(age);
}

// Standard ACA contribution % of income for 2026: the applicable percentage
// table in Rev. Proc. 2025-25, with the 400% FPL cliff. These are the rules in
// force for 2026, since the enhanced credits expired at the end of 2025.
// Returns null when income is too high for subsidy.
export function hcContribPctStd(pctFPL){
  if (pctFPL < 1.0) return 0;
  if (pctFPL > 4.0) return null;
  if (pctFPL < 1.33) return 0.0210;
  if (pctFPL < 1.50) return 0.0314 + (pctFPL - 1.33) / 0.17 * (0.0419 - 0.0314);
  if (pctFPL < 2.00) return 0.0419 + (pctFPL - 1.50) / 0.50 * (0.0660 - 0.0419);
  if (pctFPL < 2.50) return 0.0660 + (pctFPL - 2.00) / 0.50 * (0.0844 - 0.0660);
  if (pctFPL < 3.00) return 0.0844 + (pctFPL - 2.50) / 0.50 * (0.0996 - 0.0844);
  return 0.0996;
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
