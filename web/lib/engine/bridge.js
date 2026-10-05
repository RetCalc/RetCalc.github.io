/* The Early Retirement Bridge's planner: every route to 59½ (a taxable
   account and Roth contributions, a Roth conversion ladder, 72(t) payments,
   the rule of 55, paying the penalty, and a blend), run year by year and
   tested against every historical market or random draws from it. Moved
   from src/js/app/36-bridge.js without changes to the math: the exports and
   imports are added, and brMCSeqs takes its random seed as an argument. */
import { money } from "../format";
import { FED_2026, FED_STD, HIST_START, computeRetireTax, hcAgeMultiplier, hcCalcACA, hcFPL, hcGrossPremium, mulberry32 } from "./math.js";
import { PL_NOEXP, plMix } from "./plan.js";


/* IRS Single Life Table, Treas. Reg. 1.401(a)(9)-9(b), in force from 2022.
   Notice 2022-6 lets 72(t) payments use it, and it gives the shortest life
   expectancy of the three allowed tables, so the largest payment. */
export var BR_SLT = {30:55.3, 31:54.4, 32:53.4, 33:52.5, 34:51.5, 35:50.5, 36:49.6, 37:48.6,
  38:47.7, 39:46.7, 40:45.7, 41:44.8, 42:43.8, 43:42.9, 44:41.9, 45:41.0, 46:40.0,
  47:39.0, 48:38.1, 49:37.1, 50:36.2, 51:35.3, 52:34.3, 53:33.4, 54:32.5, 55:31.6,
  56:30.6, 57:29.8, 58:28.9, 59:28.0};
export function brLE(age){ return BR_SLT[Math.max(30, Math.min(59, Math.round(age)))]; }
/* States that have not expanded Medicaid to 138% of the poverty line: the
   plan engine's table (below 100% in these there is no subsidy at all). */
export var BR_NOEXP = PL_NOEXP;
export var BR_UNLOCK = 59.5, BR_FICA = 0.0765, BR_CUSHION = 0.03, BR_TRIALS = 300;
/* Where a plan can draw from before 59½, the penalized sources last. */
export var BR_PEN = ["tradPen", "rungEarly", "rothEarn"];
export var BR_FB = ["g457", "r55"].concat(BR_PEN);
export var BR_FILLS = {none:"no conversions", need:"only what the ladder needs", zero:"up to the standard deduction",
  b10:"to the top of the 10% bracket", b12:"to the top of the 12% bracket",
  aca:"up to the ACA subsidy cliff"};
export var BR_CATS = [
  {k:"work", name:"Work", c:"#9fb7a8"},
  {k:"brok", name:"Brokerage", c:"#7d9fd6"},
  {k:"rothBasis", name:"Roth contributions", c:"#4fbf95"},
  {k:"rung", name:"Ladder rungs", c:"#2f8f6f"},
  {k:"sepp", name:"72(t) payments", c:"#c98fb8"},
  {k:"r55", name:"Rule of 55 / 457(b)", c:"#a98fd6"},
  {k:"early", name:"Early, with penalty", c:"#e2795f"}
];

export function brAmortFactor(rate, age){
  var n = brLE(age);
  return rate > 0 ? rate / (1 - Math.pow(1 + rate, -n)) : 1 / n;
}
/* Real returns of the chosen mix, year by year from 1926, and their
   long-run averages: the plan engine's own table. */
export function brMix(stock){ return plMix(stock); }
export function brFlatSeq(len, r, pi){
  var a = new Float64Array(len), b = new Float64Array(len);
  a.fill(r); b.fill(pi);
  return {r:a, pi:b, off:0, len:len};
}

/* ---- tax, cached ----
   computeRetireTax is the whole federal and state return, and a plan asks
   for it thousands of times. Its answer is cached on a $500 grid of ordinary
   income and capital gain and read back by bilinear interpolation, which is
   exact inside a bracket and a few dollars off at a kink. Wages go in as
   ordinary "other" income, not traditional withdrawals, because some states
   exempt the one and tax the other. */
export var BR_STEP = 500, BR_GRID = 4096, brTaxCaches = {}, brTaxCacheN = 0;
export function brTaxCacheFor(status, state){
  var k = status + state;
  if (!brTaxCaches[k]){
    if (++brTaxCacheN > 6){ brTaxCaches = {}; brTaxCacheN = 1; }
    brTaxCaches[k] = {status:status, state:state, maps:{}, n:0};
  }
  return brTaxCaches[k];
}
export function brTaxRaw(c, ord, gain, w){
  return computeRetireTax({status:c.status, state:c.state, trad:ord, roth:0, brok:gain,
    gainPct:1, ss:0, pension:0, penPublic:false, other:w, pre:0, dedType:"std",
    item:0, seniors:0, _noMarginal:true}).total;
}
export function brTax(ctx, ord, gain, w){
  var c = ctx.cache;
  if (!(ord > 0)) ord = 0;
  if (!(gain > 0)) gain = 0;
  w = Math.round(w || 0);
  var fi = ord / BR_STEP, fj = gain / BR_STEP;
  if (fi >= BR_GRID - 2 || fj >= BR_GRID - 2) return brTaxRaw(c, ord, gain, w);
  var m = c.maps[w];
  if (!m){
    if (++c.n > 40){ c.maps = {}; c.n = 1; }
    m = c.maps[w] = new Map();
  }
  var i = Math.floor(fi), j = Math.floor(fj), di = fi - i, dj = fj - j;
  var k = i * BR_GRID + j, v00 = m.get(k), v10 = m.get(k + BR_GRID),
      v01 = m.get(k + 1), v11 = m.get(k + BR_GRID + 1);
  if (v00 === undefined){ v00 = brTaxRaw(c, i * BR_STEP, j * BR_STEP, w); m.set(k, v00); }
  if (v10 === undefined){ v10 = brTaxRaw(c, (i + 1) * BR_STEP, j * BR_STEP, w); m.set(k + BR_GRID, v10); }
  if (v01 === undefined){ v01 = brTaxRaw(c, i * BR_STEP, (j + 1) * BR_STEP, w); m.set(k + 1, v01); }
  if (v11 === undefined){ v11 = brTaxRaw(c, (i + 1) * BR_STEP, (j + 1) * BR_STEP, w); m.set(k + BR_GRID + 1, v11); }
  return v00 * (1 - di) * (1 - dj) + v10 * di * (1 - dj) + v01 * (1 - di) * dj + v11 * di * dj;
}

/* ---- health insurance ----
   The benchmark Silver premium for the adults on the plan, less the premium
   tax credit the year's MAGI earns, using the Healthcare tool's 2026 tables
   (the enhanced credits have expired, so the 400% cliff is back). Below 138%
   of the poverty line an expansion state moves you to Medicaid. */
export function brHealth(ctx, age, magi){
  if (!ctx.aca) return {cost:0, kind:""};
  var gross = ctx.premium > 0
    ? ctx.premium * hcAgeMultiplier(age) / hcAgeMultiplier(ctx.age)
    : hcGrossPremium(ctx.state, age, 0) * ctx.adults;
  var pct = magi / ctx.fpl;
  if (pct < 1.38 && !BR_NOEXP[ctx.state]) return {cost:0, kind:"medicaid", pct:pct};
  if (pct < 1) return {cost:gross * 12, kind:"gap", pct:pct};
  var r = hcCalcACA(magi, gross, pct, false);
  return {cost:r.net * 12, kind:r.eligible ? "aca" : "cliff", pct:pct};
}

export function brCtx(inp){
  var mix = brMix(inp.stock), adults = inp.status === "m" ? 2 : 1;
  return Object.assign({}, inp, {mix:mix, real:mix.real, infl:mix.infl, adults:adults,
    fpl:hcFPL(Math.max(inp.household, adults)),
    nB:Math.max(1, Math.ceil(BR_UNLOCK - inp.age)),
    r55Age:55, r55:inp.k401 > 0 && inp.age >= 55,
    stateCA:inp.state === "CA", cache:brTaxCacheFor(inp.status, inp.state), rungMemo:{}});
}
/* The rule of 55 can only apply from 55, so its input only shows once the
   retirement age gets there. */
export function brWage(ctx, age){ return ctx.work > 0 && age < ctx.workUntil ? ctx.work : 0; }

/* ---- the pieces of a plan ---- */
/* What one ladder rung has to cover in the year it's spent: spending, less
   part-time pay, plus that year's tax and premium, which in a ladder year
   come mostly from the next conversion. */
export function brRungFor(ctx, age, convNext){
  var key = age + (convNext ? "c" : "");
  if (ctx.rungMemo[key] != null) return ctx.rungMemo[key];
  var W = brWage(ctx, age), base = Math.max(0, ctx.spend - W * (1 - BR_FICA)), R = base;
  for (var i = 0; i < 8; i++){
    var c = convNext ? R : 0;
    R = base + brTax(ctx, c, 0, W) + brHealth(ctx, age, c + W).cost;
  }
  return (ctx.rungMemo[key] = R);
}
/* The 72(t) payment that covers the first year on its own. */
export function brSeppNeed(ctx){
  var W = brWage(ctx, ctx.age), base = Math.max(0, ctx.spend - W * (1 - BR_FICA)), P = base;
  for (var i = 0; i < 8; i++) P = base + brTax(ctx, P, 0, W) + brHealth(ctx, ctx.age, P + W).cost;
  return P;
}
/* Largest first-year payment the traditional balance could support. The
   401(k) you're leaving stays out when the rule of 55 already opens it. */
export function brSeppBase(ctx){ return ctx.trad - (ctx.r55 ? ctx.k401 : 0); }
export function brSeppMax(ctx, method){
  var m = method || ctx.seppMethod;
  return brSeppBase(ctx) * (m === "rmd" ? 1 / brLE(ctx.age) : brAmortFactor(ctx.seppRate, ctx.age));
}
export function brSeppEnd(ctx){ return Math.max(59, ctx.age + 4); }
export function brFillTarget(ctx, mode){
  var std = FED_STD[ctx.status], b = FED_2026[ctx.status];
  if (mode === "zero") return std;
  if (mode === "b10") return std + b[1][0];
  if (mode === "b12") return std + b[2][0];
  if (mode === "aca") return ctx.fpl * 4 - 1500;
  return 0;
}
/* Roth withdrawals come out in the order the IRS sets: contributions, then
   conversions oldest first, then earnings. Matured rungs are the oldest, so
   taking them first is the same thing. */
export function brTakeRungs(s, amt, y, matured){
  for (var i = 0; i < s.rungs.length && amt > 1e-9; i++){
    var g = s.rungs[i];
    if (matured ? g.avail > y : g.avail <= y) continue;
    var t = Math.min(g.amt, amt); g.amt -= t; amt -= t;
  }
}
export function brSnap(s){
  var rb = s.rBasis;
  for (var i = 0; i < s.rungs.length; i++) rb += s.rungs[i].amt;
  var trad = s.ira + s.k401 + s.sepp + s.g457;
  return {trad:trad, ira:s.ira + s.k401, sepp:s.sepp, g457:s.g457, roth:s.roth,
    rothIn:Math.min(s.roth, rb), brok:s.brok, bBasis:Math.min(s.brok, s.bBasis),
    total:trad + s.roth + s.brok};
}

/* One year: given what's already fixed (wages, the 72(t) payment, fills and
   conversions), find the smallest draw down the plan's list of sources that
   pays for spending plus the tax, penalty and premium that draw itself
   causes. Doesn't touch the balances. */
export function brYear(ctx, p, s, y, age, W, sp, F, C){
  var fG = Math.min(F, s.g457), fK = F - fG, cI = Math.min(C, s.ira), cK = C - cI;
  var ira = s.ira - cI, k401 = s.k401 - fK - cK, g457 = s.g457 - fG, roth = s.roth + C;
  var mat = 0, unmat = C, all = C, i;
  for (i = 0; i < s.rungs.length; i++){
    var g = s.rungs[i]; all += g.amt;
    if (g.avail <= y) mat += g.amt; else unmat += g.amt;
  }
  var acc = Math.min(roth, s.rBasis + mat);
  var list = typeof p.order === "function" ? p.order(mat) : p.order;
  var n = list.length, av = new Array(n), total = 0;
  for (i = 0; i < n; i++){
    var a = 0;
    switch (list[i]){
      case "brok": a = s.brok; break;
      case "roth": a = acc; break;
      case "rungEarly": a = Math.min(roth - acc, unmat); break;
      case "rothEarn": a = roth - Math.min(roth, s.rBasis + all); break;
      case "g457": a = g457; break;
      case "r55": a = ctx.r55 ? k401 : 0; break;
      case "tradPen": a = ira + (ctx.r55 ? 0 : k401); break;
    }
    av[i] = a > 0 ? a : 0; total += av[i];
  }
  var gs = s.brok > 0 ? Math.max(0, 1 - s.bBasis / s.brok) : 0;
  var fixedCash = W + sp + F, fixedOrd = sp + F + C;
  var penRate = 0.10 + (ctx.stateCA ? 0.025 : 0), fica = W * BR_FICA;
  function ev(x){
    var rem = x, ord = 0, gain = 0, pb = 0;
    for (var k = 0; k < n && rem > 0; k++){
      var t = av[k] < rem ? av[k] : rem;
      if (t <= 0) continue;
      rem -= t;
      var key = list[k];
      if (key === "brok") gain += t * gs;
      else if (key === "g457" || key === "r55") ord += t;
      else if (key === "tradPen" || key === "rothEarn"){ ord += t; pb += t; }
      else if (key === "rungEarly") pb += t;
    }
    var O = fixedOrd + ord, magi = O + gain + W;
    var tax = brTax(ctx, O, gain, W), pen = pb * penRate, hl = brHealth(ctx, age, magi);
    return {x:x, net:fixedCash + x - ctx.spend - tax - pen - fica - hl.cost,
      tax:tax, pen:pen, hl:hl, magi:magi, ord:O, gain:gain, pb:pb};
  }
  var r = ev(0);
  if (r.net < 0 && total > 0){
    var lo = 0, nlo = r.net, hi = -1, nhi = 0, x = Math.min(total, -r.net * 1.2);
    for (var it = 0; it < 40; it++){
      r = ev(x);
      if (r.net >= 0){ hi = x; nhi = r.net; if (r.net < 1) break; }
      else { lo = x; nlo = r.net; if (x >= total) break; }
      var nx;
      if (hi < 0) nx = Math.min(total, x - r.net * 1.25 + 1);
      else {
        if (hi - lo < 0.5){ x = hi; r = ev(hi); break; }
        nx = lo + (hi - lo) * (-nlo) / (nhi - nlo);
        if (!(nx > lo && nx < hi) || it % 3 === 2) nx = (lo + hi) / 2;
      }
      x = nx;
    }
    if (r.net < 0 && hi >= 0) r = ev(hi);
  }
  var takes = new Array(n), rem = r.x;
  for (i = 0; i < n; i++){ takes[i] = Math.min(av[i], rem); rem -= takes[i]; }
  return {list:list, takes:takes, tax:r.tax, pen:r.pen, health:r.hl.cost, hk:r.hl.kind,
    fplPct:r.hl.pct, fica:fica, magi:r.magi, ord:r.ord, gain:r.gain, pb:r.pb, gs:gs, F:F, C:C,
    short:r.net < 0 ? -r.net : 0, surplus:r.net > 0 ? r.net : 0};
}
/* Applies a solved year to the balances; returns where the cash came from. */
export function brCommit(s, Y, y){
  var F = Y.F, C = Y.C, d = {brok:0, rothBasis:0, rung:0, r55:0, early:0};
  var fG = Math.min(F, s.g457); s.g457 -= fG; s.k401 -= F - fG; d.r55 += F;
  var cI = Math.min(C, s.ira); s.ira -= cI; s.k401 -= C - cI;
  if (C > 0){ s.roth += C; s.rungs.push({amt:C, avail:y + 5}); }
  for (var k = 0; k < Y.list.length; k++){
    var t = Y.takes[k];
    if (!(t > 0)) continue;
    switch (Y.list[k]){
      case "brok": s.bBasis -= t * (1 - Y.gs); s.brok -= t; d.brok += t; break;
      case "roth":
        var b = Math.min(t, s.rBasis); s.rBasis -= b; d.rothBasis += b;
        brTakeRungs(s, t - b, y, true); d.rung += t - b; s.roth -= t; break;
      case "rungEarly": brTakeRungs(s, t, y, false); s.roth -= t; d.early += t; break;
      case "rothEarn": s.roth -= t; d.early += t; break;
      case "g457": s.g457 -= t; d.r55 += t; break;
      case "r55": s.k401 -= t; d.r55 += t; break;
      case "tradPen": var a = Math.min(t, s.ira); s.ira -= a; s.k401 -= t - a; d.early += t; break;
    }
  }
  if (Y.surplus > 0){ s.brok += Y.surplus; s.bBasis += Y.surplus; }
  if (s.ira < 0) s.ira = 0;
  if (s.k401 < 0) s.k401 = 0;
  if (s.g457 < 0) s.g457 = 0;
  if (s.roth < 0) s.roth = 0;
  if (s.brok < 0) s.brok = 0;
  if (s.bBasis < 0) s.bBasis = 0;
  if (s.bBasis > s.brok) s.bBasis = s.brok;
  if (s.rBasis < 0) s.rBasis = 0;
  return d;
}

/* One plan along one market path, from retirement to 59½. */
export function brSim(ctx, p, seq, wantRows){
  var A = ctx.age, len = seq.len, R = seq.r, PI = seq.pi, off = seq.off;
  var s = {ira:ctx.trad - ctx.k401, k401:ctx.k401, sepp:0, g457:ctx.g457,
    roth:ctx.roth, rBasis:ctx.rothBasis, rungs:[], brok:ctx.brok, bBasis:ctx.brok * ctx.basisPct};
  var seppNom = 0;
  if (p.sepp > 0){
    // Split off an IRA just big enough to pay the target, so only that much
    // is locked into the schedule.
    var fac = ctx.seppMethod === "rmd" ? 1 / brLE(A) : brAmortFactor(ctx.seppRate, A);
    var want = p.sepp / fac, fi = Math.min(s.ira, want);
    s.ira -= fi;
    var fk = ctx.r55 ? 0 : Math.min(s.k401, want - fi);
    s.k401 -= fk;
    s.sepp = fi + fk;
    seppNom = s.sepp * fac;
  }
  var out = {firstPen:null, short:null, tax:0, pen:0, health:0, conv:0,
    seppAcct:s.sepp, seppFirst:seppNom, medicaid:0, cliff:0, gap:0,
    rows:wantRows ? [] : null};
  var cum = 1, lastGain = 0;
  out.path = new Float64Array(len + 1);
  out.path[0] = s.ira + s.k401 + s.g457 + s.sepp + s.roth + s.brok;
  for (var y = 0; y < len; y++){
    var age = A + y, W = brWage(ctx, age);
    // A 72(t) payment is fixed: it can't be skipped or topped up.
    var sp = 0;
    if (s.sepp > 0){
      sp = Math.min(s.sepp, ctx.seppMethod === "rmd" ? s.sepp / brLE(age) : seppNom / cum);
      s.sepp -= sp;
    }
    // Conversions, and in the blended plan the penalty-free ordinary income
    // (rule of 55, 457(b)) that fills the same bracket room first.
    var F = 0, C = 0, convCap = s.ira + (ctx.r55 ? 0 : s.k401);
    if (p.conv === "ladder" && y + 5 < ctx.nB){
      C = Math.min(convCap, brRungFor(ctx, age + 5, y + 10 < ctx.nB));
    } else if (p.conv === "fill"){
      var room = Math.max(0, p.fillTarget - W - sp - (p.fillMode === "aca" ? lastGain : 0));
      F = Math.min(room, ctx.spend, s.g457 + (ctx.r55 ? s.k401 : 0));
      C = Math.min(convCap, Math.max(0, room - F));
    }
    var Y = brYear(ctx, p, s, y, age, W, sp, F, C);
    if (p.conv === "fill" && p.fillMode === "aca"){
      for (var k = 0; k < 3 && C > 0 && Y.magi > p.fillTarget + 1; k++){
        C = Math.max(0, C - (Y.magi - p.fillTarget) - 250);
        Y = brYear(ctx, p, s, y, age, W, sp, F, C);
      }
    }
    var d = brCommit(s, Y, y);
    out.tax += Y.tax; out.pen += Y.pen; out.health += Y.health; out.conv += C;
    if (Y.short > 1 && out.short === null) out.short = age;
    if (!p.penaltyPlanned && Y.pb > 1 && out.firstPen === null) out.firstPen = age;
    if (Y.hk === "medicaid") out.medicaid++;
    else if (Y.hk === "cliff") out.cliff++;
    else if (Y.hk === "gap") out.gap++;
    lastGain = Y.gain;
    var g1 = 1 + R[off + y], dfl = 1 + PI[off + y];
    s.ira *= g1; s.k401 *= g1; s.sepp *= g1; s.g457 *= g1; s.roth *= g1; s.brok *= g1;
    s.rBasis /= dfl; s.bBasis /= dfl; cum *= dfl;
    for (var q = 0; q < s.rungs.length; q++) s.rungs[q].amt /= dfl;
    out.path[y + 1] = s.ira + s.k401 + s.sepp + s.g457 + s.roth + s.brok;
    if (out.rows) out.rows.push({age:age, W:W, sp:sp, F:F, C:C, d:d,
      tax:Y.tax, pen:Y.pen, health:Y.health, hk:Y.hk, fplPct:Y.fplPct, fica:Y.fica,
      magi:Y.magi, ord:Y.ord, gain:Y.gain, short:Y.short, surplus:Y.surplus, end:brSnap(s)});
  }
  out.ok = len >= ctx.nB && out.short === null && (p.penaltyPlanned || out.firstPen === null);
  out.cost = out.tax + out.pen + out.health;
  out.end = brSnap(s);
  return out;
}

/* ---- the plans ---- */
export function brBlendPlan(ctx, fill, order){
  var first = order === "roth" ? ["roth", "brok"] : ["brok", "roth"];
  return {key:"blend", name:"Blended plan", phrase:"the blended plan",
    conv:fill === "need" ? "ladder" : fill === "none" ? "none" : "fill",
    fillMode:fill, fillTarget:brFillTarget(ctx, fill), orderKey:order,
    order:first.concat(["r55", "g457"], BR_PEN), sepp:0};
}
/* Better of two runs of a plan: reaches 59½ intact more often, then costs
   less, then leaves more. */
export function brBetter(a, b){
  return (a.hold - b.hold) || (b.cost - a.cost) || (a.left - b.left);
}
/* How often a plan reaches 59½ intact across every historical start. */
export function brHoldRate(ctx, plan){
  var mix = ctx.mix, ok = 0, of = 0;
  for (var s = 0; s + ctx.nB <= mix.n; s++){
    of++;
    if (brSim(ctx, plan, {r:mix.r, pi:mix.pi, off:s, len:ctx.nB}, false).ok) ok++;
  }
  return of ? ok / of : 0;
}
/* The smallest 72(t) payment that keeps the plan off penalized money, sized
   against returns three points below average so it has room for a bad
   decade. Zero when the plan holds without it. */
export function brSizeSepp(ctx, plan, cons){
  if (brSim(ctx, plan, cons, false).ok) return 0;
  var max = brSeppMax(ctx);
  if (!(max > 0)) return 0;
  if (!brSim(ctx, Object.assign({}, plan, {sepp:max}), cons, false).ok) return max;
  var lo = 0, hi = max;
  for (var i = 0; i < 14; i++){
    var mid = (lo + hi) / 2;
    if (brSim(ctx, Object.assign({}, plan, {sepp:mid}), cons, false).ok) hi = mid; else lo = mid;
  }
  return Math.ceil(hi / 100) * 100;
}
/* The blended plan tries each way of filling the brackets, with brokerage
   or Roth drawn first and 72(t) payments sized either for a bad decade or to
   cover the first year outright, and keeps the variant that reaches 59½
   intact in the most historical markets; ties go to the cheapest. */
export function brChooseBlend(ctx, steady, cons){
  var fills = ctx.fill === "auto"
    ? ["none", "need", "zero", "b10", "b12"].concat(ctx.aca ? ["aca"] : []) : [ctx.fill];
  var full = Math.min(brSeppMax(ctx), brSeppNeed(ctx)), best = null;
  fills.forEach(function(f){
    ["brok", "roth"].forEach(function(o){
      var base = brBlendPlan(ctx, f, o), sized = brSizeSepp(ctx, base, cons);
      var sizes = full > sized + 500 ? [sized, full] : [sized];
      sizes.forEach(function(sz){
        var plan = Object.assign({}, base, {sepp:sz}), r = brSim(ctx, plan, steady, false);
        var sc = {plan:plan, hold:Math.round(brHoldRate(ctx, plan) * 100), cost:r.cost, left:r.end.total};
        if (!best || brBetter(sc, best) > 0) best = sc;
      });
    });
  });
  return best.plan;
}
export function brPlans(ctx, steady){
  var cons = brFlatSeq(ctx.nB, ctx.real - BR_CUSHION, ctx.infl);
  var blend = brChooseBlend(ctx, steady, cons);
  // described from what it actually does on the steady path
  var bs = brSim(ctx, blend, steady, true), bits = [];
  if (bs.conv > 0.5) bits.push(blend.fillMode === "need" ? "ladder conversions" : "converts " + BR_FILLS[blend.fillMode]);
  if (blend.sepp > 0) bits.push("72(t) of " + money(blend.sepp) + "/yr");
  if (bs.rows.some(function(r){ return r.d.r55 > 0.5; })) bits.push(ctx.r55 ? "rule of 55" : "457(b)");
  if (!bits.length) bits.push("no conversions or 72(t)");
  bits.push(blend.orderKey === "roth" ? "Roth before brokerage" : "brokerage before Roth");
  blend.desc = bits.join(" · ");
  var seppPay = Math.min(brSeppMax(ctx), brSeppNeed(ctx));
  return [blend,
    {key:"ladder", name:"Roth conversion ladder", phrase:"a Roth conversion ladder", conv:"ladder",
      off:ctx.nB > 5 ? "" : "A conversion made at " + ctx.age + " wouldn't open up until after 59½",
      desc:"Convert every year; spend each conversion five years later",
      order:function(mat){ return mat > 0 ? ["roth", "brok"].concat(BR_FB) : ["brok", "roth"].concat(BR_FB); }},
    {key:"brok", name:"Brokerage, then Roth contributions", phrase:"the brokerage, then Roth contributions",
      conv:"none", desc:"No conversions; sell taxable investments first",
      order:["brok", "roth"].concat(BR_FB)},
    {key:"sepp", name:"72(t) payments", phrase:"72(t) payments", conv:"none", sepp:seppPay,
      off:!(seppPay > 0) ? "No traditional balance to pay from" : "",
      desc:money(seppPay) + " a year from an IRA, locked in through age " + brSeppEnd(ctx),
      order:["brok", "roth"].concat(BR_FB)},
    {key:"r55", name:"Rule of 55", phrase:"the rule of 55", conv:"none",
      off:ctx.r55 ? "" : ctx.age < ctx.r55Age ? "Needs you to leave your job at " + ctx.r55Age + " or later"
        : "Enter the balance in the 401(k) you're leaving",
      desc:"Draw the 401(k) you left, penalty-free",
      order:["r55", "brok", "roth", "g457"].concat(BR_PEN)},
    {key:"pen", name:"Pay the 10% penalty", phrase:"penalized withdrawals", conv:"none", penaltyPlanned:true,
      desc:"Withdraw from the 401(k) or IRA as needed and pay the extra 10%",
      order:["tradPen", "r55", "g457", "brok", "roth", "rungEarly", "rothEarn"]}];
}

/* Every historical start with enough data to reach 59½, or random years
   drawn from the same record. */
/* The seed is passed in; the old page read a global one, starting at
   20260902 like this default. */
export function brMCSeqs(ctx, mcSeed = 20260902){
  var mix = ctx.mix, L = ctx.nB, N = BR_TRIALS, rng = mulberry32((mcSeed ^ 0x5bd1e995) >>> 0);
  var r = new Float64Array(N * L), pi = new Float64Array(N * L);
  for (var i = 0; i < N * L; i++){
    var k = Math.floor(rng() * mix.n);
    r[i] = mix.r[k]; pi[i] = mix.pi[k];
  }
  return {r:r, pi:pi, N:N};
}
export function brTest(ctx, p, mc){
  var mix = ctx.mix, out = {hold:0, of:0, runs:[]};
  if (mc){
    for (var t = 0; t < mc.N; t++){
      out.of++;
      if (brSim(ctx, p, {r:mc.r, pi:mc.pi, off:t * ctx.nB, len:ctx.nB}, false).ok) out.hold++;
    }
    return out;
  }
  for (var s = 0; s + ctx.nB <= mix.n; s++){
    var r = brSim(ctx, p, {r:mix.r, pi:mix.pi, off:s, len:ctx.nB}, false);
    r.start = HIST_START + s;
    out.runs.push(r);
    out.of++;
    if (r.ok) out.hold++;
  }
  return out;
}
