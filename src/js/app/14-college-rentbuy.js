/* ---------- college UI ---------- */
var collegePoints = [];

function readCollege() {
  return {
    yearsUntil:  Math.min(25, num("clYears")),
    annualCost:  num("clCost"),
    tuitionInfl: rate("clInfl"),
    investRet:   rate("clReturn"),
    saved:       num("clSaved"),
    collegeYrs:  Math.max(1, Math.round(num("clCollegeYrs")))
  };
}

function renderCollege() {
  var inp = readCollege();
  if (inp.annualCost <= 0 || inp.yearsUntil <= 0) {
    setBig("clMonthly", "\u2014");
    setBig("clTotalOut", "\u2014");
    setBig("clShortOut", "\u2014");
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
  // started in that year \u2014 rising with tuition inflation, landing on the
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

$("clPreset").addEventListener("change", function() {
  var v = parseFloat($("clPreset").value);
  if (v > 0) {
    $("clCost").value = groupDigits(v, true);
    renderCollege();
  }
});
["clCost","clYears","clCollegeYrs","clSaved","clReturn","clInfl"].forEach(function(id) {
  $(id).addEventListener("input", renderCollege);
});
attachChart("chartWrapCl", "chartCl", "tipCl", function() { return collegePoints; },
  function(best) {
    return "<b>Year " + fmtNum(best.year) + "</b>" +
      "<br><span style='color:#e9b872'>Savings</span> <span class='n'>" + money(best.base) + "</span>" +
      (best.hi != null ? "<br><span style='color:#4fbf95'>Cost of college</span> <span class='n'>" +
        money(best.hi) + "</span>" : "");
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

