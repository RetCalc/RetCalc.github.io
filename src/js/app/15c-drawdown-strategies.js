/* ---------- the Drawdown Simulator: strategies, the spending path and guaranteed income ----------
   What the inputs panel says about the strategy chosen (a card with its
   family and its spending through a hard start, and a line on what it does
   in year one), the spending path's fields, and the guaranteed income's. */

/* A sparkline: one series as a small filled line, with an optional dashed
   level. Returns the SVG's markup. */
function ddSpark(vals, opt){
  opt = opt || {};
  var W = opt.w || 260, H = opt.h || 46, pad = 3, n = vals.length;
  if (!n) return "";
  var hi = Math.max.apply(null, vals.concat(opt.line || 0)) || 1, lo = 0;
  var X = function (i) { return pad + (n > 1 ? i / (n - 1) : .5) * (W - 2 * pad); };
  var Y = function (v) { return H - pad - (v - lo) / (hi - lo) * (H - 2 * pad); };
  var d = vals.map(function (v, i) { return (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1); }).join(" ");
  var area = d + " L" + X(n - 1).toFixed(1) + " " + (H - pad) + " L" + X(0).toFixed(1) + " " + (H - pad) + " Z";
  var c = opt.color || "#e9b872";
  return "<svg class='ddspark' viewBox='0 0 " + W + " " + H + "' preserveAspectRatio='none' aria-hidden='true'>" +
    "<path d='" + area + "' fill='" + c + "' opacity='.14'/>" +
    (opt.line > 0 ? "<line x1='" + pad + "' x2='" + (W - pad) + "' y1='" + Y(opt.line).toFixed(1) + "' y2='" + Y(opt.line).toFixed(1) +
      "' stroke='#8b97ad' stroke-width='1' stroke-dasharray='3 3'/>" : "") +
    "<path d='" + d + "' fill='none' stroke='" + c + "' stroke-width='1.8' stroke-linejoin='round' vector-effect='non-scaling-stroke'/></svg>";
}
/* The hard start a strategy is shown through: 1966 when the record has it
   for this length of retirement, or else the start that ended worst. */
function ddHardStart(o, H){
  var W = ddWindows(o);
  for (var k = 0; k < W.length; k++) if (W[k].year === 1966 && W[k].month === 1) return W[k];
  if (!W.length) return null;
  var worst = null, P = ddPrep(o);
  W.forEach(function (w) {
    var r = runDrawdown(o, w.seq, {lite: true}, P);
    if (!worst || r.endReal < worst.end) worst = {w: w, end: r.endReal};
  });
  return worst.w;
}
/* Year one's spending through one start, in today's dollars, and what it
   came to over the run. */
function ddSpendThrough(o, w, P){
  return runDrawdown(o, w.seq, null, P || ddPrep(o)).rows.map(function (r) { return r.realSpend; });
}
function ddStratCard(o, P){
  var U = DD_UI[o.strategy], S = DD_STRAT[o.strategy], el = $("ddStratCard");
  if (!U || !S) { el.innerHTML = ""; return; }
  var w = o.initial > 0 ? ddHardStart(o) : null, spark = "", cap = "";
  if (w) {
    var vals = ddSpendThrough(o, w, P), hi = Math.max.apply(null, vals), lo = Math.min.apply(null, vals);
    spark = ddSpark(vals, {line: ddComfort(o, P)});
    cap = "Spending, retiring in " + (w.month !== 1 ? HIST_MON[w.month - 1] + " " : "") + w.year + ": " +
      (Math.round(hi - lo) < 1 ? money(lo) + " every year" : money(vals[0]) + " in year one, " + money(lo) + " at the lowest" +
        (hi > vals[0] + 1 ? ", " + money(hi) + " at the highest" : ""));
  }
  el.innerHTML = "<div class='ddstrat-top'><span class='ddstrat-fam'>" + DD_FAMILY[S.family] + "</span></div>" +
    "<div class='ddstrat-blurb'>" + U.blurb + "</div>" + (spark ? spark + "<div class='ddstrat-cap'>" + cap + "</div>" : "");
}

/* A line on what the strategy does, for the ones whose fields don't say it
   themselves; the rest have their own notes, or the rate's. */
function ddStratNote(o, P, firstW, r1){
  if (!(o.initial > 0)) return "";
  var yr1 = "<b>" + money(firstW) + "</b>", p = function (v, d) { return pctStr(v / 100, d == null ? 2 : d); };
  switch (o.strategy) {
    case "kitces":
      return "Starts at " + yr1 + " and never falls. Whenever the portfolio is " + ddN(o.kitThresh) +
        "% above where it started, after inflation, spending rises " + ddN(o.kitRaise) + "%, at most once every " +
        ddN(o.kitGap) + (o.kitGap === 1 ? " year." : " years.");
    case "clyatt":
      return "Takes " + p(o.initialPct) + " of the portfolio each year, " + yr1 + " in year one, but never less than " +
        ddN(o.clyFloor) + "% of last year's spending in dollars, so a crash brings a run of small cuts rather than one big one.";
    case "oneovern":
      return "Year one takes 1/" + o.years + " of the portfolio, " + yr1 + ". The share rises every year, to all of what's left in the last.";
    case "rmd":
      var age = o.retireAge != null ? o.retireAge : 65;
      return "Year one takes the portfolio ÷ " + ddN(Math.round(ddRmdDivisor(age) * 10) / 10) + ", " + yr1 + " (" + pctStr(r1, 2) + ")" +
        (o.retireAge == null ? ", taking 65 since no age is set above" : "") + ". The share rises with age: " +
        pctStr(1 / ddRmdDivisor(75), 1) + " at 75, " + pctStr(1 / ddRmdDivisor(85), 1) + " at 85.";
    case "riskgr":
      return "Year one: " + yr1 + " (" + pctStr(r1, 2) + "), the spending with a " + ddN(o.rgTarget) + "% chance of lasting " +
        o.years + " years at your stock mix, by history, counting Social Security and other income still to come. It then holds, with inflation, " +
        "until that chance falls below " + ddN(o.rgLo) + "% or rises above " + ddN(o.rgHi) + "%, and resets to " + ddN(o.rgTarget) + "%.";
    case "vanguard":
      return "Aims at " + p(o.initialPct) + " of the current portfolio, " + yr1 + " in year one, but spending never rises more than " +
        ddN(o.vgCeil) + "% or falls more than " + ddN(o.vgFloor) + "% from last year's, after inflation.";
    case "floorceil":
      return "Aims at " + p(o.initialPct) + " of the current portfolio, but moves spending at most " + ddN(o.floorPct) +
        "% down or " + ddN(o.ceilPct) + "% up from last year's, after inflation.";
    case "hebeler":
      return "Year one takes the payment that would spend the portfolio over " + o.years + " years at " + p(o.hebRate) + " real, " +
        yr1 + " (" + pctStr(r1, 2) + "). After that, " + ddN(o.hebWeight) + "% of last year's spending with inflation, plus " +
        ddN(100 - o.hebWeight) + "% of that payment, worked out again on what's left.";
    case "sensible":
      return "Each year: " + yr1 + ", rising with inflation, plus " + ddN(o.sensExtra) +
        "% of last year's real investment gains whenever there were any.";
    case "cape":
      var sum = 0;
      HIST_M_CAPE.forEach(function (c) { sum += c; });
      var avg = sum / HIST_M_CAPE.length;
      return "Takes " + p(o.capeA) + " plus " + ddN(o.capeB) + " × 1/CAPE of the portfolio each year. At today's CAPE, " +
        CAPE_NOW.toFixed(1) + " (" + CAPE_NOW_ASOF + "), that's " + pctStr(r1, 2) + ", " + yr1 + "; at the average since 1926, " +
        avg.toFixed(1) + ", it would be " + p(o.capeA + o.capeB * 100 / avg) + ".";
  }
  return "";
}

/* ---- the spending path ---- */
function ddPathSync(o, P, firstW){
  var takes = !!DD_STRAT[o.strategy].path;
  $("ddPathField").hidden = !takes;
  $("ddPathOff").hidden = takes;
  if (!takes) { $("ddPathEaseWrap").hidden = true; $("ddWdStagesWrap").hidden = true; return; }
  var kind = o.path;
  $("ddPathEaseWrap").hidden = kind !== "ease";
  $("ddWdStagesWrap").hidden = kind !== "stages";
  if (kind === "stages") syncWdStages(o, firstW);
  var m = P.path, last = m[m.length - 1], note = "";
  if (kind === "flat") note = "Spending keeps its value, rising with inflation, as the strategy decides.";
  else if (kind === "ease")
    note = "Real spending falls " + ddN(o.pathEase) + "% a year: by year " + o.years + ", " + pctStr(last, 0) +
      " of year one's" + (o.strategy === "fixed" ? ", " + money(firstW * last) + " a year." : ".");
  else if (kind === "smile") {
    var age0 = o.retireAge != null ? o.retireAge : 65, at = function (a) { var i = Math.round(a - age0); return i >= 0 && i < m.length ? m[i] : null; };
    var lowI = 0;
    m.forEach(function (v, i) { if (v < m[lowI]) lowI = i; });
    note = "David Blanchett's estimate of how retirees' real spending actually moves, for someone spending about " +
      money(firstW + P.G.income) + " a year: easing through the 70s" +
      (at(85) != null ? ", about " + pctStr(1 - at(85), 0) + " lower by 85" : "") +
      (lowI < m.length - 1 ? ", then rising again late in life" : "") + "." +
      (o.retireAge == null ? " It depends on age, so it takes retirement at 65 until you set your age above." : "");
  } else if (kind === "stages")
    note = ddPathStages.length ? "Year one's level holds until the first stage below." : "Add a stage to change spending from a given " + (ddRetireAge != null ? "age." : "year.");
  $("ddPathNote").textContent = note;
}
$("ddPath").addEventListener("change", function () {
  if ($("ddPath").value === "stages" && !ddPathStages.length) {
    var years = Math.min(60, Math.max(1, Math.round(num("ddYears"))));
    ddPathStages.push({start: Math.min(years, 11), level: 90});
    if (years >= 21) ddPathStages.push({start: 21, level: 80});
    buildWdStages();
    renderDrawdown();
  }
});

/* ---- guaranteed income ---- */
function ddGuarSync(o, P){
  var on = o.gShare > 0, G = P.G, tips = o.gType !== "annuity";
  $("ddGDetail").hidden = !on;
  $("ddGYieldWrap").hidden = !tips;
  $("ddGPayoutWrap").hidden = tips;
  $("ddGInflateWrap").hidden = tips;
  if (!on) return;
  var cost = o.initial * G.share, rest = o.initial - cost;
  $("ddGNote").innerHTML = money(cost) + " buys <b>" + money(G.income) + "</b> a year" +
    (tips ? " for " + o.years + " years, rising with inflation: a " + o.years + "-year TIPS ladder at " + pctStr((o.gYield || 0) / 100, 2) +
        " real pays " + pctStr(G.rate, 2) + " of its cost a year, then nothing."
      : " for life, " + (o.gInflate ? "rising with inflation." : "level in dollars, so inflation wears it down.")) +
    " The other " + money(rest) + " stays invested and runs the strategy, and this income comes on top of what it spends.";
}

/* The plan in rows, label and value, for the printable summary: the
   strategy and its settings, the spending path, guaranteed income, limits
   and the history tested. */
function ddPlanRows(o){
  var P = ddPrep(o), first = ddFirstSpend(o, P), out = [], p = function (v, d) { return pctStr(v / 100, d == null ? 2 : d); };
  out.push(["Withdrawal strategy", DD_STRAT_NAMES[o.strategy] || o.strategy]);
  out.push(["Year one's spending", money(first) + (P.initial > 0 ? " (" + pctStr(first / P.initial, 2) + ")" : "")]);
  switch (o.strategy) {
    case "fixed": if (o.skipRaise) out.push(["After a losing year", "No raise for inflation"]); break;
    case "kitces":
      out.push(["Ratchet", ddN(o.kitRaise) + "% raise when " + ddN(o.kitThresh) + "% up, at most every " + ddN(o.kitGap) + " years"]);
      if (o.skipRaise) out.push(["After a losing year", "No raise for inflation"]);
      break;
    case "clyatt": out.push(["Never below", ddN(o.clyFloor) + "% of last year's"]); break;
    case "vpw":
      out.push(["Expected return, real", p(o.vpwRate || 0)]);
      out.push(["PMT future value", money(o.vpwFV || 0)]);
      break;
    case "guardrails":
      out.push(["Upper guardrail", ddN(o.guardBand) + "% above, cut " + ddN(o.adjustPct) + "%"]);
      out.push(["Lower guardrail", ddN(o.guardBandLo) + "% below, raise " + ddN(o.raisePct) + "%"]);
      if (o.gkFinalYears > 0) out.push(["No cuts in the final", ddN(o.gkFinalYears) + " years"]);
      if (o.skipRaise) out.push(["After a losing year", "No raise, when above the start rate"]);
      break;
    case "riskgr": out.push(["Chance of lasting", ddN(o.rgTarget) + "% target, reset below " + ddN(o.rgLo) + "% or above " + ddN(o.rgHi) + "%"]); break;
    case "floorceil": out.push(["Each year's change", "at most " + ddN(o.floorPct) + "% down, " + ddN(o.ceilPct) + "% up"]); break;
    case "vanguard": out.push(["Each year's change", "at most " + ddN(o.vgFloor) + "% down, " + ddN(o.vgCeil) + "% up"]); break;
    case "yale":
      out.push(["Weight on last year", ddN(o.yaleWeight) + "%"]);
      out.push(["Target spending rate", p(o.yaleRate)]);
      break;
    case "hebeler": out.push(["Last year / payment", ddN(o.hebWeight) + "% / " + ddN(100 - o.hebWeight) + "%, at " + p(o.hebRate) + " real"]); break;
    case "sensible": out.push(["Plus, of real gains", ddN(o.sensExtra) + "%"]); break;
    case "cape": out.push(["Rate each year", p(o.capeA) + " + " + ddN(o.capeB) + " \u00d7 1/CAPE"]); break;
  }
  if (o.path === "ease") out.push(["Spending path", "Easing " + ddN(o.pathEase) + "% a year"]);
  else if (o.path === "smile") out.push(["Spending path", "The retirement spending smile"]);
  else if (o.path === "stages") ddWdOrder(o.pathStages).forEach(function (x) {
    out.push([x.st.name || ("Stage " + (x.i + 2)), ddN(x.st.level == null ? 100 : x.st.level) + "% of year one from " +
      (o.retireAge != null ? "age " + ddN(o.retireAge + x.start - 1) : "year " + x.start)]);
  });
  if (P.G.share > 0) out.push(["Guaranteed income", money(P.G.income) + "/yr from " + ddN(o.gShare) + "%, " +
    (o.gType === "annuity" ? "an annuity" + (o.gInflate ? " with raises" : "") : "a TIPS ladder at " + p(o.gYield) + " real")]);
  if (o.spendFloor > 0 && DD_STRAT[o.strategy].limits !== false) out.push(["Minimum spending", money(o.spendFloor) + "/yr"]);
  if (o.spendCeil > 0 && DD_STRAT[o.strategy].limits !== false) out.push(["Maximum spending", money(o.spendCeil) + "/yr"]);
  if (o.monthly || o.fromYear > HIST_START) out.push(["History tested", (o.monthly ? "A start every month" : "A start each January") + " from " + o.fromYear]);
  return out;
}
