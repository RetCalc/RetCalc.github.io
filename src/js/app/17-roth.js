/* ---------- Roth conversion tool: form, render, charts ---------- */
const RC_DEFAULTS = {age:62, spouseAge:62, status:"m", state:"IL", endAge:92,
  trad:1500000, roth:150000, brok:400000, basis:60, ret:5, spend:100000,
  ss:36000, ssAge:67, spSS:22000, spSSAge:67, other:0, otherStart:62,
  death:15, strategy:"brk", bracket:"0.22", irmaaTarget:"0", fixed:75000,
  pct:8, startAge:62, stopAge:75, payFrom:"taxable", heir:32, disc:3,
  irmaaOn:"1"};

function readRCState(){
  return {age:num("rcAge"), spouseAge:num("rcSpouseAge"), status:$("rcStatus").value,
    state:$("rcState").value, endAge:num("rcEndAge"), trad:num("rcTrad"),
    roth:num("rcRoth"), brok:num("rcBrok"), basis:num("rcBasis"), ret:num("rcReturn"),
    spend:num("rcSpend"), ss:num("rcSS"), ssAge:num("rcSSAge"), spSS:num("rcSpSS"),
    spSSAge:num("rcSpSSAge"), other:num("rcOther"), otherStart:num("rcOtherStart"),
    death:num("rcDeath"), strategy:$("rcStrategy").value, bracket:$("rcBracket").value,
    irmaaTarget:$("rcIrmaaTier").value, fixed:num("rcFixed"), pct:num("rcPct"),
    startAge:num("rcStartAge"), stopAge:num("rcStopAge"), payFrom:$("rcPayFrom").value,
    heir:num("rcHeir"), disc:num("rcDisc"), irmaaOn:$("rcIrmaaOn").value};
}
function writeRCState(d){
  const M = {trad:"rcTrad", roth:"rcRoth", brok:"rcBrok", spend:"rcSpend",
             ss:"rcSS", spSS:"rcSpSS", other:"rcOther", fixed:"rcFixed"};
  const P = {age:"rcAge", spouseAge:"rcSpouseAge", endAge:"rcEndAge",
             basis:"rcBasis", ret:"rcReturn", ssAge:"rcSSAge", spSSAge:"rcSpSSAge",
             otherStart:"rcOtherStart", death:"rcDeath", pct:"rcPct",
             startAge:"rcStartAge", stopAge:"rcStopAge", heir:"rcHeir", disc:"rcDisc"};
  const S = {status:"rcStatus", state:"rcState", strategy:"rcStrategy",
             bracket:"rcBracket", irmaaTarget:"rcIrmaaTier", payFrom:"rcPayFrom",
             irmaaOn:"rcIrmaaOn"};
  for (const k in M) if (d[k] != null) $(M[k]).value = groupDigits(d[k], true);
  for (const k in P) if (d[k] != null) $(P[k]).value = String(d[k]);
  for (const k in S) if (d[k] != null) $(S[k]).value = String(d[k]);
  syncRCFields();
}
/* Parsed form state, in the shape runRoth() wants. */
/* num() hands back NaN for a field the user has half-cleared, and every
   Math.max/min chain below would carry it straight into the projection. */
function rcClamp(v, lo, hi, fallback){
  const x = Math.round(v);
  if (!isFinite(x)) return fallback;
  return Math.max(lo, Math.min(hi, x));
}
function rcNum(v){ return isFinite(v) ? v : 0; }
function readRC(){
  const s = readRCState();
  const status = s.status === "m" ? "m" : "s";
  const age = rcClamp(s.age, 30, 95, 62);
  return {age,
    spouseAge:rcClamp(s.spouseAge, 30, 105, age),
    status, state:s.state,
    endAge:rcClamp(s.endAge, age + 1, 100, Math.min(100, age + 30)),
    trad:rcNum(s.trad), roth:rcNum(s.roth), brokerage:rcNum(s.brok),
    basisPct:Math.max(0, Math.min(1, rcNum(s.basis) / 100)),
    ret:rcNum(s.ret) / 100, spend:rcNum(s.spend),
    ss:rcNum(s.ss), ssAge:rcClamp(s.ssAge, 62, 70, 67),
    spSS:status === "m" ? rcNum(s.spSS) : 0,
    spSSAge:rcClamp(s.spSSAge, 62, 70, 67),
    other:rcNum(s.other), otherStart:rcClamp(s.otherStart, 30, 100, age),
    deathYear:status === "m" ? rcClamp(s.death, 0, 45, 0) : 0,
    strategy:s.strategy, bracket:parseFloat(s.bracket) || 0.22,
    irmaaTarget:parseInt(s.irmaaTarget, 10) || 0,
    fixedAmt:rcNum(s.fixed), pctAmt:rcNum(s.pct) / 100,
    startAge:rcClamp(s.startAge, 30, 100, age),
    stopAge:rcClamp(s.stopAge, 30, 100, 100),
    payFrom:s.payFrom, heirRate:Math.max(0, Math.min(1, rcNum(s.heir) / 100)),
    disc:rcNum(s.disc) / 100, irmaaOn:s.irmaaOn === "1"};
}
/* Show only the inputs the current choices actually use. */
function syncRCFields(){
  const married = $("rcStatus").value === "m";
  const strat = $("rcStrategy").value;
  $("rcSpouseWrap").hidden = !married;
  $("rcSpouseSSWrap").hidden = !married;
  $("rcDeathWrap").hidden = !married;
  $("rcBracketWrap").hidden = strat !== "brk";
  $("rcIrmaaTierWrap").hidden = strat !== "irm";
  $("rcFixedWrap").hidden = strat !== "fix";
  $("rcPctWrap").hidden = strat !== "pct";
  $("rcWindowWrap").hidden = strat === "none";
  $("rcPayWrap").hidden = strat === "none";
}

let rcPoints = null, rcView = "bal", rcTableView = "plan", rcLast = null;

function renderRoth(){
  syncRCFields();
  const inp = readRC();
  if (!(inp.trad > 0) && !(inp.roth > 0) && !(inp.brokerage > 0)){
    setBig("rcSaved", "\u2014"); return;
  }
  const plan = runRoth(inp, true);
  const base = runRoth(inp, false);
  rcLast = {inp, plan, base};

  // ---- derived input readouts
  $("rcRmdAge").textContent = "Age " + plan.rmdStart;
  const firstRMDRow = plan.rows.find(x => x.rmd > 0);
  $("rcFirstRMD").textContent = firstRMDRow
    ? money(firstRMDRow.rmd, 0) + " at " + firstRMDRow.age : "None in this window";
  const convYears = plan.rows.filter(x => x.conv > 0).length;
  $("rcConvYears").textContent = convYears
    ? fmtNum(convYears) + (convYears === 1 ? " year" : " years") : "None";
  $("rcAvgConv").textContent = convYears
    ? money(plan.totalConv / convYears, 0) + "/yr" : "\u2014";

  // ---- headline
  const taxSaved = base.lifeTaxPV - plan.lifeTaxPV;
  const nwDelta = plan.endAfterTax - base.endAfterTax;
  setBig("rcSaved", (taxSaved >= 0 ? "" : "\u2212") + money(Math.abs(taxSaved)));
  $("rcSaved").className = "v " + (taxSaved >= 0 ? "gold" : "neg");
  $("rcSavedNote").textContent = "Lifetime tax + IRMAA, discounted at " +
    pctStr(inp.disc, 1) + " real";
  setBig("rcNW", (nwDelta >= 0 ? "+" : "\u2212") + money(Math.abs(nwDelta)));
  $("rcNW").className = "v " + (nwDelta >= 0 ? "pos" : "neg");
  $("rcNWNote").textContent = "After-tax, at age " + inp.endAge;
  setBig("rcPeak", money(base.peakRMD, 0));
  $("rcPeakNote").textContent = plan.peakRMD < base.peakRMD
    ? "Converting trims it to " + money(plan.peakRMD, 0)
    : "Unchanged by this plan";

  // ---- verdict
  const verdict = taxSaved >= 0 && nwDelta >= 0
    ? "Converting wins on both measures."
    : taxSaved < 0 && nwDelta < 0
      ? "Converting loses on both measures here."
      : "The two measures disagree; read them together, not separately.";
  $("rcVerdict").innerHTML = "<div class='hint' style='margin:0'>" + verdict +
    " Lifetime tax is what you and your heirs hand over; after-tax net worth is " +
    "what is left standing at age " + inp.endAge + ", with traditional dollars " +
    "discounted at " + pctStr(inp.heirRate, 0) + " because they are still owed to the IRS.</div>";

  // ---- side by side
  $("rcTaxPlan").textContent = money(plan.lifeTax);
  $("rcTaxBase").textContent = money(base.lifeTax);
  $("rcTaxPV").textContent = money(plan.lifeTaxPV) + " vs " + money(base.lifeTaxPV);
  $("rcIrmPlan").textContent = inp.irmaaOn
    ? money(plan.lifeIrmaa) + " vs " + money(base.lifeIrmaa) : "Not included";
  $("rcConvTotal").textContent = money(plan.totalConv);
  $("rcEndTrad").textContent = money(plan.endTrad) + " vs " + money(base.endTrad);
  $("rcEndRoth").textContent = money(plan.endRoth) + " vs " + money(base.endRoth);

  // Break-even: the first year the converting plan's after-tax net worth
  // catches the baseline and stays ahead. Early years always look worse,
  // because the tax is paid up front and the benefit arrives later.
  let be = 0;
  for (let i = 0; i < plan.rows.length; i++){
    if (plan.rows[i].afterTax >= base.rows[i].afterTax){
      const rest = plan.rows.slice(i).every((x, k) => x.afterTax >= base.rows[i + k].afterTax);
      if (rest){ be = plan.rows[i].age; break; }
    }
  }
  $("rcBreakEven").textContent = be
    ? "Age " + be + (be === inp.age ? ", ahead from the start" : "")
    : "Never, within this horizon";

  // ---- widow's penalty callout
  const wRow = plan.rows.find(x => x.widowed);
  $("rcWidow").hidden = !wRow;
  if (wRow){
    const before = plan.rows[Math.max(0, wRow.i - 1)];
    // Say "moves from X to Y" only where something moved; at low incomes
    // the single brackets can leave both the rate and the tax where they were.
    const rateSame = Math.abs(before.marginal - wRow.marginal) < 0.0005;
    const taxSame = Math.abs(before.tax - wRow.tax) < 0.5;
    const rateTxt = rateSame ? "the marginal rate stays at " + pctStr(wRow.marginal, 1)
      : "the marginal rate moves from " + pctStr(before.marginal, 1) + " to " + pctStr(wRow.marginal, 1);
    const taxTxt = taxSame ? "tax that year stays at " + money(wRow.tax)
      : "tax that year goes from " + money(before.tax) + " to " + money(wRow.tax);
    $("rcWidowText").innerHTML = "Filing switches to single at age " + wRow.age +
      ". The same income now meets single brackets and a single standard deduction: " +
      rateTxt + ", and " + taxTxt + ".";
  }

  drawRCChart();
  fillRCTable();
}

function drawRCChart(){
  if (!rcLast) return;
  const {inp, plan, base} = rcLast;
  const pts = [];
  plan.rows.forEach((p, i) => {
    const b = base.rows[i];
    const a = rcView === "bal" ? p.trad : p.tax + p.irmaa;
    const c = rcView === "bal" ? b.trad : b.tax + b.irmaa;
    pts.push({year:p.age - inp.age, base:a, hi:c, lo:Math.min(a, c)});
  });
  rcPoints = paintChart("chartRC", pts, inp.endAge - inp.age, "band", [], 0, {enhanced:true});
  $("legendRC").innerHTML =
    swatch("#e9b872", rcView === "bal" ? "Traditional balance, converting"
                                       : "Tax paid, converting") +
    swatch("#4fbf95", rcView === "bal" ? "Traditional balance, no conversions"
                                       : "Tax paid, no conversions");
  $("rcChartTitle").innerHTML = (rcView === "bal"
    ? "Traditional balance" : "Tax paid each year") +
    "<span class='h2note'>in today's dollars</span>";
  attachChart("chartWrapRC", "chartRC", "tipRC", () => rcPoints, best => {
    return "<b>Age " + fmtNum(inp.age + best.year) + "</b>" +
      "<br><span style='color:#e9b872'>Converting</span> <span class='n'>" +
      money(best.base) + "</span>" +
      "<br><span style='color:#4fbf95'>No conversions</span> <span class='n'>" +
      money(best.hi) + "</span>";
  });
}

function fillRCTable(){
  if (!rcLast) return;
  const R = rcTableView === "plan" ? rcLast.plan : rcLast.base;
  const irmOn = rcLast.inp.irmaaOn;
  $("rcTable").querySelector("tbody").innerHTML = R.rows.map(y =>
    "<tr" + (y.widowed ? " class='rc-widow'" : "") + "><td>" + fmtNum(y.age) +
    "</td><td>" + (y.conv > 0 ? money(y.conv, 0) : "\u2014") +
    "</td><td>" + (y.rmd > 0 ? money(y.rmd, 0) : "\u2014") +
    "</td><td>" + money(y.ordinary, 0) +
    "</td><td>" + money(y.magi, 0) +
    "</td><td>" + money(y.tax, 0) +
    "</td><td>" + (irmOn ? (y.irmaa > 0 ? money(y.irmaa, 0) +
      " <span class='rc-tier'>T" + y.irmaaTier + "</span>" : "\u2014") : "\u2014") +
    "</td><td>" + pctStr(y.marginal, 1) +
    "</td><td>" + money(y.trad, 0) +
    "</td><td>" + money(y.roth, 0) + "</td></tr>").join("");
}

["rcAge","rcSpouseAge","rcEndAge","rcTrad","rcRoth","rcBrok","rcBasis","rcReturn",
 "rcSpend","rcSS","rcSSAge","rcSpSS","rcSpSSAge","rcOther","rcOtherStart","rcDeath",
 "rcFixed","rcPct","rcStartAge","rcStopAge","rcHeir","rcDisc"].forEach(id => {
  $(id).addEventListener("input", renderRoth);
});
["rcStatus","rcState","rcStrategy","rcBracket","rcIrmaaTier","rcPayFrom","rcIrmaaOn"]
  .forEach(id => { $(id).addEventListener("change", renderRoth); });

$("segRC").querySelectorAll("button").forEach(b => {
  b.addEventListener("click", () => {
    rcView = b.getAttribute("data-rc");
    $("segRC").querySelectorAll("button").forEach(x =>
      x.classList.toggle("on", x === b));
    drawRCChart();
  });
});
$("segRCTab").querySelectorAll("button").forEach(b => {
  b.addEventListener("click", () => {
    rcTableView = b.getAttribute("data-rct");
    $("segRCTab").querySelectorAll("button").forEach(x =>
      x.classList.toggle("on", x === b));
    fillRCTable();
  });
});
$("rcCopyDD").addEventListener("click", () => {
  const v = num("ddInitial");
  if (!(v > 0)){ toast("Set a portfolio value in the Drawdown Simulator first"); return; }
  // Split the drawdown portfolio across the three account types in the
  // proportions already on screen here, so the copy doesn't silently invent
  // a tax profile the user never chose.
  const cur = num("rcTrad") + num("rcRoth") + num("rcBrok");
  if (cur > 0){
    $("rcTrad").value = groupDigits((v * num("rcTrad") / cur).toFixed(0), true);
    $("rcRoth").value = groupDigits((v * num("rcRoth") / cur).toFixed(0), true);
    $("rcBrok").value = groupDigits((v * num("rcBrok") / cur).toFixed(0), true);
  } else {
    $("rcTrad").value = groupDigits(v.toFixed(0), true);
  }
  renderRoth();
  toast("Copied " + money(v) + ", split across your current account mix");
});

function buildRothSheet(){
  const inp = readRC();
  if (!(inp.trad > 0)){ $("sheet").innerHTML = "";
    toast("Enter a traditional balance first"); return false; }
  const plan = runRoth(inp, true), base = runRoth(inp, false);
  const taxSaved = base.lifeTaxPV - plan.lifeTaxPV;
  const nwDelta = plan.endAfterTax - base.endAfterTax;

  let inputs = row("Age", fmtNum(inp.age) + (inp.status === "m"
    ? " &middot; spouse " + fmtNum(inp.spouseAge) : ""));
  inputs += row("Filing status", inp.status === "m" ? "Married filing jointly" : "Single");
  inputs += row("State", STATES[inp.state] && STATES[inp.state].n ? STATES[inp.state].n : inp.state);
  inputs += row("Traditional", money(inp.trad));
  inputs += row("Roth", money(inp.roth));
  inputs += row("Brokerage", money(inp.brokerage) + " at " +
    pctStr(inp.basisPct, 0) + " basis");
  inputs += row("Real return", pctStr(inp.ret, 2));
  inputs += row("Annual spending", money(inp.spend));
  inputs += row("RMDs begin", "Age " + plan.rmdStart);

  let strat = row("Strategy", RC_STRATS[inp.strategy]);
  if (inp.strategy === "brk")
    strat += row("Fill to", pctStr(inp.bracket, 0) + " bracket");
  if (inp.strategy === "irm")
    strat += row("Stay within", "IRMAA tier " + inp.irmaaTarget);
  if (inp.strategy !== "none"){
    strat += row("Window", "Ages " + fmtNum(inp.startAge) + "\u2013" + fmtNum(inp.stopAge));
    strat += row("Tax paid from", inp.payFrom === "withhold"
      ? "Withheld from the conversion" : "Taxable account");
  }
  strat += row("Heir rate on traditional", pctStr(inp.heirRate, 0));
  strat += row("Discount rate", pctStr(inp.disc, 1) + " real");

  let out = row("Lifetime tax, converting", money(plan.lifeTax));
  out += row("Lifetime tax, no conversions", money(base.lifeTax));
  out += row("Present value saved", money(taxSaved));
  out += row("Total converted", money(plan.totalConv));
  if (inp.irmaaOn)
    out += row("Lifetime IRMAA", money(plan.lifeIrmaa) + " vs " + money(base.lifeIrmaa));
  out += row("Traditional at " + fmtNum(inp.endAge),
    money(plan.endTrad) + " vs " + money(base.endTrad));
  out += row("Peak RMD", money(base.peakRMD) + " \u2192 " + money(plan.peakRMD));

  const src = $("chartRC");
  let chart = "";
  if (src && src.childNodes.length){
    const clone = src.cloneNode(true);
    lighten(clone); clone.removeAttribute("style");
    chart = "<div class='sh-chart'>" + clone.outerHTML + "</div>";
  }

  const step = plan.rows.length <= 15 ? 1 : plan.rows.length <= 30 ? 2 : 3;
  const picked = plan.rows.filter((y, i) =>
    i === 0 || i === plan.rows.length - 1 || y.conv > 0 || i % step === 0);
  let table = "<table><thead><tr><th>Age</th><th>Converted</th><th>RMD</th>" +
    "<th>MAGI</th><th>Tax</th><th>Marginal</th><th>Traditional</th><th>Roth</th>" +
    "</tr></thead><tbody>";
  picked.forEach(y => {
    table += "<tr><td>" + y.age + "</td><td>" + (y.conv > 0 ? money(y.conv) : "\u2014") +
      "</td><td>" + (y.rmd > 0 ? money(y.rmd) : "\u2014") +
      "</td><td>" + money(y.magi) + "</td><td>" + money(y.tax) +
      "</td><td>" + pctStr(y.marginal, 1) + "</td><td>" + money(y.trad) +
      "</td><td>" + money(y.roth) + "</td></tr>";
  });
  table += "</tbody></table>";

  $("sheet").innerHTML =
    "<div class='sh-h'>" + SHEET_MARK + "<h1>Roth Conversion &amp; RMDs</h1><span>Ages " +
      fmtNum(inp.age) + "\u2013" + fmtNum(inp.endAge) + " &middot; today's dollars</span></div>" +
    "<div class='sh-big'>" +
      "<div><div class='k'>Lifetime tax saved</div><div class='v'>" + money(taxSaved) +
        "</div><div class='n'>present value</div></div>" +
      "<div><div class='k'>After-tax net worth</div><div class='v'>" +
        (nwDelta >= 0 ? "+" : "\u2212") + money(Math.abs(nwDelta)) +
        "</div><div class='n'>at age " + fmtNum(inp.endAge) + "</div></div>" +
      "<div><div class='k'>Total converted</div><div class='v'>" + money(plan.totalConv) +
        "</div><div class='n'>over " + fmtNum(plan.rows.filter(x => x.conv > 0).length) +
        " years</div></div>" +
    "</div>" + chart +
    "<div class='sh-cols'>" +
      "<section><div class='sh-t'>Your situation</div>" + inputs + "</section>" +
      "<section><div class='sh-t'>The plan</div>" + strat + "</section>" +
      "<section><div class='sh-t'>Converting vs. not</div>" + out + "</section>" +
    "</div>" +
    "<div class='sh-table'><div class='sh-t'>Year by year, converting</div>" + table + "</div>" +
    "<div class='sh-foot'>Estimates only. Brackets, the standard deduction and the " +
    "IRMAA thresholds are held fixed in real terms, and every figure is in today's " +
    "dollars. Not tax advice.</div>";
}


