/* ---------- college UI ---------- */
var collegePoints = [], clMulti = false;

/* The children being saved for. The first child's fields keep the ids the
   tool had when it planned for one (clPreset, clCost, clYears,
   clCollegeYrs); the rest are drawn after it. */
const CL_PRESETS = [["27000", "Public in-state · ~$27,000/yr"],
  ["59000", "Private non-profit · ~$59,000/yr"], ["82000", "Elite / Ivy · ~$82,000/yr"],
  ["0", "Custom"]];
let clKids = [{preset:"27000", cost:27000, years:18, collegeYrs:4}];

function buildCollegeKids(){
  const many = clKids.length > 1;
  $("clKids").innerHTML = clKids.map((k, i) => {
    const id = f => i ? "" : " id='" + f + "'", lab = f => i ? "" : " for='" + f + "'";
    const fields =
      "<div class='field'><label" + lab("clPreset") + ">School type" + (i ? "" :
        "<span class='tipdot' data-tip='schooltype' role='button' tabindex='0' aria-label='What is this?'>?</span>") + "</label>" +
        "<select" + id("clPreset") + " data-f='preset' data-i='" + i + "' aria-label='Child " + (i + 1) + " school type'>" +
        CL_PRESETS.map(o => "<option value='" + o[0] + "'" + (o[0] === String(k.preset) ? " selected" : "") + ">" + o[1] + "</option>").join("") +
        "</select></div>" +
      "<div class='field'><label" + lab("clCost") + ">Annual cost today</label>" +
        "<div class='inputwrap'><span class='affix'>$</span><input" + id("clCost") + " type='text' inputmode='decimal' data-money data-nonneg" +
        " data-f='cost' data-i='" + i + "' value='" + groupDigits(k.cost, true) + "' aria-label='Child " + (i + 1) + " annual cost today'></div></div>" +
      "<div class='two'>" +
        "<div class='field'><label" + lab("clYears") + ">Years until college</label>" +
          "<div class='inputwrap'><input" + id("clYears") + " type='text' inputmode='decimal' data-num data-step='1' min='0' max='25' data-nonneg" +
          " data-f='years' data-i='" + i + "' value='" + k.years + "' aria-label='Child " + (i + 1) + " years until college'><span class='affix'>yrs</span></div></div>" +
        "<div class='field'><label" + lab("clCollegeYrs") + ">Years of college</label>" +
          "<div class='inputwrap'><input" + id("clCollegeYrs") + " type='text' inputmode='decimal' data-num data-step='1' min='1' max='8' data-nonneg" +
          " data-f='collegeYrs' data-i='" + i + "' value='" + k.collegeYrs + "' aria-label='Child " + (i + 1) + " years of college'><span class='affix'>yrs</span></div></div>" +
      "</div>";
    return many
      ? "<div class='stagecard clkid'><div class='stagehead'><span class='clkid-name'>Child " + (i + 1) + "</span>" +
          "<button class='btn mini' type='button' data-del='" + i + "'>Remove</button></div>" + fields + "</div>"
      : fields;
  }).join("");
  $("clAddKid").textContent = many ? "Add another child" : "Add a child";
  $("clSavedLbl").firstChild.textContent = many ? "Currently saved, for all of them" : "Currently saved";
  initFields($("clKids"));
}

function readCollege() {
  const kids = clKids.map(k => ({
    yearsUntil: Math.min(25, +k.years || 0),
    annualCost: +k.cost || 0,
    collegeYrs: Math.max(1, Math.round(+k.collegeYrs || 0))
  }));
  return {
    yearsUntil:  kids[0].yearsUntil,
    annualCost:  kids[0].annualCost,
    tuitionInfl: rate("clInfl"),
    investRet:   rate("clReturn"),
    saved:       num("clSaved"),
    collegeYrs:  kids[0].collegeYrs,
    kids:        kids
  };
}
/* The monthly amount to save now, for however many children: what the
   budget, guide and tool help carry. */
function collegeMonthly(inp){
  if (inp.kids && inp.kids.length > 1){ const P = collegePlanCalc(inp); return P ? P.monthly : 0; }
  return inp.annualCost > 0 && inp.yearsUntil > 0 ? collegeSavingsCalc(inp).monthly : 0;
}

function renderCollege() {
  var inp = readCollege();
  clMulti = inp.kids.length > 1;
  $("clEachPanel").hidden = !clMulti;
  $("clShortK").textContent = clMulti ? "Needed today" : "Needed when college starts";
  $("clShortTip").setAttribute("data-tip", clMulti ? "collegepvall" : "collegepv");
  $("clSavGrowK").textContent = clMulti ? "What you've saved covers" : "What you've saved grows to";
  $("clTable").querySelector("thead").innerHTML = "<tr><th>Year</th><th>Balance</th><th>You added</th><th>Growth</th><th>" +
    (clMulti ? "Paid for college" : "Projected cost") + "</th></tr>";
  if (clMulti) return renderCollegeFamily(inp);
  if (inp.annualCost <= 0 || inp.yearsUntil <= 0) {
    setBig("clMonthly", "—");
    setBig("clTotalOut", "—");
    setBig("clShortOut", "—");
    return;
  }
  var R = collegeSavingsCalc(inp);

  $("clSavGrow").textContent = money(R.savingsAtStart);

  setBig("clMonthly", money(R.monthly, 0));
  $("clMonthlyNote").textContent = "for " + fmtNum(inp.yearsUntil) + " years at " + pctStr(inp.investRet, 1);
  setBig("clTotalOut", money(R.totalFuture));
  $("clTotalNote").textContent = inp.collegeYrs + " years at " + money(inp.annualCost, 0) + "/yr, " + pctStr(inp.tuitionInfl, 1) + " inflation";
  setBig("clShortOut", money(R.shortfall));
  $("clShortNote").textContent = "Less than the " + money(R.totalFuture) +
    " total, since what's saved keeps earning " + pctStr(inp.investRet, 1) +
    " while later years' tuition is paid";

  // The comparison line is what the full 4-year cost would be if college
  // started in that year — rising with tuition inflation, landing on the
  // real total by the time college actually starts. Year 0 uses the same
  // formula rather than defaulting to zero, so the line starts at a real cost.
  function costIfStartingAt(t){
    var total = 0;
    for (var k = 0; k < inp.collegeYrs; k++){
      total += inp.annualCost * Math.pow(1 + inp.tuitionInfl, t + k);
    }
    return total;
  }
  var pts = [{year:0, base:inp.saved, hi:costIfStartingAt(0), lo:0}];
  R.rows.forEach(function(r) {
    pts.push({year: r.year, base: r.balance, hi: costIfStartingAt(r.year), lo: 0});
  });
  collegePoints = paintChart("chartCl", pts, inp.yearsUntil, "band", [], 0, {enhanced:true, noLoLine:true});
  $("legendCl").innerHTML =
    swatch("#e9b872", "Your savings") +
    swatch("#4fbf95", "Cost of college, that year");

  $("clTable").querySelector("tbody").innerHTML = R.rows.map(function(r) {
    return "<tr><td>" + fmtNum(r.year) + "</td><td>" + money(r.balance) +
      "</td><td class='pos'>" + money(r.contribs) + "</td><td class='pos'>" +
      money(r.growth) + "</td><td>" + money(r.projCost) + "</td></tr>";
  }).join("");
}

/* How the monthly amount runs: one figure, or one that steps down once an
   older child's college has started. */
function collegePhaseNote(P){
  const yrs = m => fmtNum(Math.round(m / 12 * 10) / 10);
  const ph = P.phases, first = ph[0];
  let s = "for " + yrs(first.to) + " years";
  ph.slice(1).forEach(x => {
    s += x.monthly > 0 ? ", then " + money(x.monthly, 0) + "/mo for " + yrs(x.to - x.from) + " more" : ", then nothing more";
  });
  return s;
}
function renderCollegeFamily(inp){
  const P = collegePlanCalc(inp);
  if (!P){
    ["clMonthly", "clTotalOut", "clShortOut"].forEach(id => setBig(id, "—"));
    ["clMonthlyNote", "clTotalNote", "clShortNote", "clSavGrow"].forEach(id => { $(id).textContent = ""; });
    $("clEach").innerHTML = ""; $("clTable").querySelector("tbody").innerHTML = "";
    collegePoints = paintChart("chartCl", [], 0, "band", [], 0, {});
    return;
  }
  const n = P.kids.length;
  $("clSavGrow").textContent = P.pvToday > 0 ? pctStr(Math.min(1, inp.saved / P.pvToday), 0) + " of it" : "—";
  setBig("clMonthly", money(P.monthly, 0));
  $("clMonthlyNote").textContent = (n === 2 ? "for both children, " : "for all " + n + " children, ") + collegePhaseNote(P);
  setBig("clTotalOut", money(P.totalFuture));
  $("clTotalNote").textContent = fmtNum(P.kids.reduce((a, k) => a + k.yearCosts.length, 0)) +
    " years of college in all, at " + pctStr(inp.tuitionInfl, 1) + " tuition inflation";
  setBig("clShortOut", money(P.pvToday));
  $("clShortNote").textContent = "A lump sum today that, earning " + pctStr(inp.investRet, 1) +
    ", would pay every bill as it comes";

  $("clEach").innerHTML = P.kids.map(k =>
    "<div class='kv'><span class='k'>Child " + (k.index + 1) + ": " + fmtNum(k.yearCosts.length) + " years, starting in " +
      fmtNum(k.yearsUntil) + (k.yearsUntil === 1 ? " year" : " years") + "</span><span class='v'>" + money(k.total) +
    "</span></div>").join("") +
    (P.skipped ? "<div class='kv'><span class='k'>Left out</span><span class='v'>" + P.skipped +
      (P.skipped === 1 ? " child" : " children") + " with no cost or no years until college</span></div>" : "");

  const pts = [{year:0, base:inp.saved, hi:P.pvToday, lo:0}];
  P.rows.forEach(r => pts.push({year:r.year, base:r.balance, hi:r.needed, lo:0}));
  collegePoints = paintChart("chartCl", pts, P.rows.length, "band", [], 0, {enhanced:true, noLoLine:true});
  $("legendCl").innerHTML =
    swatch("#e9b872", "Your savings") +
    swatch("#4fbf95", "Needed then for the bills still ahead");

  $("clTable").querySelector("tbody").innerHTML = P.rows.map(r =>
    "<tr><td>" + fmtNum(r.year) + "</td><td>" + money(r.balance) +
      "</td><td class='pos'>" + money(r.contribs) + "</td><td class='pos'>" +
      money(r.growth) + "</td><td>" + (r.paid > 0 ? money(r.paid) : "—") + "</td></tr>").join("");
}

$("clKids").addEventListener("input", e => {
  const el = e.target, f = el.getAttribute("data-f"), i = parseInt(el.getAttribute("data-i"), 10);
  if (!f || isNaN(i) || !clKids[i] || f === "preset") return;
  clKids[i][f] = parseNum(el.value);
  renderCollege();
});
$("clKids").addEventListener("change", e => {
  const el = e.target, i = parseInt(el.getAttribute("data-i"), 10);
  if (el.getAttribute("data-f") !== "preset" || !clKids[i]) return;
  clKids[i].preset = el.value;
  const v = parseFloat(el.value);
  if (v > 0){
    clKids[i].cost = v;
    const c = $("clKids").querySelector("input[data-f='cost'][data-i='" + i + "']");
    if (c) c.value = groupDigits(v, true);
  }
  renderCollege();
});
$("clKids").addEventListener("click", e => {
  const b = e.target.closest ? e.target.closest("[data-del]") : null;
  if (!b) return;
  const i = parseInt(b.getAttribute("data-del"), 10);
  if (isNaN(i) || clKids.length < 2) return;
  clKids.splice(i, 1);
  buildCollegeKids(); renderCollege();
});
/* A new child starts like the last one, two years behind. */
$("clAddKid").addEventListener("click", () => {
  const last = clKids[clKids.length - 1];
  clKids.push({preset:last.preset, cost:last.cost, years:Math.min(25, (+last.years || 0) + 2), collegeYrs:last.collegeYrs});
  buildCollegeKids(); renderCollege();
  const f = $("clKids").querySelectorAll("input[data-f='years']");
  if (f.length) f[f.length - 1].focus();
});
buildCollegeKids();
["clSaved","clReturn","clInfl"].forEach(function(id) {
  $(id).addEventListener("input", renderCollege);
});
attachChart("chartWrapCl", "chartCl", "tipCl", function() { return collegePoints; },
  function(best) {
    return "<b>Year " + fmtNum(best.year) + "</b>" +
      "<br><span style='color:#e9b872'>Savings</span> <span class='n'>" + money(best.base) + "</span>" +
      (best.hi != null ? "<br><span style='color:#4fbf95'>" + (clMulti ? "Still needed" : "Cost of college") +
        "</span> <span class='n'>" + money(best.hi) + "</span>" : "");
  });

/* ---------- rent vs buy UI ---------- */
var rbPoints = [];

function readRB() {
  return {
    price:    num("rbPrice"),
    downPct:  num("rbDown"),
    rate:     num("rbRate"),
    term:     parseFloat($("rbTerm").value),
    propTax:  num("rbPropTax"),
    ins:      num("rbIns"),
    maint:    num("rbMaint"),
    closePct: num("rbClose"),
    sellPct:  num("rbSell"),
    rent:     num("rbRent"),
    rentInc:  num("rbRentInc"),
    appr:     num("rbAppr"),
    invest:   num("rbInvest"),
    horizon:  Math.min(40, Math.max(1, Math.round(num("rbHorizon")))),
    gainTax:  Math.min(50, Math.max(0, num("rbGainTax") || 0)),
    status:   $("rbStatus").value === "s" ? "s" : "m"
  };
}

function renderRentBuy() {
  var inp = readRB();
  if (inp.price <= 0) { setBig("rbWinner", "\u2014"); return; }
  var R = rentBuyCalc(inp);
  var last = R.years[R.years.length - 1];

  $("rbLoan").textContent = money(R.loan);
  $("rbPI").textContent = money(R.pi, 0) + "/mo";
  $("rbMonthly").textContent = money(R.monthlyBuy, 0) + "/mo";
  $("rbHorizonLbl").textContent = fmtNum(inp.horizon);

  var buyWins = last.buyerNW >= last.renterNW;
  setBig("rbWinner", buyWins ? "Buying" : "Renting");
  $("rbWinner").className = "v gold";
  $("rbWinNote").textContent = "by " + money(Math.abs(last.buyerNW - last.renterNW));
  setBig("rbBuyerNW", money(last.buyerNW));
  $("rbBuyerNote").textContent = "Home equity after selling, plus whatever's invested in months buying costs less than renting, after tax on the gains";
  setBig("rbRenterNW", money(last.renterNW));
  $("rbRenterNote").textContent = "Down payment invested from day one, plus whatever's invested in months renting costs less than buying, after tax on the gains";

  $("rbBreakEven").textContent = R.breakEven ? "Year " + fmtNum(R.breakEven) + " -- buying pulls ahead" : "Renting stays ahead throughout";
  $("rbRenterInvests").textContent = money(R.initialInvest) + " (down payment + closing costs)";

  var pts = [{year:0, base:0, hi:0, lo:0}];
  R.years.forEach(function(y) {
    pts.push({year: y.year, base: y.buyerNW, hi: y.renterNW, lo: Math.min(y.buyerNW, y.renterNW)});
  });
  rbPoints = paintChart("chartRB", pts, inp.horizon, "band", [], 0, {enhanced:true});
  $("legendRB").innerHTML =
    swatch("#e9b872", "Buyer net worth") +
    swatch("#4fbf95", "Renter net worth");

  $("rbTable").querySelector("tbody").innerHTML = R.years.map(function(y) {
    var diff = y.buyerNW - y.renterNW;
    return "<tr><td>" + fmtNum(y.year) +
      "</td><td" + (y.buyerNW >= y.renterNW ? " class='pos'" : "") + ">" + money(y.buyerNW) +
      "</td><td" + (y.renterNW >= y.buyerNW ? " class='pos'" : "") + ">" + money(y.renterNW) +
      "</td><td class='" + (diff >= 0 ? "pos" : "neg") + "'>" + (diff >= 0 ? "+" : "") + money(diff) +
      "</td><td>" + money(y.homeVal) +
      "</td><td>" + money(y.balance) + "</td></tr>";
  }).join("");

  attachChart("chartWrapRB", "chartRB", "tipRB", function() { return rbPoints; },
    function(best) {
      return "<b>Year " + fmtNum(best.year) + "</b>" +
        "<br><span style='color:#e9b872'>Buyer</span> <span class='n'>" + money(best.base) +
        "</span><br><span style='color:#4fbf95'>Renter</span> <span class='n'>" + money(best.hi) + "</span>";
    });
}
["rbPrice","rbDown","rbRate","rbPropTax","rbIns","rbMaint","rbClose","rbSell","rbRent","rbRentInc","rbAppr","rbInvest","rbHorizon","rbGainTax"].forEach(function(id) {
  $(id).addEventListener("input", renderRentBuy);
});
$("rbTerm").addEventListener("change", renderRentBuy);
$("rbStatus").addEventListener("change", renderRentBuy);

/* ---------- EF + budget wiring ---------- */

$("bgCopyTax").addEventListener("click", () => {
  const R = runTax(readTax());
  // Deliberately gross minus TAXES only, not minus pre-tax deferrals. A 401(k)
  // or HSA contribution is voluntary saving, not money spent, so it belongs in
  // income here and gets entered again as a Savings & investments line -- where
  // it shows up as saving rather than disappearing from the budget entirely.
  const netPay = R.gross - R.total;
  $("bgIncomeIn").value = groupDigits(netPay.toFixed(0), true);
  bgIncomeFreq = 1;   // annual figure
  $("bgIncomeFreq").querySelectorAll("button").forEach(x =>
    x.classList.toggle("on", x.getAttribute("data-freq") === "1"));
  renderBudget();
  toast("Copied net pay of " + money(netPay) + " from the tax tool");
});

/* ---------- college and rent-vs-buy math ---------- */
/* College savings engine.
   Projects 4 annual tuition bills growing at tuition inflation, finds the
   present value of all payments at the start of college, then solves for the
   monthly contribution that — compounded at the investment return — covers the
   shortfall after existing savings have grown. */
function collegeSavingsCalc(inp) {
  var yearsUntil  = inp.yearsUntil;
  var annualCost  = inp.annualCost;
  var tuitionInfl = inp.tuitionInfl;
  var investRet   = inp.investRet;
  var saved       = inp.saved;
  var collegeYrs  = inp.collegeYrs;

  // Geometric, not investRet/12: the stated return is an effective annual rate
  // everywhere else in the app, so converting it the simple way would quietly
  // compound to a higher annual return here than the same input produces in
  // the retirement engine.
  var rm = Math.pow(1 + investRet, 1 / 12) - 1;
  var n  = Math.round(yearsUntil * 12);

  // Project the cost of each year of college
  var yearCosts = [];
  for (var y = 0; y < collegeYrs; y++) {
    yearCosts.push(annualCost * Math.pow(1 + tuitionInfl, yearsUntil + y));
  }
  var totalFuture = yearCosts.reduce(function(a, v){ return a + v; }, 0);

  // PV at college start: discount each payment back to year 0 of college
  var targetAtStart = 0;
  for (var i = 0; i < collegeYrs; i++) {
    targetAtStart += yearCosts[i] / Math.pow(1 + investRet, i);
  }

  // How much existing savings grow to by college start
  var savingsAtStart = saved * Math.pow(1 + investRet, yearsUntil);
  var shortfall      = Math.max(0, targetAtStart - savingsAtStart);

  // Monthly contribution needed
  var monthly = 0;
  if (n > 0 && shortfall > 0) {
    monthly = (rm > 0)
      ? shortfall * rm / (Math.pow(1 + rm, n) - 1)
      : shortfall / n;
  }

  // Year-by-year accumulation, walked with the SAME month-by-month arithmetic
  // the contribution was solved with. Compounding annually here instead (with
  // a half-year convention on contributions) left the final row short of the
  // target the headline figure was solved to hit, so the table contradicted
  // the answer above it.
  var bal       = saved;
  var contribYr = monthly * 12;
  var rows      = [];
  var months    = 0;
  for (var yr = 1; yr <= yearsUntil; yr++) {
    var yearStart = bal;
    var yearContrib = 0;
    for (var k = 0; k < 12 && months < n; k++) {
      bal = bal * (1 + rm) + monthly;
      yearContrib += monthly;
      months++;
    }
    var growth = bal - yearStart - yearContrib;
    contribYr = yearContrib;
    rows.push({
      year: yr,
      balance: bal,
      contribs: contribYr,
      growth: growth,
      projCost: annualCost * Math.pow(1 + tuitionInfl, yr)
    });
  }

  return {
    monthly: monthly,
    totalFuture: totalFuture,
    targetAtStart: targetAtStart,
    savingsAtStart: savingsAtStart,
    shortfall: shortfall,
    yearCosts: yearCosts,
    rows: rows
  };
}

/* College savings for several children from one shared account. Each
   child's bills (one a year, at tuition inflation, the first when that child
   starts) are paid from the account as they fall due, and the account takes
   one monthly amount from now until the youngest starts college.
   One level amount for that whole stretch doesn't always fit: a child
   starting soon needs money much faster than a newborn, and a level amount
   big enough for that would keep over-saving for years afterwards. So the
   amount is the smallest level one that never leaves the account short when
   a bill is paid. If the bill that sets it isn't the last one, the account is
   exactly empty just after that bill, and the rest is solved again from
   there, so the amount can step down but never up. With one child this is
   collegeSavingsCalc's answer: the last bill always sets it.
   Same month-by-month arithmetic as collegeSavingsCalc: the return compounds
   geometrically, a contribution lands at each month's end, and a bill due
   that month is paid after it. */
function collegePlanCalc(inp) {
  var g = Math.pow(1 + inp.investRet, 1 / 12), rm = g - 1;
  var kids = [], bills = [], skipped = 0;
  inp.kids.forEach(function(k, index) {
    if (!(k.annualCost > 0 && k.yearsUntil > 0)) { skipped++; return; }
    var start = Math.max(1, Math.round(k.yearsUntil * 12)), costs = [];
    for (var y = 0; y < k.collegeYrs; y++) {
      var amt = k.annualCost * Math.pow(1 + inp.tuitionInfl, k.yearsUntil + y);
      costs.push(amt);
      bills.push({m: start + 12 * y, amt: amt});
    }
    kids.push({index: index, yearsUntil: k.yearsUntil, start: start, yearCosts: costs,
      total: costs.reduce(function(a, v) { return a + v; }, 0),
      targetAtStart: costs.reduce(function(a, v, j) { return a + v / Math.pow(g, 12 * j); }, 0)});
  });
  if (!kids.length) return null;
  bills.sort(function(a, b) { return a.m - b.m; });
  var endC = Math.max.apply(null, kids.map(function(k) { return k.start; }));
  var endM = bills[bills.length - 1].m;

  // A level contribution c from month s+1 to endC, on a balance b0 at month s,
  // leaves b0*g^(m-s) + c*A(m) - (bills since s, grown) just after month m's
  // bill. Each bill's need for that to be >= 0 is linear in c.
  var phases = [], s = 0, b0 = inp.saved;
  while (s < endC) {
    var best = 0, at = -1;
    for (var i = 0, owed = 0, prevM = s; i < bills.length; i++) {
      var b = bills[i];
      if (b.m <= s) continue;
      owed = owed * Math.pow(g, b.m - prevM) + b.amt; prevM = b.m;
      var k = Math.min(b.m, endC) - s;
      var A = k > 0 ? (rm > 0 ? (Math.pow(g, k) - 1) / rm : k) * Math.pow(g, b.m - s - k) : 0;
      var need = owed - b0 * Math.pow(g, b.m - s);
      if (A <= 0) continue;
      var c = need / A;
      // the latest bill that sets the amount, so a tie doesn't split a phase
      if (c >= best * (1 - 1e-12) && c > 0) { best = Math.max(best, c); at = b.m; }
    }
    if (at < 0 || at >= endC) { phases.push({from: s, to: endC, monthly: Math.max(0, best)}); break; }
    phases.push({from: s, to: at, monthly: best});
    // walk the account to month `at` so the next phase starts from what's
    // really there (zero, up to rounding)
    b0 = collegeWalk(inp.saved, phases, bills, g, at).bal;
    s = at;
  }
  if (!phases.length) phases.push({from: 0, to: endC, monthly: 0});

  // Year by year to the last bill, with what the bills still ahead need
  // at each year's end.
  var rows = [], W = {bal: inp.saved, m: 0};
  for (var yr = 1; yr * 12 - 12 < endM; yr++) {
    var y0 = W.bal, w = collegeWalk(W.bal, phases, bills, g, yr * 12, W.m);
    var needed = 0;
    bills.forEach(function(x) { if (x.m > yr * 12) needed += x.amt / Math.pow(g, x.m - yr * 12); });
    rows.push({year: yr, balance: w.bal, contribs: w.added, paid: w.paid,
      growth: w.bal - y0 - w.added + w.paid, needed: needed});
    W = {bal: w.bal, m: yr * 12};
  }
  var pvToday = bills.reduce(function(a, x) { return a + x.amt / Math.pow(g, x.m); }, 0);
  return {
    monthly: phases[0].monthly,
    phases: phases,
    kids: kids,
    skipped: skipped,
    totalFuture: bills.reduce(function(a, x) { return a + x.amt; }, 0),
    pvToday: pvToday,
    rows: rows
  };
}
/* The shared account from month `from` (default 0) to month `to`, on the
   contribution schedule `phases`. */
function collegeWalk(bal, phases, bills, g, to, from) {
  var added = 0, paid = 0;
  for (var m = (from || 0) + 1; m <= to; m++) {
    bal *= g;
    for (var p = 0; p < phases.length; p++)
      if (m > phases[p].from && m <= phases[p].to) { bal += phases[p].monthly; added += phases[p].monthly; break; }
    for (var i = 0; i < bills.length; i++) if (bills[i].m === m) { bal -= bills[i].amt; paid += bills[i].amt; }
  }
  return {bal: bal, added: added, paid: paid};
}

/* Rent-vs-buy engine.
   Runs month by month. The side that pays less that month invests the
   difference at the investment return. At each year-end we compute:
   - Buyer net worth = home equity after a hypothetical sale + any savings
   - Renter net worth = invested alternative (down + closing) + any savings
   The break-even year is the first year buyer NW exceeds renter NW. */
function rentBuyCalc(inp) {
  var price    = inp.price;
  var downPct  = inp.downPct;
  var rate     = inp.rate;
  var term     = inp.term;
  var propTax  = inp.propTax;
  var ins      = inp.ins;
  var maint    = inp.maint;
  var closePct = inp.closePct;
  var sellPct  = inp.sellPct;
  var rent     = inp.rent;
  var rentInc  = inp.rentInc;
  var appr     = inp.appr;
  var invest   = inp.invest;
  var horizon  = inp.horizon;
  // Both sides are valued as if cashed out at each year's end, so each pays
  // tax on its gains then: the portfolios on growth above what went in, the
  // home on gain above the sec. 121 exclusion. Older saved inputs without a
  // rate fall back to 15%, the long-term rate most households pay.
  var gainTax  = (inp.gainTax == null ? 15 : inp.gainTax) / 100;
  var exclusion = inp.status === "s" ? 250000 : 500000;

  var down       = price * downPct / 100;
  var closeAmt   = price * closePct / 100;
  var loan       = price - down;
  var r          = rate / 100 / 12;
  var totalMo    = Math.round(term * 12);
  var pi         = (r > 0 && loan > 0)
    ? loan * r / (1 - Math.pow(1 + r, -totalMo))
    : (totalMo > 0 ? loan / totalMo : 0);
  // Geometric monthly rates, as everywhere else in the app: the inputs are
  // effective annual rates, and dividing by 12 would quietly compound both
  // the home and the portfolio a little faster than stated.
  var ir         = Math.pow(1 + invest / 100, 1 / 12) - 1;
  var apprMo     = Math.pow(1 + appr / 100, 1 / 12) - 1;

  // Property tax, insurance and maintenance were held flat at their entered,
  // today's-dollar amount for the whole horizon while rent climbed every
  // year -- a thumb on the scale for buying that grows with the horizon.
  // This tool has no inflation input of its own for these, so the least
  // invasive fix ties them to the home's own value: property tax literally
  // is a percentage of assessed value, and insurance/maintenance scale with
  // what the home is worth to rebuild or upkeep, not with the dollar figure
  // picked at closing. Insurance is entered as a flat $/yr, so it's carried
  // forward as a fraction of the original price and scaled by the same
  // appreciation ratio property tax and maintenance already move with.
  var insBase    = ins / 12;
  var maintRate  = maint / 100 / 12;

  var renterPort  = down + closeAmt;
  var renterBasis = renterPort;
  var buyerSavings = 0;
  var buyerBasis  = 0;
  var balance     = loan;
  var homeVal     = price;
  var monthRent   = rent;

  // PMI, same rate the mortgage tool defaults to when none is entered, and
  // the same convention it drops PMI with: based on the balance against the
  // ORIGINAL price, matching how a lender's amortization-schedule PMI
  // cancellation actually works, not a moving appraisal.
  var initPmi = (price > 0 && loan / price > .80) ? loan * PMI_DEFAULT / 100 / 12 : 0;
  var initFixedCost = price * propTax / 100 / 12 + insBase + price * maintRate + initPmi;

  var years = [];
  for (var yr = 1; yr <= horizon; yr++) {
    var taxMo = 0, insMo = 0, maintMo = 0, pmiMo = 0;
    for (var mo = 0; mo < 12; mo++) {
      // Once the loan is paid off (a 15-year loan on a 30-year horizon) the
      // payment stops, and so does the cost of owning that it stood for.
      var interest  = balance * r;
      var payment   = Math.min(pi, balance + interest);
      var principal = payment - interest;
      balance = Math.max(0, balance - principal);

      homeVal *= (1 + apprMo);

      pmiMo = (price > 0 && balance / price > .80) ? loan * PMI_DEFAULT / 100 / 12 : 0;
      taxMo = homeVal * propTax / 100 / 12;
      insMo = insBase * (homeVal / price);
      maintMo = homeVal * maintRate;
      var fixedBuyCost = taxMo + insMo + maintMo + pmiMo;

      var buyCostMo  = payment + fixedBuyCost;
      var rentCostMo = monthRent;
      var diff       = rentCostMo - buyCostMo;

      if (diff > 0) {
        buyerSavings += diff; buyerBasis += diff;
      } else {
        renterPort += (-diff); renterBasis += (-diff);
      }
      renterPort   *= (1 + ir);
      buyerSavings *= (1 + ir);
    }
    monthRent *= (1 + rentInc / 100);

    // Closing costs paid at purchase and selling costs both come off the
    // taxable gain on the home.
    var homeGain = homeVal * (1 - sellPct / 100) - price - closeAmt;
    var homeTax  = Math.max(0, homeGain - exclusion) * gainTax;
    var saleNet  = homeVal * (1 - sellPct / 100) - balance - homeTax;
    var buyerNW  = saleNet + buyerSavings - Math.max(0, buyerSavings - buyerBasis) * gainTax;
    var renterNW = renterPort - Math.max(0, renterPort - renterBasis) * gainTax;

    years.push({
      year: yr,
      buyerNW: buyerNW,
      renterNW: renterNW,
      homeVal: homeVal,
      balance: balance,
      monthBuy: payment + taxMo + insMo + maintMo + pmiMo,
      monthRent: monthRent / (1 + rentInc / 100)
    });
  }

  var breakEven = null;
  for (var k = 0; k < years.length; k++) {
    if (years[k].buyerNW >= years[k].renterNW) { breakEven = years[k].year; break; }
  }

  return {
    years: years,
    breakEven: breakEven,
    loan: loan,
    pi: pi,
    initialInvest: down + closeAmt,
    monthlyBuy: pi + initFixedCost
  };
}

