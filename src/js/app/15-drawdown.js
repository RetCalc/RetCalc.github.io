/* ---------- drawdown UI ---------- */
var ddPoints = [];
var ddMode = "hist";
/* The start shown in detail, as its first month: 0 is January 1926. */
var ddSelStart = null;
var ddView = "all";
var ddSortCol = "year";
var ddSortDir = "asc";
/* The latest historical test, for the summary sheet and the table clicks. */
var ddLastH = null;

/* Retirement age, refreshed at the top of every renderDrawdown() call. Null
   when the optional "Age at retirement" field is blank, in which case every
   table/chart in this tool falls back to its original years-into-retirement
   display exactly as before this feature existed. */
var ddRetireAge = null;

/* yearIdx is a 1-based year of retirement (matches CustomItem.startYear and
   runDrawdown's depletedYear/row numbering). Returns the age lived through
   during that year when ddRetireAge is set, else just the year number back. */
function ddAgeVal(yearIdx) {
  return ddRetireAge != null ? (ddRetireAge + yearIdx - 1) : yearIdx;
}
/* Same, but for the point-in-time x-axis used by the balance/fan chart,
   where 0 is the moment of retirement itself (before any withdrawal). */
function ddAgeValPoint(pointYear) {
  return ddRetireAge != null ? (ddRetireAge + pointYear) : pointYear;
}
function ddOutcomeText(r) {
  if (!r.depleted) return "Survived";
  return ddRetireAge != null ? ("Ran out at age " + ddAgeVal(r.depletedYear))
                              : ("Ran out in year " + r.depletedYear);
}
/* A setting as words would write it: 0.5, 33.7, 2.25, 90, no padding. */
function ddN(v){ return String(+(Math.round(v * 100) / 100)); }
/* When a retirement began: the year, or with a start every month, the month
   too. */
function ddStartLabel(r, monthly) {
  if (r.startMonth == null) return String(r.startYear);
  return monthly || r.startMonth !== 1 ? HIST_MON[r.startMonth - 1] + " " + r.startYear : String(r.startYear);
}

/* Value used to compare two starting-year runs for a given sortable column. */
function ddSortValue(r, col) {
  switch (col) {
    case "outcome": return ddOutcomeText(r);
    case "end": return r.endReal;
    case "med": return r.medRealSpend;
    case "low": return r.minRealSpend;
    case "stock": return r.avgStock;
    case "bond": return r.avgBond;
    case "infl": return r.avgInfl;
    case "cape": return r.cape0;
    default: return r.startIdx;
  }
}
var ddIncomeChartAgg = false;
/* Each strategy as the page names it and shows it. The engine's catalog
   (DD_STRAT in drawdown.js) has its rule and dial; this has its words: its
   name, a short name for charts, a one-line description, the label of its
   rate field (none if it has no rate), the saved field its dial lives in,
   and the groups of fields it shows. */
var DD_FAMILY = {steady: "Steady income", share: "Share of the portfolio", guard: "Guardrails",
  smooth: "Smoothed", value: "Valuation"};
var DD_UI = {
  fixed:     {name:"Fixed amount, rising with inflation", short:"Fixed", card:"Fixed amount", dial:"rate",
              rate:"Starting withdrawal rate", blocks:["ddSkipWrap"],
              blurb:"The 4% rule's way: year one's amount, then the same plus inflation, whatever markets do."},
  kitces:    {name:"Kitces ratchet", short:"Ratchet", dial:"rate", rate:"Starting withdrawal rate", blocks:["ddKitWrap", "ddSkipWrap"],
              blurb:"Fixed spending that never falls, stepped up after strong markets."},
  pct:       {name:"Fixed % of portfolio each year", short:"Fixed %", card:"% of portfolio", dial:"rate",
              rate:"Percentage taken each year", blocks:[],
              blurb:"The same share of the portfolio every year: it can't run out, but spending swings with markets."},
  clyatt:    {name:"95% rule", short:"95% rule", dial:"rate", rate:"Percentage taken each year", blocks:["ddClyWrap"],
              blurb:"A share of the portfolio, but never under 95% of last year's spending."},
  oneovern:  {name:"1/N: the balance over the years left", short:"1/N", card:"1/N", blocks:[],
              blurb:"The balance divided by the years left, so it spends everything by the end."},
  rmd:       {name:"RMD method", short:"RMD method", blocks:[],
              blurb:"The balance divided by the IRS life-expectancy divisor for your age, as required distributions work."},
  vpw:       {name:"Variable percentage withdrawal (VPW)", short:"VPW", card:"Variable percentage (VPW)", dial:"vpwRate",
              blocks:["ddVpwWrap", "ddVpwNote"],
              blurb:"The Bogleheads method: an annuity-style payment on what's left, worked out again each year."},
  guardrails:{name:"Guyton-Klinger Guardrails", short:"Guardrails", dial:"rate", rate:"Starting withdrawal rate",
              blocks:["ddGuardWrap", "ddGuardExample", "ddSkipWrap"],
              blurb:"Steady spending with a cut or a raise when the withdrawal rate drifts too far."},
  riskgr:    {name:"Risk-based guardrails", short:"Risk-based", dial:"rgTarget", blocks:["ddRgWrap"],
              blurb:"Holds spending until history's odds of it lasting leave a band, then resets to the target."},
  floorceil: {name:"Floor & ceiling", short:"Floor & ceiling", dial:"rate", rate:"Target withdrawal rate", blocks:["ddFloorWrap"],
              blurb:"Aims at a share of the portfolio, but moves spending at most a set step a year."},
  vanguard:  {name:"Vanguard dynamic spending", short:"Vanguard", dial:"rate", rate:"Target withdrawal rate", blocks:["ddVgWrap"],
              blurb:"Floor and ceiling with Vanguard's limits: up 5% or down 2.5% at most a year."},
  yale:      {name:"Yale Endowment", short:"Yale", dial:"yaleRate", rate:"Starting withdrawal rate", blocks:["ddYaleWrap", "ddYaleNote"],
              blurb:"Mostly last year's spending, partly a share of today's portfolio."},
  hebeler:   {name:"Hebeler Autopilot II", short:"Autopilot II", dial:"hebRate", blocks:["ddHebWrap"],
              blurb:"Mostly last year's spending, partly an annuity-style payment on what's left."},
  sensible:  {name:"Sensible withdrawals", short:"Sensible", dial:"rate", rate:"Base withdrawal rate", blocks:["ddSensWrap"],
              blurb:"A steady base, plus a share of each year's real gains."},
  cape:      {name:"CAPE-based", short:"CAPE", dial:"capeA", blocks:["ddCapeWrap"],
              blurb:"A base rate plus a share of the market's earnings yield: more when stocks are cheap, less when they're dear."}
};
/* Every group of strategy fields, so the ones a strategy doesn't use hide. */
var DD_BLOCKS = ["ddSkipWrap", "ddGuardWrap", "ddGuardExample", "ddFloorWrap", "ddVgWrap", "ddKitWrap", "ddClyWrap",
  "ddYaleWrap", "ddYaleNote", "ddVpwWrap", "ddVpwNote", "ddHebWrap", "ddSensWrap", "ddRgWrap", "ddCapeWrap"];
/* Display names, shared by the summary sheet, the image card and compare. */
var DD_STRAT_NAMES = {};
Object.keys(DD_UI).forEach(function (k) { DD_STRAT_NAMES[k] = DD_UI[k].card || DD_UI[k].name; });
/* Year one's spending under the chosen strategy, in today's dollars, with
   the same minimum and maximum runDrawdown applies. */
function ddFirstSpend(o, P){
  var w = (P || ddPrep(o)).first;
  if ((DD_STRAT[o.strategy] || {}).limits !== false){
    if (o.spendFloor > 0) w = Math.max(w, o.spendFloor);
    if (o.spendCeil > 0) w = Math.min(w, o.spendCeil);
  }
  return w;
}


// Custom income and expense sources for the Drawdown tool: a pension, rental,
// inheritance, future car purchase, and so on. Each item is independent of
// the chosen withdrawal strategy — see runDrawdown() for how they're applied.
let ddIncomeItems = [];
let ddExpenseItems = [];

function ddRetireAgeVal() {
  var v = $("ddRetireAge").value.trim();
  return v === "" ? null : parseNum(v);
}

/* The spending path's stages: from the year each one begins, spending moves
   to its own share of year one's, in today's dollars, whatever the strategy.
   Year one is the plan's own level. Each stage keeps the year of retirement
   it begins (1-based, like CustomItem.startYear); with an age entered it's
   shown and typed as an age instead. Mutated in place, like the item lists. */
let ddPathStages = [];
let ddStageAgeMode = null;
/* Stages in the order they take effect, with each one's working start year;
   ties keep list order, matching the engine. */
function ddWdOrder(list) {
  return (list || []).map(function (st, i) {
    return {st: st, i: i, start: Math.max(2, Math.round(st.start || 0))};
  }).sort(function (a, b) { return a.start - b.start || a.i - b.i; });
}
function ddWdBaseEnd(years) {
  var first = ddWdOrder(ddPathStages)[0];
  return {from: 1, to: first ? Math.min(years, first.start - 1) : years};
}
function ddWdSpanText(sp) {
  var ageOn = ddRetireAge != null;
  var a = ageOn ? ddAgeVal(sp.from) : sp.from, b = ageOn ? ddAgeVal(sp.to) : sp.to;
  var unit = ageOn ? "age" : "year";
  return sp.from === sp.to ? unit + " " + fmtNum(a)
    : (sp.from === 1 && !ageOn ? "through year " + fmtNum(b) : unit + "s " + fmtNum(a) + "–" + fmtNum(b));
}
function buildWdStages() {
  var ageOn = ddRetireAgeVal() != null;
  ddStageAgeMode = ageOn;
  var list = $("ddWdStageList");
  list.innerHTML = ddPathStages.map(function (st, i) {
    var startShown = ageOn ? (ddRetireAgeVal() + st.start - 1) : st.start;
    return "<div class='stagecard'>" +
      "<div class='stagehead'><span class='stagenum' contenteditable='true' spellcheck='false'" +
        " data-wdname='" + i + "' title='Click to rename' aria-label='Stage " + (i + 2) + " name'>" +
        escapeHtml(st.name || ("Stage " + (i + 2))) + "</span>" +
      "<span class='stagespan' data-wdspan='" + i + "'></span>" +
      "<button class='btn mini' type='button' data-wddel='" + i + "'>Remove</button></div>" +
      "<div class='two'>" +
        "<div class='field' style='margin-bottom:0'><label data-wdstartlbl='" + i + "'>" +
          (ageOn ? "Starts at age" : "Starts in year") + "</label><div class='inputwrap'>" +
          "<input type='text' inputmode='decimal' data-num data-step='1' min='1' data-nonneg data-wf='start' data-wi='" + i +
          "' value='" + fmtNum(startShown) + "' aria-label='Stage " + (i + 2) + " start'>" +
          "<span class='affix'>" + (ageOn ? "age" : "yr") + "</span></div></div>" +
        "<div class='field' style='margin-bottom:0'><label>Spending, of year one's</label><div class='inputwrap'>" +
          "<input type='text' inputmode='decimal' data-num data-step='5' min='0' data-nonneg data-wf='level' data-wi='" + i +
          "' value='" + ddN(st.level == null ? 100 : st.level) + "' aria-label='Stage " + (i + 2) + " spending, as a share of year one'>" +
          "<span class='affix'>%</span></div></div>" +
      "</div>" +
      "<div class='hint' data-wdnote='" + i + "'></div>" +
    "</div>";
  }).join("");
  initFields(list);
}
/* Refreshes each card's span and dollar note without rebuilding, so a field
   being typed in keeps its focus; a switch between years and ages rebuilds. */
function syncWdStages(o, first) {
  if ((ddRetireAge != null) !== ddStageAgeMode) buildWdStages();
  var order = ddWdOrder(ddPathStages);
  order.forEach(function (x, k) {
    var span = $("ddWdStageList").querySelector("[data-wdspan='" + x.i + "']");
    var note = $("ddWdStageList").querySelector("[data-wdnote='" + x.i + "']");
    var next = order[k + 1];
    var to = Math.min(o.years, next ? next.start - 1 : o.years);
    var live = x.start <= o.years && to >= x.start;
    var ageOn = ddRetireAge != null;
    if (span) span.textContent = !live ? "" : (ageOn ? "Age " : "Year ") +
      fmtNum(ageOn ? ddAgeVal(x.start) : x.start) + " – " + fmtNum(ageOn ? ddAgeVal(to) : to);
    // a new retirement age moves the age a stage shows, not the year it starts
    var inp = $("ddWdStageList").querySelector("[data-wf='start'][data-wi='" + x.i + "']");
    if (inp && document.activeElement !== inp)
      inp.value = fmtNum(ageOn ? ddAgeVal(x.st.start) : x.st.start);
    if (!note) return;
    var lv = (x.st.level == null ? 100 : x.st.level) / 100;
    note.className = "hint" + (live ? "" : " acwarn");
    note.textContent = x.start > o.years
      ? "This starts after the " + fmtNum(o.years) + " years of retirement above, so it has no effect."
      : !live ? "Another stage starts the same year and takes its place."
      : o.strategy === "fixed" && first > 0
        ? "That's " + money(first * lv) + " a year (" + money(first * lv / 12) + "/mo) in today's dollars."
        : fmtNum(lv * 100) + "% of what the strategy would pay that year.";
  });
}
function readWdStart(v) {
  var n = parseNum(v), age = ddRetireAgeVal();
  if (!isFinite(n)) return null;
  return Math.max(1, Math.round(age != null ? n - age + 1 : n));
}
$("ddAddWdStage").addEventListener("click", function () {
  var years = Math.min(60, Math.max(1, Math.round(num("ddYears"))));
  var order = ddWdOrder(ddPathStages), last = order[order.length - 1];
  var start = Math.min(years, (last ? last.start : 1) + 10);
  ddPathStages.push({start: Math.max(2, start), level: last ? Math.max(0, (last.st.level == null ? 100 : last.st.level) - 10) : 90});
  buildWdStages();
  renderDrawdown();
  var el = $("ddWdStageList").querySelector("[data-wf='level'][data-wi='" + (ddPathStages.length - 1) + "']");
  if (el) el.focus();
});
$("ddWdStageList").addEventListener("input", function (e) {
  var el = e.target, f = el.getAttribute && el.getAttribute("data-wf");
  if (!f) return;
  var st = ddPathStages[parseInt(el.getAttribute("data-wi"), 10)];
  if (!st) return;
  if (f === "start") { var y = readWdStart(el.value); if (y != null) st.start = y; }
  else st.level = Math.max(0, parseNum(el.value) || 0);
  renderDrawdownTyping();
});
$("ddWdStageList").addEventListener("click", function (e) {
  var del = e.target.closest ? e.target.closest("[data-wddel]") : null;
  if (!del) return;
  var i = parseInt(del.getAttribute("data-wddel"), 10);
  if (!ddPathStages[i]) return;
  var name = ddPathStages[i].name || ("Stage " + (i + 2));
  ddPathStages.splice(i, 1);
  buildWdStages();
  renderDrawdown();
  toast("Removed " + name);
});
/* Renaming works as on the Stages cards: click selects the name, Enter
   commits, and an empty or default entry goes back to "Stage N". */
$("ddWdStageList").addEventListener("focusin", function (e) {
  var el = e.target;
  if (!el.getAttribute || el.getAttribute("data-wdname") === null) return;
  var range = document.createRange();
  range.selectNodeContents(el);
  var sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
});
$("ddWdStageList").addEventListener("keydown", function (e) {
  var el = e.target;
  if (el.getAttribute && el.getAttribute("data-wdname") !== null && e.key === "Enter") {
    e.preventDefault();
    el.blur();
  }
});
$("ddWdStageList").addEventListener("focusout", function (e) {
  var el = e.target;
  var attr = el.getAttribute && el.getAttribute("data-wdname");
  if (attr === null || attr === undefined) return;
  var i = parseInt(attr, 10);
  if (!ddPathStages[i]) return;
  var raw = el.textContent.replace(/\s+/g, " ").trim().slice(0, 40);
  var def = "Stage " + (i + 2);
  if (raw && raw !== def) ddPathStages[i].name = raw;
  else delete ddPathStages[i].name;
  el.textContent = ddPathStages[i].name || def;
});

/* ---- the inputs, saved, loaded and shared ----
   Every field the simulator keeps: its key in the saved state, its element,
   its kind and its default. Saving, loading, sharing, Reset and the input
   listeners all work from this one list, and the engine turns the saved
   state into its options (ddOptsFromState), so a saved scenario runs the
   same wherever it's opened. Kinds: "money" (grouped digits), "money0" (the
   same, blank when 0, since 0 means none), "num" and "num0" (blank when 0), "text" (kept as typed,
   blank allowed), "select" (kept as text) and "pick" (a select of numbers),
   "check" (a tick box). */
var DD_STATE = [
  ["initial", "ddInitial", "money", 1000000],
  ["years", "ddYears", "num", 30],
  ["stock", "ddStock", "num", 60],
  ["stockEnd", "ddStockEnd", "text", ""],
  ["sv", "ddSV", "num", 0],
  ["cash", "ddCash", "num", 0],
  ["rebal", "ddRebal", "select", "year"],
  ["rebalN", "ddRebalN", "num", 3],
  ["rebalBand", "ddRebalBand", "num", 5],
  ["fee", "ddFee", "num", 0],
  ["strategy", "ddStrategy", "select", "fixed"],
  ["rate", "ddRate", "num", 4],
  ["guardBand", "ddGuardBand", "num", 20],
  ["adjust", "ddAdjust", "num", 10],
  ["guardBandLo", "ddGuardBandLo", "num", 20],
  ["adjustLo", "ddAdjustLo", "num", 10],
  ["gkFinal", "ddGkFinal", "check", false],
  ["gkFinalYrs", "ddGkFinalYrs", "num", 15],
  ["floor", "ddFloor", "num", 10],
  ["ceil", "ddCeil", "num", 10],
  ["yaleWeight", "ddYaleWeight", "num", 70],
  ["yaleRate", "ddYaleRate", "num", 5],
  ["spendFloor", "ddSpendFloor", "money0", 0],
  ["spendCeil", "ddSpendCeil", "money0", 0],
  ["vpwRate", "ddVpwRate", "num", 3.8],
  ["vpwFV", "ddVpwFV", "money", 0],
  ["legacyGoal", "ddLegacyGoal", "money0", 0],
  ["ssMode", "ddSSMode", "select", "none"],
  ["ssWho", "ddSSWho", "select", "single"],
  ["ssIncome", "ddSSIncome", "money", 85000],
  ["ssClaim", "ddSSClaim", "pick", 67],
  ["ssIncome2", "ddSSIncome2", "money", 85000],
  ["ssClaim2", "ddSSClaim2", "pick", 67],
  ["ssAmount", "ddSSAmount", "money", 33000],
  ["ssAmount2", "ddSSAmount2", "money", 33000],
  ["ssDelay", "ddSSDelay", "num", 0],
  ["retireAge", "ddRetireAge", "text", ""],
  ["starts", "ddStarts", "select", "month"],
  ["fromYear", "ddFromYear", "num", 1926],
  ["comfort", "ddComfort", "money0", 0],
  ["tCrit", "ddTCrit", "select", "comfort"],
  ["tConf", "ddTConf", "pick", 100],
  ["skipRaise", "ddSkipRaise", "check", false],
  ["vgCeil", "ddVgCeil", "num", 5],
  ["vgFloor", "ddVgFloor", "num", 2.5],
  ["kitThresh", "ddKitThresh", "num", 50],
  ["kitRaise", "ddKitRaise", "num", 10],
  ["kitGap", "ddKitGap", "num", 3],
  ["clyFloor", "ddClyFloor", "num", 95],
  ["hebWeight", "ddHebWeight", "num", 75],
  ["hebRate", "ddHebRate", "num", 3],
  ["sensExtra", "ddSensExtra", "num", 10],
  ["rgTarget", "ddRgTarget", "num", 90],
  ["rgLo", "ddRgLo", "num", 70],
  ["rgHi", "ddRgHi", "num", 99],
  ["capeA", "ddCapeA", "num", 1.75],
  ["capeB", "ddCapeB", "num", 0.5],
  ["path", "ddPath", "select", "flat"],
  ["pathEase", "ddPathEase", "num", 1],
  ["gShare", "ddGShare", "num0", 0],
  ["gType", "ddGType", "select", "tips"],
  ["gYield", "ddGYield", "num", 2],
  ["gPayout", "ddGPayout", "num", 6.5],
  ["gInflate", "ddGInflate", "check", false],
  ["mcBlock", "ddMcBlock", "num", 1],
  ["mcRet", "ddMcRet", "select", "hist"],
  ["mcStock", "ddMcStock", "num", 10.4],
  ["mcSV", "ddMcSV", "num", 14.2],
  ["mcBond", "ddMcBond", "num", 4.8],
  ["mcCash", "ddMcCash", "num", 3.3],
  ["mcInfl", "ddMcInfl", "num", 3]
];
/* Settings added after scenarios were first saved. Loading a full set of
   inputs that doesn't have one (a scenario saved before it, or a hand-off
   from another tool) sets it to its default, rather than keeping whatever
   was on screen. */
var DD_LATER = ["sv", "cash", "rebal", "rebalN", "rebalBand", "gkFinal", "gkFinalYrs", "starts", "fromYear", "comfort", "tCrit", "tConf", "skipRaise",
  "vgCeil", "vgFloor", "kitThresh", "kitRaise", "kitGap", "clyFloor", "hebWeight", "hebRate", "sensExtra",
  "rgTarget", "rgLo", "rgHi", "capeA", "capeB", "path", "pathEase", "gShare", "gType", "gYield", "gPayout", "gInflate",
  "mcBlock", "mcRet", "mcStock", "mcSV", "mcBond", "mcCash", "mcInfl"];
const DD_DEFAULTS = {};
DD_STATE.forEach(function (f) { DD_DEFAULTS[f[0]] = f[3]; });
function ddFieldRead(f){
  var el = $(f[1]);
  if (f[2] === "check") return el.checked;
  if (f[2] === "text") return el.value.trim();
  if (f[2] === "select") return el.value;
  return num(f[1]);
}
function ddFieldWrite(f, v){
  var el = $(f[1]);
  if (f[2] === "check") el.checked = !!v;
  else if (f[2] === "money") el.value = groupDigits(v, true);
  else if (f[2] === "money0") el.value = v > 0 ? groupDigits(v, true) : "";
  else if (f[2] === "num0") el.value = v > 0 ? String(v) : "";
  else el.value = String(v);
}
/* Raw form state for scenario save/load, links and Reset: the fields as
   typed, not the engine's options. ddIncomeItems and ddExpenseItems are
   mutated in place (never reassigned) because wireItemList() closed over
   these two array references once, at page load. */
function readDDState(){
  var d = {};
  DD_STATE.forEach(function (f) { d[f[0]] = ddFieldRead(f); });
  d.incomeItems = ddIncomeItems.map(x => Object.assign({}, x));
  d.expenseItems = ddExpenseItems.map(x => Object.assign({}, x));
  d.pathStages = ddPathStages.map(x => Object.assign({}, x));
  d.floorSteps = ddFloorSteps.map(x => Object.assign({}, x));
  return d;
}
function writeDDState(d){
  // A full set of inputs (a load, Reset, the guide, a hand-off) sets anything
  // it doesn't mention that came later than it; a partial fill leaves the
  // rest be.
  var full = d.rate != null || d.strategy != null;
  // Spending stages saved before the spending path were a withdrawal rate for
  // the fixed strategy; as a path, each is that rate's share of the start.
  if (d.path == null && Array.isArray(d.wdStages)) {
    var conv = (d.strategy || $("ddStrategy").value) === "fixed"
      ? ddStagesFromRates(d.wdStages, d.rate != null ? +d.rate : num("ddRate")) : [];
    d = Object.assign({}, d, {path: conv.length ? "stages" : "flat", pathStages: conv});
  }
  if (full) {
    d = Object.assign({}, d);
    DD_LATER.forEach(function (k) { if (d[k] == null) d[k] = DD_DEFAULTS[k]; });
  }
  // Saved before the two guardrails were split: the lower one matches the
  // upper, as it did then.
  if (d.guardBandLo == null && d.guardBand != null) d = Object.assign({}, d, {guardBandLo: d.guardBand});
  if (d.adjustLo == null && d.adjust != null) d = Object.assign({}, d, {adjustLo: d.adjust});
  DD_STATE.forEach(function (f) { if (d[f[0]] != null) ddFieldWrite(f, d[f[0]]); });
  ddGkFinalSync();
  if (Array.isArray(d.incomeItems))
    ddIncomeItems.splice(0, ddIncomeItems.length, ...d.incomeItems.map(x => Object.assign({}, x)));
  if (Array.isArray(d.expenseItems))
    ddExpenseItems.splice(0, ddExpenseItems.length, ...d.expenseItems.map(x => Object.assign({}, x)));
  // Likewise the minimum's changes with age.
  if (Array.isArray(d.floorSteps) || full){
    ddFloorSteps.splice(0, ddFloorSteps.length,
      ...(Array.isArray(d.floorSteps) ? d.floorSteps : []).map(x => Object.assign({}, x)));
    buildFloorSteps();
  }
  // A full set replaces the spending stages, clearing them when it has none.
  if (Array.isArray(d.pathStages) || full){
    ddPathStages.splice(0, ddPathStages.length,
      ...(Array.isArray(d.pathStages) ? d.pathStages : []).map(x => Object.assign({}, x)));
    buildWdStages();
  }
}
/* The engine's options from the fields on screen. */
function readDD(){ return ddOptsFromState(readDDState()); }

/* ---- heavy work, off the page ----
   Monte Carlo and the searches run in a copy of the Plan Optimizer's worker
   (assets/plan.<hash>.js has the whole engine), so the page keeps drawing.
   Where a worker can't start, they run here once the page has drawn. Each
   kind of job is a lane with one job at a time: a newer request waits for
   the running one, replacing any already waiting, and a result that a newer
   request has overtaken is dropped. */
var DD_WORKER_URL = "@@PLAN_WORKER@@";
var ddWorker = null, ddWorkerDead = false, ddJobSeq = 0, ddLanes = {};
function ddGetWorker(){
  if (ddWorker || ddWorkerDead) return ddWorker;
  try {
    ddWorker = new Worker(DD_WORKER_URL);
    ddWorker.onmessage = function (e) {
      var v = e.data;
      if (v && v.type === "dd") ddFinish(v.lane, v.id, v.res);
    };
    ddWorker.onerror = function (e) {
      if (e && e.preventDefault) e.preventDefault();
      ddWorkerDead = true;
      try { ddWorker.terminate(); } catch (x) {}
      ddWorker = null;
      // Whatever was running, finish here instead.
      Object.keys(ddLanes).forEach(function (k) { var L = ddLanes[k]; if (L.busy) ddRunHere(k, L.busy); });
    };
  } catch (e) { ddWorkerDead = true; ddWorker = null; }
  return ddWorker;
}
function ddRunHere(lane, req){
  setTimeout(function () {
    var res = null;
    try { res = ddJob(req.job, req.args); } catch (e) { res = {error: String(e)}; }
    ddFinish(lane, req.id, res);
  }, 30);
}
function ddRun(lane, job, args, done){
  var L = ddLanes[lane] || (ddLanes[lane] = {busy: null, next: null});
  var req = {id: ++ddJobSeq, job: job, args: args, done: done};
  if (L.busy) { L.next = req; return; }
  ddStartJob(lane, L, req);
}
function ddStartJob(lane, L, req){
  L.busy = req;
  var w = ddGetWorker();
  if (w) {
    try { w.postMessage({type: "dd", id: req.id, lane: lane, job: req.job, args: req.args}); return; }
    catch (e) {}
  }
  ddRunHere(lane, req);
}
function ddFinish(lane, id, res){
  var L = ddLanes[lane];
  if (!L || !L.busy || L.busy.id !== id) return;
  var req = L.busy;
  L.busy = null;
  if (L.next) { var nx = L.next; L.next = null; ddStartJob(lane, L, nx); return; }
  if (res && !res.error) req.done(res);
}

/* The historical view is cheap and renders on every keystroke as it always
   has. The Monte Carlo view runs 5,000 retirements in the worker, and a
   retirement every month is twelve times the historical work, so for those
   held keys are coalesced -- the same 160ms treatment scheduleMC() already
   gives the retirement chart. Every other entry point (tab switch, mode toggle,
   scenario load, table click) still calls renderDrawdown directly. */
var ddTypeTimer = null;
function renderDrawdownTyping(){
  // A retirement every month is twelve times the work: coalesce it too.
  if (ddMode !== "mc" && $("ddStarts").value !== "month"){ clearTimeout(ddTypeTimer); renderDrawdown(); return; }
  clearTimeout(ddTypeTimer);
  ddTypeTimer = setTimeout(renderDrawdown, 160);
}

/* The return assumptions the sensitivity table tries: history less 2 and 1
   points a year, as it was, and 1 point better. */
var DD_DRAGS = [2, 1, 0, -1];
/* The claiming ages the Social Security table tries, each run with every
   stream rebuilt: moving one spouse's claim also moves when the spousal
   top-up starts and how much it is. null unless benefits are estimated. */
function ddSSRows(o, d){
  if (d.ssMode !== "est" || !(d.ssIncome > 0)) return null;
  var ages = [62, 64, 67, 70], both = d.ssWho === "couple";
  var ov = function (st) {
    return {ssAnnual: st.annual, ssDelayYears: st.delay, ssAnnual2: st.annual2,
            ssDelayYears2: st.delay2, ssAnnual3: st.annual3, ssDelayYears3: st.delay3};
  };
  var mk = function (who) {
    return ages.map(function (a) {
      var st = who === 1
        ? ssDrawdownStreams(d.ssIncome, a, d.ssIncome2, d.ssClaim2, both, o.retireAge, d.ssDelay)
        : ssDrawdownStreams(d.ssIncome, d.ssClaim, d.ssIncome2, a, true, o.retireAge, d.ssDelay);
      return {age: a, annual: who === 1 ? st.own1 + st.top1 : st.own2 + st.top2, ov: ov(st),
        current: a === Math.round(who === 1 ? d.ssClaim : d.ssClaim2)};
    });
  };
  var out = {rows1: mk(1), rows2: both ? mk(2) : null};
  out.flat = out.rows1.concat(out.rows2 || []).map(function (r) { return r.ov; });
  return out;
}
function ddRateClass(r){ return r >= 0.95 ? "pos" : r >= 0.85 ? "gold" : "neg"; }
function ddSensTable(rows, baseLabel){
  $("ddSensPanel").hidden = false;
  $("ddSensTable").innerHTML = "<table style='width:100%;border-collapse:collapse'>" +
    "<thead><tr><th style='text-align:left;padding:5px 8px;border-bottom:1px solid var(--rule)'>Return assumption</th>" +
    "<th style='text-align:right;padding:5px 8px;border-bottom:1px solid var(--rule)'>Success rate</th>" +
    "<th style='text-align:right;padding:5px 8px;border-bottom:1px solid var(--rule)'>Median ending balance</th></tr></thead><tbody>" +
    rows.map(function (r, i) {
      var drag = DD_DRAGS[i];
      var label = drag === 0 ? baseLabel : (drag > 0 ? "-" + drag + "% / yr" : "+" + (-drag) + "% / yr");
      var wt = drag === 0 ? "font-weight:600" : "";
      return "<tr style='" + wt + "'><td style='padding:5px 8px'>" + label + "</td>" +
        "<td style='text-align:right;padding:5px 8px' class='" + ddRateClass(r.rate) + "'>" + pctStr(r.rate, 1) + "</td>" +
        "<td style='text-align:right;padding:5px 8px'>" + money(r.median) + "</td></tr>";
    }).join("") + "</tbody></table>";
}
/* The claiming-age comparison: each row's age, benefit and result. res holds
   each row's {rate, median}, in the order of ssx.flat. */
function ddSSTables(ssx, res){
  if (!ssx || !res) { $("ddSSBreakEvenPanel").hidden = true; return; }
  $("ddSSBreakEvenPanel").hidden = false;
  var build = function (rows, off) {
    return "<table style='width:100%;border-collapse:collapse'>" +
      "<thead><tr><th style='text-align:left;padding:5px 8px;border-bottom:1px solid var(--rule)'>Claim age</th>" +
      "<th style='text-align:right;padding:5px 8px;border-bottom:1px solid var(--rule)'>Annual benefit</th>" +
      "<th style='text-align:right;padding:5px 8px;border-bottom:1px solid var(--rule)'>Success rate</th>" +
      "<th style='text-align:right;padding:5px 8px;border-bottom:1px solid var(--rule)'>Median ending balance</th></tr></thead><tbody>" +
      rows.map(function (r, i) {
        var R = res[off + i], wt = r.current ? "font-weight:600" : "", cur = r.current ? " ◄" : "";
        return "<tr style='" + wt + "'><td style='padding:5px 8px'>Age " + r.age + cur + "</td>" +
          "<td style='text-align:right;padding:5px 8px'>" + money(r.annual) + "/yr</td>" +
          "<td style='text-align:right;padding:5px 8px' class='" + ddRateClass(R.rate) + "'>" + pctStr(R.rate, 1) + "</td>" +
          "<td style='text-align:right;padding:5px 8px'>" + money(R.median) + "</td></tr>";
      }).join("") + "</tbody></table>";
  };
  $("ddSSBreakEvenTable").innerHTML = ssx.rows2
    ? "<p style='font-weight:600;margin:0 0 6px'>Your claiming age (spouse held constant)</p>" + build(ssx.rows1, 0) +
      "<p style='font-weight:600;margin:12px 0 6px'>Spouse's claiming age (yours held constant)</p>" + build(ssx.rows2, ssx.rows1.length)
    : build(ssx.rows1, 0);
}
function ddLegacy(met, total, note){
  $("ddLegacyWrap").hidden = false;
  $("ddLegacy").textContent = pctStr(met / total, 1);
  $("ddLegacy").className = "v " + (met / total >= 0.75 ? "pos" : met / total >= 0.5 ? "gold" : "neg");
  $("ddLegacyNote").textContent = note;
}

function renderDrawdown() {
  clearTimeout(ddTypeTimer);
  var retireAge = ddRetireAgeVal();
  ddRetireAge = retireAge;
  var ssMode = $("ddSSMode").value;
  $("ddSSWhoWrap").hidden = (ssMode === "none");
  $("ddSSEst").hidden = (ssMode !== "est");
  $("ddSSManual").hidden = (ssMode !== "manual");
  // Once an age is entered, Estimate mode derives timing straight from each
  // claim-age input above and no longer needs a separate delay; Manual mode
  // still needs one number, so that same field just gets relabeled below.
  $("ddSSDelayWrap").hidden = (ssMode === "none") || (ssMode === "est" && retireAge != null);
  var ssAgeMode = ssMode === "manual" && retireAge != null;
  $("ddSSDelayLabel").textContent = ssAgeMode ? "Starts at age" : "Starts after";
  $("ddSSDelayAffix").textContent = "yrs";
  $("ddSSDelayTip").setAttribute("data-tip", ssAgeMode ? "ssdelayage" : "ssdelay");
  $("ddSSDelay").setAttribute("max", ssAgeMode ? "120" : "30");
  var ssCouple = ssMode !== "none" && $("ddSSWho").value === "couple";
  $("ddSSEst2Wrap").hidden = !(ssMode === "est" && ssCouple);
  $("ddSSAmount2Wrap").hidden = !(ssMode === "manual" && ssCouple);
  $("ddSSIncomeLabel").textContent = ssCouple ? "Your income" : "Current income";
  $("ddSSAmountLabel").textContent = ssCouple ? "Your annual benefit, today's dollars" : "Annual benefit, today's dollars";
  var d = readDDState(), o = ddOptsFromState(d);
  $("ddSSShow").textContent = o.ssAnnualTotal > 0 ? money(o.ssAnnualTotal) + "/yr" : "Not included";
  if (ssMode === "est"){
    var e = ssEstimate(d.ssIncome, 40, Math.min(70, Math.max(62, d.ssClaim)));
    if (ssCouple) {
      var st = ssDrawdownStreams(d.ssIncome, d.ssClaim, d.ssIncome2, d.ssClaim2, true, null, 0);
      var m1 = (st.own1 + st.top1) / 12, m2 = (st.own2 + st.top2) / 12;
      $("ddSSEstNote").textContent = "About " + money(m1) + "/mo for you and " + money(m2) +
        "/mo for your spouse, " + money(m1 + m2) + "/mo combined, in today's dollars" +
        (st.top1 + st.top2 > 0 ? ", including a spousal benefit of " + money((st.top1 + st.top2) / 12) +
          "/mo once you've both claimed" : "") + ".";
    } else {
      $("ddSSEstNote").textContent = "About " + money(e.monthly) + " a month in today's dollars, claiming at " +
        Math.round(d.ssClaim) + ".";
    }
  }
  var strat = o.strategy, U = DD_UI[strat] || DD_UI.fixed, S = DD_STRAT[strat];
  DD_BLOCKS.forEach(function (id) { $(id).hidden = U.blocks.indexOf(id) < 0; });
  $("ddRateWrap").hidden = !U.rate;
  if (U.rate) $("ddRateLabel").textContent = U.rate;
  $("ddSpendFloorWrap").hidden = S.limits === false;
  $("ddFloorStepsWrap").hidden = S.limits === false;
  var clash = S.limits !== false && o.spendFloor > 0 && o.spendCeil > 0 && o.spendFloor > o.spendCeil;
  $("ddSpendNote2").hidden = !clash;
  if (clash) $("ddSpendNote2").textContent = "Your minimum is above your maximum, so the maximum wins.";
  var P = ddPrep(o);
  var firstW = ddFirstSpend(o, P), r1 = P.initial > 0 ? firstW / P.initial : 0;
  if (strat === "vpw"){
    var stk = o.stockPct + o.svPct, conv = (stk * 5.0 + (100 - stk) * 1.9) / 100;
    $("ddVpwNote").innerHTML = "Year 1 takes <b>" + pctStr(r1, 2) + "</b>, rising each year as the " +
      "horizon shortens. Bogleheads suggests " + pctStr(conv / 100, 2) + " for a " + ddN(stk) + "/" +
      ddN(100 - stk) + " mix.";
  }
  if (strat === "yale")
    $("ddYaleNote").innerHTML = "Each year: <b>" + o.yaleWeight + "%</b> of last year's spending (adjusted for inflation) " +
      "plus <b>" + (100 - o.yaleWeight) + "%</b> of <b>" + o.yaleRate + "%</b> of the current portfolio.";
  if (strat === "guardrails") {
    var target = o.initialPct;
    var hiRate = target * (1 + Math.max(0, o.guardBand) / 100);
    var loRate = target * (1 - Math.min(100, Math.max(0, o.guardBandLo)) / 100);
    $("ddGuardExample").innerHTML = "With a " + pctStr(target / 100, 1) + " target: if your withdrawal " +
      "ever climbs above <b>" + pctStr(hiRate / 100, 1) + "</b> of the portfolio, spending is cut " +
      fmtNum(Math.min(100, Math.max(0, o.adjustPct))) + "%" +
      (o.gkFinalYears > 0 ? (o.gkFinalYears >= o.years ? ", except that with no cuts in the final " + fmtNum(o.gkFinalYears) +
          " years, it never is in a " + fmtNum(o.years) + "-year plan"
        : " (but not in the final " + fmtNum(o.gkFinalYears) + " years)") : "") +
      ". If it falls below <b>" + pctStr(loRate / 100, 1) + "</b>, you get a " + fmtNum(Math.max(0, o.raisePct)) + "% raise.";
  }
  // a line on what the strategies without their own note do in year one
  var note = ddStratNote(o, P, firstW, r1);
  $("ddStratNote").hidden = !note;
  $("ddStratNote").innerHTML = note;
  ddMixSync(o);
  ddMCSync(o);
  if (typeof DD_ADV !== "undefined") ddInputsSync();
  $("ddFirstW").textContent = money(firstW);
  $("ddFirstMo").textContent = money(firstW / 12);
  $("ddRateNote").textContent = o.initial > 0
    ? "That's " + money(firstW) + " a year (" + money(firstW / 12) + "/mo) on " +
      (P.G.share > 0 ? "what stays invested" : "the portfolio above") +
      (o.path === "stages" && ddPathStages.length ? ", " + ddWdSpanText(ddWdBaseEnd(o.years)) : "") +
      ", before income tax. Withdrawals from traditional accounts, and part of Social Security, are taxed, so what you can spend is somewhat less. The Income Tax tool's Retirement income mode shows how much."
    : "Enter your portfolio value above to see this in dollars.";
  ddPathSync(o, P, firstW);
  ddFloorSync(o, P);
  ddGuarSync(o, P);
  ddStratCard(o, P);

  var comfort = ddComfortSync(o, P);
  ddBaseSync();
  if (o.initial <= 0) {
    setBig("ddSuccess", "—"); setBig("ddMedian", "—"); setBig("ddWorst", "—");
    $("ddVerdict").innerHTML = "<div class='hint' style='margin:0'>Enter your portfolio value to run the simulation.</div>";
    return;
  }

  if (ddMode === "hist") ddPaintHist(o, d, historicalBacktest(o), P, comfort);
  else {
    $("ddBadge").textContent = "Running…";
    var ssx = ddSSRows(o, d);
    ddRun("mc", "mc", {o: o, trials: MC_RUNS, seed: mcSeed, comfort: comfort,
        extra: {sens: DD_DRAGS, ss: ssx ? ssx.flat : null}},
      function (M) { if (ddMode === "mc") ddPaintMC(o, M, ssx, P, comfort); });
    // The baseline, run the same way, for the changes against it.
    if (ddBase) {
      var bo = ddOptsFromState(ddBase.state);
      if (bo.initial > 0) ddRun("mcb", "mc", {o: bo, trials: MC_RUNS, seed: mcSeed, comfort: comfort},
        function (Mb) {
          ddBaseMC = Mb;
          if (ddMode === "mc" && ddLastMC) ddPaintMC(ddLastMC.o, ddLastMC.M, ddLastMC.ssx, ddLastMC.P, ddLastMC.comfort);
        });
    }
  }
  ddViewsRefresh(o, d, P, comfort);
}

function ddPaintHist(o, d, H, P, comfort){
  ddLastH = H;
  var B = ddBase ? ddBaseHist(comfort) : null;
  if (!H.total) {
    /* The start year has been pulled so far forward that no complete
       retirement of this length fits before the data ends. Say so rather than
       reporting a 0% success rate, which would read as a failure. */
    setBig("ddSuccess", "—"); setBig("ddMedian", "—"); setBig("ddWorst", "—");
    $("ddSuccessNote").textContent = ""; $("ddWorstNote").textContent = "";
    $("ddPeriods").textContent = "no complete runs";
    $("ddBadge").textContent = "—";
    $("ddFromNote").innerHTML = "<b class='warn'>Too long for the " + HIST_START + "–" +
      (HIST_START + HIST_STOCK.length - 1) + " data</b>";
    $("ddSeqPanel").hidden = true;
    $("ddVerdict").innerHTML = "<div class='hint' style='margin:0'>Nothing to test: " +
      "a " + o.years + "-year retirement starting in " + o.fromYear +
      " has not finished yet.</div>";
    return;
  }
  var lastStart = H.runs[H.runs.length - 1];
  $("ddPeriods").textContent = H.total + (H.monthly ? " start months" : " start years");
  $("ddFromNote").innerHTML = "<b>" + H.total + "</b> periods, " +
    H.first + "–" + ddStartLabel(lastStart, H.monthly);
  $("ddBadge").textContent = H.first + "–" + (HIST_START + HIST_STOCK.length - 1) + (H.monthly ? " · monthly" : "");
  setH2Text($("ddYearsTitle"), H.monthly ? "How each starting month fared" : "How each starting year fared");
  setBig("ddSuccess", pctStr(H.successRate, 1));
  $("ddSuccess").className = "v " + (H.successRate >= 0.95 ? "pos" : H.successRate >= 0.85 ? "gold" : "neg");
  $("ddSuccessNote").textContent = H.survived + " of " + H.total + " retirements lasted " + o.years + " years";
  setBig("ddMedian", money(H.medianEnd));
  setBig("ddWorst", money(H.worstEnd));
  $("ddWorstNote").textContent = H.failCount
    ? "Ran out in " + H.failCount + " of " + H.total + " retirements"
    : "Never ran out";

  var verdict;
  if (H.successRate >= 0.99) verdict = "<b class='pos'>This plan survived every historical period.</b> Including the Great Depression, the 1970s stagflation, and the 2008 crash.";
  else if (H.successRate >= 0.90) verdict = "<b class='gold'>This plan survived most historical periods.</b> It failed only when retirement began in " + H.failYears.slice(0, 6).join(", ") + (H.failYears.length > 6 ? " and others" : "") + ", the worst sequences on record.";
  else verdict = "<b class='neg'>This plan ran out of money in " + H.failCount + " of " + H.total + " historical periods.</b> Consider a lower withdrawal rate or a strategy that adjusts spending.";
  $("ddVerdict").innerHTML = "<div class='hint' style='margin:0;font-size:13px'>" + verdict + "</div>";

  // Legacy goal
  if (o.legacyGoal > 0) {
    var metLegacy = H.runs.filter(function(r){ return r.endReal >= o.legacyGoal; }).length;
    ddLegacy(metLegacy, H.runs.length, metLegacy + " of " + H.total + " periods");
  } else {
    $("ddLegacyWrap").hidden = true;
  }

  // show/hide toggle and sync button state (toggle is now on the chart h2)
  $("ddViewWrap").hidden = false;
  $("segDDView").querySelectorAll("button").forEach(function (b) {
    b.classList.toggle("on", b.getAttribute("data-ddview") === ddView);
  });

  // "How each starting year fared" table
  $("ddYearsPanel").hidden = false;
  // default to the first failure if one exists (the toughest test), or the
  // worst-surviving period otherwise, but the person can click any row
  if (ddSelStart === null || !H.runs.some(function (r) { return r.startIdx === ddSelStart; })) {
    var worst = H.runs.slice().sort(function (a, b) { return a.endReal - b.endReal; })[0];
    ddSelStart = (H.firstFail || worst).startIdx;
  }
  var sortedRuns = H.runs.slice().sort(function (a, b) {
    var av = ddSortValue(a, ddSortCol), bv = ddSortValue(b, ddSortCol);
    var cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
    return ddSortDir === "asc" ? cmp : -cmp;
  });
  $("ddStartTable").querySelector("tbody").innerHTML = sortedRuns.map(function (r) {
    return "<tr class='ddrow" + (r.startIdx === ddSelStart ? " sel" : "") +
      "' data-start='" + r.startIdx + "' tabindex='0'><td>" + ddStartLabel(r, H.monthly) + "</td><td class='" +
      (r.depleted ? "neg" : "pos") + "'>" +
      ddOutcomeText(r) + "</td><td>" +
      money(r.endReal) + "</td><td>" + money(r.medRealSpend) + "</td><td>" + money(r.minRealSpend) + "</td><td>" +
      pctStr(r.avgStock, 1) + "</td><td>" + pctStr(r.avgBond, 1) + "</td><td>" + pctStr(r.avgInfl, 1) + "</td><td>" +
      r.cape0.toFixed(1) + "</td></tr>";
  }).join("");
  $("ddStartTable").querySelectorAll("th.sortcol").forEach(function (th) {
    th.classList.remove("sort-asc", "sort-desc");
    if (th.getAttribute("data-sort") === ddSortCol) th.classList.add(ddSortDir === "asc" ? "sort-asc" : "sort-desc");
  });

  var show = H.runs.filter(function (r) { return r.startIdx === ddSelStart; })[0] || H.runs[0];
  var showLabel = ddStartLabel(show, H.monthly);

  // Portfolio balance chart: all years fan or single selected-year line
  var maxY = o.years;
  if (ddView === "all") {
    setH2Text($("ddChartTitle"), H.monthly ? "Every historical starting month" : "Every historical starting year");
    var pts = [];
    for (var y = 0; y <= maxY; y++) {
      var vals = H.runs.map(function (r) {
        return y === 0 ? o.initial : (r.rows[y - 1] ? r.rows[y - 1].realEnd : 0);
      }).sort(function (a, b) { return a - b; });
      var at = function (q) { return vals[Math.min(vals.length - 1, Math.floor(vals.length * q))]; };
      pts.push({ year: y, base: at(.5), hi: at(.9), lo: at(.1), p25: at(.25), p75: at(.75) });
    }
    var ddTraces = H.runs.map(function (r) {
      var ln = [o.initial];
      for (var y2 = 1; y2 <= maxY; y2++) ln.push(r.rows[y2 - 1] ? r.rows[y2 - 1].realEnd : 0);
      return ln;
    });
    ddPoints = paintChart("chartDD", pts, maxY, "mc", [], ddRetireAge != null ? ddRetireAge : 0,
      {enhanced:true, traces:{xs:pts.map(function (a) { return a.year; }), lines:ddTraces},
       overlay:ddBaseOverlay(B, "realEnd", true, null)});
    histLegend("legendDD");
    if (B) $("legendDD").insertAdjacentHTML("beforeend", swatch("#c9d3e6", "Baseline median"));
    $("ddChartNote").hidden = false;
    $("ddChartNote").innerHTML = "Each band covers the range of outcomes across all " + H.total +
      " historical retirements, in today's dollars. The <b>median</b> line is the middle outcome.";
  } else {
    setH2Text($("ddChartTitle"), "Starting in " + showLabel);
    var singlePts = [{ year: 0, base: o.initial, hi: o.initial, lo: 0 }];
    show.rows.forEach(function (r) {
      singlePts.push({ year: r.year, base: r.realEnd, hi: r.realEnd, lo: 0 });
    });
    var bOv = ddBaseOverlay(B, "realEnd", true, show.startIdx);
    ddPoints = paintChart("chartDD", singlePts, maxY, "band", [], ddRetireAge != null ? ddRetireAge : 0, { enhanced: true, noLoLine: true, overlay: bOv });
    $("legendDD").innerHTML = swatch("#e9b872", "Portfolio balance, in today’s dollars") +
      (bOv ? swatch("#c9d3e6", "Baseline, same start") : "");
    $("ddChartNote").hidden = false;
    $("ddChartNote").innerHTML = "Balance in today’s dollars, retiring in " + showLabel + ".";
  }

  // "Year by year" detail table (always shows selected year)
  setH2Text($("ddDetailTitle"), "Year by year, retiring in " + showLabel);
  $("ddDetailNote").innerHTML = "Click any row in the table above to see that period's detail here. " +
    (show.depleted
      ? "This one ran out of money " + (ddRetireAge != null ? "at age " + ddAgeVal(show.depletedYear) : "in year " + show.depletedYear) + "."
      : "This one survived the full " + o.years + " years.") + ddWhyText(o, show, H);
  $("ddTableYearHeader").textContent = ddRetireAge != null ? "Age" : "Year";
  fillDDTable(show);

  // Income section: follows the same toggle, no separate control
  $("ddSpendYearView").hidden = (ddView !== "year");
  $("ddSpendAllView").hidden = (ddView !== "all");
  if (ddView === "all") {
    setH2Text($("ddIncomeSectionTitle"), "What your income looked like");
    setH2Text($("ddIncomeChartTitle"), "Spending through retirement");
    renderSpendStatsAll(H, o);
    renderIncomeChartAll(H, o, ddBaseOverlay(B, "realSpend", false, null));
    $("ddIncomeNote").textContent = "Median, 10th–90th and 25th–75th percentile spending by " +
      "year of retirement, across all " + H.total + " historical " + (H.monthly ? "starting months." : "starting years.");
  } else {
    setH2Text($("ddIncomeSectionTitle"), "What your income looked like starting in " + showLabel);
    setH2Text($("ddIncomeChartTitle"), "Spending through retirement, retiring in " + showLabel);
    renderSpendStats(show, "Showing the period selected above.");
    renderIncomeChart(show, ddBaseOverlay(B, "realSpend", false, show.startIdx));
    $("ddIncomeNote").textContent = "";
  }
  ddPlanExtras("hist", o, P, H, comfort, B);
  ddPaintSeq(o, H);

  // Return sensitivity
  ddSensTable(DD_DRAGS.map(function (drag) {
    var S = ddQuick(Object.assign({}, o, {returnDrag: drag}));
    return {rate: S.successRate, median: S.medianEnd};
  }), "Baseline (historical)");

  // Social Security claiming ages, when they're estimated
  var ssx = ddSSRows(o, d);
  ddSSTables(ssx, ssx && ssx.flat.map(function (ov) {
    var S = ddQuick(Object.assign({}, o, ov));
    return {rate: S.successRate, median: S.medianEnd};
  }));
}

/* What the Monte Carlo runs draw, in words: the verdict under its results. */
function ddMCWords(o){
  var span = (HIST_START + 1) + "–" + (HIST_START + HIST_STOCK.length - 1);
  var w = o.mcBlock > 1
    ? "Each run strings together " + o.years + " years from the " + span + " record, " + o.mcBlock +
      " consecutive years at a time, so the streaks history had, good and bad, stay together."
    : "Each run draws " + o.years + " years at random from the " + span + " record. This captures the range " +
      "of possible returns but not the way bad years clustered; drawing several years together, or the historical view, shows that.";
  if (o.mcOwn) {
    var H = ddMCHistory(), parts = [];
    var add = function (k, name) {
      if (Math.abs(o.mcRet[k] - H[k]) >= 0.05) parts.push(name + " " + ddN(o.mcRet[k]) + "% a year (history " + H[k].toFixed(1) + "%)");
    };
    add("stock", "US stocks");
    if (o.svPct > 0) add("sv", "small value");
    if (o.stockPct + o.svPct + o.cashPct < 100 || o.stockPctEnd != null) add("bond", "bonds");
    if (o.cashPct > 0) add("cash", "cash");
    add("infl", "inflation");
    w += parts.length ? " Each year is shifted so the long run compounds to your figures: " + parts.join(", ") + "."
      : " Your figures match history's, so each year runs as it happened.";
  }
  return w;
}
/* The Monte Carlo settings show in that mode, and your own returns only once
   chosen, small value and cash only when the mix holds them. */
function ddMCSync(o){
  $("ddMCWrap").hidden = ddMode !== "mc";
  $("ddMcOwnWrap").hidden = !o.mcOwn;
  $("ddMcSVWrap").hidden = !(o.svPct > 0);
  $("ddMcCashWrap").hidden = !(o.cashPct > 0);
  var H = ddMCHistory();
  $("ddMcNote").textContent = o.mcOwn
    ? "Long-run returns, compounded, before inflation. History's since 1927: US stocks " + H.stock.toFixed(1) +
      "%, small value " + H.sv.toFixed(1) + "%, bonds " + H.bond.toFixed(1) + "%, cash " + H.cash.toFixed(1) +
      "%, inflation " + H.infl.toFixed(1) + "%."
    : "";
}
$("ddMcReset").addEventListener("click", function () {
  var H = ddMCHistory();
  [["ddMcStock", "stock"], ["ddMcSV", "sv"], ["ddMcBond", "bond"], ["ddMcCash", "cash"], ["ddMcInfl", "infl"]]
    .forEach(function (p) { $(p[0]).value = H[p[1]].toFixed(1); });
  renderDrawdown();
});

var ddLastMC = null;
function ddPaintMC(o, M, ssx, P, comfort){
  ddLastMC = {o: o, M: M, ssx: ssx, P: P, comfort: comfort};
  var Mb = ddBase ? ddBaseMC : null;
  var trials = M.trials;
  $("ddPeriods").textContent = trials.toLocaleString() + " runs";
  $("ddBadge").textContent = trials.toLocaleString() + " simulations";
  setBig("ddSuccess", pctStr(M.successRate, 1));
  $("ddSuccess").className = "v " + (M.successRate >= 0.95 ? "pos" : M.successRate >= 0.85 ? "gold" : "neg");
  $("ddSuccessNote").textContent = M.survived.toLocaleString() + " of " + trials.toLocaleString() + " runs lasted " + o.years + " years";
  setBig("ddMedian", money(M.medianEnd));
  setBig("ddWorst", money(M.p10End));
  $("ddWorstNote").textContent = "10th percentile outcome";
  $("ddVerdict").innerHTML = "<div class='hint' style='margin:0;font-size:13px'>" + ddMCWords(o) + "</div>";

  // Legacy goal
  if (o.legacyGoal > 0) ddLegacy(M.legacy, trials, M.legacy.toLocaleString() + " of " + trials.toLocaleString() + " simulations");
  else $("ddLegacyWrap").hidden = true;

  setH2Text($("ddChartTitle"), "Range of outcomes");
  var mpts = [{ year: 0, base: o.initial, hi: o.initial, lo: o.initial, p25: o.initial, p75: o.initial }];
  M.bands.forEach(function (b) {
    mpts.push({ year: b.year, base: b.p50, hi: b.p90, lo: b.p10, p25: b.p25, p75: b.p75 });
  });
  var mOv = Mb ? [{pts: [{year: 0, value: ddOptsFromState(ddBase.state).initial}].concat(Mb.bands.map(function (b) { return {year: b.year, value: b.p50}; })),
    color: "#c9d3e6", dash: "6 5", width: 1.6}] : null;
  ddPoints = paintChart("chartDD", mpts, o.years, "mc", [], ddRetireAge != null ? ddRetireAge : 0, {enhanced:true, overlay: mOv});
  mcLegend("legendDD", null, true);
  if (mOv) $("legendDD").insertAdjacentHTML("beforeend", swatch("#c9d3e6", "Baseline median"));
  $("ddChartNote").hidden = false;
  $("ddChartNote").innerHTML = "Balance in today's dollars across " + trials.toLocaleString() +
    " simulated retirements.";
  $("ddYearsPanel").hidden = true;
  $("ddSeqPanel").hidden = true;

  var med = M.med;
  setH2Text($("ddDetailTitle"), "Year by year, a median run");
  $("ddDetailNote").textContent = "One representative simulation from the middle of the range.";
  fillDDTable(med);

  $("ddViewWrap").hidden = true;
  $("ddSpendYearView").hidden = false;
  $("ddSpendAllView").hidden = true;
  setH2Text($("ddIncomeChartTitle"), "Spending through retirement, a median run");
  renderSpendStats(med, "Showing the same run as the table below.");
  renderIncomeChart(med, Mb ? [{pts: Mb.med.rows.map(function (w) { return {year: w.year, value: w.realSpend}; }),
    color: "#c9d3e6", dash: "6 5", width: 1.6}] : null);
  $("ddIncomeNote").textContent = "";
  ddPlanExtras("mc", o, P, M, comfort, null);

  ddSensTable(M.sens, "Baseline (sampled)");
  ddSSTables(ssx, M.ss);
}

function fillDDTable(run) {
  // The engine tracks balances in the dollars of the year they occur in
  // (nominal), which is necessary for the math but confusing to read side by
  // side over a long horizon — 50 years of inflation alone can turn a real
  // $20M into a nominal $140M. Every dollar figure here is converted back to
  // today's terms so the table reads consistently with the rest of the app.
  var hasCustomIncome = ddIncomeItems.some(function(it){ return it.on !== false; });
  var hasG = run.rows.some(function (r) { return r.guaranteed > 0; });
  $("ddOtherIncomeHeader").hidden = !hasCustomIncome;
  $("ddGuarHeader").hidden = !hasG;
  $("ddTable").querySelector("tbody").innerHTML = run.rows.map(function (r, i) {
    var prevReal = i === 0 ? r.start : run.rows[i - 1].realEnd;
    var otherCell = (hasCustomIncome
      ? "<td>" + (r.customIncome > 0 ? money(r.customIncome) : "—") + "</td>"
      : "") + (hasG ? "<td>" + (r.guaranteed > 0 ? money(r.guaranteed) : "—") + "</td>" : "");
    return "<tr><td>" + ddAgeVal(r.year) + "</td><td>" + money(prevReal) + "</td><td>" +
      (r.ss > 0 ? money(r.ss) : "—") + "</td>" + otherCell + "<td>" + money(r.withdrawal) +
      "</td><td>" + money(r.spend) + "</td><td>" + money(r.realSpend != null ? r.realSpend : r.realWithdrawal) +
      "</td><td class='" + (r.ret >= 0 ? "pos" : "neg") + "'>" +
      r.ret.toFixed(1) + "%</td><td>" + money(r.realEnd) + "</td></tr>";
  }).join("");
}

/* Summarises spending across every year of one run: the swings, the cuts, and
   the total. This is what tells the story a single ending balance can't. */
function renderSpendStats(run, label) {
  var real = run.rows.map(function (r) { return r.realSpend != null ? r.realSpend : r.realWithdrawal; });
  var sorted = real.slice().sort(function (a, b) { return a - b; });
  var high = sorted[sorted.length - 1], low = sorted[0];
  var med = sorted[Math.floor(sorted.length / 2)];
  var total = real.reduce(function (a, v) { return a + v; }, 0);

  var cuts = 0, maxCut = 0;
  for (var i = 1; i < real.length; i++) {
    var chg = real[i] - real[i - 1];
    if (chg < -0.5) { cuts++; if (-chg > maxCut) maxCut = -chg; }
  }

  $("ddSpendHigh").textContent = money(high);
  $("ddSpendLow").textContent = money(low);
  $("ddSpendMed").textContent = money(med);
  $("ddSpendCuts").textContent = cuts + " of " + real.length + " years";
  $("ddSpendMaxCut").textContent = maxCut > 0 ? "−" + money(maxCut) + " in one year" : "None";
  $("ddSpendTotal").textContent = money(total);

  var swing = high > 0 ? (high - low) / high : 0;
  $("ddSpendNote").innerHTML = label + " Spending in today's dollars ranged from " +
    money(low) + " to " + money(high) + (swing > 0.01
      ? ", a swing of " + pctStr(swing, 0) + " between the best and worst year."
      : ", essentially flat throughout.");
}

/* Line chart of what was actually spent each year, in today's dollars, split
   into the Social Security portion and the portfolio portion. */
function renderIncomeChart(run, overlay) {
  var pts = run.rows.map(function (r) {
    var real = r.realSpend != null ? r.realSpend : r.realWithdrawal;
    return { year: r.year, base: real, hi: real, lo: real };
  });
  ddIncomeChartAgg = false;
  var xOff = ddRetireAge != null ? ddRetireAge - 1 : 0;
  if (!pts.length) { paintChart("chartDDI", [], 1, "band", [], xOff, {enhanced:true}); return; }
  ddiPoints = paintChart("chartDDI", pts, pts.length, "band", [], xOff, {enhanced:true, overlay: overlay});
  $("legendDDI").innerHTML = swatch("#e9b872", "Total spending, in today's dollars") +
    (overlay ? swatch("#c9d3e6", "Baseline") : "");
}

/* Same idea as the "every historical starting year" balance chart above, but
   for spending: at each year of retirement (year 1, year 2, ...), collect
   that year's real spending across every historical starting-year run and
   take percentiles. This is what "All years" shows instead of one run. */
function renderIncomeChartAll(H, o, overlay) {
  var maxY = o.years;
  var pts = [];
  for (var y = 1; y <= maxY; y++) {
    var vals = H.runs.map(function (r) {
      var row = r.rows[y - 1];
      if (!row) return 0;
      return row.realSpend != null ? row.realSpend : row.realWithdrawal;
    }).sort(function (a, b) { return a - b; });
    var at = function (q) { return vals[Math.min(vals.length - 1, Math.floor(vals.length * q))]; };
    pts.push({ year: y, base: at(.5), hi: at(.9), lo: at(.1), p25: at(.25), p75: at(.75) });
  }
  var lines = H.runs.map(function (r) {
    return pts.map(function (a) {
      var row = r.rows[a.year - 1];
      return row ? (row.realSpend != null ? row.realSpend : row.realWithdrawal) : 0;
    });
  });
  ddIncomeChartAgg = true;
  ddiPoints = paintChart("chartDDI", pts, maxY, "mc", [], ddRetireAge != null ? ddRetireAge - 1 : 0,
    {enhanced:true, traces:{xs:pts.map(function (a) { return a.year; }), lines:lines}, overlay: overlay});
  histLegend("legendDDI");
  if (overlay) $("legendDDI").insertAdjacentHTML("beforeend", swatch("#c9d3e6", "Baseline median"));
}

/* Aggregate version of renderSpendStats: instead of one run's swings, this
   pools every year of every historical starting-year run to show the full
   range — the single best and worst years ever seen, and how the total
   spent over a full retirement varied depending on when it began. */
function renderSpendStatsAll(H, o) {
  var n = H.runs.length;
  var allVals = [], totals = [], cutsCounts = [], maxCutEver = 0;
  H.runs.forEach(function (r) {
    var real = r.rows.map(function (row) { return row.realSpend != null ? row.realSpend : row.realWithdrawal; });
    real.forEach(function (v) { allVals.push(v); });
    totals.push(real.reduce(function (a, v) { return a + v; }, 0));
    var cuts = 0;
    for (var i = 1; i < real.length; i++) {
      var chg = real[i] - real[i - 1];
      if (chg < -0.5) { cuts++; if (-chg > maxCutEver) maxCutEver = -chg; }
    }
    cutsCounts.push(cuts);
  });

  var sortedVals = allVals.slice().sort(function (a, b) { return a - b; });
  var high = sortedVals[sortedVals.length - 1], low = sortedVals[0];
  var med = sortedVals[Math.floor(sortedVals.length / 2)];
  var avg = allVals.reduce(function (a, v) { return a + v; }, 0) / allVals.length;

  var sortedTotals = totals.slice().sort(function (a, b) { return a - b; });
  var totalMed = sortedTotals[Math.floor(sortedTotals.length / 2)];
  var totalMin = sortedTotals[0], totalMax = sortedTotals[sortedTotals.length - 1];
  var cutsAvg = cutsCounts.reduce(function (a, v) { return a + v; }, 0) / n;

  $("ddAggHigh").textContent = money(high);
  $("ddAggLow").textContent = money(low);
  $("ddAggMed").textContent = money(med);
  $("ddAggAvg").textContent = money(avg);
  $("ddAggTotalMed").textContent = money(totalMed);
  $("ddAggTotalRange").textContent = Math.round(totalMax - totalMin) < 1
    ? money(totalMin) + " in every one" : money(totalMin) + " – " + money(totalMax);
  $("ddAggCutsAvg").textContent = cutsAvg.toFixed(1) + " of " + o.years + " years";
  $("ddAggMaxCut").textContent = maxCutEver > 0 ? "−" + money(maxCutEver) + " in one year" : "None";

  $("ddSpendNote").innerHTML = Math.round(high - low) < 1
    ? "Across all " + n + " historical starting years, spending held at " + money(low) +
      " a year in today's dollars, " + money(totalMin) + " over a full " + o.years + "-year retirement."
    : "Across all " + n + " historical starting years. A single year's spending " +
      "ranged from " + money(low) + " to " + money(high) + " in today's dollars, and a full " + o.years +
      "-year retirement totaled anywhere from " + money(totalMin) + " to " + money(totalMax) +
      " depending on when it began.";
}
var ddiPoints = [];
attachChart("chartWrapDDI", "chartDDI", "tipDDI", function () { return ddiPoints; },
  function (best) {
    var lbl = ddRetireAge != null ? "Age " + ddAgeVal(best.year) : "Year " + fmtNum(best.year);
    if (ddIncomeChartAgg) {
      return "<b>" + lbl + "</b>" +
        "<br><span style='color:#4fbf95'>90th</span> <span class='n'>" + money(best.hi) +
        "</span><br><span style='color:#3f9a78'>75th</span> <span class='n'>" + money(best.p75) +
        "</span><br><span style='color:#e9b872'>Median</span> <span class='n'>" + money(best.base) +
        "</span><br><span style='color:#3f9a78'>25th</span> <span class='n'>" + money(best.p25) +
        "</span><br><span style='color:#e2795f'>10th</span> <span class='n'>" + money(best.lo) + "</span>";
    }
    return "<b>" + lbl + "</b>" +
      "<br><span style='color:#e9b872'>Spending</span> <span class='n'>" + money(best.base) + "</span>";
  });

attachChart("chartWrapDD", "chartDD", "tipDD", function () { return ddPoints; },
  function (best) {
    var lbl = ddRetireAge != null ? "Age " + ddAgeValPoint(best.year) : "Year " + fmtNum(best.year);
    if (ddView === "year" && ddMode === "hist") {
      return "<b>" + lbl + "</b><br><span class='n'>" + money(best.base) + "</span>";
    }
    return "<b>" + lbl + "</b>" +
      "<br><span style='color:#4fbf95'>90th</span> <span class='n'>" + money(best.hi) +
      "</span><br><span style='color:#3f9a78'>75th</span> <span class='n'>" + money(best.p75) +
      "</span><br><span style='color:#e9b872'>Median</span> <span class='n'>" + money(best.base) +
      "</span><br><span style='color:#3f9a78'>25th</span> <span class='n'>" + money(best.p25) +
      "</span><br><span style='color:#e2795f'>10th</span> <span class='n'>" + money(best.lo) + "</span>";
  });

function ddPickRow(tr){
  ddSelStart = parseInt(tr.getAttribute("data-start"), 10);
  ddView = "year";
  renderDrawdown();
}
$("ddStartTable").addEventListener("click", function (e) {
  var th = e.target.closest ? e.target.closest("th.sortcol") : null;
  if (th) {
    var col = th.getAttribute("data-sort");
    if (ddSortCol === col) ddSortDir = ddSortDir === "asc" ? "desc" : "asc";
    else { ddSortCol = col; ddSortDir = "desc"; }
    renderDrawdown();
    return;
  }
  var tr = e.target.closest ? e.target.closest("tr[data-start]") : null;
  if (tr) ddPickRow(tr);
});
$("ddStartTable").addEventListener("keydown", function (e) {
  if (e.key !== "Enter" && e.key !== " ") return;
  var tr = e.target.closest ? e.target.closest("tr[data-start]") : null;
  if (!tr) return;
  e.preventDefault();
  ddPickRow(tr);
});
$("segDD").addEventListener("click", function (e) {
  var b = e.target.closest ? e.target.closest("button[data-dd]") : null;
  if (!b) return;
  ddMode = b.getAttribute("data-dd");
  $("segDD").querySelectorAll("button").forEach(function (x) {
    x.classList.toggle("on", x.getAttribute("data-dd") === ddMode);
  });
  renderDrawdown();
});
/* Every field re-runs the simulator as it changes: typed fields as they're
   typed, choices and tick boxes when they change. The retirement age and the
   final-years box have their own handlers below. */
DD_STATE.forEach(function (f) {
  if (f[1] === "ddRetireAge" || f[1] === "ddGkFinal") return;
  var pick = f[2] === "select" || f[2] === "pick" || f[2] === "check";
  $(f[1]).addEventListener(pick ? "change" : "input", pick ? renderDrawdown : renderDrawdownTyping);
});
/* Entering a retirement age is what flips the whole tool from "years into
   retirement" to "age" everywhere. As a small kindness, if the Social
   Security delay field is still sitting at its untouched default of 0, we
   carry its meaning ("starts right away") forward into age terms too,
   rather than leaving it reading "Starts at age 0" the moment it's
   relabeled. Never overwrites a value the person actually set. */
$("ddRetireAge").addEventListener("input", function () {
  var v = $("ddRetireAge").value.trim();
  if (v !== "") {
    var age = parseNum(v);
    if (age > 0 && parseNum($("ddSSDelay").value) === 0) {
      $("ddSSDelay").value = String(Math.round(age));
    }
  }
  renderDrawdownTyping();
});
$("segDDView").addEventListener("click", function (e) {
  var b = e.target.closest ? e.target.closest("button[data-ddview]") : null;
  if (!b) return;
  ddView = b.getAttribute("data-ddview");
  renderDrawdown();
});
/* The record runs 1926 to 2025, and a retirement has to finish inside it:
   with 30 years, 1996 is the last January it can start. A start year
   outside that snaps back to the nearest end once the field is left (not
   while it's being typed), or when the years change. */
function ddFromClamp(){
  var el = $("ddFromYear"), years = Math.min(60, Math.max(1, Math.round(num("ddYears")))) || 1;
  var last = HIST_START + HIST_STOCK.length - years, v = parseNum(el.value);
  var c = el.value.trim() === "" ? HIST_START : Math.min(last, Math.max(HIST_START, Math.round(v)));
  if (String(c) !== el.value.trim()) { el.value = String(c); renderDrawdown(); }
}
$("ddFromYear").addEventListener("change", ddFromClamp);
$("ddYears").addEventListener("change", ddFromClamp);
/* The years box only means something with its box ticked. */
function ddGkFinalSync(){ $("ddGkFinalYrs").disabled = !$("ddGkFinal").checked; }
$("ddGkFinal").addEventListener("change", function(){ ddGkFinalSync(); renderDrawdown(); });
ddGkFinalSync();
/* All three retirement modes keep their last computed result in the
   background regardless of which tab is currently open, so every source
   that has a real number is offered — not just whichever one happens to
   be on screen. */
$("ddCopy").addEventListener("click", async function () {
  var sources = [
    {label: "Basic", value: simpleRun ? simpleRun.fv : 0},
    {label: "Advanced", value: lastRun ? lastRun.fvReal : 0},
    {label: "Stages", value: seriesRun ? seriesRun.fvReal : 0}
  ].filter(function (s) { return s.value > 0; });

  if (!sources.length) { toast("Run a retirement projection first"); return; }
  if (sources.length === 1) {
    applyDDCopy(sources[0]);
    return;
  }

  var choice = await showPopup("Copy from which plan?", sources.map(function (s) {
    return {label: s.label, desc: money(s.value), money: true};
  }));
  if (choice >= 0) applyDDCopy(sources[choice]);
});
function applyDDCopy(source) {
  $("ddInitial").value = groupDigits(Math.round(source.value), true);
  renderDrawdown();
  toast("Copied " + money(source.value) + " from " + source.label);
}
