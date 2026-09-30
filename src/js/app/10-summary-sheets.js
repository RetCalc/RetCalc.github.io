/* ---------- one-page summary ---------- */
/* Built on demand into a light-themed sheet that only the print stylesheet
   shows, so the browser's own "Save as PDF" does the export. No dependencies,
   and it works on iOS through Share > Print. */
/* The chart emits structural colors from the active theme, so the print swap is
   built at call time from the current variable values mapped to a fixed light
   palette. This keeps the sheet readable whichever theme is on screen. */
function lighten(node){
  const swap = {};
  swap[cssVar("--grid").toLowerCase()] = "#e2e5e3";
  swap[cssVar("--axis").toLowerCase()] = "#666e73";
  swap[cssVar("--stageline").toLowerCase()] = "#9aa5ab";
  swap[cssVar("--dotstroke").toLowerCase()] = "#ffffff";
  swap[cssVar("--bg").toLowerCase()] = "#ffffff";
  const walk = nd => {
    ["stroke","fill"].forEach(a => {
      const v = nd.getAttribute && nd.getAttribute(a);
      if (v && swap[v.toLowerCase()]) nd.setAttribute(a, swap[v.toLowerCase()]);
    });
    for (let i = 0; i < nd.childNodes.length; i++) walk(nd.childNodes[i]);
  };
  walk(node);
}
function row(k, v){ return "<div class='sh-r'><span>" + k + "</span><b>" + v + "</b></div>"; }

/* Split by account type, the summary lists the three starting balances
   rather than one total. */
function acSheetRows(a, total){
  if (!a) return row("Starting value", money(total));
  return row("Traditional balance", money(a.tradBal)) + row("Roth balance", money(a.rothBal)) +
    row("Brokerage balance", money(a.brokBal));
}
/* The printed summaries carry the logo beside their title, in the deeper
   light-theme hues so it holds up on paper. */
const SHEET_MARK = "<svg class='sh-mark' viewBox='4 4 56 56' aria-hidden='true'><g transform='rotate(-45 32 32)'>" +
  "<path d='M33 7 L11.5 28.5 M33 57 L11.5 35.5' fill='none' stroke='#5a81c3' stroke-width='2'/>" +
  "<path d='M33 7 C31 10 34 13 39 17 Q53 32 39 47 C34 51 31 54 33 57' fill='none' stroke='#2a9e73' stroke-width='4.5' stroke-linecap='round' stroke-linejoin='round'/>" +
  "<path d='M7 32 H51' stroke='#c1861e' stroke-width='3.2' stroke-linecap='round'/>" +
  "<path d='M60 32 L48 25.5 L50.5 32 L48 38.5 Z M11 32 L6 25.5 H11 L18 32 Z M11 32 L6 38.5 H11 L18 32 Z' fill='#c1861e'/></g></svg>";

function buildSheet(){
  if (!$("tab-guide").hidden) return gdGuideSheet();
  if (!$("tab-tax").hidden) return buildTaxSheet();
  if (!$("tab-mortgage").hidden) return buildMortSheet();
  if (!$("tab-budget").hidden) return buildBudgetSheet();
  if (!$("tab-college").hidden) return buildCollegeSheet();
  if (!$("tab-rentbuy").hidden) return buildRentBuySheet();
  if (!$("tab-drawdown").hidden) return buildDrawdownSheet();
  if (!$("tab-roth").hidden) return buildRothSheet();
  if (!$("tab-bridge").hidden) return buildBridgeSheet();
  if (!$("tab-debt").hidden) return buildDebtSheet();
  if (!$("tab-simple").hidden) return buildBasicSheet();
  const series = !$("tab-series").hidden;
  const g = readGlobals(), p = readInputs();
  const R = series ? projectSeries(g, effectiveStages(g)) : project(p);
  const infl = series ? g.inflation : p.inflation;
  const years = series ? R.totalYears : p.years;

  let inputs = "";
  if (series){
    inputs += acSheetRows(g.acct, g.initial);
    inputs += row("Inflation", pctStr(g.inflation, 2));
    inputs += row("Withdrawal rate", pctStr(g.withdrawal, 2));
    inputs += row(g.acct ? "Tax on withdrawals, calculated" : "Effective tax rate", pctStr(g.taxRate, 2));
    if (g.fees > 0) inputs += row("Fees", pctStr(g.fees, 2));
    // Capped so a plan with many stages can't push the sheet onto a second
    // page; a "+N more" line is honest about what got left off.
    const allStages = effectiveStages(g);
    allStages.slice(0, 5).forEach((st, i) => {
      inputs += row("Stage " + (i+1) + " &middot; " + fmtNum(st.years) + " yrs",
        money(st.contrib, 0) + " " + st.period.toLowerCase() + " @ " + pctStr(st.nominal, 2));
    });
    if (allStages.length > 5)
      inputs += "<div class='sh-more'>+ " + (allStages.length - 5) + " more stage" +
        (allStages.length - 5 === 1 ? "" : "s") + "</div>";
  } else {
    inputs += acSheetRows(p.acct, p.initial);
    inputs += row(p.acct ? "Contribution, with match" : "Contribution", money(p.contrib, 2) + " " + p.period.toLowerCase());
    inputs += row("Contribution growth", pctStr(p.growth, 2) + " / yr" +
      (p.acct && p.acct.gRates ? " blended (traditional " + pctStr(p.acct.gRates.t, 2) +
        ", Roth " + pctStr(p.acct.gRates.r, 2) + ", taxable " + pctStr(p.acct.gRates.b, 2) + ")" : ""));
    inputs += row("Time period", fmtNum(p.years) + " years");
    inputs += row("Rate of return", pctStr(p.gross, 2));
    if (p.fees > 0) inputs += row("Fees", "\u2212" + pctStr(p.fees, 2));
    inputs += row("Inflation", pctStr(p.inflation, 2));
    inputs += row("Withdrawal rate", pctStr(p.withdrawal, 2));
    inputs += row(p.acct ? "Tax on withdrawals, calculated" : "Effective tax rate", pctStr(p.taxRate, 2));
  }

  let out = "";
  out += row("Amount invested", money(R.invested));
  out += row("Growth", money(R.growth));
  const lastPer = series ? R.lastPeriod : p.period;
  out += row("Final contribution, inflation adj.", lastPer
    ? money(R.lastContribReal) + " " + PERIOD_ADV[lastPer] : money(0));
  out += row("Future value", money(R.fv));
  out += row("Inflation adjusted", money(R.fvReal));
  out += row("Annual withdrawal", money(R.wdReal) + " (adj.)");
  out += row("After tax, per year", money(R.afterTax));
  out += row("After tax, per month", money(R.afterTaxMo));

  const rows = series
    ? R.calRows.map(r => ({year:r.year, end:r.end, growth:r.growth, contrib:r.contrib}))
    : R.years.map(y => ({year:y.year, end:y.end, growth:y.growth, contrib:y.contrib}));
  const cross = rows.find(r => r.growth > r.contrib && r.contrib > 0);
  let ms = row("Crossover year", cross ? "Year " + fmtNum(cross.year) : "\u2014");
  MS_LADDER.filter(v => v <= R.fv).slice(-4).forEach(v => {
    const hit = rows.find(r => r.end >= v);
    ms += row("Reaches " + money(v), hit ? "Year " + fmtNum(hit.year) : "\u2014");
  });

  // Goal-solve and Coast FIRE, single-run only \u2014 this is where they live
  // on screen, and both are genuinely useful reference numbers when present.
  let goalSection = "";
  if (!series){
    const solveFor = $("solveFor").value;
    const S = goalSolve(acSolveP(p), solveFor, num("target"));
    const C = coastFire(p, S.portFuture);
    let goal = row("Target", solveFor === "After-Tax Withdrawal"
      ? money(num("target")) + "/yr after tax" : money(num("target")));
    goal += row("Portfolio needed", money(S.portToday));
    goal += row("Raise contribution to", money(S.perPeriod, 2) + " " + p.period.toLowerCase());
    goal += row("Or extend timeline to", solveYears(p, S.portToday).reached
      ? fmtYears(solveYears(p, S.portToday).years) : "Not reached in 100 yrs");
    goal += row("Coast FIRE", C.state === "already" ? "Already there" :
      C.state === "reachable" ? fmtYears(C.years) : "Not on track");
    goalSection = "<section><div class='sh-t'>Working toward a target</div>" + goal + "</section>";
  }

  // Compact year-by-year, sampled if long.
  const step = rows.length <= 15 ? 1 : rows.length <= 30 ? 2 : 3;
  const tableRows = rows.filter((r, i) => i === 0 || i === rows.length - 1 || i % step === 0);
  let table = "<table><thead><tr><th>Year</th><th>Contributed</th><th>Growth</th>" +
    "<th>Balance</th><th>In today's $</th></tr></thead><tbody>";
  const defl = series ? g.inflation : p.inflation;
  tableRows.forEach(r => {
    table += "<tr><td>" + r.year + "</td><td>" + money(r.contrib) + "</td><td>" +
      money(r.growth) + "</td><td>" + money(r.end) + "</td><td>" +
      money(r.end / Math.pow(1 + defl, r.year)) + "</td></tr>";
  });
  table += "</tbody></table>";

  const src = $(series ? "chartS" : "chart");
  let chart = "";
  if (src && src.childNodes.length){
    const clone = src.cloneNode(true);
    lighten(clone);
    clone.removeAttribute("style");
    chart = "<div class='sh-chart'>" + clone.outerHTML + "</div>";
  }

  const mode = (series ? chartMode.series : chartMode.single) === "mc"
    ? "Monte Carlo, " + readTrials(series ? "trialsS" : "trials").toLocaleString() + " runs"
    : "Projection";

  $("sheet").innerHTML =
    "<div class='sh-h'>" + SHEET_MARK + "<h1>Investment Projection</h1>" +
      "<span>" + (series ? "Stages" : "Advanced") + " &middot; " +
      fmtNum(years) + " years &middot; " + mode + "</span></div>" +
    "<div class='sh-big'>" +
      "<div><div class='k'>Future value</div><div class='v'>" + money(R.fv) + "</div>" +
        "<div class='n'>after " + fmtNum(years) + " years</div></div>" +
      "<div><div class='k'>Inflation adjusted</div><div class='v'>" + money(R.fvReal) + "</div>" +
        "<div class='n'>in today's spending power</div></div>" +
      "<div><div class='k'>After-tax income / yr</div><div class='v'>" + money(R.afterTax) + "</div>" +
        "<div class='n'>first year of retirement</div></div>" +
    "</div>" +
    chart +
    "<div class='sh-cols'>" +
      "<section><div class='sh-t'>Assumptions</div>" + inputs + "</section>" +
      "<section><div class='sh-t'>Results</div>" + out + "</section>" +
      "<section><div class='sh-t'>Milestones</div>" + ms + "</section>" +
      goalSection +
    "</div>" +
    "<div class='sh-table'><div class='sh-t'>Year by year</div>" + table + "</div>" +
    "<div class='sh-foot'>Figures are projections generated from the assumptions listed " +
    "above, not predictions. Past performance does not predict future returns. " +
    "This is not financial advice.</div>";
}
function buildTaxSheet(){
  const inp = readTax();
  if (!(inp.gross + inp.gross2 > 0)){ $("sheet").innerHTML = ""; toast("Enter your income first"); return false; }
  const R = runTax(inp);
  const ret = inp.mode === "retire";
  let inputs = "";
  if (ret){
    if (inp.trad > 0) inputs += row("Traditional withdrawal", money(inp.trad));
    if (inp.roth > 0) inputs += row("Roth withdrawal", money(inp.roth));
    if (inp.brok > 0) inputs += row("Brokerage withdrawal",
      money(inp.brok) + " (" + pctStr(inp.gainPct, 0) + " gain)");
    if (inp.ss > 0) inputs += row("Social Security", money(inp.ss));
    if (inp.pension > 0) inputs += row("Pension / annuity", money(inp.pension) +
      (inp.penPublic ? " (government)" : " (private)"));
    if (inp.other > 0) inputs += row("Other ordinary income", money(inp.other));
    inputs += row("Gross income", money(R.gross));
  } else if (inp.status === "m"){
    inputs += row("Your gross income", money(inp.gross));
    inputs += row("Spouse's gross income", money(inp.gross2));
    inputs += row("Household gross income", money(R.gross));
  } else {
    inputs += row("Gross income", money(inp.gross));
  }
  inputs += row("Filing status", inp.status === "m" ? "Married filing jointly" : "Single");
  if (ret && R.seniors > 0) inputs += row("Age 65 or older",
    R.seniors === 2 ? "Both spouses" : "Yes");
  inputs += row("State", R.stateName || "None");
  if (inp.pre > 0) inputs += row("Pre-tax deductions", money(inp.pre));
  inputs += row("Deduction", inp.dedType === "item"
    ? "Itemized (" + money(inp.item) + ")"
    : "Standard (" + money(ret ? R.fedDed : FED_STD[inp.status]) + ")");
  if (ret && R.ssGross > 0) inputs += row("Taxable Social Security", money(R.taxableSS));
  inputs += row("Taxable income", money(R.fedTaxable));

  let out;
  if (ret){
    out = row("Federal, ordinary income", money(R.fedOrdinary));
    out += row("Federal, long-term gains", money(R.ltcg) +
      (R.gainTaxable > 0 ? " (" + pctStr(R.ltcgRate, 1) + ")" : ""));
    if (R.niit > 0) out += row("Net investment income tax", money(R.niit));
    out += row("State tax", money(R.state));
    out += row("Total tax", money(R.total));
    out += row("Effective rate", pctStr(R.effTotal, 1));
    out += row("Marginal rate", pctStr(R.marginal, 1));
  } else {
    out = row("Federal tax", money(R.federal));
    out += row("State tax", money(R.state));
    if (inp.status === "m"){
      out += row("Your Social Security", money(R.ss1));
      out += row("Spouse's Social Security", money(R.ss2));
    } else {
      out += row("Social Security", money(R.ss));
    }
    out += row("Medicare" + (R.addl > 0 ? " (+ surtax)" : ""), money(R.med + R.addl));
    out += row("Total tax", money(R.total));
    out += row("Effective rate", pctStr(R.effTotal, 1));
    out += row("Marginal rate", pctStr(R.marginal, 0));
  }

  let pay;
  if (ret){
    pay = row("Income after tax, per year", money(R.net));
    pay += row("Per month", money(R.net / 12));
    if (R.gain > 0) pay += row("Gain realized", money(R.gain));
    if (R.zeroRoom > 0) pay += row("Room left in 0% band", money(R.zeroRoom));
  } else {
    pay = row("Take-home, per year", money(R.net));
    pay += row("Per month", money(R.net / 12));
    pay += row("Per biweekly check", money(R.net / 26));
    const netPay = R.gross - R.total;
    if (inp.pre > 0) pay += row("Net pay (before pre-tax)", money(netPay));
  }

  const src = $("txPie");
  let chart = "";
  if (src && src.childNodes.length){
    const clone = src.cloneNode(true);
    lighten(clone); clone.removeAttribute("style");
    chart = "<div class='sh-chart' style='width:1.5in;flex:none;margin:0'>" + clone.outerHTML + "</div>";
  }

  // Full federal bracket table \u2014 genuinely useful reference material that
  // fits comfortably given how few rows federal brackets have.
  let table = "<table><thead><tr><th>Rate</th><th>Income range</th><th>Taxed in band</th><th>Tax</th></tr></thead><tbody>";
  R.bands.forEach(b => {
    table += "<tr" + (b.amount > 0 ? "" : " style='color:#bbb'") + "><td>" + pctStr(b.rate, 0) +
      "</td><td>" + money(b.lo) + (b.hi === Infinity ? " and up" : " \u2013 " + money(b.hi)) +
      "</td><td>" + money(b.amount) + "</td><td>" + money(b.tax) + "</td></tr>";
  });
  table += "</tbody></table>";

  $("sheet").innerHTML =
    "<div class='sh-h'>" + SHEET_MARK + "<h1>" + (ret ? "Retirement Tax Summary" : "Income Tax Summary") +
      "</h1><span>Tax year 2026</span></div>" +
    "<div class='sh-big'>" +
      "<div><div class='k'>" + (ret ? "Income after tax" : "Take-home pay") +
        "</div><div class='v'>" + money(R.net) +
        "</div><div class='n'>per year</div></div>" +
      "<div><div class='k'>Total tax</div><div class='v'>" + money(R.total) +
        "</div><div class='n'>" + pctStr(R.effTotal, 1) + " effective</div></div>" +
      "<div><div class='k'>Per month</div><div class='v'>" + money(R.net / 12) +
        "</div><div class='n'>" + (ret ? "after tax" : "take-home") + "</div></div>" +
    "</div>" +
    "<div style='display:flex;gap:16px;margin-bottom:10px;align-items:stretch'>" + chart +
      "<div style='flex:1;display:flex;gap:16px'>" +
        "<section style='flex:1'><div class='sh-t'>Your situation</div>" + inputs + "</section>" +
        "<section style='flex:1'><div class='sh-t'>Tax breakdown</div>" + out + "</section>" +
        "<section style='flex:1'><div class='sh-t'>" + (ret ? "What you keep" : "Paycheck") + "</div>" + pay + "</section>" +
      "</div>" +
    "</div>" +
    "<div class='sh-table'><div class='sh-t'>Federal tax brackets</div>" + table + "</div>" +
    "<div class='sh-foot'>Based on published 2026 federal and state rates. Omits credits, " +
    "local taxes and many special cases. Not tax advice.</div>";
}

function buildMortSheet(){
  const m = readMort();
  if (!(m.price > 0)){ $("sheet").innerHTML = ""; toast("Enter a home price first"); return false; }
  const R = mortgage(m);
  let inputs = row("Home price", money(m.price));
  inputs += row("Down payment", money(m.down) + " (" + pctStr(m.price ? m.down / m.price : 0, 0) + ")");
  inputs += row("Loan amount", money(R.loan));
  inputs += row("Interest rate", pctStr(m.rate, 2));
  inputs += row("Term", fmtNum(m.term) + " years");
  if (R.pmi > 0) inputs += row("PMI", money(R.pmi) + "/mo until 20% equity");

  let pay = row("Principal & interest", money(R.pi));
  pay += row("Property tax", money(R.tax));
  pay += row("Insurance", money(R.ins));
  if (R.pmi > 0) pay += row("PMI", money(R.pmi));
  if (R.maint > 0) pay += row("Maintenance", money(R.maint));
  if (R.util > 0) pay += row("Utilities", money(R.util));
  if (R.hoa > 0) pay += row("HOA", money(R.hoa));
  pay += row("Total monthly payment", money(R.total));

  let out = row("Total interest paid", money(R.totalInterest));
  out += row("Total cost of loan", money(R.loan + R.totalInterest));
  if (R.pmiPaid > 0) out += row("Total PMI paid", money(R.pmiPaid));
  const halfwayYear = R.years.findIndex(y => y.balance <= R.loan / 2) + 1;
  if (halfwayYear > 0) out += row("Halfway point (balance)", "Year " + halfwayYear);
  out += row("Payoff", moWhen(R.payoffMonth));

  if (R.extraActive){
    const base = mortgage(Object.assign({}, m, {extraMonthly:0, extraOnce:0,
      extraOnceMonth:0, recast:false}));
    out += row("With extra payments", moDur(base.payoffMonth - R.payoffMonth) +
      " sooner, " + money(base.totalInterest - R.totalInterest) + " less interest");
    if (R.recastPI != null) out += row("Payment after recast", money(R.recastPI) + "/mo");
  }
  if (m.refiOn){
    const RF = refiCompare(m, {rate:m.refiRate, term:m.refiTerm, cost:m.refiCost});
    out += row("Refinance to " + pctStr(m.refiRate, 2) + ", " + fmtNum(m.refiTerm) + "yr",
      money(RF.then.pi) + "/mo, breaks even in " +
      (RF.breakEvenMonths == null ? "never" :
       RF.breakEvenMonths <= 0 ? "immediately" : moDur(RF.breakEvenMonths)) +
      ", " + (RF.lifetimeDelta >= 0 ? "saves " : "costs ") + money(Math.abs(RF.lifetimeDelta)) +
      " lifetime");
  }

  const src = $("chartMo");
  let chart = "";
  if (src && src.childNodes.length){
    const clone = src.cloneNode(true);
    lighten(clone); clone.removeAttribute("style");
    chart = "<div class='sh-chart'>" + clone.outerHTML + "</div>";
  }

  // Amortization, sampled so a 30-year loan doesn't spill onto a second page.
  const step = R.years.length <= 15 ? 1 : R.years.length <= 30 ? 2 : 3;
  const tableRows = R.years.filter((y, i) => i === 0 || i === R.years.length - 1 || i % step === 0);
  let table = "<table><thead><tr><th>Year</th><th>Interest</th><th>Principal</th>" +
    "<th>Total paid</th><th>Balance</th></tr></thead><tbody>";
  tableRows.forEach(y => {
    table += "<tr><td>" + y.year + "</td><td>" + money(y.interest) + "</td><td>" +
      money(y.principal) + "</td><td>" + money(y.paid) + "</td><td>" + money(y.balance) + "</td></tr>";
  });
  table += "</tbody></table>";

  $("sheet").innerHTML =
    "<div class='sh-h'>" + SHEET_MARK + "<h1>Mortgage Summary</h1><span>" + fmtNum(m.term) + " year term</span></div>" +
    "<div class='sh-big'>" +
      "<div><div class='k'>Monthly payment</div><div class='v'>" + money(R.total) +
        "</div><div class='n'>all in</div></div>" +
      "<div><div class='k'>Loan amount</div><div class='v'>" + money(R.loan) +
        "</div><div class='n'>" + pctStr(m.price ? m.down / m.price : 0, 0) + " down</div></div>" +
      "<div><div class='k'>Total interest</div><div class='v'>" + money(R.totalInterest) +
        "</div><div class='n'>over the loan</div></div>" +
    "</div>" + chart +
    "<div class='sh-cols'>" +
      "<section><div class='sh-t'>The loan</div>" + inputs + "</section>" +
      "<section><div class='sh-t'>Monthly payment</div>" + pay + "</section>" +
      "<section><div class='sh-t'>Over the life of the loan</div>" + out + "</section>" +
    "</div>" +
    "<div class='sh-table'><div class='sh-t'>Amortization</div>" + table + "</div>" +
    "<div class='sh-foot'>Rate and costs are estimates. Actual terms depend on credit, " +
    "lender and location. Not a loan offer.</div>";
}

function buildCollegeSheet(){
  const inp = readCollege();
  if (inp.kids.length > 1) return buildCollegeFamilySheet(inp);
  if (!(inp.annualCost > 0)){ $("sheet").innerHTML = ""; toast("Set an annual cost first"); return false; }
  const R = collegeSavingsCalc(inp);
  let inputs = row("Annual cost today", money(inp.annualCost));
  inputs += row("Years until college", fmtNum(inp.yearsUntil));
  inputs += row("Years of college", fmtNum(inp.collegeYrs));
  inputs += row("Currently saved", money(inp.saved));
  inputs += row("Investment return", pctStr(inp.investRet, 1));
  inputs += row("Tuition inflation", pctStr(inp.tuitionInfl, 1));

  let out = row("Total cost, all years", money(R.totalFuture));
  out += row("Savings grow to", money(R.savingsAtStart));
  out += row("Needed when college starts", money(R.targetAtStart));
  out += row("Shortfall to close", money(R.shortfall));
  out += row("Monthly savings needed", money(R.monthly));

  // What each year of college actually costs, inflated to when it happens.
  let costs = "";
  R.yearCosts.forEach((c, i) => { costs += row("College year " + (i+1), money(c)); });

  const src = $("chartCl");
  let chart = "";
  if (src && src.childNodes.length){
    const clone = src.cloneNode(true);
    lighten(clone); clone.removeAttribute("style");
    chart = "<div class='sh-chart'>" + clone.outerHTML + "</div>";
  }

  // Savings accumulation, sampled if the horizon is long.
  const step = R.rows.length <= 15 ? 1 : R.rows.length <= 30 ? 2 : 3;
  const tableRows = R.rows.filter((r, i) => i === 0 || i === R.rows.length - 1 || i % step === 0);
  let table = "<table><thead><tr><th>Year</th><th>Contributed</th><th>Growth</th>" +
    "<th>Balance</th></tr></thead><tbody>";
  tableRows.forEach(r => {
    table += "<tr><td>" + r.year + "</td><td>" + money(r.contribs) + "</td><td>" +
      money(r.growth) + "</td><td>" + money(r.balance) + "</td></tr>";
  });
  table += "</tbody></table>";

  $("sheet").innerHTML =
    "<div class='sh-h'>" + SHEET_MARK + "<h1>College Savings Plan</h1><span>" + fmtNum(inp.yearsUntil) + " years to go</span></div>" +
    "<div class='sh-big'>" +
      "<div><div class='k'>Save per month</div><div class='v'>" + money(R.monthly) +
        "</div><div class='n'>to close the gap</div></div>" +
      "<div><div class='k'>Total cost, all years</div><div class='v'>" + money(R.totalFuture) +
        "</div><div class='n'>" + fmtNum(inp.collegeYrs) + " years</div></div>" +
      "<div><div class='k'>Needed when college starts</div><div class='v'>" + money(R.targetAtStart) +
        "</div><div class='n'>present value</div></div>" +
    "</div>" + chart +
    "<div class='sh-cols'>" +
      "<section><div class='sh-t'>Assumptions</div>" + inputs + "</section>" +
      "<section><div class='sh-t'>Results</div>" + out + "</section>" +
      "<section><div class='sh-t'>Cost by college year</div>" + costs + "</section>" +
    "</div>" +
    "<div class='sh-table'><div class='sh-t'>Savings accumulation</div>" + table + "</div>" +
    "<div class='sh-foot'>Excludes financial aid, scholarships and 529 tax advantages. " +
    "Tuition inflation is an assumption, not a guarantee.</div>";
}

function buildCollegeFamilySheet(inp){
  const P = collegePlanCalc(inp);
  if (!P){ $("sheet").innerHTML = ""; toast("Set an annual cost first"); return false; }
  const n = P.kids.length;
  let kids = "";
  inp.kids.forEach((k, i) => {
    kids += row("Child " + (i + 1), k.annualCost > 0 && k.yearsUntil > 0
      ? money(k.annualCost) + "/yr today, in " + fmtNum(k.yearsUntil) + " yrs, for " + fmtNum(k.collegeYrs)
      : "left out");
  });
  let inputs = row("Currently saved", money(inp.saved));
  inputs += row("Investment return", pctStr(inp.investRet, 1));
  inputs += row("Tuition inflation", pctStr(inp.tuitionInfl, 1));

  let out = row("Total cost, all children", money(P.totalFuture));
  out += row("Needed today", money(P.pvToday));
  P.phases.forEach((x, i) => {
    out += row(i ? "Then, from year " + fmtNum(Math.round(x.from / 12 * 10) / 10) : "Monthly savings needed", money(x.monthly) + "/mo");
  });
  P.kids.forEach(k => { out += row("Child " + (k.index + 1) + ", all years", money(k.total)); });

  const src = $("chartCl");
  let chart = "";
  if (src && src.childNodes.length){
    const clone = src.cloneNode(true);
    lighten(clone); clone.removeAttribute("style");
    chart = "<div class='sh-chart'>" + clone.outerHTML + "</div>";
  }
  const step = P.rows.length <= 15 ? 1 : P.rows.length <= 30 ? 2 : 3;
  const tableRows = P.rows.filter((r, i) => i === 0 || i === P.rows.length - 1 || i % step === 0 || r.paid > 0);
  let table = "<table><thead><tr><th>Year</th><th>Contributed</th><th>Growth</th>" +
    "<th>Paid for college</th><th>Balance</th></tr></thead><tbody>";
  tableRows.forEach(r => {
    table += "<tr><td>" + r.year + "</td><td>" + money(r.contribs) + "</td><td>" +
      money(r.growth) + "</td><td>" + (r.paid > 0 ? money(r.paid) : "\u2014") + "</td><td>" + money(r.balance) + "</td></tr>";
  });
  table += "</tbody></table>";

  $("sheet").innerHTML =
    "<div class='sh-h'>" + SHEET_MARK + "<h1>College Savings Plan</h1><span>" + fmtNum(n) + " children</span></div>" +
    "<div class='sh-big'>" +
      "<div><div class='k'>Save per month</div><div class='v'>" + money(P.monthly) +
        "</div><div class='n'>" + collegePhaseNote(P) + "</div></div>" +
      "<div><div class='k'>Total cost, all children</div><div class='v'>" + money(P.totalFuture) +
        "</div><div class='n'>at future prices</div></div>" +
      "<div><div class='k'>Needed today</div><div class='v'>" + money(P.pvToday) +
        "</div><div class='n'>present value</div></div>" +
    "</div>" + chart +
    "<div class='sh-cols'>" +
      "<section><div class='sh-t'>Children</div>" + kids + "</section>" +
      "<section><div class='sh-t'>Assumptions</div>" + inputs + "</section>" +
      "<section><div class='sh-t'>Results</div>" + out + "</section>" +
    "</div>" +
    "<div class='sh-table'><div class='sh-t'>One account for all of them</div>" + table + "</div>" +
    "<div class='sh-foot'>Excludes financial aid, scholarships and 529 tax advantages. " +
    "Tuition inflation is an assumption, not a guarantee.</div>";
}

function buildRentBuySheet(){
  const inp = readRB();
  if (!(inp.price > 0)){ $("sheet").innerHTML = ""; toast("Enter a home price first"); return false; }
  const R = rentBuyCalc(inp);
  const last = R.years[R.years.length - 1];
  if (!last){ $("sheet").innerHTML = ""; return false; }
  const buyWins = last.buyerNW >= last.renterNW;

  let inputs = row("Home price", money(inp.price));
  inputs += row("Down payment", pctStr(inp.downPct / 100, 0));
  inputs += row("Interest rate", pctStr(inp.rate / 100, 2));
  inputs += row("Loan term", fmtNum(inp.term) + " years");
  inputs += row("Monthly rent (start)", money(inp.rent));
  inputs += row("Rent increase", pctStr(inp.rentInc / 100, 1) + "/yr");
  inputs += row("Home appreciation", pctStr(inp.appr / 100, 1) + "/yr");
  inputs += row("Investment return", pctStr(inp.invest / 100, 1) + "/yr");
  inputs += row("Time horizon", fmtNum(inp.horizon) + " years");

  let out = row("Buyer net worth", money(last.buyerNW));
  out += row("Renter net worth", money(last.renterNW));
  out += row("Difference", (buyWins ? "+" : "\u2212") + money(Math.abs(last.buyerNW - last.renterNW)));
  out += row("Break-even point", R.breakEven ? "Year " + fmtNum(R.breakEven) : "Not within horizon");
  out += row("Renter invests upfront", money(R.initialInvest));
  out += row("Monthly cost, buying", money(R.monthlyBuy));
  out += row("Monthly cost, renting", money(inp.rent) + " (starting)");
  out += row("Home value at end", money(last.homeVal));
  out += row("Mortgage balance at end", money(last.balance));

  const src = $("chartRB");
  let chart = "";
  if (src && src.childNodes.length){
    const clone = src.cloneNode(true);
    lighten(clone); clone.removeAttribute("style");
    chart = "<div class='sh-chart'>" + clone.outerHTML + "</div>";
  }

  // Year-by-year net worth, sampled if the horizon is long, always keeping
  // the actual break-even year even if sampling would otherwise skip it.
  const step = R.years.length <= 15 ? 1 : R.years.length <= 30 ? 2 : 3;
  const tableRows = R.years.filter((y, i) =>
    i === 0 || i === R.years.length - 1 || i % step === 0 || y.year === R.breakEven);
  let table = "<table><thead><tr><th>Year</th><th>Buyer NW</th><th>Renter NW</th>" +
    "<th>Home value</th><th>Balance</th></tr></thead><tbody>";
  tableRows.forEach(y => {
    const isBE = y.year === R.breakEven;
    table += "<tr" + (isBE ? " style='font-weight:700;background:#f5f0e0'" : "") + "><td>" + y.year +
      (isBE ? " \u2605" : "") + "</td><td>" + money(y.buyerNW) + "</td><td>" + money(y.renterNW) +
      "</td><td>" + money(y.homeVal) + "</td><td>" + money(y.balance) + "</td></tr>";
  });
  table += "</tbody></table>";

  $("sheet").innerHTML =
    "<div class='sh-h'>" + SHEET_MARK + "<h1>Rent vs. Buy</h1><span>After " + fmtNum(inp.horizon) + " years</span></div>" +
    "<div class='sh-big'>" +
      "<div><div class='k'>Better choice</div><div class='v'>" + (buyWins ? "Buying" : "Renting") +
        "</div><div class='n'>by " + money(Math.abs(last.buyerNW - last.renterNW)) + "</div></div>" +
      "<div><div class='k'>Buyer net worth</div><div class='v'>" + money(last.buyerNW) +
        "</div><div class='n'>after " + fmtNum(inp.horizon) + " years</div></div>" +
      "<div><div class='k'>Renter net worth</div><div class='v'>" + money(last.renterNW) +
        "</div><div class='n'>after " + fmtNum(inp.horizon) + " years</div></div>" +
    "</div>" + chart +
    "<div class='sh-cols'>" +
      "<section><div class='sh-t'>Assumptions</div>" + inputs + "</section>" +
      "<section><div class='sh-t'>Results</div>" + out + "</section>" +
    "</div>" +
    "<div class='sh-table'><div class='sh-t'>Net worth by year" +
      (R.breakEven ? " &middot; \u2605 marks the break-even year" : "") + "</div>" + table + "</div>" +
    "<div class='sh-foot'>Property tax, insurance and maintenance grow with home value; PMI is included above 80% loan-to-value. " +
    "Excludes the mortgage interest deduction and non-financial factors " +
    "like stability. Projections, not predictions.</div>";
}

function buildDrawdownSheet(){
  const o = readDD();
  ddRetireAge = o.retireAge;
  if (!(o.initial > 0)){ $("sheet").innerHTML = ""; toast("Enter a portfolio value first"); return false; }
  const H = historicalBacktest(o);
  const show = H.runs.filter(r => r.startYear === ddSelectedYear)[0] || H.firstFail || H.runs[0];

  let inputs = row("Starting portfolio", money(o.initial));
  inputs += row("Years in retirement", fmtNum(o.years));
  inputs += row("Stock / bond mix", o.stockPct + "% / " + (100 - o.stockPct) + "%");
  inputs += row("Withdrawal strategy", DD_STRAT_NAMES[o.strategy] || "Floor & ceiling");
  if (o.strategy === "vpw"){
    inputs += row("Expected return, real", pctStr((o.vpwRate || 0) / 100, 2));
    inputs += row("PMT future value", money(o.vpwFV || 0));
  } else inputs += row("Withdrawal rate", pctStr(o.initialPct / 100, 1));
  if (o.strategy === "fixed") ddWdOrder(o.wdStages).forEach(function (x) {
    inputs += row(escapeHtml(x.st.name || ("Stage " + (x.i + 2))),
      pctStr((x.st.rate || 0) / 100, 1) + " from " +
      (o.retireAge != null ? "age " + fmtNum(o.retireAge + x.start - 1) : "year " + x.start));
  });
  if (o.strategy === "guardrails"){
    inputs += row("Upper guardrail", fmtNum(o.guardBand) + "% above, cut " + fmtNum(o.adjustPct) + "%");
    inputs += row("Lower guardrail", fmtNum(o.guardBandLo) + "% below, raise " + fmtNum(o.raisePct) + "%");
    if (o.gkFinalYears > 0) inputs += row("No cuts in the final", fmtNum(o.gkFinalYears) + " years");
  }
  if (o.strategy === "yale"){
    inputs += row("Weight on last year", num("ddYaleWeight") + "%");
    inputs += row("Target spending rate", num("ddYaleRate") + "%");
  }
  if (o.spendFloor > 0 && o.strategy !== "fixed") inputs += row("Minimum spending", money(o.spendFloor) + "/yr");
  if (o.spendCeil > 0 && o.strategy !== "fixed") inputs += row("Maximum spending", money(o.spendCeil) + "/yr");
  if (o.ssAnnual > 0 || o.ssAnnual2 > 0) inputs += row("Social Security", money(o.ssAnnualTotal) + "/yr");
  (o.incomeItems || []).filter(it => it.on !== false).forEach(it => inputs += row(it.name, describeItem(it)));
  (o.expenseItems || []).filter(it => it.on !== false).forEach(it => inputs += row(it.name + " (expense)", describeItem(it)));

  let out = row("Success rate", pctStr(H.successRate, 1));
  out += row("Tested against", H.total + " periods since " + H.first);
  out += row("Survived", H.survived + " of " + H.total);
  out += row("Median ending balance", money(H.medianEnd));
  out += row("Worst case", money(H.worstEnd));
  out += row("Best case", money(H.bestEnd));

  // Spending behavior over the example period \u2014 the part a single ending
  // balance can't tell you.
  const real = show.rows.map(r => r.realSpend != null ? r.realSpend : r.realWithdrawal);
  const sortedReal = real.slice().sort((a,b) => a-b);
  const highSpend = sortedReal[sortedReal.length-1], lowSpend = sortedReal[0];
  let cuts = 0, maxCut = 0;
  for (let i = 1; i < real.length; i++){
    const chg = real[i] - real[i-1];
    if (chg < -0.5){ cuts++; if (-chg > maxCut) maxCut = -chg; }
  }
  let spend = row("Highest year's spending", money(highSpend));
  spend += row("Lowest year's spending", money(lowSpend));
  spend += row("Years spending was cut", cuts + " of " + real.length);
  if (maxCut > 0) spend += row("Biggest single-year cut", "\u2212" + money(maxCut));
  spend += row("Total spent, example period", money(real.reduce((a,v)=>a+v,0)));

  const src = $("chartDD");
  let chart = "";
  if (src && src.childNodes.length){
    const clone = src.cloneNode(true);
    lighten(clone); clone.removeAttribute("style");
    chart = "<div class='sh-chart'>" + clone.outerHTML + "</div>";
  }

  // Verdict line, matching the on-screen wording
  let verdict;
  if (H.successRate >= 0.99) verdict = "Survived every historical period, including the Depression, 1970s stagflation, and 2008.";
  else if (H.successRate >= 0.90) verdict = "Survived most historical periods. Failed only when retirement began in " +
    H.failYears.slice(0, 8).join(", ") + (H.failYears.length > 8 ? ", and others" : "") + ".";
  else verdict = "Ran out of money in " + H.failYears.length + " of " + H.total +
    " historical periods. Consider a lower withdrawal rate or a strategy that adjusts spending.";

  // Compact year-by-year for the example period, sampled if long so it never
  // overflows the page \u2014 every year for a plan under ~20 years, every other
  // year beyond that, every 3rd beyond 40.
  const step = show.rows.length <= 20 ? 1 : show.rows.length <= 40 ? 2 : 3;
  const tableRows = show.rows.filter((r, i) => i === 0 || i === show.rows.length - 1 || i % step === 0);
  const sheetHasCustomIncome = (o.incomeItems || []).some(it => it.on !== false);
  let table = "<table><thead><tr><th>" + (ddRetireAge != null ? "Age" : "Year") + "</th><th>Withdrawal</th><th>Soc. Sec.</th>" +
    (sheetHasCustomIncome ? "<th>Other Income</th>" : "") +
    "<th>Return</th><th>End balance</th></tr></thead><tbody>";
  tableRows.forEach(r => {
    table += "<tr><td>" + ddAgeVal(r.year) + "</td><td>" + money(r.withdrawal) + "</td><td>" +
      (r.ss > 0 ? money(r.ss) : "\u2014") + "</td>" +
      (sheetHasCustomIncome ? "<td>" + (r.customIncome > 0 ? money(r.customIncome) : "\u2014") + "</td>" : "") +
      "<td>" + r.ret.toFixed(1) + "%</td><td>" +
      money(r.realEnd) + "</td></tr>";
  });
  table += "</tbody></table>";

  $("sheet").innerHTML =
    "<div class='sh-h'>" + SHEET_MARK + "<h1>Will My Money Last?</h1><span>" + fmtNum(o.years) + " year retirement &middot; tested since " + H.first + "</span></div>" +
    "<div class='sh-big'>" +
      "<div><div class='k'>Success rate</div><div class='v'>" + pctStr(H.successRate, 0) +
        "</div><div class='n'>" + H.survived + " of " + H.total + " periods</div></div>" +
      "<div><div class='k'>Median ending balance</div><div class='v'>" + money(H.medianEnd) +
        "</div><div class='n'>today's dollars</div></div>" +
      "<div><div class='k'>Worst case</div><div class='v'>" + money(H.worstEnd) +
        "</div><div class='n'>today's dollars</div></div>" +
    "</div>" + chart +
    "<div class='sh-cols'>" +
      "<section><div class='sh-t'>Plan</div>" + inputs + "</section>" +
      "<section><div class='sh-t'>Results</div>" + out + "</section>" +
      "<section><div class='sh-t'>Spending, retiring " + show.startYear + "</div>" + spend + "</section>" +
    "</div>" +
    "<div class='sh-table'><div class='sh-t'>Year by year &middot; retiring in " + show.startYear +
      (show.depleted ? (" (ran out " + (ddRetireAge != null ? "at age " + ddAgeVal(show.depletedYear) : "in year " + show.depletedYear) + ")") : " (survived)") + "</div>" + table + "</div>" +
    "<div class='sh-foot'>" + verdict + " Tested against real US market history (" +
      H.first + "\u2013" + (HIST_START + HIST_STOCK.length - 1) + "). " +
    "Surviving every period is evidence a plan is reasonable, not a guarantee. Not financial advice.</div>";
}

function buildBudgetSheet(){
  const incFreq = bgIncomeFreq;
  const incomeYr = num("bgIncomeIn") * incFreq;
  const spentYr = budget.reduce((a, r) => a + (isSavingsRow(r) ? 0 : annualize(r)), 0);
  const savedYr = budget.reduce((a, r) => a + (isSavingsRow(r) ? annualize(r) : 0), 0);
  const leftYr = incomeYr - spentYr - savedYr;
  if (!(incomeYr > 0) && !(spentYr > 0)){ $("sheet").innerHTML = ""; toast("Add your income first"); return false; }

  // Group spending by its preset category, in the same order the budget tool
  // itself uses, so the sheet reads like the tool rather than an arbitrary list.
  const order = ["Housing", "Transportation", "Health", "Food", "Lifestyle", "Saving & debt", "Custom"];
  const groups = {};
  budget.forEach(r => {
    if (annualize(r) <= 0 || isSavingsRow(r)) return;
    const g = r.group || "Custom";
    (groups[g] = groups[g] || []).push(r);
  });
  let spendCols = "";
  order.filter(g => groups[g]).forEach(g => {
    let section = "<section style='flex:1;min-width:0'><div class='sh-t'>" + g + "</div>";
    groups[g].forEach(r => { section += row(r.desc, money(annualize(r) / 12) + "/mo"); });
    section += "</section>";
    spendCols += section;
  });

  let saveRows = "";
  budget.filter(r => isSavingsRow(r) && annualize(r) > 0).forEach(r => {
    saveRows += row(r.desc, money(annualize(r) / 12) + "/mo");
  });

  let summary = row("Income", money(incomeYr / 12) + "/mo");
  summary += row("Spending", money(spentYr / 12) + "/mo");
  if (savedYr > 0) summary += row("Saving", money(savedYr / 12) + "/mo");
  summary += row("Left over", money(leftYr / 12) + "/mo");
  summary += row("Percent of income spent", incomeYr ? pctStr(spentYr / incomeYr, 0) : "\u2014");
  if (savedYr > 0) summary += row("Percent of income saved", incomeYr ? pctStr(savedYr / incomeYr, 0) : "\u2014");

  const efMonths = Math.max(1, Math.round(num("efMonths")) || 6);
  const efTarget = (spentYr / 12) * efMonths;

  $("sheet").innerHTML =
    "<div class='sh-h'>" + SHEET_MARK + "<h1>Monthly Budget</h1><span>Per month, unless noted</span></div>" +
    "<div class='sh-big'>" +
      "<div><div class='k'>Income</div><div class='v'>" + money(incomeYr / 12) +
        "</div><div class='n'>per month</div></div>" +
      "<div><div class='k'>Spending + saving</div><div class='v'>" + money((spentYr + savedYr) / 12) +
        "</div><div class='n'>per month</div></div>" +
      "<div><div class='k'>Left over</div><div class='v'>" + money(leftYr / 12) +
        "</div><div class='n'>" + (incomeYr ? pctStr(leftYr / incomeYr, 0) : "\u2014") + " of income</div></div>" +
    "</div>" +
    "<div class='sh-cols'>" +
      "<section style='flex:1;min-width:0'><div class='sh-t'>Summary</div>" + summary +
        (saveRows ? "<div class='sh-t' style='margin-top:8px'>Saving</div>" + saveRows : "") +
      "</section>" +
      "<section style='flex:1;min-width:0'><div class='sh-t'>Emergency fund</div>" +
        row(efMonths + "-month target", money(efTarget)) +
        row("Based on", money(spentYr / 12) + "/mo actual expenses") +
      "</section>" +
    "</div>" +
    "<div class='sh-cols'>" + spendCols + "</div>" +
    "<div class='sh-foot'>A snapshot of what you entered. Savings and retirement contributions " +
    "are shown separately from spending and excluded from the emergency fund target. " +
    "Doesn't include taxes withheld or account for irregular income.</div>";
}

function buildBasicSheet(){
  const p = readBasic();
  if (!(p.years > 0)){ $("sheet").innerHTML = ""; return; }
  const R = projectBasic(p);
  const rows = R.years.map(y => ({year:y.year, end:y.end, growth:y.growth,
                                  contrib:y.contrib}));
  const cross = rows.find(r => r.growth > r.contrib && r.contrib > 0);
  let ms = row("Crossover year", cross ? "Age " + fmtNum(p.age + cross.year) : "\u2014");
  MS_LADDER.filter(v => v <= R.fv).slice(-4).forEach(v => {
    const hit = rows.find(r => r.end >= v);
    ms += row("Reaches " + money(v), hit ? "Age " + fmtNum(p.age + hit.year) : "\u2014");
  });
  const level = RISK_LEVELS.find(r => Math.abs(r.real - p.real) < 1e-9);
  let inputs = row("Age today", fmtNum(p.age));
  inputs += row("Retiring at", fmtNum(p.retire));
  inputs += row("Saved so far", money(p.initial));
  inputs += row("Contributing", money(p.contrib, 2) + " " + PERIOD_ADV[p.period]);
  inputs += row("Invested as", level ? level.label : pctStr(p.real, 2));
  inputs += row("Growth after inflation", pctStr(p.real, 2));
  let out = row("You put in", money(R.contribTotal));
  out += row("Growth added", money(R.growth));
  out += row("Value at retirement", money(R.fv));
  out += row("Income per year", money(R.fv * .04));
  out += row("Income per month", money(R.fv * .04 / 12));

  const src = $("chartQ");
  let chart = "";
  if (src && src.childNodes.length){
    const clone = src.cloneNode(true);
    lighten(clone); clone.removeAttribute("style");
    chart = "<div class='sh-chart'>" + clone.outerHTML + "</div>";
  }

  // Compact year-by-year, using age rather than plan-year to match how Basic
  // presents everything else.
  const step = rows.length <= 15 ? 1 : rows.length <= 30 ? 2 : 3;
  const tableRows = rows.filter((r, i) => i === 0 || i === rows.length - 1 || i % step === 0);
  let table = "<table><thead><tr><th>Age</th><th>Contributed</th><th>Growth</th>" +
    "<th>Balance</th></tr></thead><tbody>";
  tableRows.forEach(r => {
    table += "<tr><td>" + (p.age + r.year) + "</td><td>" + money(r.contrib) + "</td><td>" +
      money(r.growth) + "</td><td>" + money(r.end) + "</td></tr>";
  });
  table += "</tbody></table>";

  $("sheet").innerHTML =
    "<div class='sh-h'>" + SHEET_MARK + "<h1>Retirement Projection</h1><span>" +
      fmtYears(p.years) + " of saving &middot; every figure in today's dollars</span></div>" +
    "<div class='sh-big'>" +
      "<div><div class='k'>Value at retirement</div><div class='v'>" + money(R.fv) +
        "</div><div class='n'>at age " + fmtNum(p.retire) + "</div></div>" +
      "<div><div class='k'>Income per year</div><div class='v'>" + money(R.fv * .04) +
        "</div><div class='n'>taking 4% a year</div></div>" +
      "<div><div class='k'>Income per month</div><div class='v'>" + money(R.fv * .04 / 12) +
        "</div><div class='n'>before any tax</div></div>" +
    "</div>" + chart +
    "<div class='sh-cols'>" +
      "<section><div class='sh-t'>Your answers</div>" + inputs + "</section>" +
      "<section><div class='sh-t'>Results</div>" + out + "</section>" +
      "<section><div class='sh-t'>Milestones</div>" + ms + "</section>" +
    "</div>" +
    "<div class='sh-table'><div class='sh-t'>Year by year</div>" + table + "</div>" +
    "<div class='sh-foot'>All figures are in today's dollars and assume a steady " +
    "return after inflation, no tax and no fees. Real returns vary year to year. " +
    "Projections are not predictions, and this is not financial advice.</div>";
}
function doSummary(){
  if (buildSheet() === false) return;
  setTimeout(() => window.print(), 60);
}

