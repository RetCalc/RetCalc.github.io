/* ---------- the Drawdown Simulator: history's lessons ----------
   Sequence risk, shown two ways: each start's first ten years against how
   its retirement ended, and every start in order with the eras that shaped
   them marked (DD_ERAS, in the engine). And for the start picked in the
   table, a line on why it went the way it did. */
var ddSeqKind = "decade", ddSeqPts = null, ddSeqHover = null, ddSeqLast = null;

/* What a run's dot measures: what's left, or for a strategy built to spend
   everything, its typical year's spending. */
function ddSeqMeasure(o){
  return DD_STRAT[o.strategy].spendsDown
    ? {of: function (r) { return r.medRealSpend; }, name: "typical year's spending", axis: "Typical year's spending"}
    : {of: function (r) { return r.endReal; }, name: "what was left", axis: "Left at the end, today's $"};
}
function ddPct1(x){ return (x < 0 ? "−" : "") + pctStr(Math.abs(x), 1); }
function ddSeqLabel(r, monthly){ return ddStartLabel(r, monthly); }

/* Two starts that make the point: one that ran out though its whole
   retirement averaged more than one that lasted. Failing that, two that
   averaged about the same and ended furthest apart. */
function ddSeqPair(H, M){
  var fails = H.runs.filter(function (r) { return r.depleted; });
  var lasts = H.runs.filter(function (r) { return !r.depleted; });
  if (fails.length && lasts.length) {
    var f = fails.reduce(function (a, b) { return b.full.port > a.full.port ? b : a; });
    var s = lasts.reduce(function (a, b) { return b.full.port < a.full.port ? b : a; });
    if (s.full.port < f.full.port - 0.0005) return {kind: "beat", a: f, b: s};
  }
  var best = null, runs = H.runs.length > 150 ? H.runs.filter(function (r) { return r.startMonth === 1; }) : H.runs;
  for (var i = 0; i < runs.length; i++) for (var j = i + 1; j < runs.length; j++) {
    var a = runs[i], b = runs[j];
    if (Math.abs(a.full.port - b.full.port) > 0.0025) continue;
    var g = Math.abs(M.of(a) - M.of(b));
    if (!best || g > best.g) best = {kind: "same", a: M.of(a) < M.of(b) ? a : b, b: M.of(a) < M.of(b) ? b : a, g: g};
  }
  return best;
}

function ddPaintSeq(o, H){
  ddSeqLast = {o: o, H: H};
  var panel = $("ddSeqPanel");
  if (!H.runs.length) { panel.hidden = true; return; }
  panel.hidden = false;
  $("segDDSeq").querySelectorAll("button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-ddseq") === ddSeqKind); });
  var M = ddSeqMeasure(o), mo = H.monthly, n = H.runs[0].dec1.years, dec = ddSeqKind === "decade";
  var eraYear = {};
  DD_ERAS.forEach(function (e) { eraYear[e.year] = 1; });
  var pts = H.runs.map(function (r) {
    return {x: dec ? r.dec1.port * 100 : r.startYear + (r.startMonth - 1) / 12, y: M.of(r), run: r,
      miss: r.depleted, cur: r.startIdx === ddSelStart,
      label: dec && r.startMonth === 1 && eraYear[r.startYear] ? String(r.startYear) : null};
  });
  var lo = H.runs[0].startYear, hi = H.runs[H.runs.length - 1].startYear;
  ddSeqPts = ddScatter("chartDDQ", pts, {small: pts.length > 150, yZero: true, yFmt: fmtAxisMoney,
    xFmt: dec ? function (v) { return fmtNum(v) + "%"; } : function (v) { return String(Math.round(v)); },
    xLabel: dec ? "First " + n + " years' return a year, after inflation →" : "Retired in →",
    yLabel: dec ? M.axis : null,
    marks: dec ? null : DD_ERAS.filter(function (e) { return e.year >= lo && e.year <= hi; })
      .map(function (e) { return {x: e.year, label: String(e.year)}; })});
  $("legendDDQ").innerHTML = (dec ? "" : "<span class='ddleg-k'>" + M.axis + ":</span> ") + swatch("#4fbf95", "Lasted") + swatch("#e2795f", "Ran out") +
    (ddSelStart != null ? swatch("#e9b872", "The start picked in the table") : "");

  // The story: the weakest and strongest thirds of first decades, and a pair
  // whose whole retirements averaged alike.
  var by = H.runs.slice().sort(function (a, b) { return a.dec1.port - b.dec1.port; });
  var t = Math.max(1, Math.floor(by.length / 3));
  var low = by.slice(0, t), top = by.slice(by.length - t);
  var med = function (a) { var v = a.map(M.of).sort(function (p, q) { return p - q; }); return v[Math.floor(v.length / 2)]; };
  var failLow = low.filter(function (r) { return r.depleted; }).length, failTop = top.filter(function (r) { return r.depleted; }).length;
  var unit = mo ? "starting months" : "starts";
  var txt = "The first " + n + " years decide most retirements: that's when withdrawals are largest against the balance, " +
    "so losses then are locked in. The third of " + unit + " with the weakest first " + n + " years (under " +
    ddPct1(low[low.length - 1].dec1.port) + " a year after inflation, at your mix) " +
    (failLow ? "ran out in <b>" + failLow + " of " + low.length + "</b>, and " : "") + "left a typical <b>" + money(med(low)) + "</b>" +
    (M.name === "what was left" ? "" : " a year") + "; the strongest third (over " + ddPct1(top[0].dec1.port) + ") " +
    (failTop ? "ran out in " + failTop + " and " : "") + "left <b>" + money(med(top)) + "</b>. ";
  var pr = ddSeqPair(H, M);
  if (pr && pr.kind === "beat")
    txt += "Retiring in " + ddSeqLabel(pr.a, mo) + " ran out though its " + o.years + " years averaged " + ddPct1(pr.a.full.port) +
      " a year after inflation, while " + ddSeqLabel(pr.b, mo) + " lasted on " + ddPct1(pr.b.full.port) +
      ": their first decades returned " + ddPct1(pr.a.dec1.port) + " and " + ddPct1(pr.b.dec1.port) + ".";
  else if (pr)
    txt += "Retiring in " + ddSeqLabel(pr.a, mo) + " and in " + ddSeqLabel(pr.b, mo) + " both averaged about " + ddPct1(pr.a.full.port) +
      " a year after inflation over " + o.years + " years, yet one left " + money(M.of(pr.a)) + " and the other " + money(M.of(pr.b)) +
      ": their first decades returned " + ddPct1(pr.a.dec1.port) + " and " + ddPct1(pr.b.dec1.port) + ".";
  $("ddSeqIntro").innerHTML = txt + (dec ? "" : " The dashed lines mark the eras below.");

  var eras = DD_ERAS.filter(function (e) { return e.to >= lo && e.from <= hi; });
  $("ddEras").hidden = !eras.length;
  $("ddEraList").innerHTML = eras.map(function (e) {
    return "<p><b>" + e.year + ": " + e.title + ".</b> " + e.note + "</p>";
  }).join("");
}
ddScatterTips("chartWrapDDQ", "chartDDQ", "tipDDQ", function () { return ddSeqPts; }, function (p) {
  if (!ddSeqLast) return "";
  var r = p.run, o = ddSeqLast.o, era = ddEraFor(r.startYear);
  ddSeqHover = r;
  return "<b>Retiring in " + ddSeqLabel(r, ddSeqLast.H.monthly) + "</b>" +
    "<br>First " + r.dec1.years + " years <span class='n'>" + ddPct1(r.dec1.port) + "/yr</span>" +
    "<br>All " + o.years + " years <span class='n'>" + ddPct1(r.full.port) + "/yr</span>" +
    "<br>" + (r.depleted ? "<span class='neg'>" + ddOutcomeText(r) + "</span>" : "Left <span class='n'>" + money(r.endReal) + "</span>") +
    (era ? "<br><span class='ddtip-era'>" + era.title + "</span>" : "") +
    "<br><span class='ddtip-era'>Tap to see it year by year</span>";
});
$("chartWrapDDQ").addEventListener("click", function () {
  if (!ddSeqHover) return;
  ddSelStart = ddSeqHover.startIdx;
  ddView = "year";
  renderDrawdown();
});
$("segDDSeq").addEventListener("click", function (e) {
  var b = e.target.closest ? e.target.closest("button[data-ddseq]") : null;
  if (!b || !ddSeqLast) return;
  ddSeqKind = b.getAttribute("data-ddseq");
  ddPaintSeq(ddSeqLast.o, ddSeqLast.H);
});

/* Why the start picked went as it did: its first years, what they left,
   and the era it fell in. */
function ddWhyText(o, r, H){
  var d = r.dec1, n = d.years;
  if (!n || !r.rows.length) return "";
  var ps = H.runs.map(function (x) { return x.dec1.port; }).sort(function (a, b) { return a - b; });
  var med = ps[Math.floor(ps.length / 2)];
  var below = ps.filter(function (v) { return v < d.port - 1e-12; }).length / ps.length;
  var ends = H.runs.map(function (x) { return x.endReal; }).sort(function (a, b) { return a - b; });
  var endRank = ends.filter(function (v) { return v < r.endReal - 1e-6; }).length / ends.length;
  var lead = r.depleted ? "Why it ran out" : endRank < .2 ? "Why it was hard" : endRank >= .8 ? "Why it went well" : "How it went";
  var start = r.rows[0].start, row = r.rows[n - 1], left = start > 0 ? row.realEnd / start : 0;
  var nx = r.rows[n];
  var rate = nx && row.realEnd > 0 ? nx.realWithdrawal / row.realEnd : null;
  var where = below < .1 ? "among the worst on record" : below < .33 ? "weaker than most" : below >= .9 ? "among the best on record" :
    below >= .67 ? "stronger than most" : "about typical";
  var txt = "<b>" + lead + ":</b> its first " + n + " years returned " + ddPct1(d.port) + " a year after inflation at your mix " +
    "(stocks " + ddPct1(d.stock) + ", bonds " + ddPct1(d.bond) + ", with inflation at " + pctStr(d.infl, 1) + " a year), " + where +
    "; the typical start's returned " + ddPct1(med) + ". ";
  if (n < o.years)
    txt += "Withdrawing through them left " + pctStr(left, 0) + " of the starting balance, after inflation" +
      (rate != null ? ", so year " + (n + 1) + "'s withdrawal was " + pctStr(rate, 1) + " of what was left" : "") + ". ";
  if (r.depleted)
    txt += below < .5 ? "Too little was left for the years after to rebuild: it ran out " + (ddRetireAge != null ? "at age " + ddAgeVal(r.depletedYear) : "in year " + r.depletedYear) + ". "
      : "The damage came later: it ran out " + (ddRetireAge != null ? "at age " + ddAgeVal(r.depletedYear) : "in year " + r.depletedYear) + ". ";
  var era = ddEraFor(r.startYear);
  if (era) txt += "<i>" + era.title + ".</i> " + era.note;
  return "<span class='ddwhy'>" + txt + "</span>";
}
