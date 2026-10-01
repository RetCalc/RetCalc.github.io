/* ---------- the Drawdown Simulator's views ----------
   Three views of one plan. Your plan: the long-standing results, with the
   spending scorecard, a pinned baseline and the spread of outcomes. Compare
   strategies: the showdown, every strategy tuned to the same risk. Safe
   spending: the most each start could have spent, the two solvers, the
   success grid and how valuations at the start lined up with it all. The
   last two always use the historical record, and run in the worker. */

/* The setting a search found, in words. */
function ddDialText(id, v, o){
  if (v == null) return "—";
  var D = (DD_STRAT[id] || {}).dial;
  if (!D) return "";
  if (D.key === "vpwRate") return pctStr(v / 100, 2) + " real return";
  if (D.key === "hebRate") return pctStr(v / 100, 2) + " real return";
  if (D.key === "rgTarget") return ddN(Math.round(v * 10) / 10) + "% chance";
  if (D.key === "capeA") return pctStr(v / 100, 2) + " + " + ddN(o && o.capeB != null ? o.capeB : .5) + " × 1/CAPE";
  if (D.key === "yaleRate") return pctStr(v / 100, 2) + " target";
  return pctStr(v / 100, 2) + " start";
}
/* The strategies the picker offers, in its order. */
function ddPickerIds(){
  return Array.prototype.map.call($("ddStrategy").options, function (x) { return x.value; })
    .filter(function (id) { return DD_STRAT[id]; });
}

/* ---- which view ---- */
var ddTab = "plan";
function ddShowTab(t){
  ddTab = t;
  $("tab-drawdown").setAttribute("data-tab", t);
  $("segDDTab").querySelectorAll("button").forEach(function (b) {
    var on = b.getAttribute("data-ddtab") === t;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", String(on));
  });
  renderDrawdown();
}
$("segDDTab").addEventListener("click", function (e) {
  var b = e.target.closest ? e.target.closest("button[data-ddtab]") : null;
  if (b) ddShowTab(b.getAttribute("data-ddtab"));
});

/* ---- small pieces ---- */
/* A change against the pinned baseline, under a headline figure or a tile:
   up or down, and whether that's better (higher is better unless lowBetter). */
function ddDeltaHtml(cur, base, kind, lowBetter){
  if (base == null || cur == null || !isFinite(cur) || !isFinite(base)) return "";
  var d = cur - base, tiny = kind === "pts" ? .0005 : kind === "money" ? .5 : .05;
  if (Math.abs(d) < tiny) return "<span class='dddelta-s same'>same as baseline</span>";
  var good = lowBetter ? d < 0 : d > 0;
  var txt = kind === "pts" ? (d > 0 ? "+" : "−") + (Math.abs(d) * 100).toFixed(1) + " pts"
    : kind === "money" ? (d > 0 ? "+" : "−") + money(Math.abs(d))
    : (d > 0 ? "+" : "−") + (Math.abs(d) % 1 ? (Math.round(Math.abs(d) * 10) / 10).toFixed(1) : String(Math.abs(d)));
  return "<span class='dddelta-s " + (good ? "pos" : "neg") + "'>" + txt + "</span>";
}
function ddSetDelta(id, cur, base, kind, lowBetter){
  var el = $(id), h = ddDeltaHtml(cur, base, kind, lowBetter);
  el.hidden = !h;
  el.innerHTML = h;
}
function ddFmtMoneyShort(v){ return fmtAxisMoney(v); }
/* A plan in a line: strategy, its setting, the mix and the years. */
function ddPlanLabel(o){
  var u = DD_UI[o.strategy] || {}, D = (DD_STRAT[o.strategy] || {}).dial;
  return (u.card || u.name || o.strategy) + (D ? ", " + ddDialText(o.strategy, o[D.key], o) : "") + ", " +
    o.stockPct + "% stocks, " + fmtNum(o.years) + " years" + (o.monthly ? ", every month" : "");
}

/* ---- the comfort line ---- */
function ddComfortSync(o, P){
  var c = ddComfort(o, P);
  $("ddComfortNote").textContent = o.comfort > 0 ? ""
    : o.spendFloor > 0 && (DD_STRAT[o.strategy] || {}).limits !== false
      ? "Blank: your minimum spending, " + money(c) + " a year."
      : "Blank: 80% of year one's spending, " + money(c) + " a year.";
  return c;
}

/* ---- the pinned baseline ----
   The inputs as they were when pinned. Its results are worked out again in
   whatever mode is showing, so a change is always measured like for like. */
var ddBase = null, ddBaseMC = null;
$("ddPin").addEventListener("click", function () {
  var o = readDD();
  if (!(o.initial > 0)) { toast("Enter a portfolio value first"); return; }
  ddBase = {state: readDDState(), label: ddPlanLabel(o)};
  ddBaseMC = null;
  renderDrawdown();
  toast("Pinned. Change anything to compare");
});
$("ddBaseClear").addEventListener("click", function () {
  ddBase = null; ddBaseMC = null;
  renderDrawdown();
});
function ddBaseSync(){
  $("ddBaseBar").hidden = !ddBase;
  $("ddPin").textContent = ddBase ? "Pin again" : "Pin as baseline";
  if (ddBase) $("ddBaseLabel").textContent = ddBase.label;
  if (!ddBase) ["ddSuccessD", "ddMedianD", "ddWorstD", "ddLegacyD"].forEach(function (id) { $(id).hidden = true; });
}
/* The baseline through history, with its scorecard against today's line. */
function ddBaseHist(comfort){
  if (!ddBase) return null;
  var o = ddOptsFromState(ddBase.state);
  if (!(o.initial > 0)) return null;
  var H = historicalBacktest(o);
  if (!H.total) return null;
  return {o: o, H: H, sc: ddScorecard(H.runs, o, comfort, H.prep.path)};
}
/* The median of every start's balance (or spending) by year, as a line. */
function ddMedLine(H, field, from0, initial){
  var out = from0 ? [{year: 0, value: initial}] : [], n = H.runs[0] ? H.runs[0].rows.length : 0;
  for (var y = 0; y < n; y++) {
    var v = H.runs.map(function (r) { return r.rows[y] ? r.rows[y][field] : 0; }).sort(function (a, b) { return a - b; });
    out.push({year: y + 1, value: v[Math.floor(v.length / 2)]});
  }
  return out;
}
function ddBaseOverlay(B, field, from0, startIdx){
  if (!B) return null;
  var pts;
  if (startIdx != null) {
    var r = B.H.runs.filter(function (x) { return x.startIdx === startIdx; })[0];
    if (!r) return null;
    pts = (from0 ? [{year: 0, value: B.o.initial}] : []).concat(r.rows.map(function (w) { return {year: w.year, value: w[field]}; }));
  } else pts = ddMedLine(B.H, field, from0, B.o.initial);
  return [{pts: pts, color: "#c9d3e6", dash: "6 5", width: 1.6}];
}
function ddHeadDeltas(cur, base){
  if (!base) return;
  ddSetDelta("ddSuccessD", cur.success, base.success, "pts");
  ddSetDelta("ddMedianD", cur.median, base.median, "money");
  ddSetDelta("ddWorstD", cur.worst, base.worst, "money");
  if (cur.legacy != null && base.legacy != null) ddSetDelta("ddLegacyD", cur.legacy, base.legacy, "pts");
  else $("ddLegacyD").hidden = true;
}

/* ---- the spending scorecard ---- */
function ddPaintScore(sc, base, mc){
  var n = sc.n, line = sc.comfort, unit = mc ? " runs" : " retirements";
  var who = function (r) { return r && r.startYear != null ? ddStartLabel(r, ddLastH && ddLastH.monthly) : ""; };
  var stayed = n ? (n - sc.dipped) / n : 0, bStayed = base ? (base.n - base.dipped) / base.n : null;
  var tile = function (k, v, note, delta, tip) {
    return "<div class='ddtile'><div class='k'>" + k + (tip ? "<span class='tipdot' data-tip='" + tip + "' role='button' tabindex='0' aria-label='What is this?'>?</span>" : "") +
      "</div><div class='v'>" + v + "</div>" + (delta || "") + "<div class='n'>" + note + "</div></div>";
  };
  $("ddScoreH2").textContent = "comfort line " + money(line) + " a year";
  var out = [
    tile("Never below the comfort line", pctStr(stayed, 1),
      (n - sc.dipped).toLocaleString() + " of " + n.toLocaleString() + unit,
      base ? ddDeltaHtml(stayed, bStayed, "pts") : ""),
    tile("Years spent below it", pctStr(sc.years ? sc.below / sc.years : 0, 1),
      "of every year of every" + (mc ? " run" : " retirement"),
      base ? ddDeltaHtml(sc.years ? sc.below / sc.years : 0, base.years ? base.below / base.years : 0, "pts", true) : ""),
    tile("Longest stretch below", sc.longest ? sc.longest + (sc.longest === 1 ? " year" : " years") : "None",
      sc.longest && who(sc.longRun) ? "retiring in " + who(sc.longRun) : "never under the line",
      base ? ddDeltaHtml(sc.longest, base.longest, "n", true) : ""),
    tile("Leanest year", money(sc.low),
      pctStr(sc.lowRatio, 0) + " of year one" + (who(sc.lowRun) ? ", retiring in " + who(sc.lowRun) : ""),
      base ? ddDeltaHtml(sc.low, base.low, "money") : ""),
    tile("Typical lifetime spending", ddFmtMoneyShort(sc.lifeMed), "the median, in today's dollars",
      base ? ddDeltaHtml(sc.lifeMed, base.lifeMed, "money") : ""),
    tile("Cuts per" + (mc ? " run" : " retirement"), (Math.round(sc.cutsAvg * 10) / 10).toFixed(1),
      sc.maxCut > 0 ? "the biggest, " + pctStr(sc.maxCut, 0) + " in one year" : "never a cut",
      base ? ddDeltaHtml(sc.cutsAvg, base.cutsAvg, "n", true) : "")
  ];
  $("ddScore").innerHTML = out.join("");
  var cnt = function (k, v, tip) {
    return "<span class='ddcount'><span class='tipglue'>" + k +
      "<span class='tipdot' data-tip='" + tip + "' role='button' tabindex='0' aria-label='What is this?'>?</span></span><b>" +
      v.toLocaleString() + "</b></span>";
  };
  $("ddCounts").innerHTML = cnt("Big swings", sc.volatile, "ddswing") + cnt("50%+ above year one", sc.large, "ddlarge") +
    cnt("Half of year one or less", sc.small, "ddsmall") + cnt("Ended at twice the start", sc.bigEnd, "ddbigend") +
    cnt("Ended under half, not empty", sc.smallEnd, "ddsmallend") +
    "<span class='ddcount-of'>of " + n.toLocaleString() + unit + "</span>";
}

/* ---- the spread of outcomes ---- */
var ddDistKind = "bal", ddDistAt = null, ddDistSrc = null, ddDistPts = null;
function ddDistYears(years){
  var sel = $("ddDistYear"), want = years + "|" + (ddRetireAge != null ? ddRetireAge : "");
  if (sel.getAttribute("data-built") === want) return;
  var opts = [];
  for (var y = 1; y <= years; y++)
    opts.push("<option value='" + y + "'>" + (y === years ? "Final year" : ddRetireAge != null ? "Age " + fmtNum(ddAgeVal(y)) : "Year " + y) + "</option>");
  sel.innerHTML = opts.join("");
  sel.setAttribute("data-built", want);
  if (ddDistAt == null || ddDistAt > years) ddDistAt = years;
  sel.value = String(ddDistAt);
}
/* src: {years, at(kind, y) -> the values that year, comfort}. */
function ddPaintDist(src){
  ddDistSrc = src;
  ddDistYears(src.years);
  if (ddDistAt > src.years) ddDistAt = src.years;
  $("ddDistYear").value = String(ddDistAt);
  var vals = Array.prototype.slice.call(src.at(ddDistKind, ddDistAt)).sort(function (a, b) { return a - b; });
  var n = vals.length;
  if (!n) { $("ddDistStats").innerHTML = ""; $("chartDDH").innerHTML = ""; return; }
  var sum = 0, sq = 0, zeros = 0;
  vals.forEach(function (v) { sum += v; sq += v * v; if (v < .5) zeros++; });
  var avg = sum / n, sd = Math.sqrt(Math.max(0, sq / n - avg * avg));
  var lo = vals[0], hi = vals[n - 1], bins = 24, w = (hi - lo) / bins || 1, counts = [];
  for (var b = 0; b < bins; b++) counts.push(0);
  vals.forEach(function (v) { counts[Math.min(bins - 1, Math.floor((v - lo) / w))]++; });
  ddDistPts = ddBars("chartDDH", counts.map(function (c, i) { return {lo: lo + i * w, hi: lo + (i + 1) * w, n: c}; }),
    ddDistKind === "spend" && src.comfort > 0 ? src.comfort : null);
  var stat = function (k, v) { return "<div><span>" + k + "</span><b>" + v + "</b></div>"; };
  var bal = ddDistKind === "bal";
  var below = 0;
  if (!bal && src.comfort > 0) vals.forEach(function (v) { if (v < src.comfort - .5) below++; });
  $("ddDistStats").innerHTML = stat("Median", money(vals[Math.floor(n / 2)])) + stat("Average", money(avg)) +
    stat("Spread (std. dev.)", money(sd)) + stat("Largest", money(hi)) + stat("Smallest", money(lo)) +
    (bal ? stat("Empty", zeros.toLocaleString() + " (" + pctStr(zeros / n, 1) + ")")
         : stat("Under the comfort line", below.toLocaleString() + " (" + pctStr(below / n, 1) + ")"));
  setH2Text($("ddDistTitle"), bal ? "Spread of ending balances" : "Spread of spending");
}
$("ddDistYear").addEventListener("change", function () {
  ddDistAt = parseInt($("ddDistYear").value, 10) || null;
  if (ddDistSrc) ddPaintDist(ddDistSrc);
});
$("segDDDist").addEventListener("click", function (e) {
  var b = e.target.closest ? e.target.closest("button[data-dddist]") : null;
  if (!b) return;
  ddDistKind = b.getAttribute("data-dddist");
  $("segDDDist").querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x === b); });
  if (ddDistSrc) ddPaintDist(ddDistSrc);
});
/* A histogram: one bar per bin, an optional dashed line at a value. */
function ddBars(svgId, bins, mark){
  var svg = $(svgId), narrow = window.innerWidth < 640;
  var W = narrow ? 470 : 900, H = narrow ? 340 : 300, L = narrow ? 50 : 60, R = narrow ? 12 : 14, T = 12, B = narrow ? 44 : 38;
  var fs = narrow ? 15 : 11, pw = W - L - R, ph = H - T - B;
  svg.setAttribute("viewBox", "0 0 " + W + " " + H);
  svg.innerHTML = "";
  var max = Math.max.apply(null, bins.map(function (b) { return b.n; })) || 1;
  var AX = niceAxis(0, max), x0 = bins[0].lo, x1 = bins[bins.length - 1].hi, span = (x1 - x0) || 1;
  var X = function (v) { return L + (v - x0) / span * pw; }, Y = function (v) { return T + ph - v / AX.max * ph; };
  AX.ticks.forEach(function (v) {
    svg.appendChild(svgEl("line", {x1: L, x2: W - R, y1: Y(v), y2: Y(v), stroke: cssVar("--grid"), "stroke-width": 1}));
    var t = svgEl("text", {x: L - 8, y: Y(v) + fs / 3, "text-anchor": "end", "font-size": fs, fill: cssVar("--axis"),
      "font-family": "ui-monospace,SF Mono,Menlo,monospace"});
    t.textContent = fmtNum(v); svg.appendChild(t);
  });
  var gap = Math.max(1, pw / bins.length * .12);
  bins.forEach(function (b) {
    if (!b.n) return;
    svg.appendChild(svgEl("rect", {x: X(b.lo) + gap / 2, y: Y(b.n), width: Math.max(1, X(b.hi) - X(b.lo) - gap), height: Math.max(0, T + ph - Y(b.n)),
      fill: "#4fbf95", opacity: .72, rx: 2}));
  });
  var ax = niceAxis(x0, x1);
  ax.ticks.forEach(function (v) {
    if (v < x0 - 1e-9 || v > x1 + 1e-9) return;
    var t = svgEl("text", {x: X(v), y: H - (narrow ? 14 : 12), "text-anchor": "middle", "font-size": fs, fill: cssVar("--axis"),
      "font-family": "ui-monospace,SF Mono,Menlo,monospace"});
    t.textContent = fmtAxisMoney(v); svg.appendChild(t);
  });
  if (mark != null && mark >= x0 && mark <= x1) {
    svg.appendChild(svgEl("line", {x1: X(mark), x2: X(mark), y1: T, y2: T + ph, stroke: "#e9b872", "stroke-width": 1.5, "stroke-dasharray": "5 4"}));
    var lb = svgEl("text", {x: X(mark) + 5, y: T + fs, "font-size": fs * .92, fill: "#e9b872", "font-family": "ui-monospace,SF Mono,Menlo,monospace"});
    lb.textContent = "comfort line"; svg.appendChild(lb);
  }
  var hover = svgEl("rect", {x: 0, y: T, width: 0, height: ph, fill: "#e9b872", opacity: 0, rx: 2});
  svg.appendChild(hover);
  return {bins: bins, X: X, W: W, hover: hover};
}
(function () {
  var wrap = $("chartWrapDDH");
  var probe = function (cx, cy) {
    var st = ddDistPts;
    if (!st) return;
    var box = $("chartDDH").getBoundingClientRect();
    if (!box.width) return;
    var vx = (cx - box.left) / box.width * st.W, best = null;
    st.bins.forEach(function (b) { if (vx >= st.X(b.lo) && vx <= st.X(b.hi)) best = b; });
    if (!best) return;
    st.hover.setAttribute("x", st.X(best.lo)); st.hover.setAttribute("width", Math.max(1, st.X(best.hi) - st.X(best.lo)));
    st.hover.setAttribute("opacity", .14);
    var tip = $("tipDDH");
    tip.innerHTML = "<b>" + money(best.lo) + " – " + money(best.hi) + "</b><br><span class='n'>" + best.n.toLocaleString() + "</span> " +
      (ddMode === "mc" ? "runs" : "retirements");
    tip.style.opacity = 1;
    var wb = wrap.getBoundingClientRect(), tw = tip.offsetWidth || 160;
    tip.style.left = Math.max(4, Math.min(cx - wb.left + 14, wb.width - tw - 4)) + "px";
    tip.style.top = Math.max(4, cy - wb.top - 60) + "px";
  };
  var clear = function () { $("tipDDH").style.opacity = 0; if (ddDistPts) ddDistPts.hover.setAttribute("opacity", 0); };
  wrap.addEventListener("mousemove", function (e) { probe(e.clientX, e.clientY); });
  wrap.addEventListener("mouseleave", clear);
  chartTouch(wrap, probe, clear);
})();

/* ---- everything the plan view adds, once the results are in ----
   kind "hist": R is the historical test; "mc": the Monte Carlo summary. */
function ddPlanExtras(kind, o, P, R, comfort, B){
  ddBaseSync();
  var sc = kind === "hist" ? ddScorecard(R.runs, o, comfort, R.prep.path) : R.sc;
  if (ddBase && kind === "hist") {
    if (B) ddHeadDeltas({success: R.successRate, median: R.medianEnd, worst: R.worstEnd,
        legacy: o.legacyGoal > 0 ? R.runs.filter(function (r) { return r.endReal >= o.legacyGoal; }).length / R.total : null},
      {success: B.H.successRate, median: B.H.medianEnd, worst: B.H.worstEnd,
        legacy: o.legacyGoal > 0 ? B.H.runs.filter(function (r) { return r.endReal >= o.legacyGoal; }).length / B.H.total : null});
  }
  if (ddBase && kind === "mc" && ddBaseMC) {
    var Mb = ddBaseMC;
    ddHeadDeltas({success: R.successRate, median: R.medianEnd, worst: R.p10End, legacy: o.legacyGoal > 0 ? R.legacy / R.trials : null},
      {success: Mb.successRate, median: Mb.medianEnd, worst: Mb.p10End, legacy: o.legacyGoal > 0 ? Mb.legacy / Mb.trials : null});
  }
  var bsc = !ddBase ? null : kind === "hist" ? (B ? B.sc : null) : (ddBaseMC ? ddBaseMC.sc : null);
  ddPaintScore(sc, bsc, kind === "mc");
  if (kind === "hist") {
    var runs = R.runs;
    ddPaintDist({years: o.years, comfort: comfort, at: function (k, y) {
      return runs.map(function (r) { var w = r.rows[y - 1]; return w ? (k === "bal" ? w.realEnd : w.realSpend) : 0; });
    }});
  } else {
    var Y = R.years, n = R.n;
    ddPaintDist({years: o.years, comfort: comfort, at: function (k, y) {
      var src = k === "bal" ? R.bal : R.spend, out = new Float64Array(n);
      for (var i = 0; i < n; i++) out[i] = src[i * Y + y - 1];
      return out;
    }});
  }
  return B;
}

/* ---- the risk target, for the showdown and safe spending ---- */
function ddTarget(o, d, comfort){
  return {crit: d.tCrit === "lasts" ? "lasts" : "comfort", conf: Math.min(100, Math.max(50, d.tConf || 100)) / 100,
    comfort: comfort};
}
function ddCritWords(T){
  return T.crit === "comfort" ? "spending never falls below " + money(T.comfort) + " a year"
    : "the money lasts the whole retirement";
}
function ddTargetWords(T){
  return ddCritWords(T) + " in " + (T.conf >= 1 ? "every historical start" : pctStr(T.conf, 0) + " of historical starts");
}
/* A strategy's dial, turned, as fields to set, plus the minimum a comfort
   target holds a flexible strategy to. */
function ddDialFields(o, id, v, T){
  var x = ddWithDial(Object.assign({}, o, {strategy: id}), v), out = {strategy: id};
  var key = (DD_STRAT[id].dial || {}).key, r2 = function (n) { return Math.round(n * 100) / 100; };
  if (key === "initialPct") out.rate = r2(x.initialPct);
  if (key === "vpwRate") out.vpwRate = r2(x.vpwRate);
  if (key === "hebRate") out.hebRate = r2(x.hebRate);
  if (key === "capeA") out.capeA = r2(x.capeA);
  if (key === "yaleRate") { out.yaleRate = r2(x.yaleRate); out.rate = r2(x.initialPct); }
  if (key === "rgTarget") { out.rgTarget = r2(x.rgTarget); out.rgLo = r2(x.rgLo); out.rgHi = r2(x.rgHi); }
  if (T && T.crit === "comfort" && DD_STRAT[id].limits !== false) out.spendFloor = Math.round(Math.max(o.spendFloor || 0, T.comfort));
  return out;
}
/* Sets just these fields, leaving the rest as they are. */
function ddSetFields(f){
  DD_STATE.forEach(function (x) { if (f[x[0]] != null && $(x[1])) ddFieldWrite(x, f[x[0]]); });
}
function ddApply(f, msg){
  ddSetFields(f);
  ddShowTab("plan");
  try { window.scrollTo({top: 0, behavior: "smooth"}); } catch (e) {}
  toast(msg);
}

/* ---- the strategy showdown ---- */
var ddShow = null, ddShowSort = {col: "life", dir: -1}, ddShowCharted = null, ddSpot = 0, ddShowY = "end";
var DD_SPOT_COLORS = ["#e9b872", "#4fbf95", "#7d9fd6", "#e2795f", "#b49be0", "#7fd0d6"];
function ddShowRefresh(o, d, comfort){
  var T = ddTarget(o, d, comfort);
  $("ddShowIntro").innerHTML = "<span class='ddwork'>Tuning every strategy to the same risk…</span>";
  ddRun("show", "showdown", {o: o, T: T, ids: ddPickerIds()}, function (res) {
    ddShow = {res: res, o: o, T: T};
    if (ddTab === "compare") ddPaintShow();
  });
}
function ddPaintShow(){
  if (!ddShow) return;
  var res = ddShow.res, o = ddShow.o, T = ddShow.T, list = res.list.slice();
  if (!ddShowCharted) ddShowCharted = {};
  if (!Object.keys(ddShowCharted).length) ["fixed", "guardrails", "vpw", o.strategy].forEach(function (id) {
    if (list.some(function (x) { return x.id === id; })) ddShowCharted[id] = 1;
  });
  var met = list.filter(function (x) { return x.met; });
  var top = met.slice().sort(function (a, b) { return b.life - a.life; })[0];
  var steady = met.filter(function (x) { return x.cuts < .05; }).sort(function (a, b) { return b.life - a.life; })[0];
  $("ddShowIntro").innerHTML = "Each strategy is set to spend as much as it can while " + ddTargetWords(T) + "." +
    (o.path && o.path !== "flat" ? " All are compared on steady spending; your spending path applies to the steady strategies only." : "") +
    (T.crit === "comfort" ? " The flexible ones are held at that line or above, as their minimum, so the risk they carry is running out of money while holding it." : "") +
    (top ? " Over a typical retirement, <b>" + escapeHtml(DD_STRAT_NAMES[top.id]) + "</b> spends the most, " + money(top.life) + " in today's dollars" +
      (steady && steady.id !== top.id ? "; the steadiest, <b>" + escapeHtml(DD_STRAT_NAMES[steady.id]) + "</b>, never cuts and spends " + money(steady.life) : "") + "." : "");
  // the chart: typical lifetime spending across, against what's left, the
  // leanest year or year one up
  var yk = ddShowY, yName = {end: "Typically left at the end", low: "Leanest year", first: "Year one"}[yk];
  ddShowPts = ddScatter("chartDDS", list.map(function (x) {
    return {x: x.life, y: x[yk], label: DD_UI[x.id].short, id: x.id, cur: x.id === o.strategy, miss: !x.met};
  }), {xFmt: fmtAxisMoney, yFmt: fmtAxisMoney, xLabel: "Typical lifetime spending →", yLabel: yName + " →", yZero: true,
    hLine: T.crit === "comfort" && yk !== "end" ? {y: T.comfort, label: "comfort line"} : null});
  $("legendDDS").innerHTML = swatch("#e9b872", "Your strategy") + swatch("#4fbf95", "Meets the target") +
    swatch("#e2795f", "Can't meet it: shown at its closest");
  // the table
  var key = ddShowSort.col, dir = ddShowSort.dir;
  list.sort(function (a, b) {
    var av = key === "name" ? DD_UI[a.id].name : a[key], bv = key === "name" ? DD_UI[b.id].name : b[key];
    return (typeof av === "string" ? av.localeCompare(bv) : av - bv) * dir;
  });
  var spotLbl = function (s) { return s ? (s.month && s.month !== 1 ? HIST_MON[s.month - 1] + " " : "") + s.year : ""; };
  $("ddShowTable").querySelector("tbody").innerHTML = list.map(function (x) {
    var setting = x.tuned ? ddDialText(x.id, x.dial, o) + (x.capped ? " (top of its range)" : "") : "No setting to tune";
    if (x.floor > 0) setting += "<small>never below " + money(x.floor) + "</small>";
    if (!x.met) setting += "<small class='neg'>closest: " + pctStr(x.share, 0) + " of starts</small>";
    return "<tr class='" + (x.id === o.strategy ? "ddcur" : "") + (x.met ? "" : " ddmiss") + "'><td>" + escapeHtml(DD_UI[x.id].name) + "</td>" +
      "<td class='ddset'>" + setting + "</td><td>" + money(x.first) + "</td><td>" + money(x.life) + "</td>" +
      "<td>" + money(x.low) + (x.lowStart ? "<small>" + spotLbl(x.lowStart) + "</small>" : "") + "</td>" +
      "<td>" + (Math.round(x.cuts * 10) / 10).toFixed(1) + "</td><td>" + money(x.end) + "</td>" +
      "<td><input type='checkbox' data-showchart='" + x.id + "'" + (ddShowCharted[x.id] ? " checked" : "") + " aria-label='Chart " + escapeHtml(DD_UI[x.id].short) + "'></td>" +
      "<td><button class='btn mini' type='button' data-showuse='" + x.id + "'>" + (x.id === o.strategy && x.tuned ? "Use setting" : "Use") + "</button></td></tr>";
  }).join("");
  $("ddShowTable").querySelectorAll("th.sortcol").forEach(function (th) {
    th.classList.remove("sort-asc", "sort-desc");
    if (th.getAttribute("data-ssort") === key) th.classList.add(dir > 0 ? "sort-asc" : "sort-desc");
  });
  $("ddShowNote").innerHTML = "Year one, the leanest year and lifetime spending are what was actually spent: the strategy's spending with " +
    "Social Security, other income and any guaranteed income, in today's dollars, without extra expenses. “Typical” is the median start. " +
    "Use sets the strategy and the setting found" + (T.crit === "comfort" ? ", with the comfort line as its minimum spending" : "") + ".";
  ddPaintSpot();
}
function ddPaintSpot(){
  if (!ddShow) return;
  var res = ddShow.res, spots = res.spots;
  var btns = $("segDDSpot").querySelectorAll("button");
  btns.forEach(function (b, i) { b.hidden = i >= spots.length; if (spots[i] != null) b.textContent = spots[i]; b.classList.toggle("on", i === ddSpot); });
  if (ddSpot >= spots.length) ddSpot = 0;
  if (!spots.length) { $("ddSpotPanel").classList.add("ddempty"); return; }
  $("ddSpotPanel").classList.remove("ddempty");
  var series = [], k = 0;
  res.list.forEach(function (x) {
    if (!ddShowCharted[x.id] || !x.spots[ddSpot]) return;
    series.push({name: DD_UI[x.id].short, color: x.id === ddShow.o.strategy ? "#e9b872" : DD_SPOT_COLORS[1 + (k++ % (DD_SPOT_COLORS.length - 1))],
      pts: x.spots[ddSpot].map(function (v, y) { return {year: y + 1, value: v}; }), width: x.id === ddShow.o.strategy ? 2.8 : 2});
  });
  if (ddShow.T.crit === "comfort") series.push({name: "Comfort line", color: "#8b97ad", dash: "5 5", width: 1.4,
    pts: ddShow.res.list.length ? ddShow.res.list[0].spots[ddSpot].map(function (v, y) { return {year: y + 1, value: ddShow.T.comfort}; }) : []});
  setH2Text($("ddSpotTitle"), "Retiring in " + spots[ddSpot]);
  ddSpotPts = paintMulti("chartDDSP", series, ddShow.o.years, {xFmt: function (y) { return ddRetireAge != null ? ddAgeVal(y) : y; }});
  $("legendDDSP").innerHTML = series.map(function (s) { return swatch(s.color, escapeHtml(s.name)); }).join("");
  $("ddSpotNote").textContent = series.length > 1 ? "Each charted strategy's spending, year by year, in today's dollars, at the setting it was tuned to above. Tick Chart in the table to add or remove one."
    : "Tick Chart in the table above to draw a strategy here.";
}
var ddShowPts = null, ddSpotPts = null;
attachChart("chartWrapDDSP", "chartDDSP", "tipDDSP", function () { return ddSpotPts; }, function (best) {
  var st = ddSpotPts;
  if (!st) return "";
  var out = "<b>" + (ddRetireAge != null ? "Age " + ddAgeVal(best.year) : "Year " + fmtNum(best.year)) + "</b>";
  st.names.forEach(function (nm, i) {
    if (best.vals[i] == null) return;
    out += "<br><span style='color:" + st.colors[i] + "'>" + escapeHtml(nm) + "</span> <span class='n'>" + money(best.vals[i]) + "</span>";
  });
  return out;
});
$("ddShowTable").addEventListener("click", function (e) {
  var th = e.target.closest ? e.target.closest("th.sortcol") : null;
  if (th) {
    var col = th.getAttribute("data-ssort");
    if (ddShowSort.col === col) ddShowSort.dir = -ddShowSort.dir;
    else { ddShowSort.col = col; ddShowSort.dir = col === "name" ? 1 : col === "cuts" ? 1 : -1; }
    ddPaintShow();
    return;
  }
  var use = e.target.closest ? e.target.closest("[data-showuse]") : null;
  if (!use || !ddShow) return;
  var id = use.getAttribute("data-showuse"), x = ddShow.res.list.filter(function (q) { return q.id === id; })[0];
  if (!x) return;
  var f = x.tuned ? ddDialFields(ddShow.o, id, x.dial, ddShow.T) : {strategy: id};
  ddApply(f, "Using " + DD_UI[id].name + (x.tuned ? ", " + ddDialText(id, x.dial, ddShow.o) : ""));
});
$("ddShowTable").addEventListener("change", function (e) {
  var t = e.target.closest ? e.target.closest("[data-showchart]") : null;
  if (!t) return;
  if (t.checked) ddShowCharted[t.getAttribute("data-showchart")] = 1;
  else delete ddShowCharted[t.getAttribute("data-showchart")];
  ddPaintSpot();
});
$("segDDShowY").addEventListener("click", function (e) {
  var b = e.target.closest ? e.target.closest("button[data-showy]") : null;
  if (!b) return;
  ddShowY = b.getAttribute("data-showy");
  $("segDDShowY").querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x === b); });
  ddPaintShow();
});
$("segDDSpot").addEventListener("click", function (e) {
  var b = e.target.closest ? e.target.closest("button[data-spot]") : null;
  if (!b) return;
  ddSpot = parseInt(b.getAttribute("data-spot"), 10) || 0;
  ddPaintSpot();
});

/* Round gridlines for any range: about four steps of 1, 2, 2.5 or 5 times a
   power of ten. A range too narrow to read is widened around its middle. */
function ddAxis(lo, hi){
  if (!(hi > lo)) { var c = hi || 1; lo = c - Math.abs(c) * .05 - 1; hi = c + Math.abs(c) * .05 + 1; }
  var raw = (hi - lo) / 4, mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
  var step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
  var min = Math.floor(lo / step + 1e-9) * step, max = Math.ceil(hi / step - 1e-9) * step, ticks = [];
  for (var v = min; v <= max + step / 2; v += step) ticks.push(Math.abs(v) < step / 1e6 ? 0 : v);
  return {min: min, max: max, ticks: ticks};
}
/* A scatter: one labeled dot per point. pts: {x, y, label, cur, miss}. */
function ddScatter(svgId, pts, opt){
  opt = opt || {};
  var svg = $(svgId), narrow = window.innerWidth < 640;
  var W = narrow ? 470 : 900, H = narrow ? 420 : 360, L = narrow ? 62 : 78, R = narrow ? 14 : 18, T = 14, B = narrow ? 48 : 42;
  var fs = narrow ? 14 : 11, sw = narrow ? 1.6 : 1, pw = W - L - R, ph = H - T - B;
  svg.setAttribute("viewBox", "0 0 " + W + " " + H);
  svg.innerHTML = "";
  var live = pts.filter(function (p) { return p.x != null && p.y != null && isFinite(p.x) && isFinite(p.y); });
  if (!live.length) return null;
  var xs = live.map(function (p) { return p.x; }), ys = live.map(function (p) { return p.y; });
  if (opt.vLine) xs.push(opt.vLine.x);
  if (opt.hLine) ys.push(opt.hLine.y);
  var xmin = opt.xMin != null ? opt.xMin : Math.min.apply(null, xs), xmax = Math.max.apply(null, xs);
  var pad = (xmax - xmin) * .06 || Math.abs(xmax) * .05 || 1;
  var AXx = ddAxis(opt.xMin != null ? opt.xMin : xmin - pad, xmax + pad);
  var ymin = Math.min.apply(null, ys), ymax = Math.max.apply(null, ys);
  var AXy = ddAxis(opt.yZero ? Math.min(0, ymin) : ymin - (ymax - ymin) * .08, ymax + (ymax - ymin) * .06);
  var X = function (v) { return L + (v - AXx.min) / ((AXx.max - AXx.min) || 1) * pw; };
  var Y = function (v) { return T + ph - (v - AXy.min) / ((AXy.max - AXy.min) || 1) * ph; };
  var text = function (x, y, t, at) {
    var e = svgEl("text", Object.assign({x: x, y: y, "font-size": fs, fill: cssVar("--axis"), "font-family": "ui-monospace,SF Mono,Menlo,monospace"}, at || {}));
    e.textContent = t; svg.appendChild(e); return e;
  };
  AXy.ticks.forEach(function (v) {
    svg.appendChild(svgEl("line", {x1: L, x2: W - R, y1: Y(v), y2: Y(v), stroke: cssVar("--grid"), "stroke-width": sw}));
    text(L - 8, Y(v) + fs / 3, (opt.yFmt || fmtNum)(v), {"text-anchor": "end"});
  });
  AXx.ticks.forEach(function (v) {
    svg.appendChild(svgEl("line", {x1: X(v), x2: X(v), y1: T, y2: T + ph, stroke: cssVar("--grid"), "stroke-width": sw * .7, opacity: .6}));
    text(X(v), T + ph + fs + 6, (opt.xFmt || fmtNum)(v), {"text-anchor": "middle"});
  });
  if (opt.xLabel) text(W - R, H - 4, opt.xLabel, {"text-anchor": "end", "font-size": fs * .9});
  if (opt.yLabel) text(L + 4, T + fs, opt.yLabel, {"font-size": fs * .9});
  if (opt.hLine) {
    svg.appendChild(svgEl("line", {x1: L, x2: W - R, y1: Y(opt.hLine.y), y2: Y(opt.hLine.y), stroke: "#e9b872", "stroke-width": 1.4 * sw, "stroke-dasharray": "6 5", opacity: .8}));
    text(W - R - 4, Y(opt.hLine.y) - 5, opt.hLine.label, {"text-anchor": "end", fill: "#e9b872", "font-size": fs * .9});
  }
  if (opt.vLine) {
    svg.appendChild(svgEl("line", {x1: X(opt.vLine.x), x2: X(opt.vLine.x), y1: T, y2: T + ph, stroke: "#e9b872", "stroke-width": 1.4 * sw, "stroke-dasharray": "6 5", opacity: .8}));
    text(X(opt.vLine.x) - 5, T + fs + 14, opt.vLine.label, {"text-anchor": "end", fill: "#e9b872", "font-size": fs * .9});
  }
  live.forEach(function (p) {
    p.px = X(p.x); p.py = Y(p.y);
    var color = p.cur ? "#e9b872" : p.miss ? "#e2795f" : (p.color || "#4fbf95");
    svg.appendChild(svgEl("circle", {cx: p.px, cy: p.py, r: (p.r || (opt.small ? 2.6 : p.cur ? 6.5 : 5)) * sw,
      fill: p.miss ? "none" : color, stroke: p.miss ? color : cssVar("--dotstroke"), "stroke-width": (p.miss ? 1.8 : 1.5) * sw,
      opacity: opt.small ? .55 : 1}));
  });
  // labels: each takes the first spot beside its dot (right, left, above,
  // below, then further out) that clears the labels already placed and the
  // dots; the current strategy's goes first
  var cw = fs * .58, boxes = [];
  live.forEach(function (p) { boxes.push({x0: p.px - 6, x1: p.px + 6, y0: p.py - 6, y1: p.py + 6}); });
  var clear = function (b) {
    if (b.x0 < L || b.x1 > W - R || b.y0 < T || b.y1 > T + ph) return false;
    for (var k = 0; k < boxes.length; k++) {
      var q = boxes[k];
      if (b.x0 < q.x1 && b.x1 > q.x0 && b.y0 < q.y1 && b.y1 > q.y0) return false;
    }
    return true;
  };
  live.slice().sort(function (a, b) { return (b.cur ? 1 : 0) - (a.cur ? 1 : 0); }).forEach(function (p) {
    if (!p.label) return;
    var w = p.label.length * cw, h = fs, g = 8 * sw, spot = null;
    var tries = [[g, -h / 2], [-g - w, -h / 2], [-w / 2, -g - h], [-w / 2, g], [g, -h * 1.6], [g, h * .6],
      [-g - w, -h * 1.6], [-g - w, h * .6], [-w / 2, -g - h * 2.2], [-w / 2, g + h * 1.2]];
    for (var k = 0; k < tries.length && !spot; k++) {
      var b = {x0: p.px + tries[k][0], y0: p.py + tries[k][1]};
      b.x1 = b.x0 + w; b.y1 = b.y0 + h;
      if (clear(b)) spot = b;
    }
    if (!spot) return;
    boxes.push(spot);
    text(spot.x0, spot.y1 - 2, p.label, {fill: p.cur ? "#e9b872" : cssVar("--dim"), "font-size": fs * .95,
      "font-weight": p.cur ? 600 : 400});
  });
  var ring = svgEl("circle", {r: 9 * sw, fill: "none", stroke: "#e9b872", "stroke-width": 1.6 * sw, opacity: 0});
  svg.appendChild(ring);
  return {pts: live, W: W, ring: ring};
}
/* Hover and touch for a scatter: the nearest dot within reach. */
function ddScatterTips(wrapId, svgId, tipId, getSt, html){
  var wrap = $(wrapId);
  var probe = function (cx, cy) {
    var st = getSt();
    if (!st) return;
    var box = $(svgId).getBoundingClientRect();
    if (!box.width) return;
    var k = st.W / box.width, vx = (cx - box.left) * k, vy = (cy - box.top) * k, best = null, bd = 1e9;
    st.pts.forEach(function (p) { var dd = (p.px - vx) * (p.px - vx) + (p.py - vy) * (p.py - vy); if (dd < bd) { bd = dd; best = p; } });
    if (!best || bd > 2500 * k * k) { clear(); return; }
    st.ring.setAttribute("cx", best.px); st.ring.setAttribute("cy", best.py); st.ring.setAttribute("opacity", 1);
    var tip = $(tipId);
    tip.innerHTML = html(best);
    tip.style.opacity = 1;
    var wb = wrap.getBoundingClientRect(), tw = tip.offsetWidth || 200, th = tip.offsetHeight || 80;
    var left = cx - wb.left + 16;
    if (left + tw > wb.width - 4) left = cx - wb.left - tw - 16;
    tip.style.left = Math.max(4, left) + "px";
    tip.style.top = Math.max(4, Math.min(cy - wb.top - th - 10, wb.height - th - 4)) + "px";
  };
  var clear = function () { $(tipId).style.opacity = 0; var st = getSt(); if (st) st.ring.setAttribute("opacity", 0); };
  wrap.addEventListener("mousemove", function (e) { probe(e.clientX, e.clientY); });
  wrap.addEventListener("mouseleave", clear);
  chartTouch(wrap, probe, clear);
}
ddScatterTips("chartWrapDDS", "chartDDS", "tipDDS", function () { return ddShowPts; }, function (p) {
  var x = ddShow && ddShow.res.list.filter(function (q) { return q.id === p.id; })[0];
  if (!x) return "";
  return "<b>" + escapeHtml(DD_UI[x.id].name) + "</b>" +
    (x.tuned ? "<br>" + ddDialText(x.id, x.dial, ddShow.o) : "") +
    "<br>Year one <span class='n'>" + money(x.first) + "</span>" +
    "<br>Typical lifetime <span class='n'>" + money(x.life) + "</span>" +
    "<br>Leanest year <span class='n'>" + money(x.low) + "</span>" +
    "<br>Typically left <span class='n'>" + money(x.end) + "</span>" +
    (x.met ? "" : "<br><span class='neg'>Closest it gets: " + pctStr(x.share, 0) + " of starts</span>");
});

/* ---- safe spending ---- */
var ddSafe = null, ddSafePts = null, ddValPts = null, ddHeatAxis = "stock", ddHeat = null;
function ddSafeRefresh(o, d, comfort, P){
  var T = ddTarget(o, d, comfort);
  var S = DD_STRAT[o.strategy];
  if (!S.dial) {
    ddSafe = null;
    $("ddSafeIntro").innerHTML = "<b>" + escapeHtml(DD_STRAT_NAMES[o.strategy]) + "</b> has no setting to turn: it always takes the share its formula gives. " +
      "Pick a strategy with a rate or a target to see the most it could have started with, or compare them all on the Compare strategies view.";
    $("chartDDR").innerHTML = ""; $("legendDDR").innerHTML = ""; $("ddSolve").hidden = true;
    $("ddHeatIntro").textContent = "The grid needs a strategy with a setting to turn.";
    $("ddHeat").innerHTML = ""; $("ddHeatNote").textContent = "";
    $("ddValIntro").textContent = "This needs a strategy with a setting to turn.";
    $("chartDDV").innerHTML = ""; $("legendDDV").innerHTML = ""; $("ddValNote").textContent = "";
    return;
  }
  $("ddSolve").hidden = false;
  $("ddSafeIntro").innerHTML = "<span class='ddwork'>Finding each start's edge…</span>";
  ddRun("safe", "safe", {o: o, T: T}, function (res) {
    ddSafe = {res: res, o: o, T: T, P: P};
    if (ddTab === "safe") ddPaintSafe();
  });
  $("ddHeatIntro").innerHTML = "<span class='ddwork'>Working out the grid…</span>";
  ddRun("heat", "heat", {o: o, T: T, axis: ddHeatAxis}, function (res) {
    ddHeat = {res: res, o: o, T: T};
    if (ddTab === "safe") ddPaintHeat();
  });
}
function ddRateOf(o, P){ var p = P || ddPrep(o); return p.initial > 0 ? ddFirstSpend(o, p) / p.initial : 0; }
function ddPaintSafe(){
  if (!ddSafe) return;
  var res = ddSafe.res, o = ddSafe.o, T = ddSafe.T, safe = res.safe || [], mine = ddRateOf(o, ddSafe.P);
  var monthly = !!o.monthly, lbl = function (w) { return (monthly ? HIST_MON[w.month - 1] + " " : "") + w.year; };
  var ok = safe.filter(function (w) { return w.rate != null; });
  var nameOf = DD_STRAT_NAMES[o.strategy];
  if (!ok.length) {
    $("ddSafeIntro").innerHTML = "Under this target, no setting of <b>" + escapeHtml(nameOf) + "</b> works for any start.";
    $("chartDDR").innerHTML = "";
  } else {
    var sorted = ok.slice().sort(function (a, b) { return a.rate - b.rate; });
    var worst = sorted[0], med = sorted[Math.floor(sorted.length / 2)];
    var short = safe.filter(function (w) { return w.rate == null || w.rate < mine - 1e-6; }).length;
    var capped = safe.filter(function (w) { return w.capped; }).length;
    $("ddSafeIntro").innerHTML = "For each " + (monthly ? "month" : "year") + " a retirement could have started, the highest year-one withdrawal, as a share of the portfolio, at which " +
      ddCritWords(T) + ", with the " + escapeHtml(nameOf) + " strategy and the rest of your plan. " +
      "The lowest, <b>" + pctStr(worst.rate, 2) + "</b>, was retiring in " + lbl(worst) + "; the typical start allowed <b>" + pctStr(med.rate, 2) + "</b>. " +
      "Your " + pctStr(mine, 2) + " " + (short ? "would have fallen short in <b>" + short + " of " + safe.length + "</b> starts." : "worked in every start.") +
      (capped ? " " + capped + " start" + (capped === 1 ? "" : "s") + " reached the top of the range tested: this strategy can't run out there." : "");
    var series = [{name: "Highest that worked", color: "#4fbf95", width: 2,
      pts: safe.map(function (w, i) { return {year: i, value: w.rate == null ? 0 : w.rate * 100}; })},
      {name: "Your year one", color: "#e9b872", dash: "6 5", width: 1.6,
      pts: [{year: 0, value: mine * 100}, {year: safe.length - 1, value: mine * 100}]}];
    ddSafePts = paintMulti("chartDDR", series, Math.max(1, safe.length - 1), {
      yFmt: function (v) { return fmtNum(v) + "%"; },
      xFmt: function (i) { var w = safe[Math.round(i)]; return w ? String(w.year) : ""; }});
    $("legendDDR").innerHTML = swatch("#4fbf95", "Highest year-one withdrawal that worked") + swatch("#e9b872", "Yours, " + pctStr(mine, 2));
  }
  // the solvers
  var dial = res.dial, port = res.port;
  var DK = DD_STRAT[o.strategy].dial.key;
  $("ddSolveDialK").textContent = DK === "initialPct" ? "Highest starting rate that meets the target"
    : DK === "rgTarget" ? "Lowest chance target that meets the target" : "Highest setting that meets the target";
  if (dial && dial.v != null) {
    $("ddSolveDial").textContent = ddDialText(o.strategy, dial.v, o);
    var x = ddWithDial(ddForTarget(o, T), dial.v);
    $("ddSolveDialN").innerHTML = (dial.met ? "Meets it: " + ddTargetWords(T) + "." : "Nothing meets it; this comes closest, in " + pctStr(dial.share, 0) + " of starts.") +
      " Year one: " + money(ddFirstSpend(x)) + (dial.capped ? ". That's the top of the range tested." : ".") +
      (T.crit === "comfort" && DD_STRAT[o.strategy].limits !== false ? " Held at " + money(Math.max(o.spendFloor || 0, T.comfort)) + " or more." : "");
    $("ddSolveDialUse").disabled = false;
  } else {
    $("ddSolveDial").textContent = "—";
    $("ddSolveDialN").textContent = "Nothing to find for this strategy.";
    $("ddSolveDialUse").disabled = true;
  }
  var spend = ddFirstSpend(o, ddSafe.P);
  $("ddSolvePortK").textContent = "Portfolio needed for " + money(spend) + " in year one";
  if (port && port.portfolio) {
    $("ddSolvePort").textContent = money(Math.ceil(port.portfolio / 1000) * 1000);
    $("ddSolvePortN").textContent = "A starting rate of " + pctStr(spend / (port.portfolio * (1 - (ddSafe.P.G.share || 0))), 2) +
      " meets it: " + ddTargetWords(T) + "." + (port.capped ? " Even a 15% rate does, the top of the range tested." : "");
    $("ddSolvePortUse").disabled = false;
  } else {
    $("ddSolvePort").textContent = "—";
    $("ddSolvePortN").textContent = !port ? "This strategy sets its own year one from the portfolio, so there's no spending amount to hold fixed."
      : "No portfolio size reaches the target with this spending: the rest of the plan rules it out.";
    $("ddSolvePortUse").disabled = true;
  }
  ddPaintVal();
}
attachChart("chartWrapDDR", "chartDDR", "tipDDR", function () { return ddSafePts; }, function (best) {
  if (!ddSafe) return "";
  var w = ddSafe.res.safe[Math.round(best.year)];
  if (!w) return "";
  return "<b>Retiring in " + (ddSafe.o.monthly ? HIST_MON[w.month - 1] + " " : "") + w.year + "</b>" +
    "<br><span style='color:#4fbf95'>Highest that worked</span> <span class='n'>" + (w.rate == null ? "none" : pctStr(w.rate, 2) + (w.capped ? "+" : "")) + "</span>" +
    "<br>CAPE at the start <span class='n'>" + w.cape.toFixed(1) + "</span>";
});
$("ddSolveDialUse").addEventListener("click", function () {
  if (!ddSafe || !ddSafe.res.dial || ddSafe.res.dial.v == null) return;
  var o = ddSafe.o, v = ddSafe.res.dial.v;
  ddApply(ddDialFields(o, o.strategy, v, ddSafe.T), "Set to " + ddDialText(o.strategy, v, o));
});
$("ddSolvePortUse").addEventListener("click", function () {
  if (!ddSafe || !ddSafe.res.port || !ddSafe.res.port.portfolio) return;
  var o = ddSafe.o, port = Math.ceil(ddSafe.res.port.portfolio / 1000) * 1000, spend = ddFirstSpend(o, ddSafe.P);
  var r = spend / (port * (1 - (ddSafe.P.G.share || 0))) * 100, f = {initial: port, rate: Math.round(r * 1e4) / 1e4};
  if (o.strategy === "yale" && o.initialPct > 0) f.yaleRate = Math.round(o.yaleRate * r / o.initialPct * 1e4) / 1e4;
  if (ddSafe.T.crit === "comfort" && DD_STRAT[o.strategy].limits !== false) f.spendFloor = Math.round(Math.max(o.spendFloor || 0, ddSafe.T.comfort));
  ddApply(f, "Portfolio set to " + money(port));
});

/* The success grid: each cell the share of starts meeting the target. */
function ddPaintHeat(){
  if (!ddHeat || !ddHeat.res) return;
  var h = ddHeat.res, o = ddHeat.o, T = ddHeat.T, id = o.strategy, D = DD_STRAT[id].dial;
  var colTitle = h.axis === "years" ? "Years in retirement" : "Stocks";
  var rowName = D.key === "initialPct" ? "Rate" : D.key === "rgTarget" ? "Target" : "Setting";
  var near = function (a, b) { return Math.abs(a - b) < 1e-6; };
  var curCol = h.axis === "years" ? o.years : (o.stockPctEnd == null ? o.stockPct : null);
  var under = false;
  var cell = function (s) {
    if (s == null) return "<td class='ddh-na'>—</td>";
    if (s < 0) { under = true; return "<td class='ddh-na ddh-under' title='Year one starts under your comfort line'>under</td>"; }
    var hue = s >= 1 ? 158 : s >= .95 ? 140 : s >= .9 ? 95 : s >= .8 ? 45 : s >= .7 ? 25 : 8;
    var a = .12 + .5 * Math.max(0, Math.min(1, s)) * (s >= .9 ? 1 : .8);
    return "<td style='background:hsla(" + hue + ",60%,48%," + a.toFixed(2) + ")'>" + (s >= 1 ? "100" : (s * 100).toFixed(0)) + "</td>";
  };
  var head = "<thead><tr><th>" + rowName + " \\ " + colTitle + "</th>" + h.cols.map(function (c) {
    return "<th" + (curCol != null && near(c, curCol) ? " class='ddh-cur'" : "") + ">" + c + (h.axis === "years" ? "" : "%") + "</th>";
  }).join("") + "</tr></thead>";
  var body = "<tbody>" + h.rows.map(function (v, i) {
    var cur = near(v, h.cur);
    return "<tr" + (cur ? " class='ddh-cur'" : "") + "><th>" + ddDialText(id, v, o).replace(/ start$/, "") + "</th>" + h.grid[i].map(function (s, j) {
      return cell(s).replace("<td", "<td data-hr='" + i + "' data-hc='" + j + "'" + (cur && curCol != null && near(h.cols[j], curCol) ? " class='ddh-me'" : ""));
    }).join("") + "</tr>";
  }).join("") + "</tbody>";
  $("ddHeat").innerHTML = head + body;
  $("ddHeatIntro").innerHTML = "The share of historical starts, in percent, where " +
    ddCritWords(T) +
    ", for " + escapeHtml(DD_STRAT_NAMES[id]) + " at settings around yours (rows) and " + (h.axis === "years" ? "retirements of different lengths" : "different stock shares") +
    " (columns). Tap a cell to use it.";
  $("ddHeatNote").textContent = (under ? "“Under”: a fixed amount at that rate starts below your comfort line, so it can't meet it in any start. " : "") +
    (h.axis === "stock" && o.stockPctEnd != null ? "Your glide path is set aside here: each column holds its stock share the whole way." : "");
}
$("ddHeat").addEventListener("click", function (e) {
  var td = e.target.closest ? e.target.closest("td[data-hr]") : null;
  if (!td || !ddHeat) return;
  var h = ddHeat.res, o = ddHeat.o, v = h.rows[+td.getAttribute("data-hr")], c = h.cols[+td.getAttribute("data-hc")];
  var f = ddDialFields(o, o.strategy, v, ddHeat.T);
  if (h.axis === "years") f.years = c; else { f.stock = c; f.stockEnd = ""; }
  ddApply(f, "Using " + ddDialText(o.strategy, v, o) + (h.axis === "years" ? ", " + c + " years" : ", " + c + "% stocks"));
});
$("segDDHeat").addEventListener("click", function (e) {
  var b = e.target.closest ? e.target.closest("button[data-heat]") : null;
  if (!b) return;
  ddHeatAxis = b.getAttribute("data-heat");
  $("segDDHeat").querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x === b); });
  renderDrawdown();
});

/* Valuations: each start's CAPE against the most it could have started
   with, and where today's market sits. */
function ddPaintVal(){
  if (!ddSafe) return;
  var safe = (ddSafe.res.safe || []).filter(function (w) { return w.rate != null; }), o = ddSafe.o;
  if (!safe.length) { $("chartDDV").innerHTML = ""; $("ddValIntro").textContent = ""; return; }
  var mine = ddRateOf(o, ddSafe.P), monthly = !!o.monthly;
  ddValPts = ddScatter("chartDDV", safe.map(function (w) {
    return {x: w.cape, y: w.rate * 100, w: w, color: w.rate < mine - 1e-6 ? "#e2795f" : "#4fbf95"};
  }), {small: safe.length > 150, xMin: 0, yZero: true, xFmt: function (v) { return fmtNum(v); }, yFmt: function (v) { return fmtNum(v) + "%"; },
    xLabel: "CAPE at the start →", yLabel: "Highest year one that worked",
    vLine: {x: CAPE_NOW, label: "today, " + CAPE_NOW.toFixed(1)}, hLine: {y: mine * 100, label: "yours, " + pctStr(mine, 2)}});
  $("legendDDV").innerHTML = swatch("#4fbf95", "A start your year one would have survived") + swatch("#e2795f", "One it wouldn't");
  var maxCape = Math.max.apply(null, safe.map(function (w) { return w.cape; }));
  var hiStarts = safe.filter(function (w) { return w.cape >= 25; });
  var loStarts = safe.filter(function (w) { return w.cape < 15; });
  var medOf = function (a) { var x = a.map(function (w) { return w.rate; }).sort(function (p, q) { return p - q; }); return x[Math.floor(x.length / 2)]; };
  var minOf = function (a) { return Math.min.apply(null, a.map(function (w) { return w.rate; })); };
  var unit = monthly ? "starting months" : "starts";
  $("ddValIntro").innerHTML = "Shiller's CAPE is the stock market's price over ten years of its earnings, after inflation: high means stocks were dear. " +
    (hiStarts.length === 1 ? "The one start at a CAPE of 25 or more, " + (monthly ? HIST_MON[hiStarts[0].month - 1] + " " : "") + hiStarts[0].year +
      ", allowed <b>" + pctStr(hiStarts[0].rate, 2) + "</b>, " :
     hiStarts.length ? "The " + hiStarts.length + " " + unit + " at a CAPE of 25 or more allowed a typical <b>" + pctStr(medOf(hiStarts), 2) +
      "</b> (the lowest " + pctStr(minOf(hiStarts), 2) + "), " : "") +
    (loStarts.length ? "against <b>" + pctStr(medOf(loStarts), 2) + "</b> for the " + loStarts.length + " below 15. " : "") +
    "Today's CAPE is <b>" + CAPE_NOW.toFixed(1) + "</b> (" + CAPE_NOW_ASOF + ")" +
    (CAPE_NOW > maxCape ? ", higher than at any start with a full " + fmtNum(o.years) + " years of history after it, so the record has no direct match." : ".");
  $("ddValNote").textContent = "Expensive starts have tended to allow less, but the link is loose: this is what history did, not a forecast. The CAPE-based strategy uses this reading every year.";
}
ddScatterTips("chartWrapDDV", "chartDDV", "tipDDV", function () { return ddValPts; }, function (p) {
  var w = p.w;
  return "<b>Retiring in " + (ddSafe && ddSafe.o.monthly ? HIST_MON[w.month - 1] + " " : "") + w.year + "</b>" +
    "<br>CAPE <span class='n'>" + w.cape.toFixed(1) + "</span><br>Highest year one <span class='n'>" + pctStr(w.rate, 2) + "</span>";
});

/* After every run: the target words, and whichever of the search views is
   showing gets fresh numbers. */
function ddViewsRefresh(o, d, P, comfort){
  var T = ddTarget(o, d, comfort);
  $("ddTargetNote").innerHTML = "Comfort line: <b>" + money(comfort) + "</b> a year" + (o.comfort > 0 ? "" : " (set your own with Comfort line, in the inputs)") + ". " +
    "These views use the historical record" + (ddMode === "mc" ? ", whatever the Historical / Monte Carlo switch says" : "") +
    ", " + (o.monthly ? "a retirement starting every month" : "a retirement starting each January") + " from " + o.fromYear + ".";
  if (!(o.initial > 0)) return;
  if (ddTab === "compare") ddShowRefresh(o, d, comfort);
  else if (ddTab === "safe") ddSafeRefresh(o, d, comfort, P);
}
