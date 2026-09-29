/* ---------- scenarios ---------- */
function readTaxState(){
  return {mode:txMode, gross:num("txGross"), gross2:num("txGross2"), status:$("txStatus").value,
          state:$("txState").value, pre:num("txPre"), dedType:$("txDedType").value,
          item:num("txItem"), trad:num("txTrad"), roth:num("txRoth"),
          brok:num("txBrok"), gainPct:num("txGainPct"), ss:num("txSS"),
          pension:num("txPension"), penType:$("txPenType").value,
          other:num("txOther"), seniors:parseInt($("txSeniors").value, 10) || 0};
}
function writeTaxState(d){
  if (d.mode) txMode = d.mode === "retire" ? "retire" : "normal";
  if (d.gross != null) $("txGross").value = groupDigits(d.gross, true);
  // Older saved scenarios have no spouse split; default to $0 rather than
  // guessing a 50/50 divide, so a reloaded scenario's numbers don't move
  // until the spouse field is actually filled in.
  $("txGross2").value = groupDigits(d.gross2 || 0, true);
  if (d.status) $("txStatus").value = d.status;
  if (d.state) $("txState").value = d.state;
  if (d.pre != null) $("txPre").value = groupDigits(d.pre, true);
  if (d.dedType) $("txDedType").value = d.dedType;
  if (d.item != null) $("txItem").value = groupDigits(d.item, true);
  if (d.trad != null) $("txTrad").value = groupDigits(d.trad, true);
  if (d.roth != null) $("txRoth").value = groupDigits(d.roth, true);
  if (d.brok != null) $("txBrok").value = groupDigits(d.brok, true);
  if (d.gainPct != null) $("txGainPct").value = String(d.gainPct);
  if (d.ss != null) $("txSS").value = groupDigits(d.ss, true);
  if (d.pension != null) $("txPension").value = groupDigits(d.pension, true);
  if (d.penType != null) $("txPenType").value = d.penType;
  if (d.other != null) $("txOther").value = groupDigits(d.other, true);
  if (d.seniors != null) $("txSeniors").value = String(d.seniors);
  applyTaxMode();
}
const CL_DEFAULTS = {preset:"27000", cost:27000, years:18, collegeYrs:4, saved:0, ret:6, infl:4};
function readCollegeState(){
  return {preset:$("clPreset").value, cost:num("clCost"), years:num("clYears"),
          collegeYrs:num("clCollegeYrs"), saved:num("clSaved"), ret:num("clReturn"),
          infl:num("clInfl")};
}
function writeCollegeState(d){
  if (d.preset != null) $("clPreset").value = d.preset;
  if (d.cost != null) $("clCost").value = groupDigits(d.cost, true);
  if (d.years != null) $("clYears").value = d.years;
  if (d.collegeYrs != null) $("clCollegeYrs").value = d.collegeYrs;
  if (d.saved != null) $("clSaved").value = groupDigits(d.saved, true);
  if (d.ret != null) $("clReturn").value = String(d.ret);
  if (d.infl != null) $("clInfl").value = String(d.infl);
}
const RB_DEFAULTS = {price:450000, down:20, rate:MORT_RATE_30, term:"30", propTax:1.1,
  ins:1800, maint:1, close:3, sell:3, rent:1800, rentInc:3.2, appr:4, invest:7, horizon:30,
  gainTax:15, status:"m"};
function readRBState(){
  return {price:num("rbPrice"), down:num("rbDown"), rate:num("rbRate"), term:$("rbTerm").value,
          propTax:num("rbPropTax"), ins:num("rbIns"), maint:num("rbMaint"), close:num("rbClose"),
          sell:num("rbSell"), rent:num("rbRent"), rentInc:num("rbRentInc"), appr:num("rbAppr"),
          invest:num("rbInvest"), horizon:num("rbHorizon"), gainTax:num("rbGainTax"),
          status:$("rbStatus").value};
}
function writeRBState(d){
  if (d.price != null) $("rbPrice").value = groupDigits(d.price, true);
  if (d.down != null) $("rbDown").value = String(d.down);
  if (d.rate != null) $("rbRate").value = String(d.rate);
  if (d.term) $("rbTerm").value = d.term;
  if (d.propTax != null) $("rbPropTax").value = String(d.propTax);
  if (d.ins != null) $("rbIns").value = groupDigits(d.ins, true);
  if (d.maint != null) $("rbMaint").value = String(d.maint);
  if (d.close != null) $("rbClose").value = String(d.close);
  if (d.sell != null) $("rbSell").value = String(d.sell);
  if (d.rent != null) $("rbRent").value = groupDigits(d.rent, true);
  if (d.rentInc != null) $("rbRentInc").value = String(d.rentInc);
  if (d.appr != null) $("rbAppr").value = String(d.appr);
  if (d.invest != null) $("rbInvest").value = String(d.invest);
  if (d.horizon != null) $("rbHorizon").value = String(d.horizon);
  if (d.gainTax != null) $("rbGainTax").value = String(d.gainTax);
  if (d.status) $("rbStatus").value = d.status;
}
function readMortState(){
  return {price:num("moPrice"), downPct:num("moDownPct"), downAmt:num("moDownAmt"),
          rate:num("moRate"), term:$("moTerm").value, tax:num("moTax"), ins:num("moIns"),
          pmi:num("moPmi"), hoa:num("moHoa"), maint:num("moMaint"), util:num("moUtil"),
          extrasOn:$("moExtrasOn").value, extraMo:num("moExtraMo"),
          extraOnce:num("moExtraOnce"), extraWhen:num("moExtraWhen"),
          recast:$("moRecast").value, refiRate:num("moRefiRate"),
          refiTerm:$("moRefiTerm").value, refiCost:num("moRefiCost")};
}
function writeMortState(d){
  if (d.price != null) $("moPrice").value = groupDigits(d.price, true);
  if (d.downPct != null) $("moDownPct").value = String(d.downPct);
  if (d.downAmt != null) $("moDownAmt").value = groupDigits(d.downAmt, true);
  if (d.rate != null) $("moRate").value = String(d.rate);
  if (d.term) $("moTerm").value = d.term;
  if (d.tax != null) $("moTax").value = String(d.tax);
  if (d.ins != null) $("moIns").value = groupDigits(d.ins, true);
  if (d.pmi != null) $("moPmi").value = String(d.pmi);
  if (d.hoa != null) $("moHoa").value = groupDigits(d.hoa, true);
  if (d.maint != null) $("moMaint").value = String(d.maint);
  if (d.util != null) $("moUtil").value = groupDigits(d.util, true);
  if (d.extrasOn != null) $("moExtrasOn").value = String(d.extrasOn);
  if (d.extraMo != null) $("moExtraMo").value = groupDigits(d.extraMo, true);
  if (d.extraOnce != null) $("moExtraOnce").value = groupDigits(d.extraOnce, true);
  if (d.extraWhen != null) $("moExtraWhen").value = String(d.extraWhen);
  if (d.recast != null) $("moRecast").value = String(d.recast);
  if (d.refiRate != null) $("moRefiRate").value = String(d.refiRate);
  if (d.refiTerm) $("moRefiTerm").value = d.refiTerm;
  if (d.refiCost != null) $("moRefiCost").value = groupDigits(d.refiCost, true);
  $("moExtrasWrap").hidden = $("moExtrasOn").value !== "1";
}

function readBudgetState(){
  return {income:num("bgIncomeIn"), incomeFreq:bgIncomeFreq,
          rows:budget.map(r => ({group:r.group, desc:r.desc, amount:r.amount,
                                 freq:r.freq, custom:!!r.custom}))};
}
function writeBudgetState(d){
  if (d.income != null) $("bgIncomeIn").value = groupDigits(d.income, true);
  if (d.incomeFreq != null){
    bgIncomeFreq = parseInt(d.incomeFreq, 10) || 1;
    $("bgIncomeFreq").querySelectorAll("button").forEach(x =>
      x.classList.toggle("on", x.getAttribute("data-freq") === String(bgIncomeFreq)));
  }
  if (Array.isArray(d.rows) && d.rows.length)
    budget = d.rows.map(r => Object.assign({}, r));
  buildBudget();
}
const TOOL_LABEL = {basic:"scenario", advanced:"scenario", stages:"scenario",
                    tax:"tax scenario",
                    mortgage:"mortgage scenario", budget:"budget",
                    college:"college plan", rentbuy:"rent-vs-buy scenario",
                    drawdown:"drawdown plan", roth:"conversion plan",
                    debt:"debt plan", backtest:"backtest",
                    healthcare:"healthcare plan", bridge:"bridge plan",
                    fire:"FIRE plan", guide:"readiness plan"};
function refreshScenarioList(selected){
  const sel = $("scenarioPick");
  const list = SC[activeTool()];
  if (!list.length){
    sel.innerHTML = "<option value=''>No saved scenarios</option>";
    return;
  }
  sel.innerHTML = "<option value=''>Unsaved</option>" +
    list.map(s => "<option value='" + escapeHtml(s.name) + "'>" +
      escapeHtml(s.name) + "</option>").join("");
  sel.value = selected || "";
  updateScenarioDirtyUI();
}
/* Flags the loaded scenario's own option as "(edited)" once the on-screen
   inputs drift from what was last saved/loaded, without rebuilding the
   dropdown (which would fight the browser's own open/close state on mobile). */
function updateScenarioDirtyUI(){
  const tool = activeTool();
  const sel = $("scenarioPick");
  const name = currentScenario[tool];
  if (!name || loadedSnapshot[tool] == null) return;
  let opt = null;
  for (let i = 0; i < sel.options.length; i++)
    if (sel.options[i].value === name){ opt = sel.options[i]; break; }
  if (!opt) return;
  let dirty = false;
  try { dirty = JSON.stringify(buildToolData(tool)) !== loadedSnapshot[tool]; }
  catch(e){}
  const base = name;
  opt.textContent = dirty ? base + " (edited)" : base;
}
let dirtyCheckTimer;
function scheduleDirtyCheck(){
  clearTimeout(dirtyCheckTimer);
  dirtyCheckTimer = setTimeout(updateScenarioDirtyUI, 120);
}
document.addEventListener("input", scheduleDirtyCheck, true);
document.addEventListener("change", scheduleDirtyCheck, true);
$("scenarioPick").addEventListener("change", e => {
  const tool = activeTool();
  const val = e.target.value;
  if (!val){
    currentScenario[tool] = "";
    loadedSnapshot[tool] = null;
    return;
  }
  const s = SC[tool].find(x => x.name === val);
  if (!s) return;
  if (tool === "basic"){ writeBasic(s.data); renderBasic(); }
  else if (tool === "advanced"){ writeAdvancedState(s.data); renderAll(); }
  else if (tool === "stages"){ writeStagesState(s.data); }
  else if (tool === "tax"){ writeTaxState(s.data); renderTax(); }
  else if (tool === "mortgage"){ writeMortState(s.data); syncPmi(); renderMort(); }
  else if (tool === "budget"){ writeBudgetState(s.data); renderBudget(); }
  else if (tool === "college"){ writeCollegeState(s.data); renderCollege(); }
  else if (tool === "rentbuy"){ writeRBState(s.data); renderRentBuy(); }
  else if (tool === "drawdown"){ writeDDState(s.data); renderItemLists(); renderDrawdown(); }
  else if (tool === "roth"){ writeRCState(s.data); renderRoth(); }
  else if (tool === "debt"){ writeDebtState(s.data); renderDebt(); }
  else if (tool === "backtest"){ writeBTState(s.data); renderBacktest(); }
  else if (tool === "healthcare"){ writeAsideState("asideHC", s.data); renderHealthcare(); }
  else if (tool === "bridge"){ writeAsideState("asideBR", s.data); renderBridge(); }
  else if (tool === "fire"){ writeFireState(s.data); }
  else if (tool === "guide"){ gdLoadPlan(s.data); }
  currentScenario[tool] = s.name;
  loadedSnapshot[tool] = JSON.stringify(buildToolData(tool));
  updateScenarioDirtyUI();
});
/* Shared modal behavior for both popups below: Escape closes, Tab cycles
   inside the dialog instead of walking into the page behind it, and focus
   returns to whatever opened it. close() is the builder's own dismissal, so
   each still resolves its promise with its own cancel value. */
function wireModal(ov, close){
  const opener = document.activeElement;
  const pop = ov.querySelector(".popup");
  pop.setAttribute("role", "dialog");
  pop.setAttribute("aria-modal", "true");
  const FOCUSABLE = "button,select,input,textarea,a[href],[tabindex]:not([tabindex='-1'])";
  function onKey(e){
    if (e.key === "Escape"){ e.preventDefault(); done(); close(); return; }
    if (e.key !== "Tab") return;
    const items = Array.prototype.filter.call(
      pop.querySelectorAll(FOCUSABLE), el => !el.disabled && el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  }
  function done(){
    document.removeEventListener("keydown", onKey, true);
    if (opener && opener.focus) { try { opener.focus(); } catch(e){} }
  }
  document.addEventListener("keydown", onKey, true);
  ov._modalDone = done;
}

