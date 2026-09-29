/* ---------- debt payoff: form, render, comparison ---------- */
/* Deliberately chosen so the smallest balance is not also the highest rate --
   otherwise avalanche and snowball pick the same order and the comparison the
   tool is built around has nothing to show. */
const DEBT_DEFAULTS = [
  {desc:"Credit card",  balance:9800,  apr:22.9, min:245},
  {desc:"Store card",   balance:1900,  apr:8.9,  min:60},
  {desc:"Car loan",     balance:16200, apr:7.4,  min:395},
  {desc:"Student loan", balance:21500, apr:5.5,  min:230}
];
function defaultDebts(){ return DEBT_DEFAULTS.map(d => Object.assign({}, d)); }
let debts = defaultDebts();
let dtMode = "avalanche";

function buildDebtList(){
  $("dtList").innerHTML = debts.map((r, i) =>
    "<div class='dtrow'>" +
      "<input class='desc' data-f='desc' data-i='" + i + "' value='" +
        String(r.desc).replace(/'/g, "&#39;") + "' placeholder='Name' aria-label='Debt name'>" +
      "<div class='inputwrap c1'><span class='affix'>$</span><input type='text' inputmode='decimal' " +
        "data-money data-nonneg data-f='balance' data-i='" + i + "' value='" +
        groupDigits(r.balance, true) + "' aria-label='Balance'></div>" +
      "<div class='inputwrap c2'><input type='text' inputmode='decimal' data-num data-step='0.1' " +
        "min='0' data-nonneg data-f='apr' data-i='" + i + "' value='" + r.apr +
        "' aria-label='Rate'><span class='affix'>%</span></div>" +
      "<div class='inputwrap c3'><span class='affix'>$</span><input type='text' inputmode='decimal' " +
        "data-money data-nonneg data-f='min' data-i='" + i + "' value='" +
        groupDigits(r.min, true) + "' aria-label='Minimum payment'></div>" +
      (debts.length > 1
        ? "<button class='del' type='button' data-del='" + i + "' title='Remove' aria-label='Remove'>\u00d7</button>"
        : "<span class='delspace'></span>") +
    "</div>").join("");
  initFields($("dtList"));
}

let dtPoints = null, dtLast = null;

function renderDebt(){
  const extra = Math.max(0, num("dtExtra") || 0);
  const live = debts.filter(d => d.balance > 0);
  if (!live.length){
    setBig("dtFree", "\u2014"); $("dtFreeNote").textContent = "Add a debt to start";
    setBig("dtInterest", "\u2014"); setBig("dtSaved", "\u2014");
    $("dtWarn").hidden = true;
    ["dtCompare","dtOrder","dtSched"].forEach(t =>
      $(t).querySelector("tbody").innerHTML = "");
    return;
  }

  const av = debtRun(debts, extra, "avalanche");
  const sn = debtRun(debts, extra, "snowball");
  const mn = debtRun(debts, 0, "min");
  const pick = dtMode === "snowball" ? sn : av;
  const other = dtMode === "snowball" ? av : sn;
  dtLast = {pick, mn, extra};

  // A minimum that doesn't cover interest is the only genuinely broken input
  // here, and it invalidates every number below it.
  const under = debtUnderwater(debts);
  $("dtWarn").hidden = !under.length;
  if (under.length)
    $("dtWarn").innerHTML = "<b>" + under.map(u => u.desc).join(", ") +
      "</b>: the minimum doesn't cover one month of interest, so that balance grows " +
      "on its own. The payoff below only works because of the extra payment; " +
      "check the minimum you entered.";

  setBig("dtFree", pick.stalled ? "Never" : debtDate(pick.monthsTotal));
  $("dtFreeNote").textContent = pick.stalled
    ? "Payments never clear the balance"
    : debtDur(pick.monthsTotal) + " from now";
  setBig("dtInterest", money(pick.totalInterest));
  $("dtInterestNote").textContent = "on " + money(live.reduce((a, d) => a + d.balance, 0)) +
    " borrowed, " + money(pick.totalPaid) + " paid in all";

  const saved = mn.totalInterest - pick.totalInterest;
  const sooner = mn.monthsTotal - pick.monthsTotal;
  setBig("dtSaved", money(Math.max(0, saved)));
  $("dtSaved").className = "v " + (saved > 0 ? "pos" : "");
  $("dtSavedNote").textContent = mn.stalled
    ? "Minimums alone never clear it"
    : sooner > 0 ? debtDur(sooner) + " sooner" : "Same as minimums";

  $("dtStratNote").textContent = dtMode === "snowball"
    ? "Smallest balance first: quicker wins, usually more interest."
    : "Highest rate first: mathematically cheapest.";

  // ---- verdict: the real trade-off between the two orderings
  const dInt = sn.totalInterest - av.totalInterest;
  const dMon = sn.monthsTotal - av.monthsTotal;
  const dFirst = sn.firstCleared - av.firstCleared;
  let v;
  if (Math.abs(dInt) < 1 && dMon === 0){
    v = "With these debts the two orderings land in the same place; pick whichever " +
      "you'll actually stick to.";
  } else {
    v = "Avalanche costs " + money(Math.abs(dInt)) + " less in interest" +
      (dMon > 0 ? " and finishes " + debtDur(dMon) + " sooner" : "") + ". ";
    v += dFirst < 0
      ? "Snowball clears your first debt " + debtDur(-dFirst) + " earlier. That early " +
        "win is the whole argument for it, and here it costs " + money(Math.abs(dInt)) + "."
      : "Snowball offers nothing in return here: it clears the first debt no sooner.";
  }
  const rate = live.reduce((a, d) => a + d.balance * d.apr, 0) /
               live.reduce((a, d) => a + d.balance, 0);
  v += " Your blended rate is " + pctStr(rate / 100, 1) + " across " + live.length +
    (live.length === 1 ? " debt" : " debts") + ", and you're putting " +
    money(pick.monthlyPool, 0) + " a month at it.";

  // A dollar of extra payment is the most underrated lever in the whole thing.
  const bump = debtRun(debts, extra + 100, dtMode);
  if (bump && !bump.stalled && !pick.stalled && bump.monthsTotal < pick.monthsTotal)
    v += " Another $100 a month would clear it " +
      debtDur(pick.monthsTotal - bump.monthsTotal) + " sooner and save " +
      money(pick.totalInterest - bump.totalInterest) + " more.";
  $("dtVerdict").innerHTML = "<div class='hint' style='margin:0 0 12px'>" + v + "</div>";

  // ---- comparison table
  const cmp = [["Avalanche, highest rate first", av],
               ["Snowball, smallest balance first", sn],
               ["Minimums only, no extra", mn]];
  $("dtCompare").querySelector("tbody").innerHTML = cmp.map(([label, R]) => {
    const best = R === av && av.totalInterest <= sn.totalInterest;
    return "<tr><td>" + label + "</td><td>" +
      (R.stalled ? "Never" : debtDate(R.monthsTotal)) + "</td><td>" +
      (R.stalled ? "\u2014" : debtDur(R.monthsTotal)) + "</td><td" +
      (best ? " class='pos'" : "") + ">" + money(R.totalInterest) + "</td><td>" +
      (R.firstCleared ? debtDur(R.firstCleared) : "\u2014") + "</td></tr>";
  }).join("");

  // ---- payoff order
  $("dtOrder").querySelector("tbody").innerHTML = pick.order.map((d, i) =>
    "<tr><td>" + (i + 1) + "</td><td>" + d.desc + "</td><td>" + money(d.start) +
    "</td><td>" + pctStr(d.apr, 2) + "</td><td>" + money(d.min) +
    "</td><td>" + money(d.interest) + "</td><td>" +
    (d.paidMonth ? debtDate(d.paidMonth) : "Not cleared") + "</td></tr>").join("");

  // ---- schedule, thinned so a long plan stays scannable
  const step = pick.months.length <= 30 ? 1 : pick.months.length <= 72 ? 3 : 6;
  $("dtSched").querySelector("tbody").innerHTML = pick.months
    .filter((x, i) => i === 0 || i === pick.months.length - 1 || i % step === 0)
    .map(x => "<tr><td>" + x.m + "</td><td>" + debtDate(x.m) + "</td><td>" +
      money(x.balance) + "</td><td>" + money(x.interest) + "</td><td>" +
      x.cleared + " of " + live.length + "</td></tr>").join("");

  drawDebtChart();
}

function drawDebtChart(){
  if (!dtLast) return;
  const {pick, mn} = dtLast;
  const span = Math.max(pick.months.length, Math.min(mn.months.length, DEBT_CAP));
  const at = (R, m) => {
    const row = R.months[Math.min(m, R.months.length - 1)];
    return m >= R.months.length ? 0 : row.balance;
  };
  const pts = [];
  for (let m = 0; m < span; m++)
    pts.push({year:m, base:at(pick, m), hi:at(mn, m),
              lo:Math.min(at(pick, m), at(mn, m))});
  dtPoints = paintChart("chartDT", pts, span - 1, "band", [], 0, {enhanced:true});
  $("legendDT").innerHTML =
    swatch("#e9b872", dtMode === "snowball" ? "Snowball" : "Avalanche") +
    swatch("#4fbf95", "Minimums only");
  attachChart("chartWrapDT", "chartDT", "tipDT", () => dtPoints, best =>
    "<b>Month " + fmtNum(best.year) + "</b> <span class='n'>" + debtDate(best.year) + "</span>" +
    "<br><span style='color:#e9b872'>Your plan</span> <span class='n'>" + money(best.base) + "</span>" +
    "<br><span style='color:#4fbf95'>Minimums</span> <span class='n'>" + money(best.hi) + "</span>");
}

$("dtList").addEventListener("input", e => {
  const el = e.target;
  const f = el.getAttribute("data-f"), i = parseInt(el.getAttribute("data-i"), 10);
  if (!f || isNaN(i) || !debts[i]) return;
  debts[i][f] = (f === "desc") ? el.value : parseNum(el.value);
  renderDebt();
});
$("dtList").addEventListener("click", e => {
  const b = e.target.closest ? e.target.closest("[data-del]") : null;
  if (!b) return;
  const i = parseInt(b.getAttribute("data-del"), 10);
  if (isNaN(i)) return;
  debts.splice(i, 1);
  if (!debts.length) debts = [{desc:"Debt", balance:0, apr:0, min:0}];
  buildDebtList(); renderDebt();
});
$("dtAdd").addEventListener("click", () => {
  debts.push({desc:"New debt", balance:0, apr:0, min:0});
  buildDebtList(); renderDebt();
  const rows = $("dtList").querySelectorAll(".dtrow input.desc");
  if (rows.length) rows[rows.length - 1].focus();
});
$("dtExtra").addEventListener("input", renderDebt);
/* Carries the plan's ending balance, in today's dollars, in as the
   Drawdown Simulator's starting portfolio. */
/* From either account table to the Income Tax tool's retirement mode, with
   that table's first-year withdrawals, brokerage gain share, filing status,
   state and 65+ count. Other income starts at zero, so the tool opens on the
   same tax the table shows and Social Security or a pension can be added. */
document.addEventListener("click", e => {
  const a = e.target.closest ? e.target.closest("a.txlink") : null;
  if (!a) return;
  e.preventDefault();
  const B = a.getAttribute("data-txfrom") === "acResults" ? lastAcct : lastStageAcct;
  if (!B) return;
  const r = v => Math.round(v || 0);
  writeTaxState({mode:"retire", status:B.a.status, state:B.a.state,
    trad:r(B.w.trad), roth:r(B.w.roth), brok:r(B.w.brok),
    gainPct: Math.round(B.gainPct * 1000) / 10, seniors: B.seniors || 0,
    ss:0, pension:0, other:0, pre:0, dedType:"std", item:0});
  showTab("tools"); showTool("tax");
  renderTax();
  toast("Loaded your first-year withdrawals into Income Tax");
});
$("toDrawdown").addEventListener("click", () => {
  const R = project(readInputs());
  $("ddInitial").value = groupDigits(Math.round(R.fvReal), true);
  showTab("tools"); showTool("drawdown");
  renderDrawdown();
  toast("Portfolio set to " + money(R.fvReal) + ", your balance in today's dollars");
});
$("segDT").querySelectorAll("button").forEach(b => {
  b.addEventListener("click", () => {
    dtMode = b.getAttribute("data-dt");
    $("segDT").querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
    renderDebt();
  });
});
$("dtCopyBudget").addEventListener("click", () => {
  const incomeYr = num("bgIncomeIn") * bgIncomeFreq;
  const spentYr = budget.reduce((a, r) => a + annualize(r), 0);
  const leftMo = (incomeYr - spentYr) / 12;
  if (!(leftMo > 0)){ toast("No money left over in the budget to put at debt"); return; }
  $("dtExtra").value = groupDigits(leftMo.toFixed(0), true);
  renderDebt();
  toast("Using " + money(leftMo, 0) + "/mo left over from your budget");
});

function readDebtState(){
  return {extra:num("dtExtra"), mode:dtMode,
    rows:debts.map(d => ({desc:d.desc, balance:d.balance, apr:d.apr, min:d.min}))};
}
function writeDebtState(d){
  if (d.extra != null) $("dtExtra").value = groupDigits(d.extra, true);
  if (d.mode){
    dtMode = d.mode === "snowball" ? "snowball" : "avalanche";
    $("segDT").querySelectorAll("button").forEach(x =>
      x.classList.toggle("on", x.getAttribute("data-dt") === dtMode));
  }
  if (Array.isArray(d.rows) && d.rows.length)
    debts = d.rows.map(r => Object.assign({}, r));
  buildDebtList();
}

function buildDebtSheet(){
  const live = debts.filter(d => d.balance > 0);
  if (!live.length){ $("sheet").innerHTML = ""; toast("Add a debt first"); return false; }
  const extra = Math.max(0, num("dtExtra") || 0);
  const av = debtRun(debts, extra, "avalanche");
  const sn = debtRun(debts, extra, "snowball");
  const mn = debtRun(debts, 0, "min");
  const pick = dtMode === "snowball" ? sn : av;
  const owed = live.reduce((a, d) => a + d.balance, 0);

  let inputs = row("Total owed", money(owed));
  inputs += row("Number of debts", String(live.length));
  inputs += row("Minimum payments", money(pick.baseMin) + "/mo");
  inputs += row("Extra payment", money(extra) + "/mo");
  inputs += row("Total going at debt", money(pick.monthlyPool) + "/mo");
  inputs += row("Strategy", dtMode === "snowball"
    ? "Snowball, smallest balance first"
    : "Avalanche, highest rate first");

  let out = row("Debt-free", pick.stalled ? "Never" : debtDate(pick.monthsTotal));
  out += row("How long", pick.stalled ? "\u2014" : debtDur(pick.monthsTotal));
  out += row("Total interest", money(pick.totalInterest));
  out += row("Total paid", money(pick.totalPaid));
  out += row("Interest saved vs. minimums", money(Math.max(0, mn.totalInterest - pick.totalInterest)));

  let cmp = row("Avalanche interest", money(av.totalInterest));
  cmp += row("Snowball interest", money(sn.totalInterest));
  cmp += row("Difference", money(Math.abs(sn.totalInterest - av.totalInterest)));
  cmp += row("Minimums only", mn.stalled ? "Never clears" : money(mn.totalInterest));
  cmp += row("First debt gone", debtDur(pick.firstCleared));

  const src = $("chartDT");
  let chart = "";
  if (src && src.childNodes.length){
    const clone = src.cloneNode(true);
    lighten(clone); clone.removeAttribute("style");
    chart = "<div class='sh-chart'>" + clone.outerHTML + "</div>";
  }

  let table = "<table><thead><tr><th>#</th><th>Debt</th><th>Balance</th><th>Rate</th>" +
    "<th>Minimum</th><th>Interest paid</th><th>Cleared</th></tr></thead><tbody>";
  pick.order.forEach((d, i) => {
    table += "<tr><td>" + (i + 1) + "</td><td>" + d.desc + "</td><td>" + money(d.start) +
      "</td><td>" + pctStr(d.apr, 2) + "</td><td>" + money(d.min) + "</td><td>" +
      money(d.interest) + "</td><td>" +
      (d.paidMonth ? debtDate(d.paidMonth) : "Not cleared") + "</td></tr>";
  });
  table += "</tbody></table>";

  $("sheet").innerHTML =
    "<div class='sh-h'>" + SHEET_MARK + "<h1>Debt Payoff</h1><span>" + money(owed) + " across " +
      live.length + (live.length === 1 ? " debt" : " debts") + "</span></div>" +
    "<div class='sh-big'>" +
      "<div><div class='k'>Debt-free</div><div class='v'>" +
        (pick.stalled ? "Never" : debtDate(pick.monthsTotal)) +
        "</div><div class='n'>" + debtDur(pick.monthsTotal) + " from now</div></div>" +
      "<div><div class='k'>Total interest</div><div class='v'>" + money(pick.totalInterest) +
        "</div><div class='n'>" + money(pick.totalPaid) + " paid in all</div></div>" +
      "<div><div class='k'>Saved vs. minimums</div><div class='v'>" +
        money(Math.max(0, mn.totalInterest - pick.totalInterest)) +
        "</div><div class='n'>in interest</div></div>" +
    "</div>" + chart +
    "<div class='sh-cols'>" +
      "<section><div class='sh-t'>The debts</div>" + inputs + "</section>" +
      "<section><div class='sh-t'>Your plan</div>" + out + "</section>" +
      "<section><div class='sh-t'>Avalanche vs. snowball</div>" + cmp + "</section>" +
    "</div>" +
    "<div class='sh-table'><div class='sh-t'>Payoff order</div>" + table + "</div>" +
    "<div class='sh-foot'>Assumes fixed minimums, fixed rates, and no new borrowing. " +
    "Card minimums usually fall as the balance does, which makes real payoff slower " +
    "than this unless you keep paying the original amount. Not financial advice.</div>";
}

