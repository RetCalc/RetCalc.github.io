/* ---------- household profile ---------- */
/* The handful of facts nearly every tool asks for, entered once. It's a
   one-way fill: saving writes these numbers into each tool's own fields, and
   from then on each tool is free to drift. Nothing here is read live, so an
   edit in one tool never quietly changes another. */
function hhLoad(){
  const v = storeRead("household");
  return v && typeof v === "object" ? v : null;
}
function hhIsEmpty(H){
  return !H || Object.keys(H).every(k => k === "status" || H[k] == null || H[k] === "");
}
function hhReadForm(){
  const opt = id => { const t = $(id).value.trim(); return t === "" ? null : parseNum(t); };
  const married = $("hhStatus").value === "m";
  return {status: married ? "m" : "s", age:opt("hhAge"),
    spouseAge: married ? opt("hhSpouseAge") : null, retire:opt("hhRetire"),
    state:$("hhState").value || null, saved:opt("hhSaved"), monthly:opt("hhMonthly"),
    income:opt("hhIncome"), income2: married ? opt("hhIncome2") : null, spend:opt("hhSpend")};
}
function hhWriteForm(H){
  H = H || {};
  const put = (id, v, isMoney) => {
    $(id).value = v == null ? "" : (isMoney ? groupDigits(v, true) : String(v));
  };
  $("hhStatus").value = H.status === "m" ? "m" : "s";
  put("hhAge", H.age); put("hhSpouseAge", H.spouseAge); put("hhRetire", H.retire);
  $("hhState").value = H.state || "";
  put("hhSaved", H.saved, true); put("hhMonthly", H.monthly, true);
  put("hhIncome", H.income, true); put("hhIncome2", H.income2, true);
  put("hhSpend", H.spend, true);
  hhSyncStatus();
}
function hhSyncStatus(){ $("hhCard").classList.toggle("married", $("hhStatus").value === "m"); }
function hhSummary(){
  const H = hhLoad();
  if (hhIsEmpty(H)){
    $("hhSummary").innerHTML = "<b>Your household</b>Enter a few details once and every tool starts from your numbers.";
    $("hhEdit").textContent = "Set up";
    return;
  }
  // Full wording for wide screens; phones get a compact line ($825K, IL)
  // that fits the whole profile in the collapsed bar's two lines.
  const k = v => {
    const a = Math.abs(v), sign = v < 0 ? "-" : "";
    const f = (x, u) => sign + "$" + (+x.toFixed(x < 10 ? 1 : 0)) + u;
    return a >= 1e6 ? f(a / 1e6, "M") : a >= 1e3 ? f(a / 1e3, "K") : money(v);
  };
  const bits = [], short = [];
  if (H.age != null){
    const ages = fmtNum(H.age) + (H.status === "m" && H.spouseAge != null ? " & " + fmtNum(H.spouseAge) : "");
    bits.push("Age " + ages); short.push("Age " + ages);
  }
  if (H.retire != null){ bits.push("retire at " + fmtNum(H.retire)); short.push("retire " + fmtNum(H.retire)); }
  if (H.saved != null){ bits.push(money(H.saved) + " saved"); short.push(k(H.saved) + " saved"); }
  if (H.monthly != null){ bits.push(money(H.monthly) + "/mo"); short.push(k(H.monthly) + "/mo"); }
  const inc = (H.income || 0) + (H.income2 || 0);
  if (inc > 0){ bits.push(money(inc) + "/yr income"); short.push(k(inc) + " income"); }
  if (H.spend != null){ bits.push("spend " + money(H.spend) + "/yr"); short.push(k(H.spend) + " spend"); }
  if (H.state && STATES[H.state]){ bits.push(STATES[H.state].n); short.push(H.state); }
  const list = (arr, cls) => "<span class='hh-bits " + cls + "'>" +
    arr.map(b => "<span>" + b + "</span>").join("") + "</span>";
  $("hhSummary").innerHTML = "<b>Your household</b>" + list(bits, "hh-long") + list(short, "hh-short");
  $("hhEdit").textContent = "Edit";
}
/* Writes the profile into each tool's fields. `only` limits it to one tool
   (Reset uses that). Blank profile fields leave the tool's own value alone.
   Returns the names of the tools that actually changed. */
function hhApply(H, only){
  if (hhIsEmpty(H)) return [];
  const done = [];
  const want = t => !only || only === t;
  const has = v => v != null && isFinite(v);
  const m = v => groupDigits(Math.round(v), true);
  const married = H.status === "m";
  const age = has(H.age) && H.age > 0 && H.age < 120 ? Math.round(H.age) : null;
  const retire = has(H.retire) && H.retire > 0 && H.retire < 120 ? Math.round(H.retire) : null;
  const yrs = age && retire && retire > age ? Math.min(100, retire - age) : null;
  const spend = has(H.spend) && H.spend > 0 ? H.spend : null;
  const inc1 = has(H.income) ? H.income : null;
  const inc2 = married && has(H.income2) ? H.income2 : null;

  if (want("basic") && (age || retire || has(H.saved) || has(H.monthly))){
    if (age) $("qAge").value = String(age);
    if (retire && (!age || retire > age)) $("qRetire").value = String(age ? Math.min(retire, age + 100) : retire);
    if (has(H.saved)) $("qSaved").value = m(H.saved);
    if (has(H.monthly)){ $("qContrib").value = m(H.monthly); $("qPeriod").value = "Monthly"; }
    done.push("Basic");
  }
  if (want("advanced")){
    let hit = false;
    if (yrs){ $("years").value = String(yrs); hit = true; }
    if (acOn()){
      // the split is the tool's own; only the facts about you carry in
      if (has(inc1)) $("acSalary").value = m(inc1);
      $("acStatus").value = married ? "m" : "s";
      if (H.state) $("acState").value = H.state;
      hit = true;
    } else {
      if (has(H.saved)){ $("initial").value = m(H.saved); hit = true; }
      if (has(H.monthly)){ $("contrib").value = m(H.monthly); $("period").value = "Monthly"; hit = true; }
    }
    if (spend){ $("solveFor").value = "After-Tax Withdrawal"; $("target").value = m(spend); hit = true; }
    if (hit){ updateGlideNote(); done.push("Advanced"); }
  }
  if (want("stages") && (has(H.saved) || spend || saOn())){
    if (saOn()){
      if (has(inc1)) $("saSalary").value = m(inc1);
      $("saStatus").value = married ? "m" : "s";
      if (H.state) $("saState").value = H.state;
    } else if (has(H.saved)) $("gInitial").value = m(H.saved);
    if (spend){ $("solveForS").value = "After-Tax Withdrawal"; $("targetS").value = m(spend); }
    done.push("Stages");
  }
  if (want("fire") && (age || retire || has(H.saved) || has(H.monthly) || spend)){
    if (age) $("fiCurAge").value = String(Math.max(18, Math.min(70, age)));
    if (retire) $("fiRetireAge").value = String(retire);
    if (has(H.saved)) $("fiInitial").value = m(H.saved);
    if (has(H.monthly)){ $("fiContrib").value = m(H.monthly); $("fiPeriod").value = "Monthly"; }
    if (spend){
      $("fiTarget").value = m(spend);
      if ($("fiSolveFor").value !== "withdrawal"){
        $("fiSolveFor").value = "withdrawal";
        $("fiSolveFor").dispatchEvent(new Event("change", {bubbles:true}));
      }
    }
    done.push("FIRE");
  }
  if (want("drawdown") && (retire || has(inc1))){
    const d = {ssWho: married ? "couple" : "single"};
    if (retire) d.retireAge = String(retire);
    if (has(inc1)) d.ssIncome = inc1;
    if (has(inc2)) d.ssIncome2 = inc2;
    writeDDState(d);
    done.push("Drawdown");
  }
  if (want("roth")){
    const d = {status: married ? "m" : "s"};
    if (age) d.age = age;
    if (married && has(H.spouseAge) && H.spouseAge > 0) d.spouseAge = Math.round(H.spouseAge);
    if (H.state) d.state = H.state;
    if (spend) d.spend = spend;
    writeRCState(d);
    done.push("Roth");
  }
  if (want("bridge") && (retire || H.state || spend || H.status)){
    if (retire && retire >= 30 && retire < 60) $("brAge").value = String(retire);
    $("brStatus").value = married ? "m" : "s";
    if (!married || num("brHousehold") <= 2) $("brHousehold").value = married ? "2" : "1";
    if (H.state && $("brState").querySelector("option[value='" + H.state + "']")) $("brState").value = H.state;
    if (spend) $("brSpend").value = m(spend);
    done.push("Early Retirement Bridge");
  }
  if (want("healthcare")){
    if (retire && retire >= 40 && retire <= 75) $("hcRetireAge").value = String(retire);
    $("hcStatus").value = married ? "m" : "s";
    if (!married || num("hcHousehold") <= 2) $("hcHousehold").value = married ? "2" : "1";
    if (married && H.spouseAge > 0 && H.age > 0 && retire)
      $("hcSpouseAge").value = String(Math.round(H.spouseAge + (retire - H.age)));
    if (H.state && $("hcState").querySelector("option[value='" + H.state + "']"))
      $("hcState").value = H.state;
    done.push("Healthcare");
  }
  if (want("tax")){
    const d = {status: married ? "m" : "s", gross2: inc2 || 0};
    if (has(inc1)) d.gross = inc1;
    if (H.state) d.state = H.state;
    writeTaxState(d);
    done.push("Income Tax");
  }
  if (want("budget") && has(inc1) && (inc1 + (inc2 || 0)) > 0){
    // Budget wants take-home pay, so run the salary through the same 2026
    // rules the Income Tax tool uses, before any retirement saving.
    const T = computeTax({status: married ? "m" : "s", gross:inc1, gross2:inc2 || 0,
      pre:0, dedType:"std", item:0, state:H.state || $("txState").value});
    $("bgIncomeIn").value = m(T.net / bgIncomeFreq);
    done.push("Budget");
  }
  return done;
}
/* Re-render whatever is on screen after a fill. Hidden tools render when
   they're next opened, so there's no need to pay for them now. */
function hhRerender(){
  renderBasic(); renderAll(); renderSeries();
  if (chartMode.tab !== "tools") return;
  const sub = toolSub;
  if (sub === "tax") renderTax();
  else if (sub === "budget") renderBudget();
  else if (sub === "drawdown") renderDrawdown();
  else if (sub === "roth") renderRoth();
  else if (sub === "healthcare"){ if (hcReady) renderHealthcare(); }
  else if (sub === "bridge") renderBridge();
  else if (sub === "fire") $("fiTarget").dispatchEvent(new Event("input", {bubbles:true}));
}
function hhOpen(open){
  $("hhBody").hidden = !open;
  $("hhEdit").setAttribute("aria-expanded", String(open));
  if (open){
    $("hhEdit").textContent = "Close";
    const first = $("hhAge");
    try { first.focus({preventScroll:true}); } catch(e){ first.focus(); }
  } else hhSummary();
}
/* Shown on every visit; hiding it lasts until the page is next opened. On
   About it moves into its own slot under Appearance, where it can't be
   hidden, and it goes back to the top of the page when you leave. */
let hhShown = true;
function hhPlace(t){
  const card = $("hhCard"), slot = $("hhAboutSlot");
  if (t === "about"){
    if (card.parentNode !== slot) slot.appendChild(card);
    card.classList.add("inabout");
    card.hidden = false;
  } else {
    if (card.parentNode === slot){
      $("main").insertBefore(card, $("toolBack"));
      card.classList.remove("inabout");
      if (!$("hhBody").hidden){ hhWriteForm(hhLoad()); hhOpen(false); }
    }
    card.hidden = !hhShown;
  }
}
function hhSetShown(v){
  hhShown = v;
  const b = $("btnHousehold");
  b.setAttribute("aria-pressed", String(v));
  const lbl = v ? "Hide your household bar" : "Show your household bar";
  b.setAttribute("aria-label", lbl); b.setAttribute("title", lbl);
  if (!$("hhCard").classList.contains("inabout")) $("hhCard").hidden = !v;
}
$("hhHide").addEventListener("click", () => {
  if (!$("hhBody").hidden){ hhWriteForm(hhLoad()); hhOpen(false); }
  hhSetShown(false);
  toast("Hidden. The house button at the top brings it back.");
});
$("btnHousehold").addEventListener("click", () => {
  if ($("hhCard").classList.contains("inabout")){
    if ($("hhBody").hidden) hhOpen(true);
    try { $("hhCard").scrollIntoView({behavior:"smooth", block:"start"}); } catch(e){}
    return;
  }
  hhSetShown(!hhShown);
  if (hhShown){ try { window.scrollTo({top:0, behavior:"smooth"}); } catch(e){ window.scrollTo(0, 0); } }
});
$("hhState").innerHTML = "<option value=''>Not set</option>" + $("txState").innerHTML;
initFields($("hhCard"));
hhWriteForm(hhLoad());
hhSummary();
$("hhStatus").addEventListener("change", hhSyncStatus);
$("hhEdit").addEventListener("click", () => {
  if ($("hhBody").hidden) hhOpen(true);
  else { hhWriteForm(hhLoad()); hhOpen(false); }
});
$("hhCancel").addEventListener("click", () => { hhWriteForm(hhLoad()); hhOpen(false); });
$("hhFill").addEventListener("click", () => {
  const H = hhReadForm();
  if (H.age != null && H.retire != null && H.retire <= H.age){
    toast("Retire-at age needs to be after your current age first", "warn");
    return;
  }
  storeWrite("household", H);
  const done = hhApply(H);
  hhRerender();
  hhOpen(false);
  if (!done.length) toast("Saved. Add a few numbers to fill in the tools.");
  else toast("Filled in " + done.length + (done.length === 1 ? " tool: " : " tools: ") +
    done.join(", "));
});
$("hhClear").addEventListener("click", () => {
  if (!hhIsEmpty(hhLoad()) && !confirm("Clear your household profile? Numbers already filled in to each tool stay as they are.")) return;
  storeWrite("household", null);
  hhWriteForm(null);
  hhOpen(false);
  toast("Household profile cleared");
});
$("hhBody").addEventListener("keydown", e => {
  if (e.key === "Enter" && e.target.tagName === "INPUT"){ e.preventDefault(); $("hhFill").click(); }
  else if (e.key === "Escape"){ $("hhCancel").click(); }
});

