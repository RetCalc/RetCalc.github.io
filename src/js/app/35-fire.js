// ===== FIRE CALCULATOR =====
(function(){
"use strict";

var fiChartPoints = null;
var fiHistRunsCache = null;
var fiHistKey = null;
var fiHistFullCache = null;
var fiHistFullKey = null;
var fiSuccessResults = null;
var fiMaxYears = 50;
var fiCurrentFireYear = null;
var fiCrossingsCache = null;
var fiCrossingsKey = null;
var fiCrossingsTotal = 0;
var fiCoastCrossCache = null;
var fiCoastCrossKey = null;
var fiCoastCrossTotal = 0;

function readFire(){
  var modeBtn = $("segFireMode").querySelector("button.on");
  var mode = modeBtn ? modeBtn.getAttribute("data-firemode") : "fire";
  var solveFor = $("fiSolveFor").value;
  var targetAmt = num("fiTarget") || 0;
  var wr = Math.max(0, (num("fiWithdrawal") || 4)) / 100;
  var targetPortfolio = solveFor === "withdrawal"
    ? (wr > 0 ? targetAmt / wr : 0)
    : targetAmt;
  return {
    mode: mode,
    curAge: Math.max(18, Math.min(70, num("fiCurAge") || 30)),
    retireAge: Math.max(40, Math.min(100, num("fiRetireAge") || 65)),
    initial: Math.max(0, num("fiInitial") || 0),
    contrib: Math.max(0, num("fiContrib") || 0),
    period: $("fiPeriod").value || "Monthly",
    growth: (num("fiGrowth") || 0) / 100,
    nominal: Math.max(0, (num("fiNominal") || 8.5)) / 100,
    inflation: Math.max(0, (num("fiInflation") || 3)) / 100,
    target: targetPortfolio,
    withdrawal: wr,
    solveFor: solveFor,
    targetAmt: targetAmt,
    band: Math.max(0, (num("fiBand") || 2)) / 100,
    histMix: Math.max(0, Math.min(1, (num("fiHistMix") || 80) / 100)),
    successRate: parseInt(($("fiSuccessSlider") || {value:"50"}).value) || 50
  };
}

function fiRunHistorical(p, maxYears){
  var results = [];
  var len = HIST_STOCK.length;
  var realRate = (1 + p.nominal) / (1 + p.inflation) - 1;
  var ppy = PPY[p.period] || 12;

  for (var si = 0; si < len; si++){
    var balance = p.initial;
    var cumInfl = 1;
    var yearsToFire = null;

    for (var y = 0; y <= maxYears; y++){
      var realBalance = balance / cumInfl;

      if (p.mode === "fire"){
        if (p.target > 0 && realBalance >= p.target){ yearsToFire = y; break; }
      } else {
        var yearsLeft = (p.retireAge - p.curAge) - y;
        if (yearsLeft <= 0){
          if (p.target > 0 && realBalance >= p.target) yearsToFire = y;
          break;
        }
        var coastNeeded = realRate > -1
          ? p.target / Math.pow(1 + realRate, yearsLeft)
          : p.target;
        if (realBalance >= coastNeeded){ yearsToFire = y; break; }
      }

      var di = si + y;
      var stockR = di < len ? HIST_STOCK[di] / 100 : p.nominal;
      var bondR  = di < len ? HIST_BOND[di]  / 100 : (p.nominal * 0.5);
      var inflR  = di < len ? HIST_INFL[di]  / 100 : p.inflation;
      var blended = p.histMix * stockR + (1 - p.histMix) * bondR;
      var annualC = p.contrib * ppy * Math.pow(1 + p.growth, y);
      balance = (balance + annualC) * (1 + blended);
      cumInfl *= (1 + inflR);
    }
    results.push({startYear: HIST_START + si, yearsToFire: yearsToFire});
  }
  return results;
}

function fiYearsAtPct(results, pct){
  var years = results.map(function(r){ return r.yearsToFire !== null ? r.yearsToFire : 9999; });
  years.sort(function(a, b){ return a - b; });
  var n = years.length;
  if (!n) return null;
  var idx = Math.min(Math.floor(pct / 100 * n), n - 1);
  var y = years[idx];
  return y >= 9999 ? null : y;
}

function fiYearsFromBands(bands, target, successPct){
  if (!bands || !bands.length || !target) return null;
  var level = (100 - successPct) / 100;
  function bandVal(b){
    if (level <= 0.10) return b.p10;
    if (level <= 0.25) return b.p10 + (b.p25 - b.p10) * ((level - 0.10) / 0.15);
    if (level <= 0.50) return b.p25 + (b.p50 - b.p25) * ((level - 0.25) / 0.25);
    if (level <= 0.75) return b.p50 + (b.p75 - b.p50) * ((level - 0.50) / 0.25);
    if (level <= 0.90) return b.p75 + (b.p90 - b.p75) * ((level - 0.75) / 0.15);
    return b.p90;
  }
  for (var i = 0; i < bands.length; i++){
    if (bandVal(bands[i]) >= target) return Math.round(bands[i].year);
  }
  return null;
}

function fiComputeCrossings(p, maxYears){
  var avail = HIST_M_STOCK.length;
  var N = Math.ceil(maxYears * 12 - 1e-9);
  if (N > avail) return null;
  var count = avail - N + 1;
  var ppy = PPY[p.period] || 12;
  var plan = [];
  for (var k = 1; k <= N; k++){
    var yearNo = Math.ceil(k / 12);
    var grown = p.contrib * Math.pow(1 + p.growth, yearNo - 1);
    var amount;
    if (ppy >= 12) amount = grown * (ppy / 12);
    else if (ppy === 4) amount = (k % 3 === 0) ? grown : 0;
    else amount = (k % 12 === 0) ? grown : 0;
    plan.push({amount: amount, w: p.histMix});
  }
  var target = p.target;
  var crossings = [];
  for (var wi = 0; wi < count; wi++){
    var bal = p.initial, cum = 1;
    for (var k = 0; k < N; k++){
      var pl = plan[k], idx = wi + k;
      var r = (pl.w * HIST_M_STOCK[idx] + (1 - pl.w) * HIST_M_BOND[idx]) / 100;
      if (r <= -0.999) r = -0.999;
      bal = bal * (1 + r) + pl.amount;
      cum *= (1 + HIST_M_INFL[idx] / 100);
      if ((bal / cum) >= target){
        crossings.push((k + 1) / 12);
        break;
      }
    }
  }
  crossings.sort(function(a, b){ return a - b; });
  return {crossings: crossings, total: count};
}

function fiYearsFromCrossings(crossings, total, successPct){
  var needed = Math.max(1, Math.floor(successPct / 100 * total));
  if (needed > crossings.length) return null;
  return crossings[needed - 1];
}

function fiComputeCoastCrossings(p){
  var avail = HIST_M_STOCK.length;
  var retYrs = Math.max(1, p.retireAge - p.curAge);
  var N = Math.ceil(retYrs * 12 - 1e-9);
  if (N > avail) return null;
  var count = avail - N + 1;
  var ppy = PPY[p.period] || 12;
  var mix = p.histMix;
  var target = p.target;
  var nomBal   = new Float64Array(N + 1);
  var cumInfl  = new Float64Array(N + 1);
  var backNom  = new Float64Array(N + 1);
  var backInfl = new Float64Array(N + 1);
  var crossings = [];
  for (var wi = 0; wi < count; wi++){
    nomBal[0]  = p.initial;
    cumInfl[0] = 1;
    for (var k = 0; k < N; k++){
      var idx = wi + k;
      var r = (mix * HIST_M_STOCK[idx] + (1 - mix) * HIST_M_BOND[idx]) / 100;
      if (r <= -0.999) r = -0.999;
      var yearNo = Math.ceil((k + 1) / 12);
      var grown  = p.contrib * Math.pow(1 + p.growth, yearNo - 1);
      var amt;
      if (ppy >= 12)      amt = grown * (ppy / 12);
      else if (ppy === 4) amt = ((k + 1) % 3 === 0)  ? grown : 0;
      else                amt = ((k + 1) % 12 === 0) ? grown : 0;
      nomBal[k + 1]  = nomBal[k] * (1 + r) + amt;
      cumInfl[k + 1] = cumInfl[k] * (1 + HIST_M_INFL[idx] / 100);
    }
    backNom[N]  = 1;
    backInfl[N] = 1;
    for (var k = N - 1; k >= 0; k--){
      var idx = wi + k;
      var r = (mix * HIST_M_STOCK[idx] + (1 - mix) * HIST_M_BOND[idx]) / 100;
      if (r <= -0.999) r = -0.999;
      backNom[k]  = backNom[k + 1]  * (1 + r);
      backInfl[k] = backInfl[k + 1] * (1 + HIST_M_INFL[idx] / 100);
    }
    for (var k = 0; k <= N; k++){
      var coastReal = nomBal[k] * backNom[k] / (cumInfl[k] * backInfl[k]);
      if (isFinite(coastReal) && coastReal >= target){
        crossings.push(k / 12);
        break;
      }
    }
  }
  crossings.sort(function(a, b){ return a - b; });
  return {crossings: crossings, total: count};
}

function drawFireChart(p, displayYear, maxYears){
  var svgId = "chartFire";
  var svg = $(svgId);
  var pts = [];
  var drawMaxX = maxYears;
  var isCoast = (p.mode === "coast");
  var retYrs = isCoast ? Math.max(1, p.retireAge - p.curAge) : maxYears;

  if (chartMode.fire === "hist"){
    var cacheYr = (displayYear !== null && displayYear >= 0) ? displayYear : -1;
    var key = JSON.stringify([p.histMix, p.initial, p.contrib, p.period, p.growth, maxYears, p.mode, cacheYr]);
    if (fiHistKey !== key){
      var stages;
      if (isCoast && displayYear !== null && displayYear > 0 && displayYear < retYrs){
        stages = [
          {years: displayYear,        contrib: p.contrib, period: p.period, growth: p.growth, mix: p.histMix},
          {years: retYrs - displayYear, contrib: 0,       period: "Monthly", growth: 0,       mix: p.histMix}
        ];
      } else if (isCoast){
        stages = [{years: retYrs, contrib: p.contrib, period: p.period, growth: p.growth, mix: p.histMix}];
      } else {
        var histYrs = (displayYear !== null && displayYear > 0) ? displayYear : maxYears;
        stages = [{years: histYrs, contrib: p.contrib, period: p.period, growth: p.growth, mix: p.histMix}];
      }
      var H = historicalRuns({initial: p.initial, fees: 0}, stages);
      if (H.tooLong || !H.bands || !H.bands.length){
        svg.innerHTML = "";
        $("legendFire").innerHTML = "";
        $("fiChartNote").textContent = H.tooLong ? "History too short for this horizon" : "";
        return;
      }
      fiHistRunsCache = H;
      fiHistKey = key;
      $("fiHistNote").innerHTML = histBarNote(fiHistRunsCache);
    }
    var bands = fiHistRunsCache.bands;
    for (var bi = 0; bi < bands.length; bi++){
      var b = bands[bi];
      pts.push({year: Math.round(b.year), base: b.p50, hi: b.p90, lo: b.p10, p25: b.p25, p75: b.p75});
    }
    if (!pts.length){ svg.innerHTML = ""; return; }
    drawMaxX = pts[pts.length - 1].year;
    var R = paintChart(svgId, pts, drawMaxX, "mc", null, p.curAge,
      {traces:{xs:pts.map(function(a){ return a.year; }), lines:fiHistRunsCache.traces || []}});
    fiChartPoints = R;
    histLegend("legendFire");
    $("fiChartNote").textContent = "";
  } else {
    var nomBase = p.nominal;
    var nomHi   = p.nominal + p.band;
    var nomLo   = Math.max(0.001, p.nominal - p.band);

    function projBand(init, contrib, years){
      return {
        b: project({initial:init, contrib:contrib, period:p.period, growth:p.growth,
                    nominal:nomBase, inflation:p.inflation, years:years, withdrawal:0, taxRate:0}),
        h: project({initial:init, contrib:contrib, period:p.period, growth:p.growth,
                    nominal:nomHi,  inflation:p.inflation, years:years, withdrawal:0, taxRate:0}),
        l: project({initial:init, contrib:contrib, period:p.period, growth:p.growth,
                    nominal:nomLo,  inflation:p.inflation, years:years, withdrawal:0, taxRate:0})
      };
    }

    pts.push({year:0, base:p.initial, hi:p.initial, lo:p.initial});

    if (isCoast && displayYear !== null && displayYear > 0 && displayYear < retYrs){
      var coastYrs = Math.round(displayYear);
      var ph1 = projBand(p.initial, p.contrib, coastYrs);
      for (var i1 = 0; i1 < ph1.b.years.length; i1++){
        var yr1 = ph1.b.years[i1];
        var dfl1 = Math.pow(1 + p.inflation, yr1.year);
        pts.push({year: yr1.year, base: (yr1.end||0)/dfl1,
                  hi: ((ph1.h.years[i1]||yr1).end||0)/dfl1,
                  lo: ((ph1.l.years[i1]||yr1).end||0)/dfl1});
      }
      var restYrs2 = retYrs - coastYrs;
      if (restYrs2 > 0){
        var ph2p = projBand(ph1.b.fv, 0, restYrs2);
        var ph2h = projBand(ph1.h.fv, 0, restYrs2);
        var ph2l = projBand(ph1.l.fv, 0, restYrs2);
        for (var i2 = 0; i2 < ph2p.b.years.length; i2++){
          var yr2 = ph2p.b.years[i2];
          var dfl2 = Math.pow(1 + p.inflation, coastYrs + yr2.year);
          pts.push({year: coastYrs + yr2.year,
                    base: (yr2.end||0)/dfl2,
                    hi:   ((ph2h.h.years[i2]||yr2).end||0)/dfl2,
                    lo:   ((ph2l.l.years[i2]||yr2).end||0)/dfl2});
        }
      }
      drawMaxX = retYrs;
    } else {
      var yrsToRun = (p.mode === "fire" && displayYear !== null && displayYear > 0)
        ? displayYear : (isCoast ? retYrs : maxYears);
      var ppB = projBand(p.initial, p.contrib, yrsToRun);
      for (var ib = 0; ib < ppB.b.years.length; ib++){
        var yrb = ppB.b.years[ib];
        var deflb = Math.pow(1 + p.inflation, yrb.year);
        pts.push({year: yrb.year,
                  base: (yrb.end||0)/deflb,
                  hi:   ((ppB.h.years[ib]||yrb).end||0)/deflb,
                  lo:   ((ppB.l.years[ib]||yrb).end||0)/deflb});
      }
      if (ppB.b.years.length > 0) drawMaxX = ppB.b.years[ppB.b.years.length - 1].year;
    }

    var R = paintChart(svgId, pts, drawMaxX, "band", null, p.curAge, {});
    fiChartPoints = R;
    var lbl = (p.band * 100).toFixed(1).replace(/\.0$/, "");
    $("legendFire").innerHTML =
      swatch("#4fbf95", p.band > 0 ? "At " + pctStr(nomHi, 2) + " (+" + lbl + "%)" : "Higher") +
      swatch("#e9b872", "At " + pctStr(nomBase, 2) + " (your rate)") +
      swatch("#e2795f", p.band > 0 ? "At " + pctStr(Math.max(0.001, nomLo), 2) + " (−" + lbl + "%)" : "Lower");
    $("fiChartNote").textContent = "";
  }

  if (!fiChartPoints || !fiChartPoints.Y) return;
  var narrow = window.innerWidth < 640;
  var T2 = narrow ? 12 : 14, B2 = narrow ? 34 : 30, H2 = narrow ? 400 : 340;
  var ph2 = H2 - T2 - B2;
  var W2 = fiChartPoints.W || (narrow ? 470 : 900);

  if (p.target > 0){
    var tY = fiChartPoints.Y(p.target);
    var tYok = (tY >= T2 && tY <= T2 + ph2);
    if (tYok){
      svg.appendChild(svgEl("line", {x1:0, x2:W2, y1:tY, y2:tY,
        stroke:"#4fbf95", "stroke-width":"1.5", "stroke-dasharray":"6 4", opacity:"0.65"}));
      var tLbl = svgEl("text", {x:W2-(narrow?14:16), y:tY-4, "text-anchor":"end",
        "font-size":narrow?"13":"10", fill:"#4fbf95",
        "font-family":"ui-monospace,SF Mono,Menlo,monospace"});
      tLbl.textContent = "target"; svg.appendChild(tLbl);
    }

    if (displayYear !== null && displayYear >= 0 && displayYear <= drawMaxX){
      var fX = fiChartPoints.X(displayYear);
      svg.appendChild(svgEl("line", {x1:fX, x2:fX, y1:T2, y2:T2+ph2,
        stroke:"#4fbf95", "stroke-width":"1.5", "stroke-dasharray":"4 3", opacity:"0.55"}));
      if (!isCoast && tYok){
        svg.appendChild(svgEl("circle", {cx:fX, cy:tY, r:narrow?"6":"4.5",
          fill:"#4fbf95", stroke:cssVar("--bg"), "stroke-width":"2"}));
      }
    }
  }
}

function renderFireSuccess(p){
  var isHist = (chartMode.fire === "hist");
  $("fiSliderWrap").hidden = !isHist;

  var sr = p.successRate;
  $("fiSuccessPct").textContent = sr + "%";

  if (!isHist){
    drawFireChart(p, fiCurrentFireYear, fiMaxYears);
    return;
  }

  var displayYear = fiCurrentFireYear;

  if (p.mode === "fire"){
    var crossKey = JSON.stringify([p.histMix, p.initial, p.contrib, p.period, p.growth, fiMaxYears]);
    if (fiCrossingsKey !== crossKey){
      var cr = fiComputeCrossings(p, fiMaxYears);
      if (cr){ fiCrossingsCache = cr.crossings; fiCrossingsTotal = cr.total; }
      else   { fiCrossingsCache = null;          fiCrossingsTotal = 0; }
      fiCrossingsKey = crossKey;
    }
    if (fiCrossingsCache && p.target > 0){
      var y = fiYearsFromCrossings(fiCrossingsCache, fiCrossingsTotal, sr);
      if (y !== null && y >= 0){
        var ageNum = p.curAge + y;
        var ageFmt = (ageNum % 1) ? ageNum.toFixed(1) : String(ageNum);
        var yFmt   = (y % 1) ? y.toFixed(1) : String(y);
        $("fiSuccessAge").textContent = "Age " + ageFmt + " (" + yFmt + (parseFloat(yFmt) === 1 ? " year" : " years") + " from now)";
        $("fiSliderNote").textContent = sr + "% of historical windows since 1926 show the portfolio reaching the target by age " + ageFmt + ".";
        displayYear = y;
      } else {
        $("fiSuccessAge").textContent = "Not in range";
        $("fiSliderNote").textContent = sr + "% success rate not achievable within the projected window.";
      }
    } else {
      $("fiSuccessAge").textContent = "\u2014";
      $("fiSliderNote").textContent = p.target > 0 ? "History too short for this horizon." : "Enter a target to see results.";
    }
  } else {
    var coastKey = JSON.stringify([p.histMix, p.initial, p.contrib, p.period, p.growth, p.retireAge, p.curAge]);
    if (fiCoastCrossKey !== coastKey){
      var cc = fiComputeCoastCrossings(p);
      if (cc){ fiCoastCrossCache = cc.crossings; fiCoastCrossTotal = cc.total; }
      else   { fiCoastCrossCache = null;          fiCoastCrossTotal = 0; }
      fiCoastCrossKey = coastKey;
    }
    if (fiCoastCrossCache && p.target > 0){
      var y = fiYearsFromCrossings(fiCoastCrossCache, fiCoastCrossTotal, sr);
      if (y !== null && y >= 0){
        var ageNum = p.curAge + y;
        var ageFmt = (ageNum % 1) ? ageNum.toFixed(1) : String(ageNum);
        var yFmt   = (y % 1) ? y.toFixed(1) : String(y);
        $("fiSuccessAge").textContent = "Age " + ageFmt + " (" + yFmt + (parseFloat(yFmt) === 1 ? " year" : " years") + " from now)";
        $("fiSliderNote").textContent = sr + "% of historical windows since 1926 show the portfolio reaching the coast target by age " + ageFmt + ".";
        displayYear = y;
      } else {
        $("fiSuccessAge").textContent = "Not in range";
        $("fiSliderNote").textContent = sr + "% success rate not achievable within the projected window.";
      }
    } else {
      $("fiSuccessAge").textContent = "\u2014";
      $("fiSliderNote").textContent = p.target > 0 ? "History too short for this horizon." : "Enter a target to see results.";
    }
  }
  drawFireChart(p, displayYear, fiMaxYears);
}

function renderFire(){
  var p = readFire();

  if (!p.target || p.target <= 0){
    $("fiAge").textContent = "\u2014";
    $("fiPortfolio").textContent = "\u2014";
    $("fiYears").textContent = "\u2014";
    $("fiKVTarget").textContent = "\u2014";
    $("fiKVWithdrawal").textContent = "\u2014";
    $("fiKVContribs").textContent = "\u2014";
    $("fiKVGains").textContent = "\u2014";
    $("fiKVNominal").textContent = "\u2014";
    $("fiKVRealReturn").textContent = "\u2014";
    $("fiTableBody").innerHTML = "";
    $("fiSuccessAge").textContent = "\u2014";
    $("fiSliderNote").textContent = "Enter a target to see results.";
    return;
  }

  var realRate = (1 + p.nominal) / (1 + p.inflation) - 1;
  var maxYears = Math.max(5, Math.min(100 - p.curAge, 80));
  fiMaxYears = maxYears;

  var pp = project({initial:p.initial, contrib:p.contrib, period:p.period,
                    growth:p.growth, nominal:p.nominal, inflation:p.inflation,
                    years:maxYears, withdrawal:0, taxRate:0});

  var fireYear = null;
  var firePortReal = 0;
  var firePortNominal = 0;

  if (p.mode === "fire" && p.initial >= p.target){
    fireYear = 0; firePortReal = p.initial; firePortNominal = p.initial;
  } else if (p.mode === "coast" && p.retireAge > p.curAge){
    var yearsLeft0 = p.retireAge - p.curAge;
    var cn0 = realRate > -1 ? p.target / Math.pow(1 + realRate, yearsLeft0) : p.target;
    if (p.initial >= cn0){ fireYear = 0; firePortReal = p.initial; firePortNominal = p.initial; }
  }

  if (fireYear === null){
    var prevRealBal = p.initial;
    var prevCn = realRate > -1 ? p.target / Math.pow(1 + realRate, p.retireAge - p.curAge) : p.target;
    for (var i = 0; i < pp.years.length; i++){
      var yr = pp.years[i];
      var defl = Math.pow(1 + p.inflation, yr.year);
      var realBal = (yr.end || 0) / defl;

      if (p.mode === "fire"){
        if (realBal >= p.target){
          var span = realBal - prevRealBal;
          var frac = span > 0 ? (p.target - prevRealBal) / span : 1;
          fireYear = (yr.year - 1) + Math.max(0, Math.min(1, frac));
          firePortReal = realBal; firePortNominal = yr.end || 0; break;
        }
        prevRealBal = realBal;
      } else {
        var yearsLeft = p.retireAge - p.curAge - yr.year;
        if (yearsLeft <= 0){
          if (realBal >= p.target){ fireYear = yr.year; firePortReal = realBal; firePortNominal = yr.end || 0; }
          break;
        }
        var cn = realRate > -1 ? p.target / Math.pow(1 + realRate, yearsLeft) : p.target;
        if (realBal >= cn){
          var prevDiff = prevRealBal - prevCn;
          var currDiff = realBal - cn;
          var frac = (currDiff - prevDiff) > 0 ? -prevDiff / (currDiff - prevDiff) : 1;
          fireYear = (yr.year - 1) + Math.max(0, Math.min(1, frac));
          firePortReal = realBal; firePortNominal = yr.end || 0; break;
        }
        prevRealBal = realBal;
        prevCn = cn;
      }
    }
  }

  var modeLabel = p.mode === "fire" ? "FIRE" : "Coast FIRE";
  $("fiAgeLabel").textContent = modeLabel + " age";
  $("fiPortfolioLabel").textContent = p.mode === "fire" ? "Portfolio at FIRE" : "Portfolio at coast";
  $("fiYearsLabel").textContent = "Years until " + modeLabel;

  if (fireYear !== null){
    var ageNum = p.curAge + fireYear;
    $("fiAge").textContent = ageNum.toFixed(1).replace(/\.0$/, '');
    $("fiPortfolio").textContent = money(firePortReal);
    $("fiYears").textContent = fireYear === 0 ? "Already there!" : fireYear.toFixed(1).replace(/\.0$/, '');
    $("fiAgeNote").textContent = "At your current pace";
    $("fiYearsNote").textContent = fireYear > 0 ? "From age " + fmtNum(p.curAge) : "";
  } else {
    $("fiAge").textContent = "Not in range";
    $("fiPortfolio").textContent = "\u2014";
    $("fiYears").textContent = "Not in range";
    $("fiAgeNote").textContent = "Won't reach it by age 100";
    $("fiYearsNote").textContent = "";
  }

  $("fiCoastExtra").hidden = (p.mode !== "coast");
  if (p.mode === "coast" && fireYear !== null){
    var retYears = p.retireAge - p.curAge;
    var ppFull = project({initial:p.initial, contrib:p.contrib, period:p.period,
                          growth:p.growth, nominal:p.nominal, inflation:p.inflation,
                          years:retYears, withdrawal:0, taxRate:0});
    var lastFull = ppFull.years[ppFull.years.length - 1] || {end:0};
    var deflFull = Math.pow(1 + p.inflation, retYears);
    var keepSavingReal = (lastFull.end || 0) / deflFull;
    var coastEndReal = firePortReal * Math.pow(1 + realRate, retYears - fireYear);
    $("fiKeepSaving").textContent = money(keepSavingReal);
    $("fiCoastGap").textContent = money(Math.max(0, keepSavingReal - coastEndReal));
  }

  $("fiKVTarget").textContent = money(p.target);
  $("fiKVWithdrawal").textContent = money(p.target * p.withdrawal);

  var ppy2 = PPY[p.period] || 12;
  var totalContrib = 0;
  if (fireYear !== null && fireYear > 0){
    for (var j = 0; j < fireYear; j++){
      totalContrib += p.contrib * ppy2 * Math.pow(1 + p.growth, j);
    }
  }
  $("fiKVContribs").textContent = money(totalContrib);
  $("fiKVGains").textContent = money(Math.max(0, firePortNominal - p.initial - totalContrib));
  $("fiKVNominal").textContent = pctStr(p.nominal, 2);
  $("fiKVRealReturn").textContent = pctStr(realRate, 2);

  fiCurrentFireYear = fireYear;

  var rows = "";
  for (var k = 0; k < pp.years.length; k++){
    var y2 = pp.years[k];
    var deflK = Math.pow(1 + p.inflation, y2.year);
    var realBalK = (y2.end || 0) / deflK;
    var rowClass2 = (fireYear !== null && y2.year === Math.ceil(fireYear)) ? " class=\"firow-fire\"" : "";
    rows += "<tr" + rowClass2 + "><td>" + (p.curAge + y2.year) + "</td>" +
      "<td>" + money(y2.start || 0) + "</td>" +
      "<td>" + money(y2.contrib || 0) + "</td>" +
      "<td class='pos'>" + money(y2.growth || 0) + "</td>" +
      "<td>" + money(y2.end || 0) + "</td>" +
      "<td>" + money(realBalK) + "</td></tr>";
  }
  $("fiTableBody").innerHTML = rows;

  fiHistFullKey = null;
  fiCrossingsKey = null;
  fiCoastCrossKey = null;
  fiSuccessResults = null;
  renderFireSuccess(p);
}

(function(){
  function listen(id){ var el = $(id); if (el) el.addEventListener("input", renderFire); }
  function listenC(id){ var el = $(id); if (el) el.addEventListener("change", renderFire); }
  ["fiCurAge","fiRetireAge","fiInitial","fiContrib","fiGrowth",
   "fiNominal","fiInflation","fiTarget","fiWithdrawal","fiBand","fiHistMix"].forEach(listen);
  ["fiPeriod","fiSolveFor"].forEach(listenC);

  $("segFireMode").querySelectorAll("button").forEach(function(btn){
    btn.addEventListener("click", function(){
      $("segFireMode").querySelectorAll("button").forEach(function(b){ b.classList.remove("on"); });
      btn.classList.add("on");
      var isCoast = btn.getAttribute("data-firemode") === "coast";
      $("fiRetireAgeWrap").hidden = !isCoast;
      renderFire();
    });
  });


  $("segFireChart").addEventListener("click", function(e){
    var b = e.target && e.target.closest ? e.target.closest("button[data-mode]") : null;
    if (!b) return;
    var m = b.getAttribute("data-mode");
    if (chartMode.fire === m) return;
    chartMode.fire = m;
    $("segFireChart").querySelectorAll("button").forEach(function(x){
      x.classList.toggle("on", x.getAttribute("data-mode") === m);
    });
    $("fiOptBand").style.display = (m === "band") ? "" : "none";
    $("fiHistBar").hidden = (m !== "hist");
    $("fiSliderWrap").hidden = (m !== "hist");
    fiHistKey = null;
    renderFire();
  });

  $("fiSuccessSlider").addEventListener("input", function(){
    var p = readFire();
    renderFireSuccess(p);
  });

  attachChart("chartWrapFire", "chartFire", "tipFire",
    function(){ return fiChartPoints; },
    function(best){
      var p = readFire();
      var mode = chartMode.fire;
      var header = "<b>Year " + best.year + " Age " + (p.curAge + best.year) + "</b>";
      if (mode === "hist" || mode === "mc"){
        return header +
          "<br><span style='color:#4fbf95'>90th</span> <span class='n'>" + money(best.hi) + "</span>" +
          "<br><span style='color:#3f9a78'>75th</span> <span class='n'>" + money(best.p75) + "</span>" +
          "<br><span style='color:#e9b872'>Median</span> <span class='n'>" + money(best.base) + "</span>" +
          "<br><span style='color:#3f9a78'>25th</span> <span class='n'>" + money(best.p25) + "</span>" +
          "<br><span style='color:#e2795f'>10th</span> <span class='n'>" + money(best.lo) + "</span>";
      }
      return header +
        "<br><span style='color:#4fbf95'>Higher</span> <span class='n'>" + money(best.hi) + "</span>" +
        "<br><span style='color:#e9b872'>Your rate</span> <span class='n'>" + money(best.base) + "</span>" +
        "<br><span style='color:#e2795f'>Lower</span> <span class='n'>" + money(best.lo) + "</span>";
    }
  );
})();
// Same late-setup issue as Healthcare: a direct visit to /fire opens the tool
// before its listeners exist, so draw it here if it's the one on screen.
if (linkFireMode === "coast"){
  const coastBtn = $("segFireMode").querySelector('button[data-firemode="coast"]');
  if (coastBtn && !coastBtn.classList.contains("on")) coastBtn.click();
}
if (chartMode.tab === "tools" && toolSub === "fire") renderFire();

})();

