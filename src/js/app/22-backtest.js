/* ---------- portfolio backtest ---------- */
const BT_DEFAULTS = {stock:80, sv:0, cash:0, rebal:"year", rebalN:3, rebalBand:5, from:1926, to:2025};
function readBTState(){
  return {stock:num("btStock"), sv:num("btSV"), cash:num("btCash"), rebal:$("btRebal").value,
    rebalN:num("btRebalN"), rebalBand:num("btRebalBand"), from:num("btFrom"), to:num("btTo")};
}
/* A mix saved before small value and cash were offered is stocks and bonds. */
function writeBTState(d){
  if (d.stock != null) {
    $("btStock").value = String(d.stock);
    $("btSV").value = String(d.sv || 0);
    $("btCash").value = String(d.cash || 0);
    // and rebalanced every year
    $("btRebal").value = d.rebal || "year";
    $("btRebalN").value = String(d.rebalN || 3);
    $("btRebalBand").value = String(d.rebalBand != null ? d.rebalBand : 5);
  }
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
    case "sv": return r.sv;
    case "cash": return r.cash;
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
  const B = backtest({stockPct: st.stock, svPct: st.sv, cashPct: st.cash, rebal: st.rebal, rebalN: st.rebalN,
    rebalBand: st.rebalBand, fee: 0, initial: 10000, startYear: from, endYear: to});
  btRun = B;
  btFirstYear = B.first;

  const parts = [[B.stockPct, "S&P 500"], [B.svPct, "small-cap value"], [B.bondPct, "10-year Treasuries"],
    [B.cashPct, "cash (one-month Treasury bills)"]].filter(p => p[0] > 0);
  $("btMixText").textContent = btMixText(B);
  const rbText = ddRebalText({rebal: B.rebal, rebalN: Math.max(1, Math.round(st.rebalN || 1)), rebalBand: st.rebalBand});
  $("btRebalShow").textContent = rbText;
  $("btRebalNWrap").hidden = B.rebal !== "every";
  $("btRebalBandWrap").hidden = B.rebal !== "band";
  const one = parts.length < 2, em = B.endMix, names = ["stocks", "small value", "bonds", "cash"];
  const drift = em.map((x, j) => Math.round(x * 100) + "% " + names[j]).filter((t, j) => [B.stockPct, B.svPct, B.bondPct, B.cashPct][j] > 0).join(", ");
  $("btRebalNote").textContent = one ? "With one asset there's nothing to rebalance."
    : B.rebal === "year" ? ""
    : (B.rebal === "never" ? "The mix drifts with markets." : B.rebal === "every" ? "Between rebalances the mix drifts with markets." :
      "Checked at the start of each year: rebalanced " + B.rebalances + (B.rebalances === 1 ? " time." : " times.")) +
      " By the end of " + B.last + " it stood at " + drift + ".";
  $("btMixNote").textContent = (parts.length ? parts.map(p => ddN(p[0]) + "% " + p[1]).join(", ") : "Nothing invested") +
    (B.rebal === "never" ? ", never rebalanced." : ", rebalanced " + rbText.charAt(0).toLowerCase() + rbText.slice(1) + ".") + (B.minYear > HIST_START && from < B.minYear
      ? " Small value and cash begin in July 1926, so this starts in " + B.minYear + "." : "");
  $("segBTMix").querySelectorAll("button").forEach(x =>
    x.classList.toggle("on", !B.svPct && !B.cashPct && parseFloat(x.getAttribute("data-mix")) === B.stockPct));
  $("btSVHead").hidden = !(B.svPct > 0);
  $("btCashHead").hidden = !(B.cashPct > 0);
  const lastYr = HIST_START + HIST_STOCK.length - 1;
  $("segBTEra").querySelectorAll("button").forEach(x => {
    const era = x.getAttribute("data-era");
    const wantFrom = era === "all" ? B.minYear : lastYr - parseInt(era, 10) + 1;
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
    r.stock.toFixed(2) + "%</td>" +
    (B.svPct > 0 ? "<td class='" + (r.sv < 0 ? "neg" : "pos") + "'>" + r.sv.toFixed(2) + "%</td>" : "") +
    "<td class='" + (r.bond < 0 ? "neg" : "pos") + "'>" + r.bond.toFixed(2) + "%</td>" +
    (B.cashPct > 0 ? "<td class='" + (r.cash < 0 ? "neg" : "pos") + "'>" + r.cash.toFixed(2) + "%</td>" : "") +
    "<td class='" + (r.ret < 0 ? "neg" : "pos") + "'>" +
    pctStr(r.ret, 2) + "</td><td>" + pctStr(r.infl, 2) + "</td><td class='" +
    (r.real < 0 ? "neg" : "pos") + "'>" + pctStr(r.real, 2) + "</td><td>" +
    money(r.end) + "</td><td>" + money(r.endReal) + "</td></tr>").join("");
  $("btTable").querySelectorAll("th.sortcol").forEach(function (th){
    th.classList.remove("sort-asc", "sort-desc");
    if (th.getAttribute("data-sort") === btSortCol)
      th.classList.add(btSortDir === "asc" ? "sort-asc" : "sort-desc");
  });
}

["btFrom","btTo","btRebalN","btRebalBand"].forEach(id =>
  $(id).addEventListener("input", renderBacktest));
$("btRebal").addEventListener("change", renderBacktest);

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
  $("btSV").value = "0"; $("btCash").value = "0";
  renderBacktest();
});
/* The mix on its button: each holding with a share. */
function btMixText(B){
  const t = [[B.stockPct, "US stocks"], [B.svPct, "small value"], [B.bondPct, "bonds"], [B.cashPct, "cash"]]
    .filter(p => p[0] > 0).map(p => ddN(p[0]) + "% " + p[1]).join(", ");
  return t || "Nothing invested";
}
/* The mix pop-up: the same four holdings as the Drawdown Simulator's,
   adding up to 100%. */
function btMixForm(){
  const st = readBTState(), bond = Math.max(0, 100 - st.stock - st.sv - st.cash);
  const val = {stock: st.stock, sv: st.sv, bond: bond, cash: st.cash};
  const ov = document.createElement("div");
  ov.className = "popup-overlay";
  ov.innerHTML = "<div class='popup wide ddmixpop'><h3>Asset mix</h3>" +
    "<div class='formhint'>How the portfolio is split at the start, and what each rebalance returns it to. Each holding earns its actual returns; small value and cash start in July 1926, so a mix with either starts in 1927.</div>" +
    DD_ASSETS.map(a => "<div class='ddmixrow'><div><b>" + a[2] + "</b><small>" + a[3] + "</small></div>" +
      "<div class='inputwrap'><input type='text' inputmode='decimal' data-num data-step='5' min='0' max='100' data-nonneg data-mix='" + a[0] +
      "' value='" + ddN(val[a[0]]) + "' aria-label='" + a[2] + "'><span class='affix'>%</span></div></div>").join("") +
    "<div class='ddmixtot' id='btMixTot'></div>" +
    "<div class='formactions'><button type='button' class='btn' data-mixcancel>Cancel</button>" +
    "<button type='button' class='btn primary' data-mixok>Use this mix</button></div></div>";
  document.body.appendChild(ov);
  initFields(ov);
  const vals = () => { const r = {}; ov.querySelectorAll("[data-mix]").forEach(el => { r[el.getAttribute("data-mix")] = parseNum(el.value) || 0; }); return r; };
  const check = () => {
    const v = vals(), t = v.stock + v.sv + v.bond + v.cash, good = Math.abs(t - 100) < .01;
    $("btMixTot").innerHTML = "Total: <b class='" + (good ? "pos" : "neg") + "'>" + ddN(t) + "%</b>" +
      (good ? "" : " — it needs to add up to 100%");
    ov.querySelector("[data-mixok]").disabled = !good;
    return good;
  };
  ov.addEventListener("input", check);
  check();
  const shut = () => { if (ov._modalDone) ov._modalDone(); ov.remove(); };
  ov.addEventListener("click", e => {
    if (e.target === ov || (e.target.closest && e.target.closest("[data-mixcancel]"))) { shut(); return; }
    if (e.target.closest && e.target.closest("[data-mixok]") && check()) {
      const v = vals();
      $("btStock").value = String(v.stock); $("btSV").value = String(v.sv); $("btCash").value = String(v.cash);
      shut();
      renderBacktest();
    }
  });
  wireModal(ov, shut);
  const first = ov.querySelector("[data-mix]");
  if (first) first.focus();
}
$("btMixBtn").addEventListener("click", btMixForm);
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

