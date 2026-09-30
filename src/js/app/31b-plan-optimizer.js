/* ---------- the Plan Optimizer ----------
   The page side of plOptimize() in src/js/plan.js. The search runs in a
   worker (assets/plan.<hash>.js, which build.py writes and names here) so
   the page keeps drawing while it tries a few thousand plans in every
   historical market; where a worker can't start, it runs here in short
   slices instead. It lives in two places: its own tool page, and the
   readiness guide's Plan Optimizer step. Each is a "host" with its own run
   and result, and one renderer draws both.

   While it runs, the guide's bow and arrow, bigger: the string draws back
   with the arrow on it, holds, and lets go; the arrow leaves fast and rides
   the progress with the fill behind it, and lands in the target when the
   answer is in. The whole shot never takes less than OP_MIN_MS, so a quick
   search still gets its flight. */
var OP_WORKER_URL = "@@PLAN_WORKER@@";
var OP_MIN_MS = 5000;
var OP_DRAW_MS = 700, OP_HOLD_MS = 260;          // drawing the string back, then holding it
var OP_LOOSE_MS = OP_DRAW_MS + OP_HOLD_MS;
var opWorker = null, opWorkerDead = false, opJobs = {}, opNextId = 0;
var OP = {tool:{goal:"legacy", run:null, res:null}, guide:{run:null, res:null}};
var OP_COLORS = {ss:"#7d9fd6", pension:"#e9b872", trad:"#e2795f", brok:"#a98fd6", roth:"#4fbf95"};

/* ---- running it ---- */
function opGetWorker(){
  if (opWorker || opWorkerDead) return opWorker;
  try {
    opWorker = new Worker(OP_WORKER_URL);
    opWorker.onmessage = e => opOnMsg(e.data);
    opWorker.onerror = e => {
      if (e && e.preventDefault) e.preventDefault();
      opWorkerDead = true;
      try { opWorker.terminate(); } catch(x){}
      opWorker = null;
      // Whatever it was working on, finish here instead.
      Object.keys(OP).forEach(h => { const R = OP[h].run; if (R && !R.done) opRunHere(R.id, R.P, R.goal); });
    };
  } catch(e){ opWorkerDead = true; opWorker = null; }
  return opWorker;
}
function opRunHere(id, P, goal){
  const g = plOptimize(P, goal);
  const step = () => {
    if (!opJobs[id]) return;
    const until = performance.now() + 12;
    do {
      const s = g.next();
      if (s.done) return;
      s.value.id = id;
      opOnMsg(s.value);
      if (s.value.type === "done") return;
    } while (performance.now() < until);
    setTimeout(step, 0);
  };
  setTimeout(step, 40);
}
function opStart(host, P, goal){
  const H = OP[host];
  // One search at a time: a new one replaces any other still running.
  Object.keys(OP).forEach(h => { if (OP[h].run) opStop(h, h === host); });
  const id = ++opNextId;
  opJobs[id] = host;
  H.res = null;
  H.run = {id, P, goal, sig:opSig(P, goal), t0:performance.now(), prog:null, done:null, shown:0,
    hitAt:0, nowAt:0, log:[], combos:null};
  // Every plan the search will try, in its order, for the running commentary.
  try { const C = plPrep(Object.assign({}, P, {strategy:"fixed"})); H.run.combos = plCombos(C, plBaseTactics(C)); } catch(e){}
  const w = opGetWorker();
  if (w){
    try { w.postMessage({type:"run", id, P, goal}); } catch(e){ opRunHere(id, P, goal); }
  } else opRunHere(id, P, goal);
  opPaint(host);
  opLoop(host);
}
function opStop(host, quiet){
  const H = OP[host], R = H.run;
  if (!R) return;
  delete opJobs[R.id];
  H.run = null;
  if (opWorker){ try { opWorker.postMessage({type:"stop"}); } catch(e){} }
  if (!quiet) opPaint(host);
}
function opOnMsg(v){
  const host = v && opJobs[v.id];
  if (!host) return;
  const R = OP[host].run;
  if (!R || R.id !== v.id) return;
  if (v.type === "done"){ R.done = v; delete opJobs[v.id]; }
  else {
    R.prog = v;
    // How the best plan so far improved, so the counters can replay it in
    // step with the arrow when the search finishes before the flight does.
    if (v.best) R.log.push({frac:v.frac, best:v.best});
  }
}
/* What identifies a result: the inputs and the goal. A result for other
   inputs is kept, marked as out of date. */
function opSig(P, goal){
  const k = ["status", "state", "age1", "age2", "years", "trad", "roth", "rothBasis", "brok", "brokBasis",
    "spend", "pia1", "pia2", "claim1", "claim2", "pension", "pensionAge", "pensionCola", "aca", "household",
    "premium", "rule55", "heirRate", "mix", "target"];
  return goal + "|" + k.map(x => { const v = P[x]; return typeof v === "number" ? Math.round(v) : String(v); }).join("|");
}
/* How big the search is: plans, markets, and so roughly how long. */
function opEstimate(P){
  const C = plPrep(Object.assign({}, P, {strategy:"fixed"})), n = plCombos(C, plBaseTactics(C)).length, w = plStarts(C).length;
  return {n, w, runs:n * w, secs:Math.max(Math.round(OP_MIN_MS / 1000) + 1, Math.round(n * w * C.years / 1.6e6))};
}

/* ---- the flight ---- */
function opRoot(host){ return document.querySelector("[data-op-host='" + host + "']"); }
function opLoop(host){
  const H = OP[host], R = H.run;
  if (!R || R.looping) return;
  R.looping = true;
  const last = {};
  const set = (el, k, v) => { if (el && last[k] !== v){ last[k] = v; el.textContent = v; } };
  const tick = () => {
    if (H.run !== R) return;
    const now = performance.now(), root = opRoot(host), el = now - R.t0;
    if (!root && R.done){ opFinish(host); return; }
    const actual = R.done ? 1 : (R.prog ? R.prog.frac : 0);
    // The flight can't outrun its clock, which starts at the release and runs
    // fast off the bow, easing in toward the target.
    const t = Math.max(0, Math.min(1, (el - OP_LOOSE_MS) / (OP_MIN_MS - OP_LOOSE_MS)));
    const want = el < OP_LOOSE_MS ? 0 : Math.min(actual, 1 - Math.pow(1 - t, 1.6));
    R.shown += (want - R.shown) * (R.done ? 0.2 : 0.12);
    if (want - R.shown < 0.002) R.shown = want;
    if (root){
      const lane = root.querySelector(".op-lane");
      if (lane) lane.style.setProperty("--p", Math.max(0, Math.min(1, R.shown)).toFixed(4));
      // Drawing back: the string's middle comes back 12 units with the arrow
      // on it, eased, then held under tension until the release.
      const d = el < OP_DRAW_MS ? el / OP_DRAW_MS : 1, pull = el < OP_LOOSE_MS ? d * d * (3 - 2 * d) : 0;
      root.style.setProperty("--pull", pull.toFixed(3));
      const str = root.querySelector(".op-bow .str.drawn");
      // The limbs flex as it comes back (CSS scales them by --pull), so the
      // string's ends follow their tips.
      const tip = 25 * (1 - .07 * pull);
      if (str && el < OP_LOOSE_MS) str.setAttribute("d", "M33 " + (32 - tip).toFixed(2) + " L" + (33 - 12 * pull).toFixed(2) + " 32 L33 " + (32 + tip).toFixed(2));
      root.classList.toggle("op-full", el >= OP_DRAW_MS && el < OP_LOOSE_MS);
      root.classList.toggle("op-loosed", el >= OP_LOOSE_MS);
      const P = R.prog || R.done;
      if (P){
        // The counters follow the arrow, not the search, so they never run
        // ahead of what's on screen.
        const f = R.shown, N = P.of, tried = Math.round(N * Math.min(f, actual));
        set(root.querySelector("[data-opn='tried']"), "tried", groupDigits(tried, true));
        set(root.querySelector("[data-opn='of']"), "of", "of " + groupDigits(N, true) + " plans tried");
        set(root.querySelector("[data-opn='runs']"), "runs", groupDigits(tried * P.windows, true));
        let b = null;
        for (let i = 0; i < R.log.length && R.log[i].frac <= f + 1e-9; i++) b = R.log[i].best;
        if (R.hitAt && R.done) b = R.done.best.stats;
        if (b) set(root.querySelector("[data-opn='best']"), "best",
          R.goal === "legacy" ? opCompact(b.medLegacy) : pctStr(b.successRate, 0) + " lasted");
        if (!R.hitAt && el >= OP_LOOSE_MS && now - R.nowAt > 420){
          R.nowAt = now;
          const L = R.combos, T = L && L.length ? L[Math.min(L.length - 1, Math.floor(f * L.length))] : P.T;
          if (T) set(root.querySelector("[data-opn='now']"), "now", "Trying: " + opTacticsShort(T, R.P));
        }
        if (R.hitAt && R.done) set(root.querySelector("[data-opn='now']"), "now", "Found it. Tested " +
          groupDigits(R.done.runs, true) + " retirements.");
      }
      if (R.done && R.shown >= 0.999 && !R.hitAt){ R.hitAt = now; root.classList.add("op-hit"); }
    }
    if (R.hitAt && now - R.hitAt > 1150){ opFinish(host); return; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
function opFinish(host){
  const H = OP[host], R = H.run;
  if (!R || !R.done) return;
  H.res = R.done;
  H.res.sig = R.sig;
  H.res.P = R.P;
  H.run = null;
  H.fresh = true;
  opPaint(host);
}
function opPaint(host){
  if (host === "guide"){ if (!$("tab-guide").hidden && gd.cur === "optimize") gdRender(false); return; }
  renderOptimizer();
}

/* ---- words ---- */
function opCompact(v){
  const x = Math.abs(v);
  if (x >= 1e6) return "$" + (Math.round(v / 1e4) / 100).toFixed(2) + "M";
  if (x >= 1e4) return "$" + Math.round(v / 1e3) + "k";
  return money(v);
}
function opSigned(v, f){
  const s = (f || money)(Math.abs(v));
  return (v >= 0 ? "+" : "−") + s;
}
function opFillName(f){
  return ["", "the standard deduction, so it's tax-free", "the top of the 10% bracket", "the top of the 12% bracket",
    "the top of the 22% bracket", "the top of the 24% bracket"][f] || "";
}
function opFillShort(f){ return ["", "0%", "10%", "12%", "22%", "24%"][f] || ""; }
/* The age conversions stop at, as plTactics works it. */
function opConvUntil(T, C){
  if (!(T.f > 0) || !T.u) return null;
  if (T.u === 1) return Math.max(T.c1, C.married ? T.c2 - C.gap : T.c1) - 1;
  return C.rmdAge - 1;
}
function opClaims(T, C, short){
  if (!C.married) return String(T.c1);
  if (T.c1 === T.c2) return short ? T.c1 + " & " + T.c2 : T.c1 + " for both of you";
  return short ? T.c1 + " & " + T.c2 : T.c1 + " for you, " + T.c2 + " for your spouse";
}
function opTacticsShort(T, P){
  const married = P.status === "m";
  let s = married ? "you claim at " + T.c1 + ", your spouse at " + T.c2 : "claim at " + T.c1;
  if (T.f > 0){
    s += " · traditional first, to " + (T.f === 1 ? "the standard deduction" : "the " + opFillShort(T.f) + " bracket");
    if (T.u) s += " · convert the rest " + (T.u === 1 ? "until Social Security" : "until RMDs");
  } else s += " · brokerage, traditional, then Roth";
  if (T.ac) s += " · under the ACA cliff";
  if (T.im) s += " · under IRMAA";
  return s;
}
/* One line for the guide's plan summary. */
function opTacticsLine(T, C){
  if (!(T.f > 0)) return "Brokerage, then traditional, then Roth";
  const until = opConvUntil(T, C);
  let s = "Traditional first, up to " + (T.f === 1 ? "the standard deduction" : "the " + opFillShort(T.f) + " bracket");
  s += until != null ? ", converting the rest to Roth until " + until : "";
  const g = [];
  if (T.ac) g.push("the ACA subsidy cliff");
  if (T.im) g.push("Medicare's surcharge");
  if (g.length) s += ", staying under " + g.join(" and ");
  return s;
}
function opGoalWords(goal){
  return {legacy:["Leave the most", "Most money left after tax, for you and your heirs"],
    last:["Make it last", "Lasts in the most historical markets, then leaves the most in the worst"],
    spend:["Spend the most", "The highest yearly spending that still lasts"]}[goal];
}

/* ---- markup: goal picker, run button, progress ---- */
function opGoalsHTML(host, goal){
  return "<div class='op-goals' role='radiogroup' aria-label='What should the best plan do?'>" +
    ["legacy", "last", "spend"].map(g => {
      const w = opGoalWords(g), on = g === goal;
      return "<button type='button' class='op-goal" + (on ? " on" : "") + "' role='radio' aria-checked='" + on + "' data-op='goal' data-host='" + host + "' data-goal='" + g + "'>" +
        "<i class='dot' aria-hidden='true'></i><b>" + w[0] + "</b><span>" + w[1] + "</span></button>";
    }).join("") + "</div>";
}
function opProgHTML(host){
  const R = OP[host].run;
  const loosed = R && performance.now() - R.t0 >= OP_LOOSE_MS;
  return "<div class='op-run" + (loosed ? " op-loosed" : "") + "' data-op-host='" + host + "' aria-live='polite'>" +
    "<div class='op-shot' aria-hidden='true'>" +
      "<span class='op-bow'><svg viewBox='18 5 32 54'><path class='str rest' d='M33 7 L33 57'/><path class='str drawn' d='M33 7 L33 32 L33 57'/><path class='limb' d='M33 7 C31 10 34 13 39 17 Q53 32 39 47 C34 51 31 54 33 57'/></svg></span>" +
      "<div class='op-lane' style='--p:" + (R ? R.shown.toFixed(4) : 0) + "'><i class='op-fill'></i><i class='op-trail'></i>" +
        "<span class='op-arrow'><svg viewBox='5 25.5 56 13'><path class='sh' d='M7 32 H51'/><path class='hd' d='M60 32 L48 25.5 L50.5 32 L48 38.5 Z M11 32 L6 25.5 H11 L18 32 Z M11 32 L6 38.5 H11 L18 32 Z'/></svg></span></div>" +
      "<span class='op-target'><svg viewBox='0 0 44 44'><circle class='rg r1' cx='22' cy='22' r='20'/><circle class='rg r2' cx='22' cy='22' r='13.5'/><circle class='rg r3' cx='22' cy='22' r='7'/><circle class='eye' cx='22' cy='22' r='2.6'/></svg></span>" +
    "</div>" +
    "<div class='op-stats'>" +
      "<div><b data-opn='tried'>0</b><span data-opn='of'>plans tried</span></div>" +
      "<div><b data-opn='runs'>0</b><span>retirements simulated</span></div>" +
      "<div><b data-opn='best'>—</b><span>" + (R && R.goal === "legacy" ? "best so far, left after tax" : "best so far") + "</span></div>" +
    "</div>" +
    "<div class='op-now' data-opn='now'>Setting up every combination…</div>" +
    "<button type='button' class='gd-link op-stop' data-op='stop' data-host='" + host + "'>Stop</button></div>";
}

/* ---- the roadmap ---- */
/* The years grouped into stretches where the plan does the same things:
   before 59½, before Medicare, converting, each Social Security start,
   required distributions. */
function opPhases(res){
  const rows = res.best.detail.rows, T = res.best.T;
  const sig = r => [r.age < 59 ? 1 : 0, r.fplPct != null ? 1 : 0, r.conv > 50 ? 1 : 0, r.rmd > 50 ? 1 : 0,
    Math.round(r.ss / 100), r.age >= 65 ? 1 : 0].join(",");
  const out = [];
  rows.forEach(r => {
    const k = sig(r), cur = out[out.length - 1];
    if (cur && cur.k === k) cur.rows.push(r); else out.push({k, rows:[r]});
  });
  // A stretch of a single year that only differs by Social Security's
  // amount (the second claim) folds into the next one.
  return out;
}
function opAvg(rows, f){ let s = 0; rows.forEach(r => { s += f(r); }); return rows.length ? s / rows.length : 0; }
function opRoadmapHTML(res){
  const C = {married:res.married, gap:res.age2 == null ? 0 : res.age2 - res.age1, rmdAge:res.rmdAge};
  const T = res.best.T, phases = opPhases(res), rows = res.best.detail.rows;
  const first = rows[0], last = rows[rows.length - 1];
  const claimAge2 = C.married ? T.c2 : null;
  let s = "<ol class='op-road'>";
  phases.forEach((ph, i) => {
    const R = ph.rows, a0 = R[0].age, a1 = R[R.length - 1].age, r0 = R[0];
    const conv = opAvg(R, r => r.conv), ss = opAvg(R, r => r.ss), pen = opAvg(R, r => r.pension);
    const tr = opAvg(R, r => r.trad), bk = opAvg(R, r => r.brok), ro = opAvg(R, r => r.roth);
    const tax = opAvg(R, r => r.tax + r.pen), hl = opAvg(R, r => r.health), ir = opAvg(R, r => r.irmaa);
    const early = r0.age < 59, aca = r0.fplPct != null, rmd = r0.rmd > 50;
    const spouseOnly = aca && r0.age >= 65;
    let tag = conv > 50 ? (aca ? "Convert, and keep the subsidy" : "Roth conversion years")
      : early ? "Before 59½" : aca ? (spouseOnly ? "Until your spouse's Medicare" : "Before Medicare") : rmd ? "Required distributions" : ss > 0 ? "Social Security years" : "Living on savings";
    // What happens as this stretch begins.
    const ev = [], prevRow = rows[rows.indexOf(r0) - 1], rise = r0.ss - (prevRow ? prevRow.ss : 0);
    if (i === 0) ev.push("You retire at " + a0);
    if (rise > 1){
      const mine = a0 === T.c1, theirs = C.married && a0 + C.gap === claimAge2;
      ev.push((mine && theirs ? "Social Security starts for both of you" : mine ? "Your Social Security starts" : theirs ? "Your spouse's Social Security starts" : "The spousal benefit starts") +
        ": +" + money(rise / 12) + "/mo");
    }
    const me65 = a0 === 65 && i > 0, sp65 = C.married && res.age2 != null && i > 0 && a0 + C.gap === 65;
    if (me65 && sp65) ev.push("Medicare starts for both of you");
    else if (me65) ev.push(C.married ? "Your Medicare starts" : "Medicare starts");
    else if (sp65) ev.push("Your spouse's Medicare starts");
    if (a0 === 59 && i > 0) ev.push("59½: traditional money opens up penalty-free");
    if (rmd && (i === 0 || !(phases[i - 1].rows[0].rmd > 50))) ev.push("Required distributions begin");
    if (i > 0 && phases[i - 1].rows.some(r => r.conv > 50) && !(conv > 50)) ev.push("Conversions stop");
    const items = [];
    if (ss > 0 || pen > 0) items.push(["Income", (ss > 0 ? "Social Security " + money(ss) + "/yr" : "") + (pen > 0 ? (ss > 0 ? ", pension " : "Pension ") + money(pen) + "/yr" : "")]);
    const draws = [];
    if (tr > 50) draws.push(money(tr) + " traditional" + (rmd ? " (the required distribution" + (tr > opAvg(R, r => r.rmd) + 50 ? " and more" : "") + ")" : ""));
    if (bk > 50) draws.push(money(bk) + " brokerage");
    if (ro > 50) draws.push(money(ro) + " Roth");
    items.push(["Spend from", draws.length ? draws.join(", ") + " a year" : "Nothing: income covers it"]);
    if (conv > 50) items.push(["Convert", money(conv) + " a year to Roth" + (T.f > 0 ? ", filling " + opFillName(T.f) : "")]);
    items.push(["Tax", "About " + money(tax) + " a year" + (ir > 50 ? ", plus " + money(ir) + " Medicare surcharge" : "")]);
    if (aca) items.push(["Health", "About " + money(hl) + " a year after the subsidy" + (r0.fplPct != null ? " (income at " + Math.round(opAvg(R, r => r.fplPct) * 100) + "% of the poverty line)" : "")]);
    s += "<li class='op-ph" + (conv > 50 ? " conv" : "") + "'><div class='op-ph-age'>" + (a0 === a1 ? "Age " + a0 : a0 + "–" + a1) + "</div>" +
      "<div class='op-ph-body'><div class='op-ph-tag'>" + tag + "</div>" +
      (ev.length ? "<div class='op-ph-ev'>" + ev.map(e => "<span>" + e + "</span>").join("") + "</div>" : "") +
      "<dl>" + items.map(x => "<dt>" + x[0] + "</dt><dd>" + x[1] + "</dd>").join("") + "</dl></div></li>";
  });
  s += "<li class='op-ph end'><div class='op-ph-age'>" + (last.age + 1) + "</div><div class='op-ph-body'><div class='op-ph-tag'>The plan's end" +
    (C.married && res.age2 != null ? ", when your spouse is " + (last.age + 1 + C.gap) : "") + "</div>" +
    "<dl><dt>Left</dt><dd>" + money(last.endTrad) + " traditional, " + money(last.endRoth) + " Roth, " + money(last.endBrok) + " brokerage, on the average path</dd></dl></div></li>";
  return s + "</ol>";
}

/* ---- what makes the difference ---- */
function opMovesHTML(res){
  const C = {married:res.married, gap:res.age2 == null ? 0 : res.age2 - res.age1, rmdAge:res.rmdAge};
  const T0 = res.base.T, T = res.best.T, goal = res.goal;
  const val = s => goal === "spend" ? s.maxSpend || 0 : goal === "last" ? s.survived : s.medLegacy;
  const fmt = d => goal === "spend" ? opSigned(d) + " a year" : goal === "last" ? (d >= 0 ? "+" : "−") + Math.abs(d) + " more " + (Math.abs(d) === 1 ? "market" : "markets") + " lasted" : opSigned(d, opCompact) + " left";
  const total = val(res.best.stats) - val(res.base.stats);
  const big = Math.max(1, Math.abs(total), ...res.steps.map(x => Math.abs(val(x.to) - val(x.from))));
  let s = "<div class='op-moves'>";
  res.steps.forEach(st => {
    const d = val(st.to) - val(st.from), t = st.T;
    let h, p;
    if (st.key === "ss"){
      h = "Claim Social Security at " + opClaims(t, C) + (C.married ? "" : "") + ", instead of " + opClaims(T0, C);
      const later = t.c1 > T0.c1 || t.c2 > T0.c2;
      p = d < 0 && total > 0
        ? "On its own this leaves less. It earns its place alongside the next change: " + (later
          ? "with the check starting later, the years before it have low income, and that's where the conversions below get done cheaply."
          : "with the check covering more of each year's spending, more of the low tax brackets are free for the conversions below.")
        : later
        ? "Every year you wait past 67 adds 8% to the check, for life, and it rises with inflation. Your savings carry the years in between, which usually costs less than the bigger check pays back over a long retirement."
        : "Claiming sooner means drawing less from savings early on, so more of it stays invested. In your plan that outweighs the bigger check waiting would bring.";
    } else {
      const until = opConvUntil(t, C);
      h = t.f > 0 ? "Draw traditional money first, up to " + opFillName(t.f) + (until != null ? ", and convert what you don't spend to Roth until " + until : "")
        : "Brokerage first, then traditional, then Roth";
      const g = [];
      if (t.ac) g.push("keep income under the ACA subsidy cliff before 65");
      if (t.im) g.push("stay under Medicare's first income surcharge line");
      if (g.length) h += ", and " + g.join(" and ");
      p = t.f > 0 ? "Traditional money is taxed whenever it comes out. Taking it in the lower-income years, at " + (t.f === 1 ? "0%" : opFillShort(t.f)) +
        ", beats taking it later, when required distributions and Social Security stack up and push it into higher brackets. Roth money then grows tax-free for you and your heirs." : "";
    }
    const w = Math.round(Math.abs(d) / big * 100);
    s += "<div class='op-move'><div class='op-move-t'><b>" + h + "</b>" + (p ? "<p>" + p + "</p>" : "") + "</div>" +
      "<div class='op-move-v'><em class='" + (d >= 0 ? "pos" : "neg") + "'>" + fmt(d) + "</em><i class='op-bar'><b class='" + (d >= 0 ? "pos" : "neg") + "' style='width:" + w + "%'></b></i></div></div>";
  });
  s += "</div>";
  return s;
}

/* ---- the headline ---- */
function opHeroHTML(res){
  const b = res.base.stats, x = res.best.stats, goal = res.goal;
  const C = {married:res.married};
  let big, lab, was, delta;
  if (goal === "spend"){
    big = money(x.maxSpend) + "<small>/yr</small>"; lab = "You can spend, after tax, and still last in " + pctStr(res.target, 0) + " of markets";
    was = money(b.maxSpend) + "/yr the usual way"; delta = opSigned((x.maxSpend || 0) - (b.maxSpend || 0)) + " a year";
  } else if (goal === "last"){
    big = x.survived + "<small> of " + x.total + "</small>"; lab = "Historical retirements where the money lasted";
    was = b.survived + " of " + b.total + " the usual way";
    delta = x.survived > b.survived ? "+" + (x.survived - b.survived) + " more" : "Worst 10%: " + opSigned(x.p10Legacy - b.p10Legacy, opCompact) + " left";
  } else {
    big = opCompact(x.medLegacy); lab = "Left for you and your heirs after tax, in a typical market";
    was = opCompact(b.medLegacy) + " the usual way"; delta = opSigned(x.medLegacy - b.medLegacy, opCompact);
  }
  const tile = (k, v0, v1, good) => "<div class='op-tile'><div class='k'>" + k + "</div><div class='v'>" + v1 + "</div><div class='n" + (good == null ? "" : good ? " pos" : " neg") + "'>was " + v0 + "</div></div>";
  const T0 = res.base.T, T = res.best.T;
  return "<div class='op-hero'><div class='op-big'><div class='k'>" + lab + "</div><div class='v'>" + big + "</div>" +
    "<div class='op-delta'><em>" + delta + "</em><span>vs. " + was + "</span></div></div>" +
    "<div class='op-tiles'>" +
      tile("Lifetime tax", money(b.medTax), money(x.medTax), x.medTax < b.medTax - 1 ? true : x.medTax > b.medTax + 1 ? false : null) +
      tile("Lasted in", pctStr(b.successRate, 0), pctStr(x.successRate, 0), x.survived > b.survived ? true : x.survived < b.survived ? false : null) +
      (goal !== "legacy" ? tile("Left after tax", opCompact(b.medLegacy), opCompact(x.medLegacy), x.medLegacy > b.medLegacy + 1 ? true : x.medLegacy < b.medLegacy - 1 ? false : null)
        : tile("Social Security at", opClaims(T0, C, true), opClaims(T, C, true), null)) +
    "</div></div>";
}

/* ---- charts ---- */
/* Where each year's money comes from, stacked, with what's converted to
   Roth drawn hollow on top and what you live on as a line: the gap between
   the bars and the line is the year's tax and premiums. */
function opBarsDraw(el, rows){
  const W = Math.max(300, el.clientWidth || 700), H = W < 520 ? 230 : 280;
  const pl = W < 520 ? 46 : 56, pr = 10, pt = 14, pb = 26;
  const keys = ["ss", "pension", "trad", "brok", "roth"];
  // Income or a required distribution beyond the year's needs is reinvested
  // in the brokerage: drawn apart, so the bars stop at what was used.
  rows = rows.map(r => {
    const o = Object.assign({}, r);
    let extra = r.surplus > 1 ? r.surplus : 0;
    ["trad", "pension", "ss"].forEach(k => { const t = Math.min(extra, o[k]); o[k] -= t; extra -= t; });
    o.reinv = r.surplus > 1 ? r.surplus - extra : 0;
    return o;
  });
  const tot = rows.map(r => r.ss + r.pension + r.trad + r.brok + r.roth + r.reinv);
  const top = Math.max(1, ...rows.map((r, i) => tot[i] + r.conv), ...rows.map(r => r.spend)) * 1.08;
  const mag = Math.pow(10, Math.floor(Math.log10(top / 4)));
  const stepY = [1, 2, 2.5, 5, 10].map(m => m * mag).find(v => top / v <= 4.5) || mag * 10;
  const yMax = Math.ceil(top / stepY) * stepY, n = rows.length, slot = (W - pl - pr) / n;
  const X = i => pl + slot * (i + .5), Y = v => pt + (1 - v / yMax) * (H - pt - pb);
  const bw = Math.max(2, Math.min(slot * .74, 26));
  let g = "";
  for (let v = 0; v <= yMax + 1e-6; v += stepY)
    g += "<line class='grid' x1='" + pl + "' x2='" + (W - pr) + "' y1='" + Y(v).toFixed(1) + "' y2='" + Y(v).toFixed(1) + "'/>" +
      "<text class='ax' x='" + (pl - 7) + "' y='" + (Y(v) + 4).toFixed(1) + "' text-anchor='end'>" + gdCompact(v) + "</text>";
  const every = Math.max(1, Math.ceil(n / (W < 520 ? 6 : 12)));
  rows.forEach((r, i) => { if (i % every === 0) g += "<text class='ax' x='" + X(i).toFixed(1) + "' y='" + (H - 7) + "' text-anchor='middle'>" + r.age + "</text>"; });
  rows.forEach((r, i) => {
    let acc = 0;
    keys.forEach(k => {
      const v = r[k];
      if (!(v > 1)) return;
      g += "<rect x='" + (X(i) - bw / 2).toFixed(1) + "' y='" + Y(acc + v).toFixed(1) + "' width='" + bw.toFixed(1) + "' height='" + Math.max(.6, Y(acc) - Y(acc + v)).toFixed(1) + "' fill='" + OP_COLORS[k] + "'/>";
      acc += v;
    });
    if (r.reinv > 1){
      g += "<rect class='op-reinv' x='" + (X(i) - bw / 2 + .75).toFixed(1) + "' y='" + Y(acc + r.reinv).toFixed(1) + "' width='" + (bw - 1.5).toFixed(1) + "' height='" + Math.max(.6, Y(acc) - Y(acc + r.reinv) - .75).toFixed(1) + "'/>";
      acc += r.reinv;
    }
    if (r.conv > 1) g += "<rect class='op-conv' x='" + (X(i) - bw / 2 + .75).toFixed(1) + "' y='" + Y(acc + r.conv).toFixed(1) + "' width='" + (bw - 1.5).toFixed(1) + "' height='" + Math.max(.6, Y(acc) - Y(acc + r.conv) - .75).toFixed(1) + "'/>";
  });
  g += "<path class='op-live' d='M" + rows.map((r, i) => (X(i) - slot / 2).toFixed(1) + "," + Y(r.spend).toFixed(1) + "L" + (X(i) + slot / 2).toFixed(1) + "," + Y(r.spend).toFixed(1)).join("L") + "'/>";
  el.innerHTML = "<svg viewBox='0 0 " + W + " " + H + "' width='" + W + "' height='" + H + "' aria-hidden='true'>" + g +
    "<rect class='op-hl' y='" + pt + "' height='" + (H - pt - pb) + "' width='" + slot.toFixed(1) + "' x='0' visibility='hidden'/></svg><div class='gd-tip' hidden></div>";
  opHover(el, n, i => X(i), slot, i => {
    const r = rows[i], L = [["ss", "Social Security"], ["pension", "Pension"], ["trad", "Traditional"], ["brok", "Brokerage"], ["roth", "Roth"]];
    return "<div class='h'>Age " + r.age + "</div>" + L.filter(x => r[x[0]] > 1).map(x => "<div class='r'><s style='background:" + OP_COLORS[x[0]] + "'></s><b>" + money(r[x[0]]) + "</b><span>" + x[1] + "</span></div>").join("") +
      (r.reinv > 1 ? "<div class='r'><s class='rei'></s><b>" + money(r.reinv) + "</b><span>not needed, reinvested</span></div>" : "") +
      (r.conv > 1 ? "<div class='r'><s class='hol'></s><b>" + money(r.conv) + "</b><span>converted to Roth</span></div>" : "") +
      "<div class='r'><s class='liv'></s><b>" + money(r.spend) + "</b><span>lived on</span></div>" +
      "<div class='r'><s style='background:transparent'></s><b>" + money(r.tax + r.pen + r.health + r.irmaa) + "</b><span>tax" + (r.health > 1 ? " and premiums" : "") + "</span></div>";
  });
}
/* Lines, one per series, with a shared tooltip. */
function opLinesDraw(el, series, fmtY){
  const W = Math.max(300, el.clientWidth || 700), H = W < 520 ? 210 : 250;
  const pl = W < 520 ? 46 : 56, pr = 12, pt = 16, pb = 26;
  const xs = series[0].pts.map(p => p.x), x0 = xs[0], x1 = xs[xs.length - 1];
  const top = Math.max(1, ...series.map(s => Math.max(...s.pts.map(p => p.y)))) * 1.1;
  const mag = Math.pow(10, Math.floor(Math.log10(top / 4)));
  const stepY = [1, 2, 2.5, 5, 10].map(m => m * mag).find(v => top / v <= 4.5) || mag * 10;
  const yMax = Math.ceil(top / stepY) * stepY;
  const X = v => pl + (v - x0) / Math.max(1, x1 - x0) * (W - pl - pr), Y = v => pt + (1 - Math.max(0, v) / yMax) * (H - pt - pb);
  let g = "";
  for (let v = 0; v <= yMax + 1e-6; v += stepY)
    g += "<line class='grid' x1='" + pl + "' x2='" + (W - pr) + "' y1='" + Y(v).toFixed(1) + "' y2='" + Y(v).toFixed(1) + "'/>" +
      "<text class='ax' x='" + (pl - 7) + "' y='" + (Y(v) + 4).toFixed(1) + "' text-anchor='end'>" + gdCompact(v) + "</text>";
  const xStep = (x1 - x0) > 40 ? 10 : 5;
  for (let v = Math.ceil(x0 / xStep) * xStep; v <= x1; v += xStep)
    g += "<text class='ax' x='" + X(v).toFixed(1) + "' y='" + (H - 7) + "' text-anchor='middle'>" + v + "</text>";
  series.forEach(s => {
    g += "<path fill='none' stroke='" + s.color + "' stroke-width='" + (s.w || 2) + "' stroke-linejoin='round' stroke-linecap='round'" + (s.dash ? " stroke-dasharray='" + s.dash + "'" : "") +
      " d='M" + s.pts.map(p => X(p.x).toFixed(1) + "," + Y(p.y).toFixed(1)).join("L") + "'/>";
  });
  el.innerHTML = "<svg viewBox='0 0 " + W + " " + H + "' width='" + W + "' height='" + H + "' aria-hidden='true'>" + g +
    "<line class='xh' y1='" + pt + "' y2='" + (H - pb) + "' x1='0' x2='0' visibility='hidden'/></svg><div class='gd-tip' hidden></div>";
  opHover(el, xs.length, i => X(xs[i]), 0, i => "<div class='h'>Age " + xs[i] + "</div>" +
    series.map(s => "<div class='r'><s style='background:" + s.color + "'></s><b>" + (fmtY || money)(s.pts[i].y) + "</b><span>" + s.name + "</span></div>").join(""));
}
function opHover(el, n, xAt, slot, tipFor){
  const svg = el.querySelector("svg"), tip = el.querySelector(".gd-tip"), hl = svg.querySelector(".op-hl"), xh = svg.querySelector(".xh");
  const W = +svg.getAttribute("width");
  let cur = null;
  const show = i => {
    i = Math.max(0, Math.min(n - 1, i)); cur = i;
    const x = xAt(i);
    if (hl){ hl.setAttribute("x", (x - slot / 2).toFixed(1)); hl.setAttribute("visibility", "visible"); }
    if (xh){ xh.setAttribute("x1", x); xh.setAttribute("x2", x); xh.setAttribute("visibility", "visible"); }
    tip.innerHTML = tipFor(i); tip.hidden = false;
    const tw = tip.offsetWidth;
    tip.style.left = Math.max(0, Math.min(W - tw, x > W / 2 ? x - tw - 14 : x + 14)) + "px";
  };
  const hide = () => { tip.hidden = true; if (hl) hl.setAttribute("visibility", "hidden"); if (xh) xh.setAttribute("visibility", "hidden"); cur = null; };
  const nearest = cx => {
    let best = 0, bd = Infinity;
    for (let i = 0; i < n; i++){ const d = Math.abs(xAt(i) - cx); if (d < bd){ bd = d; best = i; } }
    return best;
  };
  svg.addEventListener("pointermove", e => {
    const b = svg.getBoundingClientRect();
    show(nearest((e.clientX - b.left) / b.width * W));
  });
  svg.addEventListener("pointerleave", hide);
  el.tabIndex = 0;
  el.onkeydown = e => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    show((cur == null ? 0 : cur) + (e.key === "ArrowRight" ? 1 : -1));
  };
  el.onblur = hide;
}
/* Draws every optimizer chart inside root, from its host's result. */
function opDrawAll(root){
  (root || document).querySelectorAll(".op-chart[data-opchart]").forEach(el => {
    const host = el.getAttribute("data-host"), res = OP[host] && OP[host].res;
    if (!res) return;
    const kind = el.getAttribute("data-opchart"), rb = res.best.detail.rows, r0 = res.base.detail.rows;
    if (kind === "flow") opBarsDraw(el, rb);
    else if (kind === "tax") opLinesDraw(el, [
      {name:"The usual way", color:"#7d9fd6", dash:"5 4", pts:r0.map(r => ({x:r.age, y:r.tax + r.pen + r.irmaa + r.health}))},
      {name:"Your roadmap", color:"#4fbf95", w:2.4, pts:rb.map(r => ({x:r.age, y:r.tax + r.pen + r.irmaa + r.health}))}]);
    else if (kind === "bal"){
      const h = res.P.heirRate == null ? PL_HEIR : res.P.heirRate, net = r => r.endRoth + r.endBrok + r.endTrad * (1 - h);
      opLinesDraw(el, [
        {name:"Traditional", color:OP_COLORS.trad, w:1.6, pts:rb.map(r => ({x:r.age, y:r.endTrad}))},
        {name:"Roth", color:OP_COLORS.roth, w:1.6, pts:rb.map(r => ({x:r.age, y:r.endRoth}))},
        {name:"Brokerage", color:OP_COLORS.brok, w:1.6, pts:rb.map(r => ({x:r.age, y:r.endBrok}))},
        {name:"After tax, the usual way", color:"#94a6bf", dash:"5 4", w:2, pts:r0.map(r => ({x:r.age, y:net(r)}))},
        {name:"After tax, your roadmap", color:"#e9b872", w:2.8, pts:rb.map(r => ({x:r.age, y:net(r)}))}]);
    }
  });
}
let opResizeT = null;
window.addEventListener("resize", () => {
  clearTimeout(opResizeT);
  opResizeT = setTimeout(() => opDrawAll(document), 160);
});

/* ---- the whole result ---- */
function opResultHTML(host, res){
  const wrap = (title, note, inner, cls) => host === "tool"
    ? "<div class='panel op-p " + (cls || "") + "'><h2>" + title + (note ? "<span class='h2note'>" + note + "</span>" : "") + "</h2><div class='body'>" + inner + "</div></div>"
    : "<section class='op-sec " + (cls || "") + "'><div class='gd-h3'>" + title + (note ? " <span class='op-note'>" + note + "</span>" : "") + "</div>" + inner + "</section>";
  const legend = keys => "<div class='gd-ch-legend'>" + keys.map(k => k === "conv" ? "<span><s class='hol'></s>Converted to Roth</span>" : k === "live" ? "<span><s class='liv'></s>What you live on</span>"
    : k === "reinv" ? "<span><s class='rei'></s>Not needed, reinvested</span>"
    : "<span><s style='background:" + OP_COLORS[k] + "'></s>" + {ss:"Social Security", pension:"Pension", trad:"Traditional", brok:"Brokerage", roth:"Roth"}[k] + "</span>").join("") + "</div>";
  const rb = res.best.detail.rows, used = ["ss", "pension", "trad", "brok", "roth"].filter(k => rb.some(r => r[k] > 1));
  let s = "<div class='op-res" + (OP[host].fresh ? " op-reveal" : "") + "'>";
  s += "<p class='op-brag'>Tried <b>every one of " + groupDigits(res.of, true) + " plans</b> in all <b>" + res.windows + " historical retirements</b> since " + res.first +
    ": " + groupDigits(res.runs, true) + " retirements simulated.</p>";
  if (res.same){
    s += "<div class='gd-callout ok'><b>The way you'd run it is already the best plan we found</b> for this goal. Nothing we tried did better, which usually means Social Security" +
      (res.married ? " at " + opClaims(res.base.T, {married:true}) : "") + " and drawing brokerage, then traditional, then Roth already suits your numbers.</div>";
    s += opHeroHTML(res);
  } else {
    s += opHeroHTML(res);
    s += wrap("Your roadmap", "on the average path, in today's dollars", opRoadmapHTML(res), "op-roadsec");
    s += wrap("What makes the difference", {legacy:"median left after tax", last:"markets lasted", spend:"safe spending"}[res.goal], opMovesHTML(res));
  }
  s += wrap("Where each year's money comes from", "your roadmap, average path",
    legend(used.concat(rb.some(r => r.surplus > 1) ? ["reinv"] : [], rb.some(r => r.conv > 1) ? ["conv"] : [], ["live"])) + "<div class='gd-chart op-chart' data-opchart='flow' data-host='" + host + "' role='img' aria-label=\"Where each year's money comes from, by age\"></div>" +
    "<p class='op-cap'>The space between the bars and the line is each year's tax" + (rb.some(r => r.health > 1) ? " and health premiums" : "") + ".</p>");
  if (!res.same) s += wrap("Tax and premiums each year", "the usual way against your roadmap",
    "<div class='gd-ch-legend'><span><s style='background:#7d9fd6'></s>The usual way</span><span><s style='background:#4fbf95'></s>Your roadmap</span></div>" +
    "<div class='gd-chart op-chart' data-opchart='tax' data-host='" + host + "' role='img' aria-label='Tax and premiums each year, the usual way and with the roadmap'></div>" +
    "<p class='op-cap'>Paying some tax early, in the low-income years, to pay much less later is usually the whole trick.</p>");
  s += wrap("Your accounts over time", "average path",
    "<div class='gd-ch-legend'><span><s style='background:#e9b872'></s>After tax, your roadmap</span><span><s style='background:#94a6bf'></s>After tax, the usual way</span><span><s style='background:" + OP_COLORS.trad + "'></s>Traditional</span><span><s style='background:" + OP_COLORS.roth + "'></s>Roth</span><span><s style='background:" + OP_COLORS.brok + "'></s>Brokerage</span></div>" +
    "<div class='gd-chart op-chart' data-opchart='bal' data-host='" + host + "' role='img' aria-label='Account balances by age, and what they are worth after tax'></div>" +
    "<p class='op-cap'>After tax counts traditional money at " + pctStr(1 - (res.P.heirRate == null ? PL_HEIR : res.P.heirRate), 0) + " of its value: it still owes income tax, whoever takes it out.</p>");
  s += wrap("Year by year", "average path, today's dollars", opTableHTML(res), "op-tablesec");
  if (res.alts && res.alts.length && !res.same){
    const C = {married:res.married, gap:res.age2 == null ? 0 : res.age2 - res.age1, rmdAge:res.rmdAge};
    s += wrap("Other strong plans", "close behind, and different", "<ul class='op-alts'>" + res.alts.map(a =>
      "<li><b>Social Security at " + opClaims(a.T, C, true) + "</b> · " + opTacticsLine(a.T, C).replace(/^./, c => c.toLowerCase()) +
      "<span>" + opCompact(a.medLegacy) + " left · lasted in " + pctStr(a.successRate, 0) + "</span></li>").join("") + "</ul>");
  }
  s += "<p class='op-fine'>" + (res.goal === "spend" && res.best.spend ? "The best plan lives on " + money(res.best.spend) + " a year after tax and the usual way on " + money(res.base.spend) +
    ", each the most it can in " + pctStr(res.target, 0) + " of markets (the roadmap, charts and table show each at that spending),"
    : "Every plan lives on the same " + money(res.P.spend) + " a year after tax") + " and runs to age " + (res.age1 + res.years) +
    ". Typical means the median of all " + res.windows + " historical retirements; the roadmap's yearly figures follow the average path, " + pctStr(plMix(res.P.mix).real, 1) + " a year after inflation with " + res.P.mix + "% in stocks. " +
    "Left after tax counts traditional money at " + pctStr(1 - (res.P.heirRate == null ? PL_HEIR : res.P.heirRate), 0) + " of its value, for the income tax whoever inherits it will owe; Roth and brokerage count in full. " +
    "Tax is 2026 federal and " + (STATES[res.P.state] ? STATES[res.P.state].n : "state") + " law, held in today's dollars. Both of you are assumed to live to the end of the plan, which favors claiming later. This is a model to plan with, not financial advice.</p>";
  return s + "</div>";
}
function opTableHTML(res){
  const rows = res.best.detail.rows, m = v => v > 1 ? money(v) : "—";
  return "<details class='op-table'><summary>Show every year</summary><div class='scroll'><table><thead><tr><th>Age</th><th>Live on</th><th>Social Security</th>" +
    (rows.some(r => r.pension > 1) ? "<th>Pension</th>" : "") + "<th>Traditional</th><th>Converted</th><th>Brokerage</th><th>Roth</th><th>Tax</th>" +
    (rows.some(r => r.health > 1 || r.irmaa > 1) ? "<th>Health / IRMAA</th>" : "") + "<th>Taxable income</th><th>Left, all accounts</th></tr></thead><tbody>" +
    rows.map(r => "<tr" + (r.short > 1 ? " class='short'" : "") + "><td>" + r.age + "</td><td>" + money(r.spend) + "</td><td>" + m(r.ss) + "</td>" +
      (rows.some(x => x.pension > 1) ? "<td>" + m(r.pension) + "</td>" : "") + "<td>" + m(r.trad) + "</td><td>" + m(r.conv) + "</td><td>" + m(r.brok) + "</td><td>" + m(r.roth) +
      "</td><td>" + m(r.tax + r.pen) + "</td>" + (rows.some(x => x.health > 1 || x.irmaa > 1) ? "<td>" + m(r.health + r.irmaa) + "</td>" : "") +
      "<td>" + money(r.taxable) + "</td><td>" + money(r.end) + "</td></tr>").join("") + "</tbody></table></div></details>";
}

/* ---------- in the readiness guide ---------- */
function opGuideGoal(){ const g = gd.a.optGoal; return PL_GOALS[g] ? g : "legacy"; }
function opGuideP(){
  const S = gdSim(null, true);
  return S ? S.P : null;
}
function opGuideHTML(){
  const S = gdSim(null, true), a = gd.a, H = OP.guide, goal = opGuideGoal();
  let s = "<h2 class='gd-q' tabindex='-1'>Find the best way to run your retirement</h2>";
  if (!S) return s + "<div class='gd-callout warn'>This needs your age, savings and retirement spending first.</div>" +
    "<button type='button' class='btn' data-go='savings'>Go to Retirement savings</button>";
  const E = opEstimate(S.P), A = gdAccts();
  s += "<p class='gd-lead'>Your plan so far claims Social Security at " + opClaims(S.T, S.C) + " and draws from the brokerage, then traditional, then Roth. " +
    "The Plan Optimizer tries every other way: each claiming age from 62 to 70" + (S.C.married ? " for each of you" : "") + ", drawing traditional money first up to each tax bracket, " +
    "converting to Roth for different stretches, and staying under the ACA and Medicare income lines. It runs all <b>" + groupDigits(E.n, true) + "</b> plans through every market since " + HIST_START +
    " and keeps the best.</p>" + gdBack("optimize");
  s += "<div class='op-acct'><span>Starting from <b>" + money(A.trad) + "</b> traditional, <b>" + money(A.roth) + "</b> Roth and <b>" + money(A.brok) + "</b> brokerage today" +
    ", growing to " + money(S.fv) + " by " + fmtNum(S.retire) + ".</span><button type='button' class='gd-link' data-go='savings'>Change the split</button></div>";
  const T = gdTactics(), SA = T ? gdSim() : null;
  if (SA && !H.run) s += "<div class='gd-callout ok'><b>Your plan uses a roadmap:</b> Social Security at " + opClaims(SA.T, SA.C) + "; " +
    opTacticsLine(SA.T, SA.C).replace(/^./, c => c.toLowerCase()) + ". Your score and every step use it." +
    "<div style='margin-top:8px'><button type='button' class='btn mini' data-gd='optclear'>Go back to the usual way</button></div></div>";
  s += "<div class='gd-h3'>What should the best plan do?</div>" + opGoalsHTML("guide", goal);
  const stale = H.res && H.res.sig !== opSig(S.P, goal);
  s += "<div class='op-go'><button type='button' class='btn primary op-go-btn' data-op='run' data-host='guide'" + (H.run ? " disabled" : "") + ">" +
    (H.res && !stale ? "Run it again" : "Find my best plan") + "<i class='arw' aria-hidden='true'></i></button>" +
    "<span class='hint'>" + groupDigits(E.runs, true) + " retirements to simulate, about " + E.secs + " seconds. Nothing leaves your browser.</span></div>";
  if (H.run) s += opProgHTML("guide");
  else if (H.res){
    if (stale) s += "<div class='gd-callout warn'>Your answers or the goal changed since this ran. Run it again to see the best plan for them now.</div>";
    s += opResultHTML("guide", H.res);
    if (!stale && !H.res.same){
      const applied = T && plKey(T) === plKey(H.res.best.T);
      s += "<div class='gd-apply op-apply'>" + (applied ? "<span class='gd-callout ok' style='margin:0'>Your plan uses this roadmap.</span>"
        : "<button type='button' class='btn primary' data-gd='optapply'>Use this plan</button><span class='hint'>Your projection, score and every step after use it. You can undo it.</span>") + "</div>";
    }
    H.fresh = false;
  }
  return s;
}
function opApplyToGuide(){
  const res = OP.guide.res;
  if (!res || res.same) return;
  const a = gd.a, T = res.best.T, undo = {};
  ["optC1", "optC2", "optF", "optU", "optIm", "optAc"].forEach(k => { undo[k] = a[k] == null ? null : a[k]; });
  a.optC1 = T.c1; a.optC2 = T.c2; a.optF = T.f; a.optU = T.u; a.optIm = T.im; a.optAc = T.ac;
  const S = gdSim();
  gd.back = {step:"optimize", undo, msg:"Applied. Your plan now claims Social Security at " + opClaims(T, S ? S.C : {married:gdMar()}) +
    " and " + opTacticsLine(T, S ? S.C : {married:gdMar(), rmdAge:75, gap:0}).replace(/^./, c => c.toLowerCase()) +
    ". Your projection, score and plan use it" + (S ? ": it lasted in <b>" + pctStr(S.success, 0) + "</b> of historical retirements, paying about " + money(S.lifeTax) + " in tax over retirement." : ".")};
  gdSave();
  gdRender(false);
}
function opClearGuide(){
  const a = gd.a, undo = {};
  ["optC1", "optC2", "optF", "optU", "optIm", "optAc"].forEach(k => { undo[k] = a[k] == null ? null : a[k]; a[k] = null; });
  gd.back = {step:"optimize", undo, msg:"Back to the usual way: Social Security at the age you chose, and brokerage, then traditional, then Roth."};
  gdSave();
  gdRender(false);
}

/* ---------- the tool page ---------- */
function opNum(id, lo, hi, d){
  const raw = $(id).value.trim();
  if (raw === "") return d;
  const v = num(id);
  return Math.max(lo, Math.min(hi, isFinite(v) ? v : d));
}
/* Two ways to start. Retirement day: the balances you'll have when you retire
   (typed in, or copied from Advanced or Stages, which project them account
   by account with all their own detail), and nothing modeled before then.
   Today: today's balances and saving, grown to retirement at a steady return
   here. The mode lives in a hidden field so saved scenarios, links and Reset
   carry it like any other input. */
function opMode(){ return $("opMode").value === "now" ? "now" : "ret"; }
function opToolIn(){
  const m = $("opStatus").value === "m", now = opMode() === "now";
  const age = Math.round(now ? opNum("opAge", 18, 90, 58) : opNum("opRetire", 30, 90, 62));
  const retire = now ? Math.max(age, Math.round(opNum("opRetire", 30, 90, 62))) : age;
  const spAge = !m ? null : now ? Math.round(opNum("opSpAge", 18, 95, age)) : Math.round(opNum("opSpRet", 18, 95, retire));
  const yrs1 = Math.max(1, Math.min(35, retire - 22));
  const spRet = m ? spAge + (retire - age) : retire;
  const ss1 = opNum("opSS1", 0, 1e5, 0), ss2 = m ? opNum("opSS2", 0, 1e5, 0) : 0;
  const pia1 = ss1 > 0 ? ss1 : ssEstimate(opNum("opInc1", 0, 1e8, 0), yrs1, 67).pia;
  const pia2 = !m ? 0 : ss2 > 0 ? ss2 : ssEstimate(opNum("opInc2", 0, 1e8, 0), Math.max(1, Math.min(35, spRet - 22)), 67).pia;
  const roth = opNum("opRoth", 0, 1e10, 0), brok = opNum("opBrok", 0, 1e10, 0);
  const claim = Math.round(opNum("opClaim", 62, 70, 67));
  const years = Math.max(20, Math.min(60, Math.max(95 - retire, m ? 95 - spRet : 0)));
  const save = id => now ? opNum(id, 0, 1e7, 0) : 0;
  return {status:m ? "m" : "s", state:$("opState").value || "IL", age, spouseAge:spAge, retire, stopAge:null,
    trad:opNum("opTrad", 0, 1e10, 0), roth, rothBasis:Math.min(roth, opNum("opRothBasis", 0, 1e10, roth * .5)),
    brok, brokBasis:brok * opNum("opBasis", 0, 100, 60) / 100,
    saveTrad:save("opSaveTrad"), saveRoth:save("opSaveRoth"), saveBrok:save("opSaveBrok"),
    real:parseFloat($("opRisk").value) || .045, infl:BASIC_INFL,
    spend:opNum("opSpend", 0, 1e8, 0), pia1, pia2, claim1:claim, claim2:claim,
    pension:opNum("opPension", 0, 1e8, 0), pensionAge:$("opPenAge").value.trim() === "" ? null : Math.round(opNum("opPenAge", 40, 90, retire)),
    pensionCola:$("opPenCola").value === "1", aca:$("opAca").value === "1" && retire < 65, household:m ? 2 : 1,
    rule55:$("opRule55").value === "1", heirRate:opNum("opHeir", 0, 50, 24) / 100, mix:opNum("opMix", 0, 100, 60),
    years, target:parseFloat($("opTarget").value) || .9, strategy:"fixed", minSpend:0, fromYear:HIST_START};
}
function opSyncFields(){
  const m = $("opStatus").value === "m", now = opMode() === "now";
  const retire = Math.round(opNum("opRetire", 30, 90, 62)), age = now ? Math.round(opNum("opAge", 18, 90, 58)) : retire;
  $("opModeSeg").querySelectorAll("button").forEach(b => b.classList.toggle("on", b.getAttribute("data-opmode") === (now ? "now" : "ret")));
  document.querySelectorAll("#asideOP .op-sp").forEach(el => { el.hidden = !m; });
  document.querySelectorAll("#asideOP .op-nowonly").forEach(el => { el.hidden = !now; });
  document.querySelectorAll("#asideOP .op-retonly").forEach(el => { el.hidden = now || !m; });
  $("opRetRow").classList.toggle("one", now || !m);
  $("opRetireLbl").textContent = now ? "Retire at" : "Your age at retirement";
  $("opBalHead").textContent = now ? "Saved for retirement today" : "Saved on the day you retire";
  $("opBalNote").textContent = now ? "Today's balances. Advanced or Stages can fill these in, with what you save each month."
    : "In today's dollars. Advanced or Stages can project these for you, account by account.";
  $("opRule55Wrap").hidden = !(retire >= 55 && retire < 60);
  $("opAcaWrap").hidden = !(retire < 65);
  if (now) $("opSaveWrap").hidden = !(retire > age);
}
/* Switching modes keeps the balances as typed (their meaning changes, and
   the heading says so) and carries the spouse's age across. */
function opSetMode(to){
  if (to === opMode()) return;
  const age = num("opAge"), r = num("opRetire");
  if (to === "ret" && age > 0 && r > 0 && num("opSpAge") > 0) $("opSpRet").value = String(Math.round(num("opSpAge") + (r - age)));
  if (to === "now" && age > 0 && r > 0 && num("opSpRet") > 0) $("opSpAge").value = String(Math.round(num("opSpRet") - (r - age)));
  $("opMode").value = to;
  renderOptimizer();
  toast(to === "ret" ? "Enter what you'll have on the day you retire, or copy it from Advanced or Stages"
    : "Enter what you have today and what you save each month, or copy them from Advanced or Stages");
}
/* Advanced or Stages, whichever has its savings split by account type. Each
   is re-run first, so the numbers are the ones on its screen now. */
function opSources(){
  const out = [];
  if (acOn()){
    const p = readInputs();
    if (lastAcct) out.push({label:"Advanced", B:lastAcct, a:lastAcct.a, years:p.years, p,
      defl:Math.pow(1 + p.inflation, p.inflYears == null || p.inflYears === "" ? p.years : p.inflYears)});
  }
  if (saOn()){
    const g = readGlobals();
    if (lastStageAcct) out.push({label:"Stages", B:lastStageAcct, a:lastStageAcct.a, years:lastStageAcct.years, g,
      defl:Math.pow(1 + g.inflation, lastStageAcct.years)});
  }
  return out;
}
/* What each source would put in each month, today, with any match. */
function opSourceSaving(src){
  const a = src.a;
  if (src.p){
    const ppy = PPY[src.p.period], mo = v => v * ppy / 12;
    return {t:mo(a.tradC + acMatchPer(a, ppy)), r:mo(a.rothC), b:mo(a.brokC),
      real:(1 + src.p.nominal) / (1 + src.p.inflation) - 1};
  }
  const st = stages[0], g = src.g;
  if (!st) return {t:0, r:0, b:0, real:.045};
  const ppy = PPY[st.period], sp = stSplit(st), mine = Math.max(0, st.contrib), mo = v => v * ppy / 12;
  const mf = stMatchFactor(g, st, mine, a.salary);
  return {t:mo(mine * sp.t + mine * (mf - 1)), r:mo(mine * sp.r), b:mo(mine * sp.b),
    real:(1 + st.nominal - (g.fees || 0)) / (1 + g.inflation) - 1};
}
function opRiskSet(real, from){
  const sel = $("opRisk"), hit = RISK_LEVELS.find(r => Math.abs(r.real - real) < 5e-4);
  let o = sel.querySelector("option[data-custom]");
  if (hit){ if (o) o.remove(); sel.value = String(hit.real); return; }
  if (!o){ o = document.createElement("option"); o.setAttribute("data-custom", "1"); sel.appendChild(o); }
  o.value = String(Math.round(real * 1e5) / 1e5);
  o.textContent = "From " + from + " · " + pctStr(real, 1) + " after inflation";
  sel.value = o.value;
}
async function opCopy(){
  const now = opMode() === "now", src = opSources();
  if (!src.length){
    toast("Turn on Split by account type in Advanced or Stages first, then copy it here", "warn");
    return;
  }
  let pick = src[0];
  if (src.length > 1){
    const i = await showPopup(now ? "Copy today's savings from which plan?" : "Copy your balances at retirement from which plan?", src.map(x => {
      if (now){
        const v = opSourceSaving(x);
        return {label:x.label, desc:opCompact(x.a.tradBal + x.a.rothBal + x.a.brokBal) + " today, saving " + money(v.t + v.r + v.b) + "/mo", money:true};
      }
      return {label:x.label, desc:opCompact(x.B.totalReal) + " at retirement, in " + fmtNum(x.years) + " years", money:true};
    }));
    if (i < 0) return;
    pick = src[i];
  }
  const B = pick.B, a = pick.a, put = (id, v) => { $(id).value = groupDigits(Math.round(Math.max(0, v)), true); };
  const notes = [];
  if (a.status) $("opStatus").value = a.status;
  if (a.state && $("opState").querySelector("option[value='" + a.state + "']")) $("opState").value = a.state;
  const H = hhLoad();
  if (now){
    put("opTrad", a.tradBal); put("opRoth", a.rothBal); put("opBrok", a.brokBal);
    put("opRothBasis", a.rothBal * .5);
    $("opBasis").value = String(a.brokBal > 0 ? Math.round(Math.min(1, (a.brokBasis == null ? a.brokBal : a.brokBasis) / a.brokBal) * 100) : 100);
    const v = opSourceSaving(pick);
    put("opSaveTrad", v.t); put("opSaveRoth", v.r); put("opSaveBrok", v.b);
    opRiskSet(v.real, pick.label);
    const age = num("opAge");
    if (age > 0) $("opRetire").value = String(Math.round(age + pick.years));
    if (pick.p && Math.abs(pick.p.growth - pick.p.inflation) > .0025)
      notes.push("Advanced raises your saving " + pctStr(pick.p.growth, 1) + " a year; here it keeps pace with inflation");
    if (pick.p && pick.p.glide && pick.p.glide.on) notes.push("the glide path isn't carried over");
    if (pick.g && stages.length > 1) notes.push("only stage 1's saving comes across; Retirement day mode keeps every stage");
  } else {
    put("opTrad", B.real.trad); put("opRoth", B.real.roth); put("opBrok", B.real.brok);
    // Roth contributions: half of today's Roth (the part that's growth isn't
    // known), plus everything put in along the way, in today's dollars.
    put("opRothBasis", Math.min(B.real.roth, (a.rothBal * .5 + (B.rothIn || 0)) / pick.defl));
    $("opBasis").value = String(Math.round(Math.max(0, Math.min(1, 1 - B.gainPct)) * 100));
    if (H && H.age > 0){
      $("opRetire").value = String(Math.round(H.age + pick.years));
      if (a.status === "m" && H.spouseAge > 0) $("opSpRet").value = String(Math.round(H.spouseAge + pick.years));
    } else notes.push("check your age at retirement: " + pick.label + " counts years, not ages");
  }
  renderOptimizer();
  const tot = now ? a.tradBal + a.rothBal + a.brokBal : B.totalReal;
  toast("Copied " + opCompact(tot) + (now ? " today" : " at retirement") + " from " + pick.label +
    (notes.length ? ". Note: " + notes.join("; ") + "." : ""));
}
function renderOptimizer(){
  const root = $("opOut");
  if (!root) return;
  opSyncFields();
  const I = opToolIn(), P = plAtRetire(I), H = OP.tool, goal = H.goal, now = opMode() === "now";
  const E = opEstimate(P);
  $("opGoals").innerHTML = opGoalsHTML("tool", goal);
  $("opEst").textContent = groupDigits(E.n, true) + " plans × " + E.w + " historical markets = " + groupDigits(E.runs, true) + " retirements, about " + E.secs + " seconds.";
  $("opRunBtn").disabled = !!H.run || !(I.spend > 0);
  $("opRunBtn").firstChild.textContent = H.res && H.res.sig === opSig(P, goal) ? "Run it again" : "Find my best plan";
  let s = "";
  if (!(I.spend > 0)) s = "<div class='panel'><div class='body'><div class='gd-callout warn'>Enter what you'll spend each year in retirement to find your plan.</div></div></div>";
  else if (H.run) s = "<div class='panel'><div class='body'>" + opProgHTML("tool") + "</div></div>";
  else if (H.res){
    if (H.res.sig !== opSig(P, goal)) s += "<div class='panel'><div class='body'><div class='gd-callout warn' style='margin:0'>Your numbers or the goal changed since this ran. <button type='button' class='btn mini' data-op='run' data-host='tool'>Run it again</button></div></div></div>";
    s += opResultHTML("tool", H.res);
    H.fresh = false;
  } else {
    const at = P.fv;
    s = "<div class='panel op-ready'><div class='body'><div class='op-ready-in'>" +
      "<div><div class='k'>" + (now ? "At " + P.age1 + " you'll have about" : "On the day you retire, at " + P.age1) + "</div><div class='v'>" + money(at) + "</div><div class='n'>" + money(P.trad) + " traditional · " + money(P.roth) + " Roth · " + money(P.brok) + " brokerage, in today's dollars</div></div>" +
      "<div><div class='k'>Social Security at 67</div><div class='v'>" + money((I.pia1 + I.pia2)) + "<small>/mo</small></div><div class='n'>" + (I.status === "m" ? money(I.pia1) + " + " + money(I.pia2) + ", before any spousal top-up" : "Before claiming earlier or later") + "</div></div>" +
      "</div><p class='hint' style='margin:12px 0 0'>Pick a goal above and press <b>Find my best plan</b>. The search runs in your browser: nothing you enter is sent anywhere.</p></div></div>";
  }
  root.innerHTML = s;
  opDrawAll(root);
}
function opToolRun(){
  const I = opToolIn();
  if (!(I.spend > 0)){ toast("Enter your spending in retirement first", "warn"); return; }
  opStart("tool", plAtRetire(I), OP.tool.goal);
  try { $("opOut").scrollIntoView({behavior:"smooth", block:"start"}); } catch(e){}
}
function opFillStates(){
  $("opState").innerHTML = $("txState").innerHTML;
  // Illinois is the default, so Reset and the "edited" check come back to it.
  Array.prototype.forEach.call($("opState").options, o => { o.defaultSelected = o.value === "IL"; });
  $("opState").value = "IL";
}

/* ---- controls, both hosts ---- */
document.addEventListener("click", e => {
  const el = e.target.closest ? e.target.closest("[data-op]") : null;
  if (!el || el.disabled) return;
  const op = el.getAttribute("data-op"), host = el.getAttribute("data-host") || "tool";
  if (op === "goal"){
    const g = el.getAttribute("data-goal");
    if (host === "guide"){ gd.a.optGoal = g; gdSave(); gdRender(false); }
    else { OP.tool.goal = g; renderOptimizer(); }
  } else if (op === "run"){
    if (host === "guide"){ const P = opGuideP(); if (P) opStart("guide", P, opGuideGoal()); }
    else opToolRun();
  } else if (op === "stop") opStop(host);
});
(function(){
  opFillStates();
  $("opRisk").innerHTML = RISK_LEVELS.map(r => "<option value='" + r.real + "'" + (r.real === .045 ? " selected" : "") + ">" + r.label + " · " + pctStr(r.real, 1) + " after inflation</option>").join("");
  let t = null;
  const later = () => { clearTimeout(t); t = setTimeout(renderOptimizer, 120); };
  $("opModeSeg").addEventListener("click", e => {
    const b = e.target.closest ? e.target.closest("button[data-opmode]") : null;
    if (b) opSetMode(b.getAttribute("data-opmode"));
  });
  $("opCopy").addEventListener("click", opCopy);
  $("asideOP").addEventListener("input", later);
  $("asideOP").addEventListener("change", later);
})();
Object.assign(GLOSS, {
  opinc: "Don't have your Social Security statement? Leave the benefit blank and enter your salary instead: the optimizer estimates the benefit at 67 from it, with the 2026 formula, assuming you work at about this pay until you retire. A statement from ssa.gov/myaccount is more accurate.",
  opmode: "Retirement day: enter the balances you'll have when you retire (or copy them from Advanced or Stages, which project them with every detail), and the optimizer starts there. Today: enter what you have now and what you save each month, and it grows them to retirement at a steady return first.",
  opretire: "The age you stop working. Your spouse stops at the same time, at whatever age they are then. Already retired? Enter your age today.",
  optrad: "Pre-tax money: traditional 401(k), 403(b), 457(b) and IRA balances. Every dollar is taxed as income when it comes out, and from 73 or 75 the IRS makes you take some out each year.",
  oprothbasis: "What you've put into Roth accounts yourself, as opposed to growth. Contributions can come out at any age, tax- and penalty-free, which matters before 59½. A guess is fine.",
  opbasis: "How much of the brokerage balance is money you put in. Only the rest, the gain, is taxed when you sell, usually at 0% or 15%.",
  opsavetrad: "What goes in each month until you retire, in today's dollars, rising with inflation. Put any employer match here: it always lands in a traditional account.",
  opspend: "What you want to live on each year after every tax is paid, in today's dollars. Each plan works out its own tax, Medicare surcharge and health premiums and pays them on top.",
  opmix: "Your stock share in retirement; the rest is bonds. Every plan is tested on this mix's real history since 1926.",
  opss: "Your monthly Social Security benefit at 67, full retirement age, from your statement at ssa.gov/myaccount. Leave it blank and enter your salary beside it to estimate it instead. The optimizer tries every claiming age from 62 to 70.",
  opclaim: "The plan to beat: when you'd claim if you didn't optimize it. Every result is measured against this plan, run the usual way: brokerage first, then traditional, then Roth, with no conversions.",
  opaca: "Before Medicare at 65, each plan buys the benchmark Silver marketplace plan for your state and ages, less the premium tax credit that year's income earns. Above 400% of the poverty line the credit disappears all at once.",
  oprule55: "Leave your job in or after the year you turn 55 and that employer's 401(k) can pay out without the 10% early-withdrawal penalty. Roll it into an IRA and you lose that.",
  opheir: "The income tax whoever inherits your traditional accounts will likely pay on them. It's what makes a Roth dollar worth more than a traditional one at the end. Roth and brokerage money passes on without income tax.",
  optarget: "How often a plan has to last to count as safe, across every historical market. Leave the most never picks a plan that lasts less often than the usual way; Spend the most finds the highest spending that clears this bar."
});
