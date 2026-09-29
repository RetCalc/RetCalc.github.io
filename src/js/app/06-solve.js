/* ---------- goal solve ---------- */
function fmtYears(y){
  const r = Math.round(y * 100) / 100;
  const txt = (r === Math.floor(r)) ? String(r) : r.toFixed(2);
  return txt + (r === 1 ? " year" : " years");
}

function renderSolve(){
  const p = readInputs();
  const solveFor = $("solveFor").value;
  const S = goalSolve(acSolveP(p), solveFor, num("target"));
  $("targetHint").textContent = solveFor === "After-Tax Withdrawal"
    ? "The after-tax income you want each year, in today's spending power."
    : "The portfolio balance you want, in today's spending power.";
  $("sPortToday").textContent = money(S.portToday);
  $("sPays").textContent = money(S.pays) + " per year";
  $("sPortFuture").textContent = money(S.portFuture);
  $("sInitGrows").textContent = money(S.initGrows);

  // Option 1 — hold the timeline, change what you put in
  setBig("sPerPeriod", money(S.perPeriod, 2));
  $("sPerPeriodNote").textContent = "Paid " + p.period.toLowerCase() + " for "
    + fmtYears(p.years) + ", growing " + pctStr(p.growth, 1) + " a year";
  $("sPerYear").textContent = money(S.perYear);
  const ch = $("sChange");
  ch.textContent = (S.change >= 0 ? "+" : "") + money(S.change, 2);
  ch.className = "v " + (S.change > 0 ? "neg" : "pos");

  // Option 2 — hold the contribution, change how long you run it
  // Coast FIRE: when contributions could stop and growth alone still gets there
  const C = coastFire(p, S.portFuture);
  const coastEl = $("sCoast"), coastNote = $("sCoastNote");
  if (C.state === "already"){
    coastEl.textContent = "Already there";
    coastEl.className = "v pos";
    coastNote.textContent = "Your starting value alone reaches the target by year "
      + fmtNum(p.years) + ".";
    $("sCoastAction").innerHTML = "";
  } else if (C.state === "reachable"){
    coastEl.textContent = fmtYears(C.years);
    coastEl.className = "v pos";
    coastNote.textContent = "Stop contributing then and growth alone still reaches "
      + money(S.portToday) + " by year " + fmtNum(p.years) + ".";
    $("sCoastAction").innerHTML =
      "<button class='btn primary' type='button' id='btnCoast'>Model this as a staged plan</button>";
    $("btnCoast").addEventListener("click", () => applyCoast(p, C));
  } else {
    coastEl.textContent = "Not on track";
    coastEl.className = "v";
    coastNote.textContent = "This plan doesn't reach the target by year "
      + fmtNum(p.years) + ", so there's nothing to coast on yet.";
    $("sCoastAction").innerHTML = "";
  }

  const Y = solveYears(p, S.portToday);
  const diffEl = $("sYearsDiff");
  if (!Y.reached){
    setBig("sYears", "Out of reach");
    $("sYearsNote").textContent = "Not reached within 100 years at "
      + money(p.contrib, 2) + " " + p.period.toLowerCase() + ".";
    $("sYearsNow").textContent = fmtYears(p.years);
    diffEl.textContent = "—";
    diffEl.className = "v";
    $("btnApplyYears").disabled = true;
  } else {
    setBig("sYears", fmtYears(Y.years));
    $("sYearsNote").textContent = "Keeping " + money(p.contrib, 2) + " "
      + p.period.toLowerCase() + ", growing " + pctStr(p.growth, 1) + " a year";
    $("sYearsNow").textContent = fmtYears(p.years);
    const d = Y.years - p.years;
    diffEl.textContent = Math.abs(d) < 0.005 ? "on track"
      : (d > 0 ? "+" : "\u2212") + fmtYears(Math.abs(d));
    diffEl.className = "v " + (d > 0.005 ? "neg" : d < -0.005 ? "pos" : "");
    $("btnApplyYears").disabled = false;
  }
}

/* Defaults to 3 points below the current rate, glide over the final 5 years,
   both editable once expanded. Re-reads the current rate each time it's
   turned on, since the person may have changed it since the last time. */
$("glideToggle").addEventListener("click", () => {
  const on = $("glideToggle").classList.toggle("on");
  $("glideToggle").setAttribute("aria-expanded", String(on));
  $("glideFields").hidden = !on;
  if (on && $("glideEnd").value === ""){
    const cur = num("nominal");
    $("glideEnd").value = +(Math.max(0, cur - 3)).toFixed(2);
    $("glideYears").value = Math.min(5, Math.max(1, Math.round(num("years")) || 5));
  }
  updateGlideNote();
  renderAll();
});
function clampGlideYears(){
  const total = Math.max(1, Math.round(num("years")));
  const y = Math.round(num("glideYears"));
  const clamped = Math.min(total, Math.max(1, y || 1));
  if (clamped !== y) $("glideYears").value = clamped;
  return clamped;
}
function updateGlideNote(){
  if (!$("glideToggle").classList.contains("on")){ $("glideNote").textContent = ""; return; }
  const total = Math.max(1, Math.round(num("years")));
  const gy = clampGlideYears();
  const startYear = Math.max(1, total - gy + 1);
  $("glideNote").textContent = "Holds " + pctStr(rate("nominal"), 1) + " through year " +
    (startYear - 1) + ", then eases down to " + pctStr(rate("glideEnd"), 1) +
    " by year " + total + ".";
}
["glideEnd", "glideYears"].forEach(id => {
  $(id).addEventListener("input", () => { updateGlideNote(); renderAll(); });
});
$("years").addEventListener("input", updateGlideNote);
$("nominal").addEventListener("input", updateGlideNote);

$("btnApply").addEventListener("click", () => {
  let p, rounded;
  // with account types, the new contribution shifts the tax the target
  // needs, so a few passes settle it
  for (let pass = 0; pass < (acOn() ? 5 : 1); pass++){
    p = readInputs();
    const S = goalSolve(acSolveP(p), $("solveFor").value, num("target"));
    rounded = Math.round(S.perPeriod);
    if (p.acct) acSetTotal(rounded);
    else $("contrib").value = groupDigits(rounded, true);
  }
  renderAll();
  toast("Contribution set to " + money(rounded) + " " + PERIOD_ADV[p.period]);
});

$("btnApplyYears").addEventListener("click", () => {
  const p = readInputs();
  const S = goalSolve(acSolveP(p), $("solveFor").value, num("target"));
  const Y = solveYears(p, S.portToday);
  if (!Y.reached){ toast("That target isn't reachable within 100 years"); return; }
  $("years").value = Y.years;
  renderAll();
  toast("Timeline set to " + fmtYears(Y.years));
});

/* Rebuilds the plan as two stages: contribute until the coast year, then let it
   ride with nothing added. Same assumptions throughout, so the staged result
   lands on the same number the single run predicted. */
function stagesLookEdited(){
  if (stages.length !== SERIES_STAGES.length) return true;
  return stages.some((st, i) => {
    const d = SERIES_STAGES[i];
    return st.years !== d.years || st.contrib !== d.contrib || st.period !== d.period ||
           st.growth !== d.growth || st.nominal !== d.nominal;
  });
}
/* Split by account type carries across as-is: the same balances, match and
   tax settings, and each stage's contribution split in the same shares. The
   stage contribution is yours alone; Stages adds the match back on top. */
function advToStages(p){
  if (!p.acct) return {acct:null, contrib:p.contrib, split:{}};
  const a = p.acct;
  const mine = a.tradC + a.rothC + a.brokC;
  return {
    acct: {on:true, tradBal:a.tradBal, rothBal:a.rothBal, brokBal:a.brokBal,
           brokBasis:a.brokBasis, status:a.status, state:a.state,
           salary:a.salary, matchPct:a.matchPct, matchCap:a.matchCap},
    contrib: mine,
    split: Object.assign(mine > 0 ? {sTrad: a.tradC / mine, sRoth: a.rothC / mine} : {sTrad:1, sRoth:0},
                         a.gRates ? {gRates: Object.assign({}, a.gRates)} : {})
  };
}
function applyCoast(p, C){
  if (stagesLookEdited() &&
      !confirm("Replace the stages currently on the Stages tab with this Coast FIRE plan?"))
    return;
  const X = advToStages(p);
  writeGlobals({initial:p.initial, inflation:p.inflation, withdrawal:p.withdrawal,
                taxRate:p.taxRate, fees:p.fees, acct:X.acct});
  const coastYears = Math.round((p.years - C.years) * 100) / 100;
  /* The glide lives on the final stage, and stage 2 ends where the single-run
     plan ended, so the ramp lands on the same years either way -- unless the
     coast stretch is shorter than the glide itself, in which case part of the
     ramp would fall in stage 1, which the Stages tab can't express. Clamp and
     say so rather than silently rebuilding a different plan. The end rate is
     stored pre-fee on a stage, so the fee that readInputs took off goes back. */
  const glideOn = !!(p.glide && p.glide.on);
  const glideYears = glideOn ? Math.min(p.glide.years, coastYears) : 0;
  const glideClipped = glideOn && glideYears < p.glide.years;
  stages = [
    Object.assign({years:C.years, contrib:X.contrib, period:p.period, growth:p.growth,
     nominal:p.gross, vol:p.vol, adj:false}, X.split),
    Object.assign({years:coastYears, contrib:0, period:p.period,
     growth:0, nominal:p.gross, vol:p.vol, adj:false,
     glide: glideOn ? {on:true, endRate: p.glide.endRate + p.fees,
                       years: Math.max(1, glideYears)} : {on:false}}, X.split)
  ];
  buildStages();
  $("targetS").value = groupDigits(num("target"), true);
  $("solveForS").value = $("solveFor").value;
  showTab("series");
  renderSeries();
  toast(glideClipped
    ? "Coast FIRE plan loaded \u2014 glide shortened to " + fmtYears(Math.max(1, glideYears))
      + " to fit the final stage"
    : "Coast FIRE plan loaded into the Stages tab");
}

/* Carries Advanced's current inputs into the Stages tab as a two-stage plan:
   stage 1 is the plan exactly as entered, stage 2 repeats the same inputs for
   10 more years. A glide (if on) only makes sense at the true end of the
   plan, so it moves to stage 2 rather than being duplicated on both -- same
   convention applyCoast uses -- clamped to fit inside the 10-year stage. */
$("btnToStages").addEventListener("click", () => {
  const p = readInputs();
  if (stagesLookEdited() &&
      !confirm("Replace the stages currently on the Stages tab with these numbers?"))
    return;
  const X = advToStages(p);
  writeGlobals({initial:p.initial, inflation:p.inflation, withdrawal:p.withdrawal,
                taxRate:p.taxRate, fees:p.fees, acct:X.acct});
  const glideOn = !!(p.glide && p.glide.on);
  const glideYears = glideOn ? Math.min(p.glide.years, 10) : 0;
  const glideClipped = glideOn && glideYears < p.glide.years;
  stages = [
    Object.assign({years:p.years, contrib:X.contrib, period:p.period, growth:p.growth,
     nominal:p.gross, vol:p.vol, adj:false}, X.split),
    Object.assign({years:10, contrib:X.contrib, period:p.period, growth:p.growth,
     nominal:p.gross, vol:p.vol, adj:false,
     glide: glideOn ? {on:true, endRate: p.glide.endRate + p.fees,
                       years: Math.max(1, glideYears)} : {on:false}}, X.split)
  ];
  buildStages();
  $("targetS").value = groupDigits(num("target"), true);
  $("solveForS").value = $("solveFor").value;
  showTab("series");
  renderSeries();
  toast(glideClipped
    ? "Copied into two stages \u2014 glide shortened to " + fmtYears(Math.max(1, glideYears))
      + " to fit the second stage"
    : "Copied into two stages, the second running 10 years longer");
});

