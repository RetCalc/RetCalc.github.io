/* ---------- render ---------- */
let lastRun = null;
/* ---------- milestones ---------- */
const MS_LADDER = [50e3, 100e3, 250e3, 500e3, 1e6, 2e6, 3e6, 5e6, 10e6, 25e6, 50e6, 100e6];

/* rows: [{year, end, growth, contrib}] in chronological order */
function renderMilestones(elId, rows, infl, feeCost, horizon, alreadyReal, wholeYears){
  const box = $(elId);
  if (!rows || !rows.length){
    box.innerHTML = "<div class='hint'>Add some years to see milestones.</div>";
    return;
  }
  const final = rows[rows.length - 1].end;
  const out = [];
  // Stages can land a milestone mid-year (a fractional first stage offsets
  // every row after it), but "Year 20.5" reads oddly next to a dollar figure.
  // The underlying row.year keeps its exact fractional value for every real
  // calculation (inflation adjustment, sorting, etc.) -- only the label
  // rounds up to the whole year the milestone had been reached by.
  const yrLabel = y => wholeYears ? fmtNum(Math.ceil(y)) : fmtNum(y);

  // the year the portfolio starts out-earning you
  const cross = rows.find(r => r.growth > r.contrib && r.contrib > 0);
  if (cross){
    out.push("<div class='kv'><span class='k'><b class='msflag'>Crossover</b>" +
      "<span class='mssub'>Growth first outpaces what you put in</span></span>" +
      "<span class='v'>Year " + yrLabel(cross.year) + "</span></div>");
  } else {
    out.push("<div class='kv'><span class='k'><b class='msflag'>Crossover</b>" +
      "<span class='mssub'>Growth never overtakes contributions in this run</span></span>" +
      "<span class='v'>\u2014</span></div>");
  }

  const rungs = MS_LADDER.filter(v => v <= final).slice(-6);
  rungs.forEach(v => {
    const hit = rows.find(r => r.end >= v);
    out.push("<div class='kv'><span class='k'>" + money(v) +
      (alreadyReal ? "" : "<span class='mssub'>" +
        money(v / Math.pow(1 + infl, hit ? hit.year : 0)) + " in today's dollars</span>") +
      "</span><span class='v'>Year " + (hit ? yrLabel(hit.year) : "\u2014") + "</span></div>");
  });

  if (feeCost > 0){
    out.push("<div class='kv total'><span class='k'>Cost of fees" +
      "<span class='mssub'>What fees take out over " + fmtNum(horizon) + " years</span></span>" +
      "<span class='v neg'>\u2212" + money(feeCost) + "</span></div>");
  }
  box.innerHTML = out.join("");
}

function renderProjection(){
  const p = readInputs();
  const R = project(p);
  lastRun = R;

  $("dNetRate").textContent = pctStr(p.nominal, 2) +
    (p.fees > 0 ? "  (" + pctStr(p.gross, 2) + " − " + pctStr(p.fees, 2) + ")" : "");
  $("dRealRate").textContent = pctStr(R.realReturn);
  $("dPPY").textContent = R.ppy;
  $("dPeriodic").textContent = pctStr(R.periodicRate, 4);
  $("dPeriods").textContent = R.periods.toLocaleString();

  setBig("rFV", money(R.fv));
  $("rFVnote").textContent = "After " + p.years + " years at " + pctStr(p.nominal, 2);
  setBig("rFVreal", money(R.fvReal));
  $("rFVrealnote").textContent = "Inflation of " + pctStr(p.inflation, 2) + " over "
    + R.inflYears + " years";
  setBig("rMonthly", money(R.afterTax));

  $("rInvested").textContent = money(R.invested);
  $("rGrowth").textContent = money(R.growth);
  $("rContribs").textContent = money(R.contribTotal);
  $("rLastContrib").textContent = money(R.lastContribReal) + " " + PERIOD_ADV[p.period];
  $("rWd").textContent = money(R.wd);
  $("rWdReal").textContent = money(R.wdReal);
  $("rAfterTax").textContent = money(R.afterTax);
  $("rAfterTaxMo").textContent = money(R.afterTaxMo);

  const tb = $("yearTable").querySelector("tbody");
  tb.innerHTML = R.years.map(y =>
    "<tr><td>" + y.year + "</td><td>" + money(y.start) + "</td><td>" + money(y.contrib) +
    "</td><td class='pos'>" + money(y.growth) + "</td><td>" + money(y.end) +
    "</td><td>" + money(y.end / Math.pow(1 + p.inflation, y.year)) + "</td></tr>").join("");

  const feeCost = p.fees > 0
    ? project(Object.assign({}, p, {nominal: p.gross})).fv - R.fv : 0;
  renderMilestones("msBody",
    R.years.map(y => ({year:y.year, end:y.end, growth:y.growth, contrib:y.contrib})),
    p.inflation, feeCost, p.years);

  drawChart(R, p);
  renderSolve();
  renderAcct(p);
}

function renderAcct(p){
  acSync();
  if (!p.acct || !lastAcct) return;
  const B = lastAcct, a = B.a, ppy = PPY[p.period];
  $("acTaxOut").value = pctStr(B.effRate, 1);

  // running totals under the account rows
  const perLbl = AC_PER[p.period] || "";
  const mine = a.tradC + a.rothC + a.brokC;
  $("acTotBal").textContent = money(a.tradBal + a.rothBal + a.brokBal);
  $("acTotAdd").textContent = money(mine) + perLbl;
  $("acTotSub").textContent = B.match > 0
    ? "+ " + money(B.match) + perLbl + " match" : "";


  acRenderTable("acResults", "acResultsNote", B, B.matchTotal > 0
    ? "Your employer puts in <b>" + money(B.matchTotal) + "</b> over the " +
      fmtNum(p.years) + " years, before growth." : "");
}
function acRenderTable(tableId, noteId, B, extra){
  const a = B.a;
  const rows = [
    {k:"trad", label:"Traditional 401(k) / IRA", c:"#e2795f", b:B.tax.buckets[0]},
    {k:"roth", label:"Roth 401(k) / IRA", c:"#4fbf95", b:B.tax.buckets[1]},
    {k:"brok", label:"Taxable brokerage", c:"#7d9fd6", b:B.tax.buckets[2]}
  ];
  $(tableId).querySelector("tbody").innerHTML = rows.map(r =>
    "<tr><td><i class='acdot' style='background:" + r.c + "'></i>" + r.label + "</td><td>" +
    money(B.real[r.k]) + "</td><td>" + pctStr(B.shares[r.k], 0) + "</td><td>" +
    money(B.w[r.k]) + "</td><td>" + money(r.b.tax) + "</td><td>" +
    money(B.w[r.k] - r.b.tax) + "</td></tr>").join("");
  $(tableId).querySelector("tfoot").innerHTML =
    "<tr><td>Total</td><td>" + money(B.totalReal) + "</td><td></td><td>" + money(B.wTotal) +
    "</td><td>" + money(B.tax.total) + " <span style='color:var(--dimmer);font-weight:400'>(" +
    pctStr(B.effRate, 1) + ")</span></td><td>" + money(B.wTotal - B.tax.total) + "</td></tr>";

  const st = STATES[a.state];
  const bits = [];
  bits.push("Taxed with 2026 " + (a.status === "m" ? "married filing jointly" : "single") +
    " brackets" + (st && !st.none ? " and " + st.n + " state tax" : st ? ", no state income tax" : "") +
    (B.seniors ? ", with the age 65+ deduction" : "") + ".");
  if (B.w.brok > 0)
    bits.push("<b>" + pctStr(B.gainPct, 0) + "</b> of the brokerage balance is growth by then, so only that share of each sale is taxed.");
  if (extra) bits.push(extra);
  bits.push("Social Security and other income aren't included here and would raise the tax; the " +
    "<a href='#' class='txlink' data-txfrom='" + tableId + "'>Income Tax tool</a> can add them.");
  $(noteId).innerHTML = bits.join(" ");
}

