/* ---------- Basic tab ---------- */
/* Everything here is modeled in real terms: the rate of return already has
   inflation taken out, so every figure shown is in today's dollars and no
   separate inflation input is needed. The trade-off is that it assumes the
   contribution rises with inflation each year, which is why growth is zero. */
const RISK_LEVELS = [
  {label:"Very conservative", sub:"mostly cash and bonds",      real:.020},
  {label:"Conservative",      sub:"bond heavy",                 real:.030},
  {label:"Balanced",          sub:"a mix of stocks and bonds",  real:.045},
  {label:"Growth",            sub:"mostly stocks",              real:.0575},
  {label:"Aggressive",        sub:"nearly all stocks",          real:.070}
];
const BASIC_BAND = .015;
let simplePoints = [], simpleRun = null;

$("qRisk").innerHTML = RISK_LEVELS.map((r, i) =>
  "<option value='" + r.real + "'" + (i === 2 ? " selected" : "") + ">" +
  r.label + " \u00b7 " + r.sub + "</option>").join("");


/* Basic's own real-return engine, replacing the old flat-forever contribution
   with one that steps up once a year, the way Advanced's does.

   Basic never asks for an inflation rate -- it only ever shows a single real
   (after-inflation) return. But "the contribution keeps pace with inflation"
   is not a free-standing fact; it has a shape. Held perfectly flat in real
   dollars every single month, a contribution is implicitly rising in nominal
   terms every month too -- continuously, at the same frequency the plan
   compounds. Advanced does something different: it steps the nominal
   contribution up once a year and only converts to today's dollars at the
   very end. Those two are not the same plan, and the gap between them is
   exactly what produced the mismatch: Basic's number was quietly larger
   because "continuously" compounds more advantageously than "once a year."

   To close it without ever surfacing an inflation input, BASIC_INFL is used
   purely to shape the timing of the step -- it cancels out of the return the
   person actually sees. Expressed in today's dollars, a contribution that is
   flat in nominal terms for twelve months and then jumps at the year mark
   loses a little ground every month within that year and recovers it all at
   once at the boundary. The real-dollar contribution multiplier at month j
   of a year (j = 1..periods-per-year) works out to (1+infl)^(-j/ppy) --
   independent of which year it is, so it can be applied directly without
   tracking nominal dollars anywhere. Run that multiplier through the same
   periodic real return Basic has always used, and the result lands within
   a rounding error of Advanced's own fvReal for the same real return and the
   BASIC_INFL is intentionally the same figure "Open in Advanced" assumes when
   it splits the real rate back into a return and an inflation rate, and the
   same inflation Advanced itself starts with, so the tabs agree everywhere. */
const BASIC_INFL = DEFAULTS.inflation;

function projectBasic(p){
  const ppy = PPY[p.period];
  const n = Math.floor(p.years * ppy);
  const periodicReal = Math.pow(1 + p.real, 1 / ppy) - 1;
  let bal = p.initial, contribTotal = 0;
  const years = [];
  let yearStart = p.initial, yearContrib = 0, curYear = 1;

  for (let i = 1; i <= n; i++){
    const yearNo = Math.ceil(i / ppy);
    if (yearNo !== curYear){
      years.push({year:curYear, start:yearStart, contrib:yearContrib,
                  growth:bal - yearStart - yearContrib, end:bal});
      yearStart = bal; yearContrib = 0; curYear = yearNo;
    }
    const j = i - (yearNo - 1) * ppy;             // 1..ppy, resets every year
    const c = p.contrib / Math.pow(1 + BASIC_INFL, j / ppy);
    bal = bal * (1 + periodicReal) + c;
    contribTotal += c; yearContrib += c;
  }
  if (n > 0) years.push({year:curYear, start:yearStart, contrib:yearContrib,
                         growth:bal - yearStart - yearContrib, end:bal});

  const fv = bal;
  const invested = p.initial + contribTotal;
  const wd = fv * p.withdrawal;
  return {ppy, periods:n, years, fv, fvReal:fv, invested, growth:fv - invested,
    contribTotal, wd, wdReal:wd, afterTax:wd, afterTaxMo:wd / 12};
}

function readBasic(){
  const age = num("qAge"), retire = num("qRetire");
  const real = parseFloat($("qRisk").value) || 0;
  return {age, retire, years: Math.min(100, Math.max(0, retire - age)), real,
    initial: num("qSaved"), contrib: num("qContrib"), period: $("qPeriod").value,
    // projectBasic() does the actual math; these extra fields exist only so
    // this same object can feed the generic project() used by btnUpgrade's
    // Advanced comparison and drawBasicChart's better/worse band.
    growth:0, nominal: real, inflation:0, withdrawal:.04, taxRate:0, vol:.15,
    fees:0, gross: real};
}

function renderBasic(){
  const p = readBasic();
  $("qReal").textContent = pctStr(p.real, 2) + " a year";

  if (!(p.years > 0)){
    $("qYears").textContent = "\u2014";
    $("qWarn").hidden = false;
    $("qWarnText").textContent = p.retire && p.age
      ? "Your retirement age needs to be higher than your age today."
      : "Fill in your age and the age you plan to retire to see a projection.";
    ["qFV","qYear","qMonth"].forEach(id => { $(id).textContent = "\u2014";
      $(id).style.fontSize = ""; });
    ["qIn","qGrowth","qStart","qSpan"].forEach(id => $(id).textContent = "\u2014");
    $("qYearTable").querySelector("tbody").innerHTML = "";
    $("msBodyQ").innerHTML = "";
    simplePoints = paintChart("chartQ", [], 1, "band", [], 0, {enhanced:true});
    $("legendQ").innerHTML = "";
    $("qBandNote") && ($("qBandNote").textContent = "");
    return;
  }
  $("qWarn").hidden = true;
  $("qYears").textContent = fmtYears(p.years);

  const R = projectBasic(p);
  simpleRun = R;
  setBig("qFV", money(R.fv));
  $("qFVnote").textContent = "At age " + fmtNum(p.retire) + ", in today's dollars";
  setBig("qYear", money(R.fv * .04));
  setBig("qMonth", money(R.fv * .04 / 12));
  $("qIn").textContent = money(R.contribTotal);
  $("qGrowth").textContent = money(R.growth);
  $("qStart").textContent = money(p.initial);
  $("qSpan").textContent = money(p.contrib, p.contrib % 1 ? 2 : 0) + " " + PERIOD_ADV[p.period];

  $("qYearTable").querySelector("tbody").innerHTML = R.years.map(y =>
    "<tr><td>" + fmtNum(p.age + y.year) + "</td><td>" + y.year + "</td><td>" +
    money(y.start) + "</td><td>" + money(y.contrib) + "</td><td class='pos'>" +
    money(y.growth) + "</td><td>" + money(y.end) + "</td></tr>").join("");

  renderMilestones("msBodyQ",
    R.years.map(y => ({year:y.year, end:y.end, growth:y.growth, contrib:y.contrib})),
    0, 0, p.years, true);

  drawBasicChart(R, p);
}

/* Fixed comparison band, no control: beginners get the range without another
   dial to understand. */
function drawBasicChart(R, p){
  if (!R.years.length){ simplePoints = paintChart("chartQ", [], 1, "band", [], 0, {enhanced:true}); return; }
  const hiR = projectBasic(Object.assign({}, p, {real: p.real + BASIC_BAND}));
  const loR = projectBasic(Object.assign({}, p, {real: Math.max(-0.99, p.real - BASIC_BAND)}));
  const pts = [{year:0, base:p.initial, hi:p.initial, lo:p.initial}];
  R.years.forEach((y, i) => pts.push({year:y.year, base:y.end,
    hi: hiR.years[i] ? hiR.years[i].end : y.end,
    lo: loR.years[i] ? loR.years[i].end : y.end}));
  // Ages along the axis, when the age is known.
  const age = num("qAge");
  simplePoints = paintChart("chartQ", pts, p.years, "band", [], age > 0 && isFinite(age) ? age : 0, {enhanced:true});
  $("legendQ").innerHTML =
    swatch("#4fbf95", "If returns run better (" + pctStr(p.real + BASIC_BAND, 2) + ")") +
    swatch("#e9b872", "Your setting (" + pctStr(p.real, 2) + ")") +
    swatch("#e2795f", "If returns run worse (" + pctStr(Math.max(0, p.real - BASIC_BAND), 2) + ")");
  const note = $("qBandNote");
  if (note) note.innerHTML = "The shaded range shows the same plan with returns "
    + "1.5 points better or worse. Nobody earns the same return every year, so treat "
    + "the middle line as a midpoint rather than a promise.";
}

attachChart("chartWrapQ", "chartQ", "tipQ", () => simplePoints,
  best => (num("qAge") > 0 ? "<b>Age " + fmtNum(num("qAge") + best.year) + "</b> <span style='color:var(--dimmer)'>\u00b7 year " + fmtNum(best.year) + "</span>"
    : "<b>Year " + fmtNum(best.year) + "</b>") +
    "<br><span style='color:#4fbf95'>Better</span> <span class='n'>" + money(best.hi) +
    "</span><br><span style='color:#e9b872'>Expected</span> <span class='n'>" + money(best.base) +
    "</span><br><span style='color:#e2795f'>Worse</span> <span class='n'>" + money(best.lo) + "</span>");

["qAge","qRetire","qSaved","qContrib"].forEach(id =>
  $(id).addEventListener("input", () => {
    /* Auto-clamp retirement age so the implied years never exceed 100 */
    const age = parseNum($("qAge").value), ret = parseNum($("qRetire").value);
    if (age > 0 && ret > 0 && ret - age > 100)
      $("qRetire").value = String(age + 100);
    renderBasic();
  }));
$("qPeriod").addEventListener("change", renderBasic);
$("qRisk").addEventListener("change", renderBasic);

/* Carries the basic answers into Advanced. Real return is split back into a
   nominal rate and inflation so the two tabs agree. */
$("btnUpgrade").addEventListener("click", () => {
  const p = readBasic();
  const infl = BASIC_INFL;
  /* Basic holds the contribution steady in real terms, so the equivalent on
     Advanced is a contribution that grows with inflation each year. Without
     that the same plan would look roughly a quarter smaller. */
  writeInputs({initial:p.initial, contrib:p.contrib, period:p.period, growth:infl,
    gross:(1 + p.real) * (1 + infl) - 1, nominal:(1 + p.real) * (1 + infl) - 1,
    inflation:infl, years:Math.max(1, p.years), withdrawal:.04, taxRate:.10,
    vol:.15, fees:0});
  showTab("single");
  renderAll();
  toast("Copied across, with " + pctStr(infl, 2) + " inflation and a 10% tax rate added");
});

