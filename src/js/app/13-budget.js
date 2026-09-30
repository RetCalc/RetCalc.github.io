/* ---------- budget tool ---------- */
/* Grouped presets. freq is the default frequency for that row: 12 = a monthly
   figure, 1 = an annual figure. Rows carry their own amount and freq once the
   user edits them; travel and gifts default to annual since that's how people
   usually think of them. */
const BUDGET_PRESETS = [
  {group:"Housing", items:[
    {desc:"Rent / Mortgage", freq:12}, {desc:"Property tax", freq:12},
    {desc:"Utilities", freq:12}, {desc:"Internet & phone", freq:12},
    {desc:"Home / Renters insurance", freq:12}]},
  {group:"Transportation", items:[
    {desc:"Car payment", freq:12}, {desc:"Car insurance", freq:12},
    {desc:"Gas", freq:12}, {desc:"Maintenance & repairs", freq:1}]},
  {group:"Health", items:[
    {desc:"Health insurance", freq:12}, {desc:"Out-of-pocket medical", freq:1}]},
  {group:"Food", items:[
    {desc:"Groceries", freq:12}, {desc:"Eating out", freq:12}]},
  {group:"Lifestyle", items:[
    {desc:"Activities & hobbies", freq:12}, {desc:"Subscriptions", freq:12},
    {desc:"Travel", freq:1}, {desc:"Gifts", freq:1}]},
  {group:"Saving & debt", items:[
    {desc:"Savings & investments", freq:12}, {desc:"Other debt payments", freq:12}]}
];
function defaultBudget(){
  const rows = [];
  BUDGET_PRESETS.forEach(g => g.items.forEach(it =>
    rows.push({group:g.group, desc:it.desc, amount:0, freq:it.freq, custom:false})));
  return rows;
}
// Preset rows can never be added or removed, only ever renamed, so position i
// in the budget array always lines up with position i in this flattened list
// -- letting a blank rename fall back to "whatever this slot's default was"
// without having to store that default on every row.
const BUDGET_PRESET_DESCS = [];
BUDGET_PRESETS.forEach(g => g.items.forEach(it => BUDGET_PRESET_DESCS.push(it.desc)));
let budget = defaultBudget();

function annualize(r){ return r.amount * r.freq; }

/* Rebuilt only on structural change (add/remove/load); typing updates the model
   in place and recomputes totals, so focus is never lost. */
function buildBudget(){
  const groups = [];
  budget.forEach((r, i) => {
    let g = groups.find(x => x.name === r.group);
    if (!g){ g = {name:r.group, rows:[]}; groups.push(g); }
    g.rows.push({r, i});
  });
  $("bgList").innerHTML = groups.map(g =>
    "<div class='bggroup'><div class='bggroup-h'>" + (g.name || "Custom") + "</div>" +
    g.rows.map(({r, i}) => {
      const descCell = r.custom
        ? "<input class='desc' data-f='desc' data-i='" + i + "' value='" +
          String(r.desc).replace(/'/g, "&#39;") + "' placeholder='Description' aria-label='Item name'>"
        : isSavingsRow(r)
        ? "<span class='desc'>" + escapeHtml(r.desc) +
          "<span class='tipdot' data-tip='bgsavings' role='button' tabindex='0' aria-label='What is this?'>?</span></span>"
        : "<span class='desc' contenteditable='true' spellcheck='false' data-name='" + i +
          "' title='Click to rename' aria-label='Item name'>" + escapeHtml(r.desc) + "</span>";
      const del = r.custom
        ? "<button class='del' type='button' data-del='" + i + "' title='Remove' aria-label='Remove'>\u00d7</button>"
        : "<span class='delspace'></span>";
      return "<div class='bgrow'>" + descCell +
        "<div class='inputwrap'><span class='affix'>$</span><input type='text' inputmode='decimal' " +
          "data-money data-nonneg data-f='amount' data-i='" + i + "' value='" +
          groupDigits(r.amount, true) + "' aria-label='" + escapeHtml(r.desc) + " amount'></div>" +
        "<span class='seg bgseg' data-f='freqseg' data-i='" + i + "'>" +
          "<button type='button' data-fv='12'" + (r.freq === 12 ? " class='on'" : "") + ">/mo</button>" +
          "<button type='button' data-fv='1'" + (r.freq === 1 ? " class='on'" : "") + ">/yr</button>" +
        "</span>" + del + "</div>";
    }).join("") + "</div>").join("");
  initFields($("bgList"));
}

/* "Savings & investments" and the "Retirement contribution" and "College
   savings" lines (added via the handoff buttons) are money being set aside,
   not spent \u2014 they're kept out of total spending and the emergency fund,
   and shown as saving instead. */
const SAVINGS_DESCS = ["Savings & investments", "Retirement contribution", "College savings"];
function isSavingsRow(r){ return SAVINGS_DESCS.includes(r.desc); }

function renderBudget(){
  const incFreq = bgIncomeFreq;
  const incomeYr = num("bgIncomeIn") * incFreq;
  const spentYr = budget.reduce((a, r) => a + (isSavingsRow(r) ? 0 : annualize(r)), 0);
  const savedYr = budget.reduce((a, r) => a + (isSavingsRow(r) ? annualize(r) : 0), 0);
  const leftYr = incomeYr - spentYr - savedYr;
  const pct = incomeYr > 0 ? leftYr / incomeYr : 0;

  setBig("bgIncome", money(incomeYr));
  setBig("bgSpent", money(spentYr));
  setBig("bgLeft", money(leftYr));
  $("bgLeft").className = "v " + (leftYr < 0 ? "neg" : "pos");
  $("bgLeftNote").textContent = incomeYr > 0
    ? (leftYr < 0 ? "Over budget by " : "") + pctStr(Math.abs(pct), 1) +
      (leftYr < 0 ? " of income" : " of income left")
    : "Enter your income to begin";

  $("bgTotYr").textContent = money(spentYr);
  $("bgTotMo").textContent = money(spentYr / 12);
  $("bgSaveRow").hidden = !(savedYr > 0);
  if (savedYr > 0) $("bgSaveMo").textContent = money(savedYr / 12);
  const ly = $("bgLeftYr"), lm = $("bgLeftMo");
  ly.textContent = money(leftYr); lm.textContent = money(leftYr / 12);
  ly.className = "v " + (leftYr < 0 ? "neg" : "pos");
  lm.className = "v " + (leftYr < 0 ? "neg" : "pos");

  renderEF(spentYr / 12);
}

$("bgList").addEventListener("input", e => {
  const el = e.target, f = el.getAttribute && el.getAttribute("data-f");
  if (!f || f === "freq") return;
  const i = parseInt(el.getAttribute("data-i"), 10);
  if (!budget[i]) return;
  if (f === "amount") budget[i].amount = num2(el.value);
  else if (f === "desc") budget[i].desc = el.value;
  renderBudget();
});
/* Preset item names double as a rename field, the same way stage names work:
   selecting all text on focus means a click can just be typed over, Enter
   commits instead of adding a line break, and the value only actually saves
   on blur. A blank entry falls back to that slot's original default name
   rather than staying empty. The one preset row that's excluded from the
   spending total ("Savings & investments") is left out of this entirely --
   see the isSavingsRow() branch in buildBudget(), which renders it as plain
   text with an explanatory tooltip instead of a rename field. */
$("bgList").addEventListener("focusin", e => {
  const el = e.target;
  if (!el.getAttribute || el.getAttribute("data-name") === null) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
});
$("bgList").addEventListener("keydown", e => {
  const el = e.target;
  if (el.getAttribute && el.getAttribute("data-name") !== null && e.key === "Enter"){
    e.preventDefault();
    el.blur();
  }
});
$("bgList").addEventListener("focusout", e => {
  const el = e.target;
  const attr = el.getAttribute && el.getAttribute("data-name");
  if (attr === null || attr === undefined) return;
  const i = parseInt(attr, 10);
  if (!budget[i]) return;
  const raw = el.textContent.replace(/\s+/g, " ").trim().slice(0, 60);
  budget[i].desc = raw || BUDGET_PRESET_DESCS[i] || budget[i].desc;
  buildBudget(); renderBudget();
});
$("bgList").addEventListener("click", e => {
  const b = e.target.closest ? e.target.closest("button[data-fv]") : null;
  if (!b) return;
  const seg = b.parentNode;
  const i = parseInt(seg.getAttribute("data-i"), 10);
  if (!budget[i]) return;
  budget[i].freq = parseInt(b.getAttribute("data-fv"), 10);
  seg.querySelectorAll("button").forEach(x =>
    x.classList.toggle("on", x.getAttribute("data-fv") === String(budget[i].freq)));
  renderBudget();
});
$("bgList").addEventListener("click", e => {
  const b = e.target.closest ? e.target.closest("button[data-del]") : null;
  if (!b) return;
  budget.splice(parseInt(b.getAttribute("data-del"), 10), 1);
  buildBudget(); renderBudget();
});
$("bgAdd").addEventListener("click", () => {
  budget.push({group:"Custom", desc:"", amount:0, freq:12, custom:true});
  buildBudget(); renderBudget();
  // focus the new description field
  const inputs = $("bgList").querySelectorAll("input.desc");
  if (inputs.length) inputs[inputs.length - 1].focus();
});

/* Shared handoff target for other tools sending a line into the budget.
   Updates an existing row with the same description instead of duplicating
   it if the button is clicked more than once. */
function upsertBudgetLine(desc, monthlyAmount){
  const existing = budget.find(r => r.desc === desc);
  if (existing){
    existing.amount = monthlyAmount;
    existing.freq = 12;
  } else {
    budget.push({group:"Custom", desc, amount:monthlyAmount, freq:12, custom:true});
  }
  buildBudget(); renderBudget();
}

/* Reads whatever is currently entered in each retirement mode, regardless of
   which tab happens to be open \u2014 the inputs hold their values in the
   background even while you're looking at Budget. Basic is checked first
   since it's the default landing mode; Stages uses its first stage, since
   that's the contribution happening right now. */
/* Same pattern as the Drawdown tool's "copy portfolio" chooser: every source
   that actually has a contribution is offered, with its monthly-equivalent
   dollar amount shown right there, rather than silently picking the first
   one that happens to be nonzero and leaving the person to guess from the
   toast message afterward. */
$("bgCopyRetire").addEventListener("click", async () => {
  const sources = [
    {contrib: num("qContrib"), period: $("qPeriod").value, label: "Basic"},
    {contrib: num("contrib"), period: $("period").value, label: "Advanced"},
    {contrib: stages.length ? stages[0].contrib : 0,
     period: stages.length ? stages[0].period : "Monthly", label: "Stages"}
  ].map(c => ({label: c.label, value: c.contrib * PPY[c.period] / 12}))
   .filter(c => c.value > 0);

  if (!sources.length){
    toast("Set a contribution amount in Basic, Advanced, or Stages first");
    return;
  }
  if (sources.length === 1){
    applyBudgetRetireCopy(sources[0]);
    return;
  }

  const choice = await showPopup("Copy from which plan?", sources.map(s =>
    ({label: s.label, desc: money(s.value) + "/mo", money: true})));
  if (choice >= 0) applyBudgetRetireCopy(sources[choice]);
});
function applyBudgetRetireCopy(source){
  const monthly = Math.round(source.value);
  upsertBudgetLine("Retirement contribution", monthly);
  toast("Added " + money(monthly) + "/mo from " + source.label);
}

$("bgCopyCollege").addEventListener("click", () => {
  const inp = readCollege();
  if (!inp.kids.some(k => k.annualCost > 0)){ toast("Set up the College Savings tool first"); return; }
  const mo = collegeMonthly(inp);
  if (!(mo > 0)){ toast("No monthly amount needed there yet"); return; }
  const monthly = Math.round(mo);
  upsertBudgetLine("College savings", monthly);
  toast("Added " + money(monthly) + "/mo from College Savings");
});

$("rbCopyMort").addEventListener("click", () => {
  const price = num("moPrice");
  if (!(price > 0)){ toast("Set up the Mortgage tool first"); return; }
  $("rbPrice").value = groupDigits(price, true);
  $("rbDown").value = $("moDownPct").value;
  $("rbRate").value = $("moRate").value;
  // rbTerm only offers 30/20/15; a 10-year mortgage falls back to 15, the
  // closest option, rather than silently leaving the old term selected.
  const morTerm = $("moTerm").value;
  $("rbTerm").value = ["30", "20", "15"].includes(morTerm) ? morTerm : "15";
  $("rbPropTax").value = $("moTax").value;
  $("rbIns").value = $("moIns").value;
  $("rbMaint").value = $("moMaint").value;
  renderRentBuy();
  toast("Copied the home from your mortgage calculation");
});
["bgIncomeIn"].forEach(id => $(id).addEventListener("input", renderBudget));
let bgIncomeFreq = 1;   // 1 = typed as annual, 12 = typed as monthly
$("bgIncomeFreq").addEventListener("click", e => {
  const b = e.target.closest ? e.target.closest("button[data-freq]") : null;
  if (!b) return;
  bgIncomeFreq = parseInt(b.getAttribute("data-freq"), 10);
  $("bgIncomeFreq").querySelectorAll("button").forEach(x =>
    x.classList.toggle("on", x.getAttribute("data-freq") === String(bgIncomeFreq)));
  renderBudget();
});

function renderEF(monthlySpend) {
  var mo = Math.max(1, Math.round(num("efMonths")) || 6);
  $("efLabel").textContent = mo + "-month emergency fund";
  $("efTarget").textContent = money(monthlySpend * mo);
}
$("efMonths").addEventListener("input", renderBudget);

/* The budget isn't a <table>, so the automatic CSV buttons skip it. This
   exports the same figures as a three-column sheet: item, amount, and whether
   it's a monthly or yearly figure. Custom items (added at the end) are part of
   the same list, so they're included too. Rows left blank or at zero are left
   out. It's a flat list of the populated items -- no category headings --
   with income and the totals as labeled rows. */
function exportBudgetCSV(){
  const period = f => f === 12 ? "Per month" : "Per year";
  const incomeAmt = num("bgIncomeIn");
  const spentYr = budget.reduce((a, r) => a + (isSavingsRow(r) ? 0 : annualize(r)), 0);
  const savedYr = budget.reduce((a, r) => a + (isSavingsRow(r) ? annualize(r) : 0), 0);
  if (!(incomeAmt > 0) && !(spentYr > 0) && !(savedYr > 0)){
    toast("Nothing to export yet"); return;
  }
  const rows = [["Budget Item", "Amount", "Period"]];
  if (incomeAmt > 0) rows.push(["Income after taxes", money(incomeAmt), period(bgIncomeFreq)]);
  budget.forEach(r => {
    if (!(r.amount > 0)) return;   // skip blank / zero rows
    rows.push([r.desc, money(r.amount), period(r.freq)]);
  });
  const leftYr = incomeAmt * bgIncomeFreq - spentYr - savedYr;
  rows.push(["Total spending", money(spentYr), "Per year"]);
  if (savedYr > 0) rows.push(["Total saving", money(savedYr), "Per year"]);
  rows.push(["Left over", money(leftYr), "Per year"]);

  const csv = rows.map(cols => cols.map(c => csvEscape(String(c))).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + csv], {type:"text/csv;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "retcalc-budget.csv";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast("Saved " + a.download);
}
$("bgCsv").addEventListener("click", exportBudgetCSV);
