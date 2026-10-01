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
   limits: the minimum and maximum spending apply. path: the spending path
   shapes it. Only the steady strategies take one: their spending is a plan
   you choose, so "less of it at 80" refines that plan. The others decide
   their own spending from the portfolio, and a path would fight their rules
   (guardrails would read the money not spent as being ahead and raise). */
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
  {id: "fixed", family: "steady", dial: DD_RATE_DIAL, byRate: true, limits: false, path: true,
   rule: function (s) {
     if (s.y > 0 && s.o.skipRaise && s.lastRet < 0) s.k /= 1 + s.lastInfl;
     return s.baseW * s.k * s.cumInfl;
   }},
  /* Michael Kitces's ratchet: fixed spending that never falls, raised 10%
     whenever the portfolio is 50% above where it started after inflation,
     no more than once every three years. */
  {id: "kitces", family: "steady", dial: DD_RATE_DIAL, byRate: true, path: true,
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

/* The minimum spending each year, in today's dollars: Minimum spending from
   the start, then each change in o.floorSteps ({start: 1-based year, amount,
   glide: years}) from its year, stepped, or eased in a straight line over
   its glide years. */
function ddFloorSched(o){
  var n = o.years, out = [], base = Math.max(0, o.spendFloor || 0), y, k;
  var steps = (o.floorSteps || []).map(function (x, i) {
    return {start: Math.max(2, Math.round(x.start || 0)), amount: Math.max(0, +x.amount || 0),
      glide: Math.max(0, Math.round(x.glide || 0)), i: i};
  }).sort(function (a, b) { return a.start - b.start || a.i - b.i; });
  for (y = 0; y < n; y++) out.push(base);
  var level = base;
  for (k = 0; k < steps.length; k++) {
    var st = steps[k], from = level;
    for (y = st.start - 1; y < n; y++) {
      var t = st.glide > 0 ? Math.min(1, (y - (st.start - 1) + 1) / (st.glide + 1)) : 1;
      out[y] = from + (st.amount - from) * t;
    }
    level = st.amount;
  }
  return out;
}
/* A comfort line is one amount (following the spending path) or one per
   year: its value in year y. */
function ddLineAt(c, y, m){
  if (Array.isArray(c)) return c[Math.min(y, c.length - 1)] || 0;
  return (c || 0) * (m == null ? 1 : m);
}

/* One run's per-plan setup, shared by every start: the guaranteed income,
   what stays invested, the spending path and, for risk-based guardrails, its
   tables. first is year one's spending from the strategy, in today's
   dollars, at today's CAPE where that matters. */
function ddPrep(o){
  var G = ddGuaranteed(o), S = DD_STRAT[o.strategy] || DD_STRAT.yale;
  if (!S.path && o.path && o.path !== "flat") o = Object.assign({}, o, {path: "flat"});
  var P = {G: G, initial: o.initial * (1 - G.share), strat: S, path: null, rg: null, risk: null, first: 0,
    floor: ddFloorSched(o)};
  // A search's line, held as a minimum on top of the plan's own.
  if (o.floorLine) P.floor = P.floor.map(function (v, y) { return Math.max(v, o.floorLine[y] || 0); });
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
    // wins. Fixed spending never falls, so they don't apply to it. The
    // minimum can change with age (ddFloorSched).
    if (S.limits !== false) {
      if (P.floor[y] > 0) {
        var floorNominal = P.floor[y] * cumInfl;
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
    if (stop === "comfort" && realReg < ddLineAt(line, y, m) - .5) { failed = true; break; }
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
    floorSteps: copy(d.floorSteps),
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
   to fall below. The one set, or else the minimum spending (one amount per
   year when it changes with age), or else 80% of year one's (guaranteed
   income included). */
function ddComfort(o, P){
  if (o.comfort > 0) return o.comfort;
  if ((DD_STRAT[o.strategy] || {}).limits !== false) {
    var f = ddFloorSched(o);
    if (f.some(function (v) { return v > 0; }))
      return f.every(function (v) { return v === f[0]; }) ? f[0] : f;
  }
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
      var ln = ddLineAt(comfort, y, m);
      if (ln > 0 && v < ln - .5) {
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
  if (T.crit !== "comfort" || !(ddLineAt(T.comfort, 0) > 0) || (DD_STRAT[o.strategy] || {}).limits === false) return o;
  var path = ddPrep(Object.assign({}, o, {floorLine: null})).path, line = [];
  for (var y = 0; y < o.years; y++) line.push(ddLineAt(T.comfort, y, path[y]));
  return Object.assign({}, o, {floorLine: line});
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
        if (P.first + P.G.income < ddLineAt(T.comfort, 0) - .5) return -1;
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
    // Everyone on steady spending, so the path, which only the steady
    // strategies take, can't tilt the comparison.
    var S = DD_STRAT[id], x = ddForTarget(Object.assign({}, o, {strategy: id, path: "flat"}), T), cal = null;
    if (S.dial) {
      cal = ddCalibrate(x, T);
      if (cal) x = ddWithDial(x, cal.v);
    }
    var H = historicalBacktest(x), P = H.prep;
    var sc = ddScorecard(H.runs, x, T.comfort, P.path);
    var meet = ddMeets(x, T, W, null, true);
    return {id: id, dial: cal ? cal.v : null, floor: x.floorLine ? 1 : 0,
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
