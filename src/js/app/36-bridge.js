// ===== EARLY RETIREMENT BRIDGE =====
/* The years between an early retirement and 59½, when a 401(k) or IRA opens
   up without the 10% additional tax. Every route the tax code allows runs as
   its own plan, year by year, from the balances you retire with: living off
   a taxable account and Roth contributions, a Roth conversion ladder, 72(t)
   payments, the rule of 55, simply paying the penalty, and a blended plan
   that mixes them. Each plan is tested against every historical market since
   1926 (or random draws from it), and the result is what's left in each
   account at 59½, ready to hand to the Drawdown Simulator or Income Tax.

   Everything is in today's dollars. Returns are real, and brackets, the
   standard deduction and the poverty line are held fixed in real terms, as
   everywhere else in the app. The figures that don't index -- Roth
   contribution basis, conversion amounts, brokerage cost basis and a fixed
   72(t) amortization payment -- are nominal, so they lose value to inflation
   each year.

   Placed after Healthcare so its ACA tables exist; like that section, it
   draws itself at the end if a direct visit opened it first. */
var brReady = false;

/* IRS Single Life Table, Treas. Reg. 1.401(a)(9)-9(b), in force from 2022.
   Notice 2022-6 lets 72(t) payments use it, and it gives the shortest life
   expectancy of the three allowed tables, so the largest payment. */
var BR_SLT = {30:55.3, 31:54.4, 32:53.4, 33:52.5, 34:51.5, 35:50.5, 36:49.6, 37:48.6,
  38:47.7, 39:46.7, 40:45.7, 41:44.8, 42:43.8, 43:42.9, 44:41.9, 45:41.0, 46:40.0,
  47:39.0, 48:38.1, 49:37.1, 50:36.2, 51:35.3, 52:34.3, 53:33.4, 54:32.5, 55:31.6,
  56:30.6, 57:29.8, 58:28.9, 59:28.0};
function brLE(age){ return BR_SLT[Math.max(30, Math.min(59, Math.round(age)))]; }
/* States that have not expanded Medicaid to 138% of the poverty line: the
   plan engine's table (below 100% in these there is no subsidy at all). */
var BR_NOEXP = PL_NOEXP;
var BR_UNLOCK = 59.5, BR_FICA = 0.0765, BR_CUSHION = 0.03, BR_TRIALS = 300;
/* Where a plan can draw from before 59½, the penalized sources last. */
var BR_PEN = ["tradPen", "rungEarly", "rothEarn"];
var BR_FB = ["g457", "r55"].concat(BR_PEN);
var BR_FILLS = {none:"no conversions", need:"only what the ladder needs", zero:"up to the standard deduction",
  b10:"to the top of the 10% bracket", b12:"to the top of the 12% bracket",
  aca:"up to the ACA subsidy cliff"};
var BR_CATS = [
  {k:"work", name:"Work", c:"#9fb7a8"},
  {k:"brok", name:"Brokerage", c:"#7d9fd6"},
  {k:"rothBasis", name:"Roth contributions", c:"#4fbf95"},
  {k:"rung", name:"Ladder rungs", c:"#2f8f6f"},
  {k:"sepp", name:"72(t) payments", c:"#c98fb8"},
  {k:"r55", name:"Rule of 55 / 457(b)", c:"#a98fd6"},
  {k:"early", name:"Early, with penalty", c:"#e2795f"}
];
var brMode = "hist", brSel = null, brPath = "avg", brBalView = "acct", brLast = null;
var brBarPts = null, brBalPts = null, brTypeTimer = null;

function brAmortFactor(rate, age){
  var n = brLE(age);
  return rate > 0 ? rate / (1 - Math.pow(1 + rate, -n)) : 1 / n;
}
/* Real returns of the chosen mix, year by year from 1926, and their
   long-run averages: the plan engine's own table. */
function brMix(stock){ return plMix(stock); }
function brFlatSeq(len, r, pi){
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
var BR_STEP = 500, BR_GRID = 4096, brTaxCaches = {}, brTaxCacheN = 0;
function brTaxCacheFor(status, state){
  var k = status + state;
  if (!brTaxCaches[k]){
    if (++brTaxCacheN > 6){ brTaxCaches = {}; brTaxCacheN = 1; }
    brTaxCaches[k] = {status:status, state:state, maps:{}, n:0};
  }
  return brTaxCaches[k];
}
function brTaxRaw(c, ord, gain, w){
  return computeRetireTax({status:c.status, state:c.state, trad:ord, roth:0, brok:gain,
    gainPct:1, ss:0, pension:0, penPublic:false, other:w, pre:0, dedType:"std",
    item:0, seniors:0, _noMarginal:true}).total;
}
function brTax(ctx, ord, gain, w){
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
function brHealth(ctx, age, magi){
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

/* ---- inputs ---- */
function brNum(id, lo, hi, d){
  var raw = $(id).value.trim();
  if (raw === "") return d;
  var v = num(id);
  return Math.max(lo, Math.min(hi, isFinite(v) ? v : d));
}
function readBR(){
  var trad = brNum("brTrad", 0, 1e10, 0), roth = brNum("brRoth", 0, 1e10, 0);
  return {status:$("brStatus").value === "m" ? "m" : "s", state:$("brState").value || "IL",
    age:Math.round(brNum("brAge", 30, 59, 50)), spend:brNum("brSpend", 0, 1e8, 0),
    trad:trad, k401:brR55Age() ? Math.min(trad, brNum("brK401", 0, 1e10, 0)) : 0,
    roth:roth, rothBasis:Math.min(roth, brNum("brRothBasis", 0, 1e10, 0)),
    brok:brNum("brBrok", 0, 1e10, 0), basisPct:brNum("brBasis", 0, 100, 100) / 100,
    g457:brNum("brG457", 0, 1e10, 0), stock:brNum("brStock", 0, 100, 70),
    work:brNum("brWork", 0, 1e8, 0), workUntil:brNum("brWorkUntil", 0, 120, 0),
    aca:$("brAca").value === "1", household:Math.round(brNum("brHousehold", 1, 10, 2)),
    premium:brNum("brPremium", 0, 1e5, 0),
    seppMethod:$("brSeppMethod").value === "rmd" ? "rmd" : "amort",
    seppRate:brNum("brSeppRate", 0, 12, 5) / 100,
    fill:$("brFill").value || "auto"};
}
function brCtx(inp){
  var mix = brMix(inp.stock), adults = inp.status === "m" ? 2 : 1;
  return Object.assign({}, inp, {mix:mix, real:mix.real, infl:mix.infl, adults:adults,
    fpl:hcFPL(Math.max(inp.household, adults)),
    nB:Math.max(1, Math.ceil(BR_UNLOCK - inp.age)),
    r55Age:55, r55:inp.k401 > 0 && inp.age >= 55,
    stateCA:inp.state === "CA", cache:brTaxCacheFor(inp.status, inp.state), rungMemo:{}});
}
/* The rule of 55 can only apply from 55, so its input only shows once the
   retirement age gets there. */
function brR55Age(){ return Math.round(brNum("brAge", 30, 59, 50)) >= 55; }
function brSyncFields(){
  $("brK401Wrap").hidden = !brR55Age();
  var aca = $("brAca").value === "1";
  $("brAcaWrap").hidden = !aca;
  $("brSpendNote").textContent = aca
    ? "Leave out health insurance: each plan adds the premium its income level earns." : "";
  var fillAca = $("brFill").querySelector("option[value='aca']");
  if (fillAca) fillAca.disabled = !aca;
  if (!aca && $("brFill").value === "aca") $("brFill").value = "auto";
}
function brWage(ctx, age){ return ctx.work > 0 && age < ctx.workUntil ? ctx.work : 0; }

/* ---- the pieces of a plan ---- */
/* What one ladder rung has to cover in the year it's spent: spending, less
   part-time pay, plus that year's tax and premium, which in a ladder year
   come mostly from the next conversion. */
function brRungFor(ctx, age, convNext){
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
function brSeppNeed(ctx){
  var W = brWage(ctx, ctx.age), base = Math.max(0, ctx.spend - W * (1 - BR_FICA)), P = base;
  for (var i = 0; i < 8; i++) P = base + brTax(ctx, P, 0, W) + brHealth(ctx, ctx.age, P + W).cost;
  return P;
}
/* Largest first-year payment the traditional balance could support. The
   401(k) you're leaving stays out when the rule of 55 already opens it. */
function brSeppBase(ctx){ return ctx.trad - (ctx.r55 ? ctx.k401 : 0); }
function brSeppMax(ctx, method){
  var m = method || ctx.seppMethod;
  return brSeppBase(ctx) * (m === "rmd" ? 1 / brLE(ctx.age) : brAmortFactor(ctx.seppRate, ctx.age));
}
function brSeppEnd(ctx){ return Math.max(59, ctx.age + 4); }
function brFillTarget(ctx, mode){
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
function brTakeRungs(s, amt, y, matured){
  for (var i = 0; i < s.rungs.length && amt > 1e-9; i++){
    var g = s.rungs[i];
    if (matured ? g.avail > y : g.avail <= y) continue;
    var t = Math.min(g.amt, amt); g.amt -= t; amt -= t;
  }
}
function brSnap(s){
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
function brYear(ctx, p, s, y, age, W, sp, F, C){
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
function brCommit(s, Y, y){
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
function brSim(ctx, p, seq, wantRows){
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
function brBlendPlan(ctx, fill, order){
  var first = order === "roth" ? ["roth", "brok"] : ["brok", "roth"];
  return {key:"blend", name:"Blended plan", phrase:"the blended plan",
    conv:fill === "need" ? "ladder" : fill === "none" ? "none" : "fill",
    fillMode:fill, fillTarget:brFillTarget(ctx, fill), orderKey:order,
    order:first.concat(["r55", "g457"], BR_PEN), sepp:0};
}
/* Better of two runs of a plan: reaches 59½ intact more often, then costs
   less, then leaves more. */
function brBetter(a, b){
  return (a.hold - b.hold) || (b.cost - a.cost) || (a.left - b.left);
}
/* How often a plan reaches 59½ intact across every historical start. */
function brHoldRate(ctx, plan){
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
function brSizeSepp(ctx, plan, cons){
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
function brChooseBlend(ctx, steady, cons){
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
function brPlans(ctx, steady){
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
function brMCSeqs(ctx){
  var mix = ctx.mix, L = ctx.nB, N = BR_TRIALS, rng = mulberry32((mcSeed ^ 0x5bd1e995) >>> 0);
  var r = new Float64Array(N * L), pi = new Float64Array(N * L);
  for (var i = 0; i < N * L; i++){
    var k = Math.floor(rng() * mix.n);
    r[i] = mix.r[k]; pi[i] = mix.pi[k];
  }
  return {r:r, pi:pi, N:N};
}
function brTest(ctx, p, mc){
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
function brPct(n, of){ return of > 0 ? pctStr(n / of, 0) : "—"; }
/* Plan names mid-sentence: lowercase, except Roth. */
function brLower(n){ return /^Roth\b/.test(n) ? n : n.charAt(0).toLowerCase() + n.slice(1); }

/* ---- render ---- */
function renderBridgeTyping(){
  clearTimeout(brTypeTimer);
  brTypeTimer = setTimeout(renderBridge, brMode === "mc" ? 180 : 90);
}
function renderBridge(){
  if (!brReady) return;
  clearTimeout(brTypeTimer);
  brSyncFields();
  var ctx = brCtx(readBR());
  brDerived(ctx);
  if (ctx.trad + ctx.roth + ctx.brok + ctx.g457 <= 0 || !(ctx.spend > 0)){
    setBig("brBest", "—"); setBig("brHold", "—"); setBig("brCost", "—");
    ["brBestNote", "brHoldNote", "brCostNote"].forEach(function(id){ $(id).textContent = ""; });
    $("brVerdict").innerHTML = "<div class='hint' style='margin:0'>Enter your spending and at least one account balance to plan the bridge.</div>";
    $("brCompare").querySelector("tbody").innerHTML = "";
    brLast = null;
    return;
  }
  var steady = brFlatSeq(ctx.nB, ctx.real, ctx.infl);
  var plans = brPlans(ctx, steady);
  var mc = brMode === "mc" ? brMCSeqs(ctx) : null;
  plans.forEach(function(p){
    if (p.off) return;
    p.steady = brSim(ctx, p, steady, true);
    p.hist = brTest(ctx, p, null);
    p.test = mc ? brTest(ctx, p, mc) : p.hist;
    p.score = {hold:Math.round(p.test.hold / Math.max(1, p.test.of) * 100), cost:p.steady.cost, left:p.steady.end.total};
  });
  var live = plans.filter(function(p){ return !p.off; });
  // the penalty plan is there for comparison, not as a recommendation
  var pool = live.filter(function(p){ return !p.penaltyPlanned; });
  var best = (pool.length ? pool : live).slice().sort(function(a, b){ return brBetter(b.score, a.score); })[0];
  if (!brSel || !live.some(function(p){ return p.key === brSel; })) brSel = best.key;
  var sel = live.filter(function(p){ return p.key === brSel; })[0];
  brLast = {ctx:ctx, plans:plans, live:live, best:best, sel:sel, mc:!!mc};
  brHeadline();
  brCompareTable();
  brDetail();
  brRules();
}
function brDerived(ctx){
  $("brLockYears").textContent = fmtNum(ctx.nB) + (ctx.nB === 1 ? " year" : " years") +
    ", ages " + fmtNum(ctx.age) + (ctx.nB > 1 ? "–" + fmtNum(ctx.age + ctx.nB - 1) : "");
  $("brR55State").textContent = !(ctx.k401 > 0) ? "No 401(k) entered"
    : ctx.r55 ? "Eligible" : "Not until " + ctx.r55Age;
  var mx = brSeppMax(ctx);
  $("brSeppMax").textContent = mx > 0 ? money(mx) + "/yr" : "—";
  $("brSteadyRet").textContent = pctStr(ctx.real, 1) + " real";
}
function brHeadline(){
  var L = brLast, ctx = L.ctx, b = L.best, t = b.test, st = b.steady, h = t.hold / Math.max(1, t.of);
  setBig("brBest", b.name);
  $("brBestNote").textContent = b.desc;
  setBig("brHold", pctStr(h, 0));
  $("brHold").className = "v " + (h >= 0.95 ? "jade" : h >= 0.8 ? "gold" : "neg");
  $("brHoldNote").textContent = L.mc
    ? "of " + t.of + " random markets reach 59½ penalty-free"
    : "of " + t.of + " retirements since " + HIST_START + " reach 59½ penalty-free";
  setBig("brCost", money(st.cost));
  $("brCostNote").textContent = "Tax, penalties" + (ctx.aca ? " and health premiums" : "") +
    ", ages " + ctx.age + (ctx.nB > 1 ? "–" + (ctx.age + ctx.nB - 1) : "");
  var parts = ["With <b>" + escapeHtml(b.phrase) + "</b>, you reach 59½ without an unplanned penalty or running short in <b>" +
    pctStr(h, 0) + "</b> of the " + (L.mc ? t.of + " random markets drawn from the record" : t.of +
    " historical starts since " + HIST_START) + ".",
    "On the steady path you arrive with <b>" + money(st.end.total) + "</b>: " + money(st.end.trad) +
    " traditional, " + money(st.end.roth) + " Roth and " + money(st.end.brok) + " in the brokerage."];
  var pen = L.plans.filter(function(p){ return p.key === "pen"; })[0];
  if (b.key !== "pen" && pen && pen.steady && pen.steady.cost > st.cost + 1)
    parts.push("That's <b>" + money(pen.steady.cost - st.cost) + "</b> less in tax, penalties" +
      (ctx.aca ? " and premiums" : "") + " than simply paying the penalty.");
  $("brVerdict").innerHTML = "<div class='hint' style='margin:0;font-size:13px;line-height:1.6'>" + parts.join(" ") + "</div>";
}
function brCompareTable(){
  var L = brLast, ctx = L.ctx;
  var cls = function(v){ return v >= 0.95 ? "pos" : v >= 0.8 ? "gold" : "neg"; };
  $("brCompare").querySelector("tbody").innerHTML = L.plans.map(function(p){
    var name = "<span class='br-name'>" + escapeHtml(p.name) +
      (p === L.best ? "<span class='br-tag'>Best</span>" : "") + "</span>" +
      "<span class='br-desc'>" + escapeHtml(p.off || p.desc || "") + "</span>";
    if (p.off) return "<tr class='br-off'><td>" + name + "</td><td colspan='5'>—</td></tr>";
    var t = p.test, st = p.steady;
    return "<tr class='ddrow" + (p.key === brSel ? " sel" : "") + "' data-plan='" + p.key + "' tabindex='0'>" +
      "<td>" + name + "</td>" +
      (p.penaltyPlanned ? "<td title='Counts only running short, since the penalty is the plan'>"
        : "<td class='" + cls(t.hold / Math.max(1, t.of)) + "'>") + brPct(t.hold, t.of) + "</td>" +
      "<td>" + money(st.tax) + "</td>" +
      "<td" + (st.pen > 0.5 ? " class='neg'" : "") + ">" + money(st.pen) + "</td>" +
      "<td>" + (ctx.aca ? money(st.health) : "—") + "</td>" +
      "<td>" + money(st.end.total) + "</td></tr>";
  }).join("");
  $("brCompareNote").textContent = "Success rates " + (L.mc ? "come from " + BR_TRIALS +
    " random sequences of historical years" : "come from every start year since " + HIST_START) +
    ". Tax, penalties, premiums and the balance at 59½ are the steady path at the long-run average return of " +
    pctStr(ctx.real, 1) + " real. “Holds” means reaching 59½ without running short or " +
    "touching penalized money the plan didn't intend to.";
}
/* The three markets the detail views can follow, all real historical starts
   ranked by what's left at 59½: the 75th percentile, the median and the 25th. */
function brScenarios(){
  var L = brLast, runs = L.sel.hist.runs.slice().sort(function(a, b){ return a.end.total - b.end.total; });
  var out = {};
  if (!runs.length){
    out.avg = {run:L.sel.steady, label:"average returns", head:"Average"};
    return out;
  }
  var pick = function(q, key, head, label, pct){
    var r = runs[Math.min(runs.length - 1, Math.floor(runs.length * q))];
    out[key] = {run:brSim(L.ctx, L.sel, {r:L.ctx.mix.r, pi:L.ctx.mix.pi, off:r.start - HIST_START, len:L.ctx.nB}, true),
      year:r.start, head:head, pct:pct, label:label + ", like retiring in " + r.start};
  };
  pick(0.75, "above", "Above average", "an above-average market", "75th percentile");
  pick(0.5, "avg", "Average", "an average market", "median");
  pick(0.25, "below", "Below average", "a below-average market", "25th percentile");
  return out;
}
function brDetail(){
  var L = brLast, ctx = L.ctx, S = brScenarios();
  if (!S[brPath]) brPath = "avg";
  $("segBRPath").querySelectorAll("button").forEach(function(b){
    b.classList.toggle("on", b.getAttribute("data-brpath") === brPath);
    b.disabled = !S[b.getAttribute("data-brpath")];
  });
  var P = S[brPath], run = P.run, rows = run.rows;
  L.path = P; L.scen = S;
  setH2Text($("brAtTitle"), "What you'll have at 59½, " + brLower(L.sel.name));
  setH2Text($("brFlowTitle"), "Where each year's money comes from, " + P.label);
  setH2Text($("brTableTitle"), "Year by year, " + brLower(L.sel.name) + ", " + P.label);
  setH2Text($("brBalTitle"), brBalView === "hist" ? "Total balance, every start since " + HIST_START : "Account balances, " + P.label);
  brAt(S, ctx);
  brBars(rows);
  brBalances(rows, ctx);
  brLadder(rows, ctx);
  brTable(rows, ctx);
  var notes = [];
  if (run.medicaid > 0) notes.push("In " + run.medicaid + (run.medicaid === 1 ? " year" : " years") +
    " income is low enough for Medicaid in " + ((STATES[ctx.state] || {}).n || ctx.state) + ", so no premium is counted.");
  if (run.cliff > 0) notes.push("In " + run.cliff + (run.cliff === 1 ? " year" : " years") +
    " income is over the ACA cliff, so the full premium is paid.");
  if (run.gap > 0) notes.push("In " + run.gap + (run.gap === 1 ? " year" : " years") +
    " income falls below the poverty line in a state without expanded Medicaid, so there is no subsidy.");
  var sh = rows.filter(function(r){ return r.short > 1; })[0];
  if (sh) notes.push("<b class='neg'>Runs short at " + sh.age + "</b>: the accounts this plan can reach can't cover that year.");
  $("brFlowNote").innerHTML = notes.join(" ");
}
/* The payoff: each account at 59½ in an average, a poor and the worst
   historical market, side by side. The highlighted column is the one the
   charts, table and hand-offs below follow. */
function brAt(S, ctx){
  var keys = ["above", "avg", "below"].filter(function(k){ return S[k]; });
  var col = function(k, v){ return "<td" + (k === brPath ? " class='on'" : "") + ">" + v + "</td>"; };
  var line = function(label, f, cls){
    return "<tr" + (cls ? " class='" + cls + "'" : "") + "><td>" + label + "</td>" +
      keys.map(function(k){ return col(k, money(f(S[k].run.end))); }).join("") + "</tr>";
  };
  var head = "<tr><th>Account</th>" + keys.map(function(k){
    return "<th" + (k === brPath ? " class='on'" : "") + ">" + S[k].head +
      (S[k].year ? "<span class='br-yr'>" + S[k].pct + ", " + S[k].year + "</span>" : "") + "</th>";
  }).join("") + "</tr>";
  var sh = keys.filter(function(k){ return !S[k].run.ok; });
  var seppEnd = brSeppEnd(ctx), e = S[brPath].run.end;
  var notes = [];
  if (e.sepp > 0.5 && seppEnd > 59) notes.push(money(e.sepp) + " of the traditional balance is still paying 72(t) through age " + seppEnd + ".");
  if (e.rothIn > 0.5) notes.push(money(e.rothIn) + " of the Roth is contributions and conversions.");
  if (e.brok > 0.5) notes.push(pctStr(1 - e.bBasis / e.brok, 0) + " of the brokerage is growth.");
  if (sh.length) notes.push("<b class='neg'>In the " + sh.map(function(k){ return S[k].head.toLowerCase(); }).join(" and ") +
    " case" + (sh.length > 1 ? "s" : "") + ", this plan runs short or needs penalized money before 59\u00bd.</b>");
  $("brAtOut").innerHTML = "<div class='scroll' style='max-height:none'><table id='brAtTable'><thead>" + head + "</thead><tbody>" +
    line("Traditional 401(k) / IRA", function(x){ return x.ira + x.sepp; }) +
    (ctx.g457 > 0 ? line("457(b)", function(x){ return x.g457; }) : "") +
    line("Roth", function(x){ return x.roth; }) +
    line("Brokerage", function(x){ return x.brok; }) +
    line("Total at 59\u00bd", function(x){ return x.total; }, "br-tot") +
    "</tbody></table></div>" +
    (notes.length ? "<div class='hint' style='margin-top:10px'>" + notes.join(" ") + "</div>" : "");
}
function brBars(rows){
  var bars = rows.map(function(r){
    var d = r.d, parts = {work:r.W, brok:d.brok, rothBasis:d.rothBasis, rung:d.rung,
      sepp:r.sp, r55:d.r55, early:d.early};
    // Only what gets spent: a 72(t) payment beyond the year's needs is reinvested.
    var extra = r.surplus;
    ["sepp", "r55", "work"].forEach(function(k){
      var t = Math.min(extra, parts[k]); parts[k] -= t; extra -= t;
    });
    return {age:r.age, parts:parts, conv:r.C, row:r};
  });
  brBarPts = brPaintBars("chartBR", bars);
  var used = {};
  bars.forEach(function(b){ BR_CATS.forEach(function(c){ if (b.parts[c.k] > 0.5) used[c.k] = 1; }); });
  var conv = bars.some(function(b){ return b.conv > 0.5; });
  $("legendBR").innerHTML = BR_CATS.filter(function(c){ return used[c.k]; })
    .map(function(c){ return swatch(c.c, c.name); }).join("") +
    (conv ? "<span><i style='background:transparent;border:2px solid " + cssVar("--text") + ";height:2px;margin-top:4px'></i>Converted to Roth, not spent</span>" : "");
}
/* Stacked bars, one per age, with the conversion each year drawn as a tick.
   Returns the same state shape paintChart does, so attachChart can drive the
   tooltip, the hover line and touch scrubbing. */
function brPaintBars(svgId, bars){
  var svg = $(svgId), narrow = window.innerWidth < 640;
  var W = narrow ? 470 : 900, H = narrow ? 400 : 340;
  var L = narrow ? 60 : 78, Rp = narrow ? 12 : 14, T = narrow ? 12 : 14, B = narrow ? 34 : 30;
  var fs = narrow ? 15 : 11, sw = narrow ? 1.7 : 1, pw = W - L - Rp, ph = H - T - B;
  svg.setAttribute("viewBox", "0 0 " + W + " " + H);
  svg.innerHTML = "";
  if (!bars.length) return null;
  var tot = bars.map(function(b){
    var s = 0; for (var k in b.parts) s += b.parts[k] > 0 ? b.parts[k] : 0; return s;
  });
  var maxV = Math.max.apply(null, tot.concat(bars.map(function(b){ return b.conv; })));
  var AX = niceAxis(0, maxV || 1), span = AX.max || 1, n = bars.length, slot = pw / n;
  var X = function(i){ return L + slot * (i + 0.5); };
  var Y = function(v){ return T + ph - (v / span) * ph; };
  AX.ticks.forEach(function(v){
    var y = Y(v);
    svg.appendChild(svgEl("line", {x1:L, x2:W - Rp, y1:y, y2:y, stroke:cssVar("--grid"), "stroke-width":sw}));
    var t = svgEl("text", {x:L - 8, y:y + fs / 3, "text-anchor":"end", "font-size":fs,
      fill:cssVar("--axis"), "font-family":"ui-monospace,SF Mono,Menlo,monospace"});
    t.textContent = fmtAxisMoney(v); svg.appendChild(t);
  });
  var step = Math.max(1, Math.ceil(n / (narrow ? 6 : 12)));
  for (var i = 0; i < n; i += step){
    var t = svgEl("text", {x:X(i), y:H - 10, "text-anchor":"middle", "font-size":fs,
      fill:cssVar("--axis"), "font-family":"ui-monospace,SF Mono,Menlo,monospace"});
    t.textContent = bars[i].age; svg.appendChild(t);
  }
  var bw = Math.max(1.5, Math.min(slot * 0.72, 56 * sw));
  bars.forEach(function(b, i){
    var acc = 0;
    BR_CATS.forEach(function(c){
      var v = b.parts[c.k];
      if (!(v > 0.5)) return;
      var y0 = Y(acc), y1 = Y(acc + v);
      svg.appendChild(svgEl("rect", {x:X(i) - bw / 2, y:y1, width:bw, height:Math.max(0.5, y0 - y1), fill:c.c}));
      acc += v;
    });
    if (b.conv > 0.5){
      var cy = Y(b.conv);
      svg.appendChild(svgEl("line", {x1:X(i) - bw / 2 - 1, x2:X(i) + bw / 2 + 1, y1:cy, y2:cy,
        stroke:cssVar("--text"), "stroke-width":2 * sw, "stroke-linecap":"round"}));
    }
  });
  var pts = bars.map(function(b, i){ return {year:i, base:tot[i], bar:b}; });
  var hover = svgEl("line", {x1:0, x2:0, y1:T, y2:T + ph, stroke:"#e9b872", "stroke-width":sw, opacity:0});
  svg.appendChild(hover);
  var dot = svgEl("circle", {r:4.5 * sw, fill:"#e9b872", stroke:cssVar("--dotstroke"),
    "stroke-width":2.5 * sw, opacity:0});
  svg.appendChild(dot);
  return {pts:pts, X:X, Y:Y, hover:hover, dot:dot, maxX:n, W:W};
}
function brBalances(rows, ctx){
  if (brBalView === "hist") return brBalHist(ctx);
  var S0 = {trad:ctx.trad + ctx.g457, roth:ctx.roth, brok:ctx.brok};
  var mk = function(k){
    var pts = [{year:0, value:S0[k]}];
    rows.forEach(function(r, i){ pts.push({year:i + 1, value:r.end[k]}); });
    return pts;
  };
  var tot = [{year:0, value:S0.trad + S0.roth + S0.brok}];
  rows.forEach(function(r, i){ tot.push({year:i + 1, value:r.end.total}); });
  var series = [
    {name:"Total", color:"#e9b872", pts:tot, width:2.6},
    {name:"Traditional", color:"#e2795f", pts:mk("trad")},
    {name:"Roth", color:"#4fbf95", pts:mk("roth")},
    {name:"Brokerage", color:"#7d9fd6", pts:mk("brok")}];
  brBalPts = paintMulti("chartBRB", series, rows.length, {xFmt:function(y){ return ctx.age + y; }});
  $("legendBRB").innerHTML = series.map(function(x){ return swatch(x.color, x.name); }).join("");
}
/* Every historical start's total, year by year, as the same percentile fan
   the other tools use: where the plan's money went across all of them. */
function brBalHist(ctx){
  var runs = brLast.sel.hist.runs, n = ctx.nB, pts = [];
  for (var y = 0; y <= n; y++){
    var v = runs.map(function(r){ return r.path[y]; }).sort(function(a, b){ return a - b; });
    var at = function(q){ return v[Math.min(v.length - 1, Math.floor(v.length * q))]; };
    pts.push({year:y, base:at(0.5), hi:at(0.9), lo:at(0.1), p25:at(0.25), p75:at(0.75)});
  }
  brBalPts = paintChart("chartBRB", pts, n, "mc", [], ctx.age, {enhanced:true,
    traces:{xs:pts.map(function(a){ return a.year; }),
            lines:runs.map(function(r){ return Array.prototype.slice.call(r.path, 0, n + 1); })}});
  histLegend("legendBRB");
}
function brLadder(rows, ctx){
  var conv = rows.filter(function(r){ return r.C > 0.5; });
  $("brLadderPanel").hidden = !conv.length;
  if (!conv.length) return;
  $("brLadder").querySelector("tbody").innerHTML =
    (ctx.rothBasis > 0 ? "<tr><td>Contributions</td><td>" + money(ctx.rothBasis) +
      "</td><td>—</td><td>Now</td></tr>" : "") +
    conv.map(function(r){
      var free = r.age + 5;
      return "<tr><td>" + r.age + "</td><td>" + money(r.C) + "</td><td>" + money(r.tax) +
        "</td><td>" + (free >= BR_UNLOCK ? "59½" : free) + "</td></tr>";
    }).join("");
  $("brLadderNote").textContent = "Converted before 59½: " +
    money(conv.reduce(function(a, r){ return a + r.C; }, 0)) +
    ". A conversion's five-year clock starts on January 1 of the year you make it, so a " +
    "conversion made any time in 2026 is penalty-free from January 1, 2031. The tax column is " +
    "the whole year's tax, conversion included.";
}
function brTable(rows, ctx){
  var m = function(v){ return v > 0.5 ? money(v) : "—"; };
  $("brTable").querySelector("tbody").innerHTML = rows.map(function(r){
    var d = r.d, fpl = r.fplPct != null ? " <span class='br-fpl'>" + Math.round(r.fplPct * 100) + "%</span>" : "";
    return "<tr" + (r.short > 1 ? " style='color:var(--coral)'" : "") +
      "><td>" + r.age + "</td><td>" + money(ctx.spend) + "</td><td>" + (ctx.aca ? money(r.health) : "—") +
      "</td><td>" + money(r.tax + r.fica) + "</td><td>" + m(r.pen) + "</td><td>" + m(d.brok) +
      "</td><td>" + m(d.rothBasis + d.rung) + "</td><td>" + m(r.sp) + "</td><td>" + m(d.r55) +
      "</td><td>" + m(d.early) + "</td><td>" + m(r.W) + "</td><td>" + m(r.C) + "</td><td>" + money(r.magi) + fpl +
      "</td><td>" + money(r.end.total) + "</td></tr>";
  }).join("");
}
function brRules(){
  var ctx = brLast.ctx, out = [];
  var add = function(t, d){ out.push("<dt>" + t + "</dt><dd>" + d + "</dd>"); };
  var stN = (STATES[ctx.state] || {}).n || ctx.state;
  add("The 10% before 59½", "Money out of a 401(k) or IRA before 59½ owes a 10% additional tax on " +
    "top of income tax (IRC §72(t)), unless an exception applies. The plans here are built out of " +
    "those exceptions." + (ctx.stateCA ? " California adds its own 2.5% on top." : "") +
    " This tool counts the year you turn 59 as locked, since 59½ falls partway through it.");
  add("Roth contributions", ctx.rothBasis > 0
    ? "Your " + money(ctx.rothBasis) + " of contributions can come out any time, tax- and penalty-free. " +
      "The IRS ordering rules take contributions first, then conversions oldest first, then earnings, " +
      "and earnings before 59½ are taxed and penalized."
    : "Contributions to a Roth can come out any time tax- and penalty-free; enter yours to use them.");
  add("Roth conversion ladder", "Each conversion is taxed as income the year you make it, then waits " +
    "five tax years before it can come out penalty-free. Converting from your first year of retirement " +
    "means the first five years" + (ctx.nB > 5 ? " (ages " + ctx.age + "–" + (ctx.age + 4) + ")" : "") +
    " have to come from somewhere else: the brokerage, Roth contributions or 72(t) payments. Converting " +
    "while still working starts the clocks sooner, but at your working tax rate.");
  var seppEnd = brSeppEnd(ctx);
  add("72(t) payments", "Substantially equal periodic payments from an IRA are penalty-free at any age. " +
    "At " + ctx.age + ", the most " + money(brSeppBase(ctx)) + " could pay is " + money(brSeppMax(ctx, "amort")) +
    " a year by amortization at " + pctStr(ctx.seppRate, 2) + ", or " + money(brSeppMax(ctx, "rmd")) +
    " by the RMD method. Payments must run until age " + seppEnd + " (the later of five years or 59½)" +
    (seppEnd > 59 ? ", so they carry on past 59½" : "") + ". Changing them, adding money to that IRA or " +
    "taking anything extra puts the 10% back on every payment so far, plus interest. Splitting off a " +
    "smaller IRA first locks in only what you need, which is how the plans here size it. A one-time " +
    "switch from amortization to the RMD method is allowed.");
  add("Rule of 55", ctx.k401 > 0
    ? (ctx.r55 ? "Leaving your job at " + ctx.age + " opens the " + money(ctx.k401) +
        " 401(k) you're leaving to penalty-free withdrawals. "
      : "Retiring at " + ctx.age + " is too early: the rule needs you to leave in or after the year you turn " +
        ctx.r55Age + ". ") +
      "It covers only that employer's plan. Rolling it to an IRA loses it, and older 401(k)s and IRAs " +
      "don't qualify, though you can roll them into the current plan before you leave."
    : "Leaving a job in or after the year you turn 55 opens that " +
      "employer's 401(k) penalty-free. Enter its balance to use it.");
  if (ctx.g457 > 0) add("457(b)", "A governmental 457(b) has no 10% penalty at all once you've left the " +
    "employer, whatever your age. Every plan here uses your " + money(ctx.g457) + " before anything penalized.");
  if (ctx.aca) add("Health insurance and MAGI", "Your premium depends on MAGI: conversions, 401(k) and IRA " +
    "withdrawals, 72(t) payments and capital gains all count; Roth withdrawals and the cost basis of " +
    "what you sell don't. For a household of " + Math.max(ctx.household, ctx.adults) + ", the subsidy " +
    "disappears entirely above " + money(ctx.fpl * 4) + " (400% of the poverty line)" +
    (BR_NOEXP[ctx.state] ? ", and below " + money(ctx.fpl) + " " + stN + " offers no subsidy or Medicaid for most adults."
      : ", and below " + money(ctx.fpl * 1.38) + " (138%) " + stN + " covers adults through Medicaid instead.") +
    " The blended plan counts that cost when it picks how much to convert.");
  add("0% capital gains", "Long-term gains are taxed at 0% while taxable income, gains included, stays under " +
    money(LTCG_2026[ctx.status][0]) + (ctx.status === "m" ? " for a joint return" : "") + ". With little " +
    "other income in early retirement, most brokerage sales land there, which is why living off a taxable " +
    "account is often nearly tax-free.");
  $("brRules").innerHTML = out.join("");
}

/* ---- hand-offs and the printable summary ---- */
/* A first year after 59½ that pays for the same spending, drawn from each
   account in proportion to what's in it: the gross amount comes from the
   tax on the traditional share and on the gain inside the brokerage share. */
function brFirstYear(ctx, e){
  var tot = e.total, wT = e.trad / tot, wR = e.roth / tot, wB = e.brok / tot;
  var gs = e.brok > 0 ? 1 - e.bBasis / e.brok : 0, G = ctx.spend;
  for (var i = 0; i < 12; i++) G = ctx.spend + brTax(ctx, G * wT, G * wB * gs, 0);
  return {trad:G * wT, roth:G * wR, brok:G * wB, gainPct:gs, gross:G};
}
function brHandoff(){
  var L = brLast;
  if (!L){ toast("Enter your balances first"); return null; }
  var e = L.path.run.end;
  if (!(e.total > 0)){ toast("Nothing left at 59½ to hand over"); return null; }
  return {ctx:L.ctx, e:e, y:brFirstYear(L.ctx, e)};
}
function brToDrawdown(){
  var H = brHandoff();
  if (!H) return;
  writeDDState({initial:Math.round(H.e.total), retireAge:"60", stock:Math.round(H.ctx.stock),
    stockEnd:"", strategy:"fixed", rate:Math.max(0.1, Math.round(H.y.gross / H.e.total * 10000) / 100),
    spendFloor:0, spendCeil:0});
  if (typeof renderItemLists === "function") renderItemLists();
  showTab("tools"); showTool("drawdown"); pushNav();
  renderDrawdown();
  toast("Drawdown set to " + money(H.e.total) + " at 60, withdrawing " + money(H.y.gross) + " a year");
}
function brToTax(){
  var H = brHandoff();
  if (!H) return;
  var r = function(v){ return Math.round(v || 0); };
  writeTaxState({mode:"retire", status:H.ctx.status, state:H.ctx.state,
    trad:r(H.y.trad), roth:r(H.y.roth), brok:r(H.y.brok), gainPct:Math.round(H.y.gainPct * 1000) / 10,
    seniors:0, ss:0, pension:0, other:0, pre:0, dedType:"std", item:0});
  showTab("tools"); showTool("tax"); pushNav();
  renderTax();
  toast("Loaded a year of withdrawals at 60 into Income Tax");
}
function buildBridgeSheet(){
  renderBridge();
  var L = brLast;
  if (!L){ $("sheet").innerHTML = ""; toast("Enter your balances first"); return false; }
  var ctx = L.ctx, b = L.best, st = b.steady, sel = L.sel, e = sel.steady.end;
  var inputs = row("Retire at", fmtNum(ctx.age)) +
    row("Filing status", ctx.status === "m" ? "Married filing jointly" : "Single") +
    row("State", (STATES[ctx.state] || {}).n || ctx.state) +
    row("Spending, after tax", money(ctx.spend) + "/yr") +
    row("Traditional", money(ctx.trad) + (ctx.k401 > 0 ? " (" + money(ctx.k401) + " in the 401(k) you're leaving)" : "")) +
    row("Roth", money(ctx.roth) + " (" + money(ctx.rothBasis) + " contributions)") +
    row("Brokerage", money(ctx.brok) + " at " + pctStr(ctx.basisPct, 0) + " basis") +
    (ctx.g457 > 0 ? row("457(b)", money(ctx.g457)) : "") +
    row("Stocks", fmtNum(ctx.stock) + "%") +
    (ctx.work > 0 ? row("Part-time work", money(ctx.work) + "/yr until " + fmtNum(ctx.workUntil)) : "") +
    row("Health insurance", ctx.aca ? "ACA with subsidy, household of " + Math.max(ctx.household, ctx.adults) : "Not included");
  var cmp = L.plans.filter(function(p){ return !p.off; }).map(function(p){
    return row(escapeHtml(p.name), brPct(p.test.hold, p.test.of) + " hold · " + money(p.steady.cost) +
      " cost · " + money(p.steady.end.total) + " at 59½");
  }).join("");
  var at = row("Traditional", money(e.ira + e.sepp)) + (ctx.g457 > 0 ? row("457(b)", money(e.g457)) : "") +
    row("Roth", money(e.roth)) + row("Brokerage", money(e.brok)) + row("Total", money(e.total));
  var src = $("chartBR"), chart = "";
  if (src && src.childNodes.length){
    var clone = src.cloneNode(true);
    lighten(clone); clone.removeAttribute("style");
    chart = "<div class='sh-chart'>" + clone.outerHTML + "</div>";
  }
  var m = function(v){ return v > 0.5 ? money(v) : "—"; };
  var table = "<table><thead><tr><th>Age</th><th>Tax</th><th>Penalty</th><th>Health</th><th>Brokerage</th>" +
    "<th>Roth</th><th>72(t)</th><th>55 / 457(b)</th><th>Converted</th><th>Balance</th></tr></thead><tbody>" +
    sel.steady.rows.map(function(r){
      var d = r.d;
      return "<tr><td>" + r.age + "</td><td>" + money(r.tax + r.fica) + "</td><td>" + m(r.pen) + "</td><td>" +
        m(r.health) + "</td><td>" + m(d.brok) + "</td><td>" + m(d.rothBasis + d.rung) + "</td><td>" +
        m(r.sp) + "</td><td>" + m(d.r55) + "</td><td>" + m(r.C) + "</td><td>" + money(r.end.total) + "</td></tr>";
    }).join("") + "</tbody></table>";
  $("sheet").innerHTML =
    "<div class='sh-h'>" + SHEET_MARK + "<h1>Early Retirement Bridge</h1><span>Ages " + fmtNum(ctx.age) +
      "–59½ &middot; today's dollars</span></div>" +
    "<div class='sh-big'>" +
      "<div><div class='k'>Best way to 59½</div><div class='v'>" + escapeHtml(b.name) + "</div><div class='n'>" +
        escapeHtml(b.desc) + "</div></div>" +
      "<div><div class='k'>Holds up in</div><div class='v'>" + brPct(b.test.hold, b.test.of) +
        "</div><div class='n'>" + (L.mc ? "random markets" : "retirements since " + HIST_START) + "</div></div>" +
      "<div><div class='k'>Cost of the bridge</div><div class='v'>" + money(st.cost) +
        "</div><div class='n'>tax, penalties" + (ctx.aca ? ", premiums" : "") + " to 59½</div></div>" +
    "</div>" + chart +
    "<div class='sh-cols'>" +
      "<section><div class='sh-t'>Your situation</div>" + inputs + "</section>" +
      "<section><div class='sh-t'>Ways to 59½</div>" + cmp + "</section>" +
      "<section><div class='sh-t'>At 59½, " + escapeHtml(brLower(sel.name)) + "</div>" + at + "</section>" +
    "</div>" +
    "<div class='sh-table'><div class='sh-t'>Year by year, " + escapeHtml(brLower(sel.name)) + ", steady returns</div>" + table + "</div>" +
    "<div class='sh-foot'>Estimates only, in today's dollars, with 2026 tax rules and ACA tables held " +
    "fixed in real terms. 72(t) and conversion rules are strict; confirm a plan with a tax professional. Not tax advice.</div>";
}

/* ---- wiring ---- */
Object.assign(GLOSS, {
  brage: "The age you stop working and start living on savings. Everything from then until 59½ is the bridge: the years when a 401(k) or IRA withdrawal normally costs an extra 10%. Balances below are what you expect to have on that day, in today's dollars.",
  brspend: "What you want to spend each year after every tax is paid, in today's dollars. Each plan works out the tax, penalties and health premiums its own withdrawals cause and pays those on top.",
  brtrad: "Everything pre-tax: traditional 401(k), 403(b), traditional IRA, rollover IRA, SEP. Withdrawals are taxed as income and, before 59½, owe the 10% unless one of the exceptions here applies.",
  brk401: "The rule of 55: leave an employer in or after the calendar year you turn 55 and that employer's 401(k) can pay you without the 10%. It has to stay in that plan; an IRA or an older employer's 401(k) doesn't qualify, though you can often roll those in before you leave.",
  brrothbasis: "What you put into Roth accounts yourself, plus any conversions more than five years old. That money can come out any time with no tax or penalty. Earnings can't until 59½. Your own records, or Form 8606, have the number.",
  brbasis: "The share of the brokerage balance that is money you put in, rather than growth. Only the growth is taxed when you sell, and usually at the 0% or 15% long-term rate. Include cash savings here at 100% basis.",
  br457: "A governmental 457(b), from a state or local employer, has no 10% early withdrawal penalty once you leave that job, at any age. Withdrawals are still taxed as income. Private (non-governmental) 457(b) plans work differently; leave those out.",
  brstock: "Share of the portfolio in stocks, the rest in bonds, held the same across every account. It sets both the historical returns each plan is tested against and the steady average return.",
  braca: "Before Medicare, most early retirees buy marketplace coverage, and the premium tax credit depends on income. Each plan's conversions and withdrawals set its own MAGI, so each pays its own premium.",
  brpremium: "The monthly benchmark (second-lowest Silver) premium for your household at retirement, from healthcare.gov. Leave blank to use your state's average for your age; it rises with the ACA age curve each year either way.",
  brfill: "How much the blended plan converts from traditional to Roth each year before 59½. \"Automatic\" tries every option, with the brokerage or the Roth drawn first, and keeps the one that holds up in the most historical markets, then the cheapest. Converting more than the bridge needs costs tax now to save it later, so pick a bracket yourself if that's the goal.",
  brseppmethod: "Amortization pays the same dollar amount every year, set on day one from the balance, your life expectancy and the interest rate. The RMD method divides each year's balance by life expectancy, so it starts much lower and moves with the market. The IRS also allows annuitization, which gives almost the same payment as amortization.",
  brsepprate: "72(t) amortization can use any rate up to the greater of 5% or 120% of the federal mid-term rate for either of the two months before the first payment (IRS Notice 2022-6). A higher rate means a bigger payment from the same balance.",
  brsteady: "The long-run average real return of this stock and bond mix from 1926 on, compounded. The steady path, the tax and premium figures, and every plan's sizing use it; the success rates use the actual year-by-year record instead.",
  brholds: "The share of historical start years (or random draws, in Monte Carlo) in which the plan gets to 59½ without running short and without having to touch penalized money it didn't plan on. For the pay-the-penalty plan, only running short counts.",
  brcost: "Everything the best plan pays between retirement and 59½ on the steady path, other than your spending: federal and state income tax, early withdrawal penalties, and net health insurance premiums. Today's dollars.",
  brhandoff: "Both buttons use the highlighted column above. Drawdown gets the total as its starting portfolio at 60 and a fixed withdrawal that covers your spending plus tax. Income Tax gets one year of those withdrawals, split across traditional, Roth and brokerage in proportion to their balances."
});
$("brStatus").addEventListener("change", function(){
  // a couple is at least two people for the poverty line
  var hh = num("brHousehold");
  if ($("brStatus").value === "m" && hh < 2) $("brHousehold").value = "2";
  if ($("brStatus").value === "s" && hh === 2) $("brHousehold").value = "1";
});
Array.prototype.forEach.call($("asideBR").querySelectorAll("input"), function(el){
  el.addEventListener("input", renderBridgeTyping);
});
Array.prototype.forEach.call($("asideBR").querySelectorAll("select"), function(el){
  el.addEventListener("change", renderBridge);
});
$("segBRPath").querySelectorAll("button").forEach(function(b){
  b.addEventListener("click", function(){ brPath = b.getAttribute("data-brpath"); if (brLast) brDetail(); });
});
$("segBRBal").querySelectorAll("button").forEach(function(b){
  b.addEventListener("click", function(){
    brBalView = b.getAttribute("data-brbal");
    $("segBRBal").querySelectorAll("button").forEach(function(x){ x.classList.toggle("on", x === b); });
    if (brLast) brDetail();
  });
});
$("brToDD").addEventListener("click", brToDrawdown);
$("brToTax").addEventListener("click", brToTax);
$("segBR").querySelectorAll("button").forEach(function(b){
  b.addEventListener("click", function(){
    brMode = b.getAttribute("data-brmode");
    $("segBR").querySelectorAll("button").forEach(function(x){ x.classList.toggle("on", x === b); });
    renderBridge();
  });
});
function brPick(tr){
  brSel = tr.getAttribute("data-plan");
  $("brCompare").querySelectorAll("tr.ddrow").forEach(function(x){ x.classList.toggle("sel", x === tr); });
  brLast.sel = brLast.live.filter(function(p){ return p.key === brSel; })[0];
  brDetail();
}
$("brCompare").addEventListener("click", function(e){
  var tr = e.target.closest ? e.target.closest("tr[data-plan]") : null;
  if (tr && brLast) brPick(tr);
});
$("brCompare").addEventListener("keydown", function(e){
  if (e.key !== "Enter" && e.key !== " ") return;
  var tr = e.target.closest ? e.target.closest("tr[data-plan]") : null;
  if (tr && brLast){ e.preventDefault(); brPick(tr); }
});
attachChart("chartWrapBR", "chartBR", "tipBR", function(){ return brBarPts; }, function(best){
  var b = best.bar, r = b.row, out = "<b>Age " + b.age + "</b>";
  BR_CATS.forEach(function(c){
    var v = b.parts[c.k];
    if (v > 0.5) out += "<br><span style='color:" + c.c + "'>" + c.name + "</span> <span class='n'>" + money(v) + "</span>";
  });
  if (b.conv > 0.5) out += "<br>Converted <span class='n'>" + money(b.conv) + "</span>";
  out += "<br><span style='color:var(--dim)'>Tax " + money(r.tax + r.fica) +
    (r.pen > 0.5 ? " · penalty " + money(r.pen) : "") +
    (brLast && brLast.ctx.aca ? " · health " + money(r.health) : "") + "</span>";
  if (r.surplus > 50) out += "<br><span style='color:var(--dim)'>Reinvested " + money(r.surplus) + "</span>";
  return out;
});
attachChart("chartWrapBRB", "chartBRB", "tipBRB", function(){ return brBalPts; }, function(best){
  var st = brBalPts, out = "<b>Age " + (brLast ? brLast.ctx.age + best.year : best.year) + "</b>";
  if (brBalView === "hist") return out +
    "<br><span style='color:#4fbf95'>90th</span> <span class='n'>" + money(best.hi) +
    "</span><br><span style='color:#3f9a78'>75th</span> <span class='n'>" + money(best.p75) +
    "</span><br><span style='color:#e9b872'>Median</span> <span class='n'>" + money(best.base) +
    "</span><br><span style='color:#3f9a78'>25th</span> <span class='n'>" + money(best.p25) +
    "</span><br><span style='color:#e2795f'>10th</span> <span class='n'>" + money(best.lo) + "</span>";
  if (st && st.names) st.names.forEach(function(nm, i){
    if (best.vals[i] == null) return;
    out += "<br><span style='color:" + st.colors[i] + "'>" + nm + "</span> <span class='n'>" + money(best.vals[i]) + "</span>";
  });
  return out;
});
brReady = true;
if (chartMode.tab === "tools" && toolSub === "bridge") renderBridge();

