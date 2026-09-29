/* ---------- income tax tool ---------- */
const TAX_COLORS = {fed:"#e2795f", state:"#e9b872", fica:"#7d9fd6", net:"#4fbf95"};
$("txState").innerHTML = Object.keys(STATES)
  .sort((a,b) => STATES[a].n.localeCompare(STATES[b].n))
  .map(k => "<option value='" + k + "'>" + STATES[k].n + "</option>").join("");

$("rcState").innerHTML = $("txState").innerHTML;
$("brState").innerHTML = $("txState").innerHTML;
{ const o = $("brState").querySelector("option[value='IL']");
  if (o){ o.defaultSelected = true; $("brState").value = "IL"; } }
acFillStates();

let txMode = "normal";
const BKT_COLORS = {trad:"#e2795f", roth:"#4fbf95", brok:"#7d9fd6",
                    ss:"#e9b872", pension:"#c98fb8", other:"#a98fd6"};
const LTCG_COLORS = ["#4fbf95", "#e9b872", "#e2795f"];   // 0%, 15%, 20%

let txActiveParts = [], txPieDefaultLabel = "All taxes", txPieDefaultVal = "";
let _txDeactivateTimer = null;

(function(){
  function txActivate(idx){
    clearTimeout(_txDeactivateTimer);
    $("txPie").querySelectorAll("circle[data-idx]").forEach(function(c){
      c.style.opacity = +c.dataset.idx === idx ? "" : "0.18";
    });
    $("txBars").querySelectorAll(".bar[data-idx]").forEach(function(b){
      b.style.opacity = +b.dataset.idx === idx ? "" : "0.25";
    });
    var pt = txActiveParts[idx];
    var lbl = $("txPieLbl"), val = $("txPieVal");
    if (pt && lbl && val){ lbl.textContent = pt.label || ""; val.textContent = money(pt.v); }
  }
  function txDeactivate(){
    _txDeactivateTimer = setTimeout(function(){
      $("txPie").querySelectorAll("circle[data-idx]").forEach(function(c){ c.style.opacity = ""; });
      $("txBars").querySelectorAll(".bar[data-idx]").forEach(function(b){ b.style.opacity = ""; });
      var lbl = $("txPieLbl"), val = $("txPieVal");
      if (lbl) lbl.textContent = txPieDefaultLabel;
      if (val) val.textContent = txPieDefaultVal;
    }, 60);
  }
  var pie = $("txPie");
  pie.addEventListener("mouseover", function(e){
    var c = e.target.closest ? e.target.closest("circle[data-idx]") : null;
    if (c) txActivate(+c.dataset.idx); else txDeactivate();
  });
  pie.addEventListener("mouseleave", txDeactivate);
  var barsEl = $("txBars");
  barsEl.addEventListener("mouseover", function(e){
    var b = e.target.closest ? e.target.closest(".bar[data-idx]") : null;
    if (b) txActivate(+b.dataset.idx);
  });
  barsEl.addEventListener("mouseleave", txDeactivate);
})();

function readTax(){
  const status = $("txStatus").value;
  const seniors = Math.min(status === "m" ? 2 : 1, parseInt($("txSeniors").value, 10) || 0);
  const trad = num("txTrad"), roth = num("txRoth"), brok = num("txBrok"),
        ss = num("txSS"), pension = num("txPension"), other = num("txOther");
  // Spouse's income only exists as a separate concept in Normal Income mode,
  // where FICA's per-earner wage cap makes the split matter. Retirement mode
  // has no FICA, so its withdrawals stay combined into one household total.
  const gross2 = (txMode === "normal" && status === "m") ? num("txGross2") : 0;
  return {mode:txMode,
          gross: txMode === "retire"
            ? trad + roth + brok + ss + pension + other : num("txGross"),
          gross2,
          trad, roth, brok, ss, pension, other,
          penPublic: $("txPenType").value === "pub",
          gainPct:num("txGainPct") / 100, seniors,
          status, state:$("txState").value,
          pre:num("txPre"), dedType:$("txDedType").value, item:num("txItem")};
}
/* One entry point, so everything downstream — the summary sheet, the share
   card, the budget's "copy from tax" button — keeps working without caring
   which mode the tool is in. Both branches return the same core keys. */
function runTax(inp){
  return inp.mode === "retire" ? computeRetireTax(inp) : computeTax(inp);
}
function bar(label, value, share, color, idx){
  return "<div class='bar'" + (idx !== undefined ? " data-idx='" + idx + "'" : "") +
    "><div class='lbl'><span>" + label + "</span><b>" +
    money(value) + "</b></div><div class='track'><div class='fill' style='width:" +
    (Math.max(0, Math.min(1, share)) * 100).toFixed(1) + "%;background:" + color +
    "'></div></div></div>";
}
function donut(parts){
  const R = 100, C = 110, sw = 30, circ = 2 * Math.PI * (R - sw / 2);
  const tot = parts.reduce((a, x) => a + x.v, 0) || 1;
  let off = 0, out = "";
  parts.forEach((pt, i) => {
    const frac = pt.v / tot;
    if (frac <= 0) return;
    out += "<circle cx='" + C + "' cy='" + C + "' r='" + (R - sw / 2) +
      "' fill='none' stroke='" + pt.c + "' stroke-width='" + sw +
      "' stroke-dasharray='" + (frac * circ).toFixed(2) + " " + circ.toFixed(2) +
      "' stroke-dashoffset='" + (-off * circ).toFixed(2) +
      "' transform='rotate(-90 " + C + " " + C + ")'" +
      " data-idx='" + i + "' style='transition:opacity .15s;cursor:pointer'></circle>";
    off += frac;
  });
  return out;
}
/* One bar per income source. The track length is that bucket's withdrawal set
   against the largest bucket, so you can see the relative size of each pot;
   the filled part is the share of it that went to tax. */
function bucketBar(b, maxAmt, color){
  const trackPct = maxAmt > 0 ? (b.withdrawn / maxAmt) * 100 : 0;
  const fillPct = b.withdrawn > 0 ? (b.tax / b.withdrawn) * 100 : 0;
  return "<div class='bar'><div class='lbl'><span>" + b.label + "</span><b>" +
    money(b.withdrawn) + (b.withdrawn > 0
      ? " \u00b7 " + money(b.tax) + " tax (" + pctStr(b.eff, 1) + ")" : "") +
    "</b></div><div class='track' style='width:" + Math.max(trackPct, 1.5).toFixed(1) +
    "%'><div class='fill' style='width:" + Math.min(100, fillPct).toFixed(1) +
    "%;background:" + color + "'></div></div></div>";
}

/* The stacking chart. Ordinary taxable income fills the ordinary brackets
   first and then acts as the floor for the gain, so where the gain lands
   depends entirely on how much ordinary income sits underneath it. Drawing
   both on one axis against the 0/15/20% breakpoints is the whole point. */
function txStackChart(R){
  const W = 720, H = 150, padL = 6, padR = 6, iw = W - padL - padR;
  const c0 = R.ltcgCut[0], c15 = R.ltcgCut[1];
  const lo = R.ordTaxable, hi = lo + R.gainTaxable;
  let max = Math.max(hi * 1.12, c0 * 1.14, 1);
  if (hi > c15) max = hi * 1.06;
  const x = v => padL + Math.max(0, Math.min(1, v / max)) * iw;
  const dim = cssVar("--dim"), dimmer = cssVar("--dimmer"),
        text = cssVar("--text"), sans = cssVar("--sans"), mono = cssVar("--mono");
  const barY = 44, barH = 40;
  let s = "";

  // faint zones behind the bar, so the bands read as territory
  const zone = (a, b, fill) => {
    if (b <= a) return "";
    return "<rect x='" + x(a).toFixed(1) + "' y='" + barY + "' width='" +
      (x(b) - x(a)).toFixed(1) + "' height='" + barH + "' fill='" + fill + "'/>";
  };
  s += zone(0, Math.min(max, c0), "rgba(79,191,149,.09)");
  s += zone(Math.min(max, c0), Math.min(max, c15), "rgba(233,184,114,.09)");
  s += zone(Math.min(max, c15), max, "rgba(226,121,95,.09)");

  // ordinary income floor
  if (lo > 0)
    s += "<rect x='" + x(0).toFixed(1) + "' y='" + barY + "' width='" +
      (x(lo) - x(0)).toFixed(1) + "' height='" + barH +
      "' fill='#8ba0ac' opacity='.85' rx='2'/>";

  // the gain, segment by segment
  let cur = lo;
  R.ltcgBands.forEach((b, i) => {
    if (!(b.amount > 0)) return;
    s += "<rect x='" + x(cur).toFixed(1) + "' y='" + barY + "' width='" +
      Math.max(1, x(cur + b.amount) - x(cur)).toFixed(1) + "' height='" + barH +
      "' fill='" + LTCG_COLORS[i] + "' rx='2'/>";
    cur += b.amount;
  });

  // breakpoint markers
  const mark = (v, label) => {
    if (v >= max) return "";
    const px = x(v);
    return "<line x1='" + px.toFixed(1) + "' y1='" + (barY - 12) + "' x2='" +
      px.toFixed(1) + "' y2='" + (barY + barH + 8) +
      "' stroke='" + dim + "' stroke-width='1' stroke-dasharray='3 3'/>" +
      "<text x='" + Math.min(px + 6, W - 130).toFixed(1) + "' y='" + (barY - 18) +
      "' font-size='11.5' fill='" + dim + "' font-family='" + sans + "'>" + label +
      " <tspan font-family='" + mono + "' fill='" + text + "'>" + money(v) + "</tspan></text>";
  };
  s += mark(c0, "0% ends at");
  s += mark(c15, "20% starts at");

  // The two edges of the stack, called out underneath. Both have to stay
  // inside the viewBox and off each other: near the right edge the label flips
  // to end-anchored, and when the two edges are close the second one drops to
  // its own row rather than colliding.
  const xLo = x(lo), xHi = x(hi);
  const row1 = barY + barH + 26, row2 = barY + barH + 44;
  const foot = (px, label, anchor, y) =>
    "<text x='" + Math.max(3, Math.min(px, W - 3)).toFixed(1) + "' y='" + y +
    "' font-size='11.5' text-anchor='" + anchor + "' fill='" + dimmer +
    "' font-family='" + sans + "'>" + label + "</text>";
  const est = txt => txt.length * 6.0;          // rough width at 11.5px
  if (lo > 0 && hi > lo){
    const lbl1 = "ordinary income ends " + money(lo);
    const lbl2 = "gain ends " + money(hi);
    const a2 = xHi + est(lbl2) > W - 4 ? "end" : "start";
    const left2 = a2 === "end" ? xHi - est(lbl2) : xHi;
    const collides = left2 < xLo + 6;
    s += foot(xLo, lbl1, xLo - est(lbl1) < 4 ? "start" : "end", row1);
    s += foot(xHi, lbl2, a2, collides ? row2 : row1);
  } else if (lo > 0){
    s += foot(xLo, "ordinary income ends " + money(lo), "middle", row1);
  } else if (hi > 0){
    const lbl = "gain ends " + money(hi);
    s += foot(xHi, lbl, xHi + est(lbl) > W - 4 ? "end" : "start", row1);
  }

  return s;
}

function renderTax(){
  const inp = readTax();
  const ret = inp.mode === "retire";
  $("txItemWrap").hidden = inp.dedType !== "item";
  const R = runTax(inp);
  return ret ? renderRetireTax(inp, R) : renderNormalTax(inp, R);
}

function renderNormalTax(inp, R){
  $("txStdLabel").textContent = "Standard deduction";
  $("txStdShow").textContent = money(FED_STD[inp.status]);
  $("txSSRow").hidden = true;
  $("txTaxable").textContent = money(R.fedTaxable);
  $("txMarginal").textContent = pctStr(R.marginal, 0);
  if (!$("txGrossTotalWrap").hidden) $("txGrossTotalShow").textContent = money(R.gross);

  // Net pay = gross minus taxes; take-home also subtracts pre-tax savings, which
  // is money you keep but never see in the paycheck.
  const netPay = R.gross - R.total;
  const shown = txView === "take" ? R.net : netPay;
  $("txNetLabel").textContent = txView === "take" ? "Take-home pay" : "Net pay";
  $("txNetNote").textContent = R.gross > 0
    ? (txView === "take"
        ? pctStr(R.gross ? R.net / R.gross : 0, 1) + " of gross, after pre-tax savings"
        : pctStr(R.gross ? netPay / R.gross : 0, 1) + " of gross, after taxes")
    : "Enter your income to begin";
  $("txMonthNote").textContent = txView === "take"
    ? "In your paycheck, after pre-tax savings" : "After all taxes";
  $("txThirdLabel").textContent = "Every two weeks";
  $("txThirdNote").textContent = "26 paychecks a year";
  setBig("txNet", money(shown));
  setBig("txMonth", money(shown / 12));
  setBig("txBiweek", money(shown / 26));
  $("txZeroRoomRow").hidden = true;
  if (R.gross > 0){
    const br = bracketRoom(R.fedTaxable, inp.status);
    $("txRoomLabel").textContent = br ? "Room before " + pctStr(br.nextRate, 0) : "Room before next bracket";
    $("txRoomShow").textContent = br ? money(br.room) : "Top bracket";
  } else {
    $("txRoomLabel").textContent = "Room before next bracket";
    $("txRoomShow").textContent = "\u2014";
  }

  $("txBars").innerHTML =
    bar("Take-home pay", R.net, R.effNet, TAX_COLORS.net, 0) +
    bar("Federal income tax", R.federal, R.effFed, TAX_COLORS.fed, 1) +
    bar("State income tax" + (R.stateNone ? " (none)" : ""), R.state, R.effState, TAX_COLORS.state, 2) +
    bar("FICA (Social Security + Medicare)", R.fica, R.effFica, TAX_COLORS.fica, 3) +
    (R.pre > 0 ? bar("Pre-tax savings", R.pre, R.gross ? R.pre / R.gross : 0, "#8ba0ac", 4) : "");

  const parts = [{v:R.net, c:TAX_COLORS.net, label:"Take-home pay"},
                 {v:R.federal, c:TAX_COLORS.fed, label:"Federal tax"},
                 {v:R.state, c:TAX_COLORS.state, label:"State tax"},
                 {v:R.fica, c:TAX_COLORS.fica, label:"FICA"}];
  if (R.pre > 0) parts.push({v:R.pre, c:"#8ba0ac", label:"Pre-tax savings"});
  txDonut(R, parts);

  // The Social Security wage cap applies per earner, so a joint return splits
  // the line in two rather than showing one household figure that would imply
  // a single shared cap.
  const ssRows = inp.status === "m"
    ? txRow("Your Social Security", R.ss1, R.gross ? R.ss1 / R.gross : 0, TAX_COLORS.fica) +
      txRow("Spouse's Social Security", R.ss2, R.gross ? R.ss2 / R.gross : 0, TAX_COLORS.fica)
    : txRow("Social Security", R.ss, R.gross ? R.ss / R.gross : 0, TAX_COLORS.fica);
  $("txTable").querySelector("tbody").innerHTML =
    txRow("Federal income tax", R.federal, R.effFed, TAX_COLORS.fed) +
    txRow("State income tax" + (R.stateName ? " \u00b7 " + R.stateName : ""), R.state, R.effState, TAX_COLORS.state) +
    ssRows +
    txRow("Medicare" + (R.addl > 0 ? " (incl. surtax)" : ""), R.med + R.addl,
         R.gross ? (R.med + R.addl) / R.gross : 0, TAX_COLORS.fica) +
    "<tr style='font-weight:600'><td>All taxes</td><td>" + money(R.total) + "</td><td>" +
      pctStr(R.effTotal, 2) + "</td><td></td></tr>" +
    "<tr><td>Take-home pay</td><td>" + money(R.net) + "</td><td>" +
      pctStr(R.effNet, 2) + "</td><td></td></tr>" +
    (R.pre > 0 ? "<tr><td>Pre-tax deductions</td><td>" + money(R.pre) + "</td><td>" +
      pctStr(R.gross ? R.pre / R.gross : 0, 2) + "</td><td></td></tr>" : "") +
    "<tr style='font-weight:600;border-top:2px solid var(--line)'><td>Gross pay</td><td>" +
      money(R.gross) + "</td><td>100.00%</td><td></td></tr>";

  txBracketTable(R);
}

function renderRetireTax(inp, R){
  $("txRetGross").textContent = money(R.gross);

  const dedLabel = inp.dedType === "item" ? "Itemized deduction" :
    (R.seniors > 0 ? "Standard deduction, incl. 65+" : "Standard deduction");
  $("txStdLabel").textContent = dedLabel;
  $("txStdShow").textContent = money(R.fedDed);
  $("txSSRow").hidden = !(R.ssGross > 0);
  $("txSSShow").textContent = R.ssGross > 0
    ? money(R.taxableSS) + " (" + pctStr(R.taxableSS / R.ssGross, 0) + ")" : "\u2014";
  $("txTaxable").textContent = money(R.fedTaxable);
  $("txMarginal").textContent = pctStr(R.marginal, 1);

  $("txNetLabel").textContent = "Income after tax";
  $("txNetNote").textContent = R.gross > 0
    ? pctStr(R.effNet, 1) + " of what you withdrew"
    : "Enter your withdrawals to begin";
  $("txMonthNote").textContent = "After all taxes";
  $("txThirdLabel").textContent = "Effective tax rate";
  $("txThirdNote").textContent = R.gross > 0
    ? "Marginal on the next dollar: " + pctStr(R.marginal, 1) : "";
  setBig("txNet", money(R.net));
  setBig("txMonth", money(R.net / 12));
  setBig("txBiweek", pctStr(R.effTotal, 2));
  if (R.gross > 0){
    const br = bracketRoom(R.ordTaxable, inp.status);
    $("txRoomLabel").textContent = br ? "Room before " + pctStr(br.nextRate, 0) : "Room before next bracket";
    $("txRoomShow").textContent = br ? money(br.room) : "Top bracket";
    $("txZeroRoomRow").hidden = false;
    $("txZeroRoomShow").textContent = R.zeroRoom > 0 ? money(R.zeroRoom) : "None left";
  } else {
    $("txRoomLabel").textContent = "Room before next bracket";
    $("txRoomShow").textContent = "\u2014";
    $("txZeroRoomRow").hidden = true;
  }

  $("txBars").innerHTML =
    bar("Income after tax", R.net, R.effNet, TAX_COLORS.net, 0) +
    bar("Federal ordinary income tax", R.fedOrdinary, R.gross ? R.fedOrdinary / R.gross : 0, TAX_COLORS.fed, 1) +
    bar("Federal long-term capital gain tax", R.ltcg, R.gross ? R.ltcg / R.gross : 0, LTCG_COLORS[1], 2) +
    (R.niit > 0 ? bar("Net investment income tax (3.8%)", R.niit, R.gross ? R.niit / R.gross : 0, "#a98fd6", 3) : "") +
    bar("State income tax" + (R.stateNone ? " (none)" : ""), R.state, R.effState, TAX_COLORS.state, 4) +
    (R.pre > 0 ? bar("Pre-tax deductions", R.pre, R.gross ? R.pre / R.gross : 0, "#8ba0ac", 5) : "");

  const parts = [{v:R.net, c:TAX_COLORS.net, label:"Income after tax"},
                 {v:R.fedOrdinary, c:TAX_COLORS.fed, label:"Federal ordinary tax"},
                 {v:R.ltcg, c:LTCG_COLORS[1], label:"Capital gain tax"},
                 {v:R.niit, c:"#a98fd6", label:"Net investment tax"},
                 {v:R.state, c:TAX_COLORS.state, label:"State tax"}];
  if (R.pre > 0) parts.push({v:R.pre, c:"#8ba0ac", label:"Pre-tax deductions"});
  txDonut(R, parts);

  $("txTable").querySelector("tbody").innerHTML =
    txRow("Federal tax on ordinary income", R.fedOrdinary, R.gross ? R.fedOrdinary / R.gross : 0, TAX_COLORS.fed) +
    txRow("Federal tax on long-term gains", R.ltcg, R.gross ? R.ltcg / R.gross : 0, LTCG_COLORS[1]) +
    (R.niit > 0 ? txRow("Net investment income tax", R.niit, R.gross ? R.niit / R.gross : 0, "#a98fd6") : "") +
    txRow("State income tax" + (R.stateName ? " \u00b7 " + R.stateName : ""), R.state, R.effState, TAX_COLORS.state) +
    "<tr style='font-weight:600'><td>All taxes</td><td>" + money(R.total) + "</td><td>" +
      pctStr(R.effTotal, 2) + "</td><td></td></tr>" +
    "<tr><td>Income after tax</td><td>" + money(R.net) + "</td><td>" +
      pctStr(R.effNet, 2) + "</td><td></td></tr>" +
    (R.pre > 0 ? "<tr><td>Pre-tax deductions</td><td>" + money(R.pre) + "</td><td>" +
      pctStr(R.gross ? R.pre / R.gross : 0, 2) + "</td><td></td></tr>" : "") +
    "<tr style='font-weight:600;border-top:2px solid var(--line)'><td>Gross withdrawals</td><td>" +
      money(R.gross) + "</td><td>100.00%</td><td></td></tr>";

  txBracketTable(R);

  // --- per-bucket panel ---
  const keys = ["trad", "roth", "brok", "ss", "pension", "other"];
  const live = R.buckets.map((b, i) => ({b, c:BKT_COLORS[keys[i]]}))
                        .filter(o => o.b.withdrawn > 0);
  const maxAmt = live.reduce((a, o) => Math.max(a, o.b.withdrawn), 0);
  $("txBucketBars").innerHTML = live.length
    ? live.map(o => bucketBar(o.b, maxAmt, o.c)).join("")
    : "<div class='hint'>Enter a withdrawal above to see how it is taxed.</div>";
  $("txBucketTable").querySelector("tbody").innerHTML =
    live.map(o => "<tr><td><span style='color:" + o.c + "'>\u25a0</span> " + o.b.label +
      "</td><td>" + money(o.b.withdrawn) + "</td><td>" + money(o.b.taxable) +
      "</td><td>" + money(o.b.federal) + "</td><td>" + money(o.b.state) +
      "</td><td>" + money(o.b.tax) + "</td><td>" + pctStr(o.b.eff, 1) + "</td></tr>").join("") +
    "<tr style='font-weight:600;border-top:2px solid var(--line)'><td>All sources</td><td>" +
      money(R.gross) + "</td><td>" +
      money(live.reduce((a, o) => a + o.b.taxable, 0)) + "</td><td>" +
      money(R.federal) + "</td><td>" + money(R.state) + "</td><td>" + money(R.total) +
      "</td><td>" + pctStr(R.effTotal, 1) + "</td></tr>";

  let note = "The Roth column is zero by construction, and only the gain portion of " +
    "the brokerage withdrawal is taxable; the rest is your own basis coming back. " +
    "Ordinary tax is split across the traditional, Social Security and other-income " +
    "rows in proportion to what each contributed to ordinary taxable income.";
  if (R.ssGross > 0){
    note += " Your provisional income is " + money(R.provisional) + ", which puts " +
      (R.ssTier === 0 ? "none of your benefits in the tax base."
       : "up to " + R.ssTier + "% of your benefits in the tax base: " +
         money(R.taxableSS) + " of " + money(R.ssGross) + ".");
  }
  if (R.stateNote){
    note += " <b>" + (R.stateName || "This state") + ".</b> " + R.stateNote;
    if (R.stateExcluded > 0)
      note += " That removed " + money(R.stateExcluded) + " from the state tax base here.";
  }
  $("txBucketNote").innerHTML = note;

  // --- capital gain stacking panel ---
  const hasGain = R.gain > 0;
  $("txGainPanel").hidden = !hasGain;
  if (hasGain){
    $("txStack").innerHTML = txStackChart(R);
    const chip = (c, label, v) => "<span><i style='background:" + c + "'></i>" +
      label + " <b>" + v + "</b></span>";
    let leg = chip("#8ba0ac", "Ordinary taxable income", money(R.ordTaxable));
    R.ltcgBands.forEach((b, i) => {
      if (b.amount > 0)
        leg += chip(LTCG_COLORS[i], "Gain taxed at " + pctStr(b.rate, 0), money(b.amount));
    });
    $("txStackLegend").innerHTML = leg;

    let g = "You realized " + money(R.gain) + " of long-term gain on a " +
      money(R.brok) + " brokerage withdrawal; " + money(R.basis) +
      " of that was basis and never touched the return. ";
    g += R.gainTaxable > 0
      ? "The gain sits on top of " + money(R.ordTaxable) +
        " of ordinary taxable income, so it is taxed at a blended <b>" +
        pctStr(R.ltcgRate, 1) + "</b>, costing " + money(R.ltcg) + ". "
      : "Your deductions cover everything, so none of the gain is taxable at all. ";
    if (R.zeroRoom > 0)
      g += "You have <b>" + money(R.zeroRoom) + "</b> of room left in the 0% band: " +
        "gain harvested up to that point would be federally free.";
    else if (R.ltcgBands[0].amount > 0)
      g += "The 0% band is now full.";
    if (R.niit > 0)
      g += " Your MAGI of " + money(R.agi) + " is above the " +
        money(NIIT.threshold[inp.status]) + " net investment income tax threshold, " +
        "adding " + money(R.niit) + ".";
    $("txGainNote").innerHTML = g;
  }
  $("txBucketPanel").hidden = false;
}

function txDonut(R, parts){
  txActiveParts = parts;
  txPieDefaultVal = pctStr(R.effTotal, 1);
  $("txPie").innerHTML = donut(parts) +
    "<text id='txPieLbl' x='110' y='104' text-anchor='middle' font-size='13' fill='" + cssVar("--dim") +
    "' font-family='" + cssVar("--sans") + "' style='pointer-events:none'>All taxes</text>" +
    "<text id='txPieVal' x='110' y='128' text-anchor='middle' font-size='22' font-weight='600' fill='" +
    cssVar("--text") + "' font-family='" + cssVar("--mono") + "' style='pointer-events:none'>" +
    pctStr(R.effTotal, 1) + "</text>";
}
function txRow(k, v, eff, cls){
  return "<tr><td>" + k + "</td><td>" + money(v) + "</td><td>" + pctStr(eff, 2) +
    "</td><td><span style='color:" + cls + "'>\u25a0</span> " + pctStr(eff, 1) + "</td></tr>";
}
function txBracketTable(R){
  txStateRuleTable();
  $("txBrackets").querySelector("tbody").innerHTML = R.bands.map(b =>
    "<tr" + (b.amount > 0 ? "" : " style='opacity:.4'") + "><td>" + pctStr(b.rate, 0) +
    "</td><td>" + money(b.lo) + (b.hi === Infinity ? " and up" : " \u2013 " + money(b.hi)) +
    "</td><td>" + money(b.amount) + "</td><td>" + money(b.tax) + "</td></tr>").join("");
}

/* ---------- the state rules table ----------
   Everything the two tax modes just did at the state level, said in English.
   The rows are generated from the same STATES and RET_STATE data the
   calculation runs on, so the table cannot drift away from the numbers above
   it. The same six rows show in both modes: someone still working wants to
   know what retirement will cost in the state they are in, and someone
   retired wants to know how ordinary income is treated. */

/* A rate, with trailing zeros trimmed: 4.95%, 5%, 2.5%. */
function rp(r){ return (r * 100).toFixed(2).replace(/\.?0+$/, "") + "%"; }

/* "$3,000 single / $6,000 joint", or "$3,000" when the two are the same. */
function sj(pair){
  return pair[0] === pair[1] ? money(pair[0])
    : money(pair[0]) + " single / " + money(pair[1]) + " joint";
}

/* Row 1: how the state taxes a dollar of ordinary income. */
function ruleOrdinary(code, S, st){
  if (S.none) return "No individual income tax. Wages, pensions, retirement-account " +
    "withdrawals, Social Security and investment income are all untaxed.";
  const b = S.b[st];
  const rates = b.map(x => x[1]);
  const top = rates[rates.length - 1];
  const paid = b.filter(x => x[1] > 0);
  let out;
  if (paid.length === 1){
    out = "Flat " + rp(top) + " on all taxable income";
    out += b[0][1] === 0
      ? ", with a zero-rate band up to " + money(paid[0][0]) + ". " : ". ";
  } else {
    out = b.length + " brackets, " + rp(paid[0][1]) + " to " + rp(top) + ". ";
    if (b[0][1] === 0) out += "The first " + money(paid[0][0]) +
      " of taxable income is taxed at zero. ";
    out += "The top rate starts at " + money(S.b.s[S.b.s.length - 1][0]) +
      " single / " + money(S.b.m[S.b.m.length - 1][0]) + " joint. ";
  }
  const d = [];
  if (S.sd) d.push("standard deduction " + sj(S.sd));
  if (S.pe) d.push("personal exemption " + sj(S.pe));
  if (S.pec) d.push("exemption credit " + sj(S.pec) + " rather than a deduction");
  if (S.sdc) d.push("deduction delivered as a " + sj(S.sdc) + " credit");
  out += d.length ? "Against that: " + d.join(", ") + "."
                  : "No standard deduction or personal exemption.";
  if (S.agiCap) out += " The exemption is lost outright: a cliff, not a " +
    "phase-out, above " + sj(S.agiCap) + " of AGI.";
  return out;
}

/* Row 2: long-term capital gain and other investment income. */
function ruleGain(code, S, R){
  if (S.none) return code === "WA"
    ? "No tax on ordinary capital gain at the individual level, but Washington " +
      "levies a separate 7% excise tax on long-term gains above roughly $270,000 " +
      "a year, with real estate and retirement accounts exempt. That tax is not " +
      "calculated here."
    : "Not taxed.";
  let out = "";
  if (R.cgPct) out = rp(R.cgPct) + " of net long-term gain is excluded from the " +
    "state base; the remainder is taxed at the ordinary rates above. ";
  else if (R.cgFlat) out = sj(R.cgFlat) + " of long-term gain is excluded; the " +
    "remainder is taxed at the ordinary rates above. ";
  else if (R.cgMax) out = "Long-term gain is capped at " + rp(R.cgMax) +
    ", computed as an alternative that can never cost more than ordinary rates. ";
  else if (R.cgB) out = "Long-term gain gets its own reduced schedule: " +
    R.cgB.s.map(x => rp(x[1])).join(" then ") + ", instead of the ordinary rates. ";
  else out = "Taxed at the same ordinary rates as everything else. No preferential " +
    "long-term rate, and no equivalent of the federal 0% band. ";
  out += "Only the gain portion of a brokerage sale is taxed; your basis comes back " +
    "untouched, as federally.";
  return out;
}

/* Row 3: Social Security. */
function ruleSS(code, S, R){
  if (S.none) return "Not taxed.";
  if (!SS_TAX_STATES[code])
    return "Fully exempt. Benefits are subtracted from the state base no matter " +
      "how large they are or what else you earn.";
  let out = "Taxed, on the amount that is taxable federally under \u00a786. ";
  if (R.ssFullAge) out += "Fully exempt once you are 65 or older, which is what " +
    "this assumes when you mark someone 65+.";
  else if (R.ssCredit) out += "A credit then refunds the tax on those benefits, " +
    "withdrawn at " + rp(R.ssCredit.phase) + " of income above " + sj(R.ssCredit.cap) +
    ", so the relief disappears well before the top of the income range.";
  else if (R.ssCap && R.ssPct) out += "Fully exempt below " + sj(R.ssCap) +
    " of AGI; above that, " + rp(R.ssPct) + " of the federally taxable benefit stays " +
    "in the base.";
  else if (R.ssCap && R.ssRange) out += "Fully exempt below " + sj(R.ssCap) +
    " of AGI, phasing back in over the next " + money(R.ssRange) + ".";
  else if (R.ssCap) out += "Fully exempt below " + sj(R.ssCap) + " of AGI and fully " +
    "taxable above it, a cliff, not a phase-out.";
  else out += "No income test and no exemption: the federal taxable amount goes " +
    "straight into the state base.";
  return out;
}

/* Rows 4 and 5: pension income, then traditional 401(k) and IRA withdrawals.
   They are separate rows because roughly a dozen states treat them
   differently, which is the whole reason the tool asks for them separately. */
function rulePension(code, S, R){
  if (S.none) return "Not taxed.";
  const bits = [];
  if (R.penFull) bits.push("Fully exempt, public or private.");
  else if (R.pubFull) bits.push("Government pensions, federal, state and local, " +
    "are fully exempt. Private-employer pensions are taxed at ordinary rates.");
  else bits.push("Taxed at ordinary rates.");
  const ex = exclusionSentence(R, "p");
  if (ex) bits.push(ex);
  return bits.join(" ");
}
function ruleTrad(code, S, R){
  if (S.none) return "Not taxed.";
  const bits = [];
  if (R.tradFull) bits.push("Fully exempt. Qualified plan and IRA distributions " +
    "are outside the state base entirely.");
  else bits.push("Taxed at ordinary rates, the same as a pension would be.");
  if (code === "HI") bits.push("Hawaii's exemption covers only the employer-funded " +
    "share of a plan, so the part of a 401(k) that came from your own deferrals " +
    "stays taxable. This treats the whole balance as your own deferrals, which is " +
    "the conservative reading.");
  if (code === "MD") bits.push("Maryland's pension exclusion specifically does " +
    "not reach IRA distributions.");
  const ex = exclusionSentence(R, "t");
  if (ex) bits.push((R.exSrc === "t" ? "" :
    "It shares one allowance with pension income rather than getting its own. ") + ex);
  return bits.join(" ");
}

/* The shared description of a state's retirement-income exclusion, written
   once and shown on whichever of the two rows it actually applies to. */
function exclusionSentence(R, which){
  if (!R.exAmt) return "";
  const src = R.exSrc || "tp";
  const hits = src === "all" || src === "tp" ? true
             : src === "pub" || src === "p" ? which === "p"
             : which === "t";
  if (!hits) return "";
  const big = R.exAmt[0] >= 1e11;
  let out = big ? "Exempt in full" : "Up to " + sj(R.exAmt) + " is excluded";
  if (R.exPer) out += " per person";
  if (src === "all") out += ", and the same allowance covers interest, dividends, " +
    "rent and capital gain";
  if (src === "pub") out += ", and only for government pensions";
  out += R.exAge ? ", from age 65 as modeled here" : ", at any age";
  out += ".";
  if (R.exLessSS === "gross") out += " The allowance is reduced dollar for dollar " +
    "by the Social Security you receive, so a large benefit can consume it outright.";
  else if (R.exLessSS === "taxable") out += " Taxable Social Security comes out of " +
    "that ceiling first, which exempts benefits in full and leaves whatever is " +
    "left over for the rest.";
  if (R.exCap){
    if (R.exPhase === "nj") out += " Full below " + money(R.exCap[0]) +
      " of income, half to " + money(R.exCap[0] + 25000) + ", a quarter to " +
      money(R.exCap[0] + 50000) + ", nothing above.";
    else if (R.exPhase === "lin") out += " Withdrawn dollar for dollar as AGI " +
      "rises above " + sj(R.exCap) + ", so it is gone by " +
      money(R.exCap[0] + R.exRange) + " single / " +
      money(R.exCap[1] + R.exRange) + " joint.";
    else out += " Lost entirely above " + sj(R.exCap) + " of AGI.";
  }
  return out;
}

/* Row 6: what arrives at 65. */
function ruleSenior(code, S, R){
  if (S.none) return "No income tax, so nothing to give.";
  const bits = [];
  if (R.sdAge) bits.push("Extra deduction of " + sj(R.sdAge) + " per person, " +
    "against income of any kind.");
  if (R.agePh) bits.push("Deduction of " + money(R.agePh.amt) + " per person, " +
    "withdrawn dollar for dollar above " + sj(R.agePh.cap) + " of income, so it is " +
    "gone by " + money(R.agePh.cap[0] + R.agePh.amt) + " single / " +
    money(R.agePh.cap[1] + R.agePh.amt) + " joint.");
  if (R.peAge || S.peAge) bits.push("Extra personal exemption of " +
    money(R.peAge || S.peAge) + " per person.");
  if (R.credAge) bits.push("Credit of " + sj(R.credAge) + " per person" +
    (R.ohRet ? ", plus a retirement income credit of up to $200, both lost above " +
      sj(R.exCap) + " of state income." : "."));
  else if (R.ohRet) bits.push("Retirement income credit of up to $200.");
  if (R.exAge && R.exAmt) bits.push("Reaching 65 is also what unlocks the " +
    "retirement exclusion in the rows above, which is the main thing age buys " +
    "here, rather than a separate senior deduction.");
  if (R.ssFullAge) bits.push("Social Security becomes fully exempt at 65.");
  return bits.length ? bits.join(" ")
    : "Nothing beyond the federal age-65 deductions. The state gives no extra " +
      "deduction, exemption or credit at 65.";
}

/* What is knowingly missing. Two or three real items per state, not a
   disclaimer wall: the point is that you know where to go look. */
const STATE_GAPS = {
  AL:"Municipal occupational taxes of roughly 1% to 2% in Birmingham and other cities. Alabama's standard deduction phases down with income.",
  AZ:"Arizona's small-business alternative return, and the full exemption for military retirement pay.",
  AR:"Arkansas's low-income tax tables, which override the brackets at the bottom of the range.",
  CA:"State disability insurance, 1.2% of all wages with no cap, which functions like a payroll tax on the working side. California's own itemized deduction rules differ from the federal ones.",
  CO:"The $20,000 version of the pension subtraction available from 55 to 64, and TABOR-driven rate reductions that temporarily cut the flat rate in some years.",
  CT:"Connecticut's benefit recapture, which claws back the value of the lower brackets at higher incomes and can add several hundred dollars. Also the personal exemption's own phase-out.",
  DE:"Wilmington's 1.25% city wage tax on earned income.",
  GA:"The $5,000 sublimit on earned income inside the retirement exclusion, and the $35,000 version available from 62 to 64.",
  HI:"Working out how much of a 401(k) was employer-funded, since that share is exempt too. This assumes none of it was, so the real Hawaii bill may be lower.",
  ID:"Idaho's retirement benefits deduction for federal Civil Service, military and public-safety retirees, which is generous where it applies.",
  IL:"Nothing large. Illinois has no local income taxes and its retirement treatment is unusually simple.",
  IN:"County income taxes, which run roughly 1% to 3% on top of the state rate and apply to retirement income too. Indiana's military retirement exemption.",
  IA:"Iowa's retired-farmer and employee-stock-ownership elections, and its inheritance tax.",
  KS:"Kansas's food sales tax credit and homestead property tax refund, both of which matter at lower retirement incomes.",
  KY:"Local occupational license taxes of roughly 1% to 2.5% on earned income in Louisville, Lexington and elsewhere. The full exemption for service credited before 1998.",
  LA:"Parish-level differences and Louisiana's own itemized deduction rules, which depart from the federal ones.",
  ME:"Maine's alternative minimum tax and the phase-out of its personal exemption at higher incomes.",
  MD:"County and Baltimore City income taxes, which run 2.25% to 3.20% on top of the state rate and apply to retirement income. Maryland's senior tax credit of $1,000 to $1,750 below $100,000 / $150,000 of income.",
  MA:"Working out the previously-taxed contribution basis in an IRA, which Massachusetts lets you recover tax-free. The 4% surtax above roughly $1.08 million is in the brackets above.",
  MI:"City income taxes in Detroit, Grand Rapids and about two dozen others, roughly 1% to 2.4%, which reach retirement income.",
  MN:"Minnesota's alternative minimum tax and its separate public-pension subtraction for certain retirees.",
  MS:"The rule that early distributions taken before the plan's retirement age lose the exemption and are taxed in full.",
  MO:"Earnings taxes of 1% in Kansas City and St. Louis. The $6,000 private pension exemption below $25,000 / $32,000 of income.",
  MT:"Montana's capital gain credit interaction with its reduced gain rates, and its elderly homeowner credit.",
  NE:"Nebraska's full exemption for military retirement benefits.",
  NJ:"New Jersey taxes 401(k) contributions going in, so part of every withdrawal is a tax-free return of basis that this does not track; the real New Jersey bill is usually lower than shown. Also the property tax deduction and senior freeze.",
  NM:"The cap on New Mexico's capital gain deduction, which limits the 40% figure at higher gain amounts.",
  NY:"New York City resident tax of roughly 3.1% to 3.9%, and Yonkers's surcharge, both of which reach pension and retirement-account income. New York's supplemental tax recapture at high incomes.",
  NC:"The Bailey exemption for government retirees vested before August 1989, which exempts their pensions entirely.",
  ND:"Nothing large. North Dakota's rates are low enough that the gain exclusion does most of the work.",
  OH:"Municipal income taxes of roughly 1% to 3% and school district income taxes, though most Ohio municipalities exempt retirement income. Ohio's joint filing credit and lump-sum retirement credit.",
  OK:"Oklahoma's full exemption for military retirement and its separate federal Civil Service allowance.",
  OR:"Multnomah County and Portland-area local income taxes, which stack to several percent on higher incomes. Oregon's retirement income credit at low household incomes, and its federal tax subtraction.",
  PA:"Local earned income taxes of roughly 1% to 3.9%, though these fall on wages rather than retirement income. Distributions taken before retirement age lose the exemption.",
  RI:"The requirement that you have actually reached full retirement age, not merely 65, for either the Social Security or pension relief.",
  SC:"South Carolina's separate treatment of military retirement, and its two-wage-earner credit.",
  UT:"Utah's credit phase-out runs on a modified AGI that adds back some untaxed income, so the real credit can be smaller than shown. The $450 retirement credit for taxpayers born before 1953.",
  VT:"Vermont's alternative minimum tax, and the $10,000 exclusion for Civil Service and military retirement.",
  VA:"The rule that the age deduction is unlimited for taxpayers born before 1939, and Virginia's separate military benefits subtraction.",
  WV:"West Virginia's separate full exemptions for state police, teachers' and federal Civil Service retirement, and its senior citizen property tax credit.",
  WI:"The requirement that you are 67, not 65, for the $24,000 exclusion, marking someone 65+ here grants it two years early. Wisconsin's married-couple credit and school property tax credit.",
  DC:"The District's $3,000 exclusion for government pensions at 62, and its own itemized deduction limits.",
  AK:"Nothing. Alaska has no individual income tax and no local income taxes.",
  FL:"Nothing at the income tax level. Florida's tangible and documentary taxes are unrelated.",
  NV:"Nothing. Nevada has no individual income tax.",
  NH:"New Hampshire's interest and dividends tax was fully repealed effective 2025, so there is nothing left to model.",
  SD:"Nothing. South Dakota has no individual income tax.",
  TN:"Nothing. Tennessee's Hall tax on interest and dividends was repealed in 2021.",
  TX:"Nothing. Texas has no individual income tax.",
  WA:"The 7% excise tax on long-term capital gains above roughly $270,000 a year, which is not calculated here. Real estate and retirement accounts are exempt from it.",
  WY:"Nothing. Wyoming has no individual income tax."
};

/* Things true of every state, worth saying once rather than fifty-one times. */
const GAPS_UNIVERSAL = "Everywhere: state credits that phase out on income " +
  "(property tax, renter, low-income and dependent credits), state alternative " +
  "minimum taxes, differences between state and federal itemized deductions, " +
  "part-year and non-resident apportionment, and estate or inheritance taxes.";

function txStateRuleTable(){
  const code = $("txState").value;
  const st = $("txStatus").value;
  const S = STATES[code] || {none:1, n:"None"};
  const R = RET_STATE[code] || {};
  const rows = [
    ["Ordinary income", ruleOrdinary(code, S, st)],
    ["Long-term capital gain", ruleGain(code, S, R)],
    ["Social Security", ruleSS(code, S, R)],
    ["Pension / annuity", rulePension(code, S, R)],
    ["Traditional 401(k) / IRA", ruleTrad(code, S, R)],
    ["Age 65 and over", ruleSenior(code, S, R)]
  ];
  $("txStateRuleName").textContent = S.n || "";
  $("txStateRules").querySelector("tbody").innerHTML = rows.map(r =>
    "<tr><td style='white-space:nowrap;font-weight:600'>" + r[0] + "</td><td>" +
    r[1] + "</td></tr>").join("");
  $("txStateGaps").innerHTML = "<b>Not included in the figures above.</b> " +
    (STATE_GAPS[code] || "") + " " + GAPS_UNIVERSAL;
}

/* Switching modes swaps which inputs are on screen and which output panels
   exist. The Normal Income side is left exactly as it was. */
function applyTaxMode(){
  const ret = txMode === "retire";
  $("segTxMode").querySelectorAll("button").forEach(x =>
    x.classList.toggle("on", x.getAttribute("data-txmode") === txMode));
  $("txGrossWrap").hidden = ret;
  $("txRetSources").hidden = !ret;
  $("txSeniorWrap").hidden = !ret;
  $("segTxView").hidden = ret;
  $("txRetLbl").hidden = !ret;
  $("txBucketPanel").hidden = !ret;
  $("txGainPanel").hidden = true;      // renderRetireTax turns it back on if there is a gain
  $("txPreTip").setAttribute("data-tip", ret ? "txpreret" : "txpre");
  syncSeniorOptions();
  syncGrossFields();
}
/* "Both spouses" only means anything on a joint return. */
function syncSeniorOptions(){
  const joint = $("txStatus").value === "m";
  const opt = $("txSeniors").querySelector("option[value='2']");
  opt.hidden = !joint;
  opt.disabled = !joint;
  $("txSeniors").querySelector("option[value='1']").textContent =
    joint ? "One spouse" : "Yes";
  if (!joint && $("txSeniors").value === "2") $("txSeniors").value = "1";
}
/* A second earner only exists in Normal Income mode on a joint return -- that's
   the only place FICA's per-earner wage cap makes the split matter. Toggling
   in a second grid column (rather than just hiding/showing the field) keeps
   the single-earner case from leaving a blank half-width gap next to it. */
function syncGrossFields(){
  const split = txMode === "normal" && $("txStatus").value === "m";
  $("txGrossWrap").classList.toggle("two", split);
  $("txGrossWrap").classList.toggle("bottomalign", split);
  $("txGross2Wrap").hidden = !split;
  $("txGrossTotalWrap").hidden = !split;
  $("txGrossLabel").textContent = split ? "Your gross income" : "Gross income";
}

let txView = "net";
$("segTxView").addEventListener("click", e => {
  const b = e.target.closest ? e.target.closest("button[data-view]") : null;
  if (!b) return;
  txView = b.getAttribute("data-view");
  $("segTxView").querySelectorAll("button").forEach(x =>
    x.classList.toggle("on", x.getAttribute("data-view") === txView));
  renderTax();
});
$("segTxMode").addEventListener("click", e => {
  const b = e.target.closest ? e.target.closest("button[data-txmode]") : null;
  if (!b) return;
  txMode = b.getAttribute("data-txmode");
  applyTaxMode();
  renderTax();
});
["txGross","txGross2","txPre","txItem","txTrad","txRoth","txBrok","txGainPct","txSS","txPension","txOther"]
  .forEach(id => $(id).addEventListener("input", renderTax));
["txStatus","txState","txDedType","txSeniors","txPenType"].forEach(id =>
  $(id).addEventListener("change", () => { syncSeniorOptions(); syncGrossFields(); renderTax(); }));

