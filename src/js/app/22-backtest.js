/* ---------- portfolio backtest ---------- */
const BT_DEFAULTS = {stock:80, from:1926, to:2025};
function readBTState(){
  return {stock:num("btStock"), from:num("btFrom"), to:num("btTo")};
}
function writeBTState(d){
  if (d.stock != null) $("btStock").value = String(d.stock);
  if (d.from != null) $("btFrom").value = String(d.from);
  if (d.to != null) $("btTo").value = String(d.to);
}
let btRoll = "nom";
let btPoints = null;
let btInflPoints = null;
let btFirstYear = HIST_START;
let btRun = null;
/* Year-by-year table sort. Defaults to year ascending, which is the natural
   chronological order the table already showed. */
let btSortCol = "year";
let btSortDir = "asc";
function btSortValue(r, col){
  switch (col){
    case "year": return r.year;
    case "stock": return r.stock;
    case "bond": return r.bond;
    case "ret": return r.ret;
    case "infl": return r.infl;
    case "real": return r.real;
    case "end": return r.end;
    case "endReal": return r.endReal;
  }
  return 0;
}

function renderBacktest(){
  const st = readBTState();
  const lo = HIST_START, hi = HIST_START + HIST_STOCK.length - 1;
  const from = Math.max(lo, Math.min(hi, Math.round(st.from || lo)));
  const to = Math.max(from, Math.min(hi, Math.round(st.to || hi)));
  const B = backtest({stockPct: st.stock, fee: 0, initial: 10000, startYear: from, endYear: to});
  btRun = B;
  btFirstYear = B.first;

  const bondPct = 100 - B.stockPct;
  $("btMixNote").textContent = fmtNum(B.stockPct) + "% S&P 500, " + fmtNum(bondPct) +
    "% 10-year Treasuries, rebalanced every year.";
  $("segBTMix").querySelectorAll("button").forEach(x =>
    x.classList.toggle("on", parseFloat(x.getAttribute("data-mix")) === B.stockPct));
  const lastYr = HIST_START + HIST_STOCK.length - 1;
  $("segBTEra").querySelectorAll("button").forEach(x => {
    const era = x.getAttribute("data-era");
    const wantFrom = era === "all" ? HIST_START : lastYr - parseInt(era, 10) + 1;
    x.classList.toggle("on", B.first === wantFrom && B.last === lastYr);
  });
  $("btYears").textContent = B.years + (B.years === 1 ? " yr" : " yrs");

  $("btInflSpan").textContent = B.first + "\u2013" + B.last;
  $("btInfl").textContent = pctStr(B.inflCagr, 2);
  $("btInflHigh").textContent = pctStr(B.inflHigh.infl, 2) + " in " + B.inflHigh.year;
  $("btInflLow").textContent = pctStr(B.inflLow.infl, 2) + " in " + B.inflLow.year;
  $("btDefl").textContent = B.deflationYears + " of " + B.years;
  $("btPriceLevel").textContent = B.priceLevel.toFixed(1) + "\u00d7";
  $("btPriceNow").textContent = money(100 * B.priceLevel) + " today";

  setBig("btCagr", pctStr(B.cagr, 2));
  $("btCagrNote").textContent = "Compound annual growth, " + B.first + "\u2013" + B.last;
  setBig("btReal", pctStr(B.realCagr, 2));
  $("btRealNote").textContent = "Inflation averaged " + pctStr(B.inflCagr, 2) + " a year";
  setBig("btVol", pctStr(B.vol, 2));

  $("btBest").textContent = pctStr(B.best.ret, 2) + " in " + B.best.year;
  $("btWorst").textContent = pctStr(B.worst.ret, 2) + " in " + B.worst.year;
  $("btDD").textContent = B.maxDD < 0
    ? pctStr(B.maxDD, 2) + " (" + B.ddFrom + "\u2013" + B.ddTo + ")" : "None";
  $("btUp").textContent = B.upYears + " of " + B.years + " (" +
    Math.round(B.upYears / B.years * 100) + "%)";
  $("btEnd").textContent = money(B.endBal);
  $("btEndReal").textContent = money(B.endReal);
  $("btUseNote").textContent = "Sends " + pctStr(B.cagr, 2) + " return, " +
    pctStr(B.vol, 2) + " volatility and " + pctStr(B.inflCagr, 2) +
    " inflation to the Advanced tab, so the nominal figure and the inflation it " +
    "was earned alongside travel together.";

  const nom = [{year:0, value:B.start}].concat(
    B.rows.map((r, i) => ({year:i + 1, value:r.end})));
  const real = [{year:0, value:B.start}].concat(
    B.rows.map((r, i) => ({year:i + 1, value:r.endReal})));
  btPoints = paintMulti("chartBT",
    [{name:"Balance", color:"#e9b872", pts:nom},
     {name:"In today's dollars", color:"#7d9fd6", pts:real, dash:"5 4", width:2}],
    B.years, {xFmt: y => String(B.first + y)});
  $("legendBT").innerHTML = swatch("#e9b872", "Balance") +
    swatch("#7d9fd6", "In today's dollars");

  /* Annual CPI, with a trailing ten-year average over it: single years are noise,
     sustained stretches are what actually reprice a plan. */
  const annual = B.rows.map((r, i) => ({year:i + 1, value:r.infl}));
  const decade = [];
  for (let i = 9; i < B.rows.length; i++){
    let g = 1;
    for (let k = i - 9; k <= i; k++) g *= (1 + B.rows[k].infl);
    decade.push({year:i + 1, value: Math.pow(g, 1 / 10) - 1});
  }
  btInflPoints = paintMulti("chartBTI",
    [{name:"Annual", color:"#e2795f", pts:annual, width:1.9},
     {name:"Ten-year average", color:"#7d9fd6", pts:decade, dash:"5 4", width:2.2}],
    B.years, {xFmt: y => String(B.first + y),
              yFmt: v => (v * 100).toFixed(0) + "%"});
  $("legendBTI").innerHTML = swatch("#e2795f", "Annual") +
    swatch("#7d9fd6", "Ten-year average") ;

  $("btRollNote").textContent = btRoll === "nom" ? "nominal" : "after inflation";
  $("btRollTable").querySelector("tbody").innerHTML = B.rolling.map(r => {
    const w = btRoll === "nom"
      ? {worst:r.nomWorst, med:r.nomMed, best:r.nomBest, pos:r.nomPos}
      : {worst:r.realWorst, med:r.realMed, best:r.realBest, pos:r.realPos};
    return "<tr><td>" + r.len + (r.len === 1 ? " year" : " years") + "</td><td>" +
      r.count + "</td><td class='" + (w.worst < 0 ? "neg" : "") + "'>" +
      pctStr(w.worst, 2) + "</td><td>" + pctStr(w.med, 2) + "</td><td class='pos'>" +
      pctStr(w.best, 2) + "</td><td>" + Math.round(w.pos * 100) + "%</td></tr>";
  }).join("");

  var btSorted = B.rows.slice().sort(function (a, b){
    var cmp = btSortValue(a, btSortCol) - btSortValue(b, btSortCol);
    return btSortDir === "asc" ? cmp : -cmp;
  });
  $("btTable").querySelector("tbody").innerHTML = btSorted.map(r =>
    "<tr><td>" + r.year + "</td><td class='" + (r.stock < 0 ? "neg" : "pos") + "'>" +
    r.stock.toFixed(2) + "%</td><td class='" + (r.bond < 0 ? "neg" : "pos") + "'>" +
    r.bond.toFixed(2) + "%</td><td class='" + (r.ret < 0 ? "neg" : "pos") + "'>" +
    pctStr(r.ret, 2) + "</td><td>" + pctStr(r.infl, 2) + "</td><td class='" +
    (r.real < 0 ? "neg" : "pos") + "'>" + pctStr(r.real, 2) + "</td><td>" +
    money(r.end) + "</td><td>" + money(r.endReal) + "</td></tr>").join("");
  $("btTable").querySelectorAll("th.sortcol").forEach(function (th){
    th.classList.remove("sort-asc", "sort-desc");
    if (th.getAttribute("data-sort") === btSortCol)
      th.classList.add(btSortDir === "asc" ? "sort-asc" : "sort-desc");
  });
}

["btStock","btFrom","btTo"].forEach(id =>
  $(id).addEventListener("input", renderBacktest));

/* Click a column header to sort the year-by-year table; a new column starts
   high-to-low, clicking the active one again flips the direction. Mirrors the
   drawdown "how each starting year fared" table. */
$("btTable").addEventListener("click", function (e){
  var th = e.target.closest ? e.target.closest("th.sortcol") : null;
  if (!th) return;
  var col = th.getAttribute("data-sort");
  if (btSortCol === col) btSortDir = btSortDir === "asc" ? "desc" : "asc";
  else { btSortCol = col; btSortDir = "desc"; }
  renderBacktest();
});

/* The dataset is the only range these two fields can mean, so they clamp to it.
   The upper bound rides the existing max-attribute machinery, which caps as you
   type. The lower bound has to wait for blur: clamping it on input would turn
   "1" into 1926 before you finished typing the year. Bounds are read from the
   data rather than hardcoded, so extending the dataset moves them by itself. */
(function(){
  const lo = HIST_START, hi = HIST_START + HIST_STOCK.length - 1;
  ["btFrom","btTo"].forEach(id => {
    const el = $(id);
    el.setAttribute("min", String(lo));
    el.setAttribute("max", String(hi));
    el.addEventListener("blur", () => {
      const raw = Math.round(parseNum(el.value));
      const fixed = (!isFinite(raw) || !raw)
        ? (id === "btFrom" ? lo : hi)
        : Math.max(lo, Math.min(hi, raw));
      if (String(fixed) !== el.value){
        el.value = String(fixed);
        renderBacktest();
      }
    });
  });
})();
$("segBTMix").addEventListener("click", e => {
  const b = e.target.closest ? e.target.closest("button[data-mix]") : null;
  if (!b) return;
  $("btStock").value = b.getAttribute("data-mix");
  renderBacktest();
});
$("segBTEra").addEventListener("click", e => {
  const b = e.target.closest ? e.target.closest("button[data-era]") : null;
  if (!b) return;
  const era = b.getAttribute("data-era");
  const last = HIST_START + HIST_STOCK.length - 1;
  $("btFrom").value = String(era === "all" ? HIST_START : last - parseInt(era, 10) + 1);
  $("btTo").value = String(last);
  $("segBTEra").querySelectorAll("button").forEach(x =>
    x.classList.toggle("on", x === b));
  renderBacktest();
});
$("segBTRoll").addEventListener("click", e => {
  const b = e.target.closest ? e.target.closest("button[data-roll]") : null;
  if (!b) return;
  btRoll = b.getAttribute("data-roll");
  $("segBTRoll").querySelectorAll("button").forEach(x =>
    x.classList.toggle("on", x === b));
  renderBacktest();
});
$("btUseRate").addEventListener("click", () => {
  if (!btRun) return;
  $("nominal").value = +(btRun.cagr * 100).toFixed(2);
  $("volatility").value = +(btRun.vol * 100).toFixed(2);
  $("inflation").value = +(btRun.inflCagr * 100).toFixed(2);
  renderAll();
  paneDir = "back";
  showTab("single");
  pushNav();
  toast("Return, volatility and inflation updated");
});
attachChart("chartWrapBTI", "chartBTI", "tipBTI", () => btInflPoints, best => {
  const st = btInflPoints;
  if (!st) return "";
  let out = "<b>" + (btFirstYear + best.year) + "</b>";
  st.names.forEach((nm, i) => {
    if (best.vals[i] == null) return;
    out += "<br><span style='color:" + st.colors[i] + "'>" + nm +
      "</span> <span class='n'>" + pctStr(best.vals[i], 2) + "</span>";
  });
  return out;
});
attachChart("chartWrapBT", "chartBT", "tipBT", () => btPoints, best => {
  const st = btPoints;
  if (!st) return "";
  let out = "<b>" + (btFirstYear + best.year) + "</b>";
  st.names.forEach((nm, i) => {
    if (best.vals[i] == null) return;
    out += "<br><span style='color:" + st.colors[i] + "'>" + nm +
      "</span> <span class='n'>" + money(best.vals[i]) + "</span>";
  });
  return out;
});

