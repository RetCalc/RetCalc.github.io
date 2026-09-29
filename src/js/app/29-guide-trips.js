/* ---------- shared bits of markup ---------- */
function gdChoice(key, val, title, sub){
  const on = gd.a[key] === val;
  return "<button type='button' class='gd-choice" + (on ? " on" : "") + "' data-set='" + key +
    "' data-val='" + val + "' aria-pressed='" + on + "'><i class='dot' aria-hidden='true'></i>" +
    "<span class='t'><b>" + title + "</b>" + (sub ? "<span>" + sub + "</span>" : "") + "</span></button>";
}
function gdMoneyF(key, label, o){
  o = o || {};
  return "<div class='field" + (o.full ? " full" : "") + "'><label for='gdf-" + key + "'>" + label + "</label>" +
    "<div class='inputwrap'><span class='affix'>$</span><input id='gdf-" + key + "' type='text' inputmode='decimal' " +
    "data-money data-nonneg data-a='" + key + "' value='" + gdM(gd.a[key]) + "'" +
    (o.ph ? " placeholder='" + o.ph + "'" : "") + ">" + (o.per ? "<span class='affix'>" + o.per + "</span>" : "") + "</div>" +
    (o.hint ? "<div class='hint'>" + o.hint + "</div>" : "") + "</div>";
}
function gdNumF(key, label, affix, o){
  o = o || {};
  const v = gd.a[key];
  return "<div class='field" + (o.full ? " full" : "") + "'><label for='gdf-" + key + "'>" + label + "</label>" +
    "<div class='inputwrap'><input id='gdf-" + key + "' type='text' inputmode='decimal' data-num data-step='1' " +
    "min='0' data-nonneg data-a='" + key + "' value='" + (gdOk(v) ? String(v) : "") + "'>" +
    "<span class='affix'>" + affix + "</span></div>" + (o.hint ? "<div class='hint'>" + o.hint + "</div>" : "") + "</div>";
}
function gdSelF(key, label, opts, o){
  o = o || {};
  const v = gd.a[key] == null ? "" : String(gd.a[key]);
  return "<div class='field" + (o.full ? " full" : "") + "'><label for='gdf-" + key + "'>" + label + "</label>" +
    "<select id='gdf-" + key + "' data-a='" + key + "'" + (o.kind ? " data-kind='" + o.kind + "'" : "") +
    (o.rerender ? " data-rerender" : "") + ">" +
    opts.map(p => "<option value='" + p[0] + "'" + (String(p[0]) === v ? " selected" : "") + ">" + p[1] + "</option>").join("") +
    "</select>" + (o.hint ? "<div class='hint'>" + o.hint + "</div>" : "") + "</div>";
}
function gdLive(name){ return "<div data-live='" + name + "'>" + (GD_LIVE[name] ? GD_LIVE[name]() : "") + "</div>"; }
function gdToolIcon(tool){
  if (tool === "basic")
    return "<svg viewBox='0 0 40 40' fill='none'><path d='M5 33h30' stroke='currentColor' stroke-width='2' stroke-linecap='round'/><path d='M7 29 C15 27 22 22 33 9' stroke='currentColor' stroke-width='2' stroke-linecap='round'/><path d='M27 9h6v6' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/></svg>";
  const ic = document.querySelector(".toolcard[data-pick='" + tool + "'] .toolcard-icon");
  return ic ? ic.innerHTML : "";
}
/* The trip box: which tool, why, what you'll do there, and the button. */
function gdTask(id, head, o){
  o = o || {};
  const T = GD_TRIPS[id];
  const list = T.preview || [];
  return "<div class='gd-task'><div class='gd-task-h'><div class='gd-task-ic' aria-hidden='true'>" + gdToolIcon(T.tool) +
    "</div><div><b>" + head + "</b><span>" + T.name + (T.mins ? " · about " + T.mins + " minutes" : "") + "</span></div></div>" +
    (list.length ? "<ol class='gd-steps'>" + list.map(t => "<li>" + t + "</li>").join("") + "</ol>" : "") +
    "<button type='button' class='btn primary' data-trip='" + id + "'>" + (o.label || "Open " + T.name) + "<i class='arw' aria-hidden='true'></i></button>" +
    (o.after || "") + "</div>";
}
function gdBack(stepId){
  const B = gd.back;
  if (!B || B.step !== stepId || !B.msg) return "";
  return "<div class='gd-callout ok'>" + B.msg +
    (B.undo ? "<br><button type='button' class='btn mini' data-gd='undo'>Undo</button>" : "") + "</div>";
}

/* Small pieces of a step that change while typing, redrawn in place so the
   field being typed in never loses focus. */
const GD_LIVE = {
  aboutNote(){
    const a = gd.a;
    if (!gdOk(a.age) || !gdOk(a.retire)) return "";
    if (a.retire <= a.age) return "<div class='gd-callout warn'>Your retirement age needs to be later than your age today. This guide is built for the saving years; if you've already retired, the <b>Drawdown Simulator</b> is the tool for you.</div>";
    const yrs = a.retire - a.age;
    return "<div class='gd-callout'>That gives you <b>" + fmtNum(yrs) + (yrs === 1 ? " year" : " years") + "</b> to prepare." +
      (a.retire < 65 ? " Retiring before 65 means buying your own health insurance until Medicare starts; we'll price that out later." : "") + "</div>";
  },
  incomeNote(){
    const g = gdGross();
    return g > 0 ? "<div class='gd-callout'>That's <b>" + money(g / 12) + "</b> a month before taxes" + (gdMar() ? " for the two of you" : "") + ".</div>" : "";
  },
  flowNote(){
    const a = gd.a;
    if (!gdPos(a.takehome) || !gdPos(a.spend)) return "";
    const left = a.takehome - a.spend, pct = left / a.takehome;
    if (left < 0) return "<div class='gd-callout bad'>You're spending <b>" + money(-left) + "/mo more</b> than you bring home. That gap usually lands on a credit card, so it's the first thing to fix.</div>";
    const sv = gdPos(a.bgSave) && a.bgSave <= left ? a.bgSave : 0;
    return "<div class='gd-callout " + (pct >= .1 ? "ok" : "warn") + "'>That leaves <b>" + money(left) + "/mo</b> unspent, " + pctStr(pct, 0) + " of your take-home" +
      (sv ? ": " + money(sv) + " already going to savings and <b>" + money(left - sv) + "</b> left over." : ", for saving and paying down debt.") +
      (pct < .1 ? " Under 10% leaves little room for surprises." : "") + "</div>";
  },
  cashNote(){
    const a = gd.a;
    if (!gdOk(a.cash)) return "";
    if (!gdPos(a.spend)) return "<div class='gd-callout'>Tell us your monthly spending on the step before this one to see how many months this covers.</div>";
    const m = a.cash / a.spend, lo = a.spend * 3, hi = a.spend * 6;
    const cls = m >= 3 ? "ok" : m >= 1 ? "warn" : "bad";
    return "<div class='gd-callout " + cls + "'>That covers <b>" + gdMonths(m) + (m === 1 ? " month" : " months") + "</b> of spending. " +
      "The usual target is 3 to 6 months: <b>" + money(lo) + "</b> to <b>" + money(hi) + "</b> for you." +
      (m < 1 ? " Start with one month, " + money(a.spend) + ", before anything else." : "") + "</div>";
  },
  rateNote(){
    const a = gd.a, inc = gdGross();
    if (!(inc > 0) || !gdOk(a.contrib)) return "";
    const r = gdSaveMo() * 12 / inc;
    const cls = r >= .15 ? "ok" : r >= .1 ? "warn" : "bad";
    let s = "<div class='gd-callout " + cls + "'>" + (gdCoastNow() ? "Your plan has you coasting from now (set on <b>Adjust your plan</b>), so these are what you were putting in. " : "") +
      "You're saving <b>" + pctStr(r, 1) + "</b> of your gross income for retirement, counting your employer's share. ";
    s += r >= .15 ? "That meets the common 15% target." : "A common target is 15%: about " + money(inc * .15 / 12) + "/mo in all for you, <b>" +
      money(inc * .15 / 12 - gdSaveMo()) + "/mo more</b> than now.";
    if (a.match === "partial") s += " You're also leaving employer match on the table: raising your contribution to get all of it is the best return available anywhere.";
    return s + "</div>";
  },
  ssNote(){
    const a = gd.a;
    if (!gdOk(a.retire)) return "";
    const ss = gdSS(a.retire);
    let s = "<div class='gd-callout'>";
    s += ss.own ? "Using your statement: <b>" + money(ss.total / 12) + "/mo</b>" + (ss.claim !== 67 ? ", adjusted for claiming at " + ss.claim : "")
      : "We estimate Social Security at about <b>" + money(ss.total / 12) + "/mo</b>" + (gdMar() ? " for the two of you" : "") +
        " in today's dollars, from your income " + (ss.career < 35 ? "over the " + ss.career + " years you'll have worked by " + fmtNum(a.retire) + ", from 22"
          : "over a full career") + (ss.spousal ? ", including the spousal benefit" : "");
    s += ", starting at " + ss.claim + ".";
    if (!ss.own && ss.career < 35) s += " Social Security averages your best 35 years, so retiring this early counts the missing years as zeros.";
    if (gdPos(a.retSpend)){
      const pen = gdPos(a.pension) ? a.pension * 12 : 0, got = ss.total + pen;
      const share = got / a.retSpend, early = Math.max(0, ss.claim - Math.round(a.retire));
      const that = pen ? " Together with your pension, that" : " That";
      if (share >= 1) s += (pen ? " Once it starts, it and your pension cover the spending you entered" : " Once it starts, that alone covers the spending you entered") +
        (early ? "; your savings carry the " + early + (early === 1 ? " year" : " years") + " before it." : ".");
      else s += that + " covers about <b>" + pctStr(share, 0) + "</b> of your spending; your savings need to cover the other " +
        money(a.retSpend - got) + " a year" + (early ? ", and more for the " + early + (early === 1 ? " year" : " years") + " before " + ss.claim : "") + ".";
    }
    if (!ss.own) s += " The program's trust fund is projected to run short in the 2030s; for a cautious plan, enter a lower figure below.";
    return s + "</div>";
  },
  minNote(){
    const a = gd.a, S = gdSim(), m = gdMinSpend();
    if (!m || !S) return "";
    if (m >= S.spend) return "<div class='gd-callout warn'>That's at or above the " + money(S.spend) + " a year you plan to spend, so no approach can flex: they'd all behave like the fixed one.</div>";
    const base = S.ss.total + S.pension;
    return "<div class='gd-callout'>" + pctStr(m / S.spend, 0) + " of your planned spending. " +
      (base >= m ? "Social Security" + (S.pension ? " and your pension" : "") + " cover it on their own once they start, so the floor mostly matters in the years before."
        : (S.pension ? "Social Security and your pension cover " : "Social Security covers ") + money(base) + " of it; the other " + money(m - base) + " a year has to come from savings even in the worst markets.") + "</div>";
  },
  stratTable(){ return gdStratTableHTML(); },
  stratPick(){ return gdStratPickHTML(); },
  inflNote(){
    const m = gdSaveMo();
    return "<p class='hint' style='margin:-2px 0 16px;max-width:60ch'>Every projection in this guide raises both amounts with inflation each year, so they stay the same in today's dollars. " +
      "At the " + pctStr(BASIC_INFL, 2) + " inflation it assumes, next year's " + (m > 0 ? money(m) + "/mo becomes about " + money(m * (1 + BASIC_INFL)) + "/mo" : "contribution rises " + pctStr(BASIC_INFL, 2) + " too") +
      ". The Basic calculator works the same way.</p>";
  },
  taxNote(){
    const a = gd.a;
    return "<div class='gd-callout'><b>This is spending before income tax.</b> Withdrawals from a traditional 401(k) or IRA, a pension and part of Social Security are taxable, so the plan needs a little more than this to cover the tax. " +
      (gdPos(a.retTax) ? "Your estimate from Income Tax was about <b>" + money(a.retTax) + " a year</b>" + (a.retTaxAdded ? ", and it's been added." : ".") + " " : "") +
      "The Income Tax tool's <b>Retirement income</b> mode estimates it." +
      "<div style='margin-top:8px'><button type='button' class='btn mini' data-trip='taxret' data-from='retspend'>" + (gdPos(a.retTax) ? "Estimate it again" : "Estimate my tax in retirement") + "<i class='arw' aria-hidden='true'></i></button>" +
      (gdPos(a.retTax) && !a.retTaxAdded && gdPos(a.retSpend) ? " <button type='button' class='btn mini' data-gd='addtax'>Add " + money(a.retTax) + " a year to my spending</button>" : "") + "</div></div>";
  },
  pensionNote(){
    const a = gd.a;
    if (!gdPos(a.pension)) return "";
    const from = gdOk(a.pensionAge) ? a.pensionAge : a.retire;
    return "<div class='gd-callout'>Counted from " + (gdOk(from) ? "age " + fmtNum(from) : "retirement") + ": <b>" + money(a.pension * 12) + " a year</b>" +
      (a.pensionCola === "yes" ? ", rising with inflation." : ", a fixed amount, so it buys a little less each year as prices rise.") + "</div>";
  },
  bridgeNote(){
    const a = gd.a, B = gdBridgeSplit();
    if (!(B.total > 0)) return "";
    return "<div class='gd-callout'>At " + fmtNum(a.retire) + " that's about <b>" + money(B.total) + "</b>: " + money(B.trad) + " traditional, " +
      money(B.roth) + " Roth and " + money(B.brok) + " in a brokerage account, in today's dollars." +
      (a.bridge ? " Last time, the bridge tool picked <b>" + escapeHtml(a.bridge) + "</b>, holding up in <b>" + a.bridgeHold + "%</b> of markets." : "") + "</div>";
  },
  hcNote(){
    const a = gd.a;
    if (!gdPos(a.hcPrem) || !gdPos(a.retSpend)) return "";
    if (a.hcAdded) return "<div class='gd-callout ok'>Added. Your retirement spending is now <b>" + money(a.retSpend) + " a year</b>.</div>";
    const add = Math.round(a.hcPrem * 12 / 100) * 100;
    return "<div class='gd-h3'>Is that already in the " + money(a.retSpend) + " a year you plan to spend?</div><div class='gd-choices two'>" +
      gdChoice("hcIncl", "yes", "Yes, it's included") + gdChoice("hcIncl", "no", "No, it isn't") + "</div>" +
      (a.hcIncl === "no" ? "<button type='button' class='btn' data-gd='addhc'>Add " + money(add) + " a year to my retirement spending</button>" +
        "<div class='hint' style='margin-top:6px'>Medicare premiums after 65 run about the same, so it's fair to keep it for the whole retirement.</div>" : "");
  },
  houseNote(){
    const a = gd.a, inc = gdGross();
    if (!gdPos(a.housePay)) return "";
    const p = inc > 0 ? a.housePay * 12 / inc : null;
    return "<div class='gd-callout " + (p == null ? "" : p <= .28 ? "ok" : p <= .36 ? "warn" : "bad") + "'>Housing: <b>" + money(a.housePay) + "/mo</b>" +
      (p != null ? ", " + pctStr(p, 0) + " of your gross income. Planners and lenders like to see 28% or less." : ".") + "</div>";
  }
};

/* ---------- trips into the tools ---------- */
/* preview: what the step card promises before you go. tasks(): the coach's
   live checklist on the tool itself (ok true/false is a tick or a nudge;
   undefined is a plain numbered note). capture(): read the tool's result
   back into the answers, returning the message for the step card. */
function gdBudgetNums(){
  const inc = num("bgIncomeIn") * bgIncomeFreq;
  let spent = 0, saved = 0, lines = 0;
  budget.forEach(r => {
    if (isSavingsRow(r)) saved += annualize(r);
    else { spent += annualize(r); if (r.amount > 0) lines++; }
  });
  return {inc, spent, saved, lines, left: inc - spent - saved};
}
function gdDebtNums(){
  const live = debts.filter(d => d.balance > 0);
  const total = live.reduce((s, d) => s + d.balance, 0);
  const hi = live.filter(d => d.apr >= 8).reduce((s, d) => s + d.balance, 0);
  const min = live.reduce((s, d) => s + (d.min || 0), 0);
  const top = live.reduce((m, d) => Math.max(m, d.apr || 0), 0);
  return {live, total, hi, min, top};
}
function gdHousing(){
  const R = mortgage(readMort());
  return {R, piti: R.pi + R.tax + R.ins + R.pmi + R.hoa};
}
function gdFireMode(){
  const on = $("segFireMode").querySelector("button.on");
  return on ? on.getAttribute("data-firemode") : "fire";
}
/* Advanced and Stages are filled from the guide once per version of the
   plan, so a second tour keeps whatever you changed there, but a plan
   adjusted in the guide since then comes through. */
const gdFilled = {};
function gdPlanSig(){
  const a = gd.a;
  return [a.age, a.retire, a.saved, gdSaveMo(), a.stopAge, a.risk, a.retSpend, a.debtMonths, a.debtMin, a.collegeMo, a.kidAge].join("|");
}
let gdStagesFrom = "", gdStagesN = 1;
const GD_TRIPS = {
  tax: {tool:"tax", name:"Income Tax", mins:3, title:"Find your take-home pay",
    preview:["We fill in your salary, filing status and state.",
      "You add anything taken out of your paycheck before tax, like 401(k) contributions.",
      "You read off your monthly take-home, and the guide brings it back."],
    prefill(){
      const a = gd.a, d = {mode:"normal", status: gdMar() ? "m" : "s", gross2: gdMar() ? (a.income2 || 0) : 0};
      if (gdOk(a.income)) d.gross = a.income;
      if (a.state) d.state = a.state;
      if (gdOk(a.txPre)) d.pre = a.txPre;
      writeTaxState(d);
    },
    tasks(){
      const inp = readTax();
      return [
        {h:"Check <b>Filing status</b> and <b>State</b> under Your situation. We filled them in from your answers."},
        {h:"<b>Gross income</b> holds your salary. If your paycheck puts money into a 401(k), 403(b) or HSA before tax, enter the yearly total in <b>Pre-tax deductions</b>.", ok: inp.pre > 0 ? true : undefined},
        {h:"Above the results, switch <b>Net pay</b> to <b>Take-home pay</b>: what actually reaches your bank account.", ok: txView === "take"},
        {h:"<b>Per month</b> is your monthly take-home. Tap <b>Back to guide</b> and it comes with you."}
      ];
    },
    chip(){
      const R = runTax(readTax());
      return R.gross > 0 ? "Take-home<br><b>" + money(R.net / 12) + "/mo</b>" : "";
    },
    capture(){
      const R = runTax(readTax());
      if (!(R.gross > 0)) return null;
      const v = Math.round(R.net / 12);
      gd.a.takehome = v; gd.a.txPre = readTax().pre;
      return "From Income Tax: <b>" + money(v) + "/mo</b> take-home pay. If your pay stub says something different, use that instead.";
    }},

  budget: {tool:"budget", name:"Budget", mins:15, title:"Build your budget",
    preview:["Your take-home pay is already filled in.",
      "You go down the list of everyday costs, using a couple of months of bank and card statements.",
      "The guide brings back what you spend and what's left over."],
    prefill(){
      const a = gd.a;
      // Tools don't keep what's typed across a reload, so the guide keeps a
      // copy of the lines and puts them back if the budget is blank again.
      if (Array.isArray(a.bgRows) && a.bgRows.length && budget.every(r => !(r.amount > 0))){
        budget = a.bgRows.map(r => Object.assign({}, r));
        buildBudget();
      }
      if (gdPos(a.takehome)){
        const b = $("bgIncomeFreq").querySelector("button[data-freq='12']");
        if (bgIncomeFreq !== 12 && b) b.click();
        $("bgIncomeIn").value = gdM(a.takehome);
      }
      renderBudget();
    },
    tasks(){
      const B = gdBudgetNums();
      return [
        {h:"<b>Income after taxes</b> holds your take-home pay, set to <b>/mo</b>.", ok: B.inc > 0},
        {h:"With your last two or three months of statements open, work down the list and fill in what you spend on each line. Skip lines that don't apply." +
          (B.lines ? "<em>" + B.lines + " filled</em>" : ""), ok: B.lines >= 5},
        {h:"For bills that come once or twice a year (insurance, travel, gifts, car repairs), tap <b>/yr</b> on the line and enter the yearly total."},
        {h:"Money you move into savings or investments goes on <b>Savings &amp; investments</b>. It counts as saving, not spending.", ok: B.saved > 0 ? true : undefined},
        {h:"Something missing? <b>Add custom item</b> sits under the list."},
        {h:"<b>Left over</b> at the top is what's free each month for debt and saving."}
      ];
    },
    chip(){
      const B = gdBudgetNums();
      return B.spent > 0 ? "Spending <b>" + money(B.spent / 12) + "/mo</b><br>Left over <b>" + money(B.left / 12) + "/mo</b>" : "";
    },
    capture(){
      const B = gdBudgetNums();
      if (!(B.spent > 0)) return null;
      const a = gd.a;
      a.spend = Math.round(B.spent / 12); a.bgSave = Math.round(B.saved / 12);
      // Rent or mortgage, property tax and home insurance: the first, second
      // and fifth preset lines, which can be renamed but never move.
      a.bgMort = budget[0] ? Math.round(annualize(budget[0]) / 12) || null : null;
      a.bgHousing = Math.round([0, 1, 4].reduce((t, i) => t + (budget[i] ? annualize(budget[i]) : 0), 0) / 12) || null;
      a.spendSrc = "budget";
      a.bgRows = budget.map(r => Object.assign({}, r));
      if (!gdPos(a.takehome) && B.inc > 0) a.takehome = Math.round(B.inc / 12);
      return "From your budget: <b>" + money(a.spend) + "/mo</b> in spending" +
        (a.bgSave > 0 ? " and <b>" + money(a.bgSave) + "/mo</b> going to savings" : "") +
        ", with <b>" + money(B.left / 12) + "/mo</b> left over.";
    }},

  debt: {tool:"debt", name:"Debt Payoff", mins:5, title:"Make a payoff plan",
    preview:["You list each debt with its balance, rate and minimum payment.",
      "You add what you can pay on top of the minimums.",
      "The tool compares the two classic payoff orders and gives you a debt-free date."],
    prefill(){
      if (JSON.stringify(debts) === JSON.stringify(DEBT_DEFAULTS)){
        const a = gd.a, keep = Array.isArray(a.debtRows) && a.debtRows.length;
        debts = keep ? a.debtRows.map(r => Object.assign({}, r)) : [{desc:"", balance:0, apr:0, min:0}];
        buildDebtList();
        $("dtExtra").value = keep && gdPos(a.debtExtra) ? gdM(a.debtExtra) : "";
      }
      renderDebt();
    },
    tasks(){
      const D = gdDebtNums();
      return [
        {h:(Array.isArray(gd.a.debtRows) && gd.a.debtRows.length
            ? "Your debts from last time are back. Update any balance that's changed, and add new ones with <b>Add a debt</b>."
            : "The sample debts are cleared. Enter each of yours: a name, the <b>Balance</b>, the <b>Rate</b> (the APR on your statement) and the <b>Minimum</b> payment. <b>Add a debt</b> gives you another row.") +
          (D.live.length ? "<em>" + D.live.length + " entered</em>" : ""), ok: D.live.length > 0},
        {h:"In <b>Extra payment</b>, type what you can pay each month on top of the minimums, or tap <b>Copy from Budget</b> to use your budget's left-over" +
          (gdPos(gd.a.takehome) && gdPos(gd.a.spend) && gd.a.takehome - gd.a.spend - (gd.a.bgSave || 0) > 0
            ? " (" + money(gd.a.takehome - gd.a.spend - (gd.a.bgSave || 0)) + "/mo)." : "."), ok: num("dtExtra") > 0},
        {h:"<b>Avalanche</b> pays the highest rate first and costs the least. <b>Snowball</b> clears the smallest balance first for quicker wins. Pick the one you'll stick with."},
        {h:"Your <b>Debt-free</b> date is at the top."}
      ];
    },
    chip(){
      const D = gdDebtNums();
      if (!D.live.length || !dtLast) return "";
      return "Owed <b>" + money(D.total) + "</b><br>Debt-free <b>" + (dtLast.pick.stalled ? "never" : debtDate(dtLast.pick.monthsTotal)) + "</b>";
    },
    capture(){
      renderDebt();
      const D = gdDebtNums();
      if (!D.live.length) return null;
      const a = gd.a;
      a.debtHas = "yes"; a.debtSrc = "tool";
      a.debtTotal = Math.round(D.total); a.debtHi = Math.round(D.hi); a.debtMin = Math.round(D.min);
      a.debtN = D.live.length; a.debtTop = D.top; a.debtExtra = Math.round(num("dtExtra"));
      a.debtMonths = dtLast && !dtLast.pick.stalled ? dtLast.pick.monthsTotal : null;
      a.debtRows = D.live.map(d => ({desc:d.desc, balance:d.balance, apr:d.apr, min:d.min}));
      return "From Debt Payoff: <b>" + D.live.length + (D.live.length === 1 ? " debt" : " debts") + "</b> totaling <b>" + money(D.total) + "</b>" +
        (D.hi > 0 ? ", " + money(D.hi) + " of it at 8% or more" : "") + "." +
        (a.debtMonths ? " With " + money(a.debtExtra) + "/mo extra you're debt-free by <b>" + debtDate(a.debtMonths) + "</b>." : "");
    }},

  mortBuy: {tool:"mortgage", name:"Mortgage Calculator", mins:5, title:"See what a home would cost",
    preview:["You enter a price you'd shop at, your down payment and a current rate.",
      "The tool adds tax, insurance and PMI to get the real monthly cost.",
      "The guide checks it against your income."],
    prefill(){ if (gd.a.moState) writeMortState(gd.a.moState); },
    tasks(){
      const inc = gdGross(), H = gdHousing();
      const cap = inc * .28 / 12;
      return [
        {h:"Enter a <b>Home price</b> you'd realistically shop at and your <b>Down payment</b>. Under 20% down adds PMI."},
        {h:"Set <b>Interest rate</b> to a current quote. Lenders' sites post today's rates, and your credit score moves yours."},
        {h:"Adjust <b>Property tax</b> and <b>Insurance</b> for the area if you know them."},
        {h:"<b>Monthly payment</b> at the top is the whole cost. Keep the house payment (loan, tax, insurance, PMI and HOA) under about 28% of gross income" +
          (inc > 0 ? ": <b>" + money(cap) + "/mo</b> for you." : "."), ok: inc > 0 && H.R.loan > 0 ? H.piti <= cap : undefined}
      ];
    },
    chip(){
      const inc = gdGross(), H = gdHousing();
      if (!(H.R.loan > 0)) return "";
      return "House payment <b>" + money(H.piti) + "/mo</b>" + (inc > 0 ? "<br><b>" + pctStr(H.piti * 12 / inc, 0) + "</b> of gross income" : "");
    },
    capture(){
      const H = gdHousing();
      if (!(H.R.loan > 0)) return null;
      gd.a.housePay = Math.round(H.piti); gd.a.moState = readMortState();
      return "From the Mortgage Calculator: a <b>" + money(num("moPrice")) + "</b> home comes to about <b>" + money(H.piti) + "/mo</b>.";
    }},

  mortOwn: {tool:"mortgage", name:"Mortgage Calculator", mins:5, title:"See what extra payments do",
    preview:["You enter your loan as it stands today.",
      "You try an extra $100 or $200 a month toward principal.",
      "The tool shows the interest you'd save and how much sooner you'd be done."],
    prefill(){ if (gd.a.moState) writeMortState(gd.a.moState); },
    tasks(){
      return [
        {h:"Enter your loan as it is today: the remaining balance as <b>Home price</b>, <b>Down payment</b> at 0%, your rate, the <b>Length</b> closest to the years you have left, and <b>PMI</b> at 0 unless you still pay it."},
        {h:"Under <b>Already have this loan?</b>, choose <b>Yes, show these options</b>.", ok: $("moExtrasOn").value === "1"},
        {h:"Try $100 or $200 in <b>Extra toward principal</b> and see how much interest it saves and how much sooner you're done.", ok: $("moExtrasOn").value === "1" && num("moExtraMo") > 0},
        {h:"Paying extra is a guaranteed return equal to your rate. Above about 6%, it often beats investing; below 4%, investing usually wins."}
      ];
    },
    chip(){
      const H = gdHousing();
      return H.R.loan > 0 ? "House payment<br><b>" + money(H.piti) + "/mo</b>" : "";
    },
    capture(){
      const H = gdHousing();
      if (!(H.R.loan > 0)) return null;
      gd.a.housePay = Math.round(H.piti); gd.a.mortPI = Math.round(H.R.pi); gd.a.moState = readMortState();
      return "From the Mortgage Calculator: your house payment is about <b>" + money(H.piti) + "/mo</b>.";
    }},

  college: {tool:"college", name:"College Savings", mins:3, title:"Find your monthly college number",
    preview:["Years until college is set from your child's age.",
      "You pick a type of school and add what's already saved.",
      "The tool gives the monthly amount to set aside."],
    prefill(){
      const a = gd.a;
      if (a.clState) writeCollegeState(a.clState);
      if (gdOk(a.kidAge)) writeCollegeState({years: Math.max(0, Math.min(25, 18 - Math.round(a.kidAge)))});
      renderCollege();
    },
    tasks(){
      return [
        {h:"<b>Years until college</b> is set from your child's age.", ok: gdOk(gd.a.kidAge) ? true : undefined},
        {h:"Pick a <b>School type</b>, or choose <b>Custom</b> and type a yearly cost."},
        {h:"Enter what's already in a 529 or other college account in <b>Currently saved</b>."},
        {h:"The monthly figure at the top is what to set aside. More than one child? Run it for each and add them up."}
      ];
    },
    chip(){
      const R = collegeSavingsCalc(readCollege());
      return R.monthly > 0 ? "Save<br><b>" + money(R.monthly) + "/mo</b>" : "";
    },
    capture(){
      const R = collegeSavingsCalc(readCollege());
      if (!(R.monthly >= 0)) return null;
      gd.a.collegeMo = Math.round(R.monthly); gd.a.clState = readCollegeState();
      return "From College Savings: set aside about <b>" + money(R.monthly) + "/mo</b>. Change the figure below if you have more than one child.";
    }},

  basic: {tool:"basic", name:"Basic calculator", mins:3, title:"Explore your projection",
    preview:["Your age, savings and monthly saving are filled in.",
      "You see what your savings grow to by retirement, in today's dollars.",
      "You try saving more or retiring later, and the guide can keep the change."],
    prefill(){
      const a = gd.a;
      if (gdOk(a.age)) $("qAge").value = String(Math.round(a.age));
      if (gdOk(a.retire)) $("qRetire").value = String(Math.round(a.retire));
      if (gdOk(a.saved)) $("qSaved").value = gdM(a.saved);
      $("qContrib").value = gdM(gdSaveNow());
      $("qPeriod").value = "Monthly";
      if (a.risk && $("qRisk").querySelector("option[value='" + a.risk + "']")) $("qRisk").value = String(a.risk);
      gd.trip.base = gdBasicNow();
    },
    tasks(){
      const b = gd.trip && gd.trip.base, n = gdBasicNow();
      const tried = b && (Math.round(n.monthly) !== Math.round(b.monthly) || n.retire !== b.retire);
      return [
        {h:"Your age, retirement age, savings and monthly saving (yours plus your employer's) are filled in on the left." +
          (gdOk(gd.a.stopAge) && gd.a.stopAge < gd.a.retire && !gdCoastNow() ? " Basic saves right up to retirement, so it doesn't show your plan to stop at " + fmtNum(gd.a.stopAge) + ": its figure runs higher. The <b>Stages</b> calculator shows the coast." : "")},
        {h:"<b>Value at retirement</b> is what your savings could grow to, in today's dollars, so you can compare it with prices now."},
        {h:"Raise <b>How much do you save</b> by $100 or $200 and watch it move. Then try retiring a year or two later.", ok: tried},
        {h:"The shaded band on the chart is the same plan in better and worse markets."},
        {h:"Want taxes, fees and account types? <b>Open these numbers in Advanced</b> at the bottom goes deeper."}
      ];
    },
    chip(){
      const p = readBasic();
      if (!(p.years > 0)) return "";
      return "At " + fmtNum(p.retire) + "<br><b>" + money(projectBasic(p).fv) + "</b>";
    },
    capture(){
      const b = gd.trip && gd.trip.base, n = gdBasicNow(), a = gd.a;
      if (!b) return null;
      const ch = [], undo = {contrib:a.contrib, retire:a.retire, saved:a.saved, risk:a.risk};
      if (Math.round(n.monthly) !== Math.round(b.monthly)){
        ch.push("saving <b>" + money(n.monthly) + "/mo</b> (was " + money(b.monthly) + ")");
        a.contrib = Math.max(0, Math.round(n.monthly - (a.employer || 0)));
        // Saving again ends a plan to coast from now.
        if (gdCoastNow() && n.monthly > 0){ undo.stopAge = a.stopAge; a.stopAge = null; }
      }
      if (n.retire !== b.retire && n.retire > a.age){
        ch.push("retiring at <b>" + fmtNum(n.retire) + "</b> (was " + fmtNum(b.retire) + ")"); a.retire = n.retire; undo.stopAge = a.stopAge == null ? null : a.stopAge;
        if (gdOk(a.stopAge) && a.stopAge >= a.retire) a.stopAge = null;
      }
      if (Math.round(n.saved) !== Math.round(b.saved)){ ch.push("<b>" + money(n.saved) + "</b> saved (was " + money(b.saved) + ")"); a.saved = Math.round(n.saved); }
      if (Math.abs(n.risk - b.risk) > 1e-9){ ch.push("a " + gdRiskLabel(n.risk) + " mix"); a.risk = n.risk; }
      if (!ch.length) return "Back from the Basic calculator. Nothing changed there, so your answers stand.";
      gdHouseholdSync();
      return {msg: "You changed your plan in Basic: " + ch.join(", ") + ". Your answers and score now use the new numbers.", undo};
    }},

  drawdown: {tool:"drawdown", name:"Drawdown Simulator", mins:10, title:"Tour the Drawdown Simulator",
    preview:["Your projected savings, spending, Social Security, any pension and your withdrawal approach are loaded.",
      "Seven short parts walk through each option, with the panel ticking off what you've tried.",
      "A different strategy, stock mix or claiming age can come back into your plan."],
    prefill(){
      const a = gd.a, S = gdSim();
      if (!S) return;
      const st = a.strategy || "fixed", o = gdDDOpts(S, st);
      const d = {initial: Math.round(S.fv), years: S.years, strategy: st, stock: S.mix, stockEnd:"", fee:0,
        rate: Math.max(0.01, Math.round(o.initialPct * 100) / 100), retireAge: String(Math.round(S.retire)),
        guardBand:20, adjust:10, floor:10, ceil:10, yaleWeight:70, yaleRate: Math.round(o.initialPct * 100) / 100,
        vpwRate: Math.round(o.vpwRate * 100) / 100, vpwFV:0, spendFloor:gdMinSpend(), spendCeil:0, legacyGoal:0};
      // The simulator's own estimate assumes a full career and no spousal
      // top-up, so it's only used when the guide's figure is the same; then
      // its claiming-age comparison works too. Otherwise the guide's own
      // amounts go in as known benefits.
      const est = !S.ss.own && !S.ss.spousal && S.ss.career >= 35 && (!gdMar() || !gdOk(a.spouseAge) ||
        Math.round(a.spouseAge + (S.retire - a.age)) - 22 >= 35);
      if (est){
        d.ssMode = "est"; d.ssWho = gdMar() ? "couple" : "single";
        d.ssIncome = a.income || 0; d.ssClaim = S.ss.claim;
        if (gdMar()){ d.ssIncome2 = a.income2 || 0; d.ssClaim2 = S.ss.claim; }
      } else {
        d.ssMode = "manual"; d.ssWho = S.ss.a2 > 0 ? "couple" : "single";
        d.ssAmount = Math.round(S.ss.a1); d.ssAmount2 = Math.round(S.ss.a2); d.ssDelay = S.ss.claim;
      }
      // The guide's pension joins whatever other income is already listed.
      const keep = ddIncomeItems.filter(x => x.name !== "Pension (from the guide)");
      d.incomeItems = keep.concat(S.inc.map(x => Object.assign({}, x, {name:"Pension (from the guide)"})));
      writeDDState(d);
      if (typeof renderItemLists === "function") renderItemLists();
      gd.trip.base = {strategy:st, stock:S.mix, claim:S.ss.claim, est, floor:gdMinSpend()};
      gd.trip.seen = {}; gd.trip.seen[st] = 1;
      gd.trip.page = 0;
    },
    /* One part at a time; focus scrolls the tool to what the part is about. */
    pages:[
      {title:"Your result", focus:"#ddSuccess", tasks(){
        const S = gdSim(), b = gd.trip && gd.trip.base;
        return [
          {h:"Your plan is loaded on the left: " + (S ? money(S.fv) + " at " + fmtNum(S.retire) + ", spending " + money(S.spend) + " a year (a <b>Starting withdrawal rate</b> of " + pctStr(S.spend / Math.max(1, S.fv), 1) + ")" : "your savings and spending") +
            ", Social Security" + (b && !b.est ? " as a known benefit" : "") + " and " + (gdPos(gd.a.pension) ? "your pension under <b>Other income</b>." : "no other income yet.")},
          {h:"<b>Success rate</b> is the share of real retirements since 1926 where the money never ran out. 85% or more is solid; close to 100% can mean room to spend more."},
          {h:"<b>Median ending balance</b> is what's typically left at the end, in today's dollars. <b>Worst case</b> is the leanest ending on record."},
          {h:"The sentence under the headline names the starting years that failed, if any. They're where the rest of this tour looks."}
        ];
      }},
      {title:"A bad start", focus:"#ddYearsPanel", tasks(){
        return [
          {h:"<b>How each starting year fared</b> lists every retirement tested. Tap a hard one, like <b>1966</b> or <b>1929</b>, or sort by <b>Ending balance</b> to find the worst."},
          {h:"Above the chart, switch to <b>Selected year</b> to watch that retirement play out.", ok: ddView === "year"},
          {h:"<b>What your income looked like</b> and <b>Year by year</b> show what you'd have lived on, and where the balance went, each year."},
          {h:"Retiring into a falling market early on does the most damage: it's called sequence risk, and it's why averages alone mislead."}
        ];
      }},
      {title:"Withdrawal strategies", focus:"#ddStrategy", tasks(){
        const seen = (gd.trip && gd.trip.seen) || {}, cur = $("ddStrategy").value;
        seen[cur] = 1;
        const n = Object.keys(seen).length;
        const row = (id, txt) => ({h:txt, ok: seen[id] ? true : undefined});
        return [
          {h:"Change <b>Withdrawal strategy</b> and watch the <b>Success rate</b> and the spending columns in the table. Try at least three." + (n > 1 ? "<em>" + n + " tried</em>" : ""), ok: n >= 3},
          row("guardrails", "<b>Guardrails</b>: steady spending, cut 10% when the withdrawal rate runs 20% high. Try widening <b>Guardrail width</b>."),
          row("floorceil", "<b>Floor &amp; ceiling</b>: follows the market, but never moves spending more than the <b>Max cut</b> or <b>Max raise</b> in a year."),
          row("yale", "<b>Yale Endowment</b>: blends last year's spending with a share of today's balance."),
          row("pct", "<b>Fixed %</b>: can't run out, but look at <b>Lowest year's spending</b> in the table."),
          row("vpw", "<b>VPW</b>: spends down on purpose, like an annuity, ending near zero."),
          {h:"For flexible strategies, <b>Minimum spending</b> sets a line spending never drops below" + (gdMinSpend() ? ": yours, " + money(gdMinSpend()) + ", is filled in. Try raising or lowering it and watch the success rate." : ". Try the least you could live on and watch the success rate.") +
            " <b>How the strategies compare</b>, under the picker, explains them side by side.", ok: gd.trip && gd.trip.base && num("ddSpendFloor") !== gd.trip.base.floor ? true : undefined}
        ];
      }},
      {title:"Your stock mix", focus:"#ddStock", tasks(){
        const b = gd.trip && gd.trip.base;
        return [
          {h:"<b>Stocks</b> is " + (b ? b.stock : 60) + "%, the rest in bonds. Try 40% and 80%: more stocks usually lifts the median, and can cut either way on the worst case.", ok: b && num("ddStock") !== b.stock ? true : undefined},
          {h:"<b>Glide to</b> moves the mix gradually over retirement, for example from 60% down to 40% stocks, or up, which some research favors."},
          {h:"<b>Fees</b> come off every year. Try 0.5% or 1% to see what an advisor or pricier funds would cost over a whole retirement."}
        ];
      }},
      {title:"Social Security timing", focus:"#ddSSMode", tasks(){
        const b = gd.trip && gd.trip.base;
        if (b && b.est) return [
          {h:"<b>Claim at age</b> sets when your benefit starts. Waiting raises it about 8% a year from 67 to 70; claiming at 62 cuts it about 30%, for life."},
          {h:"Scroll to <b>Social Security claiming age comparison</b>, near the bottom, for your success rate claiming at 62, 64, 67 and 70."},
          {h:"Later claiming means drawing more from savings first, but a bigger check for the rest of your life, and for a surviving spouse.", ok: num("ddSSClaim") !== b.claim ? true : undefined}
        ];
        return [
          {h:"Your benefit is entered as a known amount" + (gd.a.ssOwn ? ", from your statement" : ", from the guide's estimate") + ", starting at " + (b ? b.claim : 67) + "."},
          {h:"Waiting raises a benefit about 8% a year from 67 to 70, and claiming at 62 cuts it about 30%. To try a different age, change <b>When will you claim it?</b> on the guide's Spending in retirement step: the guide works out the new amount."}
        ];
      }},
      {title:"Life events", focus:"#ddAddIncome", tasks(){
        return [
          {h:"<b>+ Add income source</b> for part-time work in early retirement, rental income, a pension or an inheritance. Each has a start year and a length.", ok: ddIncomeItems.some(x => x.name !== "Pension (from the guide)") ? true : undefined},
          {h:"<b>+ Add future expense</b> for the big one-time costs: a new roof, a car every ten years, helping a child with a wedding or a home.", ok: ddExpenseItems.length ? true : undefined},
          {h:"<b>Legacy goal</b> tests how often you'd also leave a set amount behind.", ok: num("ddLegacyGoal") > 0 ? true : undefined}
        ];
      }},
      {title:"Stress tests", focus:"#segDD", tasks(){
        return [
          {h:"Switch <b>Historical</b> to <b>Monte Carlo</b> at the top: 5,000 retirements drawn at random from the same record, including sequences history never produced.", ok: ddMode === "mc" ? true : undefined},
          {h:"<b>Return sensitivity</b>, further down, shows your success rate if every year earns a little less than history."},
          {h:"Done? <b>Back to guide</b> brings your strategy, stock mix" + ((gd.trip && gd.trip.base && gd.trip.base.est) ? ", claiming age" : "") + " and success rate with you."}
        ];
      }}
    ],
    chip(){
      const t = $("ddSuccess").textContent.trim();
      return t && t !== "—" ? "Success rate<br><b>" + t + "</b>" : "";
    },
    capture(){
      const t = $("ddSuccess").textContent.trim(), sel = $("ddStrategy"), a = gd.a, b = gd.trip && gd.trip.base;
      if (!t || t === "—" || !b) return null;
      a.ddTool = {rate:t, strat:sel.value};
      const ch = [], undo = {strategy:a.strategy == null ? null : a.strategy, retMix:a.retMix == null ? null : a.retMix, ssClaim:a.ssClaim == null ? null : a.ssClaim,
        minSpend:a.minSpend == null ? null : a.minSpend};
      const fl = Math.round(num("ddSpendFloor"));
      if (fl !== Math.round(b.floor || 0)){ a.minSpend = fl > 0 ? fl : null; ch.push(fl > 0 ? "a minimum of <b>" + money(fl) + " a year</b>" : "no minimum spending"); }
      if (sel.value !== b.strategy){ a.strategy = sel.value; ch.push("the <b>" + escapeHtml(gdStratName(sel.value)) + "</b> approach"); }
      const mix = Math.round(num("ddStock"));
      if (mix !== b.stock && mix >= 0 && mix <= 100){ a.retMix = mix; ch.push("<b>" + mix + "%</b> in stocks in retirement"); }
      if (b.est && $("ddSSMode").value === "est"){
        const c = Math.round(num("ddSSClaim"));
        if (c !== b.claim && c >= 62 && c <= 70){ a.ssClaim = c; ch.push("claiming Social Security at <b>" + c + "</b>"); }
      }
      const head = "Back from the Drawdown Simulator, where it reached a <b>" + t + "</b> success rate.";
      if (!ch.length) return head + " Nothing in your plan changed.";
      gdHouseholdSync();
      return {msg: head + " Your plan now uses " + ch.join(", ").replace(/, ([^,]*)$/, " and $1") + "." +
        (a.retMix != null && mix !== b.stock ? " Your score's historical test uses the new mix." : ""), undo};
    }},

  taxret: {tool:"tax", name:"Income Tax", mins:3, title:"Estimate your tax in retirement",
    prefill(){
      const a = gd.a, S = gdSim();
      const ss = S ? Math.round(S.ss.total) : 0, pen = S ? Math.round(S.pension) : 0;
      const need = gdPos(a.retSpend) ? Math.max(0, Math.round(a.retSpend - ss - pen)) : 0;
      const old = S ? (S.retire >= 65 ? (gdMar() ? 2 : 1) : 0) : 0;
      writeTaxState({mode:"retire", status: gdMar() ? "m" : "s", state: a.state || $("txState").value,
        trad:need, roth:0, brok:0, gainPct:50, ss, pension:pen, other:0, seniors:old, pre:0, dedType:"std", item:0});
      gd.trip.base = {need};
    },
    tasks(){
      const b = gd.trip && gd.trip.base;
      return [
        {h:"We switched to <b>Retirement income</b> and filled in a first year of retirement: " + (b ? money(b.need) + " from savings" : "your withdrawals") + " under <b>Traditional</b>, plus your Social Security" + (gdPos(gd.a.pension) ? " and pension" : "") + "."},
        {h:"If some of your savings are in a Roth or a taxable brokerage account, move that share of the withdrawal to <b>Roth</b> or <b>Brokerage</b>. Roth withdrawals are tax-free, and brokerage sales are taxed only on the gain."},
        {h:"Check <b>Filing status</b>, <b>State</b> and how many of you are 65 or older."},
        {h:"<b>Total tax</b> is the yearly bill. Tap <b>Back to guide</b> and it comes with you, ready to add to your spending."}
      ];
    },
    chip(){
      const R = runTax(readTax());
      return R.gross > 0 ? "Tax in retirement<br><b>" + money(R.total) + "/yr</b>" : "";
    },
    capture(){
      const R = runTax(readTax());
      if (txMode !== "retire" || !(R.gross > 0)) return null;
      gd.a.retTax = Math.round(R.total / 100) * 100; gd.a.retTaxAdded = false;
      return "From Income Tax: about <b>" + money(gd.a.retTax) + " a year</b> in tax on that retirement income, " + pctStr(R.total / R.gross, 1) + " of it. Add it to your spending below so the plan covers it.";
    }},

  bridge: {tool:"bridge", name:"Early Retirement Bridge", mins:6, title:"Plan the years before 59½",
    preview:["Your projected savings at retirement, split across traditional, Roth and brokerage the way you told us, are filled in with your spending, state and retirement age.",
      "Four short parts walk through the plans it compares, what each one costs, and what you'd have left at 59½.",
      "The plan it picks, and what it leaves you with, come back to the guide."],
    prefill(){
      const a = gd.a, B = gdBridgeSplit(), m = v => groupDigits(Math.round(v || 0), true);
      const d = {brAge:String(Math.max(30, Math.min(59, Math.round(a.retire || 50)))), brStatus: gdMar() ? "m" : "s",
        brSpend:m(gdBridgeSpend()), brTrad:m(B.trad), brRoth:m(B.roth), brRothBasis:m(B.basis), brBrok:m(B.brok),
        brBasis:"60", brG457:"0", brWork:"0", brStock:String(B.mix), brAca:"1", brFill:"auto",
        brHousehold: gdMar() ? "2" : "1"};
      if (a.state && $("brState").querySelector("option[value='" + a.state + "']")) d.brState = a.state;
      if (!(Math.round(a.retire) >= 55)) d.brK401 = "0";
      writeAsideState("asideBR", d);
      brSel = null; brPath = "avg";
      gd.trip.base = {seen:{}, fill:"auto"};
      gd.trip.page = 0;
    },
    pages:[
      {title:"Your numbers", focus:"#asideBR", tasks(){
        const a = gd.a, B = gdBridgeSplit(), r = Math.round(a.retire), split = B.roth > 0 || B.brok > 0;
        const T = [
          {h:"Your savings at " + fmtNum(r) + ", about <b>" + money(B.total) + "</b> in today's dollars, are split into <b>Traditional</b>, <b>Roth</b> and <b>Brokerage</b>" +
            (split ? " in the same shares you have today." : ". The guide didn't know your split, so it's all under Traditional: move what's in a Roth or a taxable account.")},
          {h:"<b>Of that, contributions</b> is what you put into Roth accounts yourself, which can come out any time" +
            (B.basis > 0 ? ". We used today's Roth balance as a guess; your records or Form 8606 have the real number." : ". Enter it if you have a Roth.")},
          {h:"<b>Cost basis</b> is how much of the brokerage is money you put in rather than growth. 60% is a placeholder; your broker shows it."},
          {h:"<b>Yearly spending</b> is your retirement spending" + (gdBridgeSpend() < (a.retSpend || 0) - 1
            ? ", less the health premiums you added: the tool prices ACA coverage for each plan itself."
            : ". It should leave out health insurance, since the tool prices ACA coverage for each plan itself.")}
        ];
        if (r >= 55) T.push({h:"Retiring at " + r + ", the rule of 55 may apply: enter what's in the 401(k) at the job you're leaving under <b>Of that, in the 401(k) you're leaving</b>.",
          ok: num("brK401") > 0 ? true : undefined});
        return T;
      }},
      {title:"The best way across", focus:"#brBest", tasks(){
        return [
          {h:"<b>Best way to 59½</b> is the plan that gets there penalty-free in the most historical markets, then costs the least. What it does is listed underneath."},
          {h:"<b>Holds up in</b> is the share of retirements since 1926 where that plan made it to 59½ without running short or needing penalized money."},
          {h:"<b>Cost of the bridge</b> is the income tax, penalties and health premiums it pays on the way."}
        ];
      }},
      {title:"Compare the routes", focus:"#brCompare", tasks(){
        const seen = (gd.trip && gd.trip.base && gd.trip.base.seen) || {};
        if (brSel) seen[brSel] = 1;
        const n = Object.keys(seen).length, live = k => brLast && brLast.live.some(p => p.key === k);
        const row = (k, txt) => ({h:txt, ok: seen[k] ? true : undefined});
        const T = [{h:"<b>Ways to 59½</b> lists every route. Click a few rows to see each one play out below." + (n > 1 ? "<em>" + n + " tried</em>" : ""), ok: n >= 3}];
        if (live("ladder")) T.push(row("ladder", "<b>Roth conversion ladder</b>: move a year's spending into a Roth each year and spend it five years later. The first five years need another source."));
        if (live("sepp")) T.push(row("sepp", "<b>72(t) payments</b>: fixed yearly payments from an IRA with no penalty, but locked in until 59½ or for five years, whichever is later."));
        T.push(row("brok", "<b>Brokerage, then Roth contributions</b>: often nearly tax-free, but it only lasts as long as those accounts do."));
        if (live("r55")) T.push(row("r55", "<b>Rule of 55</b>: draw the 401(k) you left, penalty-free."));
        T.push({h:"<b>Pay the 10% penalty</b> is there to compare against: look at its <b>Penalties</b> column."});
        return T;
      }},
      {title:"What you'll have at 59½", focus:"#brAtOut", tasks(){
        const b = gd.trip && gd.trip.base;
        return [
          {h:"The table shows each account at 59½ in an <b>Average</b> market, and in <b>Above average</b> and <b>Below average</b> ones, all real starts from history."},
          {h:"Switch between them at the top of that panel; the charts and the year-by-year table follow.", ok: brPath !== "avg" ? true : undefined},
          {h:"Under <b>Account balances</b>, switch to <b>Across history</b> to see the range over every start since 1926.", ok: brBalView === "hist" ? true : undefined},
          {h:"<b>Blended plan converts</b>, on the left, picks how much to convert automatically. Try <b>To the top of the 12% bracket</b> to see what converting more costs now in tax and health premiums.",
            ok: b && $("brFill").value !== b.fill ? true : undefined},
          {h:"Later, <b>Send to Drawdown Simulator</b> carries these balances into the years after 59½. For now, <b>Back to guide</b> brings the plan with you."}
        ];
      }}
    ],
    chip(){
      const L = brLast;
      if (!L) return "";
      const t = L.best.test;
      return "Holds up in<br><b>" + (t.of ? pctStr(t.hold / t.of, 0) : "—") + "</b>";
    },
    capture(){
      const L = brLast;
      if (!L) return null;
      const b = L.best, t = b.test, a = gd.a, h = t.of ? t.hold / t.of : 0;
      a.bridge = b.phrase; a.bridgeHold = Math.round(h * 100); a.bridgeLeft = Math.round(b.steady.end.total);
      return "From the Early Retirement Bridge: with <b>" + escapeHtml(b.phrase) + "</b> (" + escapeHtml(b.desc) + "), you reach 59½ penalty-free in <b>" +
        pctStr(h, 0) + "</b> of historical markets, with about <b>" + money(b.steady.end.total) + "</b> left" +
        (h < 0.8 ? ". That's a shaky bridge: more in a Roth or taxable account, a later retirement or lower early spending would help." : ".");
    }},

  healthcare: {tool:"healthcare", name:"Healthcare Cost Planner", mins:4, title:"Price healthcare before Medicare",
    preview:["Your retirement age, household and state are filled in.",
      "You see marketplace premiums, and subsidies, for the years before 65.",
      "Then what Medicare costs after."],
    prefill(){
      const a = gd.a;
      if (gdOk(a.retire)) $("hcRetireAge").value = String(Math.max(40, Math.min(75, Math.round(a.retire))));
      $("hcStatus").value = gdMar() ? "m" : "s";
      $("hcHousehold").value = gdMar() ? "2" : "1";
      if (gdMar() && gdOk(a.spouseAge) && gdOk(a.age) && gdOk(a.retire))
        $("hcSpouseAge").value = String(Math.round(a.spouseAge + (a.retire - a.age)));
      if (a.state && $("hcState").querySelector("option[value='" + a.state + "']")) $("hcState").value = a.state;
      if (gdPos(a.retSpend)) $("hcIncome").value = gdM(a.retSpend);
    },
    tasks(){
      return [
        {h:"Retirement age, filing status, household size and state are filled in from your answers."},
        {h:"<b>Retirement MAGI</b> starts at your planned yearly spending, a cautious guess. Roth withdrawals and cash savings don't count toward it, so yours may be lower, which can mean a bigger subsidy."},
        {h:"Read the <b>Pre-65</b> section for your monthly premium before Medicare, then <b>Post-65</b> for what Medicare costs after."},
        {h:"Make sure those premiums fit inside the retirement spending you gave the guide."}
      ];
    },
    chip(){
      const v = gdHcPrem();
      return v != null ? "Premium before 65<br><b>" + money(v) + "/mo</b>" : "";
    },
    capture(){
      gd.a.hcSeen = true;
      const v = gdHcPrem();
      if (v != null) gd.a.hcPrem = v;
      return (v != null ? "From the Healthcare Cost Planner: about <b>" + money(v) + "/mo</b> for marketplace coverage before 65. " : "Back from the Healthcare Cost Planner. ") +
        "If that isn't part of your retirement spending, add it on the <b>Spending in retirement</b> step.";
    }},

  fire: {tool:"fire", name:"FIRE Calculator", mins:3, title:"Find your financial independence age",
    preview:["Your savings, monthly saving and yearly spending are loaded.",
      "You see the age your savings could cover your spending on their own.",
      "Coast FIRE shows when you could stop contributing."],
    prefill(){
      const a = gd.a;
      if (gdOk(a.age)) $("fiCurAge").value = String(Math.max(18, Math.min(70, Math.round(a.age))));
      if (gdOk(a.retire)) $("fiRetireAge").value = String(Math.round(a.retire));
      if (gdOk(a.saved)) $("fiInitial").value = gdM(a.saved);
      $("fiContrib").value = gdM(gdSaveNow()); $("fiPeriod").value = "Monthly";
      if (gdPos(a.retSpend)){
        $("fiTarget").value = gdM(a.retSpend);
        if ($("fiSolveFor").value !== "withdrawal"){
          $("fiSolveFor").value = "withdrawal";
          $("fiSolveFor").dispatchEvent(new Event("change", {bubbles:true}));
        }
      }
    },
    tasks(){
      return [
        {h:"Your savings, monthly saving and yearly spending (as the target) are loaded."},
        {h:"<b>FIRE age</b> is when your savings could cover that spending at the <b>Withdrawal rate</b>: 4% is the classic figure, 3.5% more cautious."},
        {h:"Switch to <b>Coast FIRE</b> at the top of the inputs. It finds when you could stop contributing and let growth carry you to your planned retirement age.", ok: gdFireMode() === "coast"},
        {h:"Raise the contribution a little and see how many years it takes off."}
      ];
    },
    chip(){
      const t = $("fiAge").textContent.trim();
      return t && t !== "—" ? $("fiAgeLabel").textContent + "<br><b>" + escapeHtml(t) + "</b>" : "";
    },
    capture(){
      const t = $("fiAge").textContent.trim();
      if (!t || t === "—") return null;
      gd.a.fiAge = t; gd.a.fiLabel = $("fiAgeLabel").textContent;
      return "From the FIRE Calculator: " + escapeHtml(gd.a.fiLabel) + " <b>" + escapeHtml(t) + "</b>.";
    }},
  advanced: {tool:"single", name:"Advanced calculator", mins:10, title:"Tour the Advanced calculator",
    prefill(){
      const a = gd.a;
      // Only the first time per visit, so going back to tweak it keeps your
      // changes; and never over an account-type split you've set up.
      if (gdFilled.single === gdPlanSig() || acOn() || !gdOk(a.age) || !gdOk(a.retire) || !(a.retire > a.age)) return;
      gdFilled.single = gdPlanSig();
      const infl = BASIC_INFL, gross = (1 + (a.risk || .045)) * (1 + infl) - 1;
      writeInputs({initial:a.saved || 0, contrib:Math.round(gdSaveMo()), period:"Monthly", growth:infl,
        gross, nominal:gross, inflation:infl, years:Math.round(a.retire - a.age), withdrawal:.04,
        taxRate:.10, vol:.15, fees:0});
      if (gdPos(a.retSpend)){ $("solveFor").value = "After-Tax Withdrawal"; $("target").value = gdM(a.retSpend); }
      renderAll();
    },
    tasks(){
      const mode = document.querySelector("#tab-single [data-mode].on");
      return [
        {h:"Your plan is carried over: savings as <b>Starting value</b>, your monthly saving, <b>Time period</b> until retirement, and a <b>Rate of return</b> for your mix, before inflation. Figures are in future dollars unless marked <b>inflation adjusted</b>."},
        {h:"<b>Contribution growth</b> raises what you save each year. It's set to match inflation; try 4% or 5% if you expect raises."},
        {h:"Turn on <b>Split by account type</b> to enter traditional, Roth and brokerage balances separately, plus your employer match. The <b>By account type</b> table then shows the tax on what you'd withdraw.", ok: acOn() ? true : undefined},
        {h:"Set <b>Fees</b> to your funds' expense ratio (about 0.05% for index funds, 0.5% to 1% for managed ones) to see what they cost over decades.", ok: num("fees") > 0 ? true : undefined},
        {h:"<b>Work backwards from a target</b> starts at your retirement spending. It shows the contribution, or the timeline, that gets you there; <b>Use this contribution</b> applies it."},
        {h:"Above the chart, switch <b>Rate band</b> to <b>Historical</b> or <b>Monte Carlo</b> to see the plan in real and random markets.", ok: mode ? mode.getAttribute("data-mode") !== "band" : undefined},
        {h:"Unlike the guide, Advanced leaves out Social Security, so its numbers are for your savings alone." +
          (gdOk(gd.a.stopAge) && gd.a.stopAge < gd.a.retire ? " It also saves right up to retirement; your plan to stop at " + fmtNum(gd.a.stopAge) + " shows in <b>Stages</b>." : "")}
      ];
    },
    chip(){
      const t = $("rFVreal").textContent.trim();
      return t && t !== "—" ? "Inflation adjusted<br><b>" + escapeHtml(t) + "</b>" : "";
    },
    capture(){
      gd.a.advSeen = true;
      return "Back from Advanced. Your guide answers are unchanged, and whatever you set up there stays in Advanced for next time.";
    }},

  stages: {tool:"series", name:"Stages calculator", mins:10, title:"Tour the Stages calculator",
    prefill(){
      const a = gd.a;
      if (gdFilled.series === gdPlanSig()) return;
      gdStagesFrom = "";
      if (saOn() || !gdOk(a.age) || !gdOk(a.retire) || !(a.retire > a.age)) return;
      gdFilled.series = gdPlanSig();
      const yrs = Math.round(a.retire - a.age), mo = Math.round(gdSaveMo()), infl = BASIC_INFL;
      const gross = (1 + (a.risk || .045)) * (1 + infl) - 1;
      const st = (name, years, contrib, adj) => ({name, years, contrib, period:"Monthly", growth:infl,
        nominal:gross, vol:.15, adj:!!adj});
      let list;
      const dy = gdPos(a.debtMonths) ? Math.ceil(a.debtMonths / 12) : 0;
      const cy = a.college === "yes" && gdOk(a.kidAge) && gdPos(a.collegeMo) ? Math.max(1, Math.round(22 - a.kidAge)) : 0;
      const sy = gdOk(a.stopAge) && a.stopAge < a.retire ? Math.max(0, Math.round(a.stopAge - a.age)) : null;
      // Start from a real turning point in their answers when there is one:
      // a plan to stop saving, the debt paid off freeing its minimums, or
      // college ending freeing that saving.
      if (sy === 0){
        list = [st("Coasting", yrs, 0)];
        gdStagesFrom = "one stage with no new saving, since your plan is to coast from here";
      } else if (sy != null){
        list = [st("Saving", sy, mo), st("Coasting", yrs - sy, 0)];
        gdStagesFrom = "two stages: saving " + money(mo) + "/mo until " + fmtNum(a.stopAge) + ", then coasting with no new saving until you retire at " + fmtNum(a.retire);
      } else if (dy && dy < yrs && gdPos(a.debtMin)){
        list = [st("Paying off debt", dy, mo), st("Debt-free", yrs - dy, mo + Math.round(a.debtMin), true)];
        gdStagesFrom = "two stages: saving " + money(mo) + "/mo while you pay off debt, then adding the " + money(a.debtMin) + "/mo of minimums once it's gone";
      } else if (cy && cy < yrs){
        list = [st("Kids at home", cy, mo), st("After college", yrs - cy, mo + Math.round(a.collegeMo), true)];
        gdStagesFrom = "two stages: saving " + money(mo) + "/mo until your youngest finishes college, then adding the " + money(a.collegeMo) + "/mo you'd been putting toward it";
      } else {
        list = [st("Until retirement", yrs, mo)];
        gdStagesFrom = "one stage: " + money(mo) + "/mo for " + yrs + " years";
      }
      gdStagesN = list.length;
      writeStagesState({globals:{initial:a.saved || 0, inflation:infl, withdrawal:.04, taxRate:.10, fees:0},
        stages:list, solveForS:"After-Tax Withdrawal", targetS: gdPos(a.retSpend) ? a.retSpend : num("targetS")});
    },
    tasks(){
      const mode = document.querySelector("#tab-series [data-mode].on");
      return [
        {h:"Stages splits your working years into chapters, each with its own contribution, raises and return." +
          (gdStagesFrom ? " From your answers we started with " + gdStagesFrom + "." : "")},
        {h:"Click <b>Add stage</b> for the next big change: a promotion, a paid-off car, going part-time. Give it <b>Years</b> and a <b>Contribution</b>.", ok: stages.length > gdStagesN},
        {h:"Tick <b>Inflation adjusted</b> on a later stage to type its contribution in today's dollars; it's grown by inflation up to that stage's start."},
        {h:"Each stage can have its own <b>Rate of return</b>, and the last one can glide toward bonds as retirement nears."},
        {h:"<b>Stage by stage</b>, under the chart, shows what each chapter adds, and the chart marks every boundary.", ok: undefined},
        {h:"Switch the chart to <b>Historical</b> to see the whole multi-stage plan in real markets.", ok: mode ? mode.getAttribute("data-mode") !== "band" : undefined}
      ];
    },
    chip(){
      const t = $("xFVreal").textContent.trim();
      return t && t !== "—" ? "Inflation adjusted<br><b>" + escapeHtml(t) + "</b>" : "";
    },
    capture(){
      gd.a.stagesSeen = true;
      return "Back from Stages. Your guide answers are unchanged, and your stages stay there for next time.";
    }},
  backtest: {tool:"backtest", name:"Portfolio Backtest", mins:5, title:"See what your mix has earned",
    prefill(){
      if (gdFilled.backtest) return;
      gdFilled.backtest = true;
      $("btStock").value = String(gdMixFor(gd.a.risk));
    },
    tasks(){
      const a = gd.a, mix = gdMixFor(a.risk), era = document.querySelector("#segBTEra button.on");
      const moved = (era && era.getAttribute("data-era") !== "all") || num("btStock") !== mix;
      return [
        {h:"<b>Stocks</b> is set to " + mix + "%, close to your " + gdRiskLabel(a.risk || .045) + " mix; the rest is bonds. This shows what that mix actually earned, year by year, since 1926."},
        {h:"<b>After inflation</b> is the figure to compare with the " + pctStr(a.risk || .045, 1) + " a year the guide assumed for your plan. <b>Return, per year</b> is the same before inflation."},
        {h:"Try <b>Last 30</b> or <b>Last 50</b>, and a different mix, to see how much the answer moves with the period you pick.", ok: moved},
        {h:"<b>Worst year</b> and <b>Deepest fall</b> show what you'd have had to sit through. If a drop like that would have made you sell, a lower stock mix may suit you better."},
        {h:"<b>Rolling returns</b> lists every stretch of years, not just one average, so you can see the range: the best, the worst and the typical."},
        {h:"Use it to choose a reasonable rate for planning, and <b>Use these figures in Advanced</b> carries it over. Past performance doesn't predict future returns: treat history as a range of what's possible, and plan toward the cautious end of it."}
      ];
    },
    chip(){
      const t = $("btReal").textContent.trim();
      return t && t !== "—" ? "After inflation<br><b>" + escapeHtml(t) + "</b>" : "";
    },
    capture(){
      gd.a.btSeen = true;
      return "Back from Portfolio Backtest. Remember, history shows the range of what's happened, not a forecast. The guide keeps assuming " +
        pctStr(gd.a.risk || .045, 1) + " a year after inflation; change your mix on the <b>Retirement savings</b> step if you'd like a different one.";
    }}
};
/* The planner's headline pre-65 premium, the first net figure it shows
   (current law), read off the page since it's drawn as text. */
/* The guide's projected savings at retirement, split in the shares of today's
   balances the Getting to 59½ step asked about; the rest is traditional. */
function gdBridgeSplit(){
  const a = gd.a, S = gdSim(), total = S ? S.fv : (a.saved || 0), saved = Math.max(1, a.saved || 0);
  const rNow = gdPos(a.brRothNow) ? a.brRothNow : 0, bNow = gdPos(a.brBrokNow) ? a.brBrokNow : 0;
  const rs = Math.min(1, rNow / saved), bs = Math.min(1 - rs, bNow / saved);
  const roth = total * rs, brok = total * bs;
  return {total, roth, brok, trad:Math.max(0, total - roth - brok), basis:Math.min(roth, rNow),
    mix: S ? S.mix : 70};
}
/* Retirement spending without the marketplace premium, when the guide has
   already added it: the bridge tool prices coverage itself. */
function gdBridgeSpend(){
  const a = gd.a;
  let v = a.retSpend || 0;
  if (gdPos(a.hcPrem) && (a.hcIncl === "yes" || a.hcAdded)) v = Math.max(0, v - a.hcPrem * 12);
  return v;
}
function gdHcPrem(){
  const el = $("hcACABody") && $("hcACABody").querySelector(".kv.total .v");
  if (!el) return null;
  const v = parseFloat(el.textContent.replace(/[^0-9.]/g, ""));
  return isFinite(v) ? v : null;
}
/* The backtest's stock share nearest each of the guide's investment mixes. */
function gdMixFor(real){
  const i = RISK_LEVELS.findIndex(r => Math.abs(r.real - (real || .045)) < 1e-6);
  return [20, 40, 60, 80, 100][i < 0 ? 2 : i];
}
function gdBasicNow(){
  const p = readBasic();
  return {monthly: p.contrib * (PPY[p.period] || 12) / 12, retire: p.retire, saved: p.initial, risk: p.real};
}

/* Everything the household bar also knows goes there too, so every tool
   starts from these numbers after a reload. Blank answers leave the
   profile's own value alone. */
function gdHouseholdSync(){
  const a = gd.a, H = Object.assign({}, hhLoad() || {});
  if (a.status) H.status = a.status;
  if (gdOk(a.age)) H.age = a.age;
  H.spouseAge = gdMar() && gdOk(a.spouseAge) ? a.spouseAge : (gdMar() ? H.spouseAge : null);
  if (gdOk(a.retire)) H.retire = a.retire;
  if (a.state) H.state = a.state;
  if (gdOk(a.income)) H.income = a.income;
  H.income2 = gdMar() && gdOk(a.income2) ? a.income2 : (gdMar() ? H.income2 : null);
  if (gdOk(a.saved)) H.saved = a.saved;
  if (gdOk(a.contrib)) H.monthly = gdSaveNow();
  if (gdPos(a.retSpend)) H.spend = a.retSpend;
  storeWrite("household", H);
  if ($("hhBody").hidden) hhWriteForm(H);
  hhSummary();
}
/* First visit: start from whatever the household bar already holds. */
function gdSeedFromHousehold(){
  const H = hhLoad(), a = gd.a;
  if (!H) return;
  const put = (k, v) => { if (a[k] == null && v != null && v !== "") a[k] = v; };
  put("status", H.status); put("age", H.age); put("spouseAge", H.spouseAge); put("retire", H.retire);
  put("state", H.state); put("income", H.income); put("income2", H.income2); put("saved", H.saved);
  put("retSpend", H.spend);
}

