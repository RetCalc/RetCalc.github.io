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
   how:"Start like the fixed-amount method and raise spending with inflation. Each year, compare what you're about to take with the portfolio's value. If that rate has drifted too far above where you started (the upper guardrail, often 20% above), cut spending by a set step, often 10%. If it falls too far below (the lower guardrail), take a raise, often also 10%. The two guardrails can be set differently, for example to cut sooner than you raise. Jonathan Guyton and William Klinger published the rules in 2006, and their paper skips cuts in the final 15 years, when too little time is left for a bad run to empty the portfolio; tick <b>No cuts in the final</b> to use that rule too. The paper's other rules, like skipping the inflation raise after a losing year, aren't modeled here.",
   pros:["Supports a higher starting rate than the 4% rule, often 5% or more","Income stays steady most years and changes only when a guardrail is hit","Reacts to a bad market before it becomes a crisis","Cuts and raises can be tuned separately, and cuts can stop late in retirement"],
   cons:["Cuts arrive as sudden 10% steps, and a long downturn can bring several","More rules to track each year","The historical record behind it is shorter than for the 4% rule"],
   fit:"You'd accept an occasional real pay cut in exchange for more income to start with."},
  {k:"floorceil", name:"Floor and ceiling", tag:"Vanguard's dynamic spending",
   how:"Aim at a percentage of the current portfolio each year, like the fixed-percentage method, but limit how far spending can move from last year's inflation-adjusted amount: no more than the maximum raise up, and no more than the maximum cut down. Vanguard's version uses a 5% raise and a 2.5% cut.",
   pros:["Follows the market, but in gentle steps","You set exactly how big a single year's change can be","A good middle ground between fixed income and fixed percentage"],
   cons:["In a long downturn the small cuts keep adding up","The cap on raises means spending catches up slowly after a strong run","Can drift away from the target percentage for years"],
   fit:"You want spending to respond to markets but can't absorb a large cut in any single year."},
  {k:"yale", name:"Yale endowment rule", tag:"Smoothed percentage",
   how:"Each year's spending is a blend: mostly last year's spending plus inflation, and a smaller share based on a target percentage of the current portfolio. Yale's endowment has used a version of this for decades, with 70/30 the commonly cited weighting.",
   pros:["Very smooth income: a crash filters in over several years, not all at once","Still follows the portfolio over the long run","Proven in practice by large endowments"],
   cons:["Slow to react, so it can keep spending too much early in a prolonged decline","Equally slow to pass on good years","Endowments plan to last forever; a person doesn't, so it can leave money unspent"],
   fit:"Stable year-to-year income matters most to you, and you'd rather adjust slowly than sharply."},
  {k:"vpw", name:"Variable percentage withdrawal (VPW)", tag:"The Bogleheads method",
   how:"Each year, work out the level payment that would draw today's balance down to your future value (usually $0) over the years left, at an expected return after inflation. It's the spreadsheet PMT formula, the same math as a loan: =PMT(rate, years left, -balance, future value, 1). With 30 years left the share is modest; with 5 left it's large, so the percentage climbs every year. Here the horizon is the years in retirement you set; the Bogleheads tables plan to age 100.",
   pros:["Built not to run out before the horizon, since it only ever pays out what's there","Spends the portfolio instead of leaving an accidental fortune","Transparent: one formula and two inputs you can check yourself"],
   cons:["Income moves with the market, much like the fixed percentage","Spends toward the future value by the end, so choose a horizon you won't outlive","Later withdrawals are a large share of a shrinking balance, so late-life income is volatile"],
   fit:"You want to use your savings fully, have Social Security or a pension as a floor, and can flex spending with markets."}
];
function openStrategyGuide(){
  var cur = $("ddStrategy").value;
  var list = function(items){ return "<ul>" + items.map(function(t){ return "<li>" + t + "</li>"; }).join("") + "</ul>"; };
  var cmp = "<div class='sg-cmpwrap'><table class='sg-cmp'><thead><tr><th>Strategy</th><th>Income stability</th><th>Can run out</th><th>Left at the end</th></tr></thead><tbody>" +
    [["Fixed amount","Highest","Yes","Often a lot"],
     ["Fixed percentage","Lowest","No","Often a lot"],
     ["Guardrails","High, with occasional steps","Rarely","Moderate"],
     ["Floor and ceiling","High","Rarely","Moderate"],
     ["Yale endowment","High, slow to change","Sometimes","Moderate"],
     ["VPW","Low to moderate","Not before the horizon","About the future value"]]
    .map(function(r){ return "<tr><td>" + r.join("</td><td>") + "</td></tr>"; }).join("") + "</tbody></table></div>";
  var body = DD_GUIDE.map(function(g){
    return "<section class='sg-item" + (g.k === cur ? " sg-cur" : "") + "'>" +
      "<div class='sg-head'><h4>" + g.name + "</h4><span class='sg-tag'>" + g.tag + "</span>" +
      (g.k === cur ? "<span class='sg-using'>Selected</span>"
        : "<button type='button' class='btn mini' data-usestrat='" + g.k + "'>Use this strategy</button>") + "</div>" +
      "<p>" + g.how + "</p>" +
      "<div class='sg-pc'><div><div class='sg-lbl pos'>Pros</div>" + list(g.pros) + "</div>" +
      "<div><div class='sg-lbl neg'>Cons</div>" + list(g.cons) + "</div></div>" +
      "<p class='sg-fit'><b>A good fit if:</b> " + g.fit + "</p></section>";
  }).join("");
  var ov = document.createElement("div");
  ov.className = "popup-overlay";
  ov.innerHTML = "<div class='popup guide'>" +
    "<div class='sg-top'><h3>How the withdrawal strategies compare</h3>" +
    "<button type='button' class='sg-close' aria-label='Close'>&times;</button></div>" +
    "<p class='sg-intro'>Every strategy trades a steady income against protection from running out. " +
    "Rules that never cut spending can run dry in a bad decade; rules that follow the market can't run out, " +
    "but your income moves with it. The minimum and maximum spending limits work with every strategy except fixed amount.</p>" +
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
