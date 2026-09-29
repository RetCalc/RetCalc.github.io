/* ---------- drawdown UI ---------- */
var ddPoints = [];
var ddMode = "hist";
var ddSelectedYear = null;
var ddView = "all";
var ddSortCol = "year";
var ddSortDir = "asc";

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

/* Value used to compare two starting-year runs for a given sortable column. */
function ddSortValue(r, col) {
  switch (col) {
    case "outcome": return ddOutcomeText(r);
    case "end": return r.endReal;
    case "med": return r.medRealSpend;
    case "low": return r.minRealSpend;
    default: return r.startYear;
  }
}
var ddIncomeChartAgg = false;
/* Display names, shared by the summary sheet and the image card. */
var DD_STRAT_NAMES = {fixed:"Fixed amount", pct:"% of portfolio",
  guardrails:"Guyton-Klinger Guardrails", floorceil:"Floor & ceiling",
  yale:"Yale Endowment", vpw:"Variable percentage (VPW)"};
/* First-year spending under the chosen strategy, in today's dollars, with the
   same minimum and maximum runDrawdown applies. */
function ddFirstYearSpend(o){
  var w = o.strategy === "vpw"
    ? Math.max(0, pmtStart((o.vpwRate || 0) / 100, o.years, o.initial, o.vpwFV || 0))
    : o.initial * o.initialPct / 100;
  if (o.strategy !== "fixed"){
    if (o.spendFloor > 0) w = Math.max(w, o.spendFloor);
    if (o.spendCeil > 0) w = Math.min(w, o.spendCeil);
  }
  return w;
}


// Custom income and expense sources for the Drawdown tool: a pension, rental,
// inheritance, future car purchase, and so on. Each item is independent of
// the chosen withdrawal strategy \u2014 see runDrawdown() for how they're applied.
let ddIncomeItems = [];
let ddExpenseItems = [];

function ddRetireAgeVal() {
  var v = $("ddRetireAge").value.trim();
  return v === "" ? null : parseNum(v);
}

/* Spending stages for the fixed strategy: from the year each one begins,
   spending moves to its own rate of the starting portfolio, still in today's
   dollars and still rising with inflation. The starting rate above is the
   first stage. Each stage keeps the year of retirement it begins (1-based,
   like CustomItem.startYear); with an age entered it's shown and typed as an
   age instead. Mutated in place, like the item lists. */
let ddWdStages = [];
let ddWdAgeMode = null;
/* Stages in the order they take effect, with each one's working start year;
   ties keep list order, matching ddFixedRateAt. */
function ddWdOrder(list) {
  return (list || []).map(function (st, i) {
    return {st: st, i: i, start: Math.max(2, Math.round(st.start || 0))};
  }).sort(function (a, b) { return a.start - b.start || a.i - b.i; });
}
function ddWdBaseEnd(years) {
  var first = ddWdOrder(ddWdStages)[0];
  return {from: 1, to: first ? Math.min(years, first.start - 1) : years};
}
function ddWdSpanText(sp) {
  var ageOn = ddRetireAge != null;
  var a = ageOn ? ddAgeVal(sp.from) : sp.from, b = ageOn ? ddAgeVal(sp.to) : sp.to;
  var unit = ageOn ? "age" : "year";
  return sp.from === sp.to ? unit + " " + fmtNum(a)
    : (sp.from === 1 && !ageOn ? "through year " + fmtNum(b) : unit + "s " + fmtNum(a) + "\u2013" + fmtNum(b));
}
function buildWdStages() {
  var ageOn = ddRetireAgeVal() != null;
  ddWdAgeMode = ageOn;
  var list = $("ddWdStageList");
  list.innerHTML = ddWdStages.map(function (st, i) {
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
        "<div class='field' style='margin-bottom:0'><label>Withdrawal rate</label><div class='inputwrap'>" +
          "<input type='text' inputmode='decimal' data-num data-step='0.25' min='0' data-nonneg data-wf='rate' data-wi='" + i +
          "' value='" + fmtNum(st.rate || 0) + "' aria-label='Stage " + (i + 2) + " withdrawal rate'>" +
          "<span class='affix'>%</span></div></div>" +
      "</div>" +
      "<div class='hint' data-wdnote='" + i + "'></div>" +
    "</div>";
  }).join("");
  initFields(list);
}
/* Refreshes each card's span and dollar note without rebuilding, so a field
   being typed in keeps its focus; a switch between years and ages rebuilds. */
function syncWdStages(o) {
  if ((ddRetireAge != null) !== ddWdAgeMode) buildWdStages();
  var order = ddWdOrder(ddWdStages);
  order.forEach(function (x, k) {
    var span = $("ddWdStageList").querySelector("[data-wdspan='" + x.i + "']");
    var note = $("ddWdStageList").querySelector("[data-wdnote='" + x.i + "']");
    var next = order[k + 1];
    var to = Math.min(o.years, next ? next.start - 1 : o.years);
    var live = x.start <= o.years && to >= x.start;
    var ageOn = ddRetireAge != null;
    if (span) span.textContent = !live ? "" : (ageOn ? "Age " : "Year ") +
      fmtNum(ageOn ? ddAgeVal(x.start) : x.start) + " \u2013 " + fmtNum(ageOn ? ddAgeVal(to) : to);
    // a new retirement age moves the age a stage shows, not the year it starts
    var inp = $("ddWdStageList").querySelector("[data-wf='start'][data-wi='" + x.i + "']");
    if (inp && document.activeElement !== inp)
      inp.value = fmtNum(ageOn ? ddAgeVal(x.st.start) : x.st.start);
    if (!note) return;
    var w = o.initial * (x.st.rate || 0) / 100;
    note.className = "hint" + (live ? "" : " acwarn");
    note.textContent = x.start > o.years
      ? "This starts after the " + fmtNum(o.years) + " years of retirement above, so it has no effect."
      : !live ? "Another stage starts the same year and takes its place."
      : o.initial > 0 ? "That\u0027s " + money(w) + " a year (" + money(w / 12) + "/mo) in today\u0027s dollars."
      : "";
  });
}
function readWdStart(v) {
  var n = parseNum(v), age = ddRetireAgeVal();
  if (!isFinite(n)) return null;
  return Math.max(1, Math.round(age != null ? n - age + 1 : n));
}
$("ddAddWdStage").addEventListener("click", function () {
  var years = Math.min(60, Math.max(1, Math.round(num("ddYears"))));
  var order = ddWdOrder(ddWdStages), last = order[order.length - 1];
  var start = Math.min(years, (last ? last.start : 1) + 10);
  ddWdStages.push({start: Math.max(2, start), rate: last ? last.st.rate : num("ddRate")});
  buildWdStages();
  renderDrawdown();
  var el = $("ddWdStageList").querySelector("[data-wf='rate'][data-wi='" + (ddWdStages.length - 1) + "']");
  if (el) el.focus();
});
$("ddWdStageList").addEventListener("input", function (e) {
  var el = e.target, f = el.getAttribute && el.getAttribute("data-wf");
  if (!f) return;
  var st = ddWdStages[parseInt(el.getAttribute("data-wi"), 10)];
  if (!st) return;
  if (f === "start") { var y = readWdStart(el.value); if (y != null) st.start = y; }
  else st.rate = Math.max(0, parseNum(el.value) || 0);
  renderDrawdownTyping();
});
$("ddWdStageList").addEventListener("click", function (e) {
  var del = e.target.closest ? e.target.closest("[data-wddel]") : null;
  if (!del) return;
  var i = parseInt(del.getAttribute("data-wddel"), 10);
  if (!ddWdStages[i]) return;
  var name = ddWdStages[i].name || ("Stage " + (i + 2));
  ddWdStages.splice(i, 1);
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
  if (!ddWdStages[i]) return;
  var raw = el.textContent.replace(/\s+/g, " ").trim().slice(0, 40);
  var def = "Stage " + (i + 2);
  if (raw && raw !== def) ddWdStages[i].name = raw;
  else delete ddWdStages[i].name;
  el.textContent = ddWdStages[i].name || def;
});

/* Resolves the Social Security mode/inputs into up to two independent
   {annual, delay} streams (primary + spouse). Without a retirement age this
   collapses to exactly the old behavior: one combined amount, one shared
   delay taken from the "Starts after" input. With a retirement age set,
   Manual mode reinterprets that same input as an absolute starting age
   (still one shared stream), while Estimate mode drops it entirely and
   drives each spouse's start straight off their own claiming age \u2014 letting
   the two benefits begin in different years for the first time. */
function ddSSTiming(retireAge) {
  var ssMode = $("ddSSMode").value;
  var couple = ssMode !== "none" && $("ddSSWho").value === "couple";
  var out = { annual: 0, delay: 0, annual2: 0, delay2: 0 };
  if (ssMode === "none") return out;

  if (ssMode === "manual") {
    var amt = num("ddSSAmount");
    if (couple) amt += num("ddSSAmount2");
    out.annual = amt;
    var raw = num("ddSSDelay");
    out.delay = retireAge != null ? Math.max(0, Math.round(raw - retireAge)) : Math.max(0, Math.round(raw));
    return out;
  }

  // Estimate mode, with any spousal top-up as its own stream
  return ssDrawdownStreams(num("ddSSIncome"), num("ddSSClaim"), num("ddSSIncome2"),
    num("ddSSClaim2"), couple, retireAge, num("ddSSDelay"));
}

function readDD() {
  var strat = $("ddStrategy").value;
  var retireAge = ddRetireAgeVal();
  var ssTiming = ddSSTiming(retireAge);
  return {
    initial: num("ddInitial"),
    years: Math.min(60, Math.max(1, Math.round(num("ddYears")))),
    stockPct: Math.min(100, Math.max(0, num("ddStock"))),
    stockPctEnd: (function(){ var v = $("ddStockEnd").value.trim(); return v === "" ? null : Math.min(100, Math.max(0, parseFloat(v) || 0)); })(),
    fee: num("ddFee"),
    strategy: strat,
    initialPct: num("ddRate"),
    wdStages: strat === "fixed" ? ddWdStages.map(function (x) { return Object.assign({}, x); }) : [],
    guardBand: num("ddGuardBand"),
    adjustPct: num("ddAdjust"),
    floorPct: num("ddFloor"),
    ceilPct: num("ddCeil"),
    yaleWeight: Math.min(100, Math.max(0, num("ddYaleWeight"))),
    yaleRate: Math.max(0, num("ddYaleRate")),
    spendFloor: num("ddSpendFloor"),
    spendCeil: num("ddSpendCeil"),
    vpwRate: num("ddVpwRate"),
    vpwFV: num("ddVpwFV"),
    ssAnnual: ssTiming.annual,
    ssDelayYears: ssTiming.delay,
    ssAnnual2: ssTiming.annual2,
    ssDelayYears2: ssTiming.delay2,
    ssAnnual3: ssTiming.annual3 || 0,
    ssDelayYears3: ssTiming.delay3 || 0,
    ssAnnualTotal: ddSSAnnual(),
    legacyGoal: num("ddLegacyGoal") || 0,
    retireAge: retireAge,
    fromYear: HIST_START,
    incomeItems: ddIncomeItems,
    expenseItems: ddExpenseItems
  };
}

const DD_DEFAULTS = {initial:1000000, years:30, stock:60, fee:0, strategy:"fixed", rate:4,
  guardBand:20, adjust:10, floor:10, ceil:10, yaleWeight:70, yaleRate:5, spendFloor:0,
  spendCeil:0, vpwRate:3.8, vpwFV:0,
  stockEnd:"", legacyGoal:0,
  ssMode:"none", ssWho:"single", ssIncome:85000, ssClaim:67, ssIncome2:85000, ssClaim2:67,
  ssAmount:33000, ssAmount2:33000, ssDelay:0, retireAge:""};
/* Raw form state for scenario save/load and Reset \u2014 distinct from readDD(),
   which resolves Social Security to a derived annual dollar figure instead of
   keeping the mode/income/claim-age inputs that produced it. ddIncomeItems and
   ddExpenseItems are mutated in place (never reassigned) because wireItemList()
   closed over these two array references once, at page load. */
function readDDState(){
  return {
    initial:num("ddInitial"), years:num("ddYears"), stock:num("ddStock"), fee:num("ddFee"),
    strategy:$("ddStrategy").value, rate:num("ddRate"),
    guardBand:num("ddGuardBand"), adjust:num("ddAdjust"),
    floor:num("ddFloor"), ceil:num("ddCeil"),
    yaleWeight:num("ddYaleWeight"), yaleRate:num("ddYaleRate"),
    spendFloor:num("ddSpendFloor"),
    spendCeil:num("ddSpendCeil"),
    vpwRate:num("ddVpwRate"), vpwFV:num("ddVpwFV"),
    stockEnd:$("ddStockEnd").value.trim(),
    legacyGoal:num("ddLegacyGoal") || 0,
    ssMode:$("ddSSMode").value, ssWho:$("ddSSWho").value,
    ssIncome:num("ddSSIncome"), ssClaim:num("ddSSClaim"),
    ssIncome2:num("ddSSIncome2"), ssClaim2:num("ddSSClaim2"),
    ssAmount:num("ddSSAmount"), ssAmount2:num("ddSSAmount2"), ssDelay:num("ddSSDelay"),
    retireAge: $("ddRetireAge").value.trim(),
    incomeItems: ddIncomeItems.map(x => Object.assign({}, x)),
    expenseItems: ddExpenseItems.map(x => Object.assign({}, x)),
    wdStages: ddWdStages.map(x => Object.assign({}, x))
  };
}
function writeDDState(d){
  if (d.initial != null) $("ddInitial").value = groupDigits(d.initial, true);
  if (d.years != null) $("ddYears").value = d.years;
  if (d.stock != null) $("ddStock").value = d.stock;
  if (d.fee != null) $("ddFee").value = d.fee;
  if (d.strategy) $("ddStrategy").value = d.strategy;
  if (d.rate != null) $("ddRate").value = d.rate;
  if (d.guardBand != null) $("ddGuardBand").value = d.guardBand;
  if (d.adjust != null) $("ddAdjust").value = d.adjust;
  if (d.floor != null) $("ddFloor").value = d.floor;
  if (d.ceil != null) $("ddCeil").value = d.ceil;
  if (d.yaleWeight != null) $("ddYaleWeight").value = d.yaleWeight;
  if (d.yaleRate != null) $("ddYaleRate").value = d.yaleRate;
  // 0 means "no limit", so it shows as an empty box rather than a $0 limit
  if (d.spendFloor != null) $("ddSpendFloor").value = d.spendFloor > 0 ? groupDigits(d.spendFloor, true) : "";
  if (d.spendCeil != null) $("ddSpendCeil").value = d.spendCeil > 0 ? groupDigits(d.spendCeil, true) : "";
  if (d.vpwRate != null) $("ddVpwRate").value = String(d.vpwRate);
  if (d.vpwFV != null) $("ddVpwFV").value = groupDigits(d.vpwFV, true);
  if (d.stockEnd != null) $("ddStockEnd").value = d.stockEnd;
  if (d.legacyGoal != null) $("ddLegacyGoal").value = d.legacyGoal > 0 ? groupDigits(d.legacyGoal, true) : "";
  if (d.ssMode) $("ddSSMode").value = d.ssMode;
  if (d.ssWho) $("ddSSWho").value = d.ssWho;
  if (d.ssIncome != null) $("ddSSIncome").value = groupDigits(d.ssIncome, true);
  if (d.ssClaim != null) $("ddSSClaim").value = d.ssClaim;
  if (d.ssIncome2 != null) $("ddSSIncome2").value = groupDigits(d.ssIncome2, true);
  if (d.ssClaim2 != null) $("ddSSClaim2").value = d.ssClaim2;
  if (d.ssAmount != null) $("ddSSAmount").value = groupDigits(d.ssAmount, true);
  if (d.ssAmount2 != null) $("ddSSAmount2").value = groupDigits(d.ssAmount2, true);
  if (d.ssDelay != null) $("ddSSDelay").value = d.ssDelay;
  if (d.retireAge != null) $("ddRetireAge").value = d.retireAge;
  if (Array.isArray(d.incomeItems))
    ddIncomeItems.splice(0, ddIncomeItems.length, ...d.incomeItems.map(x => Object.assign({}, x)));
  if (Array.isArray(d.expenseItems))
    ddExpenseItems.splice(0, ddExpenseItems.length, ...d.expenseItems.map(x => Object.assign({}, x)));
  // A full set of inputs (a load, Reset, the guide) replaces the spending
  // stages, clearing them when it has none; a partial fill leaves them be.
  if (Array.isArray(d.wdStages) || d.rate != null){
    ddWdStages.splice(0, ddWdStages.length,
      ...(Array.isArray(d.wdStages) ? d.wdStages : []).map(x => Object.assign({}, x)));
    buildWdStages();
  }
}
function ddSSAnnual() {
  var mode = $("ddSSMode").value;
  if (mode === "none") return 0;
  var couple = $("ddSSWho").value === "couple";
  if (mode === "manual") {
    var amt = num("ddSSAmount");
    if (couple) amt += num("ddSSAmount2");
    return amt;
  }
  if (mode === "est") {
    return ssDrawdownStreams(num("ddSSIncome"), num("ddSSClaim"), num("ddSSIncome2"),
      num("ddSSClaim2"), couple, null, 0).total;
  }
  return 0;
}
/* The historical view is cheap and renders on every keystroke as it always
   has. The Monte Carlo view runs 5,000 retirements and is two orders of
   magnitude heavier, so held keys are coalesced -- the same 160ms treatment
   scheduleMC() already gives the retirement chart. Every other entry point
   (tab switch, mode toggle, scenario load, table click) still calls
   renderDrawdown directly and is unaffected. */
var ddTypeTimer = null;
function renderDrawdownTyping(){
  if (ddMode !== "mc"){ clearTimeout(ddTypeTimer); renderDrawdown(); return; }
  clearTimeout(ddTypeTimer);
  ddTypeTimer = setTimeout(renderDrawdown, 160);
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
  var ssAmt = ddSSAnnual();
  $("ddSSShow").textContent = ssAmt > 0 ? money(ssAmt) + "/yr" : "Not included";
  if (ssMode === "est"){
    var e = ssEstimate(num("ddSSIncome"), 40, Math.min(70, Math.max(62, num("ddSSClaim"))));
    if (ssCouple) {
      var st = ssDrawdownStreams(num("ddSSIncome"), num("ddSSClaim"), num("ddSSIncome2"),
        num("ddSSClaim2"), true, null, 0);
      var m1 = (st.own1 + st.top1) / 12, m2 = (st.own2 + st.top2) / 12;
      $("ddSSEstNote").textContent = "About " + money(m1) + "/mo for you and " + money(m2) +
        "/mo for your spouse, " + money(m1 + m2) + "/mo combined, in today's dollars" +
        (st.top1 + st.top2 > 0 ? ", including a spousal benefit of " + money((st.top1 + st.top2) / 12) +
          "/mo once you've both claimed" : "") + ".";
    } else {
      $("ddSSEstNote").textContent = "About " + money(e.monthly) + " a month in today's dollars, claiming at " +
        Math.round(num("ddSSClaim")) + ".";
    }
  }
  var o = readDD();
  var strat = o.strategy;
  $("ddGuardWrap").hidden = (strat !== "guardrails");
  $("ddFloorWrap").hidden = (strat !== "floorceil");
  $("ddYaleWrap").hidden = (strat !== "yale");
  $("ddSpendFloorWrap").hidden = (strat === "fixed");
  $("ddVpwWrap").hidden = (strat !== "vpw");
  $("ddVpwNote").hidden = (strat !== "vpw");
  $("ddRateWrap").hidden = (strat === "vpw");
  $("ddWdStagesWrap").hidden = (strat !== "fixed");
  var clash = strat !== "fixed" && o.spendFloor > 0 && o.spendCeil > 0 && o.spendFloor > o.spendCeil;
  $("ddSpendNote2").hidden = !clash;
  if (clash) $("ddSpendNote2").textContent = "Your minimum is above your maximum, so the maximum wins.";
  if (strat === "vpw"){
    var conv = (o.stockPct * 5.0 + (100 - o.stockPct) * 1.9) / 100;
    var r1 = o.initial > 0 ? ddFirstYearSpend(o) / o.initial : 0;
    $("ddVpwNote").innerHTML = "Year 1 takes <b>" + pctStr(r1, 2) + "</b>, rising each year as the " +
      "horizon shortens. Bogleheads suggests " + pctStr(conv / 100, 2) + " for a " + o.stockPct + "/" +
      (100 - o.stockPct) + " mix.";
  }

  if (strat === "yale") {
    var w = Math.min(100, Math.max(0, num("ddYaleWeight")));
    var yr = Math.max(0, num("ddYaleRate"));
    $("ddYaleNote").hidden = false;
    $("ddYaleNote").innerHTML = "Each year: <b>" + w + "%</b> of last year's spending (adjusted for inflation) " +
      "plus <b>" + (100 - w) + "%</b> of <b>" + yr + "%</b> of the current portfolio.";
  } else {
    $("ddYaleNote").hidden = true;
  }

  if (strat === "guardrails") {
    var target = o.initialPct;
    var bandV = Math.max(0, num("ddGuardBand"));
    var adjV = Math.max(0, num("ddAdjust"));
    var hiRate = target * (1 + bandV / 100);
    var loRate = target * (1 - bandV / 100);
    $("ddGuardExample").hidden = false;
    $("ddGuardExample").innerHTML = "With a " + pctStr(target / 100, 1) + " target: if your withdrawal " +
      "ever climbs above <b>" + pctStr(hiRate / 100, 1) + "</b> of the portfolio, spending is cut " +
      adjV + "%. If it falls below <b>" + pctStr(loRate / 100, 1) + "</b>, you get a " + adjV + "% raise.";
  } else {
    $("ddGuardExample").hidden = true;
  }
  $("ddRateLabel").textContent = (strat === "pct")
    ? "Percentage taken each year" : "Starting withdrawal rate";
  $("ddMixNote").textContent = o.stockPct + "% stocks / " + (100 - o.stockPct) + "% bonds";

  var firstW = ddFirstYearSpend(o);
  $("ddFirstW").textContent = money(firstW);
  $("ddFirstMo").textContent = money(firstW / 12);
  $("ddRateNote").textContent = o.initial > 0
    ? "That\u0027s " + money(firstW) + " a year (" + money(firstW / 12) + "/mo) on the portfolio above" +
      (strat === "fixed" && ddWdStages.length ? ", " + ddWdSpanText(ddWdBaseEnd(o.years)) : "") +
      ", before income tax. Withdrawals from traditional accounts, and part of Social Security, are taxed, so what you can spend is somewhat less. The Income Tax tool's Retirement income mode shows how much."
    : "Enter your portfolio value above to see this in dollars.";
  if (strat === "fixed") syncWdStages(o);

  if (o.initial <= 0) {
    setBig("ddSuccess", "\u2014"); setBig("ddMedian", "\u2014"); setBig("ddWorst", "\u2014");
    $("ddVerdict").innerHTML = "<div class='hint' style='margin:0'>Enter your portfolio value to run the simulation.</div>";
    return;
  }

  if (ddMode === "hist") {
    var H = historicalBacktest(o);
    if (!H.total) {
      /* The start year has been pulled so far forward that no complete
         retirement of this length fits before the data ends. Say so rather than
         reporting a 0% success rate, which would read as a failure. */
      setBig("ddSuccess", "\u2014"); setBig("ddMedian", "\u2014"); setBig("ddWorst", "\u2014");
      $("ddSuccessNote").textContent = ""; $("ddWorstNote").textContent = "";
      $("ddPeriods").textContent = "no complete runs";
      $("ddBadge").textContent = "\u2014";
      $("ddFromNote").innerHTML = "<b class='warn'>Too long for the " + HIST_START + "\u2013" +
        (HIST_START + HIST_STOCK.length - 1) + " data</b>";
      $("ddVerdict").innerHTML = "<div class='hint' style='margin:0'>Nothing to test: " +
        "a " + o.years + "-year retirement starting in " + o.fromYear +
        " has not finished yet.</div>";
      return;
    }
    $("ddPeriods").textContent = H.total + " start years";
    $("ddFromNote").innerHTML = "<b>" + H.total + "</b> periods, " +
      H.first + "\u2013" + (HIST_START + HIST_STOCK.length - o.years);
    $("ddBadge").textContent = H.first + "\u2013" + (HIST_START + HIST_STOCK.length - 1);
    setBig("ddSuccess", pctStr(H.successRate, 1));
    $("ddSuccess").className = "v " + (H.successRate >= 0.95 ? "pos" : H.successRate >= 0.85 ? "gold" : "neg");
    $("ddSuccessNote").textContent = H.survived + " of " + H.total + " retirements lasted " + o.years + " years";
    setBig("ddMedian", money(H.medianEnd));
    setBig("ddWorst", money(H.worstEnd));
    $("ddWorstNote").textContent = H.failYears.length
      ? "Ran out in " + H.failYears.length + " of " + H.total + " retirements"
      : "Never ran out";

    var verdict;
    if (H.successRate >= 0.99) verdict = "<b class='pos'>This plan survived every historical period.</b> Including the Great Depression, the 1970s stagflation, and the 2008 crash.";
    else if (H.successRate >= 0.90) verdict = "<b class='gold'>This plan survived most historical periods.</b> It failed only when retirement began in " + H.failYears.slice(0, 6).join(", ") + (H.failYears.length > 6 ? " and others" : "") + ", the worst sequences on record.";
    else verdict = "<b class='neg'>This plan ran out of money in " + H.failYears.length + " of " + H.total + " historical periods.</b> Consider a lower withdrawal rate or a strategy that adjusts spending.";
    $("ddVerdict").innerHTML = "<div class='hint' style='margin:0;font-size:13px'>" + verdict + "</div>";

    // Legacy goal
    if (o.legacyGoal > 0) {
      var metLegacy = H.runs.filter(function(r){ return r.endReal >= o.legacyGoal; }).length;
      $("ddLegacyWrap").hidden = false;
      $("ddLegacy").textContent = pctStr(metLegacy / H.runs.length, 1);
      $("ddLegacy").className = "v " + (metLegacy/H.runs.length >= 0.75 ? "pos" : metLegacy/H.runs.length >= 0.5 ? "gold" : "neg");
      $("ddLegacyNote").textContent = metLegacy + " of " + H.total + " periods";
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
    if (ddSelectedYear === null || !H.runs.some(function (r) { return r.startYear === ddSelectedYear; })) {
      var worst = H.runs.slice().sort(function (a, b) { return a.endReal - b.endReal; })[0];
      ddSelectedYear = (H.firstFail || worst).startYear;
    }
    var sortedRuns = H.runs.slice().sort(function (a, b) {
      var av = ddSortValue(a, ddSortCol), bv = ddSortValue(b, ddSortCol);
      var cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
      return ddSortDir === "asc" ? cmp : -cmp;
    });
    $("ddStartTable").querySelector("tbody").innerHTML = sortedRuns.map(function (r) {
      return "<tr class='ddrow" + (r.startYear === ddSelectedYear ? " sel" : "") +
        "' data-year='" + r.startYear + "' tabindex='0'><td>" + r.startYear + "</td><td class='" +
        (r.depleted ? "neg" : "pos") + "'>" +
        ddOutcomeText(r) + "</td><td>" +
        money(r.endReal) + "</td><td>" + money(r.medRealSpend) + "</td><td>" + money(r.minRealSpend) + "</td></tr>";
    }).join("");
    $("ddStartTable").querySelectorAll("th.sortcol").forEach(function (th) {
      th.classList.remove("sort-asc", "sort-desc");
      if (th.getAttribute("data-sort") === ddSortCol) th.classList.add(ddSortDir === "asc" ? "sort-asc" : "sort-desc");
    });

    var show = H.runs.filter(function (r) { return r.startYear === ddSelectedYear; })[0] || H.runs[0];

    // Portfolio balance chart: all years fan or single selected-year line
    var maxY = o.years;
    if (ddView === "all") {
      setH2Text($("ddChartTitle"), "Every historical starting year");
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
        {enhanced:true, traces:{xs:pts.map(function (a) { return a.year; }), lines:ddTraces}});
      histLegend("legendDD");
      $("ddChartNote").hidden = false;
      $("ddChartNote").innerHTML = "Each band covers the range of outcomes across all " + H.total +
        " historical retirements, in today's dollars. The <b>median</b> line is the middle outcome.";
    } else {
      setH2Text($("ddChartTitle"), "Starting in " + ddSelectedYear);
      var singlePts = [{ year: 0, base: o.initial, hi: o.initial, lo: 0 }];
      show.rows.forEach(function (r) {
        singlePts.push({ year: r.year, base: r.realEnd, hi: r.realEnd, lo: 0 });
      });
      ddPoints = paintChart("chartDD", singlePts, maxY, "band", [], ddRetireAge != null ? ddRetireAge : 0, { enhanced: true, noLoLine: true });
      $("legendDD").innerHTML = swatch("#e9b872", "Portfolio balance, in today\u2019s dollars");
      $("ddChartNote").hidden = false;
      $("ddChartNote").innerHTML = "Balance in today\u2019s dollars, retiring in " + ddSelectedYear + ".";
    }

    // "Year by year" detail table (always shows selected year)
    setH2Text($("ddDetailTitle"), "Year by year, retiring in " + show.startYear);
    $("ddDetailNote").innerHTML = "Click any row in the table above to see that period's detail here. " +
      (show.depleted
        ? "This one ran out of money " + (ddRetireAge != null ? "at age " + ddAgeVal(show.depletedYear) : "in year " + show.depletedYear) + "."
        : "This one survived the full " + o.years + " years.");
    $("ddTableYearHeader").textContent = ddRetireAge != null ? "Age" : "Year";
    fillDDTable(show);

    // Income section: follows the same toggle, no separate control
    $("ddSpendYearView").hidden = (ddView !== "year");
    $("ddSpendAllView").hidden = (ddView !== "all");
    if (ddView === "all") {
      setH2Text($("ddIncomeSectionTitle"), "What your income looked like");
      setH2Text($("ddIncomeChartTitle"), "Spending through retirement");
      renderSpendStatsAll(H, o);
      renderIncomeChartAll(H, o);
      $("ddIncomeNote").textContent = "Median, 10th\u201390th and 25th\u201375th percentile spending by " +
        "year of retirement, across all " + H.total + " historical starting years.";
    } else {
      setH2Text($("ddIncomeSectionTitle"), "What your income looked like starting in " + show.startYear);
      setH2Text($("ddIncomeChartTitle"), "Spending through retirement, retiring in " + show.startYear);
      renderSpendStats(show, "Showing the period selected above.");
      renderIncomeChart(show);
      $("ddIncomeNote").textContent = "";
    }

    // Return sensitivity
    $("ddSensPanel").hidden = false;
    (function() {
      var drags = [2, 1, 0, -1];
      var rows = drags.map(function(drag) {
        var oS = Object.assign({}, o, {returnDrag: drag});
        var S = historicalBacktest(oS);
        return {drag:drag, rate:S.successRate, median:S.medianEnd};
      });
      $("ddSensTable").innerHTML = "<table style='width:100%;border-collapse:collapse'>" +
        "<thead><tr><th style='text-align:left;padding:5px 8px;border-bottom:1px solid var(--rule)'>Return assumption</th>" +
        "<th style='text-align:right;padding:5px 8px;border-bottom:1px solid var(--rule)'>Success rate</th>" +
        "<th style='text-align:right;padding:5px 8px;border-bottom:1px solid var(--rule)'>Median ending balance</th></tr></thead><tbody>" +
        rows.map(function(r) {
          var label = r.drag === 0 ? "Baseline (historical)" : (r.drag > 0 ? "-" + r.drag + "% / yr" : "+" + (-r.drag) + "% / yr");
          var wt = r.drag === 0 ? "font-weight:600" : "";
          return "<tr style='" + wt + "'><td style='padding:5px 8px'>" + label + "</td>" +
            "<td style='text-align:right;padding:5px 8px' class='" + (r.rate>=0.95?"pos":r.rate>=0.85?"gold":"neg") + "'>" + pctStr(r.rate, 1) + "</td>" +
            "<td style='text-align:right;padding:5px 8px'>" + money(r.median) + "</td></tr>";
        }).join("") + "</tbody></table>";
    })();

    // SS break-even (estimate mode, single or couple)
    (function() {
      var ssMode = $("ddSSMode").value;
      if (ssMode !== "est" || !(num("ddSSIncome") > 0)) { $("ddSSBreakEvenPanel").hidden = true; return; }
      $("ddSSBreakEvenPanel").hidden = false;
      var testAges = [62, 64, 67, 70];
      var buildSSTable = function(rows) {
        return "<table style='width:100%;border-collapse:collapse'>" +
          "<thead><tr><th style='text-align:left;padding:5px 8px;border-bottom:1px solid var(--rule)'>Claim age</th>" +
          "<th style='text-align:right;padding:5px 8px;border-bottom:1px solid var(--rule)'>Annual benefit</th>" +
          "<th style='text-align:right;padding:5px 8px;border-bottom:1px solid var(--rule)'>Success rate</th>" +
          "<th style='text-align:right;padding:5px 8px;border-bottom:1px solid var(--rule)'>Median ending balance</th></tr></thead><tbody>" +
          rows.map(function(r) {
            var wt = r.current ? "font-weight:600" : "";
            var cur = r.current ? " ◄" : "";
            return "<tr style='" + wt + "'><td style='padding:5px 8px'>Age " + r.age + cur + "</td>" +
              "<td style='text-align:right;padding:5px 8px'>" + money(r.annual) + "/yr</td>" +
              "<td style='text-align:right;padding:5px 8px' class='" + (r.rate>=0.95?"pos":r.rate>=0.85?"gold":"neg") + "'>" + pctStr(r.rate, 1) + "</td>" +
              "<td style='text-align:right;padding:5px 8px'>" + money(r.median) + "</td></tr>";
          }).join("") + "</tbody></table>";
      };
      var ssIncome1 = num("ddSSIncome"), curAge1 = num("ddSSClaim");
      var ssIncome2 = num("ddSSIncome2"), curAge2 = num("ddSSClaim2");
      var ssWho = $("ddSSWho").value, ssBoth = ssWho === "couple";
      // Every stream is rebuilt for each row: moving one spouse's claim can
      // also move when the spousal top-up starts and how much it is.
      var ssOpts = function(st) {
        return {ssAnnual: st.annual, ssDelayYears: st.delay, ssAnnual2: st.annual2,
                ssDelayYears2: st.delay2, ssAnnual3: st.annual3, ssDelayYears3: st.delay3};
      };
      var ssRows1 = testAges.map(function(a) {
        var st = ssDrawdownStreams(ssIncome1, a, ssIncome2, curAge2, ssBoth, o.retireAge, num("ddSSDelay"));
        var S = historicalBacktest(Object.assign({}, o, ssOpts(st)));
        return {age:a, annual:st.own1 + st.top1, rate:S.successRate, median:S.medianEnd, current:a === Math.round(curAge1)};
      });
      if (ssBoth) {
        var ssRows2 = testAges.map(function(a) {
          var st = ssDrawdownStreams(ssIncome1, curAge1, ssIncome2, a, true, o.retireAge, num("ddSSDelay"));
          var S = historicalBacktest(Object.assign({}, o, ssOpts(st)));
          return {age:a, annual:st.own2 + st.top2, rate:S.successRate, median:S.medianEnd, current:a === Math.round(curAge2)};
        });
        $("ddSSBreakEvenTable").innerHTML =
          "<p style='font-weight:600;margin:0 0 6px'>Your claiming age (spouse held constant)</p>" + buildSSTable(ssRows1) +
          "<p style='font-weight:600;margin:12px 0 6px'>Spouse's claiming age (yours held constant)</p>" + buildSSTable(ssRows2);
      } else {
        $("ddSSBreakEvenTable").innerHTML = buildSSTable(ssRows1);
      }
    })();

  } else {
    var trials = 5000;
    var M = monteCarloDrawdown(o, trials, mcSeed);
    $("ddPeriods").textContent = trials.toLocaleString() + " runs";
    $("ddBadge").textContent = trials.toLocaleString() + " simulations";
    setBig("ddSuccess", pctStr(M.successRate, 1));
    $("ddSuccess").className = "v " + (M.successRate >= 0.95 ? "pos" : M.successRate >= 0.85 ? "gold" : "neg");
    $("ddSuccessNote").textContent = M.survived.toLocaleString() + " of " + trials.toLocaleString() + " runs lasted " + o.years + " years";
    setBig("ddMedian", money(M.medianEnd));
    setBig("ddWorst", money(M.p10End));
    $("ddWorstNote").textContent = "10th percentile outcome";
    $("ddVerdict").innerHTML = "<div class='hint' style='margin:0;font-size:13px'>Each run draws " +
      o.years + " years at random from the " + HIST_START + "\u2013" +
      (HIST_START + HIST_STOCK.length - 1) + " record. This captures the range of possible " +
      "returns but not the way bad years actually clustered, which is what the historical view shows.</div>";

    // Legacy goal
    if (o.legacyGoal > 0) {
      var metLegacyMC = M.runs.filter(function(r){ return r.endReal >= o.legacyGoal; }).length;
      $("ddLegacyWrap").hidden = false;
      $("ddLegacy").textContent = pctStr(metLegacyMC / M.runs.length, 1);
      $("ddLegacy").className = "v " + (metLegacyMC/M.runs.length >= 0.75 ? "pos" : metLegacyMC/M.runs.length >= 0.5 ? "gold" : "neg");
      $("ddLegacyNote").textContent = metLegacyMC.toLocaleString() + " of " + M.runs.length.toLocaleString() + " simulations";
    } else {
      $("ddLegacyWrap").hidden = true;
    }

    setH2Text($("ddChartTitle"), "Range of outcomes");
    var mpts = [{ year: 0, base: o.initial, hi: o.initial, lo: o.initial, p25: o.initial, p75: o.initial }];
    M.bands.forEach(function (b) {
      mpts.push({ year: b.year, base: b.p50, hi: b.p90, lo: b.p10, p25: b.p25, p75: b.p75 });
    });
    ddPoints = paintChart("chartDD", mpts, o.years, "mc", [], ddRetireAge != null ? ddRetireAge : 0, {enhanced:true});
    mcLegend("legendDD", null, true);
    $("ddChartNote").hidden = false;
    $("ddChartNote").innerHTML = "Balance in today's dollars across " + trials.toLocaleString() +
      " simulated retirements.";
    $("ddYearsPanel").hidden = true;

    var med = M.runs.slice().sort(function (a, b) { return a.endReal - b.endReal; })[Math.floor(M.runs.length / 2)];
    setH2Text($("ddDetailTitle"), "Year by year, a median run");
    $("ddDetailNote").textContent = "One representative simulation from the middle of the range.";
    fillDDTable(med);

    $("ddViewWrap").hidden = true;
    $("ddSpendYearView").hidden = false;
    $("ddSpendAllView").hidden = true;
    setH2Text($("ddIncomeChartTitle"), "Spending through retirement, a median run");
    renderSpendStats(med, "Showing the same run as the table below.");
    renderIncomeChart(med);
    $("ddIncomeNote").textContent = "";

    // Return sensitivity (MC)
    $("ddSensPanel").hidden = false;
    (function() {
      var drags = [2, 1, 0, -1];
      var rows = drags.map(function(drag) {
        var oS = Object.assign({}, o, {returnDrag: drag});
        var S = monteCarloDrawdown(oS, 500, mcSeed);
        return {drag:drag, rate:S.successRate, median:S.medianEnd};
      });
      $("ddSensTable").innerHTML = "<table style='width:100%;border-collapse:collapse'>" +
        "<thead><tr><th style='text-align:left;padding:5px 8px;border-bottom:1px solid var(--rule)'>Return assumption</th>" +
        "<th style='text-align:right;padding:5px 8px;border-bottom:1px solid var(--rule)'>Success rate</th>" +
        "<th style='text-align:right;padding:5px 8px;border-bottom:1px solid var(--rule)'>Median ending balance</th></tr></thead><tbody>" +
        rows.map(function(r) {
          var label = r.drag === 0 ? "Baseline (sampled)" : (r.drag > 0 ? "-" + r.drag + "% / yr" : "+" + (-r.drag) + "% / yr");
          var wt = r.drag === 0 ? "font-weight:600" : "";
          return "<tr style='" + wt + "'><td style='padding:5px 8px'>" + label + "</td>" +
            "<td style='text-align:right;padding:5px 8px' class='" + (r.rate>=0.95?"pos":r.rate>=0.85?"gold":"neg") + "'>" + pctStr(r.rate, 1) + "</td>" +
            "<td style='text-align:right;padding:5px 8px'>" + money(r.median) + "</td></tr>";
        }).join("") + "</tbody></table>";
    })();

    // SS break-even (MC)
    (function() {
      var ssMode = $("ddSSMode").value;
      if (ssMode !== "est" || !(num("ddSSIncome") > 0)) { $("ddSSBreakEvenPanel").hidden = true; return; }
      $("ddSSBreakEvenPanel").hidden = false;
      var testAges = [62, 64, 67, 70];
      var buildSSTable = function(rows) {
        return "<table style='width:100%;border-collapse:collapse'>" +
          "<thead><tr><th style='text-align:left;padding:5px 8px;border-bottom:1px solid var(--rule)'>Claim age</th>" +
          "<th style='text-align:right;padding:5px 8px;border-bottom:1px solid var(--rule)'>Annual benefit</th>" +
          "<th style='text-align:right;padding:5px 8px;border-bottom:1px solid var(--rule)'>Success rate</th>" +
          "<th style='text-align:right;padding:5px 8px;border-bottom:1px solid var(--rule)'>Median ending balance</th></tr></thead><tbody>" +
          rows.map(function(r) {
            var wt = r.current ? "font-weight:600" : "";
            var cur = r.current ? " ◄" : "";
            return "<tr style='" + wt + "'><td style='padding:5px 8px'>Age " + r.age + cur + "</td>" +
              "<td style='text-align:right;padding:5px 8px'>" + money(r.annual) + "/yr</td>" +
              "<td style='text-align:right;padding:5px 8px' class='" + (r.rate>=0.95?"pos":r.rate>=0.85?"gold":"neg") + "'>" + pctStr(r.rate, 1) + "</td>" +
              "<td style='text-align:right;padding:5px 8px'>" + money(r.median) + "</td></tr>";
          }).join("") + "</tbody></table>";
      };
      var ssIncome1 = num("ddSSIncome"), curAge1 = num("ddSSClaim");
      var ssIncome2 = num("ddSSIncome2"), curAge2 = num("ddSSClaim2");
      var ssWho = $("ddSSWho").value, ssBoth = ssWho === "couple";
      // Every stream is rebuilt for each row: moving one spouse's claim can
      // also move when the spousal top-up starts and how much it is.
      var ssOpts = function(st) {
        return {ssAnnual: st.annual, ssDelayYears: st.delay, ssAnnual2: st.annual2,
                ssDelayYears2: st.delay2, ssAnnual3: st.annual3, ssDelayYears3: st.delay3};
      };
      var ssRows1 = testAges.map(function(a) {
        var st = ssDrawdownStreams(ssIncome1, a, ssIncome2, curAge2, ssBoth, o.retireAge, num("ddSSDelay"));
        var S = monteCarloDrawdown(Object.assign({}, o, ssOpts(st)), 500, mcSeed);
        return {age:a, annual:st.own1 + st.top1, rate:S.successRate, median:S.medianEnd, current:a === Math.round(curAge1)};
      });
      if (ssBoth) {
        var ssRows2 = testAges.map(function(a) {
          var st = ssDrawdownStreams(ssIncome1, curAge1, ssIncome2, a, true, o.retireAge, num("ddSSDelay"));
          var S = monteCarloDrawdown(Object.assign({}, o, ssOpts(st)), 500, mcSeed);
          return {age:a, annual:st.own2 + st.top2, rate:S.successRate, median:S.medianEnd, current:a === Math.round(curAge2)};
        });
        $("ddSSBreakEvenTable").innerHTML =
          "<p style='font-weight:600;margin:0 0 6px'>Your claiming age (spouse held constant)</p>" + buildSSTable(ssRows1) +
          "<p style='font-weight:600;margin:12px 0 6px'>Spouse's claiming age (yours held constant)</p>" + buildSSTable(ssRows2);
      } else {
        $("ddSSBreakEvenTable").innerHTML = buildSSTable(ssRows1);
      }
    })();

  }
}

function fillDDTable(run) {
  // The engine tracks balances in the dollars of the year they occur in
  // (nominal), which is necessary for the math but confusing to read side by
  // side over a long horizon \u2014 50 years of inflation alone can turn a real
  // $20M into a nominal $140M. Every dollar figure here is converted back to
  // today's terms so the table reads consistently with the rest of the app.
  var hasCustomIncome = ddIncomeItems.some(function(it){ return it.on !== false; });
  $("ddOtherIncomeHeader").hidden = !hasCustomIncome;
  $("ddTable").querySelector("tbody").innerHTML = run.rows.map(function (r, i) {
    var prevReal = i === 0 ? r.start : run.rows[i - 1].realEnd;
    var otherCell = hasCustomIncome
      ? "<td>" + (r.customIncome > 0 ? money(r.customIncome) : "\u2014") + "</td>"
      : "";
    return "<tr><td>" + ddAgeVal(r.year) + "</td><td>" + money(prevReal) + "</td><td>" +
      (r.ss > 0 ? money(r.ss) : "\u2014") + "</td>" + otherCell + "<td>" + money(r.withdrawal) +
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
  $("ddSpendMaxCut").textContent = maxCut > 0 ? "\u2212" + money(maxCut) + " in one year" : "None";
  $("ddSpendTotal").textContent = money(total);

  var swing = high > 0 ? (high - low) / high : 0;
  $("ddSpendNote").innerHTML = label + " Spending in today\u0027s dollars ranged from " +
    money(low) + " to " + money(high) + (swing > 0.01
      ? ", a swing of " + pctStr(swing, 0) + " between the best and worst year."
      : ", essentially flat throughout.");
}

/* Line chart of what was actually spent each year, in today's dollars, split
   into the Social Security portion and the portfolio portion. */
function renderIncomeChart(run) {
  var pts = run.rows.map(function (r) {
    var real = r.realSpend != null ? r.realSpend : r.realWithdrawal;
    return { year: r.year, base: real, hi: real, lo: real };
  });
  ddIncomeChartAgg = false;
  var xOff = ddRetireAge != null ? ddRetireAge - 1 : 0;
  if (!pts.length) { paintChart("chartDDI", [], 1, "band", [], xOff, {enhanced:true}); return; }
  ddiPoints = paintChart("chartDDI", pts, pts.length, "band", [], xOff, {enhanced:true});
  $("legendDDI").innerHTML = swatch("#e9b872", "Total spending, in today\u0027s dollars");
}

/* Same idea as the "every historical starting year" balance chart above, but
   for spending: at each year of retirement (year 1, year 2, ...), collect
   that year's real spending across every historical starting-year run and
   take percentiles. This is what "All years" shows instead of one run. */
function renderIncomeChartAll(H, o) {
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
    {enhanced:true, traces:{xs:pts.map(function (a) { return a.year; }), lines:lines}});
  histLegend("legendDDI");
}

/* Aggregate version of renderSpendStats: instead of one run's swings, this
   pools every year of every historical starting-year run to show the full
   range \u2014 the single best and worst years ever seen, and how the total
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
    ? money(totalMin) + " in every one" : money(totalMin) + " \u2013 " + money(totalMax);
  $("ddAggCutsAvg").textContent = cutsAvg.toFixed(1) + " of " + o.years + " years";
  $("ddAggMaxCut").textContent = maxCutEver > 0 ? "\u2212" + money(maxCutEver) + " in one year" : "None";

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
        "<br><span style=\u0027color:#4fbf95\u0027>90th</span> <span class=\u0027n\u0027>" + money(best.hi) +
        "</span><br><span style=\u0027color:#3f9a78\u0027>75th</span> <span class=\u0027n\u0027>" + money(best.p75) +
        "</span><br><span style=\u0027color:#e9b872\u0027>Median</span> <span class=\u0027n\u0027>" + money(best.base) +
        "</span><br><span style=\u0027color:#3f9a78\u0027>25th</span> <span class=\u0027n\u0027>" + money(best.p25) +
        "</span><br><span style=\u0027color:#e2795f\u0027>10th</span> <span class=\u0027n\u0027>" + money(best.lo) + "</span>";
    }
    return "<b>" + lbl + "</b>" +
      "<br><span style=\u0027color:#e9b872\u0027>Spending</span> <span class=\u0027n\u0027>" + money(best.base) + "</span>";
  });

attachChart("chartWrapDD", "chartDD", "tipDD", function () { return ddPoints; },
  function (best) {
    var lbl = ddRetireAge != null ? "Age " + ddAgeValPoint(best.year) : "Year " + fmtNum(best.year);
    if (ddView === "year") {
      return "<b>" + lbl + "</b><br><span class='n'>" + money(best.base) + "</span>";
    }
    return "<b>" + lbl + "</b>" +
      "<br><span style='color:#4fbf95'>90th</span> <span class='n'>" + money(best.hi) +
      "</span><br><span style='color:#3f9a78'>75th</span> <span class='n'>" + money(best.p75) +
      "</span><br><span style='color:#e9b872'>Median</span> <span class='n'>" + money(best.base) +
      "</span><br><span style='color:#3f9a78'>25th</span> <span class='n'>" + money(best.p25) +
      "</span><br><span style='color:#e2795f'>10th</span> <span class='n'>" + money(best.lo) + "</span>";
  });

$("ddStartTable").addEventListener("click", function (e) {
  var th = e.target.closest ? e.target.closest("th.sortcol") : null;
  if (th) {
    var col = th.getAttribute("data-sort");
    if (ddSortCol === col) ddSortDir = ddSortDir === "asc" ? "desc" : "asc";
    else { ddSortCol = col; ddSortDir = "desc"; }
    renderDrawdown();
    return;
  }
  var tr = e.target.closest ? e.target.closest("tr[data-year]") : null;
  if (!tr) return;
  ddSelectedYear = parseInt(tr.getAttribute("data-year"), 10);
  ddView = "year";
  renderDrawdown();
});
$("ddStartTable").addEventListener("keydown", function (e) {
  if (e.key !== "Enter" && e.key !== " ") return;
  var tr = e.target.closest ? e.target.closest("tr[data-year]") : null;
  if (!tr) return;
  e.preventDefault();
  ddSelectedYear = parseInt(tr.getAttribute("data-year"), 10);
  ddView = "year";
  renderDrawdown();
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
["ddInitial", "ddYears", "ddStock", "ddFee", "ddRate", "ddGuardBand", "ddAdjust",
 "ddFloor", "ddCeil", "ddYaleWeight", "ddYaleRate", "ddSpendFloor", "ddSpendCeil",
 "ddVpwRate", "ddVpwFV",
 "ddSSIncome", "ddSSIncome2", "ddSSAmount", "ddSSAmount2", "ddSSDelay",
 "ddStockEnd", "ddLegacyGoal"]
  .forEach(function (id) { $(id).addEventListener("input", renderDrawdownTyping); });
["ddSSClaim", "ddSSClaim2"].forEach(function(id){ $(id).addEventListener("change", renderDrawdown); });
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
$("ddSSMode").addEventListener("change", renderDrawdown);
$("ddSSWho").addEventListener("change", renderDrawdown);
$("segDDView").addEventListener("click", function (e) {
  var b = e.target.closest ? e.target.closest("button[data-ddview]") : null;
  if (!b) return;
  ddView = b.getAttribute("data-ddview");
  renderDrawdown();
});
$("ddStrategy").addEventListener("change", renderDrawdown);
/* All three retirement modes keep their last computed result in the
   background regardless of which tab is currently open, so every source
   that has a real number is offered \u2014 not just whichever one happens to
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

