/* ---------- withdrawal strategy guide ---------- */
/* One pop-up that walks through every strategy side by side, in place of a
   one-line description under the picker. Each section can apply its strategy
   directly. */
var DD_GUIDE = [
  {k:"fixed", name:"Fixed amount, rising with inflation", tag:"The 4% rule",
   how:"Take a set share of the portfolio in the first year, say 4%, then give yourself the same amount plus inflation every year after, whatever markets do. It comes from William Bengen's 1994 study of US history, where 4% lasted through every 30-year retirement he tested.",
   pros:["The steadiest income of any strategy: you know next year's number","Simple to follow and to budget around","Easy to compare with a pension or annuity quote"],
   cons:["Never reacts to markets, so a bad first decade can empty the portfolio","In good markets it leaves a large balance unspent","The safe starting rate depends heavily on how long retirement lasts"],
   fit:"You want a predictable paycheck and have other ways to adapt, such as cutting back by choice if markets fall hard."},
  {k:"pct", name:"Fixed percentage of the portfolio", tag:"Constant percentage",
   how:"Take the same percentage of whatever the portfolio is worth at the start of each year. A 20% fall in the portfolio means a 20% cut in income the next year.",
   pros:["Mathematically can't run out: you only ever take a slice of what's left","Spends more automatically when markets do well","One number to remember"],
   cons:["Income swings as much as the portfolio does","A long bear market can push spending well below what you need","Tends to leave a sizable balance at the end"],
   fit:"Social Security, a pension or other income covers your essentials, and the portfolio pays for flexible spending. Pair it with a minimum spending amount."},
  {k:"guardrails", name:"Guyton-Klinger guardrails", tag:"Rules-based adjustments",
   how:"Start like the fixed-amount method and raise spending with inflation. Each year, compare what you're about to take with the portfolio's value. If that rate has drifted too far above where you started (the upper guardrail, often 20% above), cut spending by a set step, often 10%. If it falls too far below (the lower guardrail), take a raise, often also 10%. The two guardrails can be set differently, for example to cut sooner than you raise. Jonathan Guyton and William Klinger published the rules in 2006, and their paper skips cuts in the final 15 years, when too little time is left for a bad run to empty the portfolio; tick <b>No cuts in the final</b> to use that rule too, and <b>Skip the inflation raise after a losing year</b> for their inflation rule, which skips it when the withdrawal rate is also above where it started.",
   pros:["Supports a higher starting rate than the 4% rule, often 5% or more","Income stays steady most years and changes only when a guardrail is hit","Reacts to a bad market before it becomes a crisis","Cuts and raises can be tuned separately, and cuts can stop late in retirement"],
   cons:["Cuts arrive as sudden 10% steps, and a long downturn can bring several","More rules to track each year","The historical record behind it is shorter than for the 4% rule"],
   fit:"You'd accept an occasional real pay cut in exchange for more income to start with."},
  {k:"riskgr", name:"Risk-based guardrails", tag:"Guardrails on the odds",
   how:"Instead of guardrails on the withdrawal rate, put them on the plan's chance of success. Start at the spending with, say, a 90% chance of lasting, by history at your stock mix, counting Social Security and pensions still to come. Hold it, raised with inflation, until that chance falls below a lower line (70%) or climbs above an upper one (99%), then reset spending to the 90% level. Financial planners using tools like Income Lab made it popular.",
   pros:["Changes only when the odds really move, so changes are fewer and better timed","Counts income that hasn't started yet","Raises come when the plan is clearly ahead"],
   cons:["A reset to the target can be a big step","The odds are only as good as the history behind them","Spends down to nothing by the horizon"],
   fit:"You think in odds and want rules that react to how the whole plan is doing, not one rate."},
  {k:"floorceil", name:"Floor and ceiling", tag:"Limits on each year's change",
   how:"Aim at a percentage of the current portfolio each year, like the fixed-percentage method, but limit how far spending can move from last year's inflation-adjusted amount: no more than the maximum raise up, and no more than the maximum cut down. Vanguard's version, with a 5% raise and a 2.5% cut, has its own entry below.",
   pros:["Follows the market, but in gentle steps","You set exactly how big a single year's change can be","A good middle ground between fixed income and fixed percentage"],
   cons:["In a long downturn the small cuts keep adding up","The cap on raises means spending catches up slowly after a strong run","Can drift away from the target percentage for years"],
   fit:"You want spending to respond to markets but can't absorb a large cut in any single year."},
  {k:"vanguard", name:"Vanguard dynamic spending", tag:"Vanguard's floor and ceiling",
   how:"Vanguard's version of floor and ceiling: aim at a share of the current portfolio, but let spending rise at most 5% and fall at most 2.5% from last year's, after inflation. Vanguard's research presents it as a middle way between a fixed amount and a fixed percentage.",
   pros:["Small cuts: 2.5% at most in a year","Follows markets over time","Widely used, with published research behind it"],
   cons:["A long downturn brings a long string of cuts","Slow to pass on good years","The small cuts can let the portfolio slide in a deep bear market"],
   fit:"You want spending that tracks markets in small, predictable steps."},
  {k:"yale", name:"Yale endowment rule", tag:"Smoothed percentage",
   how:"Each year's spending is a blend: mostly last year's spending plus inflation, and a smaller share based on a target percentage of the current portfolio. Yale's endowment has used a version of this for decades, with 70/30 the commonly cited weighting.",
   pros:["Very smooth income: a crash filters in over several years, not all at once","Still follows the portfolio over the long run","Proven in practice by large endowments"],
   cons:["Slow to react, so it can keep spending too much early in a prolonged decline","Equally slow to pass on good years","Endowments plan to last forever; a person doesn't, so it can leave money unspent"],
   fit:"Stable year-to-year income matters most to you, and you'd rather adjust slowly than sharply."},
  {k:"kitces", name:"Kitces ratchet", tag:"Never a cut, sometimes a raise",
   how:"Start like the 4% rule: year one's amount, raised with inflation every year. Then, whenever the portfolio has grown to 50% above its starting value after inflation, raise spending 10% for good, and don't raise again for at least three years. Spending never falls. Michael Kitces showed that from a 4% start most historical retirements earned several raises without adding real risk, because the raises only come once the portfolio has pulled well ahead.",
   pros:["Never asks for a cut","Spends more after good starts instead of leaving it all to heirs","As safe as the fixed amount in the bad starts, where no raise ever comes"],
   cons:["Starts as low as the 4% rule","Raises are permanent, so a later crash isn't cushioned","Still leaves a lot unspent when markets do merely well"],
   fit:"You want the 4% rule's safety, with a share of the upside if markets do well early."},
  {k:"clyatt", name:"95% rule", tag:"Bob Clyatt's rule",
   how:"Take a set share of the portfolio each year, usually 4%, but never less than 95% of what you spent last year, in dollars. A falling market brings a run of cuts of 5% or less instead of one deep one, and a rising market lets spending follow it up. Bob Clyatt described it in <i>Work Less, Live More</i>.",
   pros:["No year's cut is more than 5%","Follows strong markets up","Simple to apply"],
   cons:["Can run out: in a long slump the floor keeps drawing on a falling portfolio","Spending still drifts down through a long bear market","Its floor is in dollars, so inflation deepens each cut"],
   fit:"You can live with gradual cuts but not a sudden one."},
  {k:"oneovern", name:"1/N", tag:"Spend it all, on schedule",
   how:"Divide the balance by the number of years left: a thirtieth in the first year of a 30-year plan, half in the second-to-last, all of it in the last. Some pensions and annuities spread money over a fixed term this way.",
   pros:["Uses everything by the end","Can't run out before the horizon","Nothing to set"],
   cons:["Starts lower than most strategies","Late-retirement spending swings hard with markets","Nothing left if you outlive the horizon"],
   fit:"You have a firm horizon, want to use your savings fully, and have Social Security or a pension underneath."},
  {k:"rmd", name:"RMD method", tag:"The IRS table",
   how:"Each year, divide the balance by the IRS life-expectancy divisor for your age, the same table that sets required minimum distributions from IRAs. The share rises from about 3% in your 60s to about 6% at 85 and more after. Wei Sun and Anthony Webb found it a sound rule of thumb for spending from savings. The table starts at 72, so below that this carries its trend down.",
   pros:["Follows your age and how long the money has to last","Can't run out","Easy to follow: the IRS publishes the divisors"],
   cons:["Spending moves with markets","Starts low for an early retiree","Ignores your other income"],
   fit:"You want a simple, age-aware percentage, and Social Security covers your essentials."},
  {k:"vpw", name:"Variable percentage withdrawal (VPW)", tag:"The Bogleheads method",
   how:"Each year, work out the level payment that would draw today's balance down to your future value (usually $0) over the years left, at an expected return after inflation. It's the spreadsheet PMT formula, the same math as a loan: =PMT(rate, years left, -balance, future value, 1). With 30 years left the share is modest; with 5 left it's large, so the percentage climbs every year. Here the horizon is the years in retirement you set; the Bogleheads tables plan to age 100.",
   pros:["Built not to run out before the horizon, since it only ever pays out what's there","Spends the portfolio instead of leaving an accidental fortune","Transparent: one formula and two inputs you can check yourself"],
   cons:["Income moves with the market, much like the fixed percentage","Spends toward the future value by the end, so choose a horizon you won't outlive","Later withdrawals are a large share of a shrinking balance, so late-life income is volatile"],
   fit:"You want to use your savings fully, have Social Security or a pension as a floor, and can flex spending with markets."},
  {k:"hebeler", name:"Hebeler Autopilot II", tag:"A smoothed annuity",
   how:"Each year, take 75% of last year's spending raised for inflation, plus 25% of a fresh calculation: the level payment that would spend the balance over the years left at an expected real return. Henry Hebeler designed it to run on autopilot.",
   pros:["Very smooth from year to year","Self-correcting: the payment part pulls spending toward what the portfolio can support","Uses the portfolio over the plan"],
   cons:["Slow to cut in a long decline","Depends on the expected return you choose","Can leave little at the end"],
   fit:"You want smooth income that still adjusts to the portfolio over time."},
  {k:"sensible", name:"Sensible withdrawals", tag:"A base plus a bonus",
   how:"Spend a steady base every year, a share of the starting portfolio raised with inflation, plus a bonus: a share of the previous year's real investment gains, when there were any. Bad years take you back to the base.",
   pros:["The base is predictable","Good years pay a bonus","Leaves most gains invested"],
   cons:["The base never adjusts, so it's as exposed as the fixed amount","Bonuses come and go","Spends less than it could after long good runs"],
   fit:"You budget essentials from the base and treat the bonus as extra."},
  {k:"cape", name:"CAPE-based", tag:"Valuation-aware",
   how:"Each year's rate is a base plus a share of the stock market's earnings yield, 1 \u00f7 CAPE (Shiller's cyclically adjusted P/E), applied to the current portfolio: 1.75% plus half of 1/CAPE is a common setting. When stocks are cheap it spends more; when they're dear, less. Karsten Jeske (Early Retirement Now) popularized it.",
   pros:["Spends less when expected returns are low and more when they're high","Responds to valuations, not just past returns","Can't run out"],
   cons:["Income moves with markets and with valuations","With the CAPE near record highs, it starts low today","The link between CAPE and later returns is real but loose"],
   fit:"You think valuations matter and can flex your spending."}
];
function openStrategyGuide(){
  var cur = $("ddStrategy").value;
  var list = function(items){ return "<ul>" + items.map(function(t){ return "<li>" + t + "</li>"; }).join("") + "</ul>"; };
  var cmp = "<div class='sg-cmpwrap'><table class='sg-cmp'><thead><tr><th>Strategy</th><th>Income stability</th><th>Can run out</th><th>Left at the end</th></tr></thead><tbody>" +
    [["Fixed amount","Highest","Yes","Often a lot"],
     ["Kitces ratchet","High, and only rises","Yes","Often a lot"],
     ["Fixed percentage","Lowest","No","Often a lot"],
     ["95% rule","Moderate","Yes, in a long slump","Moderate"],
     ["1/N","Low","Not before the horizon","Nothing"],
     ["RMD method","Low to moderate","No","Moderate"],
     ["VPW","Low to moderate","Not before the horizon","About the future value"],
     ["Guardrails","High, with occasional steps","Rarely","Moderate"],
     ["Risk-based guardrails","High, with occasional resets","Rarely","Little, by design"],
     ["Floor and ceiling","High","Rarely","Moderate"],
     ["Vanguard dynamic","High","Rarely","Moderate"],
     ["Yale endowment","High, slow to change","Sometimes","Moderate"],
     ["Autopilot II","High, slow to change","Rarely","Little"],
     ["Sensible withdrawals","Moderate","Yes","Often a lot"],
     ["CAPE-based","Low to moderate","No","Moderate"]]
    .map(function(r){ return "<tr><td>" + r.join("</td><td>") + "</td></tr>"; }).join("") + "</tbody></table></div>";
  // Each strategy's spending through one hard start, with your plan's other
  // inputs, so its character shows at a glance.
  var o = readDD(), w = o.initial > 0 ? ddHardStart(o) : null;
  var when = w ? (w.month !== 1 ? HIST_MON[w.month - 1] + " " : "") + w.year : "";
  var spark = function(k){
    if (!w) return "";
    var x = Object.assign({}, o, {strategy:k}), vals = ddSpendThrough(x, w);
    var lo = Math.min.apply(null, vals);
    return "<div class='sg-spark'>" + ddSpark(vals, {w:300, h:40}) +
      "<span>Retiring in " + when + ", with your plan: " + money(vals[0]) + " in year one, " + money(lo) + " at the lowest</span></div>";
  };
  var byKey = {};
  DD_GUIDE.forEach(function(g){ byKey[g.k] = g; });
  var body = Object.keys(DD_FAMILY).map(function(fam){
    var items = DD_ORDER.filter(function(k){ return DD_STRAT[k].family === fam && byKey[k]; });
    if (!items.length) return "";
    return "<h4 class='sg-fam'>" + DD_FAMILY[fam] + "</h4>" + items.map(function(k){
      var g = byKey[k];
      return "<section class='sg-item" + (g.k === cur ? " sg-cur" : "") + "'>" +
        "<div class='sg-head'><h4>" + g.name + "</h4><span class='sg-tag'>" + g.tag + "</span>" +
        (g.k === cur ? "<span class='sg-using'>Selected</span>"
          : "<button type='button' class='btn mini' data-usestrat='" + g.k + "'>Use this strategy</button>") + "</div>" +
        spark(g.k) +
        "<p>" + g.how + "</p>" +
        "<div class='sg-pc'><div><div class='sg-lbl pos'>Pros</div>" + list(g.pros) + "</div>" +
        "<div><div class='sg-lbl neg'>Cons</div>" + list(g.cons) + "</div></div>" +
        "<p class='sg-fit'><b>A good fit if:</b> " + g.fit + "</p></section>";
    }).join("");
  }).join("");
  var ov = document.createElement("div");
  ov.className = "popup-overlay";
  ov.innerHTML = "<div class='popup guide'>" +
    "<div class='sg-top'><h3>How the withdrawal strategies compare</h3>" +
    "<button type='button' class='sg-close' aria-label='Close'>&times;</button></div>" +
    "<p class='sg-intro'>Every strategy trades a steady income against protection from running out. " +
    "Rules that never cut spending can run dry in a bad decade; rules that follow the market can't run out, " +
    "but your income moves with it. The minimum and maximum spending limits work with every strategy except fixed amount, " +
    "and the spending path and guaranteed income with all of them. To see them all at the same risk, open <b>Compare strategies</b> in the results.</p>" +
    cmp + body +
    "<p class='sg-foot'>Test any of them against every retirement since 1926 with the simulator; the success rate " +
    "and the income chart show the trade-off for your own numbers.</p></div>";
  var shut = function(){ if (ov._modalDone) ov._modalDone(); ov.remove(); };
  ov.addEventListener("click", function(e){
    var use = e.target.closest ? e.target.closest("[data-usestrat]") : null;
    if (use){
      $("ddStrategy").value = use.getAttribute("data-usestrat");
      shut();
      renderDrawdown();
      toast("Using " + DD_STRAT_NAMES[use.getAttribute("data-usestrat")]);
      return;
    }
    if (e.target === ov || (e.target.closest && e.target.closest(".sg-close"))) shut();
  });
  document.body.appendChild(ov);
  wireModal(ov, shut);
  var closeBtn = ov.querySelector(".sg-close");
  if (closeBtn) closeBtn.focus();
}
$("ddStratGuide").addEventListener("click", openStrategyGuide);

function showPopup(title, options){
  return new Promise(resolve => {
    const ov = document.createElement("div");
    ov.className = "popup-overlay";
    ov.innerHTML = "<div class='popup'><h3>" + title + "</h3>" +
      options.map((o, i) => "<button class='popbtn' data-pop='" + i + "'>" +
        o.label + (o.desc ? "<span class='subdesc" + (o.money ? " money" : "") + "'>" + o.desc + "</span>" : "") +
        "</button>").join("") +
      "<button class='cancel'>Cancel</button></div>";
    const shut = () => { if (ov._modalDone) ov._modalDone(); ov.remove(); };
    ov.addEventListener("click", e => {
      const b = e.target.closest ? e.target.closest("[data-pop]") : null;
      if (b){ shut(); resolve(parseInt(b.getAttribute("data-pop"), 10)); return; }
      if (e.target.classList.contains("cancel") || e.target === ov){
        shut(); resolve(-1); }
    });
    document.body.appendChild(ov);
    wireModal(ov, () => { shut(); resolve(-1); });
    const firstBtn = ov.querySelector(".popbtn");
    if (firstBtn) firstBtn.focus();
  });
}

/* A real form popup for adding a custom income or expense source, since the
   simple choice-list showPopup() above doesn't fit a multi-field form. Kind
   is "income" or "expense", used only for the title text and a default name
   hint; the returned item shape is identical either way \u2014 runDrawdown()
   treats them as two separate arrays but the same structure. */
function showItemForm(kind, existing){
  return new Promise(resolve => {
    const isIncome = kind === "income";
    const ageMode = ddRetireAge != null;
    const d = existing
      ? {
          name: existing.name,
          annual: existing.annual,
          inflate: existing.inflate !== false,
          startYear: existing.startYear || 1,
          durationType: (existing.duration && existing.duration.type) || "forever",
          durationYears: (existing.duration && existing.duration.years) || 5
        }
      : {name:"", annual:0, inflate:true, startYear:1, durationType:"forever", durationYears:5};
    const ov = document.createElement("div");
    ov.className = "popup-overlay";
    ov.innerHTML =
      "<div class='popup wide'><h3>" + (existing ? "Edit " : "Add ") +
        (isIncome ? "income source" : "future expense") + "</h3>" +
      "<div class='formhint'>" + (isIncome
        ? "A pension, rental property, part-time work, an inheritance: anything that offsets what you'd otherwise withdraw."
        : "A car, a boat, long-term care costs: anything on top of your regular spending.") + "</div>" +
      "<div class='formfield'><label>Name</label>" +
        "<input class='forminput' id='itName' type='text' maxlength='40' placeholder='" +
        (isIncome ? "e.g. Pension" : "e.g. New car") + "' value='" + cardEscape(d.name) + "'></div>" +
      "<div class='formfield'><label>Annual amount, today's dollars</label>" +
        "<div class='formwrap'><span class='affix'>$</span>" +
        "<input id='itAmount' type='text' inputmode='decimal' data-money data-nonneg value='" + (d.annual ? groupDigits(d.annual, true) : "") + "'></div></div>" +
      "<label class='formcheck'><input type='checkbox' id='itInflate'" + (d.inflate ? " checked" : "") + "> " +
        "Adjust for inflation over time</label>" +
      "<div class='formtwo'>" +
        "<div class='formfield'><label>" + (ageMode ? "Starts at age" : "Starts in year") + "</label>" +
          "<div class='formwrap'><input id='itStartYear' type='text' inputmode='decimal' value='" +
            (ageMode ? ddAgeVal(d.startYear) : d.startYear) + "'><span class='affix'>" +
            (ageMode ? "yrs" : "of ret.") + "</span></div></div>" +
        "<div class='formfield'><label>Lasts</label>" +
          "<select class='forminput' id='itDuration'>" +
            "<option value='once'" + (d.durationType === "once" ? " selected" : "") + ">One time only</option>" +
            "<option value='years'" + (d.durationType === "years" ? " selected" : "") + ">A number of years</option>" +
            "<option value='forever'" + (d.durationType === "forever" ? " selected" : "") + ">Rest of retirement</option>" +
          "</select></div>" +
      "</div>" +
      "<div class='formfield' id='itYearsWrap'" + (d.durationType === "years" ? "" : " hidden") + ">" +
        "<label>Number of years</label>" +
        "<div class='formwrap'><input id='itYears' type='text' inputmode='decimal' value='" + d.durationYears + "'><span class='affix'>yrs</span></div></div>" +
      "<div class='formactions'>" +
        "<button class='btn cancel' type='button'>Cancel</button>" +
        "<button class='btn primary' type='button' id='itSave'>" + (existing ? "Save" : "Add") + "</button>" +
      "</div></div>";

    const durSel = ov.querySelector("#itDuration");
    durSel.addEventListener("change", () => {
      ov.querySelector("#itYearsWrap").hidden = (durSel.value !== "years");
    });
    ov.querySelector("#itSave").addEventListener("click", () => {
      const name = ov.querySelector("#itName").value.trim() || (isIncome ? "Income" : "Expense");
      const annual = parseNum(ov.querySelector("#itAmount").value);
      if (!(annual > 0)){ toast("Enter an amount greater than zero"); return; }
      const rawStart = Math.round(parseNum(ov.querySelector("#itStartYear").value)) ||
        (ageMode ? ddRetireAge : 1);
      const startYear = ageMode ? Math.max(1, rawStart - ddRetireAge + 1) : Math.max(1, rawStart);
      const durationType = durSel.value;
      const durationYears = Math.max(1, Math.round(parseNum(ov.querySelector("#itYears").value)) || 1);
      if (ov._modalDone) ov._modalDone();
      ov.remove();
      resolve({
        name, annual, inflate: ov.querySelector("#itInflate").checked,
        startYear, on: existing ? existing.on : true,
        duration: durationType === "years" ? {type:"years", years:durationYears} : {type:durationType}
      });
    });
    const shut = () => { if (ov._modalDone) ov._modalDone(); ov.remove(); };
    ov.addEventListener("click", e => {
      if (e.target.classList.contains("cancel") || e.target === ov){ shut(); resolve(null); }
    });
    document.body.appendChild(ov);
    initFields(ov);
    wireModal(ov, () => { shut(); resolve(null); });
    ov.querySelector("#itName").focus();
  });
}
/* Renders the compact list of custom income/expense items under the sidebar
   buttons: a checkbox to disable without deleting, a one-line summary, and a
   delete button. Clicking the summary text reopens the form to edit it. */
function describeItem(it){
  var when = it.startYear === 1 ? "starting immediately"
    : ddRetireAge != null ? "starting at age " + ddAgeVal(it.startYear)
    : "starting year " + it.startYear;
  var dur = it.duration.type === "once" ? "one time" :
    it.duration.type === "years" ? "for " + it.duration.years + " years" : "rest of retirement";
  var infl = it.inflate ? "inflation-adjusted" : "fixed amount";
  return money(it.annual) + "/yr, " + when + ", " + dur + " \u00b7 " + infl;
}
function renderItemList(elId, items){
  var box = $(elId);
  if (!items.length){ box.innerHTML = ""; return; }
  box.innerHTML = items.map(function(it, i){
    return "<div class='itemrow" + (it.on === false ? " off" : "") + "'>" +
      "<input type='checkbox' data-itemtoggle='" + i + "'" + (it.on === false ? "" : " checked") + ">" +
      "<span class='itemtxt' data-itemedit='" + i + "'>" + cardEscape(it.name) +
        "<small>" + describeItem(it) + "</small></span>" +
      "<button class='itemdel' type='button' data-itemdel='" + i + "' aria-label='Delete'>&times;</button>" +
    "</div>";
  }).join("");
}
function renderItemLists(){
  renderItemList("ddIncomeList", ddIncomeItems);
  renderItemList("ddExpenseList", ddExpenseItems);
}
renderItemLists();

$("ddAddIncome").addEventListener("click", async () => {
  var item = await showItemForm("income", null);
  if (!item) return;
  ddIncomeItems.push(item);
  renderItemLists();
  renderDrawdown();
  toast("Added " + item.name);
});
$("ddAddExpense").addEventListener("click", async () => {
  var item = await showItemForm("expense", null);
  if (!item) return;
  ddExpenseItems.push(item);
  renderItemLists();
  renderDrawdown();
  toast("Added " + item.name);
});

function wireItemList(elId, items){
  $(elId).addEventListener("click", async (e) => {
    var del = e.target.closest ? e.target.closest("[data-itemdel]") : null;
    if (del){
      var i = parseInt(del.getAttribute("data-itemdel"), 10);
      var name = items[i] ? items[i].name : "Item";
      items.splice(i, 1);
      renderItemLists();
      renderDrawdown();
      toast("Removed " + name);
      return;
    }
    var edit = e.target.closest ? e.target.closest("[data-itemedit]") : null;
    if (edit){
      var j = parseInt(edit.getAttribute("data-itemedit"), 10);
      var existing = items[j];
      if (!existing) return;
      var kind = elId === "ddIncomeList" ? "income" : "expense";
      var updated = await showItemForm(kind, existing);
      if (!updated) return;
      items[j] = updated;
      renderItemLists();
      renderDrawdown();
      return;
    }
  });
  $(elId).addEventListener("change", (e) => {
    var t = e.target.closest ? e.target.closest("[data-itemtoggle]") : null;
    if (!t) return;
    var i = parseInt(t.getAttribute("data-itemtoggle"), 10);
    if (!items[i]) return;
    items[i].on = t.checked;
    renderItemList(elId, items);
    renderDrawdown();
  });
}
wireItemList("ddIncomeList", ddIncomeItems);
wireItemList("ddExpenseList", ddExpenseItems);


$("btnScenario").addEventListener("click", async () => {
  if (activeTool() === "guide"){
    const c = await showPopup("Readiness plan", [
      {label:"Save", desc:"Save your answers and plan under a name"},
      {label:"Delete", desc:"Remove the selected saved plan"}
    ]);
    if (c === 0) doSave();
    else if (c === 1) doDelete();
    return;
  }
  const choice = await showPopup("Scenario", [
    {label:"Save", desc:"Save the current inputs under a name"},
    {label:"Delete", desc:"Remove the selected saved scenario"},
    {label:"Compare", desc:"Put saved retirement scenarios side by side"}
  ]);
  if (choice === 0) doSave();
  else if (choice === 1) doDelete();
  else if (choice === 2){ paneDir = "fwd"; if (activeTool() === "drawdown") showDDCompare(); else showCompare(); pushNav(); }
});
