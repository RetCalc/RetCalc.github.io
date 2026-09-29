/* ---------- mortgage tool ---------- */
let mortPoints = [];
function readMort(){
  const extrasOn = $("moExtrasOn").value === "1";
  return {price:num("moPrice"), down:num("moDownAmt"), rate:rate("moRate"),
          term:parseFloat($("moTerm").value), taxPct:rate("moTax"), ins:num("moIns"),
          pmiPct:rate("moPmi"), hoa:num("moHoa"),
          maintPct:rate("moMaint"), util:num("moUtil"),
          // Zeroed out whenever the panel is collapsed, so toggling it off is
          // the same as never having touched it -- not just hiding the fields.
          extraMonthly: extrasOn ? num("moExtraMo") : 0,
          extraOnce: extrasOn ? num("moExtraOnce") : 0,
          extraOnceMonth: extrasOn ? num("moExtraWhen") : 0,
          recast: extrasOn && $("moRecast").value === "1",
          refiOn: extrasOn && rate("moRefiRate") > 0,
          refiRate: rate("moRefiRate"), refiTerm: parseFloat($("moRefiTerm").value),
          refiCost: num("moRefiCost")};
}
/* PMI only exists below 20% down, so the field mirrors that: it fills in a
   default when PMI applies and blanks to 0 when it doesn't, rather than showing
   a rate that isn't used. */
const PMI_DEFAULT = 0.6;
let pmiAuto = false;
function syncPmi(){
  if (pmiAuto) return;
  pmiAuto = true;
  const price = num("moPrice"), down = num("moDownAmt");
  const ltv = price > 0 ? (price - down) / price : 0;
  const cur = num("moPmi");
  if (ltv > .80 && cur === 0) $("moPmi").value = String(PMI_DEFAULT);
  else if (ltv <= .80 && cur !== 0) $("moPmi").value = "0";
  pmiAuto = false;
}
/* the two down-payment fields mirror each other; whichever was typed in wins */
let downLock = false;
function syncDown(from){
  if (downLock) return;
  downLock = true;
  const price = num("moPrice");
  if (from === "pct"){
    $("moDownAmt").value = groupDigits((price * rate("moDownPct")).toFixed(0), true);
  } else {
    $("moDownPct").value = price > 0
      ? String(Math.round(num("moDownAmt") / price * 10000) / 100) : "0";
  }
  downLock = false;
}
function moWhen(months){
  const y = Math.floor(months / 12), m = months % 12;
  if (!y) return m + (m === 1 ? " month" : " months") + " in";
  if (!m) return "year " + y;
  return "year " + y + ", month " + m;
}
function moDur(months){
  const y = Math.floor(months / 12), m = months % 12;
  if (!y) return m + (m === 1 ? " month" : " months");
  if (!m) return y + (y === 1 ? " year" : " years");
  return y + "y " + m + "m";
}
function renderMortExtras(m, R){
  const active = R.extraActive;
  $("moExtraPanel").hidden = !active && !m.refiOn;
  if (!active){
    $("moExtraStats").innerHTML = "";
  } else {
    const base = mortgage(Object.assign({}, m, {extraMonthly:0, extraOnce:0,
      extraOnceMonth:0, recast:false}));
    const monthsSooner = base.payoffMonth - R.payoffMonth;
    const interestSaved = base.totalInterest - R.totalInterest;
    let html = "";
    html += "<div class='kv'><span class='k'>Payoff</span><span class='v pos'>" +
      moWhen(R.payoffMonth) + (monthsSooner > 0
        ? " (" + moDur(monthsSooner) + " sooner)" : "") + "</span></div>";
    html += "<div class='kv'><span class='k'>Interest saved</span><span class='v pos'>" +
      money(Math.max(0, interestSaved)) + "</span></div>";
    if (R.recastPI != null)
      html += "<div class='kv'><span class='k'>Payment after the recast</span><span class='v'>" +
        money(R.recastPI) + "/mo</span></div>";
    $("moExtraStats").innerHTML = html;
  }

  $("moRefiBlock").hidden = !m.refiOn;
  if (m.refiOn){
    const RF = refiCompare(m, {rate:m.refiRate, term:m.refiTerm, cost:m.refiCost});
    $("moRefiHead").textContent = pctStr(m.refiRate, 2) + " for " + fmtNum(m.refiTerm) + " years";
    let html = "<div class='kv'><span class='k'>New payment</span><span class='v'>" +
      money(RF.then.pi) + "/mo</span></div>";
    html += "<div class='kv'><span class='k'>Monthly change</span><span class='v " +
      (RF.monthlyDelta >= 0 ? "pos" : "neg") + "'>" +
      (RF.monthlyDelta >= 0 ? "\u2212" : "+") + money(Math.abs(RF.monthlyDelta)) + "/mo</span></div>";
    html += "<div class='kv'><span class='k'>Breaks even on closing costs</span><span class='v'>" +
      (RF.breakEvenMonths == null ? "Never \u2014 payment doesn't drop" :
       RF.breakEvenMonths <= 0 ? "Immediately \u2014 no closing costs to recover" :
       moDur(RF.breakEvenMonths)) +
      "</span></div>";
    html += "<div class='kv'><span class='k'>Over the life of the loan</span><span class='v " +
      (RF.lifetimeDelta >= 0 ? "pos" : "neg") + "'>" +
      (RF.lifetimeDelta >= 0 ? "Saves " : "Costs ") + money(Math.abs(RF.lifetimeDelta)) +
      "</span></div>";
    $("moRefiStats").innerHTML = html;
  }
}
function renderMort(){
  const m = readMort();
  const R = mortgage(m);
  $("moLoan").textContent = money(R.loan);
  $("moDownShow").textContent = money(m.down) + " (" + pctStr(m.price ? m.down / m.price : 0, 1) + ")";
  $("moTotInt").textContent = money(R.totalInterest);
  if (R.ltv > .80){
    $("moPmiNote").textContent = R.pmiEndMonth
      ? "PMI applies below 20% down. At this pace it ends around " + moWhen(R.pmiEndMonth) +
        " (federal law requires automatic removal at 22% equity either way)."
      : "PMI applies below 20% down. You can have it removed once you reach 20% equity, and federal law ends it automatically at 22%.";
  } else {
    $("moPmiNote").textContent = "No PMI; you're at or above 20% down.";
  }
  renderMortExtras(m, R);

  setBig("moTotal", money(R.total));
  setBig("moPI", money(R.pi));
  setBig("moEsc", money(R.total - R.pi));
  // name only what's actually in the figure
  const escParts = [[R.tax, "tax"], [R.ins, "insurance"], [R.pmi, "PMI"], [R.hoa, "HOA"],
    [R.maint, "upkeep"], [R.util, "utilities"]].filter(x => x[0] > 0).map(x => x[1]);
  const escTxt = escParts.length < 2 ? escParts.join("")
    : escParts.slice(0, -1).join(", ") + " and " + escParts[escParts.length - 1];
  $("moEscNote").textContent = escTxt ? escTxt.charAt(0).toUpperCase() + escTxt.slice(1) : "Nothing else added";

  const t = R.total || 1;
  $("moBars").innerHTML =
    bar("Principal & interest", R.pi, R.pi / t, "#4fbf95") +
    bar("Property tax", R.tax, R.tax / t, "#e9b872") +
    bar("Homeowners insurance", R.ins, R.ins / t, "#7d9fd6") +
    (R.pmi > 0 ? bar("Mortgage insurance (PMI)", R.pmi, R.pmi / t, "#e2795f") : "") +
    (R.hoa > 0 ? bar("HOA dues", R.hoa, R.hoa / t, "#8ba0ac") : "") +
    (R.maint > 0 ? bar("Maintenance", R.maint, R.maint / t, "#b48ec4") : "") +
    (R.util > 0 ? bar("Utilities", R.util, R.util / t, "#6fb0a6") : "");

  $("moTable").querySelector("tbody").innerHTML = R.years.map(y =>
    "<tr><td>" + y.year + "</td><td>" + money(y.interest) + "</td><td class='pos'>" +
    money(y.principal) + "</td><td>" + money(y.paid) + "</td><td>" +
    money(y.balance) + "</td></tr>").join("");

  // balance falling against cumulative interest and principal paid
  let ci = 0, cp = 0;
  const pts = [{year:0, base:R.loan, hi:0, lo:0}];
  R.years.forEach(y => { ci += y.interest; cp += y.principal;
    pts.push({year:y.year, base:y.balance, hi:cp, lo:ci}); });
  mortPoints = paintChart("chartMo", pts, R.years.length || 1, "band", [], 0, {enhanced:true});
  $("legendMo").innerHTML = swatch("#e9b872", "Balance remaining") +
    swatch("#4fbf95", "Principal paid") + swatch("#e2795f", "Interest paid");
}
attachChart("chartWrapMo", "chartMo", "tipMo", () => mortPoints,
  best => "<b>Year " + fmtNum(best.year) + "</b>" +
    "<br><span style='color:#e9b872'>Balance</span> <span class='n'>" + money(best.base) +
    "</span><br><span style='color:#4fbf95'>Principal paid</span> <span class='n'>" + money(best.hi) +
    "</span><br><span style='color:#e2795f'>Interest paid</span> <span class='n'>" + money(best.lo) + "</span>");

["moRate","moTax","moIns","moPmi","moHoa","moMaint","moUtil"].forEach(id =>
  $(id).addEventListener("input", renderMort));
$("moPrice").addEventListener("input", () => { syncDown("pct"); syncPmi(); renderMort(); });
$("moDownPct").addEventListener("input", () => { syncDown("pct"); syncPmi(); renderMort(); });
$("moDownAmt").addEventListener("input", () => { syncDown("amt"); syncPmi(); renderMort(); });
$("moTerm").addEventListener("change", renderMort);

["moExtraMo","moExtraOnce","moExtraWhen","moRefiRate","moRefiCost"].forEach(id =>
  $(id).addEventListener("input", renderMort));
["moRecast","moRefiTerm"].forEach(id => $(id).addEventListener("change", renderMort));
$("moExtrasOn").addEventListener("change", () => {
  $("moExtrasWrap").hidden = $("moExtrasOn").value !== "1";
  renderMort();
});

