/* The retirement plan engine: one household's retirement year by year and account by
   account, and the Plan Optimizer's search.

   Moved from src/js/plan.js without changes to the math: the only edits are
   `export` on each top-level name and the imports below. Import it
   through typed-bridge.ts, not this file: that loads core.js first, which
   loads math.js and drawdown.js (which read each other's names) in the
   order that works. */
import {
  FED_2026, FED_STD, SENIOR_ADDL, SENIOR_BONUS, SS_PROV, computeRetireTax, ultDivisor,
  rmdStartAge, IRMAA, irmaaAnnual, HIST_START, HIST_STOCK, HIST_BOND, HIST_INFL, pmtStart,
  ssEstimate, ssSpousalAdj, hcFPL, hcAgeMultiplier, hcGrossPremium, hcCalcACA
} from "./math.js";

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

export var PL_EARLY = 59;          // a year that starts before 59 ends before 59½
export var PL_HEIR = 0.24;         // default tax rate heirs pay on inherited traditional money

/* Real returns of a stock/bond mix by calendar year from 1926, inflation
   alongside, and their long-run averages: the steady path runs at the
   geometric mean. */
export var plMixMemo = {};
export function plMix(stock){
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
export function plGrow(initial, monthly, real, years, saveYears, infl){
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
export var PL_STEP = 500, PL_GRID = 4096;
export var plTaxCaches = {}, plTaxCacheN = 0;
export function plTaxCache(status, state){
  var k = status + state;
  if (!plTaxCaches[k]){
    if (++plTaxCacheN > 6){ plTaxCaches = {}; plTaxCacheN = 1; }
    plTaxCaches[k] = {status:status, state:state, maps:new Map()};
  }
  return plTaxCaches[k];
}
export function plTaxRaw(c, seniors, ss, ord, gain){
  return computeRetireTax({status:c.status, state:c.state, trad:ord, roth:0, brok:gain,
    gainPct:1, ss:ss, pension:0, penPublic:false, other:0, pre:0, dedType:"std", item:0,
    seniors:seniors, _noMarginal:true}).total;
}
export function plTax(c, seniors, ss, ord, gain){
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
export function plSSTax(ss, otherAgi, st){
  if (!(ss > 0)) return 0;
  var t1 = SS_PROV.t1[st], t2 = SS_PROV.t2[st], prov = Math.max(0, otherAgi) + ss / 2;
  if (prov <= t1) return 0;
  if (prov <= t2) return Math.min(.5 * (prov - t1), .5 * ss);
  return Math.min(.85 * (prov - t2) + Math.min(.5 * (t2 - t1), .5 * ss), .85 * ss);
}
export function plAgi(ord, gain, ss, st){ return ord + gain + plSSTax(ss, ord + gain, st); }
export function plOrdTaxable(ord, gain, ss, st, seniors){
  var tss = plSSTax(ss, ord + gain, st), oa = ord + tss, agi = oa + gain;
  var ded = FED_STD[st] + SENIOR_ADDL[st] * seniors;
  if (seniors > 0) ded += seniors * Math.max(0, SENIOR_BONUS.amount - SENIOR_BONUS.rate * Math.max(0, agi - SENIOR_BONUS.start[st]));
  return Math.max(0, oa - ded);
}
/* Largest x in [0, max] with f(x) <= 0, for an f that only rises. */
export function plLargest(f, max){
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
export var PL_NOEXP = {AL:1, FL:1, GA:1, KS:1, MS:1, SC:1, TN:1, TX:1, WI:1, WY:1};
export function plHealth(C, y, magi){
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
export function plPrep(P){
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
export var PL_FILLS = ["none", "zero", "b10", "b12", "b22", "b24"];
export function plFillLevel(st, f){
  if (!(f > 0)) return -1;
  if (f === 1) return 0;
  var b = FED_2026[st];
  return b[f - 1][0];     // zero-based: f 2 -> top of 10% (start of 12%), ...
}
export function plClaimMin(age){ return Math.max(62, Math.min(70, Math.round(age))); }
/* Each of you's own benefit at the age you claim it, a year, and any
   spousal top-up: that starts once both have claimed, reduced for the age of
   the one receiving it then. both1 is your age when it starts. */
export function plSSParts(C, T){
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
export function plTactics(C, T){
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
export function plBaseTactics(C){
  var P = C.P, pickFor = function(c, age){
    var lo = plClaimMin(age);
    return c != null && isFinite(c) ? Math.max(lo, Math.min(70, Math.round(c))) : Math.max(67, lo);
  };
  var c1 = pickFor(P.claim1, C.age1);
  var c2 = C.married ? pickFor(P.claim2, C.age2) : c1;
  return {c1:c1, c2:c2, f:0, u:0, im:0, ac:0};
}
export function plKey(T){ return T.c1 + "," + T.c2 + "," + T.f + "," + T.u + "," + T.im + "," + T.ac; }

/* ---- spending ----
   How much there is to live on this year, after tax, in today's dollars:
   the Drawdown Simulator's six withdrawal strategies, worked in real terms
   on the whole portfolio. Every strategy starts at the plan's own spending;
   the flexible ones then follow the balance, never going under the minimum
   while money remains. */
export function plSpend(C, y, bal, prev){
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
export var PL_SRC_N = 5;
export var PL_ORDER_DEF = [1, 2, 3, 4], PL_ORDER_FILL = [0, 1, 3, 2, 4];
export var plAv = new Float64Array(PL_SRC_N), plTk = new Float64Array(PL_SRC_N);
// scratch results of plEv
export var plE = {net:0, tax:0, pen:0, health:0, irm:0, ord:0, gain:0, agi:0, magi:0};
export function plEv(C, Y, x){
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
export function plSolve(C, Y, total){
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
export var plY = {y:0, order:null, conv:0, pen:0, gs:0, baseOrd:0, seniors:0, ss:0, aca:0, people:0,
  look:-1, cash:0, w:0};
export function plRun(C, K, R, PI, off, out){
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
export function plSteady(C){
  if (C.steady) return C.steady;
  var n = C.years, r = new Float64Array(n), pi = new Float64Array(n);
  r.fill(C.mix.real); pi.fill(C.mix.infl);
  return (C.steady = {r:r, pi:pi});
}
/* The historical starting years with enough record to run the whole plan. */
export function plStarts(C){
  var n = C.mix.n, from = Math.max(0, Math.min(n - 1, Math.round((C.P.fromYear || HIST_START) - HIST_START)));
  var out = [];
  for (var s = from; s + C.years <= n; s++) out.push(s);
  if (!out.length) out.push(Math.max(0, n - C.years));
  return out;
}
export function plDetail(C, T){
  var K = plTactics(C, T), S = plSteady(C), out = {rows:[], path:new Float64Array(C.years)};
  var r = plRun(C, K, S.r, S.pi, 0, out);
  r.rows = out.rows; r.path = out.path;
  return r;
}
export function plMedian(a){
  if (!a.length) return 0;
  var s = Array.prototype.slice.call(a).sort(function(p, q){ return p - q; });
  return s[Math.floor(s.length / 2)];
}
export function plQuant(sorted, q){ return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] : 0; }
/* Every historical start. opts.paths keeps each run's balances and what was
   lived on (for charts); opts.stopAfter gives up once that many runs have
   failed, for searches that only need to know whether a plan clears a bar. */
export function plHistory(C, T, opts){
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
export function plAtRetire(I){
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
export var PL_GOALS = {legacy:"Leave the most", last:"Make it last", spend:"Spend the most"};
export function plCombos(C, T0){
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
export function plBetter(goal, a, b, floor){
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
export function plWith(C, over){
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
export function plMaxSpend(C, T, target){
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
export function plStats(H){
  return {successRate:H.successRate, survived:H.survived, total:H.total,
    medLegacy:H.medLegacy, p10Legacy:H.p10Legacy, medTax:H.medTax, failYears:H.failYears};
}
export function* plOptimize(P, goal){
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
export function plBands(H, n){
  var out = [];
  for (var y = 0; y < n; y++){
    var col = H.runs.map(function(r){ return r.path ? r.path[y] : 0; }).sort(function(a, b){ return a - b; });
    out.push({p10:plQuant(col, .1), p50:plQuant(col, .5), p90:plQuant(col, .9)});
  }
  return out;
}
/* Runs the optimizer to the end in one go (tests, and the fallback when a
   worker isn't available and the caller doesn't need progress). */
export function plOptimizeNow(P, goal){
  var g = plOptimize(P, goal), last = null, s;
  while (!(s = g.next()).done) last = s.value;
  return last;
}
// ===PLAN END===
