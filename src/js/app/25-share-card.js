/* ---------- shareable summary card ----------
   Draws an SVG card, rasterises it through a canvas, and hands back a PNG the
   user can download or copy. Everything happens locally; no upload. */
function cardEscape(t){
  return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
/* Forces a chart clone to fixed dark colors regardless of the app's current
   theme, so a card generated in light mode still looks right on the card's
   dark panel \u2014 the counterpart to lighten() used for the light PDF page. */
function darkenForCard(node){
  var swap = {};
  swap[cssVar("--grid").toLowerCase()] = "#1c2740";
  swap[cssVar("--axis").toLowerCase()] = "#7f8eaa";
  swap[cssVar("--stageline").toLowerCase()] = "#4a5a7b";
  swap[cssVar("--dotstroke").toLowerCase()] = "#080b16";
  swap[cssVar("--bg").toLowerCase()] = "#151e33";
  var walk = function(nd){
    ["stroke","fill"].forEach(function(a){
      var v = nd.getAttribute && nd.getAttribute(a);
      if (v && swap[v.toLowerCase()]) nd.setAttribute(a, swap[v.toLowerCase()]);
    });
    for (var k = 0; k < nd.childNodes.length; k++) walk(nd.childNodes[k]);
  };
  walk(node);
}

/* Clones a live chart element and returns markup for a nested <svg> sized
   and positioned inside the card. Returns "" if the source has no content
   yet (e.g. the tool has never been rendered), which callers treat as "no
   chart for this card" rather than an error. */
/* Nesting a live <svg> inside the card's outer <svg> is unreliable once the
   whole thing gets rasterised through an <img>/<canvas> round trip \u2014
   viewBox scaling on a nested svg doesn't always survive that pipeline
   consistently across browsers. Instead, the chart's own viewBox is read
   directly and used to build an explicit scale + translate transform on a
   plain <g>, so its children (paths, lines, text) are placed in the card's
   coordinate space by simple arithmetic rather than relying on nested-SVG
   scaling to do it. The source chart's viewBox also depends on the window
   width it was last drawn at (narrower windows use a 470x400 chart), so
   that native size is read fresh each time rather than assumed. */
function embedChart(elId, w, h){
  var src = $(elId);
  if (!src || !src.childNodes.length) return "";
  var vb = (src.getAttribute("viewBox") || "0 0 900 340").split(/\s+/).map(Number);
  var srcW = vb[2] || 900, srcH = vb[3] || 340;
  var scaleX = w / srcW, scaleY = h / srcH;
  var clone = src.cloneNode(true);
  darkenForCard(clone);
  clone.removeAttribute("style");
  clone.removeAttribute("viewBox");
  clone.removeAttribute("width");
  clone.removeAttribute("height");
  clone.removeAttribute("id");
  var inner = clone.innerHTML;
  return '<g transform="scale(' + scaleX + ',' + scaleY + ')">' + inner + '</g>';
}

function buildCardSVG(){
  var W = 1080, H = 1350;
  var t = chartMode.tab;
  var title, big, bigLabel, sub, rows, chartSvg = "", chartW = 900, chartH = 0, verdict = "";

  if (t === "tools" && toolSub === "drawdown"){
    var od = readDD();
    var Hb = historicalBacktest(od);
    var stratName = DD_STRAT_NAMES[od.strategy] || "Floor & ceiling";
    title = "Will my money last?";
    bigLabel = "Success rate, tested since " + HIST_START;
    big = pctStr(Hb.successRate, 0);
    sub = fmtNum(od.years) + " year retirement \u00b7 " + od.stockPct + "% stocks / " + (100 - od.stockPct) + "% bonds";
    rows = [
      ["Withdrawal strategy", stratName],
      ["Year one's withdrawal", money(ddFirstSpend(od)) + " (" + pctStr(ddFirstSpend(od) / Math.max(1, od.initial), 1) + ")"],
      ["Starting portfolio", money(od.initial)],
      ["Tested against", Hb.total + " real retirements"],
      ["Survived", Hb.survived + " of " + Hb.total + " periods"],
      ["Median ending balance", money(Hb.medianEnd)],
      ["Worst case", money(Hb.worstEnd)]
    ];
    var enabledIncome = (od.incomeItems || []).filter(function(it){ return it.on !== false; });
    var enabledExpense = (od.expenseItems || []).filter(function(it){ return it.on !== false; });
    if (enabledIncome.length) rows.push(["Other income", enabledIncome.length === 1 ?
      enabledIncome[0].name : enabledIncome.length + " sources"]);
    if (enabledExpense.length) rows.push(["Future expenses", enabledExpense.length === 1 ?
      enabledExpense[0].name : enabledExpense.length + " planned"]);
    verdict = Hb.successRate >= 0.99 ? "Survived every historical period on record."
      : Hb.successRate >= 0.90 ? "Survived the large majority of historical periods."
      : "Failed in a meaningful share of historical periods.";
    chartSvg = embedChart("chartDD", 900, 300); chartW = 900; chartH = 300;

  } else if (t === "tools" && toolSub === "tax"){
    var it = readTax();
    var Rt = runTax(it);
    var isRet = it.mode === "retire";
    title = isRet ? "My tax in retirement" : "My take-home pay";
    bigLabel = isRet ? "Income after tax, per year" : "Take-home, per year";
    big = money(Rt.net);
    sub = money(Rt.gross) + (isRet ? " withdrawn \u00b7 " : " gross \u00b7 ") +
      (Rt.stateName || "no state tax") + " \u00b7 tax year 2026";
    rows = isRet ? [
      ["Federal, ordinary income", money(Rt.fedOrdinary)],
      ["Federal, long-term gains", money(Rt.ltcg)],
      ["Net investment income tax", money(Rt.niit)],
      ["State tax", money(Rt.state)],
      ["Total tax", money(Rt.total)],
      ["Effective rate", pctStr(Rt.effTotal, 1)],
      ["Per month", money(Rt.net / 12)]
    ] : [
      ["Federal tax", money(Rt.federal)],
      ["State tax", money(Rt.state)],
      ["Social Security + Medicare", money(Rt.fica)],
      ["Total tax", money(Rt.total)],
      ["Effective rate", pctStr(Rt.effTotal, 1)],
      ["Per month", money(Rt.net / 12)],
      ["Per biweekly check", money(Rt.net / 26)]
    ];
    chartSvg = embedChart("txPie", 400, 400); chartW = 400; chartH = 400;

  } else if (t === "tools" && toolSub === "mortgage"){
    var im = readMort();
    var Rm = mortgage(im);
    title = "My mortgage";
    bigLabel = "Total monthly payment";
    big = money(Rm.total);
    sub = money(im.price) + " home \u00b7 " + pctStr(im.rate, 2) + " rate \u00b7 " + fmtNum(im.term) + " year term";
    rows = [
      ["Principal & interest", money(Rm.pi)],
      ["Property tax & insurance", money(Rm.tax + Rm.ins)],
      ["Loan amount", money(Rm.loan)],
      ["Down payment", money(im.down) + " (" + pctStr(im.price ? im.down/im.price : 0, 0) + ")"],
      ["Total interest, full loan", money(Rm.totalInterest)],
      ["Total cost of the loan", money(Rm.loan + Rm.totalInterest)],
      ["Payoff", "Year " + Rm.years.length]
    ];
    chartSvg = embedChart("chartMo", 900, 300); chartW = 900; chartH = 300;

  } else if (t === "tools" && toolSub === "college" && readCollege().kids.length > 1){
    var icf = readCollege(), Pf = collegePlanCalc(icf);
    title = "College savings plan";
    bigLabel = "Save per month";
    big = Pf ? money(Pf.monthly) : "\u2014";
    sub = Pf ? fmtNum(Pf.kids.length) + " children \u00b7 " + collegePhaseNote(Pf) : "";
    rows = Pf ? [["Total cost, all children", money(Pf.totalFuture)], ["Needed today", money(Pf.pvToday)]]
      .concat(Pf.kids.map(k => ["Child " + (k.index + 1) + ", in " + fmtNum(k.yearsUntil) + " yrs", money(k.total)]))
      .concat([["Currently saved", money(icf.saved)], ["Investment return", pctStr(icf.investRet, 1)],
        ["Tuition inflation", pctStr(icf.tuitionInfl, 1)]]) : [];
    chartSvg = embedChart("chartCl", 900, 300); chartW = 900; chartH = 300;

  } else if (t === "tools" && toolSub === "college"){
    var ic = readCollege();
    var Rc = collegeSavingsCalc(ic);
    title = "College savings plan";
    bigLabel = "Save per month";
    big = money(Rc.monthly);
    sub = fmtNum(ic.yearsUntil) + " years to go \u00b7 " + money(ic.annualCost) + "/yr today \u00b7 " + fmtNum(ic.collegeYrs) + " years of school";
    rows = [
      ["Total cost, all years", money(Rc.totalFuture)],
      ["Needed when college starts", money(Rc.targetAtStart)],
      ["Currently saved", money(ic.saved)],
      ["Savings grow to", money(Rc.savingsAtStart)],
      ["Shortfall to close", money(Rc.shortfall)],
      ["Investment return", pctStr(ic.investRet, 1)],
      ["Tuition inflation", pctStr(ic.tuitionInfl, 1)]
    ];
    chartSvg = embedChart("chartCl", 900, 300); chartW = 900; chartH = 300;

  } else if (t === "tools" && toolSub === "rentbuy"){
    var ir = readRB();
    var Rr = rentBuyCalc(ir);
    var lastR = Rr.years[Rr.years.length - 1];
    var buyWins = lastR && lastR.buyerNW >= lastR.renterNW;
    title = "Rent vs. buy";
    bigLabel = "Better choice after " + fmtNum(ir.horizon) + " years";
    big = buyWins ? "Buying" : "Renting";
    sub = money(ir.price) + " home \u00b7 " + money(ir.rent) + "/mo rent \u00b7 " + pctStr(ir.downPct/100, 0) + " down";
    rows = lastR ? [
      ["Buyer net worth", money(lastR.buyerNW)],
      ["Renter net worth", money(lastR.renterNW)],
      ["Difference", (buyWins ? "+" : "\u2212") + money(Math.abs(lastR.buyerNW - lastR.renterNW))],
      ["Break-even point", Rr.breakEven ? "Year " + fmtNum(Rr.breakEven) : "Not within horizon"],
      ["Renter invests upfront", money(Rr.initialInvest)],
      ["Home value at end", money(lastR.homeVal)],
      ["Monthly cost, buying", money(Rr.monthlyBuy)]
    ] : [];
    chartSvg = embedChart("chartRB", 900, 300); chartW = 900; chartH = 300;

  } else if (t === "tools" && toolSub === "budget"){
    var incFreqC = bgIncomeFreq;
    var incYrC = num("bgIncomeIn") * incFreqC;
    var spentYrC = budget.reduce(function(a, r){ return a + (isSavingsRow(r) ? 0 : annualize(r)); }, 0);
    var savedYrC = budget.reduce(function(a, r){ return a + (isSavingsRow(r) ? annualize(r) : 0); }, 0);
    var leftYrC = incYrC - spentYrC - savedYrC;
    var efMonthsC = Math.max(1, Math.round(num("efMonths")) || 6);
    title = "My monthly budget";
    bigLabel = "Left over, per month";
    big = money(leftYrC / 12);
    sub = money(incYrC / 12) + " income \u00b7 " + money(spentYrC / 12) + " spending, per month";
    var topCats = {};
    budget.forEach(function(r){
      if (annualize(r) <= 0 || isSavingsRow(r)) return;
      var g = r.group || "Custom";
      topCats[g] = (topCats[g] || 0) + annualize(r);
    });
    var catRows = Object.keys(topCats).sort(function(a,b){ return topCats[b]-topCats[a]; })
      .slice(0, 3).map(function(g){ return [g, money(topCats[g]/12) + "/mo"]; });
    rows = [
      ["Income", money(incYrC / 12) + "/mo"],
      ["Spending", money(spentYrC / 12) + "/mo"]
    ].concat(savedYrC > 0 ? [["Saving", money(savedYrC / 12) + "/mo"]] : [])
     .concat(catRows)
     .concat([["Emergency fund target", money((spentYrC/12) * efMonthsC) + " (" + efMonthsC + " mo)"]]);

  } else if (t === "tools" && toolSub === "bridge"){
    renderBridge();
    var BL = brLast;
    title = "Can I bridge to 59½?";
    if (BL){
      var bb = BL.best, tb = bb.test, bs = bb.steady;
      bigLabel = BL.mc ? "Reaches 59½ penalty-free, random markets" : "Reaches 59½ penalty-free, tested since " + HIST_START;
      big = tb.of ? pctStr(tb.hold / tb.of, 0) : "—";
      sub = "Retiring at " + BL.ctx.age + " · " + money(BL.ctx.spend) + " a year after tax";
      rows = [
        ["Best plan", bb.name],
        ["Tax to 59½", money(bs.tax)],
        ["Penalties", money(bs.pen)]
      ].concat(BL.ctx.aca ? [["Health premiums to 59½", money(bs.health)]] : [])
       .concat([["Traditional at 59½", money(bs.end.trad)], ["Roth at 59½", money(bs.end.roth)],
                ["Brokerage at 59½", money(bs.end.brok)]]);
      verdict = bb.desc;
      chartSvg = embedChart("chartBR", 900, 300); chartW = 900; chartH = 300;
    } else {
      bigLabel = "Enter your balances"; big = "—"; sub = ""; rows = [];
    }

  } else if (t === "tools" && toolSub === "optimizer"){
    var OR = OP.tool.res;
    title = "My retirement roadmap";
    if (OR){
      var ob = OR.best.stats, oa = OR.base.stats, oc = {married:OR.married, gap:OR.age2 == null ? 0 : OR.age2 - OR.age1, rmdAge:OR.rmdAge};
      bigLabel = "Left after tax, typical market";
      big = opCompact(ob.medLegacy);
      sub = "Best of " + groupDigits(OR.of, true) + " plans, tested in every market since " + OR.first;
      rows = [
        ["Social Security at", opClaims(OR.best.T, oc, true)],
        ["Lifetime tax", money(oa.medTax) + " \u2192 " + money(ob.medTax)],
        ["Lasted in", pctStr(ob.successRate, 0) + " of markets"],
        ["Left after tax", opCompact(oa.medLegacy) + " \u2192 " + opCompact(ob.medLegacy)]
      ];
      verdict = opTacticsLine(OR.best.T, oc);
    } else {
      bigLabel = "Run the optimizer first"; big = "—"; sub = ""; rows = [];
    }

  } else if (t === "simple"){
    var p = readBasic();
    var R = projectBasic(p);
    title = "My retirement projection";
    bigLabel = "Value at retirement, age " + fmtNum(p.retire);
    big = money(R.fv);
    sub = "In today's dollars \u00b7 " + fmtYears(p.years) + " of saving \u00b7 " + pctStr(p.real, 2) + " real return";
    rows = [
      ["Income per year", money(R.fv * .04)],
      ["Income per month", money(R.fv * .04 / 12)],
      ["You put in", money(R.contribTotal)],
      ["Growth added", money(R.growth)],
      ["Growth after inflation", pctStr(p.real, 2)]
    ];
    chartSvg = embedChart("chartQ", 900, 300); chartW = 900; chartH = 300;

  } else {
    var pa = readInputs();
    var Ra = project(pa);
    var series = !$("tab-series").hidden;
    title = series ? "My staged retirement plan" : "My retirement projection";
    bigLabel = "Inflation-adjusted value";
    big = money(Ra.fvReal);
    sub = fmtYears(pa.years) + " \u00b7 " + money(pa.contrib, 0) + " " + PERIOD_ADV[pa.period] + " \u00b7 " + pctStr(pa.gross, 2) + " return";
    rows = [
      ["Future value", money(Ra.fv)],
      ["Inflation adjusted", money(Ra.fvReal)],
      ["After-tax income / yr", money(Ra.afterTax)],
      ["I put in", money(Ra.contribTotal)],
      ["Growth added", money(Ra.growth)]
    ];
    chartSvg = embedChart(series ? "chartS" : "chart", 900, 300); chartW = 900; chartH = 300;
  }

  // The site's own dark palette, so a shared card looks like the site. (Web
  // fonts can't load inside an SVG drawn as an image, so the faces are the
  // closest system ones.)
  var bg = "#080b16", panel = "#151e33", line = "#26314b";
  var text = "#e8edf7", dim = "#94a6bf", gold = "#e9b872", jade = "#4fbf95", steel = "#7d9fd6";
  var mono = "ui-monospace, SF Mono, Menlo, monospace";
  var sans = "Helvetica Neue, Helvetica, Arial, sans-serif";
  // The bow and arrow, 64px, in the header's top-right corner.
  var logo = '<g transform="translate(926 90) scale(1.1429) translate(-4 -4)"><g transform="rotate(-45 32 32)">' +
    '<path d="M33 7 L11.5 28.5 M33 57 L11.5 35.5" fill="none" stroke="' + steel + '" stroke-width="2"/>' +
    '<path d="M33 7 C31 10 34 13 39 17 Q53 32 39 47 C34 51 31 54 33 57" fill="none" stroke="' + jade + '" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M7 32 H51" stroke="' + gold + '" stroke-width="3.2" stroke-linecap="round"/>' +
    '<path d="M60 32 L48 25.5 L50.5 32 L48 38.5 Z" fill="' + gold + '"/>' +
    '<path d="M11 32 L6 25.5 H11 L18 32 Z M11 32 L6 38.5 H11 L18 32 Z" fill="' + gold + '"/></g></g>';

  // Layout flows top to bottom: header, headline number, chart (if any),
  // then the row list, then the footer \u2014 so a tool with no chart (Budget)
  // simply gets a taller row list instead of empty space. The chart itself
  // is emitted at its own local origin by embedChart(); a <g transform>
  // here is what actually places it on the card, with narrower charts
  // (the tax donut) centered inside the standard 900px content width.
  var chartY = 268;
  var rowsY = chartH > 0 ? chartY + chartH + 40 : chartY + 30;

  var chartBlock = chartSvg
    ? '<rect x="90" y="' + chartY + '" width="900" height="' + chartH + '" rx="10" fill="' + bg + '" stroke="' + line + '"/>' +
      '<g transform="translate(' + (90 + (900 - chartW) / 2) + ',' + chartY + ')">' + chartSvg + '</g>'
    : "";

  var y = rowsY;
  var rowSvg = rows.map(function(r){
    var block =
      '<text x="90" y="' + y + '" font-family="' + sans + '" font-size="27" fill="' + dim + '">' + cardEscape(r[0]) + '</text>' +
      '<text x="990" y="' + y + '" font-family="' + mono + '" font-size="29" font-weight="600" fill="' + text + '" text-anchor="end">' + cardEscape(r[1]) + '</text>' +
      '<line x1="90" y1="' + (y + 22) + '" x2="990" y2="' + (y + 22) + '" stroke="' + line + '" stroke-width="1"/>';
    y += 76;
    return block;
  }).join("");

  var verdictBlock = verdict
    ? '<text x="90" y="' + (y + 10) + '" font-family="' + sans + '" font-size="24" fill="' + jade + '" font-weight="600">' + cardEscape(verdict) + '</text>'
    : "";
  var footY = H - 60;

  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' +
    '<defs><radialGradient id="cg" cx="12%" cy="4%" r="70%"><stop offset="0" stop-color="' + jade + '" stop-opacity=".14"/><stop offset="1" stop-color="' + jade + '" stop-opacity="0"/></radialGradient>' +
    '<linearGradient id="ce" x1="0" x2="1"><stop offset="0" stop-color="' + jade + '" stop-opacity="0"/><stop offset=".35" stop-color="' + jade + '" stop-opacity=".7"/><stop offset=".65" stop-color="' + gold + '" stop-opacity=".7"/><stop offset="1" stop-color="' + gold + '" stop-opacity="0"/></linearGradient></defs>' +
    '<rect width="' + W + '" height="' + H + '" fill="' + bg + '"/>' +
    '<rect x="40" y="40" width="1000" height="' + (H - 80) + '" rx="28" fill="' + panel + '" stroke="' + line + '"/>' +
    '<rect x="40" y="40" width="1000" height="' + (H - 80) + '" rx="28" fill="url(#cg)"/>' +
    '<rect x="100" y="40" width="880" height="2" fill="url(#ce)"/>' +
    logo +
    '<text x="90" y="140" font-family="' + sans + '" font-size="34" font-weight="600" fill="' + text + '">' + cardEscape(title) + '</text>' +
    '<text x="90" y="182" font-family="' + sans + '" font-size="24" fill="' + dim + '">' + cardEscape(sub) + '</text>' +
    '<text x="90" y="243" font-family="' + sans + '" font-size="22" fill="' + dim + '">' + cardEscape(bigLabel) + '</text>' +
    '<text x="990" y="243" font-family="' + mono + '" font-size="68" font-weight="700" fill="' + gold + '" text-anchor="end">' + cardEscape(big) + '</text>' +
    chartBlock +
    rowSvg +
    verdictBlock +
    '<line x1="90" y1="' + (footY - 20) + '" x2="990" y2="' + (footY - 20) + '" stroke="' + line + '" stroke-width="1"/>' +
    '<text x="90" y="' + footY + '" font-family="' + sans + '" font-size="20" fill="' + dim + '">Projections, not predictions. Not financial advice.</text>' +
    '<text x="990" y="' + (footY - 1) + '" font-family="' + sans + '" font-size="22" text-anchor="end"><tspan fill="' + gold + '">Know your number.</tspan><tspan dx="12" font-weight="600" fill="' + jade + '">retcalc.app</tspan></text>' +
    '</svg>';
}

function cardToBlob(cb){
  var svg = buildCardSVG();
  var img = new Image();
  var blob = new Blob([svg], {type: "image/svg+xml;charset=utf-8"});
  var url = URL.createObjectURL(blob);
  img.onload = function(){
    var c = document.createElement("canvas");
    c.width = 1080; c.height = 1350;
    var ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    c.toBlob(function(b){ cb(b); }, "image/png");
  };
  img.onerror = function(){ URL.revokeObjectURL(url); cb(null); };
  img.src = url;
}

/* A plain <a download> link saves to the browser's generic downloads
   location \u2014 on a phone that's the Files app, not the Photos camera roll,
   and often opens a preview instead of actually saving anything. The Web
   Share API's native share sheet is what actually offers "Save to Photos" /
   "Save Image" on iOS and Android, so that's used whenever the browser
   supports sharing a file; the old download link remains the fallback for
   desktop browsers, where there's no camera roll to save into anyway. */
function downloadCard(){
  cardToBlob(function(b){
    if (!b){ toast("Couldn't build the image"); return; }
    var file = new File([b], "retirement-summary.png", {type: "image/png"});
    if (navigator.share && navigator.canShare && navigator.canShare({files: [file]})){
      navigator.share({files: [file]}).catch(function(err){
        // A user-cancelled share isn't an error worth reporting.
        if (err && err.name === "AbortError") return;
        fallbackDownload(b);
      });
      return;
    }
    fallbackDownload(b);
  });
}
function fallbackDownload(b){
  var a = document.createElement("a");
  a.href = URL.createObjectURL(b);
  a.download = "retirement-summary.png";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
  toast("Image saved");
}
function copyCard(){
  if (!navigator.clipboard || !window.ClipboardItem){
    toast("Your browser can't copy images. Downloading instead.");
    downloadCard(); return;
  }
  cardToBlob(function(b){
    if (!b){ toast("Couldn't build the image"); return; }
    navigator.clipboard.write([new ClipboardItem({"image/png": b})])
      .then(function(){ toast("Image copied to clipboard"); })
      .catch(function(){ toast("Copy blocked. Downloading instead."); downloadCard(); });
  });
}

$("btnShareMenu").addEventListener("click", async () => {
  if (chartMode.tab === "guide"){
    const c = await showPopup("Share your plan", [
      shareSheet() ? {label:"Share link", desc:"Text or send your answers and plan"}
        : {label:"Copy link", desc:"Opens your answers and plan in the guide"},
      {label:"Print or save as PDF", desc:"Your score, plan and next moves on one page"}
    ]);
    if (c === 0) gdSharePlan();
    else if (c === 1) gdPrintPlan();
    return;
  }
  const choice = await showPopup("Share", [
    shareSheet() ? {label:"Share link", desc:"Text or send a link with all your inputs"}
      : {label:"Copy link", desc:"Copy a shareable URL with all your inputs"},
    {label:"Summary", desc:"One-page printable overview (Save as PDF)"},
    {label:"Save image card", desc:"A square PNG of your headline numbers"},
    {label:"Copy image card", desc:"Put that image straight on the clipboard"}
  ]);
  if (choice === 0) doShare();
  else if (choice === 1) doSummary();
  else if (choice === 2) downloadCard();
  else if (choice === 3) copyCard();
});

/* One payload builder per tool, reused by Save (to build what gets written),
   and by the dirty check (to compare current inputs against what was last
   saved/loaded) so both always agree on what a scenario "is". */
function buildToolData(tool){
  if (tool === "basic") return readBasicState();
  if (tool === "advanced") return readAdvancedState();
  if (tool === "stages") return readStagesState();
  if (tool === "tax") return readTaxState();
  if (tool === "mortgage") return readMortState();
  if (tool === "college") return readCollegeState();
  if (tool === "rentbuy") return readRBState();
  if (tool === "drawdown") return readDDState();
  if (tool === "roth") return readRCState();
  if (tool === "debt") return readDebtState();
  if (tool === "backtest") return readBTState();
  if (tool === "guide") return gdPlanData();
  if (tool === "healthcare") return readAsideState("asideHC");
  if (tool === "bridge") return readAsideState("asideBR");
  if (tool === "optimizer") return readAsideState("asideOP");
  if (tool === "fire") return Object.assign(readAsideState("asideFire"), {
    mode: $("segFireMode").querySelector('button[data-firemode="coast"].on') ? "coast" : "fire"});
  return readBudgetState();
}
function doSave(){
  /* was: $("btnSave").addEventListener("click", () => { */
  const tool = activeTool();
  const existingName = currentScenario[tool] || "";
  const name = prompt("Name this " + TOOL_LABEL[tool] + ":",
    existingName || $("scenarioPick").value || "");
  if (!name || !name.trim()) return;
  const trimmed = name.trim();
  const list = SC[tool];
  const i = list.findIndex(s => s.name === trimmed);
  // Only ask when the name belongs to a *different* saved scenario than the
  // one currently loaded \u2014 re-saving over your own loaded scenario by typing
  // its own name back is the normal "update" flow and shouldn't be gated.
  if (i >= 0 && trimmed !== existingName &&
      !confirm("\"" + trimmed + "\" already exists as a saved " + TOOL_LABEL[tool] +
                ". Overwrite it?")) return;
  const payload = buildToolData(tool);
  const data = {name: trimmed, data: payload};
  if (i >= 0) list[i] = data; else list.push(data);
  storeWrite(tool, list);
  currentScenario[tool] = trimmed;
  loadedSnapshot[tool] = JSON.stringify(payload);
  refreshScenarioList(trimmed);
  toast("Saved " + trimmed);
}
function doDelete(){
  const tool = activeTool();
  const name = $("scenarioPick").value;
  if (!name){ toast("Pick a saved " + TOOL_LABEL[tool] + " first"); return; }
  if (!confirm("Delete " + name + "?")) return;
  SC[tool] = SC[tool].filter(s => s.name !== name);
  storeWrite(tool, SC[tool]);
  if (currentScenario[tool] === name){
    currentScenario[tool] = "";
    loadedSnapshot[tool] = null;
  }
  refreshScenarioList(currentScenario[tool] || "");
  toast("Deleted " + name);
}
/* Reset only the tool you're viewing, and ask first if anything differs from
   defaults — the button sits close to the tabs on mobile. */
const TAX_DEFAULTS = {mode:"normal", gross:100000, gross2:0, status:"s", state:"IL", pre:0,
                      dedType:"std", item:0, trad:40000, roth:10000, brok:20000,
                      gainPct:40, ss:30000, other:0, seniors:1};
const MORT_DEFAULTS = {price:450000, downPct:20, downAmt:90000, rate:MORT_RATE_30,
  term:"30", tax:1.1, ins:1800, pmi:0, hoa:0, maint:1, util:300,
  extrasOn:"0", extraMo:0, extraOnce:0, extraWhen:12, recast:"0",
  refiRate:0, refiTerm:"30", refiCost:0};
function sameShallow(a, b){
  for (const k in b) if (String(a[k]) !== String(b[k])) return false;
  return true;
}
/* Healthcare and FIRE keep their defaults in the markup itself, as each
   field's value attribute and each select's selected option, so resetting
   them means putting those back rather than keeping a second copy here. */
function asideControls(id){
  return Array.prototype.slice.call($(id).querySelectorAll("input, select"));
}
function asideDefault(el){
  if (el.tagName === "SELECT"){
    const opts = Array.prototype.slice.call(el.options);
    const d = opts.find(o => o.defaultSelected) || opts[0];
    return d ? d.value : "";
  }
  return el.hasAttribute("data-money")
    ? groupDigits(el.defaultValue, el.hasAttribute("data-nonneg")) : el.defaultValue;
}
/* Healthcare and FIRE have no state objects of their own; every input they
   read sits in their side panel, so a saved scenario is those fields by id. */
function readAsideState(id){
  const o = {};
  asideControls(id).forEach(el => { if (el.id) o[el.id] = el.value; });
  return o;
}
function writeAsideState(id, d){
  if (!d) return;
  asideControls(id).forEach(el => { if (el.id && d[el.id] != null) el.value = d[el.id]; });
}
function writeFireState(d){
  writeAsideState("asideFire", d);
  const want = d && d.mode === "coast" ? "coast" : "fire";
  const btn = $("segFireMode").querySelector('button[data-firemode="' + want + '"]');
  if (btn && !btn.classList.contains("on")) btn.click();
  $("fiTarget").dispatchEvent(new Event("input", {bubbles:true}));
}
function resetAsideDefaults(id){
  asideControls(id).forEach(el => { el.value = asideDefault(el); });
}
function asideIsDirty(id){
  return asideControls(id).some(el => String(el.value) !== String(asideDefault(el)));
}
function toolIsDirty(tool){
  if (tool === "healthcare") return asideIsDirty("asideHC");
  if (tool === "bridge") return asideIsDirty("asideBR");
  if (tool === "optimizer") return asideIsDirty("asideOP");
  if (tool === "fire") return asideIsDirty("asideFire") ||
    !!$("segFireMode").querySelector('button[data-firemode="coast"].on');
  if (tool === "tax") return !sameShallow(readTaxState(), TAX_DEFAULTS);
  if (tool === "mortgage") return !sameShallow(readMortState(), MORT_DEFAULTS);
  if (tool === "budget") return num("bgIncomeIn") > 0 ||
    budget.some(r => r.amount > 0 || r.custom);
  if (tool === "college") return !sameShallow(readCollegeState(), CL_DEFAULTS);
  if (tool === "rentbuy") return !sameShallow(readRBState(), RB_DEFAULTS);
  if (tool === "roth") return !sameShallow(readRCState(), RC_DEFAULTS);
  if (tool === "debt") return num("dtExtra") > 0 || dtMode !== "avalanche" ||
    debts.length !== DEBT_DEFAULTS.length ||
    debts.some((d, i) => {
      const x = DEBT_DEFAULTS[i];
      return !x || d.desc !== x.desc || d.balance !== x.balance ||
        d.apr !== x.apr || d.min !== x.min;
    });
  if (tool === "backtest") return !sameShallow(readBTState(), BT_DEFAULTS);
  if (tool === "drawdown") return !sameShallow(readDDState(), DD_DEFAULTS) || ddPathStages.length > 0 ||
    ddIncomeItems.some(it => it.on !== false) || ddExpenseItems.some(it => it.on !== false);
  if (tool === "basic"){
    const b = readBasic();
    return b.age !== BASIC_DEFAULTS.age || b.retire !== BASIC_DEFAULTS.retire ||
      b.initial !== BASIC_DEFAULTS.saved || b.contrib !== BASIC_DEFAULTS.contrib ||
      b.period !== BASIC_DEFAULTS.period || Math.abs(b.real - BASIC_DEFAULTS.risk) > 1e-9;
  }
  if (tool === "stages"){
    const g = readGlobals();
    return !!g.acct || Math.abs(g.initial - SERIES_GLOBALS.initial) > 1e-9 ||
      Math.abs(g.inflation - SERIES_GLOBALS.inflation) > 1e-9 ||
      Math.abs(g.withdrawal - SERIES_GLOBALS.withdrawal) > 1e-9 ||
      Math.abs(g.taxRate - SERIES_GLOBALS.taxRate) > 1e-9 ||
      Math.abs((g.fees||0) - (SERIES_GLOBALS.fees||0)) > 1e-9 ||
      stages.length !== SERIES_STAGES.length ||
      stages.some((st, i) => {
        const d = SERIES_STAGES[i];
        if (!d) return true;
        return st.years !== d.years || st.contrib !== d.contrib || st.period !== d.period ||
          Math.abs(st.growth - d.growth) > 1e-9 || Math.abs(st.nominal - d.nominal) > 1e-9;
      });
  }
  // advanced
  const d = readInputs();
  return !!d.acct || d.initial !== DEFAULTS.initial || d.contrib !== DEFAULTS.contrib ||
    d.period !== DEFAULTS.period || d.years !== DEFAULTS.years ||
    Math.abs(d.growth - DEFAULTS.growth) > 1e-9 ||
    Math.abs(d.nominal - DEFAULTS.nominal) > 1e-9 ||
    Math.abs(d.inflation - DEFAULTS.inflation) > 1e-9 ||
    Math.abs(d.withdrawal - DEFAULTS.withdrawal) > 1e-9 ||
    Math.abs(d.taxRate - DEFAULTS.taxRate) > 1e-9 || (d.fees||0) !== 0;
}
function writeBasic(d){
  $("qAge").value = d.age; $("qRetire").value = d.retire;
  $("qSaved").value = groupDigits(d.saved, true);
  $("qContrib").value = groupDigits(d.contrib, true);
  $("qPeriod").value = d.period;
  $("qRisk").value = d.risk;
}
/* Storage shapes for the three retirement scenario lists \u2014 distinct from
   readBasic()/readInputs(), which return the richer runtime shape those
   modes compute with. Kept minimal so saved scenarios stay easy to read. */
function readBasicState(){
  const b = readBasic();
  return {age:b.age, retire:b.retire, saved:b.initial, contrib:b.contrib,
          period:b.period, risk:b.real};
}
/* The historical chart's stock mix (and the mix a glide ends at) belong
   to the scenario too, alongside Monte Carlo's volatility in the inputs. */
function readAdvancedState(){
  return Object.assign({}, readInputs(),
    {solveFor:$("solveFor").value, target:num("target"),
     histMix:num("histMix"), histMixEnd:num("histMixEnd")});
}
function writeAdvancedState(d){
  writeInputs(d);
  if (d.histMix != null) $("histMix").value = d.histMix;
  if (d.histMixEnd != null) $("histMixEnd").value = d.histMixEnd;
  if (d.solveFor) $("solveFor").value = d.solveFor;
  if (d.target != null) $("target").value = groupDigits(d.target, true);
}
function readStagesState(){
  return {globals: readGlobals(), stages: stages.map(x => Object.assign({}, x)),
          solveForS: $("solveForS").value, targetS: num("targetS"),
          histMix: num("histMixS"), histMixEnd: num("histMixEndS")};
}
function writeStagesState(d){
  if (d.globals) writeGlobals(d.globals);
  if (d.histMix != null) $("histMixS").value = d.histMix;
  if (d.histMixEnd != null) $("histMixEndS").value = d.histMixEnd;
  if (Array.isArray(d.stages)) stages = d.stages.map(x => Object.assign({}, x));
  buildStages();
  if (d.solveForS) $("solveForS").value = d.solveForS;
  if (d.targetS != null) $("targetS").value = groupDigits(d.targetS, true);
  renderSeries();
}
$("btnReset").addEventListener("click", () => {
  // nothing to reset on About; the guide has its own Start over
  if (chartMode.tab === "about" || chartMode.tab === "guide") return;
  if (chartMode.tab === "compare"){ toast("Nothing to reset here"); return; }
  // the tool picker has no inputs of its own
  if (chartMode.tab === "tools" && toolSub === "picker") return;
  const tool = activeTool();
  const label = tool === "basic" ? "Basic" : tool === "stages" ? "Stages" :
    tool === "advanced" ? "Advanced" : tool === "tax" ? "Tax" :
    tool === "mortgage" ? "Mortgage" : tool === "college" ? "College" :
    tool === "rentbuy" ? "Rent vs. Buy" : tool === "drawdown" ? "Drawdown" :
    tool === "roth" ? "Roth Conversion" :
    tool === "debt" ? "Debt Payoff" :
    tool === "healthcare" ? "Healthcare" : tool === "fire" ? "FIRE Calculator" :
    tool === "bridge" ? "Early Retirement Bridge" : tool === "optimizer" ? "Plan Optimizer" :
    tool === "backtest" ? "Portfolio Backtest" : "Budget";
  if (toolIsDirty(tool) &&
      !confirm("Reset the " + label +
               " inputs to their defaults? Your saved " + TOOL_LABEL[tool] +
               "s won't be affected.")) return;
  if (tool === "tax"){
    writeTaxState(TAX_DEFAULTS); renderTax();
  } else if (tool === "mortgage"){
    writeMortState(MORT_DEFAULTS); syncPmi(); renderMort();
    $("moExtrasWrap").hidden = true;
  } else if (tool === "budget"){
    budget = defaultBudget(); $("bgIncomeIn").value = groupDigits(0, true);
    bgIncomeFreq = 1;
    $("bgIncomeFreq").querySelectorAll("button").forEach(x =>
      x.classList.toggle("on", x.getAttribute("data-freq") === "1"));
    buildBudget(); renderBudget();
  } else if (tool === "college"){
    writeCollegeState(CL_DEFAULTS); renderCollege();
  } else if (tool === "rentbuy"){
    writeRBState(RB_DEFAULTS); renderRentBuy();
  } else if (tool === "drawdown"){
    writeDDState(DD_DEFAULTS);
    ddIncomeItems.forEach(it => { it.on = false; });
    ddExpenseItems.forEach(it => { it.on = false; });
    renderItemLists(); renderDrawdown();
  } else if (tool === "backtest"){
    writeBTState(BT_DEFAULTS);
    btRoll = "nom";
    $("segBTRoll").querySelectorAll("button").forEach(x =>
      x.classList.toggle("on", x.getAttribute("data-roll") === "nom"));
    $("segBTEra").querySelectorAll("button").forEach(x =>
      x.classList.toggle("on", x.getAttribute("data-era") === "all"));
    renderBacktest();
  } else if (tool === "roth"){
    writeRCState(RC_DEFAULTS); renderRoth();
  } else if (tool === "debt"){
    debts = defaultDebts(); dtMode = "avalanche";
    $("dtExtra").value = groupDigits(300, true);
    $("segDT").querySelectorAll("button").forEach(x =>
      x.classList.toggle("on", x.getAttribute("data-dt") === "avalanche"));
    buildDebtList(); renderDebt();
  } else if (tool === "bridge"){
    resetAsideDefaults("asideBR");
    renderBridge();
  } else if (tool === "optimizer"){
    resetAsideDefaults("asideOP");
    renderOptimizer();
  } else if (tool === "healthcare"){
    resetAsideDefaults("asideHC");
    renderHealthcare();
  } else if (tool === "fire"){
    resetAsideDefaults("asideFire");
    const fireBtn = $("segFireMode").querySelector('button[data-firemode="fire"]');
    if (fireBtn && !fireBtn.classList.contains("on")) fireBtn.click();
    $("fiTarget").dispatchEvent(new Event("input", {bubbles:true}));
  } else if (tool === "basic"){
    writeBasic(BASIC_DEFAULTS);
    renderBasic();
  } else if (tool === "stages"){
    writeGlobals(SERIES_GLOBALS);
    $("targetS").value = groupDigits(100000);
    stages = SERIES_STAGES.map(x => Object.assign({}, x));
    buildStages();
    renderSeries();
  } else {
    writeInputs(DEFAULTS);
    renderAll();
  }
  // With a household profile on file, "defaults" means your numbers, not ours.
  const fromHH = hhApply(hhLoad(), tool).length > 0;
  if (fromHH) hhRerender();
  currentScenario[tool] = "";
  loadedSnapshot[tool] = null;
  refreshScenarioList("");
  toast(label + (fromHH ? " reset to your household numbers" : " inputs reset"));
});

