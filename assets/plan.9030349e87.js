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

const PPY = {"Weekly":52,"Bi-Weekly":26,"Monthly":12,"Quarterly":4,"Annually":1};

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
function glideAnnualRate(yearNo, totalYears, glideYears, startRate, endRate){
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
function fvFactors(p, years, periods){
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
function project(p){
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
function goalSolve(p, solveFor, target){
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
function solveYears(p, portToday, capYears){
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
function seriesSnaps(stages){
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
function fillWholeYears(pts, copy){
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
function projectSeries(g, stages){
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
function mulberry32(a){
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gaussFrom(rng){
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/* Returns are drawn lognormally, so a draw can never lose more than the whole
   balance and compounding stays well behaved. Parameters are chosen so the
   expected annual return equals the rate entered, which means volatility 0
   reproduces the deterministic projection exactly. */
function lognormalParams(mu, sigma, ppy){
  const s2 = Math.log(1 + (sigma * sigma) / Math.pow(1 + mu, 2));
  return {m: (Math.log(1 + mu) - s2 / 2) / ppy, s: Math.sqrt(s2 / ppy)};
}
function pctl(sorted, q){
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
function monteCarlo(g, stages, trials, seed){
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
function coastFire(p, targetFuture){
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
function balanceBeforeLast(g, stages){
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
function finalStageSolve(g, stages, portToday){
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
const FED_2026 = {
  s: [[0,.10],[12400,.12],[50400,.22],[105700,.24],[201775,.32],[256225,.35],[640600,.37]],
  m: [[0,.10],[24800,.12],[100800,.22],[211400,.24],[403550,.32],[512450,.35],[768700,.37]]
};
const FED_STD = {s:16100, m:32200};
const FICA = {ssRate:.062, ssCap:184500, medRate:.0145, addlRate:.009,
              addlThreshold:{s:200000, m:250000}};

/* ---------- retirement-specific 2026 data ----------
   Long-term capital gain / qualified dividend breakpoints are the maximum
   zero-rate and maximum 15% amounts from IRS Rev. Proc. 2025-32 sec. 3.03,
   stated as taxable income including the gain. Above the second figure the
   rate is 20%. */
const LTCG_2026 = {s:[49450, 545500], m:[98900, 613700]};

/* IRC sec. 1411. The thresholds are statutory and have never been indexed. */
const NIIT = {rate:.038, threshold:{s:200000, m:250000}};

/* Two separate age-65 benefits stack in 2026:
   - the long-standing additional standard deduction (Rev. Proc. 2025-32),
     $2,050 for a single filer, $1,650 per qualifying spouse on a joint
     return. Standard-deduction filers only.
   - the OBBBA sec. 70103 "senior deduction", $6,000 per qualifying person for
     tax years 2025-2028, available to itemizers too, reduced by 6% of MAGI
     above $75,000 single / $150,000 joint. */
const SENIOR_ADDL = {s:2050, m:1650};
const SENIOR_BONUS = {amount:6000, rate:.06, start:{s:75000, m:150000}};

/* IRC sec. 86. Provisional income = AGI + tax-exempt interest + half of
   benefits. Between the two thresholds up to 50% of benefits become taxable;
   above the second, up to 85%. Neither figure has ever been indexed. */
const SS_PROV = {t1:{s:25000, m:32000}, t2:{s:34000, m:44000}};

/* States that still include any Social Security in taxable income for 2026.
   Every other state, plus DC, fully exempts benefits. West Virginia completed
   its phase-out effective tax year 2026; Missouri, Kansas and Nebraska
   dropped off in earlier years. Each of these eight has its own income-based
   exemption that this does not model — see the About tab. Colorado is the one
   exception handled here, because its subtraction is a clean full exemption
   at 65 and over. */
const SS_TAX_STATES = {CO:1, CT:1, MN:1, MT:1, NM:1, RI:1, UT:1, VT:1};
const MORT_RATE_ASOF = "Freddie Mac weekly average, 3 September 2026";
const MORT_RATE_30 = 6.71;

/* sd/pe: [single, married]. pec = exemption delivered as a credit instead.
   sdc = standard deduction delivered as a credit. */
const STATES = {
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
function bracketTax(income, brackets){
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
function marginalRate(income, brackets){
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
const RET_STATE = {
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
function stateRetireTax(S, c){
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
function computeTax(inp){
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
function ssTaxable(ss, otherAgi, st){
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
function computeRetireTax(inp){
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
const ULT = {72:27.4, 73:26.5, 74:25.5, 75:24.6, 76:23.7, 77:22.9, 78:22.0,
  79:21.1, 80:20.2, 81:19.4, 82:18.5, 83:17.7, 84:16.8, 85:16.0, 86:15.2,
  87:14.4, 88:13.7, 89:12.9, 90:12.2, 91:11.5, 92:10.8, 93:10.1, 94:9.5,
  95:8.9, 96:8.4, 97:7.8, 98:7.3, 99:6.8, 100:6.4};
function ultDivisor(age){
  if (age < 72) return 0;
  if (age >= 100) return 6.4;
  return ULT[age] || 0;
}
/* SECURE 2.0: age 73 for those born 1951-1959, age 75 for 1960 and later. */
function rmdStartAge(currentAge){
  return (2026 - currentAge) >= 1960 ? 75 : 73;
}

/* 2026 Medicare IRMAA. Standard Part B is $202.90/month; higher brackets pay a
   multiple of it, plus a flat Part D surcharge. Source: CMS 2026 Parts A & B
   premiums fact sheet. The brackets are cliffs, not phase-ins -- one dollar
   over a line costs the whole tier -- and they run on a two-year lookback, so
   a conversion today sets the premium two years out. */
const IRMAA = {
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
function irmaaTier(magi, status){
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
function irmaaAnnual(magi, status, people){
  if (people <= 0) return 0;
  const t = IRMAA.tiers[irmaaTier(magi, status)];
  return (t.b - IRMAA.partB + t.partD) * 12 * people;
}
/* Top of a federal bracket = where the next one starts. */
/* How much more ordinary taxable income fits before crossing into the next
   federal bracket -- the room a Roth conversion or extra withdrawal has to
   work with before the marginal rate jumps. Null once already in the top
   bracket, since there's no next threshold to report. */
function bracketRoom(taxable, status){
  const b = FED_2026[status];
  let i = 0;
  for (let k = 0; k < b.length; k++) if (taxable > b[k][0]) i = k;
  if (i + 1 >= b.length) return null;
  return {room:b[i + 1][0] - taxable, nextRate:b[i + 1][1]};
}
function bracketTopFor(status, rate){
  const b = FED_2026[status];
  for (let i = 0; i < b.length; i++)
    if (Math.abs(b[i][1] - rate) < 1e-9)
      return (i + 1 < b.length) ? b[i + 1][0] : Infinity;
  return Infinity;
}

const RC_STRATS = {
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
function rcTax(o){
  return computeRetireTax(Object.assign({pre:0, dedType:"std", item:0,
    _noMarginal:true}, o));
}

/**
 * Largest conversion that keeps probe(conv) at or below zero. probe is
 * monotonically increasing in conv, so plain bisection settles it.
 */
function rcBisect(probe, maxConv){
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
function runRoth(inp, doConvert){
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
const DEBT_CAP = 720;    // 60 years; past this a plan is not a plan

/**
 * @param {Array} list - [{desc, balance, apr (percent), min}]
 * @param {number} extra - additional dollars per month, beyond the minimums
 * @param {"avalanche"|"snowball"|"min"} mode - avalanche targets the highest
 *   rate, snowball the smallest balance, min pays minimums with no rollover
 * @returns {Object|null} monthly series, per-debt detail and totals
 */
function debtRun(list, extra, mode){
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
function debtUnderwater(list){
  return (list || []).filter(x => x.balance > 0 &&
    x.min <= x.balance * (Math.max(0, x.apr) / 100) / 12);
}
function debtDate(monthsOut){
  const dt = new Date();
  dt.setDate(1);
  dt.setMonth(dt.getMonth() + Math.max(0, Math.round(monthsOut)));
  return dt.toLocaleDateString("en-US", {month:"short", year:"numeric"});
}
function debtDur(m){
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
function mortgage(m){
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
function refiCompare(m, refi){
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

var HIST_START = 1926;
/* Monthly total returns, January 1926 through December 2025 (1,200 months).
   Stocks: S&P 500 monthly price with that month's dividend reinvested.
   Bonds: 10-year Treasury, one month of coupon plus the price move implied
   by the change in yield. Inflation: CPI-U, month over month.
   Sources: Robert Shiller (Yale) via multpl for prices, yields and dividend
   yields; US BLS for CPI-U. Prices are monthly averages of daily closes,
   Shiller's convention — see the About tab. */
var HIST_M_STOCK = [
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
var HIST_M_BOND = [
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
var HIST_M_INFL = [
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
function histAnnual(m){
  var out = [], y, k, g;
  for (y = 0; y * 12 < m.length; y++){
    g = 1;
    for (k = 0; k < 12; k++) g *= (1 + m[y * 12 + k] / 100);
    out.push((g - 1) * 100);
  }
  return out;
}
var HIST_STOCK = histAnnual(HIST_M_STOCK);
var HIST_BOND = histAnnual(HIST_M_BOND);
var HIST_INFL = histAnnual(HIST_M_INFL);

/* Shiller's cyclically adjusted P/E (CAPE), January 1926 through December
   2025, one per month in step with the returns above: the month's S&P 500
   price over the average of the ten years of earnings before it, both after
   inflation. A high reading means stocks are dear against their earnings.
   Source: Robert Shiller (Yale), via multpl. */
var HIST_M_CAPE = [
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
/* The latest reading, to set today's market against the record. */
var CAPE_NOW = 41.0, CAPE_NOW_ASOF = "30 September 2026";

/* Spreadsheet PMT with payments at the start of each period (type 1): the
   level payment that takes pv down to fv over n periods at rate r. The
   drawdown engine (drawdown.js) and the plan engine both use it. */
function pmtStart(r, n, pv, fv){
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
var SS_BEND1 = 1286;
var SS_BEND2 = 7749;
var SS_CAP = 184500;
var SS_FRA = 67;

/**
 * @param {number} income - annual income, in dollars
 * @param {number} careerYears - years worked at this income (capped at 35, the number Social Security averages over)
 * @param {number} claimAge - age benefits start, 62-70
 * @returns {{aime: number, pia: number, adjustment: number, monthly: number, annual: number, atFRA: number, fra: number}}
 */
function ssEstimate(income, careerYears, claimAge) {
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
function ssSpousalAdj(claimAge) {
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
function ssDrawdownStreams(inc1, claim1, inc2, claim2, couple, retireAge, sharedDelay) {
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
function historicalRuns(g, stages){
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
/* A fixed stock/bond mix, rebalanced once a year, run across a slice of the
   historical record. Everything here is descriptive: no projection, no
   assumption, just what this mix did. */
/**
 * @param {Object} o - {stockPct, fee, initial, startYear, endYear}
 * @returns {Object} per-year rows, summary statistics and rolling-window tables
 */
function backtest(o){
  const avail = HIST_STOCK.length;
  let s0 = Math.round((o.startYear || HIST_START) - HIST_START);
  let s1 = Math.round((o.endYear || (HIST_START + avail - 1)) - HIST_START);
  s0 = Math.max(0, Math.min(avail - 1, s0));
  s1 = Math.max(s0, Math.min(avail - 1, s1));
  const w = Math.max(0, Math.min(1, (o.stockPct || 0) / 100));
  const fee = (o.fee || 0) / 100;
  const start = Math.max(1, o.initial || 10000);

  const rows = [], rets = [], reals = [];
  let bal = start, cum = 1, peak = start, maxDD = 0, ddFrom = 0, ddTo = 0;
  let curPeakYear = HIST_START + s0;
  for (let i = s0; i <= s1; i++){
    const r = (w * HIST_STOCK[i] + (1 - w) * HIST_BOND[i]) / 100 - fee;
    const infl = HIST_INFL[i] / 100;
    const real = (1 + r) / (1 + infl) - 1;
    bal = bal * (1 + r);
    cum *= (1 + infl);
    if (bal > peak){ peak = bal; curPeakYear = HIST_START + i; }
    const dd = peak > 0 ? bal / peak - 1 : 0;
    if (dd < maxDD){ maxDD = dd; ddFrom = curPeakYear; ddTo = HIST_START + i; }
    rets.push(r); reals.push(real);
    rows.push({year: HIST_START + i, stock: HIST_STOCK[i], bond: HIST_BOND[i],
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
          stockPct: w * 100, cagr, realCagr, inflCagr, vol,
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
var HC_FPL_BASE = [0,15650,21150,26650,32150,37650,43150,48650,54150];
var HC_FPL_PER_ADDL = 5500;

// Federal default standard age curve, ages 21-64 (21 = 1.000, 64+ = 3.000).
// CMS, "Final Guidance Regarding Age Curves and State Reporting", 16 Dec 2016,
// Appendix I; in force for plan years 2018 on. A handful of states (and DC)
// set their own curve, which runs somewhat flatter.
var HC_AGE_MULT = [
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
var HC_AGE40_MULT = 1.278; // index 19 = age 40 - 21

// 2026 average benchmark premium (second-lowest-cost Silver) for a 40-year-old,
// monthly, by state. Source: KFF, Marketplace Average Benchmark Premiums, 2026
// (US average $625, up from $497 in 2025). Averages across each state's rating
// areas; a county quote can differ a lot. Scaled by the HHS age multiplier.
var HC_STATE_PREMIUM_40 = {
  AL:645,AK:1032,AZ:532,AR:774,CA:570,CO:557,CT:870,DC:610,
  DE:691,FL:683,GA:615,HI:541,ID:490,IL:646,IN:474,IA:501,
  KS:670,KY:590,LA:646,ME:709,MD:414,MA:494,MI:523,MN:448,
  MS:662,MO:605,MT:692,NE:710,NV:497,NH:401,NJ:545,NM:623,
  NY:817,NC:638,ND:570,OH:513,OK:604,OR:543,PA:572,RI:506,
  SC:564,SD:655,TN:711,TX:661,UT:640,VT:1299,VA:455,WA:612,
  WV:1073,WI:611,WY:1090
};

function hcFPL(size){
  size = Math.max(1, Math.round(size));
  if (size <= 8) return HC_FPL_BASE[size];
  return HC_FPL_BASE[8] + (size - 8) * HC_FPL_PER_ADDL;
}

function hcAgeMultiplier(age){
  age = Math.max(21, Math.min(64, Math.round(age)));
  return HC_AGE_MULT[age - 21];
}

// Gross monthly benchmark Silver premium for given state & age
function hcGrossPremium(state, age, manualOverride){
  if (manualOverride > 0) return manualOverride;
  var base = HC_STATE_PREMIUM_40[state] || 500;
  return base / HC_AGE40_MULT * hcAgeMultiplier(age);
}

// Standard ACA contribution % of income for 2026: the applicable percentage
// table in Rev. Proc. 2025-25, with the 400% FPL cliff. These are the rules in
// force for 2026, since the enhanced credits expired at the end of 2025.
// Returns null when income is too high for subsidy.
function hcContribPctStd(pctFPL){
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
function hcContribPctEnhanced(pctFPL){
  if (pctFPL < 1.0) return 0;
  if (pctFPL < 1.50) return 0;
  if (pctFPL < 2.00) return (pctFPL - 1.50) / 0.50 * 0.020;
  if (pctFPL < 2.50) return 0.020 + (pctFPL - 2.00) / 0.50 * 0.020;
  if (pctFPL < 3.00) return 0.040 + (pctFPL - 2.50) / 0.50 * 0.020;
  if (pctFPL < 4.00) return 0.060 + (pctFPL - 3.00) / 1.00 * 0.025;
  return 0.085;
}

// Returns {credit, net, eligible, pct} — monthly figures
function hcCalcACA(income, grossPremium, pctFPL, enhanced){
  var pct = enhanced ? hcContribPctEnhanced(pctFPL) : hcContribPctStd(pctFPL);
  if (pct === null) return {credit:0, net:grossPremium, eligible:false, pct:0};
  var maxContrib = income * pct / 12;
  var credit = Math.max(0, grossPremium - maxContrib);
  var net = Math.max(0, grossPremium - credit);
  return {credit:credit, net:net, eligible:true, pct:pct};
}


// ===MATH END===

if (typeof module !== "undefined")
  module.exports = {PPY, project, goalSolve, solveYears, projectSeries, fvFactors, glideAnnualRate,
                    monteCarlo, lognormalParams, mulberry32, coastFire, computeTax,
                    mortgage, STATES, FED_2026, FED_STD, FICA,
                    computeRetireTax, ssTaxable, LTCG_2026, NIIT,
                    SENIOR_ADDL, SENIOR_BONUS, SS_PROV, SS_TAX_STATES,
                    RET_STATE, stateRetireTax,
                    finalStageSolve, balanceBeforeLast,
                    historicalRuns, backtest,
                    HIST_STOCK, HIST_BOND, HIST_INFL, HIST_START,
                    HIST_M_STOCK, HIST_M_BOND, HIST_M_INFL, HIST_M_CAPE};
;
// ===DRAWDOWN START===
/* ---------- the Drawdown Simulator's engine ----------
   One retirement, year by year (runDrawdown), through every historical start
   (historicalBacktest) or thousands of random ones (monteCarloDrawdown), and
   the searches the simulator runs on top of them: the most a strategy can
   spend for a given risk, the safe rate for every start, the success grid,
   the two solvers and the strategy showdown.

   Each withdrawal strategy is one entry in DD_STRAT: its family, its yearly
   rule and its dial, the one setting that decides how much it spends (the
   starting rate, for most). The page adds each strategy's fields; the
   searches here only ever turn the dial.

   The conventions are Bengen's and the Trinity study's: a year's spending
   comes out on its first day, priced at that day's price level; the rest
   earns the year's stock and bond returns, rebalanced to the mix once a year,
   less fees; and the closing balance is deflated by the year's inflation.
   Everything reported is in today's dollars. */

/* ---- history, a year at a time from any month ----
   The year that starts in each month of the record, its twelve monthly
   returns compounded, in percent: index i is the year from month i (0 is
   January 1926). Each January's is the calendar year, worked exactly as
   histAnnual() works it, so a retirement that starts in January sees the
   same numbers either way. */
function histYearFrom(m){
  var out = [], i, k, g;
  for (i = 0; i + 12 <= m.length; i++){
    g = 1;
    for (k = 0; k < 12; k++) g *= (1 + m[i + k] / 100);
    out.push((g - 1) * 100);
  }
  return out;
}
var HIST_Y12_STOCK = histYearFrom(HIST_M_STOCK);
var HIST_Y12_BOND = histYearFrom(HIST_M_BOND);
var HIST_Y12_INFL = histYearFrom(HIST_M_INFL);

/* The first start year a test uses, as an index into the annual series. */
function ddFromIdx(o){
  var n = HIST_STOCK.length;
  return Math.max(0, Math.min(n - 1, Math.round((o.fromYear || HIST_START) - HIST_START)));
}
/* Every retirement the historical test runs: one starting each January, or
   with o.monthly one starting every month, from o.fromYear on, each with a
   full o.years of data after it. Each is {i (its first month), year, month,
   seq}, seq being what runDrawdown takes: one {stock, bond, infl, cape} per
   year. They don't depend on the plan, so they're kept for reuse. */
var ddWinMemo = {}, ddWinKeys = [];
function ddWindows(o){
  var years = o.years, from = ddFromIdx(o), step = o.monthly ? 1 : 12;
  var key = years + "|" + step + "|" + from;
  if (ddWinMemo[key]) return ddWinMemo[key];
  var M = HIST_M_STOCK.length, out = [];
  for (var i = from * 12; i + 12 * years <= M; i += step){
    var seq = [];
    for (var k = 0; k < years; k++){
      var j = i + 12 * k;
      seq.push({stock: HIST_Y12_STOCK[j], bond: HIST_Y12_BOND[j], infl: HIST_Y12_INFL[j],
        cape: HIST_M_CAPE[j]});
    }
    out.push({i: i, year: HIST_START + Math.floor(i / 12), month: i % 12 + 1, seq: seq});
  }
  ddWinKeys.push(key);
  if (ddWinKeys.length > 24) delete ddWinMemo[ddWinKeys.shift()];
  return (ddWinMemo[key] = out);
}

/* ---- income and expenses beyond Social Security ---- */
/**
 * Only enabled items (item.on !== false) are ever considered active.
 * @param {CustomItem[]} items
 * @param {number} year - 1-based year, matching runDrawdown's row numbering
 * @returns {CustomItem[]} the items active in this year
 */
function itemsActiveThisYear(items, year) {
  if (!items || !items.length) return [];
  return items.filter(function (it) {
    if (it.on === false) return false;
    var start = Math.max(1, Math.round(it.startYear || 1));
    if (year < start) return false;
    if (it.duration.type === "once") return year === start;
    if (it.duration.type === "years") return year < start + Math.max(1, Math.round(it.duration.years));
    return true; // forever
  });
}
/**
 * Matches how the base withdrawal and Social Security are inflated: the
 * stated annual figure is in today's dollars, and gets the same amount of
 * inflation applied as everything else by the year it's actually paid.
 * One that doesn't rise with inflation is paid at its stated figure.
 * @param {CustomItem} it
 * @param {number} year - 1-based year this amount is being paid
 * @param {number} cumInfl - price level at the start of this year (1 in year 1)
 * @returns {number} this item's dollar amount for this year
 */
function itemAmount(it, year, cumInfl) {
  if (!it.inflate) return it.annual;
  return it.annual * cumInfl;
}

/* ---- the spending path ----
   How the plan means its spending to move with age, as a multiplier on each
   year's spending (1 in year one). "flat" keeps it level in today's dollars;
   "ease" lowers it by a set share a year; "smile" follows David Blanchett's
   2014 estimate of how retirees' real spending actually changes, by age and
   by how much they spend: falling through the 70s, then rising again late;
   "stages" moves it to a share of year one's level from a given year. Every
   strategy works out its own spending as usual and the path then shapes it,
   so it can't compound into the strategy's memory of last year. */
function ddBlanchett(age, spend){
  return 0.00008 * age * age - 0.0125 * age - 0.0066 * Math.log(Math.max(1, spend)) + 0.546;
}
function ddPath(o, firstSpend){
  var n = o.years, m = [], i, kind = o.path || "flat";
  for (i = 0; i < n; i++) m.push(1);
  if (kind === "ease"){
    var e = Math.max(-50, Math.min(50, o.pathEase || 0)) / 100;
    for (i = 1; i < n; i++) m[i] = m[i - 1] * (1 - e);
  } else if (kind === "smile"){
    var age0 = o.retireAge != null ? o.retireAge : 65;
    for (i = 1; i < n; i++)
      m[i] = m[i - 1] * (1 + Math.max(-.05, Math.min(.05, ddBlanchett(age0 + i - 1, firstSpend * m[i - 1]))));
  } else if (kind === "stages"){
    var st = ddStageOrder(o.pathStages);
    for (i = 0; i < n; i++){
      var lv = 1;
      for (var k = 0; k < st.length; k++) if (st[k].start <= i + 1) lv = st[k].level;
      m[i] = lv;
    }
  }
  return m;
}
/* Stages in the order they take effect: each from its 1-based year, at a
   share of year one's spending. Year one always belongs to the plan's own
   level, and when two begin the same year the later one in the list wins. */
function ddStageOrder(list){
  return (list || []).map(function (x, k) {
    return {start: Math.max(2, Math.round(x.start || 0)), level: Math.max(0, +x.level || 0) / 100, k: k};
  }).sort(function (a, b) { return a.start - b.start || a.k - b.k; });
}
/* Spending stages saved before the spending path existed belonged to the
   fixed strategy only, each a withdrawal rate of the starting portfolio from
   its year. As a path, each becomes that rate's share of the starting rate. */
function ddStagesFromRates(wd, rate){
  if (!(rate > 0)) return [];
  return (wd || []).map(function (x) {
    var out = {start: Math.max(2, Math.round(x.start || 0)), level: Math.round((x.rate || 0) / rate * 1e6) / 1e4};
    if (x.name) out.name = x.name;
    return out;
  });
}

/* ---- guaranteed income ----
   Part of the portfolio can buy income at retirement: a TIPS ladder, paying
   the same real amount every year to the end of the plan (the level payment
   its real yield allows), or an annuity at a payout rate, level in dollars
   unless it has inflation raises. The rest of the portfolio runs the
   strategy, and this income comes on top of what the strategy spends. */
function ddGuaranteed(o){
  var share = Math.min(100, Math.max(0, o.gShare || 0)) / 100;
  if (!(share > 0) || !(o.initial > 0)) return {share: 0, income: 0, real: true, rate: 0};
  var tips = o.gType !== "annuity";
  var rate = tips ? pmtStart((o.gYield || 0) / 100, o.years, 1, 0) : Math.max(0, o.gPayout || 0) / 100;
  return {share: share, income: o.initial * share * rate, real: tips || !!o.gInflate, rate: rate};
}

/* The RMD method's divisor: the IRS Uniform Lifetime Table from 72, and
   below it the table's own trend carried down, about 0.9 a year. */
function ddRmdDivisor(age){
  if (age >= 72) return ultDivisor(Math.min(100, Math.floor(age)));
  return 27.4 + (72 - age) * .9;
}

/* ---- risk-based guardrails ----
   The chance a plan lasts, from history: for each start, the most that could
   have been taken every year, in today's dollars, as a share of the starting
   balance, and still lasted L years. With growth factors g, that's
   1 / (1 + 1/g0 + 1/(g0 g1) + ...), L terms. byL[L] holds them sorted, so the
   share at or above a rate is the chance that rate lasts L years, at this
   stock mix and these fees. The guardrail checks use the starts the test
   itself uses, every January or every month. */
var ddRiskMemo = {}, ddRiskKeys = [];
function ddRiskTable(o){
  var step = o.monthly ? 1 : 12, from = ddFromIdx(o);
  var w = Math.min(100, Math.max(0, o.stockPct)) / 100;
  var fee = (o.fee || 0) / 100 + (o.returnDrag || 0) / 100;
  var key = step + "|" + from + "|" + w + "|" + fee;
  if (ddRiskMemo[key]) return ddRiskMemo[key];
  var N = HIST_Y12_STOCK.length, maxL = 100, byL = [], L;
  for (L = 0; L <= maxL; L++) byL.push([]);
  for (var i = from * 12; i < N; i += step){
    var sum = 0, D = 1;
    for (L = 1; L <= maxL; L++){
      var j = i + 12 * (L - 1);
      if (j >= N) break;
      sum += D;
      byL[L].push(sum > 0 && isFinite(sum) ? 1 / sum : 0);
      var g = (1 + (w * HIST_Y12_STOCK[j] + (1 - w) * HIST_Y12_BOND[j]) / 100 - fee) / (1 + HIST_Y12_INFL[j] / 100);
      D = g > 0 ? D / g : Infinity;
    }
  }
  byL.forEach(function (a) { a.sort(function (p, q) { return p - q; }); });
  ddRiskKeys.push(key);
  if (ddRiskKeys.length > 12) delete ddRiskMemo[ddRiskKeys.shift()];
  return (ddRiskMemo[key] = {byL: byL});
}
function ddRiskRow(T, L){
  for (var k = Math.min(L, T.byL.length - 1); k > 0; k--) if (T.byL[k].length) return T.byL[k];
  return [];
}
/* The chance a level real withdrawal of `rate` (a share of today's balance)
   lasts L more years. */
function ddRiskP(T, rate, L){
  if (!(rate > 0)) return 1;
  var a = ddRiskRow(T, L), lo = 0, hi = a.length;
  if (!hi) return 0;
  while (lo < hi){ var mid = (lo + hi) >> 1; if (a[mid] < rate) lo = mid + 1; else hi = mid; }
  return (a.length - lo) / a.length;
}
/* The highest such rate with at least chance p of lasting L years. */
function ddRiskRate(T, p, L){
  var a = ddRiskRow(T, L);
  if (!a.length) return 0;
  return a[Math.min(a.length - 1, Math.max(0, Math.floor((1 - p) * a.length + 1e-9)))];
}
/* What's still to come, for the guardrail check, so the chance counts income
   that hasn't started yet, like Social Security at 70. Each is a present
   value at a 3% real rate from year y to the end: A of the spending path, B
   of Social Security and other income, C of extra expenses, each split into
   what rises with inflation (r) and what's fixed in dollars (n, divided by
   that year's price level when it's used, and taken to lose 3% a year to
   inflation after). f turns a present value back into a level yearly amount.
   Guaranteed income isn't here: it pays for spending of its own. */
function ddRiskCoef(o, path){
  var n = o.years, d = 1 / 1.03, dn = d / 1.03, y;
  var incR = [], incN = [], expR = [], expN = [];
  for (y = 0; y < n; y++){
    var r = 0, nn = 0;
    if (o.ssAnnual > 0 && y >= (o.ssDelayYears || 0)) r += o.ssAnnual;
    if (o.ssAnnual2 > 0 && y >= (o.ssDelayYears2 || 0)) r += o.ssAnnual2;
    if (o.ssAnnual3 > 0 && y >= (o.ssDelayYears3 || 0)) r += o.ssAnnual3;
    itemsActiveThisYear(o.incomeItems, y + 1).forEach(function (it) { if (it.inflate) r += it.annual; else nn += it.annual; });
    incR.push(r); incN.push(nn);
    var er = 0, en = 0;
    itemsActiveThisYear(o.expenseItems, y + 1).forEach(function (it) { if (it.inflate) er += it.annual; else en += it.annual; });
    expR.push(er); expN.push(en);
  }
  var A = [], Br = [], Bn = [], Cr = [], Cn = [], f = [];
  var a = 0, br = 0, bn = 0, cr = 0, cn = 0, ann = 0;
  for (y = n - 1; y >= 0; y--){
    a = path[y] + d * a; br = incR[y] + d * br; bn = incN[y] + dn * bn;
    cr = expR[y] + d * cr; cn = expN[y] + dn * cn; ann = 1 + d * ann;
    A[y] = a; Br[y] = br; Bn[y] = bn; Cr[y] = cr; Cn[y] = cn; f[y] = 1 / ann;
  }
  return {A: A, Br: Br, Bn: Bn, Cr: Cr, Cn: Cn, f: f};
}
function ddPct(v, def){ return Math.min(100, Math.max(0, v == null ? def : v)) / 100; }

/* ---- the strategies ----
   Each rule gets the year's state s and returns the strategy's own spending
   for the year, in that year's dollars, before the spending path, the
   minimum and maximum and any extra expenses. s.prevW is last year's figure
   on the same footing, s.baseW the starting rate on the invested portfolio,
   s.k a running real multiplier for the rules that step it, s.gain last
   year's real investment gain in today's dollars.

   family: how the picker groups it. dial: the setting that decides how much
   it spends, the range a search turns it through and which way is "more"
   (dir), and its step on the grid. byRate: year one is the rate on the
   portfolio, so a spending amount can be turned into a rate. spendsDown: an
   empty portfolio after the final year is the plan, not a failure.
   limits: the minimum and maximum spending apply. */
function ddFloorCeil(floorKey, ceilKey){
  return function (s) {
    var o = s.o, target = s.bal * o.initialPct / 100;
    var infAdj = s.y === 0 ? s.baseW : s.prevW * (1 + s.lastInfl);
    var floor = infAdj * (1 - o[floorKey] / 100);
    var ceil = infAdj * (1 + o[ceilKey] / 100);
    return Math.min(Math.max(target, floor), ceil);
  };
}
var DD_RATE_DIAL = {key: "initialPct", lo: .25, hi: 15, dir: 1, step: .25};
var DD_STRAT = {};
var DD_ORDER = [];
[
  /* The 4% rule's way: year one's amount, then the same plus inflation
     whatever markets do. Optionally skips the raise after a losing year. */
  {id: "fixed", family: "steady", dial: DD_RATE_DIAL, byRate: true, limits: false,
   rule: function (s) {
     if (s.y > 0 && s.o.skipRaise && s.lastRet < 0) s.k /= 1 + s.lastInfl;
     return s.baseW * s.k * s.cumInfl;
   }},
  /* Michael Kitces's ratchet: fixed spending that never falls, raised 10%
     whenever the portfolio is 50% above where it started after inflation,
     no more than once every three years. */
  {id: "kitces", family: "steady", dial: DD_RATE_DIAL, byRate: true,
   rule: function (s) {
     var o = s.o;
     if (s.y > 0){
       if (o.skipRaise && s.lastRet < 0) s.k /= 1 + s.lastInfl;
       if (s.bal / s.cumInfl >= s.initial * (1 + (o.kitThresh || 0) / 100) &&
           s.y - s.last >= Math.max(1, Math.round(o.kitGap || 0))){
         s.k *= 1 + (o.kitRaise || 0) / 100;
         s.last = s.y;
       }
     }
     return s.baseW * s.k * s.cumInfl;
   }},
  /* The same share of whatever the portfolio is worth each year. */
  {id: "pct", family: "share", dial: DD_RATE_DIAL, byRate: true,
   rule: function (s) { return s.bal * s.o.initialPct / 100; }},
  /* Bob Clyatt's 95% rule: a share of the portfolio, but never less than
     95% of last year's spending in dollars. */
  {id: "clyatt", family: "share", dial: DD_RATE_DIAL, byRate: true,
   rule: function (s) {
     var w = s.bal * s.o.initialPct / 100;
     return s.y === 0 ? w : Math.max(w, s.prevW * (s.o.clyFloor == null ? 95 : s.o.clyFloor) / 100);
   }},
  /* The balance divided by the years left: a tenth of it with ten to go,
     all of it in the last. */
  {id: "oneovern", family: "share", spendsDown: true,
   rule: function (s) { return s.bal / Math.max(1, s.years - s.y); }},
  /* The balance divided by the IRS life-expectancy divisor for your age, as
     required minimum distributions work. Takes 65 if no age is set. */
  {id: "rmd", family: "share",
   rule: function (s) { return s.bal / ddRmdDivisor(s.age != null ? s.age : 65 + s.y); }},
  /* Variable percentage withdrawal (Bogleheads): the payment that would draw
     the balance down to the future value over the years left, at the
     expected real return, paid at the start of the year: the spreadsheet's
     =PMT(rate, years left, -balance, future value, 1). The future value is in
     today's dollars, so this year's price level converts it. */
  {id: "vpw", family: "share", spendsDown: true,
   dial: {key: "vpwRate", lo: -3, hi: 12, dir: 1, step: .25},
   rule: function (s) {
     return Math.max(0, pmtStart((s.o.vpwRate || 0) / 100, s.years - s.y, s.bal, (s.o.vpwFV || 0) * s.cumInfl));
   }},
  /* Guyton-Klinger: follow inflation, but cut or raise spending when the
     withdrawal rate drifts past a guardrail around the target. The two
     guardrails and their steps can differ. Their capital preservation rule
     drops the cut in the final years (gkFinalYears), and their inflation
     rule (skipRaise) skips the raise after a losing year when the rate is
     already above where it started. */
  {id: "guardrails", family: "guard", dial: DD_RATE_DIAL, byRate: true,
   rule: function (s) {
     var o = s.o, w = (s.y === 0) ? s.baseW : s.prevW * (1 + s.lastInfl);
     if (s.y > 0 && o.skipRaise && s.lastRet < 0 && s.bal > 0 && w / s.bal * 100 > o.initialPct) w = s.prevW;
     if (s.bal > 0) {
       var curRate = w / s.bal * 100;
       var bandLo = o.guardBandLo != null ? o.guardBandLo : o.guardBand;
       var raise = o.raisePct != null ? o.raisePct : o.adjustPct;
       var hi = o.initialPct * (1 + o.guardBand / 100);
       var lo = o.initialPct * (1 - bandLo / 100);
       var noCut = o.gkFinalYears > 0 && o.years - s.y <= o.gkFinalYears;
       if (curRate > hi) { if (!noCut) w = w * (1 - Math.min(100, o.adjustPct) / 100); }
       else if (curRate < lo) w = w * (1 + raise / 100);
     }
     return w;
   }},
  /* Risk-based guardrails: start at the spending with the target chance of
     lasting, then hold it, with inflation, until the chance drifts below the
     lower guardrail or above the upper one; then reset to the target. The
     chance is history's, from ddRiskTable, counting income still to come.
     With a year left, any balance has every chance of lasting it, so like
     VPW it spends down to nothing by the end. */
  {id: "riskgr", family: "guard", spendsDown: true,
   dial: {key: "rgTarget", lo: 30, hi: 99.5, dir: -1, step: 2.5,
     set: function (x, v, base) {
       var t = base.rgTarget == null ? 90 : base.rgTarget;
       var dl = t - (base.rgLo == null ? 70 : base.rgLo), dh = (base.rgHi == null ? 99 : base.rgHi) - t;
       x.rgTarget = v; x.rgLo = Math.max(1, v - dl); x.rgHi = Math.min(100, v + dh);
     }},
   rule: function (s) {
     var o = s.o, R = s.P.rg, T = s.P.risk, y = s.y, L = s.years - y;
     var balR = s.bal / s.cumInfl, A = R.A[y], f = R.f[y];
     var B = R.Br[y] + R.Bn[y] / s.cumInfl, C = R.Cr[y] + R.Cn[y] / s.cumInfl;
     var reset = function () {
       return A > 1e-9 ? Math.max(0, (ddRiskRate(T, ddPct(o.rgTarget, 90), L) * balR / f + B - C) / A) * s.cumInfl : 0;
     };
     if (y === 0) return reset();
     var w = s.prevW * (1 + s.lastInfl);
     if (!(balR > 0)) return w;
     var p = ddRiskP(T, (w / s.cumInfl * A - B + C) * f / balR, L);
     return (p < ddPct(o.rgLo, 70) || p > ddPct(o.rgHi, 99)) ? reset() : w;
   }},
  /* Floor and ceiling: aim at a share of the current balance, but never move
     spending more than the allowed step from last year's, after inflation. */
  {id: "floorceil", family: "smooth", dial: DD_RATE_DIAL, byRate: true,
   rule: ddFloorCeil("floorPct", "ceilPct")},
  /* Vanguard's dynamic spending: the same rule, with its own limits, a 5%
     raise and a 2.5% cut by default. */
  {id: "vanguard", family: "smooth", dial: DD_RATE_DIAL, byRate: true,
   rule: ddFloorCeil("vgFloor", "vgCeil")},
  /* Yale's endowment rule: year one is the starting rate; after that, a
     blend of last year's spending raised for inflation and a target rate of
     the current balance. Its dial moves both rates together. */
  {id: "yale", family: "smooth", byRate: true,
   dial: {key: "yaleRate", lo: .25, hi: 15, dir: 1, step: .25,
     set: function (x, v, base) {
       var r = base.yaleRate > 0 ? base.initialPct / base.yaleRate : 1;
       x.yaleRate = v; x.initialPct = v * r;
     }},
   rule: function (s) {
     var o = s.o;
     if (s.y === 0) return s.baseW;
     var priorAdj = s.prevW * (1 + s.lastInfl);
     var pctOfBal = s.bal * o.yaleRate / 100;
     return (o.yaleWeight / 100) * priorAdj + (1 - o.yaleWeight / 100) * pctOfBal;
   }},
  /* Henry Hebeler's Autopilot II: most of last year's spending raised for
     inflation, blended with the level payment that would spend the balance
     over the years left at an expected real return. Year one is that
     payment. */
  {id: "hebeler", family: "smooth", dial: {key: "hebRate", lo: -3, hi: 12, dir: 1, step: .25},
   rule: function (s) {
     var o = s.o, pay = Math.max(0, pmtStart((o.hebRate || 0) / 100, s.years - s.y, s.bal, 0));
     if (s.y === 0) return pay;
     var wt = ddPct(o.hebWeight, 75);
     return wt * s.prevW * (1 + s.lastInfl) + (1 - wt) * pay;
   }},
  /* Sensible withdrawals: a base amount, the starting rate rising with
     inflation, plus a share of last year's real gains when there were any. */
  {id: "sensible", family: "smooth", dial: DD_RATE_DIAL, byRate: true,
   rule: function (s) {
     var base = s.initial * s.o.initialPct / 100 * s.cumInfl;
     var extra = s.y > 0 ? (s.o.sensExtra || 0) / 100 * Math.max(0, s.gain) * s.cumInfl : 0;
     return base + extra;
   }},
  /* CAPE-based: each year's rate is a base plus a share of the stock
     market's earnings yield, 1 / CAPE, so it spends more when stocks are
     cheap and less when they're dear. Karsten Jeske (Early Retirement Now)
     popularized it. */
  {id: "cape", family: "value", dial: {key: "capeA", lo: -4, hi: 10, dir: 1, step: .25},
   rule: function (s) {
     var o = s.o, c = s.cape > 0 ? s.cape : 20;
     return s.bal * Math.max(0, (o.capeA || 0) + (o.capeB || 0) * 100 / c) / 100;
   }}
].forEach(function (x) { DD_STRAT[x.id] = x; DD_ORDER.push(x.id); });

/* One run's per-plan setup, shared by every start: the guaranteed income,
   what stays invested, the spending path and, for risk-based guardrails, its
   tables. first is year one's spending from the strategy, in today's
   dollars, at today's CAPE where that matters. */
function ddPrep(o){
  var G = ddGuaranteed(o), S = DD_STRAT[o.strategy] || DD_STRAT.yale;
  var P = {G: G, initial: o.initial * (1 - G.share), strat: S, path: null, rg: null, risk: null, first: 0};
  if (S.id === "riskgr"){
    // the smile's spending term only, from a 4% year one
    P.path = ddPath(o, P.initial * .04 + G.income);
    P.risk = ddRiskTable(o);
    P.rg = ddRiskCoef(o, P.path);
    P.first = S.rule(ddState(o, P));
  } else {
    P.first = S.rule(ddState(o, P));
    P.path = ddPath(o, P.first + G.income);
  }
  return P;
}
function ddState(o, P){
  return {o: o, P: P, initial: P.initial, years: o.years, y: 0, bal: P.initial, cumInfl: 1,
    lastInfl: 0, lastRet: 0, prevW: 0, baseW: P.initial * o.initialPct / 100, gain: 0,
    cape: CAPE_NOW, age: o.retireAge != null ? o.retireAge : null, k: 1, last: -1e9};
}
/* Year one's spending in today's dollars, before the path and limits. */
function ddFirstYear(o){ return ddPrep(o).first; }

/* ---- one retirement ----
   o: the plan (ddOptsFromState makes it from the page's fields). seq: one
   {stock, bond, infl, cape} per year, returns in percent. P: ddPrep(o),
   passed when one plan runs many sequences. ctl, for the searches: lite
   skips the year-by-year rows, and stop ends the run at the first failure,
   either the money running out ("lasts") or a year's spending, without
   extra expenses, under the comfort line ("comfort", ctl.comfort in today's
   dollars, following the path). Returns the rows and a summary. */
function runDrawdown(o, seq, ctl, P) {
  P = P || ddPrep(o);
  var S = P.strat, s = ddState(o, P), path = P.path, G = P.G;
  var lite = !!(ctl && ctl.lite), stop = ctl ? ctl.stop : null, line = ctl && ctl.comfort || 0;
  var stockW = o.stockPct / 100;
  var bondW = 1 - stockW;
  var useGlide = o.stockPctEnd != null;
  var bal = P.initial, cumInfl = 1;
  var rows = lite ? null : [];
  var depletedYear = null, failed = false, invested = P.initial > 0;
  var totalReal = 0, lived = 0, minLived = Infinity, minReg = Infinity, lastRealEnd = P.initial, firstSpend = 0;

  for (var y = 0; y < o.years; y++) {
    var q = seq[y];
    s.y = y; s.bal = bal; s.cumInfl = cumInfl; s.cape = q.cape;
    s.age = o.retireAge != null ? o.retireAge + y : null;
    if (useGlide) {
      var yPct = o.stockPct + (o.stockPctEnd - o.stockPct) * y / Math.max(1, o.years - 1);
      stockW = Math.min(100, Math.max(0, yPct)) / 100;
      bondW = 1 - stockW;
    }
    var infl = q.infl / 100;
    var w = S.rule(s), m = path[y], reg = w * m;

    // The optional minimum and maximum, in today's dollars, apply to what the
    // strategy spends, never to extra expenses. If they cross, the maximum
    // wins. Fixed spending never falls, so they don't apply to it. A minimum
    // set by a search follows the spending path (floorPath).
    if (S.limits !== false) {
      if (o.spendFloor > 0) {
        var floorNominal = o.spendFloor * cumInfl * (o.floorPath ? m : 1);
        if (reg < floorNominal) reg = floorNominal;
      }
      if (o.spendCeil > 0) {
        var ceilNominal = o.spendCeil * cumInfl;
        if (reg > ceilNominal) reg = ceilNominal;
      }
    }
    // What the strategy treats as "last year's spending" next year: its own
    // figure, before the path, so the path never compounds into it.
    s.prevW = m > 0 ? reg / m : w;
    if (y === 0) firstSpend = reg;

    // Extra expenses come on top of the strategy's spending, whatever it is.
    var expense = itemsActiveThisYear(o.expenseItems, y + 1)
      .reduce(function (sum, it) { return sum + itemAmount(it, y + 1, cumInfl); }, 0);
    var planned = reg + expense;

    // Social Security covers part of the spending once it starts, so the
    // portfolio only has to provide the remainder. Priced at the same
    // start-of-year level as the spending it offsets.
    var ssThisYear = 0;
    if (o.ssAnnual > 0 && y >= (o.ssDelayYears || 0))
      ssThisYear = o.ssAnnual * cumInfl;
    if (o.ssAnnual2 > 0 && y >= (o.ssDelayYears2 || 0))
      ssThisYear += o.ssAnnual2 * cumInfl;
    if (o.ssAnnual3 > 0 && y >= (o.ssDelayYears3 || 0))
      ssThisYear += o.ssAnnual3 * cumInfl;
    var need = Math.max(0, planned - ssThisYear);

    // Other income works the same way. If it covers more than the plan
    // needs, nothing is withdrawn and the extra is invested.
    var customIncomeTotal = itemsActiveThisYear(o.incomeItems, y + 1)
      .reduce(function (sum, it) { return sum + itemAmount(it, y + 1, cumInfl); }, 0);
    var incomeInvested = Math.max(0, customIncomeTotal - need);
    need = Math.max(0, need - customIncomeTotal);

    // The portfolio pays what it can. Whatever it can't is spending that
    // didn't happen: extra expenses go first, then everyday spending.
    var wd = need > bal ? bal : need;
    if (wd < 0) wd = 0;
    var short = need - wd;

    var start = bal;
    bal = bal - wd + incomeInvested;
    var ret = (stockW * q.stock + bondW * q.bond) / 100 - (o.fee || 0) / 100 - (o.returnDrag || 0) / 100;
    var afterFlows = bal;
    var growth = bal * ret;
    bal = bal + growth;
    if (bal < 0) bal = 0;

    var gIncome = G.income > 0 ? G.income * (G.real ? cumInfl : 1) : 0;
    var livedN = planned - short + gIncome;
    var regN = reg - Math.max(0, short - expense) + gIncome;
    var realW = wd / cumInfl, realLived = livedN / cumInfl, realReg = regN / cumInfl;
    totalReal += realW; lived += realLived;
    if (realLived < minLived) minLived = realLived;
    if (realReg < minReg) minReg = realReg;

    var startLevel = cumInfl;
    cumInfl = cumInfl * (1 + infl);
    s.lastInfl = infl;
    s.lastRet = ret;
    s.gain = bal / cumInfl - afterFlows / startLevel;
    lastRealEnd = bal / cumInfl;

    if (!lite) rows.push({
      year: y + 1, start: start, withdrawal: wd, realWithdrawal: realW,
      growth: growth, end: bal, realEnd: lastRealEnd, infl: q.infl,
      ret: ret * 100, ss: ssThisYear, spend: livedN, realSpend: realLived,
      realReg: realReg, planned: planned + gIncome, realPlanned: (planned + gIncome) / startLevel,
      short: short, guaranteed: gIncome,
      customIncome: customIncomeTotal, customExpense: expense, path: m, cape: q.cape
    });

    // A strategy built to spend down by the end leaves an empty portfolio
    // after its final year by design, not by failure.
    var plannedEnd = S.spendsDown && y === o.years - 1;
    if (bal <= 0 && depletedYear === null && !plannedEnd && invested) depletedYear = y + 1;
    if (stop === "lasts" && depletedYear !== null) { failed = true; break; }
    if (stop === "comfort" && realReg < line * m - .5) { failed = true; break; }
  }

  var out = {
    rows: rows,
    depleted: depletedYear !== null,
    depletedYear: depletedYear,
    endBalance: bal,
    endReal: lastRealEnd,
    totalRealSpend: totalReal,
    lived: lived,
    minRealSpend: minLived,
    minReg: minReg,
    firstSpend: firstSpend,
    failed: failed
  };
  if (rows) {
    var sorted = rows.map(function (r) { return r.realSpend; }).sort(function (a, b) { return a - b; });
    out.medRealSpend = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  }
  return out;
}

/* What a start's years averaged, compounded: stocks, bonds and inflation, as
   yearly rates. Kept on the window, which is reused. */
function ddWindowAvg(w){
  if (w.avg) return w.avg;
  var gs = 1, gb = 1, gi = 1, n = w.seq.length;
  w.seq.forEach(function (q) { gs *= 1 + q.stock / 100; gb *= 1 + q.bond / 100; gi *= 1 + q.infl / 100; });
  return (w.avg = {stock: Math.pow(gs, 1 / n) - 1, bond: Math.pow(gb, 1 / n) - 1, infl: Math.pow(gi, 1 / n) - 1});
}

/* Every historical start that has enough data to run the full retirement:
   the sequence-of-returns test. 1966 and 1929 fail plans that a random-draw
   simulation would call safe. With o.monthly, a retirement starts every
   month instead of every January. failYears lists each year a failed
   retirement began, once. */
function historicalBacktest(o) {
  var W = ddWindows(o), P = ddPrep(o), runs = [], k;
  for (k = 0; k < W.length; k++) {
    var r = runDrawdown(o, W[k].seq, null, P), a = ddWindowAvg(W[k]);
    r.startYear = W[k].year; r.startMonth = W[k].month; r.startIdx = W[k].i; r.cape0 = W[k].seq[0].cape;
    r.avgStock = a.stock; r.avgBond = a.bond; r.avgInfl = a.infl;
    runs.push(r);
  }
  var survived = runs.filter(function (r) { return !r.depleted; }).length;
  var ends = runs.map(function (r) { return r.endReal; }).sort(function (a, b) { return a - b; });
  var fails = runs.filter(function (r) { return r.depleted; });
  var failYears = [];
  fails.forEach(function (r) { if (failYears.indexOf(r.startYear) < 0) failYears.push(r.startYear); });
  return {
    first: HIST_START + ddFromIdx(o),
    monthly: !!o.monthly,
    runs: runs,
    total: runs.length,
    survived: survived,
    successRate: runs.length ? survived / runs.length : 0,
    medianEnd: ends.length ? ends[Math.floor(ends.length / 2)] : 0,
    worstEnd: ends.length ? ends[0] : 0,
    bestEnd: ends.length ? ends[ends.length - 1] : 0,
    failYears: failYears,
    failCount: fails.length,
    firstFail: fails.length ? fails[0] : null,
    prep: P
  };
}

/* The historical test's success rate and median ending balance alone, with
   no year-by-year rows, for the tables that try many variations. */
function ddQuick(o){
  var W = ddWindows(o), P = ddPrep(o), ok = 0, ends = [];
  for (var k = 0; k < W.length; k++) {
    var r = runDrawdown(o, W[k].seq, {lite: true}, P);
    if (!r.depleted) ok++;
    ends.push(r.endReal);
  }
  ends.sort(function (a, b) { return a - b; });
  return {successRate: W.length ? ok / W.length : 0, medianEnd: ends.length ? ends[Math.floor(ends.length / 2)] : 0};
}

/* Random sequences drawn from the same historical years, using the seeded
   generator so a given set of inputs always produces the same chart. Each
   drawn year brings its stock and bond returns, inflation and January CAPE
   together. */
function monteCarloDrawdown(o, trials, seed) {
  var rng = mulberry32(seed >>> 0);
  var n = HIST_STOCK.length;
  var runs = [];
  var P = ddPrep(o);
  /* runDrawdown only reads seq[y] during the call, so one buffer of year slots
     is refilled per trial rather than allocating a fresh array of objects each
     time. */
  var seq = [];
  for (var s = 0; s < o.years; s++) seq.push({ stock: 0, bond: 0, infl: 0, cape: 0 });
  for (var t = 0; t < trials; t++) {
    for (var k = 0; k < o.years; k++) {
      var i = Math.floor(rng() * n);
      seq[k].stock = HIST_STOCK[i]; seq[k].bond = HIST_BOND[i]; seq[k].infl = HIST_INFL[i];
      seq[k].cape = HIST_M_CAPE[i * 12];
    }
    runs.push(runDrawdown(o, seq, null, P));
  }
  var survived = runs.filter(function (r) { return !r.depleted; }).length;
  var ends = runs.map(function (r) { return r.endReal; }).sort(function (a, b) { return a - b; });
  var pick = function (q) { return ends.length ? ends[Math.min(ends.length - 1, Math.floor(ends.length * q))] : 0; };

  // percentile bands of the real balance path, for the fan chart
  var bands = [];
  var col = new Float64Array(runs.length);
  for (var y = 0; y < o.years; y++) {
    for (var c = 0; c < runs.length; c++) {
      var rr = runs[c].rows[y];
      col[c] = rr ? rr.realEnd : 0;
    }
    col.sort();   // typed arrays sort numerically, no comparator needed
    var at = function (q) { return col[Math.min(col.length - 1, Math.floor(col.length * q))]; };
    bands.push({ year: y + 1, p10: at(.10), p25: at(.25), p50: at(.50), p75: at(.75), p90: at(.90) });
  }
  return {
    runs: runs, trials: trials, survived: survived,
    successRate: runs.length ? survived / runs.length : 0,
    medianEnd: pick(.5), p10End: pick(.10), p90End: pick(.90),
    bands: bands, prep: P
  };
}

/* ---- the page's fields, as the engine's options ----
   d is the simulator's saved state: its fields as typed. The page reads its
   own fields through this too, so a saved scenario compares exactly as it
   ran. A setting an older save doesn't have takes its default, and a 0 stays
   0. Social Security resolves to up to three streams (yours, your spouse's
   and any spousal top-up), each from the year it starts. */
function ddOptsFromState(d){
  d = d || {};
  var v = function (k, def) {
    var x = d[k];
    if (x == null || x === "") return def;
    x = typeof x === "number" ? x : parseFloat(String(x).replace(/,/g, ""));
    return isFinite(x) ? x : def;
  };
  var clamp = function (x, lo, hi) { return Math.min(hi, Math.max(lo, x)); };
  var copy = function (a) { return Array.isArray(a) ? a.map(function (x) { return Object.assign({}, x); }) : []; };
  var age = v("retireAge", null);
  var retireAge = age != null && age > 0 ? age : null;
  var strategy = DD_STRAT[d.strategy] ? d.strategy : "fixed";
  var rate = v("rate", 4);

  var ss = {annual: 0, delay: 0, annual2: 0, delay2: 0, annual3: 0, delay3: 0, total: 0};
  var couple = d.ssWho === "couple";
  if (d.ssMode === "manual") {
    var amt = v("ssAmount", 0) + (couple ? v("ssAmount2", 0) : 0), raw = v("ssDelay", 0);
    ss.annual = amt; ss.total = amt;
    ss.delay = retireAge != null ? Math.max(0, Math.round(raw - retireAge)) : Math.max(0, Math.round(raw));
  } else if (d.ssMode === "est") {
    ss = ssDrawdownStreams(v("ssIncome", 0), v("ssClaim", 67), v("ssIncome2", 0), v("ssClaim2", 67),
      couple, retireAge, v("ssDelay", 0));
  }

  // Stages saved before the spending path belonged to the fixed strategy.
  var path = d.path, pathStages = copy(d.pathStages);
  if (!path && Array.isArray(d.wdStages) && d.wdStages.length && strategy === "fixed") {
    path = "stages"; pathStages = ddStagesFromRates(d.wdStages, rate);
  }

  return {
    initial: v("initial", 0),
    years: Math.min(60, Math.max(1, Math.round(v("years", 30)))),
    stockPct: clamp(v("stock", 60), 0, 100),
    stockPctEnd: d.stockEnd == null || String(d.stockEnd).trim() === "" ? null : clamp(v("stockEnd", 0), 0, 100),
    fee: v("fee", 0),
    strategy: strategy,
    initialPct: rate,
    guardBand: v("guardBand", 20),
    adjustPct: v("adjust", 10),
    guardBandLo: v("guardBandLo", v("guardBand", 20)),
    raisePct: v("adjustLo", v("adjust", 10)),
    gkFinalYears: d.gkFinal ? Math.max(0, Math.round(v("gkFinalYrs", 15))) : 0,
    floorPct: v("floor", 10),
    ceilPct: v("ceil", 10),
    yaleWeight: clamp(v("yaleWeight", 70), 0, 100),
    yaleRate: Math.max(0, v("yaleRate", 5)),
    spendFloor: v("spendFloor", 0),
    spendCeil: v("spendCeil", 0),
    vpwRate: v("vpwRate", 3.8),
    vpwFV: v("vpwFV", 0),
    skipRaise: !!d.skipRaise,
    vgCeil: v("vgCeil", 5),
    vgFloor: v("vgFloor", 2.5),
    kitThresh: v("kitThresh", 50),
    kitRaise: v("kitRaise", 10),
    kitGap: v("kitGap", 3),
    clyFloor: v("clyFloor", 95),
    hebWeight: clamp(v("hebWeight", 75), 0, 100),
    hebRate: v("hebRate", 3),
    sensExtra: v("sensExtra", 10),
    rgTarget: clamp(v("rgTarget", 90), 1, 99.9),
    rgLo: clamp(v("rgLo", 70), 0, 100),
    rgHi: clamp(v("rgHi", 99), 0, 100),
    capeA: v("capeA", 1.75),
    capeB: v("capeB", 0.5),
    path: path === "ease" || path === "smile" || path === "stages" ? path : "flat",
    pathEase: v("pathEase", 1),
    pathStages: pathStages,
    gShare: clamp(v("gShare", 0), 0, 100),
    gType: d.gType === "annuity" ? "annuity" : "tips",
    gYield: v("gYield", 2),
    gPayout: v("gPayout", 6.5),
    gInflate: !!d.gInflate,
    ssAnnual: ss.annual, ssDelayYears: ss.delay,
    ssAnnual2: ss.annual2 || 0, ssDelayYears2: ss.delay2 || 0,
    ssAnnual3: ss.annual3 || 0, ssDelayYears3: ss.delay3 || 0,
    ssAnnualTotal: ss.total || 0,
    legacyGoal: v("legacyGoal", 0),
    comfort: v("comfort", 0),
    retireAge: retireAge,
    fromYear: clamp(Math.round(v("fromYear", HIST_START)), HIST_START, HIST_START + HIST_STOCK.length - 1),
    monthly: d.starts === "month",
    incomeItems: copy(d.incomeItems),
    expenseItems: copy(d.expenseItems)
  };
}

/* The comfort line: spending, in today's dollars, the household would hate
   to fall below. The one set, or else the minimum spending, or else 80% of
   year one's (guaranteed income included). */
function ddComfort(o, P){
  if (o.comfort > 0) return o.comfort;
  if (o.spendFloor > 0 && (DD_STRAT[o.strategy] || {}).limits !== false) return o.spendFloor;
  P = P || ddPrep(o);
  return .8 * (P.first + P.G.income);
}

/* ---- how spending went ----
   Across a set of runs, against the comfort line (today's dollars,
   following the spending path): how many retirements ever dipped under it,
   the share of all years under it, the longest stretch and the lowest year;
   year-to-year cuts; and FICalc's counts of big swings (a 25% change in a
   year), spending ever half again above year one or half below it, and
   endings at twice the start or under half of it. The path's own planned
   changes don't count as cuts or swings. Extra expenses are left out, so a
   one-off purchase isn't a swing either. */
function ddScorecard(runs, o, comfort, path){
  var n = runs.length, years = 0, below = 0, dipped = 0, longest = 0, longRun = null;
  var low = Infinity, lowRun = null, lowYear = 0, lowRatio = Infinity;
  var vol = 0, large = 0, small = 0, bigEnd = 0, smallEnd = 0, cutYears = 0, maxCut = 0, maxCutRun = null;
  var lifes = [], firsts = [];
  runs.forEach(function (r) {
    var rows = r.rows || [];
    if (!rows.length) return;
    var first = rows[0].realReg / (path[0] || 1), streak = 0, any = false, sw = false, lg = false, sm = false, prev = null, life = 0;
    firsts.push(rows[0].realReg);
    rows.forEach(function (row, y) {
      var m = path[y] || 0, v = row.realReg, norm = m > 0 ? v / m : v;
      years++; life += row.realSpend;
      if (comfort > 0 && v < comfort * m - .5) {
        below++; streak++; any = true;
        if (streak > longest) { longest = streak; longRun = r; }
      } else streak = 0;
      if (v < low) { low = v; lowRun = r; lowYear = y + 1; }
      if (first > 0 && norm / first < lowRatio) lowRatio = norm / first;
      if (prev != null && prev > 0) {
        var ch = norm / prev - 1;
        if (Math.abs(ch) > .25) sw = true;
        if (ch < -.005) { cutYears++; if (-ch > maxCut) { maxCut = -ch; maxCutRun = r; } }
      }
      if (first > 0 && norm >= first * 1.5) lg = true;
      if (first > 0 && norm <= first * .5) sm = true;
      prev = norm;
    });
    if (any) dipped++;
    if (sw) vol++;
    if (lg) large++;
    if (sm) small++;
    if (r.endReal >= 2 * o.initial) bigEnd++;
    else if (r.endReal > .5 && r.endReal < .5 * o.initial) smallEnd++;
    lifes.push(life);
  });
  var med = function (a) { var x = a.slice().sort(function (p, q) { return p - q; }); return x.length ? x[Math.floor(x.length / 2)] : 0; };
  return {n: n, years: years, below: below, dipped: dipped, longest: longest, longRun: longRun,
    low: isFinite(low) ? low : 0, lowRun: lowRun, lowYear: lowYear, lowRatio: isFinite(lowRatio) ? lowRatio : 1,
    cutsAvg: n ? cutYears / n : 0, maxCut: maxCut, maxCutRun: maxCutRun,
    volatile: vol, large: large, small: small, bigEnd: bigEnd, smallEnd: smallEnd,
    lifeMed: med(lifes), firstMed: med(firsts), comfort: comfort};
}

/* ---- searches ----
   A risk target T: {crit, comfort, conf}. crit "comfort" asks that spending
   never fall under the comfort line; "lasts" that the money last the whole
   plan. conf is the share of starts that must meet it (1 for every one).

   Under "comfort", every flexible strategy is held at or above the comfort
   line, as its minimum spending, the way people actually run them. Without
   it, a strategy that cuts in steps (guardrails cut 10% at a time) can't
   promise a line at any setting, since its cuts scale with whatever it
   started at; with it, the only way under the line is running out of money,
   or a fixed amount that starts under it. */
function ddForTarget(o, T){
  if (T.crit !== "comfort" || !(T.comfort > 0) || (DD_STRAT[o.strategy] || {}).limits === false) return o;
  return Object.assign({}, o, {spendFloor: Math.max(o.spendFloor || 0, T.comfort), floorPath: true});
}
function ddMeets(o, T, W, order, full){
  var P = ddPrep(o), n = W.length, fails = 0;
  var allowed = Math.floor((1 - T.conf) * n + 1e-9);
  var ctl = {lite: true, stop: T.crit, comfort: T.comfort};
  for (var k = 0; k < n; k++) {
    var idx = order ? order[k] : k, r = runDrawdown(o, W[idx].seq, ctl, P);
    if (r.failed) {
      fails++;
      // The starts that fail one setting tend to fail the next, so they go first.
      if (order && k > 0) { order.splice(k, 1); order.unshift(idx); }
      if (!full && fails > allowed) return {ok: false, share: null};
    }
  }
  return {ok: fails <= allowed, share: n ? (n - fails) / n : 0};
}
function ddDialVal(D, t){ return D.dir > 0 ? D.lo + t * (D.hi - D.lo) : D.hi - t * (D.hi - D.lo); }
function ddDialGet(o){
  var D = (DD_STRAT[o.strategy] || {}).dial;
  return D ? o[D.key] : null;
}
/* The plan with a strategy's dial turned to v. */
function ddWithDial(o, v){
  var D = DD_STRAT[o.strategy].dial, x = Object.assign({}, o);
  if (D.set) D.set(x, v, o); else x[D.key] = v;
  return x;
}
/* The most a strategy can spend and still meet the target: the dial's value
   at the edge. What meets it can be a range, since spending too little sits
   under the comfort line too, so a scan from the generous end finds the
   highest setting that works and bisection sharpens the edge above it. test
   decides one setting; t runs 0 (least spending) to 1 (most). */
function ddEdge(test){
  var N = 40, k;
  for (k = N; k >= 0; k--) if (test(k / N)) break;
  if (k < 0) return {t: null, capped: false};
  if (k === N) return {t: 1, capped: true};
  var a = k / N, b = (k + 1) / N;
  for (var i = 0; i < 10; i++) { var mid = (a + b) / 2; if (test(mid)) a = mid; else b = mid; }
  return {t: a, capped: false};
}
function ddCalibrate(o, T){
  var S = DD_STRAT[o.strategy];
  if (!S || !S.dial) return null;
  o = ddForTarget(o, T);
  var D = S.dial, W = ddWindows(o);
  if (!W.length) return null;
  var order = W.map(function (_, i) { return i; });
  var e = ddEdge(function (t) { return ddMeets(ddWithDial(o, ddDialVal(D, t)), T, W, order).ok; });
  if (e.t != null) return {v: ddDialVal(D, e.t), met: true, capped: e.capped};
  // Nothing meets it: the setting that comes closest.
  var best = null;
  for (var k = 0; k <= 10; k++) {
    var v = ddDialVal(D, k / 10), sh = ddMeets(ddWithDial(o, v), T, W, null, true).share;
    if (!best || sh > best.share + 1e-9) best = {v: v, share: sh};
  }
  return {v: best.v, met: false, capped: false, share: best.share};
}
/* For the safe-rate chart: each start's own edge, and the strategy's year-one
   spending there as a share of the invested portfolio. null where nothing
   works; capped where even the top of the dial's range works (a strategy
   that can't run out, under "lasts"). */
function ddSafeByStart(o, T){
  var S = DD_STRAT[o.strategy];
  if (!S || !S.dial) return null;
  o = ddForTarget(o, T);
  var D = S.dial, W = ddWindows(o), Pm = {};
  var prep = function (t) { var x = ddWithDial(o, ddDialVal(D, t)); return Pm[t] || (Pm[t] = {x: x, P: ddPrep(x)}); };
  var ctl = {lite: true, stop: T.crit, comfort: T.comfort};
  return W.map(function (w) {
    var e = ddEdge(function (t) { var p = prep(t); return !runDrawdown(p.x, w.seq, ctl, p.P).failed; });
    var out = {i: w.i, year: w.year, month: w.month, cape: w.seq[0].cape, v: null, rate: null, capped: e.capped};
    if (e.t != null) {
      var p = prep(e.t), r = runDrawdown(p.x, w.seq, {lite: true}, p.P);
      out.v = ddDialVal(D, e.t);
      out.rate = p.P.initial > 0 ? r.firstSpend / p.P.initial : 0;
    }
    return out;
  });
}
/* What portfolio the plan's year-one spending needs to meet the target, for
   a strategy whose year one is a rate on the portfolio: the spending stays
   put in dollars and the rate follows the portfolio. */
function ddSolvePortfolio(o, T){
  var S = DD_STRAT[o.strategy];
  if (!S || !S.byRate || !(o.initial > 0)) return null;
  o = ddForTarget(o, T);
  var P0 = ddPrep(o), spend = P0.first, share = P0.G.share;
  if (!(spend > 0) || share >= 1) return null;
  var W = ddWindows(o);
  if (!W.length) return null;
  var order = W.map(function (_, i) { return i; });
  var make = function (port) {
    var x = Object.assign({}, o, {initial: port}), r = spend / (port * (1 - share)) * 100;
    if (S.dial.set) S.dial.set(x, S.dial.key === "yaleRate" ? r * (o.yaleRate / Math.max(1e-9, o.initialPct)) : r, o);
    else x[S.dial.key] = r;
    if (S.dial.key === "yaleRate") x.initialPct = r;
    return x;
  };
  var ok = function (port) { return ddMeets(make(port), T, W, order).ok; };
  var lo = spend / (.15 * (1 - share)), hi = spend / (.002 * (1 - share));
  if (!ok(hi)) return {portfolio: null};
  if (ok(lo)) return {portfolio: lo, capped: true};
  for (var i = 0; i < 40; i++) { var mid = Math.sqrt(lo * hi); if (ok(mid)) hi = mid; else lo = mid; }
  return {portfolio: hi, capped: false, spend: spend};
}
/* The success grid: the share of starts meeting the target for the dial's
   values around the current one, against the stock share (glide off) or the
   length of retirement. */
function ddHeatmap(o, T, axis){
  var S = DD_STRAT[o.strategy];
  if (!S || !S.dial) return null;
  o = ddForTarget(o, T);
  var D = S.dial, cur = ddDialGet(o), rows = [], cols;
  var base = Math.round(cur / D.step) * D.step;
  for (var k = -6; k <= 6; k++) {
    var v = Math.round((base + k * D.step) * 1e6) / 1e6;
    if (v >= D.lo - 1e-9 && v <= D.hi + 1e-9) rows.push(v);
  }
  if (D.dir < 0) rows.reverse();
  cols = axis === "years" ? [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60] : [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  var grid = rows.map(function (v) {
    return cols.map(function (c) {
      var x = Object.assign({}, o, axis === "years" ? {years: c} : {stockPct: c, stockPctEnd: null});
      x = ddWithDial(x, v);
      var W = ddWindows(x);
      if (!W.length) return null;
      // A fixed amount that starts under the comfort line fails it from day
      // one, which says nothing about risk: -1 marks it.
      if (T.crit === "comfort" && S.limits === false) {
        var P = ddPrep(x);
        if (P.first + P.G.income < T.comfort - .5) return -1;
      }
      return ddMeets(x, T, W, null, true).share;
    });
  });
  return {rows: rows, cols: cols, grid: grid, axis: axis, cur: cur};
}
/* The starts the showdown draws each strategy through: the hard ones,
   1966 and 1929, then whichever of these the data reaches. */
var DD_SPOTS = [1966, 1929, 2000, 1973, 1937, 2007];
/* The strategy showdown: every strategy (or those in ids) on the same plan,
   each with its dial turned to the most it can spend while meeting the same
   target, then what each delivers. One without a dial runs as it is. */
function ddShowdown(o, T, ids){
  var W = ddWindows(o), spots = [];
  DD_SPOTS.forEach(function (yr) {
    if (spots.length >= 3) return;
    for (var k = 0; k < W.length; k++) if (W[k].year === yr && W[k].month === 1) { spots.push(W[k]); return; }
  });
  return {spots: spots.map(function (w) { return w.year; }), list: (ids || DD_ORDER).filter(function (id) {
    return DD_STRAT[id];
  }).map(function (id) {
    var S = DD_STRAT[id], x = ddForTarget(Object.assign({}, o, {strategy: id}), T), cal = null;
    if (S.dial) {
      cal = ddCalibrate(x, T);
      if (cal) x = ddWithDial(x, cal.v);
    }
    var H = historicalBacktest(x), P = H.prep;
    var sc = ddScorecard(H.runs, x, T.comfort, P.path);
    var meet = ddMeets(x, T, W, null, true);
    return {id: id, dial: cal ? cal.v : null, floor: x.floorPath ? x.spendFloor : 0,
      met: meet.ok, share: meet.share, capped: !!(cal && cal.capped),
      tuned: !!cal, first: sc.firstMed, life: sc.lifeMed, low: sc.low,
      lowStart: sc.lowRun ? {year: sc.lowRun.startYear, month: sc.lowRun.startMonth} : null,
      cuts: sc.cutsAvg, maxCut: sc.maxCut, end: H.medianEnd, success: H.successRate,
      below: sc.years ? sc.below / sc.years : 0,
      spots: spots.map(function (w) { return runDrawdown(x, w.seq, null, P).rows.map(function (r) { return r.realReg; }); })};
  })};
}

/* Monte Carlo, summarized for the page: what the charts, tables and
   scorecard need, without sending five thousand runs across. bal and spend
   hold every run's real end balance and real spending, run by run, for the
   distributions. extra.sens and extra.ss are smaller runs for the return
   sensitivity and claiming-age tables. */
function ddMCSummary(o, trials, seed, comfort, extra){
  var M = monteCarloDrawdown(o, trials, seed), P = M.prep, Y = o.years, n = M.runs.length;
  var sc = ddScorecard(M.runs, o, comfort, P.path);
  var sorted = M.runs.slice().sort(function (a, b) { return a.endReal - b.endReal; });
  var med = sorted[Math.floor(sorted.length / 2)];
  var bal = new Float64Array(n * Y), spend = new Float64Array(n * Y), legacy = 0, col = new Float64Array(n);
  M.runs.forEach(function (r, i) {
    for (var y = 0; y < Y; y++) {
      var row = r.rows[y];
      bal[i * Y + y] = row ? row.realEnd : 0;
      spend[i * Y + y] = row ? row.realSpend : 0;
    }
    if (o.legacyGoal > 0 && r.endReal >= o.legacyGoal) legacy++;
  });
  var spendBands = [];
  for (var y = 0; y < Y; y++) {
    for (var i = 0; i < n; i++) col[i] = spend[i * Y + y];
    col.sort();
    var at = function (q) { return col[Math.min(n - 1, Math.floor(n * q))]; };
    spendBands.push({year: y + 1, p10: at(.1), p25: at(.25), p50: at(.5), p75: at(.75), p90: at(.9)});
  }
  var small = function (ov) {
    var S = monteCarloDrawdown(Object.assign({}, o, ov), 500, seed);
    return {rate: S.successRate, median: S.medianEnd};
  };
  return {trials: trials, survived: M.survived, successRate: M.successRate, medianEnd: M.medianEnd,
    p10End: M.p10End, p90End: M.p90End, bands: M.bands, spendBands: spendBands, legacy: legacy,
    med: {rows: med.rows, depleted: med.depleted, depletedYear: med.depletedYear, endReal: med.endReal},
    sc: sc, bal: bal, spend: spend, years: Y, n: n, path: P.path,
    sens: extra && extra.sens ? extra.sens.map(function (dr) { return small({returnDrag: dr}); }) : null,
    ss: extra && extra.ss ? extra.ss.map(small) : null};
}

/* The jobs the page hands to a worker (or runs itself where it can't). */
function ddJob(job, a){
  if (job === "mc") return ddMCSummary(a.o, a.trials, a.seed, a.comfort, a.extra);
  if (job === "showdown") return ddShowdown(a.o, a.T, a.ids);
  if (job === "safe") return {safe: ddSafeByStart(a.o, a.T), dial: ddCalibrate(a.o, a.T), port: ddSolvePortfolio(a.o, a.T)};
  if (job === "heat") return ddHeatmap(a.o, a.T, a.axis);
  return null;
}
// ===DRAWDOWN END===
;
// ===PLAN START===
/* ---------- the retirement plan engine ----------
   One household's retirement, year by year and account by account: what
   comes out of the traditional 401(k)/IRA, the Roth and the taxable
   brokerage each year, what that does to the tax bill, and what's left.
   The readiness guide tests every plan with it, and the Plan Optimizer
   searches the ways of running it (when each of you claims Social Security,
   which account to draw first, how much to convert to Roth, and which income
   lines to stay under) for the one that does best.

   Everything is in today's dollars. Returns are real (after inflation), and
   the brackets, deductions and thresholds are held fixed in real terms, the
   same assumption every other tool on the site makes. The figures that don't
   index -- brokerage cost basis, Roth contributions, a pension without a
   cost-of-living raise -- lose value to each year's inflation.

   The tax each year is the Income Tax tool's whole retirement return,
   computeRetireTax(): Social Security's provisional-income formula, capital
   gains stacked on ordinary income, the 3.8% investment income tax, the
   senior deductions and every state's retirement rules. Medicare's income
   surcharge (IRMAA) runs on a two-year lookback, the 10% additional tax
   applies to traditional money taken before 59½, Roth conversions wait five
   years before they can be spent early, required minimum distributions start
   at 73 or 75, and ACA marketplace premiums before 65 follow each year's
   income, cliff included.

   A couple is one household: one pool of each account type, with the 59½
   line and required distributions following your age, and both of you
   living to the end of the plan. */

var PL_EARLY = 59;          // a year that starts before 59 ends before 59½
var PL_HEIR = 0.24;         // default tax rate heirs pay on inherited traditional money

/* Real returns of a stock/bond mix by calendar year from 1926, inflation
   alongside, and their long-run averages: the steady path runs at the
   geometric mean. */
var plMixMemo = {};
function plMix(stock){
  var key = String(stock);
  if (plMixMemo[key]) return plMixMemo[key];
  var w = stock / 100, n = HIST_STOCK.length;
  var r = new Float64Array(n), pi = new Float64Array(n), sl = 0, si = 0;
  for (var i = 0; i < n; i++){
    var nom = (w * HIST_STOCK[i] + (1 - w) * HIST_BOND[i]) / 100, inf = HIST_INFL[i] / 100;
    r[i] = (1 + nom) / (1 + inf) - 1; pi[i] = inf;
    sl += Math.log(1 + r[i]); si += Math.log(1 + inf);
  }
  return (plMixMemo[key] = {r:r, pi:pi, n:n, real:Math.exp(sl / n) - 1, infl:Math.exp(si / n) - 1});
}

/* Saving until retirement, month by month: the Basic calculator's projection
   (contributions rise once a year with inflation, so they hold their value
   in today's dollars), stopping after saveYears for a plan that coasts.
   Returns the balance and each year-end balance. */
function plGrow(initial, monthly, real, years, saveYears, infl){
  var n = Math.floor(years * 12), sN = Math.max(0, Math.min(n, Math.floor(saveYears * 12 + 1e-9)));
  var pr = Math.pow(1 + real, 1 / 12) - 1;
  var bal = initial, path = [initial];
  for (var i = 1; i <= n; i++){
    var j = i - (Math.ceil(i / 12) - 1) * 12;
    bal = bal * (1 + pr) + (i <= sN ? monthly / Math.pow(1 + infl, j / 12) : 0);
    if (i % 12 === 0) path.push(bal);
  }
  if (n % 12) path.push(bal);
  return {fv:bal, path:path};
}

/* ---- tax, cached ----
   The whole return is too slow to run thousands of times a second, so its
   answer is cached on a $500 grid of ordinary income and capital gain, one
   grid per Social Security amount and number of people 65 or older, and read
   back by bilinear interpolation: exact inside a bracket, a few dollars off
   at a kink. A pension is taxed as ordinary income alongside traditional
   withdrawals. */
var PL_STEP = 500, PL_GRID = 4096;
var plTaxCaches = {}, plTaxCacheN = 0;
function plTaxCache(status, state){
  var k = status + state;
  if (!plTaxCaches[k]){
    if (++plTaxCacheN > 6){ plTaxCaches = {}; plTaxCacheN = 1; }
    plTaxCaches[k] = {status:status, state:state, maps:new Map()};
  }
  return plTaxCaches[k];
}
function plTaxRaw(c, seniors, ss, ord, gain){
  return computeRetireTax({status:c.status, state:c.state, trad:ord, roth:0, brok:gain,
    gainPct:1, ss:ss, pension:0, penPublic:false, other:0, pre:0, dedType:"std", item:0,
    seniors:seniors, _noMarginal:true}).total;
}
function plTax(c, seniors, ss, ord, gain){
  if (!(ord > 0)) ord = 0;
  if (!(gain > 0)) gain = 0;
  var fi = ord / PL_STEP, fj = gain / PL_STEP;
  if (fi >= PL_GRID - 2 || fj >= PL_GRID - 2) return plTaxRaw(c, seniors, ss, ord, gain);
  var key = seniors * 1e8 + Math.round(ss), m = c.maps.get(key);
  if (!m){
    if (c.maps.size > 600) c.maps.clear();
    m = new Map(); c.maps.set(key, m);
  }
  var i = Math.floor(fi), j = Math.floor(fj), di = fi - i, dj = fj - j;
  var k = i * PL_GRID + j, v00 = m.get(k), v10 = m.get(k + PL_GRID),
      v01 = m.get(k + 1), v11 = m.get(k + PL_GRID + 1);
  if (v00 === undefined){ v00 = plTaxRaw(c, seniors, ss, i * PL_STEP, j * PL_STEP); m.set(k, v00); }
  if (v10 === undefined){ v10 = plTaxRaw(c, seniors, ss, (i + 1) * PL_STEP, j * PL_STEP); m.set(k + PL_GRID, v10); }
  if (v01 === undefined){ v01 = plTaxRaw(c, seniors, ss, i * PL_STEP, (j + 1) * PL_STEP); m.set(k + 1, v01); }
  if (v11 === undefined){ v11 = plTaxRaw(c, seniors, ss, (i + 1) * PL_STEP, (j + 1) * PL_STEP); m.set(k + PL_GRID + 1, v11); }
  return v00 * (1 - di) * (1 - dj) + v10 * di * (1 - dj) + v01 * (1 - di) * dj + v11 * di * dj;
}
/* The federal pieces a plan steers by, worked directly (the same formulas
   computeRetireTax uses, on the standard deduction): taxable Social Security,
   AGI and ordinary taxable income. `ord` is ordinary income before any
   Social Security. */
function plSSTax(ss, otherAgi, st){
  if (!(ss > 0)) return 0;
  var t1 = SS_PROV.t1[st], t2 = SS_PROV.t2[st], prov = Math.max(0, otherAgi) + ss / 2;
  if (prov <= t1) return 0;
  if (prov <= t2) return Math.min(.5 * (prov - t1), .5 * ss);
  return Math.min(.85 * (prov - t2) + Math.min(.5 * (t2 - t1), .5 * ss), .85 * ss);
}
function plAgi(ord, gain, ss, st){ return ord + gain + plSSTax(ss, ord + gain, st); }
function plOrdTaxable(ord, gain, ss, st, seniors){
  var tss = plSSTax(ss, ord + gain, st), oa = ord + tss, agi = oa + gain;
  var ded = FED_STD[st] + SENIOR_ADDL[st] * seniors;
  if (seniors > 0) ded += seniors * Math.max(0, SENIOR_BONUS.amount - SENIOR_BONUS.rate * Math.max(0, agi - SENIOR_BONUS.start[st]));
  return Math.max(0, oa - ded);
}
/* Largest x in [0, max] with f(x) <= 0, for an f that only rises. */
function plLargest(f, max){
  if (!(max > 0) || f(0) > 0) return 0;
  if (f(max) <= 0) return max;
  var lo = 0, hi = max;
  for (var i = 0; i < 30 && hi - lo > 5; i++){
    var mid = (lo + hi) / 2;
    if (f(mid) <= 0) lo = mid; else hi = mid;
  }
  return lo;
}

/* ---- health insurance before 65 ----
   The benchmark Silver premium for each of you still under 65, less the
   premium tax credit the year's income earns (2026 rules: the 400% cliff is
   back). Below 138% of the poverty line an expansion state moves you to
   Medicaid; below 100% in a state that didn't expand there's no help at all.
   ACA income counts all of Social Security, taxable or not. */
var PL_NOEXP = {AL:1, FL:1, GA:1, KS:1, MS:1, SC:1, TN:1, TX:1, WI:1, WY:1};
function plHealth(C, y, magi){
  var gross = C.acaGross[y];
  if (!(gross > 0)) return 0;
  var pct = magi / C.fpl;
  if (pct < 1.38 && !PL_NOEXP[C.state]) return 0;
  if (pct < 1) return gross * 12;
  return hcCalcACA(magi, gross, pct, false).net * 12;
}

/* ---- the household, ready to run ----
   `P` is the plan at retirement (plAtRetire builds it from today's numbers):
     status "s"|"m", state, age1 (yours at retirement), age2 (spouse's then),
     years, trad, roth, rothBasis, brok, brokBasis, spend (a year's living
     costs after tax), strategy and its settings, minSpend, pia1 and pia2
     (monthly benefits at full retirement age), pension (a year) from
     pensionAge, pensionCola, aca, household, premium (optional monthly
     benchmark for the household), rule55, heirRate, mix (stock %), rmdAge,
     fromYear.
   Everything that doesn't depend on the tactics is worked out once here. */
function plPrep(P){
  var n = Math.max(1, Math.round(P.years)), st = P.status === "m" ? "m" : "s";
  var C = {P:P, years:n, status:st, state:P.state || "IL", married:st === "m",
    age1:Math.round(P.age1), age2:st === "m" && isFinite(P.age2) ? Math.round(P.age2) : null,
    trad:Math.max(0, P.trad || 0), roth:Math.max(0, P.roth || 0), brok:Math.max(0, P.brok || 0),
    spend:Math.max(0, P.spend || 0), heir:P.heirRate == null ? PL_HEIR : P.heirRate,
    pension:Math.max(0, P.pension || 0), cola:!!P.pensionCola,
    rule55:!!P.rule55 && Math.round(P.age1) >= 55,
    penRate:0.10 + (P.state === "CA" ? 0.025 : 0),
    mix:plMix(P.mix == null ? 60 : P.mix), cache:plTaxCache(st, P.state || "IL"),
    pend:new Float64Array(5)};
  C.rothBasis = Math.min(C.roth, Math.max(0, P.rothBasis == null ? C.roth * .5 : P.rothBasis));
  C.brokBasis = Math.min(C.brok, Math.max(0, P.brokBasis == null ? C.brok : P.brokBasis));
  C.pensionAge = P.pensionAge == null ? C.age1 : Math.round(P.pensionAge);
  C.rmdAge = P.rmdAge || 75;
  C.fpl = hcFPL(Math.max(P.household || (C.married ? 2 : 1), C.married ? 2 : 1));
  C.total0 = C.trad + C.roth + C.brok;
  C.rate = C.total0 > 0 ? C.spend / C.total0 : 0;
  C.early = new Uint8Array(n); C.seniors = new Uint8Array(n);
  C.rmdDiv = new Float64Array(n); C.acaGross = new Float64Array(n);
  var d = C.age2 == null ? 0 : C.age2 - C.age1;
  C.gap = d;
  // A benchmark premium the household found is for the ages at retirement;
  // later years scale by each person's own step on the age curve.
  var m0 = 0;
  if (P.premium > 0){
    if (C.age1 < 65) m0 += hcAgeMultiplier(C.age1);
    if (C.age2 != null && C.age2 < 65) m0 += hcAgeMultiplier(C.age2);
  }
  for (var y = 0; y < n; y++){
    var a1 = C.age1 + y, a2 = C.age2 == null ? null : C.age2 + y;
    C.early[y] = a1 < PL_EARLY ? 1 : 0;
    C.seniors[y] = (a1 >= 65 ? 1 : 0) + (a2 != null && a2 >= 65 ? 1 : 0);
    C.rmdDiv[y] = a1 >= C.rmdAge ? ultDivisor(Math.min(100, a1)) : 0;
    if (P.aca){
      var g = 0;
      if (P.premium > 0 && m0 > 0){
        if (a1 < 65) g += P.premium * hcAgeMultiplier(a1) / m0;
        if (a2 != null && a2 < 65) g += P.premium * hcAgeMultiplier(a2) / m0;
      } else {
        if (a1 < 65) g += hcGrossPremium(C.state, a1, 0);
        if (a2 != null && a2 < 65) g += hcGrossPremium(C.state, a2, 0);
      }
      C.acaGross[y] = g;
    }
  }
  return C;
}

/* ---- tactics ----
   The choices the optimizer makes. c1 and c2: the age each of you claims
   Social Security. f: how far each year's traditional withdrawals fill the
   tax brackets before the brokerage or Roth is touched (PL_FILLS). u: how
   long the unspent part of that fill is converted to Roth (0 never, 1 until
   Social Security starts, 2 until required distributions start). im: keep
   income under Medicare's first surcharge line from 63. ac: keep income
   under the ACA subsidy cliff before 65. */
var PL_FILLS = ["none", "zero", "b10", "b12", "b22", "b24"];
function plFillLevel(st, f){
  if (!(f > 0)) return -1;
  if (f === 1) return 0;
  var b = FED_2026[st];
  return b[f - 1][0];     // zero-based: f 2 -> top of 10% (start of 12%), ...
}
function plClaimMin(age){ return Math.max(62, Math.min(70, Math.round(age))); }
/* Each of you's own benefit at the age you claim it, a year, and any
   spousal top-up: that starts once both have claimed, reduced for the age of
   the one receiving it then. both1 is your age when it starts. */
function plSSParts(C, T){
  var P = C.P, c1 = T.c1, c2 = T.c2, pia1 = Math.max(0, P.pia1 || 0), pia2 = C.married ? Math.max(0, P.pia2 || 0) : 0;
  var o = {own1:pia1 * 12 * ssEstimate(0, 35, c1).adjustment,
    own2:C.married ? pia2 * 12 * ssEstimate(0, 35, c2).adjustment : 0, top1:0, top2:0, both1:c1};
  if (C.married){
    var d = C.gap;                         // spouse's age minus yours
    o.both1 = Math.max(c1, c2 - d);
    o.top1 = Math.max(0, .5 * pia2 - pia1) * 12 * ssSpousalAdj(Math.min(70, o.both1));
    o.top2 = Math.max(0, .5 * pia1 - pia2) * 12 * ssSpousalAdj(Math.min(70, o.both1 + d));
  }
  o.total = o.own1 + o.own2 + o.top1 + o.top2;
  return o;
}
function plTactics(C, T){
  var n = C.years, st = C.status;
  var K = {T:T, ss:new Float64Array(n), fill:new Float64Array(n), conv:new Uint8Array(n),
    capIr:new Uint8Array(n), capAca:new Uint8Array(n)};
  var c1 = T.c1, c2 = T.c2, S = plSSParts(C, T);
  var own1 = S.own1, own2 = S.own2, top1 = S.top1, top2 = S.top2, both1 = S.both1;
  var lvl = plFillLevel(st, T.f);
  var until = T.u === 1 ? Math.max(c1, C.married ? c2 - C.gap : c1) - 1 : T.u === 2 ? C.rmdAge - 1 : -1;
  for (var y = 0; y < n; y++){
    var a1 = C.age1 + y, a2 = C.age2 == null ? null : C.age2 + y, ss = 0;
    if (a1 >= c1) ss += own1;
    if (a2 != null && a2 >= c2) ss += own2;
    if (C.married && a1 >= both1) ss += top1 + top2;
    K.ss[y] = ss;
    K.fill[y] = lvl;
    K.conv[y] = lvl >= 0 && T.u > 0 && a1 <= until ? 1 : 0;
    K.capIr[y] = T.im && a1 >= 63 ? 1 : 0;
    K.capAca[y] = T.ac && C.acaGross[y] > 0 ? 1 : 0;
  }
  return K;
}
function plBaseTactics(C){
  var P = C.P, pickFor = function(c, age){
    var lo = plClaimMin(age);
    return c != null && isFinite(c) ? Math.max(lo, Math.min(70, Math.round(c))) : Math.max(67, lo);
  };
  var c1 = pickFor(P.claim1, C.age1);
  var c2 = C.married ? pickFor(P.claim2, C.age2) : c1;
  return {c1:c1, c2:c2, f:0, u:0, im:0, ac:0};
}
function plKey(T){ return T.c1 + "," + T.c2 + "," + T.f + "," + T.u + "," + T.im + "," + T.ac; }

/* ---- spending ----
   How much there is to live on this year, after tax, in today's dollars:
   the Drawdown Simulator's six withdrawal strategies, worked in real terms
   on the whole portfolio. Every strategy starts at the plan's own spending;
   the flexible ones then follow the balance, never going under the minimum
   while money remains. */
function plSpend(C, y, bal, prev){
  var P = C.P, s = P.strategy || "fixed", w;
  if (s === "fixed") return C.spend;
  var rate = C.rate;
  if (s === "pct") w = bal * rate;
  else if (s === "guardrails"){
    w = y === 0 ? C.spend : prev;
    if (bal > 0){
      var cur = w / bal, band = (P.guardBand == null ? 20 : P.guardBand) / 100, adj = (P.adjustPct == null ? 10 : P.adjustPct) / 100;
      if (cur > rate * (1 + band)) w *= 1 - adj;
      else if (cur < rate * (1 - band)) w *= 1 + adj;
    }
  } else if (s === "floorceil"){
    var base = y === 0 ? C.spend : prev;
    w = Math.min(Math.max(bal * rate, base * (1 - (P.floorPct == null ? 10 : P.floorPct) / 100)),
      base * (1 + (P.ceilPct == null ? 10 : P.ceilPct) / 100));
  } else if (s === "vpw"){
    w = Math.max(0, pmtStart((P.vpwRate == null ? 4 : P.vpwRate) / 100, C.years - y, bal, P.vpwFV || 0));
  } else {
    var wt = (P.yaleWeight == null ? 70 : P.yaleWeight) / 100;
    w = y === 0 ? C.spend : wt * prev + (1 - wt) * bal * rate;
  }
  if (P.minSpend > 0 && w < P.minSpend) w = P.minSpend;
  return w;
}

/* ---- one year ----
   The sources a year can draw on, in the order it draws them:
     FLEX  traditional money already planned for this year by a bracket
           fill (its tax is counted whether it's spent or converted)
     BROK  the brokerage: only the gain is taxed
     TRAD  more traditional money: ordinary income, and before 59½ the
           10% additional tax unless the rule of 55 opens it
     ROTH  Roth money that can come out free: all of it after 59½, before
           then contributions and conversions at least five years old
     ROTHE the rest of the Roth before 59½: taxed and penalized, last resort
   A plan with no fill draws brokerage, then traditional, then Roth. */
var PL_SRC_N = 5;
var PL_ORDER_DEF = [1, 2, 3, 4], PL_ORDER_FILL = [0, 1, 3, 2, 4];
var plAv = new Float64Array(PL_SRC_N), plTk = new Float64Array(PL_SRC_N);
// scratch results of plEv
var plE = {net:0, tax:0, pen:0, health:0, irm:0, ord:0, gain:0, agi:0, magi:0};
function plEv(C, Y, x){
  var o = Y.order, rem = x, ordAdd = 0, gain = 0, penBase = 0;
  for (var k = 0; k < o.length; k++){
    var s = o[k], a = plAv[s], t = a < rem ? a : rem;
    if (!(t > 0)){ continue; }
    rem -= t;
    if (s === 0){ if (!Y.conv) ordAdd += t; }
    else if (s === 1) gain += t * Y.gs;
    else if (s === 2){ ordAdd += t; if (Y.pen) penBase += t; }
    else if (s === 4){ ordAdd += t; penBase += t; }
    if (rem <= 0) break;
  }
  var ord = Y.baseOrd + ordAdd;
  var tax = plTax(C.cache, Y.seniors, Y.ss, ord, gain);
  var agi = plAgi(ord, gain, Y.ss, C.status);
  var magi = ord + gain + Y.ss;
  var hl = Y.aca ? plHealth(C, Y.y, magi) : 0;
  var irm = Y.people > 0 ? irmaaAnnual(Y.look >= 0 ? Y.look : agi, C.status, Y.people) : 0;
  var pen = penBase * C.penRate;
  plE.net = Y.cash + x - Y.w - tax - hl - irm - pen;
  plE.tax = tax; plE.pen = pen; plE.health = hl; plE.irm = irm;
  plE.ord = ord; plE.gain = gain; plE.agi = agi; plE.magi = magi;
  return plE.net;
}
/* The smallest draw down the source list that pays for spending plus the
   tax, penalty and premiums that draw itself causes. Health premiums can
   jump at the subsidy cliff, so net isn't always monotonic: a bracketing
   search with secant steps, as the Bridge tool uses. Leaves the answer in
   plE and returns the draw. */
function plSolve(C, Y, total){
  var n0 = plEv(C, Y, 0);
  if (n0 >= 0 || !(total > 0)) return 0;
  var lo = 0, nlo = n0, hi = -1, nhi = 0, x = Math.min(total, -n0 * 1.15), r;
  for (var it = 0; it < 40; it++){
    r = plEv(C, Y, x);
    if (r >= 0){ hi = x; nhi = r; if (r < 1) break; }
    else { lo = x; nlo = r; if (x >= total) break; }
    var nx;
    if (hi < 0) nx = Math.min(total, x - r * 1.25 + 1);
    else {
      if (hi - lo < 0.5){ x = hi; plEv(C, Y, hi); break; }
      nx = lo + (hi - lo) * (-nlo) / (nhi - nlo);
      if (!(nx > lo && nx < hi) || it % 3 === 2) nx = (lo + hi) / 2;
    }
    x = nx;
  }
  if (plE.net < 0 && hi >= 0){ x = hi; plEv(C, Y, hi); }
  return x;
}

/* ---- one retirement along one market path ----
   R and PI are real returns and inflation by calendar year, read from
   `off`. `out` asks for detail: out.path (end-of-year total, real),
   out.lived (what was actually lived on), out.rows (everything, for the
   year-by-year table). Returns the run's summary. */
var plY = {y:0, order:null, conv:0, pen:0, gs:0, baseOrd:0, seniors:0, ss:0, aca:0, people:0,
  look:-1, cash:0, w:0};
function plRun(C, K, R, PI, off, out){
  var n = C.years, st = C.status, P = C.P;
  var trad = C.trad, roth = C.roth, rAcc = C.rothBasis, brok = C.brok, bBasis = C.brokBasis;
  var pend = C.pend; pend.fill(0);
  var m1 = -1, m2 = -1;               // AGI one and two years back, for IRMAA
  var cum = 1, prev = C.spend, lastGain = 0;
  var tax = 0, pen = 0, health = 0, irm = 0, conv = 0, shortSum = 0, depleted = 0, lived = 0;
  var path = out && out.path, livedArr = out && out.lived, rows = out && out.rows;
  var Y = plY;
  for (var y = 0; y < n; y++){
    var a1 = C.age1 + y, early = C.early[y] === 1;
    var slot = y % 5;
    rAcc += pend[slot]; pend[slot] = 0;          // a rung five years old opens up
    var ss = K.ss[y];
    var pension = C.pension > 0 && a1 >= C.pensionAge ? (C.cola ? C.pension : C.pension / cum) : 0;
    var bal = trad + roth + brok;
    var w = plSpend(C, y, bal, prev);
    prev = w;
    var M = C.rmdDiv[y] > 0 && trad > 0 ? Math.min(trad, trad / C.rmdDiv[y]) : 0;
    var seniors = C.seniors[y];
    var pn = early && !C.rule55;
    // The fill: traditional income planned for the year, up to the target
    // level of taxable income and under any income line being guarded.
    var D = M, lvl = K.fill[y], convY = K.conv[y] === 1;
    var fillOn = lvl >= 0 && trad > M && (convY || !pn);
    // The gain this year's brokerage sales will realize isn't known until
    // the year is solved; last year's stands in, and the guards below
    // correct for any difference.
    var gs0 = brok > 0 ? Math.max(0, 1 - bBasis / brok) : 0;
    var g0 = y > 0 ? lastGain : Math.min(brok, Math.max(0, w - ss - pension - M)) * gs0;
    if (fillOn){
      D = M + plLargest(function(t){ return plOrdTaxable(pension + M + t, g0, ss, st, seniors) - lvl; }, trad - M);
      if (K.capIr[y]){
        var lim = IRMAA.tiers[0][st] - 2000;
        D = Math.min(D, M + plLargest(function(t){ return plAgi(pension + M + t, g0, ss, st) - lim; }, trad - M));
      }
      if (K.capAca[y]) D = Math.min(D, Math.max(M, C.fpl * 4 - 1500 - pension - ss - g0));
      if (D < M) D = M;
    }
    var flex = D - M;
    // What each source can give this year.
    plAv[0] = pn ? 0 : flex;
    plAv[1] = brok;
    plAv[2] = Math.max(0, trad - D);
    var rOpen = early ? Math.min(roth, rAcc) : roth;
    plAv[3] = rOpen;
    plAv[4] = early ? Math.max(0, roth - rOpen) : 0;
    var total = plAv[0] + plAv[1] + plAv[2] + plAv[3] + plAv[4];
    Y.y = y; Y.order = (fillOn || pn) ? PL_ORDER_FILL : PL_ORDER_DEF;
    Y.conv = convY && flex > 0 ? 1 : 0;
    Y.pen = pn ? 1 : 0;
    Y.gs = brok > 0 ? Math.max(0, 1 - bBasis / brok) : 0;
    Y.baseOrd = pension + (Y.conv ? D : M);
    Y.seniors = seniors; Y.ss = ss;
    Y.aca = C.acaGross[y] > 0 ? 1 : 0;
    Y.people = seniors;
    Y.look = m2;
    Y.cash = ss + pension + M;
    Y.w = w;
    var x = plSolve(C, Y, total);
    // A guarded line crossed anyway (the brokerage's gain came in higher than
    // expected): pull the fill back by the overshoot and solve again.
    if (fillOn && flex > 0 && (K.capAca[y] || K.capIr[y])){
      for (var it = 0; it < 3; it++){
        var over = 0;
        if (K.capAca[y] && Y.aca) over = Math.max(over, plE.magi - (C.fpl * 4 - 1500));
        if (K.capIr[y]) over = Math.max(over, plE.agi - (IRMAA.tiers[0][st] - 2000));
        if (!(over > 1)) break;
        var cut = Math.min(flex, over + 250);
        D -= cut; flex -= cut;
        plAv[0] = pn ? 0 : flex;
        plAv[2] = Math.max(0, trad - D);
        Y.conv = convY && flex > 0 ? 1 : 0;
        Y.baseOrd = pension + (Y.conv ? D : M);
        total = plAv[0] + plAv[1] + plAv[2] + plAv[3] + plAv[4];
        x = plSolve(C, Y, total);
        if (!(flex > 0)) break;
      }
    }
    var net = plE.net, short = net < -1 ? -net : 0, surplus = net > 0 ? net : 0;
    // Where it came from.
    var rem = x, o = Y.order;
    for (var k = 0; k < PL_SRC_N; k++) plTk[k] = 0;
    for (k = 0; k < o.length && rem > 0; k++){
      var s = o[k], t = plAv[s] < rem ? plAv[s] : rem;
      if (t > 0){ plTk[s] = t; rem -= t; }
    }
    var Cv = Y.conv ? flex - plTk[0] : 0;
    // Move the money.
    trad -= M + plTk[0] + Cv + plTk[2];
    var gs = Y.gs;
    bBasis -= plTk[1] * (1 - gs); brok -= plTk[1];
    if (early){ rAcc -= plTk[3]; if (rAcc < 0) rAcc = 0; }
    roth += Cv - plTk[3] - plTk[4];
    if (Cv > 0) pend[slot] = Cv;
    if (surplus > 0){ brok += surplus; bBasis += surplus; }
    if (trad < 0) trad = 0;
    if (roth < 0) roth = 0;
    if (brok < 0) brok = 0;
    if (bBasis < 0) bBasis = 0;
    tax += plE.tax + plE.pen; pen += plE.pen; health += plE.health; irm += plE.irm; conv += Cv;
    // VPW spends down to nothing on purpose; its last year coming up short
    // is the plan, not a failure.
    if (short > 0 && !(P.strategy === "vpw" && y === n - 1)){ shortSum += short; if (!depleted) depleted = y + 1; }
    var livedY = Math.max(0, w - short);
    lived += livedY;
    lastGain = plE.gain;
    m2 = m1; m1 = plE.agi;
    if (rows){
      rows.push({y:y, age:a1, age2:C.age2 == null ? null : C.age2 + y, spend:w, lived:livedY,
        ss:ss, pension:pension, rmd:M, trad:M + plTk[0] + plTk[2], conv:Cv, brok:plTk[1],
        roth:plTk[3] + plTk[4], tax:plE.tax, pen:plE.pen, health:plE.health, irmaa:plE.irm,
        agi:plE.agi, magi:plE.magi, ord:plE.ord, gain:plE.gain,
        taxable:plOrdTaxable(plE.ord, plE.gain, ss, st, seniors),
        fplPct:Y.aca ? plE.magi / C.fpl : null, short:short, surplus:surplus,
        startTrad:0, endTrad:0, endRoth:0, endBrok:0, end:0});
    }
    // A year of markets.
    var g = 1 + R[off + y], d = 1 + PI[off + y];
    trad *= g; roth *= g; brok *= g;
    bBasis /= d; rAcc /= d; cum *= d;
    for (var q = 0; q < 5; q++) pend[q] /= d;
    if (bBasis > brok) bBasis = brok;
    if (path) path[y] = trad + roth + brok;
    if (livedArr) livedArr[y] = livedY;
    if (rows){ var rr = rows[rows.length - 1]; rr.endTrad = trad; rr.endRoth = roth; rr.endBrok = brok; rr.end = trad + roth + brok; }
  }
  return {ok:!depleted, depleted:depleted, short:shortSum, tax:tax, pen:pen, health:health,
    irmaa:irm, conv:conv, lived:lived, end:trad + roth + brok, trad:trad, roth:roth, brok:brok,
    legacy:roth + brok + trad * (1 - C.heir)};
}

/* ---- testing a plan ----
   The steady path: every year at the mix's long-run average. */
function plSteady(C){
  if (C.steady) return C.steady;
  var n = C.years, r = new Float64Array(n), pi = new Float64Array(n);
  r.fill(C.mix.real); pi.fill(C.mix.infl);
  return (C.steady = {r:r, pi:pi});
}
/* The historical starting years with enough record to run the whole plan. */
function plStarts(C){
  var n = C.mix.n, from = Math.max(0, Math.min(n - 1, Math.round((C.P.fromYear || HIST_START) - HIST_START)));
  var out = [];
  for (var s = from; s + C.years <= n; s++) out.push(s);
  if (!out.length) out.push(Math.max(0, n - C.years));
  return out;
}
function plDetail(C, T){
  var K = plTactics(C, T), S = plSteady(C), out = {rows:[], path:new Float64Array(C.years)};
  var r = plRun(C, K, S.r, S.pi, 0, out);
  r.rows = out.rows; r.path = out.path;
  return r;
}
function plMedian(a){
  if (!a.length) return 0;
  var s = Array.prototype.slice.call(a).sort(function(p, q){ return p - q; });
  return s[Math.floor(s.length / 2)];
}
function plQuant(sorted, q){ return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] : 0; }
/* Every historical start. opts.paths keeps each run's balances and what was
   lived on (for charts); opts.stopAfter gives up once that many runs have
   failed, for searches that only need to know whether a plan clears a bar. */
function plHistory(C, T, opts){
  opts = opts || {};
  var K = plTactics(C, T), M = C.mix, starts = plStarts(C), runs = [], fails = [];
  var legs = [], taxes = [], survived = 0;
  for (var i = 0; i < starts.length; i++){
    var out = opts.paths ? {path:new Float64Array(C.years), lived:new Float64Array(C.years)} : null;
    var r = plRun(C, K, M.r, M.pi, starts[i], out);
    r.startYear = HIST_START + starts[i];
    if (out){ r.path = out.path; r.livedPath = out.lived; }
    runs.push(r);
    if (r.ok) survived++; else fails.push(r.startYear);
    legs.push(r.legacy); taxes.push(r.tax);
    if (opts.stopAfter != null && fails.length > opts.stopAfter) break;
  }
  legs.sort(function(p, q){ return p - q; });
  var ends = runs.map(function(r){ return r.end; }).sort(function(p, q){ return p - q; });
  return {T:T, runs:runs, total:runs.length, survived:survived,
    successRate:runs.length ? survived / runs.length : 0, failYears:fails,
    first:HIST_START + starts[0], medLegacy:plQuant(legs, .5), p10Legacy:plQuant(legs, .1),
    medTax:plMedian(taxes), medianEnd:plQuant(ends, .5), worstEnd:ends[0] || 0,
    partial:runs.length < starts.length};
}

/* ---- from today to retirement ----
   Today's balances and saving, grown to the retirement age at a steady real
   return (each account on the same schedule, so the total is exactly the
   Basic projection), and turned into the plan plRun takes. `I`:
     status, state, age, spouseAge, retire, stopAge (null = save to the end),
     trad, roth, rothBasis, brok, brokBasis, saveTrad, saveRoth, saveBrok
     (monthly, today's dollars; an employer's match belongs in saveTrad),
     real, infl, and everything else plPrep reads, passed straight through. */
function plAtRetire(I){
  var age = I.age, retire = Math.max(age, I.retire), yrs = retire - age;
  var stop = I.stopAge != null && I.stopAge < retire ? Math.max(age, I.stopAge) : retire;
  var sy = stop - age, infl = I.infl == null ? 0.03 : I.infl;
  var A = plGrow(1, 0, I.real, yrs, sy, infl), B = plGrow(0, 1, I.real, yrs, sy, infl);
  var at = function(bal, mo){ return bal * A.fv + mo * B.fv; };
  var P = Object.assign({}, I);
  P.trad = at(I.trad || 0, I.saveTrad || 0);
  P.roth = at(I.roth || 0, I.saveRoth || 0);
  P.brok = at(I.brok || 0, I.saveBrok || 0);
  // Basis and Roth contributions are dollars in, which inflation erodes.
  var dfl = Math.pow(1 + infl, yrs), inYrs = 0;
  for (var k = 0; k < Math.floor(sy + 1e-9); k++) inYrs += 12 / Math.pow(1 + infl, yrs - k - 0.5);
  var bb0 = I.brokBasis == null ? (I.brok || 0) : I.brokBasis;
  var rb0 = I.rothBasis == null ? (I.roth || 0) * .5 : I.rothBasis;
  P.brokBasis = Math.min(P.brok, bb0 / dfl + (I.saveBrok || 0) * inYrs);
  P.rothBasis = Math.min(P.roth, rb0 / dfl + (I.saveRoth || 0) * inYrs);
  P.age1 = Math.round(retire);
  P.age2 = I.status === "m" && isFinite(I.spouseAge) ? Math.round(I.spouseAge + yrs) : null;
  P.rmdAge = rmdStartAge(Math.round(age));
  P.grow = {A:A, B:B, years:yrs};
  P.path = A.path.map(function(v, i){
    return v * ((I.trad || 0) + (I.roth || 0) + (I.brok || 0)) +
      B.path[i] * ((I.saveTrad || 0) + (I.saveRoth || 0) + (I.saveBrok || 0));
  });
  P.fv = P.trad + P.roth + P.brok;
  return P;
}

/* ---------- the Plan Optimizer ----------
   Every combination of tactics -- each claiming age for each of you, each
   bracket fill, conversion window and income guard -- run through every
   historical start since 1926. For a couple that is a few thousand plans and
   a few hundred thousand retirements, which is why it reports its progress:
   it's a generator, and the last value it yields is the answer. For the
   Spend the most goal, the strongest finalists then have their highest safe
   spending found. `goal` is "legacy", "last" or "spend". */
var PL_GOALS = {legacy:"Leave the most", last:"Make it last", spend:"Spend the most"};
function plCombos(C, T0){
  var P = C.P, out = [], seen = {};
  var lo1 = plClaimMin(C.age1), lo2 = C.married ? plClaimMin(C.age2) : lo1;
  var claims = [];
  if (!(P.pia1 > 0) && !(C.married && P.pia2 > 0)) claims = [[T0.c1, T0.c2]];
  else for (var c1 = lo1; c1 <= 70; c1++){
    if (!C.married) claims.push([c1, c1]);
    else for (var c2 = lo2; c2 <= 70; c2++) claims.push([c1, c2]);
  }
  var hasAca = false, hasIr = C.age1 + C.years > 63;
  for (var y = 0; y < C.years; y++) if (C.acaGross[y] > 0) hasAca = true;
  var add = function(T){ var k = plKey(T); if (!seen[k]){ seen[k] = 1; out.push(T); } };
  add(T0);
  claims.forEach(function(cl){
    add({c1:cl[0], c2:cl[1], f:0, u:0, im:0, ac:0});
    if (!(C.trad > 0)) return;
    for (var f = 1; f < PL_FILLS.length; f++) for (var u = 0; u < 3; u++)
      for (var im = 0; im < (hasIr ? 2 : 1); im++) for (var ac = 0; ac < (hasAca ? 2 : 1); ac++)
        add({c1:cl[0], c2:cl[1], f:f, u:u, im:im, ac:ac});
  });
  return out;
}
/* Positive when plan a beats plan b for the goal. Leave the most never
   trades away safety: a plan has to last in at least as many markets as the
   default (or the target, if that's lower) before what it leaves counts. */
function plBetter(goal, a, b, floor){
  if (goal === "spend"){
    if (Math.abs((a.maxSpend || 0) - (b.maxSpend || 0)) > 1) return (a.maxSpend || 0) - (b.maxSpend || 0);
    return a.medLegacy - b.medLegacy;
  }
  if (goal === "last"){
    var d = a.survived - b.survived;
    if (d) return d;
    return (a.p10Legacy - b.p10Legacy) + (a.medLegacy - b.medLegacy) * 0.2;
  }
  var okA = a.successRate >= floor - 1e-9, okB = b.successRate >= floor - 1e-9;
  if (okA !== okB) return okA ? 1 : -1;
  if (!okA) return (a.survived - b.survived) || (a.medLegacy - b.medLegacy);
  return a.medLegacy - b.medLegacy;
}
/* The same household with a few plan numbers changed (the tax cache and
   the per-year tables carry over). */
function plWith(C, over){
  var C2 = Object.assign({}, C);
  C2.P = Object.assign({}, C.P, over);
  if ("spend" in over){
    C2.spend = over.spend;
    C2.rate = C2.total0 > 0 ? over.spend / C2.total0 : 0;
  }
  C2.pend = new Float64Array(5);
  return C2;
}
/* Highest spending, to $250, that lasts in the target share of history. */
function plMaxSpend(C, T, target){
  var maxFail = Math.floor(plStarts(C).length * (1 - target) + 1e-9);
  var ok = function(sp){
    var H = plHistory(plWith(C, {spend:sp}), T, {stopAfter:maxFail});
    return !H.partial && H.total - H.survived <= maxFail;
  };
  if (!ok(1)) return 0;
  var lo = 1, hi = Math.max(C.spend * 1.5, 1000), guard = 0;
  while (ok(hi) && guard++ < 8){ lo = hi; hi *= 1.6; }
  for (var i = 0; i < 16 && hi - lo > 250; i++){
    var m = (lo + hi) / 2;
    if (ok(m)) lo = m; else hi = m;
  }
  return Math.floor(lo / 250) * 250;
}
function plStats(H){
  return {successRate:H.successRate, survived:H.survived, total:H.total,
    medLegacy:H.medLegacy, p10Legacy:H.p10Legacy, medTax:H.medTax, failYears:H.failYears};
}
function* plOptimize(P, goal){
  goal = PL_GOALS[goal] ? goal : "legacy";
  var target = P.target || 0.9;
  P = Object.assign({}, P, {strategy:"fixed"});
  var C = plPrep(P), T0 = plBaseTactics(C);
  var starts = plStarts(C), W = starts.length, t0 = Date.now();
  var combos = plCombos(C, T0), N = combos.length;
  var nSpend = goal === "spend" ? 12 : 0;
  var all = N + 4 + nSpend * 10, done = 0;
  var best = null, floor = 1;
  var prog = function(phase, T){
    var o = {type:"progress", phase:phase, frac:Math.min(0.995, done / all), tried:Math.min(done, N), of:N,
      windows:W, first:HIST_START + starts[0], ms:Date.now() - t0};
    if (T) o.T = T;
    if (best) o.best = {medLegacy:best.medLegacy, successRate:best.successRate, T:best.T};
    return o;
  };
  yield prog("start");

  var HB = plHistory(C, T0, {paths:true}), base = plStats(HB);
  floor = Math.min(base.successRate, target);
  var rank = function(a, b){ return plBetter(goal, b, a, floor); };
  var rec = [];
  for (var i = 0; i < N; i++){
    var T = combos[i], r = Object.assign({T:T}, plKey(T) === plKey(T0) ? base : plStats(plHistory(C, T, {})));
    rec.push(r);
    if (goal !== "spend" && (!best || plBetter(goal, r, best, floor) > 0)) best = r;
    else if (goal === "spend" && (!best || plBetter("last", r, best, floor) > 0)) best = r;
    done++;
    if (i % 24 === 23) yield prog("search", T);
  }
  rec.sort(goal === "spend" ? function(a, b){ return plBetter("last", b, a, floor); } : rank);

  if (goal === "spend"){
    // The finalists: the plans that hold up best in bad markets, and the
    // ones that leave the most, which usually have room to spend too.
    var byLeg = rec.slice().sort(function(a, b){ return b.medLegacy - a.medLegacy; });
    var cands = [], seenF = {};
    var take = function(r){ var k = plKey(r.T); if (!seenF[k] && cands.length < nSpend){ seenF[k] = 1; cands.push(r); } };
    take(rec.find(function(r){ return plKey(r.T) === plKey(T0); }) || Object.assign({T:T0}, base));
    for (i = 0; cands.length < 8 && i < rec.length; i++) take(rec[i]);
    for (i = 0; cands.length < nSpend && i < byLeg.length; i++) take(byLeg[i]);
    for (i = 0; i < cands.length; i++){
      cands[i].maxSpend = plMaxSpend(C, cands[i].T, target);
      if (plKey(cands[i].T) === plKey(T0)) base.maxSpend = cands[i].maxSpend;
      done += 10;
      yield prog("spend", cands[i].T);
    }
    cands.sort(rank);
    best = cands[0];
  } else best = rec[0];

  // How much of the gain each kind of change brings: Social Security timing
  // alone, then the withdrawal order and conversions on top, then the income
  // guards. Every step is tested through all of history.
  var bT = best.T, steps = [];
  var find = function(T){
    var k = plKey(T), r = rec.find(function(x){ return plKey(x.T) === k; });
    if (!r) r = Object.assign({T:T}, plStats(plHistory(C, T, {})));
    if (goal === "spend" && r.maxSpend == null) r.maxSpend = plMaxSpend(C, T, target);
    return r;
  };
  var chain = [["ss", {c1:bT.c1, c2:bT.c2, f:0, u:0, im:0, ac:0}], ["draw", bT]];
  var prevS = Object.assign({T:T0}, base), prevK = plKey(T0);
  chain.forEach(function(c){
    var k = plKey(c[1]);
    if (k === prevK) return;
    var s = k === plKey(bT) ? best : find(c[1]);
    steps.push({key:c[0], T:c[1], from:prevS, to:s});
    prevS = s; prevK = k;
  });
  done = all - 2;
  yield prog("finish");

  // The detail: both plans on the steady path, and across history for charts.
  // For Spend the most, each plan is drawn at its own highest safe spending,
  // so the roadmap, charts and table show the answer, not the spending typed in.
  var Cb = C, C0 = C, HB0 = HB;
  if (goal === "spend"){
    if (best.maxSpend > 0) Cb = plWith(C, {spend:best.maxSpend});
    if (base.maxSpend > 0){ C0 = plWith(C, {spend:base.maxSpend}); HB0 = plHistory(C0, T0, {paths:true}); }
    base = Object.assign(plStats(HB0), {maxSpend:base.maxSpend});
  }
  var HBest = plHistory(Cb, bT, {paths:true});
  var bestStats = plStats(HBest);
  if (goal === "spend"){ bestStats.maxSpend = best.maxSpend; }
  // The runners-up that do something different, for "other good plans".
  // Same claiming ages and the same kind of withdrawals, or the same result,
  // count as the same plan.
  var alts = [], seenA = {}, sig = function(r){ return Math.round(r.medLegacy) + "|" + r.survived; };
  var mark = function(r){ var t = r.T; seenA[t.c1 + "," + t.c2 + "," + (t.f > 0 ? 1 : 0)] = 1; seenA[sig(r)] = 1; };
  mark(best);
  var sorted = goal === "spend" ? [] : rec;
  for (i = 0; i < sorted.length && alts.length < 3; i++){
    var t = sorted[i].T;
    if (seenA[t.c1 + "," + t.c2 + "," + (t.f > 0 ? 1 : 0)] || seenA[sig(sorted[i])]) continue;
    mark(sorted[i]);
    alts.push(sorted[i]);
  }
  yield {type:"done", goal:goal, target:target, tried:N, of:N, windows:W, runs:N * W,
    first:HIST_START + starts[0], ms:Date.now() - t0, floor:floor, years:C.years,
    age1:C.age1, age2:C.age2, rmdAge:C.rmdAge, married:C.married,
    base:{T:T0, stats:base, detail:plDetail(C0, T0), bands:plBands(HB0, C.years), spend:C0.spend},
    best:{T:bT, stats:bestStats, detail:plDetail(Cb, bT), bands:plBands(HBest, C.years), spend:Cb.spend},
    steps:steps, alts:alts, same:plKey(bT) === plKey(T0)};
}
/* The 10th, 50th and 90th percentile of the total balance, year by year. */
function plBands(H, n){
  var out = [];
  for (var y = 0; y < n; y++){
    var col = H.runs.map(function(r){ return r.path ? r.path[y] : 0; }).sort(function(a, b){ return a - b; });
    out.push({p10:plQuant(col, .1), p50:plQuant(col, .5), p90:plQuant(col, .9)});
  }
  return out;
}
/* Runs the optimizer to the end in one go (tests, and the fallback when a
   worker isn't available and the caller doesn't need progress). */
function plOptimizeNow(P, goal){
  var g = plOptimize(P, goal), last = null, s;
  while (!(s = g.next()).done) last = s.value;
  return last;
}
// ===PLAN END===
;
/* ---------- the Plan Optimizer and the Drawdown Simulator, off the page ----------
   A few thousand plans through every historical market takes seconds, so the
   page hands the search to a worker and keeps drawing while it runs. The
   worker is the engine (math.js, drawdown.js and plan.js) plus this: run the
   search it's sent, and post back its progress, a few times a second, then
   the answer. A newer request, or a stop, replaces an older one. The
   Drawdown Simulator's Monte Carlo and searches run in a copy of its own. */
var plJob = 0;
self.onmessage = function(e){
  var d = e.data || {};
  // The Drawdown Simulator's jobs (a copy of this worker of its own): run it,
  // send back the answer, handing over the big number arrays, not copying them.
  if (d.type === "dd"){
    var res;
    try { res = ddJob(d.job, d.args); } catch (err) { res = {error: String(err)}; }
    var give = res && res.bal && res.bal.buffer ? [res.bal.buffer, res.spend.buffer] : [];
    self.postMessage({type: "dd", id: d.id, lane: d.lane, res: res}, give);
    return;
  }
  if (d.type === "stop"){ plJob++; return; }
  if (d.type !== "run") return;
  var job = ++plJob, g = plOptimize(d.P, d.goal), last = 0, s;
  var step = function(){
    var until = Date.now() + 120;
    while (Date.now() < until){
      if (job !== plJob) return;
      s = g.next();
      if (s.done) return;
      var v = s.value;
      if (v.type === "done"){ v.id = d.id; self.postMessage(v); return; }
      var now = Date.now();
      if (now - last > 50){ last = now; v.id = d.id; self.postMessage(v); }
    }
    // Let a newer request in between slices.
    setTimeout(step, 0);
  };
  step();
};
