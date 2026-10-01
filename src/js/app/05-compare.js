/* ---------- compare scenarios ---------- */
/* Read-only by design: every figure here comes from a saved scenario, run
   through the same engines the tabs use, and nothing written back. */
const CMP_LETTERS = ["A", "B", "C"];
const CMP_MODE_LABEL = {basic:"Basic", advanced:"Advanced", stages:"Stages"};
let cmpSlots = [{name:"", mode:"advanced"}, {name:"", mode:"advanced"},
                {name:"", mode:"advanced"}];
let cmpPoints = null;
let cmpPrevTab = "single";
const CMP_HELP = "Comparison reads saved scenarios only, exactly as they were " +
  "saved. Nothing here changes the numbers on the Basic, Advanced or Stages tabs.";

function cmpFmt(n, kind){
  if (n == null || !isFinite(n)) return "\u2014";
  if (kind === "pct") return pctStr(n, 2);
  if (kind === "years") return fmtYears(n);
  if (kind === "int") return fmtNum(n);
  if (kind === "money2") return money(n, 2);
  return money(n);
}
function cmpDelta(a, b, kind){
  if (a == null || b == null || !isFinite(a) || !isFinite(b)) return null;
  const d = b - a;
  if (Math.abs(d) < 1e-9) return {t:"\u2014", cls:""};
  const body = kind === "pct" ? pctStr(Math.abs(d), 2)
             : kind === "years" ? fmtYears(Math.abs(d))
             : kind === "int" ? fmtNum(Math.abs(d))
             : money(Math.abs(d), kind === "money2" ? 2 : 0);
  return {t:(d > 0 ? "+" : "\u2212") + body, cls:(d > 0 ? "pos" : "neg")};
}
const mrow = (k, n, kind) => ({k, n, kind: kind || "money"});

/* One saved scenario's data (already the unwrapped payload for its own
   mode \u2014 SC.basic/advanced/stages entries no longer share one bundle),
   returned as a chart path plus two labeled row sets. */
function cmpRun(data, mode){
  if (!data) return null;
  if (mode === "basic"){
    const b = data;
    const years = Math.min(100, Math.max(0, (b.retire || 0) - (b.age || 0)));
    const period = b.period || "Monthly";
    const p = {years, real: b.risk || 0, initial: b.saved || 0,
               contrib: b.contrib || 0, period, withdrawal:.04};
    if (!(years > 0)) return null;
    const R = projectBasic(p);
    return {
      years,
      pts: [{year:0, value:p.initial}].concat(
             R.years.map(y => ({year:y.year, value:y.end}))),
      out: [mrow("Value at retirement", R.fv),
            mrow("Income, per year (4%)", R.fv * .04),
            mrow("Income, per month", R.fv * .04 / 12),
            mrow("You put in", R.contribTotal),
            mrow("Growth adds", R.growth),
            mrow("Years saving", years, "years")],
      inp: [["Age today", fmtNum(b.age || 0)],
            ["Retirement age", fmtNum(b.retire || 0)],
            ["Starting balance", money(b.saved || 0)],
            ["Contribution", money(b.contrib || 0, 2) + " " + PERIOD_ADV[period]],
            ["Growth after inflation", pctStr(b.risk || 0, 2)]]
    };
  }
  if (mode === "stages"){
    const g = data.globals;
    const list = Array.isArray(data.stages) ? data.stages : [];
    if (!g || !list.length) return null;
    const R = projectSeries(g, effectiveStagesFrom(g, list));
    if (!R.rows.length) return null;
    const defl = yr => Math.pow(1 + g.inflation, yr);
    const inp = [["Starting value", money(g.initial)],
                 ["Inflation", pctStr(g.inflation, 2)],
                 ["Withdrawal rate", pctStr(g.withdrawal, 2)],
                 ["Effective tax rate", pctStr(g.taxRate, 2)],
                 ["Fees", pctStr(g.fees || 0, 2)]];
    list.forEach((st, i) => {
      const nm = st.name || ("Stage " + (i + 1));
      inp.push([nm + " \u00b7 years", fmtNum(st.years)]);
      inp.push([nm + " \u00b7 contribution",
                money(st.contrib, 2) + " " + PERIOD_ADV[st.period]]);
      inp.push([nm + " \u00b7 contribution growth", pctStr(st.growth || 0, 2)]);
      inp.push([nm + " \u00b7 rate of return", pctStr(st.nominal, 2)]);
    });
    return {
      years: R.totalYears,
      pts: [{year:0, value:g.initial}].concat(
             R.rows.map(r => ({year:r.endYear, value:r.end / defl(r.endYear)}))),
      out: [mrow("Future value", R.fv),
            mrow("Inflation adjusted", R.fvReal),
            mrow("After-tax income, per year", R.afterTax),
            mrow("After-tax income, per month", R.afterTaxMo),
            mrow("Amount invested", R.invested),
            mrow("Growth", R.growth),
            mrow("Total contributions", R.contribTotal),
            mrow("Final contribution, inflation adj.", R.lastContribReal),
            mrow("Total years", R.totalYears, "years"),
            mrow("Stages", list.length, "int")],
      inp
    };
  }
  const p = data;
  if (!(p.years > 0)) return null;
  const R = project(p);
  const defl = yr => Math.pow(1 + p.inflation, yr);
  const inp = [["Starting value", money(p.initial || 0)],
               ["Contribution", money(p.contrib || 0, 2) + " " + PERIOD_ADV[p.period]],
               ["Contribution growth", pctStr(p.growth || 0, 2)],
               ["Time period", fmtYears(p.years)],
               ["Rate of return", pctStr(p.gross == null ? p.nominal : p.gross, 2)],
               ["Fees", pctStr(p.fees || 0, 2)],
               ["Return net of fees", pctStr(p.nominal, 2)],
               ["Inflation", pctStr(p.inflation, 2)],
               ["Withdrawal rate", pctStr(p.withdrawal, 2)],
               ["Effective tax rate", pctStr(p.taxRate, 2)]];
  if (p.glide && p.glide.on)
    inp.push(["Glide", pctStr(p.glide.endRate, 2) + " over the final " +
                       fmtYears(p.glide.years)]);
  return {
    years: p.years,
    pts: [{year:0, value:p.initial}].concat(
           R.years.map(y => ({year:y.year, value:y.end / defl(y.year)}))),
    out: [mrow("Future value", R.fv),
          mrow("Inflation adjusted", R.fvReal),
          mrow("After-tax income, per year", R.afterTax),
          mrow("After-tax income, per month", R.afterTaxMo),
          mrow("Amount invested", R.invested),
          mrow("Growth", R.growth),
          mrow("Total contributions", R.contribTotal),
          mrow("Final contribution, inflation adj.", R.lastContribReal)],
    inp
  };
}

function buildComparePickers(){
  const total = SC.basic.length + SC.advanced.length + SC.stages.length;
  const host = $("cmpPickers");
  const panels = ["cmpChartPanel", "cmpOutPanel", "cmpInPanel"];
  if (total < 2){
    $("cmpEmpty").hidden = false;
    $("cmpEmpty").innerHTML = "You have " +
      (total ? "one saved scenario" : "no saved scenarios") +
      ". Compare needs at least two: set up a plan on Basic, Advanced or Stages, " +
      "save it with Save/Delete in the bar above, then change it and save again.";
    host.innerHTML = "";
    panels.forEach(id => { $(id).hidden = true; });
    $("cmpHelp").hidden = true;
    return false;
  }
  $("cmpEmpty").hidden = true;
  $("cmpHelp").hidden = false;
  panels.forEach(id => { $(id).hidden = false; });
  host.innerHTML = cmpSlots.map((sl, i) => {
    const list = SC[sl.mode] || [];
    const opts = (i === 2 ? "<option value=''>None</option>" : "") +
      list.map(x => "<option" + (x.name === sl.name ? " selected" : "") + ">" +
                    escapeHtml(x.name) + "</option>").join("");
    const modes = ["basic","advanced","stages"].map(m =>
      "<option value='" + m + "'" + (m === sl.mode ? " selected" : "") + ">" +
      CMP_MODE_LABEL[m] + "</option>").join("");
    return "<div class='cmpslot'>" +
      "<div class='cmpkey'><i style='background:" + MULTI_COLORS[i] + "'></i>" +
        CMP_LETTERS[i] + "</div>" +
      "<div class='field'><select data-cmp='" + i + "' aria-label='Scenario " +
        CMP_LETTERS[i] + "'>" + opts + "</select></div>" +
      "<div class='field'><select data-cmpmode='" + i + "' aria-label='Scenario " +
        CMP_LETTERS[i] + " mode'>" + modes + "</select></div>" +
    "</div>";
  }).join("");
  return true;
}

function renderCompare(){
  const all = cmpSlots.map((sl, i) => {
    const list = SC[sl.mode] || [];
    const sc = sl.name ? list.find(x => x.name === sl.name) : null;
    return {i, name: sl.name, mode: sl.mode, sc, run: cmpRun(sc ? sc.data : null, sl.mode)};
  });
  const slots = all.filter(x => x.run);
  const blank = all.filter(x => x.name && !x.run);
  $("cmpHelp").innerHTML = CMP_HELP + (blank.length
    ? " <b>" + blank.map(x => escapeHtml(x.name) + " has nothing saved for " +
        CMP_MODE_LABEL[x.mode]).join("; ") + ".</b>" : "");

  if (!slots.length){
    cmpPoints = paintMulti("chartC", [], 1);
    $("legendC").innerHTML = "";
    $("cmpOutTable").querySelector("thead").innerHTML = "";
    $("cmpOutTable").querySelector("tbody").innerHTML = "";
    $("cmpInTable").querySelector("thead").innerHTML = "";
    $("cmpInTable").querySelector("tbody").innerHTML = "";
    return;
  }

  /* chart */
  const maxX = Math.max.apply(null, slots.map(x => x.run.years)) || 1;
  cmpPoints = paintMulti("chartC", slots.map(x => ({
    name: x.name, color: MULTI_COLORS[x.i], pts: x.run.pts})), maxX);
  $("legendC").innerHTML = slots.map(x =>
    swatch(MULTI_COLORS[x.i], escapeHtml(x.name) + " \u00b7 " +
           CMP_MODE_LABEL[x.mode])).join("");

  /* results, with a difference column against the first scenario */
  const labels = [], kinds = {};
  slots.forEach(x => x.run.out.forEach(r => {
    if (labels.indexOf(r.k) < 0){ labels.push(r.k); kinds[r.k] = r.kind; }
  }));
  const valOf = (x, k) => {
    const hit = x.run.out.find(r => r.k === k);
    return hit ? hit.n : null;
  };
  const head = ["<th>Result</th>"].concat(slots.map(x =>
    "<th>" + CMP_LETTERS[x.i] + " \u00b7 " + escapeHtml(x.name) + "</th>"));
  slots.slice(1).forEach(x => head.push("<th>" + CMP_LETTERS[x.i] + " \u2212 " +
    CMP_LETTERS[slots[0].i] + "</th>"));
  $("cmpOutTable").querySelector("thead").innerHTML = "<tr>" + head.join("") + "</tr>";
  $("cmpOutTable").querySelector("tbody").innerHTML = labels.map(k => {
    const kind = kinds[k];
    let tr = "<tr><td>" + k + "</td>";
    slots.forEach(x => {
      const v = valOf(x, k);
      tr += "<td" + (v == null ? " class='cmpna'" : "") + ">" + cmpFmt(v, kind) + "</td>";
    });
    slots.slice(1).forEach(x => {
      const d = cmpDelta(valOf(slots[0], k), valOf(x, k), kind);
      tr += d ? "<td class='" + d.cls + "'>" + d.t + "</td>"
              : "<td class='cmpna'>\u2014</td>";
    });
    return tr + "</tr>";
  }).join("");

  /* inputs, every row either side used, differences flagged */
  const ilabels = [];
  slots.forEach(x => x.run.inp.forEach(r => {
    if (ilabels.indexOf(r[0]) < 0) ilabels.push(r[0]);
  }));
  $("cmpInTable").querySelector("thead").innerHTML = "<tr><th>Input</th>" +
    slots.map(x => "<th>" + CMP_LETTERS[x.i] + " \u00b7 " +
      escapeHtml(x.name) + "</th>").join("") + "</tr>";
  $("cmpInTable").querySelector("tbody").innerHTML = ilabels.map(k => {
    const cells = slots.map(x => {
      const hit = x.run.inp.find(r => r[0] === k);
      return hit ? hit[1] : null;
    });
    const seen = [];
    cells.forEach(c => { if (seen.indexOf(String(c)) < 0) seen.push(String(c)); });
    const diff = seen.length > 1;
    return "<tr" + (diff ? " class='cmpdiff'" : "") + "><td>" + k + "</td>" +
      cells.map(c => "<td" + (c == null ? " class='cmpna'" : "") + ">" +
        (c == null ? "\u2014" : c) + "</td>").join("") + "</tr>";
  }).join("");
}

$("cmpPickers").addEventListener("change", e => {
  const el = e.target;
  const i = el.getAttribute("data-cmp");
  const j = el.getAttribute("data-cmpmode");
  if (i != null){
    cmpSlots[+i].name = el.value;
    renderCompare();
    return;
  }
  if (j != null){
    cmpSlots[+j].mode = el.value;
    const list = SC[el.value] || [];
    if (!list.find(x => x.name === cmpSlots[+j].name)) cmpSlots[+j].name = "";
    // The mode change swaps which list the name dropdown reads from, so its
    // options have to be rebuilt \u2014 renderCompare() alone only redraws results.
    buildComparePickers();
    renderCompare();
  }
});

function showCompare(){
  if (chartMode.tab === "compare") return;
  cmpPrevTab = chartMode.tab;
  hhPlace("compare");
  const m = activeTool();
  const dflt = (m === "basic" || m === "stages") ? m : "advanced";
  const names = (SC[dflt] || []).map(x => x.name);
  cmpSlots.forEach(sl => { sl.mode = dflt; });
  if (names.indexOf(cmpSlots[0].name) < 0) cmpSlots[0].name = names[0] || "";
  if (names.indexOf(cmpSlots[1].name) < 0 || cmpSlots[1].name === cmpSlots[0].name){
    let pick = "";
    for (let i = 0; i < names.length; i++)
      if (names[i] !== cmpSlots[0].name){ pick = names[i]; break; }
    cmpSlots[1].name = pick;
  }
  if (names.indexOf(cmpSlots[2].name) < 0) cmpSlots[2].name = "";

  chartMode.tab = "compare";
  Array.prototype.forEach.call(
    document.querySelectorAll("#main > .stack, #main > aside"),
    el => { el.hidden = true; });
  setToolBack("picker");
  $("tab-compare").hidden = false;
  $("main").classList.add("solo");
  refreshScenarioList(currentScenario[activeTool()] || "");
  if (buildComparePickers()) renderCompare();
  initCSVButtons();
  try { window.scrollTo({top:0, behavior:"auto"}); } catch(e){ window.scrollTo(0, 0); }
  playPaneEnter();
}
$("cmpBack").addEventListener("click", () => {
  paneDir = "back";
  const t = (cmpPrevTab === "compare" || !cmpPrevTab) ? "single" : cmpPrevTab;
  showTab(t);
  pushNav();
});
attachChart("chartWrapC", "chartC", "tipC", () => cmpPoints, best => {
  const st = cmpPoints;
  if (!st) return "";
  let out = "<b>Year " + fmtNum(best.year) + "</b>";
  st.names.forEach((nm, i) => {
    if (best.vals[i] == null) return;
    out += "<br><span style='color:" + st.colors[i] + "'>" + escapeHtml(nm) +
      "</span> <span class='n'>" + money(best.vals[i]) + "</span>";
  });
  return out;
});

/* ========== Drawdown Strategy Comparison ========== */

/* A saved scenario's options, read exactly as the simulator reads its own
   fields, so a scenario compares as it ran. */
function ddStateToOpts(data) { return ddOptsFromState(data); }

var ddCmpSlots = [{name:""}, {name:""}, {name:""}];
var ddCmpPrevTab = "single";
var ddCmpPoints = null;

function buildDDComparePickers() {
  var total = SC.drawdown.length;
  var host = $("ddCmpPickers");
  var panels = ["ddCmpChartPanel", "ddCmpOutPanel"];
  if (total < 2) {
    $("ddCmpEmpty").hidden = false;
    $("ddCmpEmpty").innerHTML = "You have " + (total ? "one saved scenario" : "no saved scenarios") +
      ". Save at least two Drawdown scenarios from the bar above, then come back to compare.";
    host.innerHTML = "";
    panels.forEach(function(id) { $(id).hidden = true; });
    $("ddCmpHelp").hidden = true;
    return false;
  }
  $("ddCmpEmpty").hidden = true;
  $("ddCmpHelp").hidden = false;
  panels.forEach(function(id) { $(id).hidden = false; });
  var list = SC.drawdown;
  host.innerHTML = ddCmpSlots.map(function(sl, i) {
    var opts = (i === 2 ? "<option value=''>None</option>" : "") +
      list.map(function(x) {
        return "<option" + (x.name === sl.name ? " selected" : "") + ">" + escapeHtml(x.name) + "</option>";
      }).join("");
    return "<div class='cmpslot'>" +
      "<div class='cmpkey'><i style='background:" + MULTI_COLORS[i] + "'></i>" + CMP_LETTERS[i] + "</div>" +
      "<div class='field'><select data-ddcmp='" + i + "' aria-label='Scenario " + CMP_LETTERS[i] + "'>" + opts + "</select></div>" +
      "</div>";
  }).join("");
  return true;
}

function renderDDCompare() {
  var all = ddCmpSlots.map(function(sl, i) {
    var sc = sl.name ? SC.drawdown.find(function(x) { return x.name === sl.name; }) : null;
    if (!sc) return {i:i, name:sl.name, H:null};
    var o = ddStateToOpts(sc.data);
    if (!(o.initial > 0) || !(o.years > 0)) return {i:i, name:sl.name, H:null};
    var H = historicalBacktest(o);
    if (!H.total) return {i:i, name:sl.name, H:null};
    var medPts = [{year:0, value:o.initial}];
    for (var y = 1; y <= o.years; y++) {
      var vals = H.runs.map(function(r) { return r.rows[y-1] ? r.rows[y-1].realEnd : 0; }).sort(function(a,b){return a-b;});
      medPts.push({year:y, value:vals[Math.floor(vals.length * 0.5)] || 0});
    }
    return {i:i, name:sl.name, o:o, H:H, medPts:medPts};
  });
  var slots = all.filter(function(x) { return x.H; });
  if (!slots.length) {
    ddCmpPoints = paintMulti("chartDDC", [], 1);
    $("legendDDC").innerHTML = "";
    $("ddCmpOutTable").querySelector("thead").innerHTML = "";
    $("ddCmpOutTable").querySelector("tbody").innerHTML = "";
    return;
  }
  var maxX = Math.max.apply(null, slots.map(function(x) { return x.o.years; })) || 1;
  ddCmpPoints = paintMulti("chartDDC", slots.map(function(x) {
    return {name:x.name, color:MULTI_COLORS[x.i], pts:x.medPts};
  }), maxX);
  $("legendDDC").innerHTML = slots.map(function(x) { return swatch(MULTI_COLORS[x.i], escapeHtml(x.name)); }).join("");
  var head = ["<th>Result</th>"].concat(slots.map(function(x) {
    return "<th>" + CMP_LETTERS[x.i] + " · " + escapeHtml(x.name) + "</th>";
  }));
  $("ddCmpOutTable").querySelector("thead").innerHTML = "<tr>" + head.join("") + "</tr>";

  $("ddCmpOutTable").querySelector("tbody").innerHTML = [
    {k:"Strategy", fn:function(x){return DD_STRAT_NAMES[x.o.strategy]||x.o.strategy;}},
    {k:"Withdrawal rate", fn:function(x){return x.o.strategy === "vpw"
      ? "VPW at " + (x.o.vpwRate || 0).toFixed(2) + "% real" : x.o.initialPct.toFixed(1)+"%";}},
    {k:"Asset mix", fn:function(x){return ddMixText(x.o);}},
    {k:"Periods tested", fn:function(x){return x.H.total+"";}},
    {k:"Success rate", fn:function(x){return "<span class='"+(x.H.successRate>=0.95?"pos":x.H.successRate>=0.85?"gold":"neg")+"'>"+pctStr(x.H.successRate,1)+"</span>";}},
    {k:"Median ending balance", fn:function(x){return money(x.H.medianEnd);}},
    {k:"Worst case", fn:function(x){return money(x.H.worstEnd);}},
    {k:"Failure years", fn:function(x){return x.H.failYears.length?x.H.failYears.slice(0,5).join(", ")+(x.H.failYears.length>5?"…":""):"None";}}
  ].map(function(r) {
    return "<tr><td>" + r.k + "</td>" + slots.map(function(x){ return "<td>" + r.fn(x) + "</td>"; }).join("") + "</tr>";
  }).join("");
}

function showDDCompare() {
  if (chartMode.tab === "dd-compare") return;
  ddCmpPrevTab = chartMode.tab;
  hhPlace("compare");
  var names = SC.drawdown.map(function(x) { return x.name; });
  if (names.indexOf(ddCmpSlots[0].name) < 0) ddCmpSlots[0].name = names[0] || "";
  if (names.indexOf(ddCmpSlots[1].name) < 0 || ddCmpSlots[1].name === ddCmpSlots[0].name) {
    var pick = "";
    for (var i = 0; i < names.length; i++)
      if (names[i] !== ddCmpSlots[0].name) { pick = names[i]; break; }
    ddCmpSlots[1].name = pick;
  }
  if (names.indexOf(ddCmpSlots[2].name) < 0) ddCmpSlots[2].name = "";
  chartMode.tab = "dd-compare";
  Array.prototype.forEach.call(
    document.querySelectorAll("#main > .stack, #main > aside"),
    function(el) { el.hidden = true; });
  setToolBack("picker");
  $("tab-dd-compare").hidden = false;
  $("main").classList.add("solo");
  refreshScenarioList(currentScenario[activeTool()] || "");
  if (buildDDComparePickers()) renderDDCompare();
  initCSVButtons();
  try { window.scrollTo({top:0, behavior:"auto"}); } catch(e){ window.scrollTo(0, 0); }
  playPaneEnter();
}
$("ddCmpBack").addEventListener("click", function() {
  paneDir = "back";
  var t = (ddCmpPrevTab === "dd-compare" || !ddCmpPrevTab) ? "single" : ddCmpPrevTab;
  showTab(t);
  pushNav();
});
$("ddCmpPickers").addEventListener("change", function(e) {
  var el = e.target;
  var i = el.getAttribute("data-ddcmp");
  if (i != null) { ddCmpSlots[+i].name = el.value; renderDDCompare(); }
});
attachChart("chartWrapDDC", "chartDDC", "tipDDC", function(){ return ddCmpPoints; }, function(best) {
  var st = ddCmpPoints;
  if (!st) return "";
  var out = "<b>Year " + fmtNum(best.year) + "</b>";
  st.names.forEach(function(nm, i) {
    if (best.vals[i] == null) return;
    out += "<br><span style='color:" + st.colors[i] + "'>" + escapeHtml(nm) +
      "</span> <span class='n'>" + money(best.vals[i]) + "</span>";
  });
  return out;
});


