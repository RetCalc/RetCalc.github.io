/* ---------- wire up ---------- */
["initial","contrib","growth","nominal","inflation","years","withdrawal","taxrate","fees"]
  .forEach(id => $(id).addEventListener("input", renderAll));
$("period").addEventListener("change", renderAll);
["acTradBal","acTradC","acRothBal","acRothC","acBrokBal","acBrokC","acBrokBasis",
 "acSalary","acMatchPct","acMatchCap"].forEach(id => $(id).addEventListener("input", renderAll));
["acStatus","acState"].forEach(id => $(id).addEventListener("change", renderAll));
$("acToggle").addEventListener("click", e => {
  if (e.target.closest && e.target.closest(".tipdot")) return;
  const turningOn = !acOn();
  if (turningOn){
    // Seed from what's on screen, so switching modes doesn't change the answer
    // until you start splitting it up: the whole balance and contribution
    // start out in traditional.
    const blank = ["acTradBal","acTradC","acRothBal","acRothC","acBrokBal","acBrokC"]
      .every(id => !(num(id) > 0));
    if (blank){
      const H = hhLoad() || {};
      writeAcct({on:true, tradBal:num("initial"), tradC:num("contrib"), rothBal:0, rothC:0,
        brokBal:0, brokC:0, brokBasis:null, salary:H.income || 0, matchPct:0, matchCap:6,
        status:H.status || $("txStatus").value, state:H.state || $("txState").value});
    } else {
      $("acToggle").classList.add("on");
      acSync();
    }
    renderAll();
    toast("Tax is now worked out from each account type");
  } else {
    // Carry the totals and the rate it worked out back into the single
    // fields, so the answer doesn't jump when you switch back.
    const p = readInputs();
    $("initial").value = groupDigits(Math.round(p.initial), true);
    $("contrib").value = groupDigits(Math.round(p.contrib), true);
    $("taxrate").value = +(p.taxRate * 100).toFixed(2);
    $("acToggle").classList.remove("on");
    acSync();
    renderAll();
    toast("Back to one total, with a " + pctStr(p.taxRate, 1) + " tax rate");
  }
});
$("target").addEventListener("input", renderSolve);
$("solveFor").addEventListener("change", renderSolve);
$("targetS").addEventListener("input", () => renderSeries());
$("solveForS").addEventListener("change", () => renderSeries());
["inflAmt","inflYrs"].forEach(id => $(id).addEventListener("input", renderTools));
$("band").addEventListener("input", () => {
  if (chartMode.single === "band" && lastRun) drawChart(lastRun, readInputs());
});
/* Mobile browsers fire resize when the URL bar hides during scroll. Redraw only
   when the width really changed, and debounce it. The tools' charts are
   drawn in one of two layouts, phone and wider, so an open tool redraws when
   the window crosses from one to the other (a phone turned sideways, a window
   dragged narrow) rather than keep the other layout stretched to fit. */
let lastW = window.innerWidth, lastNarrow = window.innerWidth < 640, resizeTimer;
window.addEventListener("resize", () => {
  if (window.innerWidth === lastW) return;
  lastW = window.innerWidth;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (!$("tab-single").hidden && lastRun) drawChart(lastRun, readInputs());
    if (!$("tab-series").hidden) renderSeries();
    const narrow = window.innerWidth < 640;
    if (narrow !== lastNarrow){
      lastNarrow = narrow;
      if (chartMode.tab === "tools" && toolSub !== "picker") renderToolSub(toolSub);
    }
  }, 120);
});

/* defaults for both tabs go in first, then a shared link overrides them */
writeInputs(DEFAULTS);
writeGlobals(SERIES_GLOBALS);
buildStages();
refreshScenarioList("");
$("txGross").value = groupDigits(100000, true);
$("txGross2").value = groupDigits(0, true);
$("txPre").value = groupDigits(0, true);
$("txItem").value = groupDigits(0, true);
$("txState").value = "IL";
$("txTrad").value = groupDigits(40000, true);
$("txRoth").value = groupDigits(10000, true);
$("txBrok").value = groupDigits(20000, true);
$("txGainPct").value = "40";
$("txSS").value = groupDigits(30000, true);
$("txPension").value = groupDigits(0, true);
$("txOther").value = groupDigits(0, true);
$("txSeniors").value = "1";
applyTaxMode();
$("moPrice").value = groupDigits(450000, true);
$("moDownPct").value = "20";
$("moDownAmt").value = groupDigits(90000, true);
$("moRate").value = String(MORT_RATE_30);
$("moTax").value = "1.1";
$("moIns").value = groupDigits(1800, true);
$("moPmi").value = "0";
$("moHoa").value = groupDigits(0, true);
$("moMaint").value = "1";
$("moUtil").value = groupDigits(300, true);
$("moExtraMo").value = groupDigits(0, true);
$("moExtraOnce").value = groupDigits(0, true);
$("moExtraWhen").value = "12";
$("moRefiRate").value = "0";
$("moRefiCost").value = groupDigits(0, true);
$("rbPrice").value = groupDigits(450000, true);
$("rbDown").value = "20";
$("rbRate").value = String(MORT_RATE_30);
$("rbTerm").value = "30";
$("rbPropTax").value = "1.1";
$("rbIns").value = groupDigits(1800, true);
$("rbMaint").value = "1";
$("rbClose").value = "3";
$("rbSell").value = "3";
$("rbRent").value = groupDigits(1800, true);
$("rbRentInc").value = "3.2";
$("rbAppr").value = "4";
$("rbInvest").value = "7";
$("rbHorizon").value = "30";
$("rbGainTax").value = "15";
$("rbStatus").value = "m";
writeRCState(RC_DEFAULTS);
$("dtExtra").value = groupDigits(300, true);
buildDebtList();
$("ddInitial").value = groupDigits(1000000, true);
$("ddYears").value = "30";
$("ddStock").value = "60";
$("ddFee").value = "0";
$("ddRate").value = "4";
$("qAge").value = "30";
$("qRetire").value = "65";
$("qSaved").value = groupDigits(10000, true);
$("qContrib").value = groupDigits(500, true);
$("qPeriod").value = "Monthly";
$("target").value = groupDigits(100000);
$("targetS").value = groupDigits(100000);
$("inflYrs").value = DEFAULTS.years;

