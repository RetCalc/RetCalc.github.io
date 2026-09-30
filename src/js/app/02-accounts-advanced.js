/* ---------- account types (Advanced) ---------- */
/* The split doesn't change how anything grows: every account earns the same
   return on the same contribution schedule, so the plan's total is just the
   sum of the parts and every chart, solve and simulation keeps working off
   one initial balance and one contribution. What the split changes is the
   tax. Because the projection is linear in both the starting balance and the
   contribution, one fvFactors walk gives each account's own ending balance,
   and the first year's withdrawal is run through the Income Tax tool's
   retirement engine instead of a flat typed-in rate. */
const AC_PER = {"Weekly":"/wk","Bi-Weekly":"/2wk","Monthly":"/mo","Quarterly":"/qtr","Annually":"/yr"};
let lastAcct = null;
function acOn(){ return $("acToggle").classList.contains("on"); }
function readAcctState(){
  const basisRaw = $("acBrokBasis").value.trim();
  return {on:true,
    tradBal:num("acTradBal"), tradC:num("acTradC"),
    rothBal:num("acRothBal"), rothC:num("acRothC"),
    brokBal:num("acBrokBal"), brokC:num("acBrokC"),
    brokBasis: basisRaw === "" ? null : num("acBrokBasis"),
    salary:num("acSalary"), matchPct:num("acMatchPct"), matchCap:num("acMatchCap"),
    status:$("acStatus").value, state:$("acState").value,
    gRates: acGrowth ? Object.assign({}, acGrowth) : undefined};
}
/* Per-account contribution growth on Advanced, or null for one rate. */
let acGrowth = null;
function acGrowthSync(){
  const on = acOn(), custom = on && !!acGrowth;
  $("acGrowthBtn").hidden = !on;
  $("acGrowthBtn").textContent = custom ? "Edit rates by account" : "Set by account";
  $("growth").readOnly = custom;
  $("growth").classList.toggle("blended", custom);
  $("growth").title = custom ? "Blended from your per-account rates. Click to edit." : "";
}
function writeAcct(a){
  const on = !!(a && a.on);
  if (on){
    const m = v => groupDigits(v || 0, true);
    $("acTradBal").value = m(a.tradBal); $("acTradC").value = m(a.tradC);
    $("acRothBal").value = m(a.rothBal); $("acRothC").value = m(a.rothC);
    $("acBrokBal").value = m(a.brokBal); $("acBrokC").value = m(a.brokC);
    $("acBrokBasis").value = a.brokBasis == null ? "" : m(a.brokBasis);
    $("acSalary").value = m(a.salary);
    $("acMatchPct").value = String(a.matchPct || 0);
    $("acMatchCap").value = String(a.matchCap == null ? 6 : a.matchCap);
    if (a.status) $("acStatus").value = a.status;
    if (a.state) $("acState").value = a.state;
  }
  acGrowth = on && a.gRates ? Object.assign({}, a.gRates) : null;
  $("acToggle").classList.toggle("on", on);
  acSync();
}
/* The employer matches matchPct% of what you put into the workplace plan,
   on your contributions up to matchCap% of salary -- "50% on the first 6%"
   tops out at 3% of salary. Traditional and Roth contributions both count
   toward it; the match itself always lands in traditional. */
function acMatchPer(a, ppy){
  if (!(a.salary > 0) || !(a.matchPct > 0)) return 0;
  const eligible = Math.min(a.tradC + a.rothC, a.salary * a.matchCap / 100 / ppy);
  return Math.max(0, eligible * a.matchPct / 100);
}
/* 65+ at retirement earns the extra standard deduction and the senior bonus.
   Advanced has no age of its own, so this reads it off the household profile
   and assumes under 65 when there isn't one. */
function acSeniors(a, years){
  const H = hhLoad();
  if (!H || !(H.age > 0)) return 0;
  let n = (H.age + years >= 65) ? 1 : 0;
  if (a.status === "m" && H.status === "m" && H.spouseAge > 0 && H.spouseAge + years >= 65) n++;
  return n;
}
function acTaxOn(a, w, seniors){
  return computeRetireTax({status:a.status, seniors, trad:w.trad, roth:w.roth, brok:w.brok,
    gainPct:w.gainPct, ss:0, pension:0, penPublic:false, other:0, pre:0,
    dedType:"std", item:0, state:a.state, _noMarginal:true});
}
/* Contribution growth by account. Each account's contributions can rise at
   their own rate, but everything downstream (charts, solves, simulations)
   runs on one contribution stream with one growth rate. The blend is that
   one rate: the one at which the combined contribution ends at exactly the
   same balance as the three accounts each growing at their own rate, so
   the totals are exact and each account's own balance uses its own rate.
   `w` is each account's share (or amount) of your contribution; any
   employer match grows at the blend. `p` is the plan or stage it runs in. */
function growthBlend(p, years, w, g){
  const ann = x => fvFactors(Object.assign({}, p, {growth:x}), years).annuity;
  const W = w.t + w.r + w.b;
  if (!(W > 0)) return (g.t + g.r + g.b) / 3;
  const target = (w.t * ann(g.t) + w.r * ann(g.r) + w.b * ann(g.b)) / W;
  let lo = Math.min(g.t, g.r, g.b), hi = Math.max(g.t, g.r, g.b);
  if (hi - lo < 1e-12) return lo;
  for (let i = 0; i < 50; i++){
    const mid = (lo + hi) / 2;
    if (ann(mid) < target) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
function acctBreakdown(p, a){
  const ppy = PPY[p.period];
  const match = acMatchPer(a, ppy);
  const F = fvFactors(p, p.years);
  const gr = a.gRates || {t:p.growth, r:p.growth, b:p.growth};
  const ann = x => x === p.growth ? F.annuity
    : fvFactors(Object.assign({}, p, {growth:x}), p.years).annuity;
  const fvT = a.tradBal * F.initFactor + a.tradC * ann(gr.t) + match * F.annuity;
  const fvR = a.rothBal * F.initFactor + a.rothC * ann(gr.r);
  const fvB = a.brokBal * F.initFactor + a.brokC * ann(gr.b);
  // Dollars a $1-per-period schedule puts in, stepping up once a year: the
  // brokerage basis grows by exactly this times the brokerage contribution.
  const dollarsIn = x => {
    let d = 0;
    for (let y = 1; y * ppy - ppy < F.n; y++)
      d += Math.min(ppy, F.n - (y - 1) * ppy) * Math.pow(1 + x, y - 1);
    return d;
  };
  const perDollar = dollarsIn(p.growth);
  const basis0 = a.brokBasis == null ? a.brokBal : a.brokBasis;
  const inflYears = (p.inflYears === null || p.inflYears === undefined || p.inflYears === "")
                    ? p.years : p.inflYears;
  return Object.assign(acFinish(a, {trad:fvT, roth:fvR, brok:fvB}, basis0 + a.brokC * dollarsIn(gr.b),
      Math.pow(1 + p.inflation, inflYears), p.withdrawal, acSeniors(a, p.years)),
    {match, matchTotal: match * perDollar, perDollar,
     // dollars put into the Roth, for the Plan Optimizer's contribution basis
     rothIn: a.rothC * dollarsIn(gr.r)});
}
/* Shared by Advanced and Stages once each has its accounts' ending balances:
   today's dollars, the first year's withdrawal split pro rata, and the tax on
   it. `fv` is in future dollars, `defl` converts to today's. */
function acFinish(a, fv, basisEnd, defl, withdrawal, seniors){
  const gainPct = fv.brok > 0 ? Math.max(0, Math.min(1, 1 - basisEnd / fv.brok)) : 0;
  const real = {trad:fv.trad / defl, roth:fv.roth / defl, brok:fv.brok / defl};
  const totalReal = real.trad + real.roth + real.brok;
  const w = {trad:real.trad * withdrawal, roth:real.roth * withdrawal,
             brok:real.brok * withdrawal, gainPct};
  const wTotal = w.trad + w.roth + w.brok;
  const T = acTaxOn(a, w, seniors);
  return {a, real, totalReal, w, wTotal, gainPct, seniors, tax:T,
          effRate: wTotal > 0 ? T.total / wTotal : 0,
          shares: totalReal > 0
            ? {trad:real.trad / totalReal, roth:real.roth / totalReal, brok:real.brok / totalReal}
            : {trad:1, roth:0, brok:0}};
}
function applyAcct(p){
  const a = readAcctState();
  if (a.gRates){
    p.growth = growthBlend(p, p.years, {t:a.tradC, r:a.rothC, b:a.brokC}, a.gRates);
    if ($("growth").readOnly || document.activeElement !== $("growth"))
      $("growth").value = +(p.growth * 100).toFixed(2);
  }
  const B = acctBreakdown(p, a);
  p.initial = a.tradBal + a.rothBal + a.brokBal;
  p.contrib = a.tradC + a.rothC + a.brokC + B.match;
  p.taxRate = B.effRate;
  p.acct = a;
  lastAcct = B;
}
/* The headline tax rate comes from the income the plan actually produces.
   An after-tax income target is a different income, taxed at a different
   rate on a progressive schedule, so the solve finds the gross withdrawal
   whose after-tax amount is the target -- same account mix, same rules. */
function acSolveP(p){
  if (!p.acct || !lastAcct || $("solveFor").value !== "After-Tax Withdrawal") return p;
  return Object.assign({}, p, {taxRate: acTargetRate(p.acct, lastAcct, num("target"), p.taxRate)});
}
function acTargetRate(a, B, target, fallback){
  if (!(target > 0)) return fallback;
  const s = B.shares;
  const net = G => G - acTaxOn(a,
    {trad:G * s.trad, roth:G * s.roth, brok:G * s.brok, gainPct:B.gainPct}, B.seniors).total;
  let lo = target, hi = target * 2;
  while (net(hi) < target && hi < target * 64) hi *= 2;
  for (let i = 0; i < 50; i++){
    const mid = (lo + hi) / 2;
    if (net(mid) < target) lo = mid; else hi = mid;
  }
  return 1 - target / hi;
}
/* Solves and the converter hand back one total per period. Spread it over
   the accounts you're already paying into, in the same proportions, and
   let the match follow; the match is capped, so the scale is found by
   bisection rather than a straight divide. */
function acSetTotal(total){
  const a = readAcctState(), ppy = PPY[$("period").value];
  let base = {trad:a.tradC, roth:a.rothC, brok:a.brokC};
  if (base.trad + base.roth + base.brok <= 0) base = {trad:1, roth:0, brok:0};
  const at = k => {
    const b = Object.assign({}, a, {tradC:base.trad * k, rothC:base.roth * k, brokC:base.brok * k});
    return b.tradC + b.rothC + b.brokC + acMatchPer(b, ppy);
  };
  let lo = 0, hi = 1;
  while (at(hi) < total && hi < 1e9) hi *= 2;
  for (let i = 0; i < 60; i++){
    const mid = (lo + hi) / 2;
    if (at(mid) < total) lo = mid; else hi = mid;
  }
  const r = v => groupDigits(Math.round(v), true);
  $("acTradC").value = r(base.trad * hi);
  $("acRothC").value = r(base.roth * hi);
  $("acBrokC").value = r(base.brok * hi);
}
function acSync(){
  const on = acOn();
  $("acToggle").setAttribute("aria-expanded", String(on));
  $("acFields").hidden = !on;
  $("initialField").hidden = on;
  $("contribField").hidden = on;
  $("taxrateField").hidden = on;
  $("acTaxField").hidden = !on;
  $("acPanel").hidden = !on;
  /* The schedule belongs with the contributions it applies to: split by
     account, the period and yearly growth sit right under the accounts (one
     schedule for all of them), and go back to their own places after. */
  const inBlock = $("periodField").parentNode === $("acSchedule");
  if (on && !inBlock){
    $("acSchedule").appendChild($("periodField"));
    $("acSchedule").appendChild($("growthField"));
  } else if (!on && inBlock){
    $("periodHome").after($("periodField"));
    $("growthHome").after($("growthField"));
  }
  const per = AC_PER[$("period").value] || "";
  document.querySelectorAll("#acFields .acper").forEach(el => { el.textContent = per; });
  acGrowthSync();
}
function acFillStates(){
  $("acState").innerHTML = $("txState").innerHTML;
  $("saState").innerHTML = $("txState").innerHTML;
}

/* iOS zooms toward a focused field even when the font is large enough. Pinning
   maximum-scale for the duration of the focus stops that; the original viewport
   is restored on blur so pinch-zoom still works everywhere else. */
(function(){
  const vp = document.querySelector('meta[name="viewport"]');
  if (!vp) return;
  const BASE = vp.getAttribute("content");
  const LOCKED = BASE + ", maximum-scale=1";
  let restore = null;
  function lock(){
    clearTimeout(restore);
    if (vp.getAttribute("content") !== LOCKED) vp.setAttribute("content", LOCKED);
  }
  function unlock(){
    clearTimeout(restore);
    // brief delay so tabbing between fields doesn't flicker the viewport
    restore = setTimeout(() => vp.setAttribute("content", BASE), 250);
  }
  document.addEventListener("focusin", e => {
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) lock();
  });
  document.addEventListener("focusout", e => {
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) unlock();
  });
})();

