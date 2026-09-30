/* ---------- retirement readiness guide ---------- */
/* A long-form walkthrough: one question at a time about someone's money, in
   the order a planner would take it (income, spending, safety net, big goals,
   retirement). When they don't know an answer, a step sends them into the
   tool that finds it, pre-filled, with a coach panel docked over the tool
   that lists what to do there and ticks items off as the tool's own fields
   change. "Back to guide" carries the tool's result back into the answer.

   Answers live under their own key. The facts the household bar also holds
   (ages, state, income, savings, spending) are written through to it, so the
   rest of the site opens on the same numbers; nothing is pushed into a tool
   except on the way into that tool, so the guide never quietly overwrites
   work done elsewhere. */
const GD_KEY = "finance-tools.guide.v1";
let gdMem = null;
function gdFresh(){ return {v:1, cur:"intro", a:{}, done:{}, trip:null, back:null, coachMin:false}; }
function gdLoadState(){
  try {
    const raw = localStorage.getItem(GD_KEY);
    if (raw){
      const v = JSON.parse(raw);
      if (v && v.v === 1 && v.a && typeof v.a === "object"){
        // The Retiring early step became Adjust your plan.
        if (v.cur === "fire") v.cur = "tune";
        if (v.back && v.back.step === "fire") v.back = null;
        gdMigrate(v.a);
        return Object.assign(gdFresh(), v);
      }
    }
  } catch(e){}
  return gdMem ? JSON.parse(JSON.stringify(gdMem)) : gdFresh();
}
/* Answers saved before income tax was built in. The Roth and brokerage split
   used to be asked only on the Getting to 59½ step; and a tax estimate added
   to retirement spending by hand would now be counted twice. */
function gdMigrate(a){
  if (!a) return;
  if (a.rothNow == null && a.brRothNow != null) a.rothNow = a.brRothNow;
  if (a.brokNow == null && a.brBrokNow != null) a.brokNow = a.brBrokNow;
  delete a.brRothNow; delete a.brBrokNow;
  // (runs before gdPos exists, so the checks are spelled out)
  if (a.retTaxAdded && a.retTax > 0 && a.retSpend > 0) a.retSpend = Math.max(0, a.retSpend - a.retTax);
  delete a.retTaxAdded; delete a.retTax;
}
let gd = gdLoadState();
function gdSave(){
  gdMem = gd;
  try { localStorage.setItem(GD_KEY, JSON.stringify(gd)); } catch(e){}
  // Choices and applied changes aren't typing, so the saved-plan picker's
  // "(edited)" flag is checked here too.
  try { if (chartMode.tab === "guide") scheduleDirtyCheck(); } catch(e){}
}
/* A saved plan, for the scenario picker: every answer and which steps are
   done. Where you were and any open trip into a tool are left out. */
function gdPlanData(){
  return {v:1, a:JSON.parse(JSON.stringify(gd.a)), done:Object.assign({}, gd.done)};
}
function gdLoadPlan(d){
  if (!d || !d.a || typeof d.a !== "object") return;
  gd = gdFresh();
  gd.a = JSON.parse(JSON.stringify(d.a));
  gdMigrate(gd.a);
  gd.done = Object.assign({}, d.done || {});
  const L = gdNumbered();
  gd.cur = L.every(st => st.id === "results" || gd.done[st.id]) ? "results" : gdFirstOpen();
  gdSel = null; gdDraft = null;
  gdHouseholdSync();
  gdSave();
  gdCoachSync();
  if (!$("tab-guide").hidden) gdRender(true);
}

const gdOk = v => typeof v === "number" && isFinite(v);
const gdPos = v => gdOk(v) && v > 0;
const gdM = v => gdOk(v) ? groupDigits(Math.round(v), true) : "";
function gdMar(){ return gd.a.status === "m"; }
function gdGross(){ const a = gd.a; return (a.income || 0) + (gdMar() ? (a.income2 || 0) : 0); }
function gdSaveMo(){ return (gd.a.contrib || 0) + (gd.a.employer || 0); }
/* What's going in today: nothing on a plan that coasts from now. */
function gdCoastNow(){ const a = gd.a; return gdOk(a.stopAge) && gdOk(a.age) && a.stopAge <= a.age && !(gdOk(a.retire) && a.stopAge >= a.retire); }
function gdSaveNow(){ return gdCoastNow() ? 0 : gdSaveMo(); }
function gdInterp(x, pts){
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++){
    if (x <= pts[i][0]){
      const x0 = pts[i - 1][0], y0 = pts[i - 1][1], x1 = pts[i][0], y1 = pts[i][1];
      return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
    }
  }
  return pts[pts.length - 1][1];
}
function gdMonths(v){ return v >= 10 ? String(Math.round(v)) : (Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, ""); }
function gdRiskLabel(real){
  const r = RISK_LEVELS.find(x => Math.abs(x.real - real) < 1e-6) || RISK_LEVELS[2];
  return r.label.toLowerCase();
}

/* Monthly take-home from the salary alone, through the same 2026 rules the
   Income Tax tool uses: the fallback when someone skips that step. */
function gdTaxEst(){
  const g1 = gd.a.income || 0, g2 = gdMar() ? (gd.a.income2 || 0) : 0;
  if (!(g1 + g2 > 0)) return 0;
  const T = computeTax({status: gdMar() ? "m" : "s", gross:g1, gross2:g2, pre:0,
    dedType:"std", item:0, state: gd.a.state || $("txState").value});
  return T.net / 12;
}

/* The share of historical retirements a plan has to survive to count as on
   track. 90% unless the person asks for more margin on the Adjust step. */
function gdTarget(){ const t = gd.a.target; return t === .95 || t === 1 ? t : .9; }
/* Stock share of the portfolio in retirement: 60% unless changed in the
   Drawdown Simulator and brought back. */
function gdRetMix(){ const m = gd.a.retMix; return gdOk(m) && m >= 0 && m <= 100 ? m : 60; }
/* The least the household could live on in a bad stretch, in today's
   dollars: a hard floor for the flexible withdrawal strategies, the same
   Minimum spending the Drawdown Simulator has. The fixed approach never
   cuts, so it doesn't apply there. */
function gdMinSpend(){ const m = gd.a.minSpend; return gdPos(m) ? m : 0; }

/* When Social Security starts. The age chosen on the Spending in retirement
   step, or by default 67 (full retirement age), or retirement if that's
   later, up to 70. Never before retirement in this plan: a benefit claimed
   while still working is mostly withheld by the earnings test. This is the
   plan as you'd run it yourself; the Plan Optimizer can pick other ages. */
function gdClaim(retire){
  const r = Math.min(70, Math.round(retire)), c = gd.a.ssClaim;
  if (gdOk(c)) return Math.max(62, Math.min(70, Math.max(c, r)));
  return Math.max(67, r);
}
/* Each of you's Social Security at full retirement age, a month, in today's
   dollars: from a statement when there is one, or estimated from income over
   the years worked by retirement, from 22. Social Security averages the best
   35, so retiring at 45 averages in 12 years of zeros. A lower earner gets a
   spousal top-up to half the higher earner's benefit; the plan engine works
   that out for the ages each of you claims. */
function gdPias(retire){
  const a = gd.a;
  const yrs1 = Math.max(1, Math.min(35, Math.round(retire) - 22));
  const spAt = gdMar() && gdOk(a.spouseAge) && gdOk(a.age) ? a.spouseAge + (retire - a.age) : retire;
  const yrs2 = Math.max(1, Math.min(35, Math.round(spAt) - 22));
  const own = gdPos(a.ssOwn), own2 = gdMar() && gdPos(a.ssOwn2);
  return {pia1: own ? a.ssOwn : ssEstimate(a.income || 0, yrs1, 67).pia,
    pia2: !gdMar() ? 0 : own2 ? a.ssOwn2 : ssEstimate(a.income2 || 0, yrs2, 67).pia,
    own, own2, career:yrs1, career2:yrs2};
}
/* Social Security for a retirement age, while typing: each of you's yearly
   benefit once claimed, at the ages the plan uses (the Plan Optimizer's, if
   applied). */
function gdSS(retire){
  const a = gd.a, pia = gdPias(retire), Tq = gdTactics(), claim = gdClaim(retire);
  const age1 = Math.round(retire);
  const age2 = gdMar() && gdOk(a.spouseAge) && gdOk(a.age) ? Math.round(a.spouseAge + (retire - a.age)) : null;
  const c1 = Math.max(plClaimMin(age1), Math.min(70, Tq ? Tq.c1 : claim));
  const c2 = age2 == null ? c1 : Math.max(plClaimMin(age2), Math.min(70, Tq ? Tq.c2 : claim));
  const S = plSSParts({P:{pia1:pia.pia1, pia2:pia.pia2}, married:gdMar(), gap:age2 == null ? 0 : age2 - age1}, {c1, c2});
  return {a1:S.own1 + S.top1, a2:S.own2 + S.top2, total:S.total, claim:c1, claim2:c2,
    delay:Math.max(0, c1 - age1), own:pia.own, own2:pia.own2, spousal:S.top1 + S.top2 > 0,
    career:pia.career, tactics:!!Tq};
}
/* A pension or other steady retirement income, in the Drawdown Simulator's
   own custom-income form so a trip there carries it. */
function gdPensionItems(retire){
  const a = gd.a;
  if (!gdPos(a.pension)) return [];
  const from = gdOk(a.pensionAge) ? a.pensionAge : retire;
  return [{name:"Pension", on:true, annual:a.pension * 12, inflate:a.pensionCola === "yes",
    startYear:Math.max(1, Math.round(from - retire) + 1), duration:{type:"forever"}}];
}
/* How long the money has to last: to 95, or to the younger spouse's 95. */
function gdYearsFor(retire){
  const a = gd.a;
  let end = 95 - Math.round(retire);
  if (gdMar() && gdOk(a.spouseAge) && gdOk(a.age))
    end = Math.max(end, 95 - Math.round(a.spouseAge + (retire - a.age)));
  return Math.max(20, Math.min(60, end));
}

/* Where the money sits. Today's balances: the Roth and brokerage amounts
   from the Retirement savings step, the rest traditional. New saving goes
   where the person says it does; an employer's match always lands in a
   traditional account. */
const GD_SAVE_TO = [["trad", "Mostly pre-tax", "A traditional 401(k), 403(b) or IRA"],
  ["roth", "Mostly Roth", "A Roth 401(k) or Roth IRA"],
  ["half", "About half and half", "Some of each"],
  ["brok", "Mostly a taxable account", "A brokerage account outside a retirement plan"]];
function gdAccts(){
  const a = gd.a, saved = Math.max(0, a.saved || 0);
  const roth = Math.min(saved, gdPos(a.rothNow) ? a.rothNow : 0);
  const brok = Math.min(saved - roth, gdPos(a.brokNow) ? a.brokNow : 0);
  return {trad:saved - roth - brok, roth, brok};
}
function gdSaveSplit(mine){
  const to = gd.a.saveTo || "trad";
  if (to === "roth") return {t:0, r:mine, b:0};
  if (to === "half") return {t:mine / 2, r:mine / 2, b:0};
  if (to === "brok") return {t:0, r:0, b:mine};
  return {t:mine, r:0, b:0};
}
/* The Plan Optimizer's choices, once applied: stored as plain numbers so a
   shared link carries them. */
function gdTactics(){
  const a = gd.a;
  if (!gdOk(a.optC1)) return null;
  return {c1:a.optC1, c2:gdOk(a.optC2) ? a.optC2 : a.optC1, f:a.optF || 0, u:a.optU || 0,
    im:a.optIm || 0, ac:a.optAc || 0};
}

/* The Drawdown Simulator's options for a plan, with any withdrawal strategy,
   for a trip there. The simulator doesn't work out tax, so the plan's
   typical yearly tax rides along with its spending. Every strategy starts
   from that rate; VPW uses the Bogleheads return for the mix, since it sets
   its own spending. */
function gdDDOpts(S, strategy){
  const rate = (S.spend + (S.taxYr || 0)) / Math.max(1, S.fv) * 100;
  return {initial:S.fv, years:S.years, stockPct:S.mix, stockPctEnd:null, fee:0,
    strategy:strategy || "fixed", initialPct:rate, guardBand:20, adjustPct:10,
    floorPct:10, ceilPct:10, yaleWeight:70, yaleRate:rate, spendFloor:gdMinSpend(), spendCeil:0,
    vpwRate:(S.mix * 5 + (100 - S.mix) * 1.9) / 100, vpwFV:0,
    ssAnnual:S.ss.a1, ssDelayYears:S.ss.delay, ssAnnual2:S.ss.a2, ssDelayYears2:S.ss.delay,
    legacyGoal:0, retireAge:S.retire, fromYear:HIST_START, incomeItems:S.inc, expenseItems:[]};
}

/* The plan engine's inputs from the answers. `over` swaps in a different
   retirement age, monthly saving (yours and your employer's together), stop
   age or spending, which is how the options on the Adjust step are found. */
function gdPlanIn(over){
  over = over || {};
  const a = gd.a, has = k => Object.prototype.hasOwnProperty.call(over, k);
  if (!gdOk(a.age) || !gdOk(a.retire) || !gdOk(a.saved) || !gdOk(a.contrib) || !gdPos(a.retSpend)) return null;
  const retire = has("retire") ? over.retire : a.retire;
  if (!(retire > a.age)) return null;
  const monthly = has("monthly") ? over.monthly : gdSaveMo();
  const spend = has("spend") ? over.spend : a.retSpend;
  if (!(spend > 0)) return null;
  let stop = has("stopAge") ? over.stopAge : a.stopAge;
  if (!gdOk(stop) || stop >= retire) stop = null;
  if (stop != null) stop = Math.max(a.age, stop);
  const emp = Math.min(Math.max(0, monthly), a.employer || 0), sp = gdSaveSplit(Math.max(0, monthly - emp));
  const A = gdAccts(), pia = gdPias(retire), claim = gdClaim(retire);
  return {status:gdMar() ? "m" : "s", state:a.state || $("txState").value || "IL", age:a.age,
    spouseAge:gdMar() && gdOk(a.spouseAge) ? a.spouseAge : null, retire, stopAge:stop,
    trad:A.trad, roth:A.roth, brok:A.brok, rothBasis:A.roth * .5, brokBasis:A.brok * .6,
    saveTrad:sp.t + emp, saveRoth:sp.r, saveBrok:sp.b, real:a.risk || .045, infl:BASIC_INFL,
    spend, pia1:pia.pia1, pia2:pia.pia2, claim1:claim, claim2:claim,
    pension:gdPos(a.pension) ? a.pension * 12 : 0, pensionAge:gdOk(a.pensionAge) ? a.pensionAge : null,
    pensionCola:a.pensionCola === "yes", aca:retire < 65 && a.hcIncl !== "yes",
    household:gdMar() ? 2 : 1, rule55:a.rule55 === "yes", heirRate:PL_HEIR, mix:gdRetMix(),
    years:gdYearsFor(retire), target:gdTarget(), strategy:"fixed", minSpend:0, fromYear:HIST_START,
    monthly};
}
/* Social Security as the plan runs it, for the page: each of you's yearly
   benefit once claimed (spousal top-up included) and the ages. */
function gdSSOf(C, T, retire){
  const pia = gdPias(retire), S = plSSParts(C, T);
  return {a1:S.own1 + S.top1, a2:S.own2 + S.top2, total:S.total, claim:T.c1, claim2:T.c2,
    delay:Math.max(0, T.c1 - Math.round(retire)), own:pia.own, own2:pia.own2,
    spousal:S.top1 + S.top2 > 0, career:pia.career};
}

/* The retirement engine behind the score: today's balances and saving,
   account by account, grown to the retirement age at the mix's steady
   return (Basic's projection), then that retirement run through every
   historical retirement since 1926 by the plan engine, spending a fixed
   amount that rises with inflation, with the year's income tax, Medicare
   surcharge and pre-65 marketplace premiums paid on top. Social Security is
   claimed at the age answered, and withdrawals come from the brokerage,
   then traditional, then Roth, unless the Plan Optimizer's choices have
   been applied. `over` swaps in a different monthly saving, retirement age,
   stop age or spending; `base` ignores any applied optimizer choices. */
const gdSimCache = {};
function gdSim(over, base){
  const I = gdPlanIn(over);
  if (!I) return null;
  const Tq = base ? null : gdTactics();
  const key = JSON.stringify(I) + "|" + (Tq ? plKey(Tq) : "");
  if (gdSimCache[key]) return gdSimCache[key];
  const P = plAtRetire(I), C = plPrep(P);
  let T = plBaseTactics(C);
  if (Tq) T = Object.assign({}, Tq, {c1:Math.max(plClaimMin(C.age1), Math.min(70, Tq.c1)),
    c2:C.married ? Math.max(plClaimMin(C.age2), Math.min(70, Tq.c2)) : Math.max(plClaimMin(C.age1), Math.min(70, Tq.c1))});
  const H = plHistory(C, T, {paths:true}), D = plDetail(C, T);
  const ss = gdSSOf(C, T, I.retire);
  // Tax and health premiums in a typical year, from the steady path.
  let tx = 0, hc = 0, hn = 0;
  D.rows.forEach(r => { tx += r.tax + r.irmaa; if (r.health > 0){ hc += r.health; hn++; } });
  const out = {key, I, P, C, T, tactics:!!Tq, fv:P.fv, years:C.years, ss, spend:I.spend, retire:I.retire,
    monthly:I.monthly, real:I.real, stop:I.stopAge, saveYears:(I.stopAge == null ? I.retire : I.stopAge) - I.age,
    mix:I.mix, inc:gdPensionItems(I.retire), pension:I.pension, path:P.path, H, D,
    success:H.successRate, taxYr:D.rows.length ? tx / D.rows.length : 0, hcYr:hn ? hc / hn : 0, hcYears:hn,
    lifeTax:H.medTax, portIncome:P.fv * .04};
  out.coverage = (out.portIncome + ss.total + I.pension) / (I.spend + out.taxYr);
  gdSimCache[key] = out;
  return out;
}
/* What a plan has to have saved by retirement to last in the target share of
   history: the same test, solved for the balance at retirement, every
   account scaled together. */
function gdNeed(S){
  const goal = gdTarget(), key = "need|" + goal + "|" + S.key;
  if (gdSimCache[key] != null) return gdSimCache[key];
  const P = S.P, n = S.H.total, maxFail = Math.floor(n * (1 - goal) + 1e-9);
  const lasts = fv => {
    const k = S.fv >= 1000 ? fv / S.fv : 0;
    const Q = S.fv >= 1000 ? Object.assign({}, P, {trad:P.trad * k, roth:P.roth * k, rothBasis:P.rothBasis * k,
      brok:P.brok * k, brokBasis:P.brokBasis * k}) : Object.assign({}, P, {trad:fv, roth:0, rothBasis:0, brok:0, brokBasis:0});
    const H = plHistory(plPrep(Q), S.T, {stopAfter:maxFail});
    return !H.partial && H.total - H.survived <= maxFail;
  };
  let lo = 0, hi = Math.max(S.spend * 60, S.fv * 2);
  if (lasts(0)) return (gdSimCache[key] = 0);
  for (let i = 0; i < 22; i++){ const m = (lo + hi) / 2; if (lasts(m)) hi = m; else lo = m; }
  return (gdSimCache[key] = Math.ceil(hi / 1000) * 1000);
}
/* The median balance through retirement, with the 10th and 90th percentile,
   in today's dollars, for the chart. */
function gdRetPath(S){
  if (!S.retPath) S.retPath = plBands(S.H, S.years);
  return S.retPath;
}

/* ---------- the score ---------- */
const GD_FACTORS = [
  {id:"outlook", name:"Retirement outlook", w:40, step:"outlook"},
  {id:"rate",    name:"Savings rate",       w:20, step:"savings"},
  {id:"cushion", name:"Emergency fund",     w:15, step:"cash"},
  {id:"debt",    name:"Debt",               w:15, step:"debt"},
  {id:"flow",    name:"Monthly cash flow",  w:10, step:"spending"}
];
function gdParts(){
  const a = gd.a, P = {}, inc = gdGross();
  const S = gdSim();
  if (S) P.outlook = {p: gdInterp(S.success, [[.25,0],[.5,.35],[.7,.6],[.85,.85],[.95,1]]),
    txt: pctStr(S.success, 0) + " of historical retirements lasted"};
  if (inc > 0 && gdOk(a.contrib) && a.match){
    const r = gdSaveNow() * 12 / inc;
    let p = gdInterp(r, [[0,0],[.05,.35],[.10,.7],[.15,1]]);
    // 15% is a rule of thumb for people who don't know what they need. Once
    // the projection shows what's saved is enough, it has done its job, so a
    // plan that has chosen to coast or save less isn't marked down for it.
    const enough = S && S.success >= gdTarget() - 1e-9;
    if (enough) p = 1;
    if (a.match === "partial") p *= .75;
    P.rate = {p, r, txt: gdCoastNow() && enough ? "Coasting: what you have is enough" : pctStr(r, 1) + " of gross income" +
      (a.match === "partial" ? ", missing some match" : enough && r < .15 ? ", enough for your plan" : "")};
  }
  if (gdOk(a.cash) && gdPos(a.spend)){
    const m = a.cash / a.spend;
    P.cushion = {p: gdInterp(m, [[0,0],[1,.3],[3,.75],[6,1]]), m,
      txt: gdMonths(m) + (m === 1 ? " month" : " months") + " of spending"};
  }
  if (a.debtHas === "no") P.debt = {p:1, txt:"Nothing owed besides any mortgage"};
  else if (a.debtHas === "yes" && gdOk(a.debtTotal) && inc > 0){
    const hi = Math.min(a.debtHi || 0, a.debtTotal), lo = a.debtTotal - hi;
    const p = Math.max(0, 1 - Math.min(1, hi / inc * 4) * .7 - Math.min(1, lo / inc) * .3);
    P.debt = {p, txt: money(a.debtTotal) + " owed" + (hi > 0 ? ", " + money(hi) + " at 8% or more" : "")};
  }
  if (gdPos(a.takehome) && gdPos(a.spend)){
    const m = (a.takehome - a.spend) / a.takehome;
    P.flow = {p: gdInterp(m, [[-.05,0],[0,.25],[.1,.75],[.2,1]]), m,
      txt: (a.takehome >= a.spend ? money(a.takehome - a.spend) + "/mo not spent"
        : money(a.spend - a.takehome) + "/mo over take-home")};
  }
  return P;
}
function gdScore(){
  const P = gdParts();
  const have = GD_FACTORS.filter(f => P[f.id]);
  const w = have.reduce((s, f) => s + f.w, 0);
  // One area alone says too little to put a number on.
  const score = have.length >= 2 ? Math.round(have.reduce((s, f) => s + f.w * P[f.id].p, 0) / w * 100) : null;
  return {score, P, n:have.length};
}
function gdRating(s){
  if (s == null) return {label:"Not scored yet", color:"var(--dimmer)"};
  if (s >= 85) return {label:"On track", color:"var(--jade)"};
  if (s >= 70) return {label:"Nearly there", color:"var(--jade)"};
  if (s >= 50) return {label:"Getting there", color:"var(--gold)"};
  if (s >= 30) return {label:"Needs work", color:"var(--gold)"};
  return {label:"Needs attention", color:"var(--coral)"};
}
function gdBarColor(p){ return p >= .8 ? "var(--jade)" : p >= .5 ? "var(--gold)" : "var(--coral)"; }
function gdRing(score, size){
  const r = 52, c = 2 * Math.PI * r, f = score == null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  const col = gdRating(score).color;
  return "<svg class='gd-ring' viewBox='0 0 120 120' role='img' aria-label='" +
    (score == null ? "No score yet" : "Score " + score + " out of 100") + "'" +
    (size ? " style='width:" + size + "px;height:" + size + "px'" : "") + ">" +
    "<circle class='trk' cx='60' cy='60' r='" + r + "' fill='none' stroke-width='10'/>" +
    "<circle class='val' cx='60' cy='60' r='" + r + "' fill='none' stroke-width='10' stroke-linecap='round'" +
    " stroke='" + col + "' stroke-dasharray='" + c.toFixed(1) + "' stroke-dashoffset='" + (c * (1 - f)).toFixed(1) +
    "' transform='rotate(-90 60 60)'/>" +
    "<text x='60' y='" + (score == null ? 67 : 69) + "' text-anchor='middle' font-size='" + (score == null ? 22 : 32) + "'>" +
    (score == null ? "—" : score) + "</text></svg>";
}

/* The ways to change the plan, each solved on its own against the target
   share of historical retirements. A plan short of the target gets the ways
   to close the gap: save more, retire later, spend less, keep saving to
   retirement if it coasts, or a mix. A plan past it gets the ways to use the
   surplus: retire sooner, stop saving at some age and let growth carry it
   (coasting), save less, or spend more. Each option carries the change to
   the answers (`set`) and the plan it produces (`T`). */
const gdOptCache = {};
function gdOverFrom(set){
  const o = {};
  if ("retire" in set) o.retire = set.retire;
  if ("contrib" in set) o.monthly = set.contrib + (gd.a.employer || 0);
  if ("retSpend" in set) o.spend = set.retSpend;
  if ("stopAge" in set) o.stopAge = set.stopAge;
  return o;
}
function gdOptions(){
  const S = gdSim();
  if (!S) return null;
  const a = gd.a, goal = gdTarget();
  const key = [JSON.stringify(a), goal, JSON.stringify(gdLevers)].join("|");
  if (gdOptCache.key === key) return gdOptCache.val;
  const ok = T => !!T && T.success >= goal - 1e-9;
  const emp = a.employer || 0, mine = a.contrib || 0, age = Math.round(a.age), ret = Math.round(S.retire);
  const list = [], add = (id, set) => {
    const T = gdSim(gdOverFrom(set));
    if (T) list.push({id, set, T});
  };
  const ahead = ok(S);
  if (ahead){
    // Retire sooner: the earliest age that still passes, stepping down a year
    // at a time (Social Security and the length of retirement move with it).
    let r = null;
    for (let x = ret - 1; x > age; x--){ if (ok(gdSim({retire:x}))) r = x; else break; }
    if (r != null) add("earlier", {retire:r});
    // Coast: the earliest age contributions could stop, still retiring on time.
    if (S.monthly > 0){
      const last = S.stop != null ? S.stop : ret;
      for (let x = age; x < last; x++){ if (ok(gdSim({stopAge:x}))){ add("coast", {stopAge:x}); break; } }
    }
    // Save less: the least you could put in yourself (your employer's share
    // stays). Skipped when stopping altogether already works.
    const coastNow = list.some(o => o.id === "coast" && o.set.stopAge <= age);
    if (mine > 0 && !coastNow){
      let lo = 0, hi = mine;
      if (!ok(gdSim({monthly:emp}))){
        for (let i = 0; i < 18; i++){ const m = (lo + hi) / 2; if (ok(gdSim({monthly:emp + m}))) hi = m; else lo = m; }
      } else hi = 0;
      const v = Math.min(mine, Math.ceil(hi / 25) * 25);
      if (mine - v >= 50) add("less", {contrib:v});
    }
    // Spend more in retirement.
    let lo = S.spend, hi = S.spend * 4;
    if (!ok(gdSim({spend:hi}))){
      for (let i = 0; i < 18; i++){ const m = (lo + hi) / 2; if (ok(gdSim({spend:m}))) lo = m; else hi = m; }
    } else lo = hi;
    const v = Math.floor(lo / 500) * 500;
    if (v >= S.spend + 1000) add("more", {retSpend:v});
  } else {
    // A coast plan that falls short may only need to keep saving.
    if (S.stop != null && ok(gdSim({stopAge:null}))) add("keepsaving", {stopAge:null});
    // Save more: the smallest extra that gets there, up to a generous cap.
    const cap = Math.max(1000, S.monthly * 3 + 3000);
    if (ok(gdSim({monthly:S.monthly + cap}))){
      let lo = 0, hi = cap;
      for (let i = 0; i < 18; i++){ const m = (lo + hi) / 2; if (ok(gdSim({monthly:S.monthly + m}))) hi = m; else lo = m; }
      add("extra", {contrib:mine + Math.ceil(hi / 25) * 25});
    }
    // Retire later, up to 75.
    let later = null;
    for (let x = ret + 1; x <= Math.min(75, ret + 15); x++){ if (ok(gdSim({retire:x}))){ later = x; break; } }
    if (later != null) add("later", {retire:later});
    // Spend less.
    let lo = 0, hs = S.spend;
    for (let i = 0; i < 18; i++){ const m = (lo + hs) / 2; if (ok(gdSim({spend:Math.max(1, m)}))) lo = m; else hs = m; }
    const v = Math.floor(lo / 500) * 500;
    if (v > 0) add("less-spend", {retSpend:v});
  }
  gdBalance(S, ahead, list, ok, add);
  const val = {S, goal, ahead, list};
  gdOptCache.key = key; gdOptCache.val = val;
  return val;
}
/* Balance several changes: every lever the person allows moves the same
   share of the way to its own single-lever answer, and that share is solved
   for. Behind, it's the smallest share that reaches the target, so no one
   change has to be big; ahead, the largest share the plan can afford, so the
   surplus is spread across retiring sooner, saving less and spending more. */
let gdLevers = {retire:true, save:true, spend:true};
function gdBalance(S, ahead, list, ok, add){
  const a = gd.a, mine = a.contrib || 0, ret = Math.round(S.retire), age = Math.round(a.age);
  const find = id => list.find(o => o.id === id);
  const d = {};
  if (ahead){
    const e = find("earlier"), l = find("less"), c = find("coast"), m = find("more");
    if (gdLevers.retire && e) d.retire = ret - e.set.retire;
    if (gdLevers.save && mine > 0) d.save = l ? mine - l.set.contrib : c && c.set.stopAge <= age ? mine : 0;
    if (gdLevers.spend && m) d.spend = m.set.retSpend - S.spend;
  } else {
    const x = find("extra"), l = find("later"), s2 = find("less-spend");
    if (gdLevers.retire) d.retire = (l ? l.set.retire : Math.min(75, ret + 10)) - ret;
    if (gdLevers.save) d.save = x ? x.set.contrib - mine : Math.max(1000, S.monthly * 3 + 3000);
    if (gdLevers.spend) d.spend = S.spend - (s2 ? s2.set.retSpend : S.spend * .6);
  }
  const keys = Object.keys(d).filter(k => d[k] > 0);
  if (keys.length < 2) return;
  const sign = ahead ? -1 : 1;
  const setAt = f => {
    const set = {};
    if (d.retire) set.retire = ret + sign * (ahead ? Math.floor(f * d.retire) : Math.ceil(f * d.retire));
    if (d.save) set.contrib = Math.max(0, mine + sign * (ahead ? Math.floor(f * d.save / 25) : Math.ceil(f * d.save / 25)) * 25);
    if (d.spend) set.retSpend = Math.floor((S.spend - sign * f * d.spend) / 500) * 500;
    Object.keys(set).forEach(k => { if ((k === "retire" && set[k] === ret) || (k === "contrib" && set[k] === mine) || (k === "retSpend" && set[k] === S.spend)) delete set[k]; });
    return set;
  };
  const pass = f => ok(gdSim(gdOverFrom(setAt(f))));
  let lo = 0, hi = 1;
  if (ahead){
    if (!pass(lo)) return;
    if (pass(1)) lo = 1;
    else for (let i = 0; i < 16; i++){ const m = (lo + hi) / 2; if (pass(m)) lo = m; else hi = m; }
    const set = setAt(lo);
    if (Object.keys(set).length >= 2) add("balance", set);
  } else {
    if (!pass(1)) return;
    for (let i = 0; i < 16; i++){ const m = (lo + hi) / 2; if (pass(m)) hi = m; else lo = m; }
    const set = setAt(hi);
    if (Object.keys(set).length >= 2) add("balance", set);
  }
}
/* The cheapest ways to close a gap, for the plan's to-do list. */
function gdFixes(){
  const O = gdOptions();
  if (!O || O.ahead) return O ? {} : null;
  const out = {};
  O.list.forEach(o => {
    if (o.id === "extra") out.extra = o.set.contrib - (gd.a.contrib || 0);
    if (o.id === "later") out.retire = o.set.retire;
    if (o.id === "less-spend") out.spend = o.set.retSpend;
  });
  return out;
}

/* ---------- the plan chart ----------
   Savings over time in today's dollars: the projection while saving, then
   the median of every historical retirement, with the middle 80% of them
   shaded for the plan being looked at. One series in jade, or the plan as
   it is (steel) against a proposed change (jade). Drawn after the card is on
   the page, at the width it actually has, so labels stay legible on a phone. */
const gdCharts = {};
function gdCompact(v){
  const x = Math.abs(v);
  if (x >= 1e6) return "$" + (Math.round(v / 1e5) / 10).toString().replace(/\.0$/, "") + "M";
  if (x >= 1e3) return "$" + Math.round(v / 1e3) + "k";
  return "$" + Math.round(v);
}
function gdSeries(S, name, cls){
  const a0 = Math.round(gd.a.age), pts = [];
  S.path.forEach((v, i) => pts.push({x:a0 + i, y:v, save:true}));
  const R = gdRetPath(S), r0 = Math.round(S.retire);
  R.forEach((r, i) => pts.push({x:r0 + i + 1, y:r.p50, lo:r.p10, hi:r.p90}));
  pts[S.path.length - 1].lo = pts[S.path.length - 1].hi = S.fv;
  // Each historical retirement's own path, from the balance at retirement,
  // drawn faintly under the band.
  const traces = S.H && S.H.runs ? S.H.runs.map(run => {
    const ln = [{x:r0, y:S.fv}];
    for (let i = 0; i < S.years; i++) ln.push({x:r0 + i + 1, y:run.path ? run.path[i] : 0});
    return ln;
  }) : [];
  return {name, cls, S, pts, traces, retire:r0, stop:S.stop != null ? Math.round(S.stop) : null};
}
/* A placeholder the card can carry; gdChartsDraw fills it once it's laid out. */
function gdChartSlot(id, series, caption){
  gdCharts[id] = series;
  const L = series.length > 1 ? "<div class='gd-ch-legend'>" + series.map(x =>
    "<span><s class='" + x.cls + "'></s>" + x.name + "</span>").join("") + "</div>" : "";
  const step = 5, first = series[0].pts[0].x, last = Math.max.apply(null, series.map(x => x.pts[x.pts.length - 1].x));
  let rows = "";
  for (let age = first; age <= last; age += step){
    rows += "<tr><td>" + age + "</td>" + series.map(x => {
      const p = x.pts.find(q => q.x === age);
      return "<td>" + (p ? money(p.y) : "—") + "</td>";
    }).join("") + "</tr>";
  }
  return "<figure class='gd-chfig'>" + L +
    "<div class='gd-chart' data-chart='" + id + "' tabindex='0' role='img' aria-label='" + escapeHtml(caption) + ". Use the arrow keys to read values by age.'></div>" +
    "<figcaption class='gd-ch-cap'>" + caption + ". The shaded band is the middle 80% of historical retirements.</figcaption>" +
    "<details class='gd-ch-table'><summary>Show as a table</summary><table><thead><tr><th>Age</th>" +
    series.map(x => "<th>" + x.name + "</th>").join("") + "</tr></thead><tbody>" + rows + "</tbody></table></details></figure>";
}
function gdChartsDraw(root){
  (root || document).querySelectorAll(".gd-chart[data-chart]").forEach(el => {
    const series = gdCharts[el.getAttribute("data-chart")];
    if (series) gdChartDraw(el, series);
  });
}
function gdChartDraw(el, series){
  const W = Math.max(280, el.clientWidth || 600), H = W < 480 ? 210 : 250;
  const pl = W < 480 ? 44 : 54, pr = 14, pt = 22, pb = 28;
  const all = [].concat.apply([], series.map(x => x.pts));
  const x0 = Math.min.apply(null, all.map(p => p.x)), x1 = Math.max.apply(null, all.map(p => p.x));
  // A plan with far more than it needs keeps compounding through retirement,
  // and drawn to scale that would flatten the years that matter. The scale
  // stops at a little over twice the largest balance at retirement; anything
  // past it is clipped and said in words underneath.
  const most = Math.max.apply(null, series.map(x => x.S.fv)), high = Math.max(1, Math.max.apply(null, all.map(p => p.y)));
  const capped = high > most * 2.4;
  const top = (capped ? most * 2.2 : high) * 1.12;
  const mag = Math.pow(10, Math.floor(Math.log10(top / 4)));
  const stepY = [1, 2, 2.5, 5, 10].map(m => m * mag).find(v => top / v <= 4.5) || mag * 10;
  const yMax = Math.ceil(top / stepY) * stepY;
  const X = v => pl + (v - x0) / Math.max(1, x1 - x0) * (W - pl - pr);
  const Y = v => pt + (1 - Math.max(0, v) / yMax) * (H - pt - pb);
  let g = "";
  for (let v = 0; v <= yMax + 1e-6; v += stepY)
    g += "<line class='grid' x1='" + pl + "' x2='" + (W - pr) + "' y1='" + Y(v).toFixed(1) + "' y2='" + Y(v).toFixed(1) + "'/>" +
      "<text class='ax' x='" + (pl - 8) + "' y='" + (Y(v) + 4).toFixed(1) + "' text-anchor='end'>" + gdCompact(v) + "</text>";
  const xStep = (x1 - x0) > 45 ? 10 : 5;
  for (let v = Math.ceil(x0 / xStep) * xStep; v <= x1; v += xStep)
    g += "<text class='ax' x='" + X(v).toFixed(1) + "' y='" + (H - 8) + "' text-anchor='middle'>" + v + "</text>";
  const main = series[series.length - 1];
  // The band, for the plan being looked at only, clipped to the plot.
  const bp = main.pts.filter(p => p.lo != null);
  const clip = "gdclip-" + el.getAttribute("data-chart");
  g += "<defs><clipPath id='" + clip + "'><rect x='" + pl + "' y='" + pt + "' width='" + (W - pl - pr) + "' height='" + (H - pt - pb) + "'/></clipPath></defs>";
  if (main.traces && main.traces.length)
    g += "<g class='tr' clip-path='url(#" + clip + ")'>" + main.traces.map(ln =>
      "<path d='M" + ln.map(p => X(p.x).toFixed(1) + "," + Y(Math.min(p.y, yMax * 1.05)).toFixed(1)).join("L") + "'/>").join("") + "</g>";
  if (bp.length > 1)
    g += "<path class='band " + main.cls + "' clip-path='url(#" + clip + ")' d='M" + bp.map(p => X(p.x).toFixed(1) + "," + Y(p.hi).toFixed(1)).join("L") +
      "L" + bp.slice().reverse().map(p => X(p.x).toFixed(1) + "," + Y(p.lo).toFixed(1)).join("L") + "Z'/>";
  series.forEach(x => {
    g += "<line class='mark' x1='" + X(x.retire).toFixed(1) + "' x2='" + X(x.retire).toFixed(1) + "' y1='" + pt + "' y2='" + (H - pb) + "'/>";
  });
  series.forEach(x => {
    g += "<path class='ln " + x.cls + "' clip-path='url(#" + clip + ")' d='M" + x.pts.map(p => X(p.x).toFixed(1) + "," + Y(Math.min(p.y, yMax * 1.05)).toFixed(1)).join("L") + "'/>";
  });
  // Direct labels for the plan being looked at: the retirement peak, and the
  // age saving stops on a coast plan.
  const peak = main.pts.find(p => p.x === main.retire);
  let lab = "";
  if (peak){
    const px = X(peak.x), py = Y(peak.y), right = px < W * .62;
    lab += "<circle class='dot " + main.cls + "' cx='" + px.toFixed(1) + "' cy='" + py.toFixed(1) + "' r='4.5'/>" +
      "<text class='lab' x='" + (px + (right ? 9 : -9)).toFixed(1) + "' y='" + Math.max(pt + 4, py - 8).toFixed(1) + "' text-anchor='" + (right ? "start" : "end") + "'>" +
      "Retire at " + main.retire + ": " + gdCompact(peak.y) + "</text>";
  }
  if (main.stop != null && main.stop > main.pts[0].x){
    const sp = main.pts.find(p => p.x === main.stop);
    if (sp) lab += "<circle class='dot " + main.cls + "' cx='" + X(sp.x).toFixed(1) + "' cy='" + Y(sp.y).toFixed(1) + "' r='4'/>" +
      "<text class='lab' x='" + X(sp.x).toFixed(1) + "' y='" + (Y(sp.y) + 18).toFixed(1) + "' text-anchor='middle'>Stop saving at " + main.stop + "</text>";
  }
  const over = capped ? series.filter(x => x.pts.some(p => p.y > yMax)).map(x => {
    const endP = x.pts[x.pts.length - 1];
    return (series.length > 1 ? x.name : "Your savings") + " keep" + (series.length > 1 ? "s" : "") + " growing past the top of the chart, to a median of " + gdCompact(endP.y) + " by " + endP.x + ".";
  }) : [];
  el.innerHTML = "<svg viewBox='0 0 " + W + " " + H + "' width='" + W + "' height='" + H + "' aria-hidden='true'>" + g +
    "<line class='xh' y1='" + pt + "' y2='" + (H - pb) + "' x1='0' x2='0' visibility='hidden'/>" + lab + "</svg><div class='gd-tip' hidden></div>" +
    (over.length ? "<div class='gd-ch-over'>" + over.join(" ") + "</div>" : "");
  const svg = el.querySelector("svg"), xh = svg.querySelector(".xh"), tip = el.querySelector(".gd-tip");
  let cur = null;
  const show = age => {
    age = Math.max(x0, Math.min(x1, Math.round(age)));
    cur = age;
    xh.setAttribute("x1", X(age)); xh.setAttribute("x2", X(age)); xh.setAttribute("visibility", "visible");
    tip.textContent = "";
    const h = document.createElement("div"); h.className = "h";
    h.textContent = "Age " + age;
    tip.appendChild(h);
    series.slice().reverse().forEach(x => {
      const p = x.pts.find(q => q.x === age);
      const r = document.createElement("div"); r.className = "r";
      const k = document.createElement("s"); k.className = x.cls;
      const v = document.createElement("b"); v.textContent = p ? money(p.y) : "—";
      const n = document.createElement("span");
      const state = p && p.save && age < x.retire ? "saving" : age > x.retire ? "retired, median" : "at retirement";
      n.textContent = series.length > 1 ? (W < 480 ? x.name : x.name + ", " + state) : state;
      r.appendChild(k); r.appendChild(v); r.appendChild(n);
      tip.appendChild(r);
    });
    tip.hidden = false;
    const tx = X(age), tw = tip.offsetWidth;
    tip.style.left = Math.max(0, Math.min(W - tw, tx > W / 2 ? tx - tw - 12 : tx + 12)) + "px";
  };
  const hide = () => { tip.hidden = true; xh.setAttribute("visibility", "hidden"); cur = null; };
  svg.addEventListener("pointermove", e => {
    const b = svg.getBoundingClientRect();
    show(x0 + (e.clientX - b.left - pl) / Math.max(1, W - pl - pr) * (x1 - x0));
  });
  svg.addEventListener("pointerleave", hide);
  el.onkeydown = e => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    if (e.key === "Home") show(x0);
    else if (e.key === "End") show(x1);
    else show((cur == null ? main.retire : cur) + (e.key === "ArrowRight" ? 1 : -1));
  };
  el.onblur = hide;
}
let gdChartTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(gdChartTimer);
  gdChartTimer = setTimeout(() => { if (!$("tab-guide").hidden) gdChartsDraw($("gdCard")); }, 150);
});

