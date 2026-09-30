/* ---------- the steps ---------- */
const GD_CH = ["About you", "Cash flow", "Safety net", "Big goals", "Retirement", "Your plan"];
const GD_STEPS = [
  {id:"intro", ch:-1, title:"Welcome",
    body(){
      const started = Object.keys(gd.done).length > 0;
      return "<h2 class='gd-q' tabindex='-1'>" + (started ? "Welcome back" : "How ready are you for retirement?") + "</h2>" +
        "<p class='gd-lead'>This guide goes through your money one question at a time: what you earn, what you spend, what you owe and what you've saved. " +
        "When you don't know an answer, it opens the tool on this site that finds it, tells you exactly what to fill in, and brings the result back here.</p>" +
        "<ul class='gd-perks'>" +
        "<li><i>1</i><span><b>A readiness score out of 100</b> that updates as you answer, and shows what's pulling it down.</span></li>" +
        "<li><i>2</i><span><b>A tour of the tools that apply to you.</b> No mortgage? No kids? Those get skipped.</span></li>" +
        "<li><i>3</i><span><b>A plan you can adjust, with taxes built in.</b> Ahead of schedule? See what retiring sooner, coasting or spending more would look like, and apply it. Behind? Pick the fix that suits you. Then the Plan Optimizer finds the best way to claim Social Security, draw down your accounts and convert to Roth.</span></li>" +
        "<li><i>4</i><span><b>A short, ordered list</b> of what to do next, with the tool for each step.</span></li></ul>" +
        "<div class='gd-callout'>Plan on 20 to 40 minutes, depending on how many tools you open. Stop whenever you like: your answers are kept in this browser only and never leave it.</div>";
    },
    foot(){
      const started = Object.keys(gd.done).length > 0;
      return started
        ? "<button type='button' class='btn' data-gd='restart'>Start over</button><span class='sp'></span><button type='button' class='btn primary' data-gd='resume'>Pick up where you left off<i class='arw' aria-hidden='true'></i></button>"
        : "<span class='sp'></span><button type='button' class='btn primary' data-gd='next'>Let's begin<i class='arw' aria-hidden='true'></i></button>";
    }},

  {id:"about", ch:0, title:"About you",
    body(){
      const a = gd.a;
      const states = [["", "Choose your state"]].concat(Array.prototype.map.call($("txState").options, o => [o.value, o.textContent]));
      return "<h2 class='gd-q' tabindex='-1'>First, a little about you</h2>" +
        "<p class='gd-lead'>These set the timeline for everything else. They also fill in the household bar at the top of the page, so every tool on the site starts from your numbers.</p>" +
        "<div class='gd-fields'>" +
        gdSelF("status", "Household", [["s", "Just me"], ["m", "Me and a spouse or partner"]], {rerender:true, full:true}) +
        gdNumF("age", "Your age", "age") +
        (gdMar() ? gdNumF("spouseAge", "Spouse's age", "age") : "") +
        gdNumF("retire", "Age you'd like to retire", "age", {hint:"A guess is fine. You can try other ages later."}) +
        gdSelF("state", "State", states, {hint:"For state income tax and healthcare costs."}) +
        "</div>" + gdLive("aboutNote");
    },
    ok(a){ return gdOk(a.age) && a.age >= 16 && a.age < 100 && gdOk(a.retire) && a.retire > a.age && a.retire <= 90; },
    why(){ return "Enter your age and a retirement age after it"; },
    commit(){ if (!gd.a.status) gd.a.status = "s"; gdHouseholdSync(); }},

  {id:"income", ch:1, title:"Your income",
    body(){
      return "<h2 class='gd-q' tabindex='-1'>What do you earn in a year?</h2>" +
        "<p class='gd-lead'>Your salary or wages <b>before</b> taxes and paycheck deductions come out: the headline number on an offer letter. If your pay moves around, use last year's total.</p>" +
        "<div class='gd-fields'>" +
        gdMoneyF("income", "Your gross income", {per:"/yr", hint:"Self-employed? Use your net profit. Not working right now? Enter 0."}) +
        (gdMar() ? gdMoneyF("income2", "Spouse's gross income", {per:"/yr"}) : "") +
        "</div>" + gdLive("incomeNote");
    },
    ok(a){ return gdOk(a.income); },
    why(){ return "Enter your yearly income"; },
    commit(){ gdHouseholdSync(); }},

  {id:"takehome", ch:1, title:"Take-home pay",
    body(){
      const a = gd.a, est = gdTaxEst();
      const showField = a.thKnow === "yes" || gdPos(a.takehome);
      return "<h2 class='gd-q' tabindex='-1'>Do you know your monthly take-home pay?</h2>" +
        "<p class='gd-lead'>Take-home is what actually lands in your bank account after taxes and anything your employer takes out, like 401(k) contributions and health insurance. It's the number your budget has to live within.</p>" +
        "<div class='gd-choices two'>" +
        gdChoice("thKnow", "yes", "Yes, I know it", "I'll type it in") +
        gdChoice("thKnow", "no", "No, help me work it out", "The Income Tax tool estimates it from your salary") +
        "</div>" + gdBack("takehome") +
        (a.thKnow === "no" ? gdTask("tax", "Find it with the Income Tax tool",
          {label: gdPos(a.takehome) ? "Open Income Tax again" : null,
           after: est > 0 && !gdPos(a.takehome) ? "<div style='margin-top:12px'><button type='button' class='gd-link' data-fill='takehome' data-v='" + Math.round(est) + "'>Or skip the tool and use a quick estimate: about " + money(est) + "/mo</button></div>" : ""}) : "") +
        (showField ? "<div class='gd-fields'>" + gdMoneyF("takehome", "Monthly take-home pay", {per:"/mo",
          hint: gdMar() ? "For the two of you together." : "Paid every two weeks? Multiply one paycheck by 26, then divide by 12."}) + "</div>" : "");
    },
    ok(a){ return gdPos(a.takehome); },
    why(a){ return a.thKnow === "no" ? "Open the Income Tax tool, or use the estimate" : "Enter your monthly take-home"; }},

  {id:"spending", ch:1, title:"Monthly spending",
    body(){
      const a = gd.a;
      const showField = a.bgKnow === "yes" || gdPos(a.spend);
      return "<h2 class='gd-q' tabindex='-1'>Do you know what you spend each month?</h2>" +
        "<p class='gd-lead'>Knowing where the money goes is the foundation for the rest: it sizes your emergency fund, shows what you can put toward debt or savings, and hints at what retirement will cost.</p>" +
        "<div class='gd-choices two'>" +
        gdChoice("bgKnow", "yes", "Yes, I track it", "I have a budget or a good handle on it") +
        gdChoice("bgKnow", "no", "Not really", "Let's build a budget together") +
        "</div>" + gdBack("spending") +
        (a.bgKnow === "no" ? gdTask("budget", "Build it in the Budget tool", {label: gdPos(a.spend) ? "Open Budget again" : null}) : "") +
        (showField ? "<div class='gd-fields'>" + gdMoneyF("spend", "Monthly spending", {per:"/mo",
          hint:"Everything except what you save or invest: housing, bills, food, car, fun. Add yearly costs divided by 12."}) + "</div>" : "") +
        gdLive("flowNote");
    },
    ok(a){ return gdPos(a.spend); },
    why(a){ return a.bgKnow === "no" ? "Build your budget first" : "Enter your monthly spending"; }},

  {id:"cash", ch:2, title:"Emergency fund",
    body(){
      return "<h2 class='gd-q' tabindex='-1'>How much cash do you have for emergencies?</h2>" +
        "<p class='gd-lead'>An emergency fund covers a job loss, a car repair or a medical bill without new debt. Count checking, savings and money market accounts, not retirement accounts or investments you'd have to sell.</p>" +
        "<div class='gd-fields'>" + gdMoneyF("cash", "Cash savings", {hint:"One income, children, or pay that varies? Aim toward six months. Two steady incomes can aim toward three."}) + "</div>" +
        gdLive("cashNote");
    },
    ok(a){ return gdOk(a.cash); },
    why(){ return "Enter your cash savings, even if it's 0"; }},

  {id:"debt", ch:2, title:"Debt",
    body(){
      const a = gd.a;
      let s = "<h2 class='gd-q' tabindex='-1'>Do you owe money on anything besides a mortgage?</h2>" +
        "<p class='gd-lead'>Credit cards you carry a balance on, car loans, student loans, personal or medical loans. Interest on high-rate debt often costs more than investments earn, so paying it off comes before most other goals.</p>" +
        "<div class='gd-choices two'>" +
        gdChoice("debtHas", "no", "No, nothing", "Or only a mortgage") +
        gdChoice("debtHas", "yes", "Yes", "Let's see how fast you can be rid of it") +
        "</div>" + gdBack("debt");
      if (a.debtHas === "yes"){
        if (a.debtSrc !== "tool") s += gdTask("debt", "Make a plan in Debt Payoff", {label:"List them in Debt Payoff",
          after: a.debtSrc !== "quick" ? "<div style='margin-top:12px'><button type='button' class='gd-link' data-set='debtSrc' data-val='quick'>Rather not list them? Enter the totals instead</button></div>" : ""});
        if (a.debtSrc === "quick" || a.debtSrc === "tool")
          s += "<div class='gd-fields'>" + gdMoneyF("debtTotal", "Total you owe") +
            gdMoneyF("debtHi", "Of that, at 8% interest or more", {hint:"Credit cards almost always are."}) + "</div>";
        if (a.debtSrc === "tool") s += "<button type='button' class='gd-link' data-trip='debt'>Open your plan in Debt Payoff again</button>";
      }
      return s;
    },
    ok(a){ return a.debtHas === "no" || (a.debtHas === "yes" && gdOk(a.debtTotal)); },
    why(a){ return a.debtHas === "yes" ? "List your debts, or enter the total" : "Choose an answer"; }},

  {id:"home", ch:3, title:"Housing",
    body(){
      const a = gd.a;
      let s = "<h2 class='gd-q' tabindex='-1'>What's your housing situation?</h2>" +
        "<p class='gd-lead'>Housing is most people's biggest cost. If a home purchase or a mortgage is part of your picture, the Mortgage Calculator shows what it really costs. If not, we'll skip it.</p>" +
        "<div class='gd-choices'>" +
        gdChoice("home", "rent", "I rent, with no plans to buy soon") +
        gdChoice("home", "buy", "I'd like to buy in the next few years", "See what a home would cost each month") +
        gdChoice("home", "mortgage", "I own and I'm paying off a mortgage", "See what extra payments would do") +
        gdChoice("home", "own", "I own my home outright") +
        gdChoice("home", "other", "Something else", "Living with family, or it's complicated") +
        "</div>" + gdBack("home");
      if (a.home === "buy") s += gdTask("mortBuy", "Price it in the Mortgage Calculator", {after:"<div style='margin-top:10px' class='hint'>Optional. Continue whenever you're ready.</div>"});
      if (a.home === "mortgage"){
        s += gdTask("mortOwn", "Try extra payments in the Mortgage Calculator", {after:"<div style='margin-top:10px' class='hint'>Optional. Continue whenever you're ready.</div>"});
        s += "<div class='gd-h3'>Will it be paid off by the time you retire?</div><div class='gd-choices two'>" +
          gdChoice("mortPaid", "yes", "Yes", "Your spending drops once it's gone") + gdChoice("mortPaid", "no", "No, or not sure") + "</div>";
      }
      if (a.home === "mortgage" && !gdOk(a.housePay) && gdPos(a.bgHousing)) a.housePay = a.bgHousing;
      if (a.home === "buy" || a.home === "mortgage")
        s += "<div class='gd-fields'>" + gdMoneyF("housePay", a.home === "buy" ? "Expected house payment" : "Your house payment",
          {per:"/mo", hint: a.home === "mortgage" && gdPos(a.bgHousing) && a.housePay === a.bgHousing ? "From your budget's housing lines. Loan, property tax, insurance, PMI and HOA."
            : "Loan, property tax, insurance, PMI and HOA. The calculator fills this in."}) + "</div>" + gdLive("houseNote");
      return s;
    },
    ok(a){ return !!a.home; },
    why(){ return "Choose an answer"; }},

  {id:"college", ch:3, title:"College",
    body(){
      const a = gd.a;
      let s = "<h2 class='gd-q' tabindex='-1'>Are you saving for a child's college?</h2>" +
        "<p class='gd-lead'>If helping with college is a goal, it helps to know the monthly number now. If not, or your children are grown, skip ahead.</p>" +
        "<div class='gd-choices two'>" +
        gdChoice("college", "yes", "Yes, or I'd like to") + gdChoice("college", "no", "No, or it doesn't apply") +
        "</div>" + gdBack("college");
      if (a.college === "yes"){
        s += "<div class='gd-fields'>" + gdNumF("kidAge", "Youngest child's age", "age", {hint:"Not born yet? Enter 0."}) + "</div>";
        s += gdTask("college", "Find the number with College Savings");
        s += "<div class='gd-fields'>" + gdMoneyF("collegeMo", "Monthly for college", {per:"/mo", hint:"The tool fills this in."}) + "</div>";
        s += "<div class='gd-callout warn'><b>Retirement comes first.</b> There are loans for college but none for retirement, and your own security is a gift to your children too.</div>";
      }
      return s;
    },
    ok(a){ return !!a.college; },
    why(){ return "Choose an answer"; }},

  {id:"savings", ch:4, title:"Retirement savings",
    body(){
      const a = gd.a;
      if (a.risk == null) a.risk = .045;
      if (!a.saveTo) a.saveTo = "trad";
      return "<h2 class='gd-q' tabindex='-1'>Where do your retirement savings stand?</h2>" +
        "<p class='gd-lead'>Add up everything set aside for retirement: 401(k), 403(b), IRAs, Roth accounts and any investments you've earmarked for it. Your account websites show the balances.</p>" +
        "<div class='gd-fields'>" +
        gdMoneyF("saved", "Saved for retirement so far", {full:true}) +
        gdMoneyF("contrib", "You contribute", {per:"/mo", hint: gdPos(a.bgSave) ? "Your budget shows " + money(a.bgSave) + "/mo going to savings." : "From your paycheck and on your own."}) +
        gdMoneyF("employer", "Your employer adds", {per:"/mo", hint:"Matching or profit sharing. 0 if none."}) +
        "</div>" +
        gdLive("inflNote") +
        "<div class='gd-h3'>Does your employer match what you put in?</div><div class='gd-choices two'>" +
        gdChoice("match", "full", "Yes, and I get all of it") + gdChoice("match", "partial", "Yes, but I'm not getting all of it") +
        gdChoice("match", "none", "No match, or I'm self-employed") + gdChoice("match", "unsure", "Not sure") + "</div>" +
        "<div class='gd-fields'>" + gdSelF("risk", "How is it invested?", RISK_LEVELS.map(r => [r.real, r.label + " · " + r.sub]),
          {kind:"num", full:true, hint:"Target-date funds are usually Balanced or Growth until the last decade before retirement."}) + "</div>" +
        gdLive("rateNote") +
        "<div class='gd-h3'>What kind of accounts is it in?</div>" +
        "<p class='hint' style='margin:-4px 0 10px;max-width:64ch'>It changes the tax you'll pay in retirement: traditional money is taxed when it comes out, Roth money isn't, and a brokerage account is taxed only on its gains. Leave these blank if it's all in a regular 401(k) or IRA.</p>" +
        "<div class='gd-fields'>" +
        gdMoneyF("rothNow", "Of that, in Roth accounts", {ph:"0", hint:"Roth 401(k) and Roth IRA."}) +
        gdMoneyF("brokNow", "In a taxable brokerage account", {ph:"0", hint:"Only money meant for retirement."}) +
        "</div>" + gdLive("acctNote") +
        "<div class='gd-h3'>Where does your monthly saving go?</div><div class='gd-choices two'>" +
        GD_SAVE_TO.map(x => gdChoice("saveTo", x[0], x[1], x[2])).join("") + "</div>" +
        "<p class='hint' style='margin:-4px 0 0'>Your employer's share goes into a traditional account either way.</p>";
    },
    ok(a){ return gdOk(a.saved) && gdOk(a.contrib) && !!a.match; },
    why(){ return "Fill in your savings and contributions, and answer the match question"; },
    commit(){ if (!gdOk(gd.a.employer)) gd.a.employer = 0; gdHouseholdSync(); }},

  {id:"retspend", ch:4, title:"Spending in retirement",
    body(){
      const a = gd.a, picks = [];
      if (gdPos(a.spend)){
        picks.push(["Same as today", a.spend * 12]);
        picks.push(["80% of today", a.spend * 12 * .8]);
        // Only the loan itself goes away; property tax and insurance don't.
        const loan = gdPos(a.mortPI) ? a.mortPI : gdPos(a.bgMort) ? a.bgMort : 0;
        if (a.home === "mortgage" && a.mortPaid === "yes" && loan > 0 && a.spend > loan)
          picks.push(["Today, less the loan payment", (a.spend - loan) * 12]);
      }
      return "<h2 class='gd-q' tabindex='-1'>What will you spend in retirement?</h2>" +
        "<p class='gd-lead'>A year of the retirement you want, priced at today's prices: what you'll live on, <b>after</b> income tax. Many people spend around 80% of what they do now: no commute, no saving for retirement, often no mortgage. Travel can push it back up.</p>" +
        (picks.length ? "<div class='gd-picks'>" + picks.map(p => "<button type='button' class='gd-pick' data-fill='retSpend' data-v='" + Math.round(p[1] / 100) * 100 + "'>" +
          p[0] + ": <b>" + money(Math.round(p[1] / 100) * 100) + "/yr</b></button>").join("") + "</div>" : "") +
        "<div class='gd-fields'>" + gdMoneyF("retSpend", "Yearly spending in retirement", {per:"/yr", full:true, hint:"In today's dollars, after tax. Leave out health insurance before 65 too: the plan prices it."}) + "</div>" +
        gdBack("retspend") + gdLive("taxNote") +
        gdLive("ssNote") +
        "<div class='gd-fields'>" + gdMoneyF("ssOwn", gdMar() ? "Have a Social Security statement? Your benefit" : "Have a Social Security statement? Your monthly benefit", {per:"/mo", full:!gdMar(),
          ph:"optional", hint:"From ssa.gov/myaccount, at 67. It reflects your real earnings, so it beats our estimate."}) +
        (gdMar() ? gdMoneyF("ssOwn2", "Your spouse's benefit", {per:"/mo", ph:"optional", hint:"From their own statement, at 67."}) : "") +
        gdSelF("ssClaim", gdMar() ? "When would you each claim it?" : "When would you claim it?", [["", "At 67, or when I retire if that's later"]].concat([62, 63, 64, 65, 66, 67, 68, 69, 70].map(x =>
          [x, "At " + x + (x === 62 ? ", the earliest" : x === 67 ? ", full retirement age" : x === 70 ? ", the most it pays" : "")])),
          {kind:"num", full:true, hint:"Each year you wait past 62 raises the benefit for life, up to 70. In this plan it never starts before you retire. The Plan Optimizer, near the end, tries every age for " + (gdMar() ? "each of you." : "you.")}) + "</div>" +
        "<div class='gd-h3'>A pension, or other steady income in retirement?</div>" +
        "<div class='gd-fields'>" + gdMoneyF("pension", "Pension, annuity or part-time pay", {per:"/mo", ph:"optional", hint:"In today's dollars. Leave blank if none."}) +
        gdNumF("pensionAge", "Starting at", "age", {hint:"Blank means when you retire."}) +
        gdSelF("pensionCola", "Does it rise with inflation?", [["no", "No, it's a fixed amount"], ["yes", "Yes, it has cost-of-living raises"]], {full:true}) + "</div>" +
        gdLive("pensionNote");
    },
    ok(a){ return gdPos(a.retSpend); },
    why(){ return "Enter your yearly spending in retirement"; },
    commit(){ gdHouseholdSync(); }},

  {id:"outlook", ch:4, title:"Your projection",
    body(){
      const a = gd.a, S = gdSim();
      let s = "<h2 class='gd-q' tabindex='-1'>Your retirement projection</h2>";
      if (!S) return s + "<div class='gd-callout warn'>This needs your age, savings and retirement spending first.</div>" +
        "<button type='button' class='btn' data-go='savings'>Go to Retirement savings</button>";
      const need = S.spend + S.taxYr, port = S.portIncome, ss = S.ss.total, pen = S.pension;
      const sc = Math.max(need, port + ss + pen) || 1;
      s += "<p class='gd-lead'>Where your current path leads by " + fmtNum(S.retire) + ", in today's dollars, if a " + gdRiskLabel(S.real) +
        " mix earns about " + pctStr(S.real, 1) + " a year after inflation and your saving keeps pace with inflation" +
        (S.stop != null ? (S.stop <= a.age ? ". You've stopped saving, so it grows on its own from here" : " until you stop saving at " + fmtNum(S.stop)) : "") + ".</p>" + gdBack("outlook") +
        "<div class='gd-stats'>" +
        "<div><div class='k'>Savings at " + fmtNum(S.retire) + "</div><div class='v gold'>" + money(S.fv) + "</div><div class='n'>" +
          (S.stop != null && S.stop <= a.age ? "What you have grows to" : "What " + money(gdSaveMo()) + "/mo grows to") + "</div></div>" +
        "<div><div class='k'>Income it supports</div><div class='v'>" + money(port) + "</div><div class='n'>A year, taking 4%</div></div>" +
        "<div><div class='k'>" + (pen ? "Social Security + pension" : "Social Security") + "</div><div class='v'>" + money(ss + pen) + "</div><div class='n'>A year, Social Security from " + S.ss.claim + "</div></div></div>" +
        "<div class='gd-cover'><div class='gd-cover-bar' role='img' aria-label='Income covers " + pctStr(Math.min(9.99, S.coverage), 0) + " of planned spending'>" +
        "<i style='width:" + (port / sc * 100).toFixed(1) + "%;background:var(--jade)'></i>" +
        "<i style='width:" + (ss / sc * 100).toFixed(1) + "%;background:var(--steel)'></i>" +
        (pen ? "<i style='width:" + (pen / sc * 100).toFixed(1) + "%;background:var(--gold)'></i>" : "") +
        "<span class='need' style='left:calc(" + (need / sc * 100).toFixed(1) + "% - 1px)'></span></div>" +
        "<div class='gd-cover-key'><span><s style='background:var(--jade)'></s>From savings</span><span><s style='background:var(--steel)'></s>Social Security</span>" +
        (pen ? "<span><s style='background:var(--gold)'></s>Pension</span>" : "") +
        "<span><s style='background:var(--text);width:2px'></s>Your spending and its tax: " + money(need) + "/yr</span></div></div>";
      s += "<div class='gd-callout'><b>Taxes are built in.</b> In a typical year this plan pays about <b>" + money(S.taxYr) + "</b> in income tax" +
        (S.hcYr > 0 ? ", and about <b>" + money(S.hcYr) + "</b> a year for health insurance before Medicare, after the subsidy your income earns" : "") +
        ", on top of the " + money(S.spend) + " you live on. Across the whole retirement that comes to about <b>" + money(S.lifeTax) + "</b> in tax, in today's dollars" +
        (S.tactics ? ", with the Plan Optimizer's choices applied." : ". The Plan Optimizer, near the end, looks for ways to pay less of it.") + "</div>";
      s += gdChartSlot("outlook", [gdSeries(S, "Your plan", "p")], "Your retirement savings over time, in today's dollars");
      // Size the plan against what it needs: the balance at retirement that
      // lasts in the target share of history. This is what a plan with twice
      // what it needs gets told, rather than only "you're covered."
      const want = gdNeed(S), goal = gdTarget();
      if (S.success >= goal - 1e-9 && want > 0 && S.fv >= want * 1.2)
        s += "<div class='gd-callout ok'>You're on course for <b>" + money(S.fv) + "</b>. To last in " + (goal >= 1 ? "every" : pctStr(goal, 0) + " of") +
          " historical retirements, this plan needs about <b>" + money(want) + "</b>, so you're " +
          (S.fv >= want * 9.5 ? "<b>covered many times over</b>" : S.fv >= want * 1.9 ? "at about <b>" + (Math.round(S.fv / want * 10) / 10).toString().replace(/\.0$/, "") + " times</b> that" : "<b>" + money(S.fv - want) + "</b> ahead") +
          ". Two steps on, <b>Adjust your plan</b> shows what that extra could buy: retiring sooner, coasting, saving less or spending more.</div>";
      else if (S.coverage >= 1) s += "<div class='gd-callout ok'>On this path, savings" + (pen ? ", Social Security and your pension" : " and Social Security") + " together cover <b>" + pctStr(Math.min(S.coverage, 9.99), 0) + "</b> of the retirement you described.</div>";
      else s += "<div class='gd-callout warn'>That covers <b>" + pctStr(S.coverage, 0) + "</b> of the " + money(need) + " a year you plan to spend, a gap of about <b>" + money(need - port - ss - pen) + " a year</b>" +
        (want > S.fv ? ": you'd want about <b>" + money(want) + "</b> saved by " + fmtNum(S.retire) : "") + ". <b>Adjust your plan</b>, two steps on, shows the quickest ways to close it and applies the one you pick.</div>";
      if (S.retire < S.ss.claim) s += "<div class='gd-callout'>Social Security starts at " + S.ss.claim + ", so for the first " + (S.ss.claim - Math.round(S.retire)) + " years of retirement your savings carry everything. The next step tests exactly that.</div>";
      s += gdTask("basic", "See it in the Basic calculator", {after:"<div style='margin-top:10px' class='hint'>Optional. Any change you make there can come back with you.</div>"});
      return s;
    }},

  {id:"lasting", ch:4, title:"Will it last?",
    body(){
      const S = gdSim();
      let s = "<h2 class='gd-q' tabindex='-1'>Will your money last?</h2>";
      if (!S) return s + "<div class='gd-callout warn'>This needs your age, savings and retirement spending first.</div>" +
        "<button type='button' class='btn' data-go='savings'>Go to Retirement savings</button>";
      const r = S.success;
      s += "<p class='gd-lead'>Averages hide the real risk: retiring into a bad market. We replayed your plan through every retirement since 1926: " +
        money(S.fv) + " at " + fmtNum(S.retire) + ", living on " + money(S.spend) + " a year after tax, rising with inflation, for " + S.years + " years, " +
        "with each year's income tax" + (S.hcYears ? ", health insurance before Medicare" : "") + " and any Medicare surcharge paid on top, Social Security from " + S.ss.claim + (S.pension ? ", your pension" : "") + " and " + S.mix + "% in stocks.</p>" + gdBack("lasting") +
        "<div class='gd-stats'><div><div class='k'>Success rate</div><div class='v " + (r >= .85 ? "jade" : "gold") + "'>" + pctStr(r, 0) + "</div>" +
        "<div class='n'>" + (S.H ? S.H.survived + " of " + S.H.total + " starting years" : "Of historical retirements") + "</div></div>" +
        "<div><div class='k'>Length tested</div><div class='v'>" + S.years + " years</div><div class='n'>To age " + (Math.round(S.retire) + S.years) + "</div></div>" +
        "<div><div class='k'>Typical balance left</div><div class='v'>" + (S.H ? money(S.H.medianEnd) : "—") + "</div><div class='n'>In today's dollars</div></div></div>";
      if (S.H && S.H.failYears.length) s += "<p class='gd-fails'>It ran short retiring in " + gdYears(S.H.failYears) + ".</p>";
      s += r >= .95 ? "<div class='gd-callout ok'><b>Very solid.</b> The plan survived " + (r >= 1 ? "every" : "nearly every") + " market in history, which can mean you have room to spend more or retire sooner.</div>"
        : r >= .85 ? "<div class='gd-callout ok'><b>A solid plan.</b> The few failures came from the worst starting years, and small spending cuts during a bad stretch usually fix those.</div>"
        : r >= .7 ? "<div class='gd-callout warn'><b>Borderline.</b> It works in most markets but fails in enough of them to take seriously. A flexible withdrawal strategy, or the fixes in your plan, would firm it up.</div>"
        : "<div class='gd-callout bad'><b>At risk.</b> This plan runs short in too many historical markets. The next step shows what closes the gap.</div>";
      s += "<p class='hint'>Next: adjust your plan, then choose how you'd spend it down, with a guided tour of the Drawdown Simulator.</p>";
      return s;
    }},

  {id:"tune", ch:5, title:"Adjust your plan",
    body(){ return gdTuneHTML(); }},

  {id:"strategy", ch:5, title:"Drawing it down",
    body(){ return gdStratHTML(); }},

  {id:"health", ch:5, title:"Healthcare before 65", when: a => gdOk(a.retire) && a.retire < 65,
    body(){
      const a = gd.a, gap = 65 - Math.round(a.retire);
      if (!a.hcIncl) a.hcIncl = "no";
      return "<h2 class='gd-q' tabindex='-1'>Healthcare before Medicare</h2>" +
        "<p class='gd-lead'>Retiring at " + fmtNum(a.retire) + " leaves <b>" + gap + (gap === 1 ? " year" : " years") + "</b> before Medicare starts at 65. " +
        "Until then you'll buy coverage on the ACA marketplace, where the price depends heavily on your income in retirement: keeping it low can earn a large subsidy. " +
        "Your plan prices it for you, year by year: the benchmark Silver plan for your state and age, less the subsidy that year's income earns.</p>" +
        gdBack("health") +
        "<div class='gd-h3'>Is health insurance already in your retirement spending?</div><div class='gd-choices two'>" +
        gdChoice("hcIncl", "no", "No, price it for me", "The usual answer") + gdChoice("hcIncl", "yes", "Yes, it's included", "Your plan won't add premiums") + "</div>" +
        gdLive("hcNote") + gdTask("healthcare", "Explore it in the Healthcare Cost Planner", {after:"<div style='margin-top:10px' class='hint'>Optional. It shows how the subsidy moves with income, and Medicare's costs after 65.</div>"});
    }},

  {id:"bridge", ch:5, title:"Getting to 59½", when: a => gdOk(a.retire) && a.retire < 59.5,
    body(){
      const a = gd.a, gap = Math.ceil(59.5 - a.retire);
      return "<h2 class='gd-q' tabindex='-1'>Getting to 59½</h2>" +
        "<p class='gd-lead'>Retiring at " + fmtNum(a.retire) + " means about <b>" + gap + (gap === 1 ? " year" : " years") + "</b> before a 401(k) or IRA " +
        "opens up without a 10% penalty. There are several legal ways across: living off a taxable account and your Roth contributions, " +
        (a.retire >= 55 ? "72(t) payments and the rule of 55" : "a Roth conversion ladder and 72(t) payments") + ". Which works best depends on where your money sits.</p>" +
        gdLive("bridgeNote") +
        "<p class='hint' style='margin:-6px 0 14px'>The split comes from your Retirement savings step. <button type='button' class='gd-link' data-go='savings'>Change it</button></p>" +
        "<div class='gd-callout'>Your plan already follows the rules: before 59½ it lives on the brokerage account and Roth contributions first, and only pays the 10% penalty if nothing else is left. The Plan Optimizer, next, can build a Roth conversion ladder to open up traditional money early.</div>" +
        (a.retire >= 55 ? "<div class='gd-h3'>Will you leave a job with a 401(k) at 55 or later?</div><div class='gd-choices two'>" +
          gdChoice("rule55", "yes", "Yes", "The rule of 55 lets that 401(k) pay out without the penalty") + gdChoice("rule55", "no", "No, or not sure") + "</div>" : "") +
        gdBack("bridge") + gdTask("bridge", "Plan it in the Early Retirement Bridge", {after:"<div style='margin-top:10px' class='hint'>Optional: it also compares 72(t) payments, which this plan doesn't use.</div>"});
    }},

  {id:"optimize", ch:5, title:"Plan Optimizer",
    body(){ return opGuideHTML(); }},

  {id:"results", ch:5, title:"Score and plan",
    body(){ return gdResultsHTML(); },
    foot(){
      return "<button type='button' class='btn' data-gd='prev'><i class='arw back' aria-hidden='true'></i>Back</button><span class='sp'></span>" +
        "<button type='button' class='btn' data-gd='restart'>Start over</button>" +
        "<button type='button' class='btn primary' data-go='about'>Review my answers</button>";
    }}
];
function gdYears(list){
  if (list.length <= 6) return list.join(", ").replace(/, (\d+)$/, " and $1");
  return list.slice(0, 5).join(", ") + " and " + (list.length - 5) + " other years";
}
function gdStep(id){ return GD_STEPS.find(s => s.id === id); }
function gdApplies(s){ return !s.when || s.when(gd.a); }
function gdRoute(){ return GD_STEPS.filter(gdApplies); }
function gdNumbered(){ return gdRoute().filter(s => s.id !== "intro"); }
function gdFirstOpen(){
  const L = gdNumbered();
  return (L.find(s => !gd.done[s.id]) || L[L.length - 1]).id;
}

/* ---------- adjusting the plan ----------
   The options gdOptions finds, as cards. Picking one draws it against the
   plan as it stands (chart and a before/after table); "Apply to my plan"
   writes it into the answers, and so into the household bar, the score and
   every step after. "Try your own numbers" is the same, with fields. */
let gdSel = null, gdDraft = null;
function gdOptTitle(o, S){
  const a = gd.a, v = o.set, ret = Math.round(S.retire), emp = a.employer || 0;
  switch (o.id){
    case "earlier": return {t:"Retire at " + v.retire, d:(ret - v.retire) + (ret - v.retire === 1 ? " year" : " years") + " sooner"};
    case "coast": return v.stopAge <= a.age
      ? {t:"Stop saving now", d:"What you have grows on its own to " + ret}
      : {t:"Stop saving at " + v.stopAge, d:"Then coast the last " + (ret - v.stopAge) + " years to " + ret};
    case "less": return {t:"Save " + money(v.contrib + emp) + "/mo", d:money(a.contrib - v.contrib) + "/mo back in your budget"};
    case "more": return {t:"Spend " + money(v.retSpend) + " a year", d:money(v.retSpend - a.retSpend) + " a year more in retirement"};
    case "keepsaving": return {t:"Keep saving until " + ret, d:"Instead of stopping at " + fmtNum(S.stop)};
    case "extra": return {t:"Save " + money(v.contrib - a.contrib) + "/mo more", d:money(v.contrib + emp) + "/mo in all"};
    case "later": return {t:"Retire at " + v.retire, d:(v.retire - ret) + (v.retire - ret === 1 ? " year" : " years") + " later"};
    case "less-spend": return {t:"Spend " + money(v.retSpend) + " a year", d:money(a.retSpend - v.retSpend) + " a year less in retirement"};
    case "balance": {
      const bits = [];
      if ("retire" in v) bits.push("retire at " + v.retire);
      if ("contrib" in v) bits.push(v.contrib > a.contrib ? "save " + money(v.contrib - a.contrib) + "/mo more" : v.contrib === 0 && !emp ? "stop saving" : "save " + money(a.contrib - v.contrib) + "/mo less");
      if ("retSpend" in v) bits.push(v.retSpend < a.retSpend ? "spend " + money(a.retSpend - v.retSpend) + " less" : "spend " + money(v.retSpend - a.retSpend) + " more");
      const t = bits.join(", ");
      return {t:t.charAt(0).toUpperCase() + t.slice(1), d:S.success >= gdTarget() - 1e-9 ? "A bit of each, as much as the plan can afford" : "A smaller change to each, found for you"};
    }
    case "custom": return {t:"Try your own numbers", d:"Any retirement age, saving, stop age and spending"};
  }
  return {t:"", d:""};
}
/* The draft behind "Try your own numbers": the plan as it stands, until
   changed. */
function gdDraftSet(){
  const a = gd.a, d = gdDraft || {};
  const set = {};
  if (gdOk(d.retire) && d.retire !== a.retire) set.retire = d.retire;
  if (gdOk(d.contrib) && d.contrib !== a.contrib) set.contrib = d.contrib;
  const stop = gdOk(d.stopAge) ? d.stopAge : null, was = gdOk(a.stopAge) ? a.stopAge : null;
  if (stop !== was) set.stopAge = stop;
  if (gdPos(d.retSpend) && d.retSpend !== a.retSpend) set.retSpend = d.retSpend;
  return set;
}
function gdDraftProblem(){
  const a = gd.a, d = gdDraft || {};
  if (gdOk(d.retire) && (d.retire <= a.age || d.retire > 90)) return "Pick a retirement age after your age today, up to 90.";
  const r = gdOk(d.retire) ? d.retire : a.retire;
  if (gdOk(d.stopAge) && (d.stopAge < a.age || d.stopAge >= r)) return "The age you stop saving has to be between now and retirement. Leave it blank to save until you retire.";
  return "";
}
function gdCurOpt(){
  const O = gdOptions();
  if (!O) return null;
  if (gdSel === "custom"){
    if (gdDraftProblem()) return {id:"custom", set:{}, T:null};
    const set = gdDraftSet();
    return {id:"custom", set, T:gdSim(gdOverFrom(set))};
  }
  return O.list.find(o => o.id === gdSel) || null;
}
/* Before and after, side by side, and what a change like this means
   beyond the numbers: early withdrawals, healthcare, Social Security. */
function gdCmpHTML(){
  const a = gd.a, O = gdOptions(), o = gdCurOpt();
  if (!O || !o) return "";
  const S = O.S, T = o.T;
  if (o.id === "custom" && gdDraftProblem()) return "<div class='gd-callout warn'>" + gdDraftProblem() + "</div>";
  if (!T) return "";
  if (o.id === "custom" && !Object.keys(o.set).length)
    return "<div class='gd-callout'>Change any of the numbers above to see it here.</div>" + gdChartSlot("tune", [gdSeries(S, "Your plan", "p")], "Your plan now, in today's dollars");
  const saveTxt = X => money(X.monthly) + "/mo" + (X.stop != null ? (X.stop <= a.age ? ", stopping now" : " until " + fmtNum(X.stop)) : "");
  const lastTo = X => {
    if (!X.H) return "—";
    const f = X.H.runs.filter(r => r.depleted);
    return f.length ? (X.success >= .995 ? "Always lasted" : "Ran short " + f.length + " of " + X.H.total + " times") : "Always lasted";
  };
  const rows = [
    ["Retire at", fmtNum(S.retire), fmtNum(T.retire)],
    ["You save", saveTxt(S), saveTxt(T)],
    ["Spending in retirement", money(S.spend) + "/yr", money(T.spend) + "/yr"],
    ["Social Security", money(S.ss.total / 12) + "/mo from " + S.ss.claim, money(T.ss.total / 12) + "/mo from " + T.ss.claim],
    ["Savings at retirement", money(S.fv), money(T.fv)],
    ["Lasted in", pctStr(S.success, 0) + " of retirements", pctStr(T.success, 0) + " of retirements"],
    ["Median left at the end", S.H ? money(S.H.medianEnd) : "—", T.H ? money(T.H.medianEnd) : "—"]
  ];
  let s = gdChartSlot("tune", [gdSeries(S, "Your plan now", "b"), gdSeries(T, "With this change", "p")], "Your plan now and with this change, in today's dollars");
  s += "<table class='gd-cmp-t'><thead><tr><th></th><th>Now</th><th>With this change</th></tr></thead><tbody>" +
    rows.map(r => "<tr><th scope='row'>" + r[0] + "</th><td>" + r[1] + "</td><td" + (r[1] !== r[2] ? " class='chg'" : "") + ">" + r[2] + "</td></tr>").join("") + "</tbody></table>";
  const notes = [];
  if (T.retire < 60 && T.retire < S.retire)
    notes.push("Retiring at " + fmtNum(T.retire) + " means living on savings before 59½, when most 401(k) and IRA withdrawals carry a 10% penalty. The rule of 55, Roth contributions, a taxable brokerage account or 72(t) payments can bridge those years; the Getting to 59½ step plans them.");
  if (T.retire < 65 && S.retire >= 65)
    notes.push("Before 65 you'll need health insurance until Medicare starts. A healthcare step joins your plan to price it.");
  if (!T.ss.own && T.ss.total < S.ss.total - 1)
    notes.push("Fewer working years also lower your Social Security estimate, from " + money(S.ss.total / 12) + " to " + money(T.ss.total / 12) + " a month. That's already counted above.");
  if (T.stop != null && (a.employer || 0) > 0)
    notes.push("Coasting here means no new money at all from " + (T.stop <= a.age ? "now" : fmtNum(T.stop)) + ", so your employer's " + money(a.employer) + "/mo stops too. If you keep working, it's worth still contributing enough to get any match.");
  if (T.stop != null)
    notes.push("Coasting leans on the " + pctStr(a.risk || .045, 1) + " a year your mix is assumed to earn. If markets lag, you can always start saving again.");
  if (o.id === "less" && (a.employer || 0) > 0)
    notes.push("Your employer's " + money(a.employer) + "/mo stays in. If it's a match, keep contributing at least enough to get all of it.");
  if (T.spend > S.spend && T.success < 1)
    notes.push("Spending more uses up your margin: in the worst historical starting years, this spending needed trimming to last.");
  if (notes.length) s += "<ul class='gd-notes'>" + notes.map(n => "<li>" + n + "</li>").join("") + "</ul>";
  s += "<div class='gd-apply'><button type='button' class='btn primary' data-gd='apply'>Apply to my plan</button>" +
    "<span class='hint'>Updates your answers, score and household bar. You can undo it.</span></div>";
  return s;
}
function gdOptCards(){
  const O = gdOptions(), a = gd.a;
  if (!O) return "";
  const card = (o, extra) => {
    const t = gdOptTitle(o, O.S), on = gdSel === o.id;
    const figs = o.T ? pctStr(o.T.success, 0) + " lasted · " + money(o.T.fv) + " at " + fmtNum(o.T.retire) : "";
    return "<button type='button' class='gd-opt" + (on ? " on" : "") + "' data-opt='" + o.id + "' aria-pressed='" + on + "'>" +
      "<b>" + t.t + "</b><span>" + t.d + "</span><em data-optfig='" + o.id + "'>" + figs + "</em>" + (extra || "") + "</button>";
  };
  const custom = gdCurOpt() && gdSel === "custom" ? gdCurOpt() : {id:"custom", set:{}, T:null};
  let s = "<div class='gd-opts'>" + O.list.map(o => card(o)).join("") + card(custom) + "</div>";
  if (gdSel === "balance"){
    s += "<div class='gd-target gd-levers'><span>Balance across</span>" + [["retire", "Retirement age"], ["save", "Monthly saving"], ["spend", "Retirement spending"]].map(x =>
      "<button type='button' class='gd-pick" + (gdLevers[x[0]] ? " on" : "") + "' data-lever='" + x[0] + "' aria-pressed='" + !!gdLevers[x[0]] + "'>" + x[1] + "</button>").join("") +
      "<span class='hint'>Pick at least two.</span></div>";
  }
  if (gdSel === "custom"){
    const d = gdDraft;
    const f = (k, label, affix, money_, hint) => "<div class='field'><label for='gdd-" + k + "'>" + label + "</label><div class='inputwrap'>" +
      (money_ ? "<span class='affix'>$</span>" : "") + "<input id='gdd-" + k + "' type='text' inputmode='decimal' " + (money_ ? "data-money " : "data-num data-step='1' ") +
      "data-nonneg data-d='" + k + "' value='" + (gdOk(d[k]) ? (money_ ? gdM(d[k]) : String(d[k])) : "") + "'" + (k === "stopAge" ? " placeholder='at retirement'" : "") + ">" +
      (affix ? "<span class='affix'>" + affix + "</span>" : "") + "</div>" + (hint ? "<div class='hint'>" + hint + "</div>" : "") + "</div>";
    s += "<div class='gd-fields gd-draft'>" + f("retire", "Retire at", "age") + f("contrib", "You contribute", "/mo", true, (a.employer ? "Plus your employer's " + money(a.employer) + "/mo." : "")) +
      f("stopAge", "Stop contributing at", "age", false, "Blank means until you retire.") + f("retSpend", "Spending in retirement", "/yr", true) +
      "<p class='hint full' style='margin:0 0 10px'>Contributions rise with inflation each year, so they stay the same in today's dollars.</p></div>";
  }
  return s;
}
function gdTuneHTML(){
  const a = gd.a, O = gdOptions();
  let s = "";
  if (!O) return "<h2 class='gd-q' tabindex='-1'>Adjust your plan</h2><div class='gd-callout warn'>This needs your age, savings and retirement spending first.</div>" +
    "<button type='button' class='btn' data-go='savings'>Go to Retirement savings</button>";
  const S = O.S, goal = O.goal, want = gdNeed(S);
  if (gdSel && gdSel !== "custom" && !O.list.some(o => o.id === gdSel)) gdSel = null;
  if (!gdSel) gdSel = O.list.length ? O.list[0].id : "custom";
  if (gdSel === "custom" && !gdDraft) gdDraft = {retire:a.retire, contrib:a.contrib, stopAge:gdOk(a.stopAge) ? a.stopAge : null, retSpend:a.retSpend};
  const big = O.ahead && want > 0 && S.fv >= want * 1.2;
  s += "<h2 class='gd-q' tabindex='-1'>" + (!O.ahead ? "Close the gap" : big ? "You're ahead. Put it to work?" : "Fine-tune your plan") + "</h2>";
  s += "<p class='gd-lead'>Your plan now: retire at <b>" + fmtNum(S.retire) + "</b>, " +
    (S.stop != null && S.stop <= a.age ? "<b>coast</b> with no new saving" : "save <b>" + money(S.monthly) + "/mo</b>" + (S.stop != null ? " until " + fmtNum(S.stop) : "")) +
    ", then spend <b>" + money(S.spend) + " a year</b>. " +
    "It reaches " + money(S.fv) + " and lasted in " + pctStr(S.success, 0) + " of historical retirements" +
    (want > 0 ? "; lasting in " + (goal >= 1 ? "every one" : pctStr(goal, 0)) + " takes about " + money(want) : "") + ". " +
    (!O.ahead ? "Each option below closes the gap on its own." : big ? "That's more than it needs, and there's more than one way to use the extra." : "It's close to its target, so the options are small.") + "</p>";
  s += gdBack("tune");
  s += "<div class='gd-target'><span>Aim for plans that lasted in</span>" + [[.9, "90%"], [.95, "95%"], [1, "every one"]].map(x =>
    "<button type='button' class='gd-pick" + (goal === x[0] ? " on" : "") + "' data-target='" + x[0] + "' aria-pressed='" + (goal === x[0]) + "'>" + x[1] + "</button>").join("") +
    "<span class='hint'>of historical retirements</span></div>";
  if (!O.list.length) s += "<div class='gd-callout'>" + (O.ahead ? "Your plan sits right at its target, so there's no spare room to spend without adding risk. Try your own numbers to explore." :
    "None of the single changes reach the target within reason. Try your own numbers, or work on the rest of your plan first.") + "</div>";
  s += "<div class='gd-optwrap'>" + gdOptCards() + "</div>";
  s += "<div class='gd-cmp' id='gdCmp'>" + gdCmpHTML() + "</div>";
  s += "<p class='hint' style='margin-top:14px'>Prefer the classic FIRE math, with a 4% rule instead of market history? <button type='button' class='gd-link' data-trip='fire' data-from='tune'>Open the FIRE Calculator</button></p>";
  return s;
}
function gdApplyOpt(){
  const o = gdCurOpt(), a = gd.a;
  if (!o || !o.T || !Object.keys(o.set).length) return;
  const undo = {}, ch = [];
  Object.keys(o.set).forEach(k => { undo[k] = a[k] == null ? null : a[k]; });
  const v = o.set;
  if ("retire" in v){ ch.push("retire at <b>" + fmtNum(v.retire) + "</b>"); a.retire = v.retire; }
  if ("contrib" in v){ ch.push("save <b>" + money(v.contrib + (a.employer || 0)) + "/mo</b>"); a.contrib = v.contrib; }
  if ("stopAge" in v){
    ch.push(v.stopAge == null ? "save until you retire" : v.stopAge <= a.age ? "<b>stop saving now</b>" : "<b>stop saving at " + fmtNum(v.stopAge) + "</b>");
    a.stopAge = v.stopAge;
  }
  if ("retSpend" in v){ ch.push("spend <b>" + money(v.retSpend) + " a year</b>"); a.retSpend = v.retSpend; }
  if (gdOk(a.stopAge) && a.stopAge >= a.retire){ undo.stopAge = undo.stopAge === undefined ? a.stopAge : undo.stopAge; a.stopAge = null; }
  gdHouseholdSync();
  const see = gdOk(a.stopAge) ? "<button type='button' class='btn mini' data-trip='stages' data-from='tune'>See it in Stages<i class='arw' aria-hidden='true'></i></button>"
    : "<button type='button' class='btn mini' data-trip='basic' data-from='tune'>See it in Basic<i class='arw' aria-hidden='true'></i></button>";
  gd.back = {step:"tune", undo, msg:"Applied. Your plan now has you " + ch.join(", ").replace(/, ([^,]*)$/, " and $1") +
    ". Your projection, success rate, score and household bar all use it now, and it lasted in <b>" + pctStr(o.T.success, 0) + "</b> of historical retirements.<br>" + see};
  gdSel = null; gdDraft = null;
  gdSave();
  gdRender(false);
  const c = $("gdCard").querySelector(".gd-callout.ok");
  if (c) try { c.scrollIntoView({block:"nearest"}); } catch(e){}
}

/* ---------- drawing it down ----------
   Every withdrawal strategy the Drawdown Simulator offers, run on the
   plan's own numbers through the same history, so the choice is made on
   what each would have meant for this person. */
const GD_STRATS = [
  {id:"fixed", name:"Fixed, rising with inflation", d:"The same spending every year, raised with prices. Steady and simple, but it never reacts to markets, so a bad start can drain it."},
  {id:"guardrails", name:"Guardrails (Guyton-Klinger)", d:"Steady spending that follows inflation, with a 10% cut when your withdrawal rate climbs 20% past where it started, and a 10% raise when it falls 20% below."},
  {id:"floorceil", name:"Floor and ceiling", d:"Aims at a set share of the portfolio each year, but never moves spending more than 10% up or down from last year."},
  {id:"yale", name:"Yale endowment rule", d:"70% of last year's spending, plus 30% of your starting rate applied to today's balance. Smooths the swings while still following the market."},
  {id:"pct", name:"Fixed percentage", d:"The same share of whatever the portfolio is worth each year. It can't run out, but spending rises and falls with every market move."},
  {id:"vpw", name:"Variable percentage (VPW)", d:"Spends down on purpose: each year's share rises as the years left shrink, like an annuity. Starts higher, varies the most, and ends near zero."}
];
function gdStratName(id){ const x = GD_STRATS.find(q => q.id === id); return x ? x.name : "Fixed, rising with inflation"; }
/* Each approach run on the plan's own numbers through the same history, by
   the plan engine: what was actually lived on each year (the approach's
   spending, unless the money ran out and only Social Security and any
   pension were left), after tax, in today's dollars. */
function gdStrats(S){
  const fl = gdMinSpend();
  if (S.strats && S.stratsFloor === fl) return S.strats;
  S.stratsFloor = fl;
  const med = arr => { const x = arr.slice().sort((p, q) => p - q); return x.length ? x[Math.floor(x.length / 2)] : 0; };
  S.strats = GD_STRATS.map(st => {
    if (!S.H) return {st, H:null};
    const C = plPrep(Object.assign({}, S.P, {strategy:st.id, minSpend:fl, guardBand:20, adjustPct:10,
      floorPct:10, ceilPct:10, yaleWeight:70, vpwRate:(S.mix * 5 + (100 - S.mix) * 1.9) / 100, vpwFV:0}));
    const H = st.id === "fixed" && !fl ? S.H : plHistory(C, S.T, {paths:true});
    let lean = Infinity, leanYear = null, leanAge = null;
    const typ = [];
    H.runs.forEach(run => {
      const sp = Array.prototype.slice.call(run.livedPath || []);
      typ.push(med(sp));
      // Ties (every run that ran dry falls to the same Social Security) name
      // the youngest age it happened, the one that matters.
      sp.forEach((v, i) => {
        const age = Math.round(S.retire) + i;
        if (v < lean - 1 || (Math.abs(v - lean) <= 1 && age < leanAge)){ lean = Math.min(lean, v); leanYear = run.startYear; leanAge = age; }
      });
    });
    // A minimum makes every flexible approach able to run dry: holding
    // spending up in a bad market is exactly what drains it.
    return {st, H, success:H.successRate, typical:med(typ), lean, leanYear, leanAge, end:H.medianEnd,
      canFail: fl > 0 || (st.id !== "pct" && st.id !== "vpw")};
  });
  return S.strats;
}
function gdStratTableHTML(){
  const a = gd.a, S = gdSim();
  if (!S || !S.H) return "";
  const R = gdStrats(S), cur = a.strategy || "fixed", fl = gdMinSpend();
  return "<div class='gd-strat'><div class='gd-strat-h' aria-hidden='true'><span>Approach</span><span>Lasted</span><span>Typical year</span><span>Leanest year</span></div>" +
    R.map(r => "<div class='gd-strat-r" + (r.st.id === cur ? " on" : "") + "'><div class='nm'><b>" + r.st.name + "</b><span>" + r.st.d + "</span></div>" +
      "<div class='c'><i>Lasted</i>" + (r.canFail ? pctStr(r.success, 0) : "Can't run out") + "</div>" +
      "<div class='c'><i>Typical year</i>" + money(r.typical) + "</div>" +
      "<div class='c'><i>Leanest year</i>" + money(r.lean) + (r.lean >= S.spend * .995 ? "<small>never below your plan</small>" : r.leanYear ? "<small>retiring in " + r.leanYear + ", at " + r.leanAge + "</small>" : "") + "</div></div>").join("") + "</div>" +
    "<p class='hint' style='margin:-6px 0 14px'>Spending after tax, in today's dollars, counting Social Security" + (S.pension ? " and your pension" : "") + ". The leanest year is the worst single year across all of history; when the money ran out, it's what Social Security" + (S.pension ? " and the pension" : "") + " paid alone." +
    (fl ? " Flexible approaches never go below your " + money(fl) + " minimum while money remains, so each can now run out; <b>Lasted</b> counts how often it held." : "") + "</p>";
}
function gdStratPickHTML(){
  const a = gd.a, S = gdSim();
  if (!S || !S.H || !a.strategy) return "";
  const R = gdStrats(S), cur = a.strategy, r = R.find(q => q.st.id === cur), fl = gdMinSpend();
  if (!r) return "";
  const cut = r.lean < S.spend - 1 ? Math.round((1 - r.lean / S.spend) * 100) : 0;
  let t = "";
  if (cur === "fixed") t = r.success >= .995 ? "You'd never cut back, and it lasted in every retirement on record. Simple, and it held up."
    : "You'd never cut back, but retiring in " + gdYears(r.H.failYears) + " the money ran out, leaving " + money(r.lean) + " a year from Social Security" + (S.pension ? " and your pension" : "") + ". Being willing to trim in a bad stretch is what the other approaches add.";
  else t = "In a typical retirement you'd have spent about " + money(r.typical) + " a year. " +
    (cut ? "The hardest case was retiring in " + r.leanYear + ": at " + r.leanAge + " spending would have been " + money(r.lean) + ", " + cut + "% under your plan." : "Spending never had to drop below your plan.") +
    (r.canFail ? " It lasted in " + pctStr(r.success, 0) + " of retirements, against " + pctStr(S.success, 0) + " spending a fixed amount." : " It can't run out, because spending follows the balance down.") +
    (fl ? (r.success < gdTarget() - 1e-9 ? " Your " + money(fl) + " minimum is what costs it here: holding spending up through a bad market drains the portfolio, so a lower minimum, or a bigger cushion, buys safety."
      : " Your " + money(fl) + " minimum held in " + pctStr(r.success, 0) + " of retirements, enough for your target.")
      : " Ask yourself whether you could live on the lean year; if not, set a minimum above and see what it costs.");
  return "<div class='gd-callout " + (r.success < .9 && r.canFail ? "warn" : "ok") + "'>" + t + "</div>";
}
function gdStratHTML(){
  const a = gd.a, S = gdSim();
  let s = "<h2 class='gd-q' tabindex='-1'>How will you spend it down?</h2>";
  if (!S || !S.H) return s + "<div class='gd-callout warn'>This needs a projection first: your age, savings and retirement spending.</div>" +
    "<button type='button' class='btn' data-go='savings'>Go to Retirement savings</button>";
  s += "<p class='gd-lead'>So far your plan spends the same amount every year, raised with inflation, whatever markets do. It's the simplest approach and the most cautious test. " +
    "Most retirees flex a little instead. Here's how six common approaches would have handled your plan (" + money(S.fv) + " at " + fmtNum(S.retire) + ", aiming to spend " + money(S.spend) +
    " a year) in every retirement since " + S.H.first + ".</p>" + gdBack("strategy");
  // The floor under the flexible approaches, before the comparison it changes.
  const base = S.ss.total + S.pension, picks = [];
  if (base > 0 && base < S.spend) picks.push(["Social Security" + (S.pension ? " and pension" : "") + " alone", base]);
  picks.push(["80% of your plan", S.spend * .8]);
  if (gdPos(a.spend)) picks.push(["Today's spending, less 20%", a.spend * 12 * .8]);
  s += "<div class='gd-h3'>What's the least you could live on?</div>" +
    "<p class='hint' style='margin:-4px 0 10px;max-width:64ch'>Flexible approaches cut spending in bad markets, and some cut deep. A minimum stops them going lower: housing, food, insurance, utilities and the other essentials, in today's dollars. Leave it blank for no minimum.</p>" +
    "<div class='gd-picks'>" + picks.filter(p => p[1] < S.spend).map(p => "<button type='button' class='gd-pick' data-fill='minSpend' data-v='" + Math.round(p[1] / 500) * 500 + "'>" +
      p[0] + ": <b>" + money(Math.round(p[1] / 500) * 500) + "/yr</b></button>").join("") + "</div>" +
    "<div class='gd-fields'>" + gdMoneyF("minSpend", "Minimum yearly spending", {per:"/yr", ph:"no minimum", full:true}) + "</div>" + gdLive("minNote");
  s += gdLive("stratTable");
  s += "<div class='gd-h3'>Which would you follow?</div><div class='gd-choices two'>" +
    GD_STRATS.map(x => gdChoice("strategy", x.id, x.name)).join("") + "</div>" + gdLive("stratPick");
  s += "<div class='gd-callout'>Your score keeps testing the fixed approach, the cautious case. A flexible approach only adds safety if you'd really cut back when it says to.</div>";
  s += gdTask("drawdown", "Walk through the Drawdown Simulator", {label:"Start the tour", after:"<div style='margin-top:10px' class='hint'>Optional. Seven short parts: your result, a bad start, strategies, your mix, Social Security timing, life events and stress tests. Anything you change there can come back into your plan.</div>"});
  return s;
}

/* ---------- the plan ---------- */
function gdActions(){
  const a = gd.a, P = gdParts(), S = gdSim(), A = [];
  const inc = gdGross();
  if (P.flow && a.takehome < a.spend)
    A.push({t:"Spend less than you bring home",
      d:"You're spending " + money(a.spend - a.takehome) + "/mo more than your take-home. Go through your budget line by line and trim the biggest items until it's back in the black.", trip:"budget", btn:"Open Budget"});
  if (P.cushion && P.cushion.m < 1)
    A.push({t:"Build a starter emergency fund",
      d:"Get one month of spending, " + money(a.spend) + ", into a savings account before anything else, so a surprise bill doesn't land on a credit card."});
  if (a.match === "partial")
    A.push({t:"Get your full employer match",
      d:"Raise your 401(k) contribution until every matched dollar comes in. A match is an instant 50% to 100% return you won't find anywhere else."});
  if (a.match === "unsure")
    A.push({t:"Find out whether your employer matches",
      d:"Check your benefits site or ask HR. If there's a match, contribute at least enough to get all of it."});
  if (a.debtHas === "yes" && (a.debtHi || 0) > 0)
    A.push({t:"Pay off your high-interest debt",
      d:money(a.debtHi) + " at 8% or more costs more than investing is likely to earn. Put every spare dollar at it, highest rate first." +
        (a.debtMonths ? " Your current plan has you debt-free by " + debtDate(a.debtMonths) + "." : ""), trip:"debt", btn:"Open Debt Payoff"});
  if (P.cushion && P.cushion.m >= 1 && P.cushion.m < 3)
    A.push({t:"Grow your emergency fund to 3 months or more",
      d:"You have " + gdMonths(P.cushion.m) + " months. The target is " + money(a.spend * 3) + " to " + money(a.spend * 6) + ". Automate a transfer each payday until you're there."});
  const goal = gdTarget(), ahead = S && S.success >= goal - 1e-9;
  if (P.rate && P.rate.r < .15 && inc > 0 && !ahead)
    A.push({t:"Raise your savings rate toward 15%",
      d:"You save " + pctStr(P.rate.r, 1) + " of your income. Reaching 15% means about " + money(Math.max(0, inc * .15 / 12 - gdSaveMo())) + "/mo more. Raising it 1% each year, or at every raise, gets you there without feeling it.",
      trip:"basic", btn:"Try it in Basic"});
  if (S && !ahead){
    const F = gdFixes() || {};
    const opts = [];
    if (F.extra) opts.push("save <b>" + money(F.extra) + "/mo more</b>");
    if (F.retire) opts.push("retire at <b>" + F.retire + "</b>");
    if (F.spend) opts.push("plan on <b>" + money(F.spend) + " a year</b> in retirement");
    A.push({t:"Close your retirement gap",
      d:"Your plan lasted in " + pctStr(S.success, 0) + " of historical retirements. " +
        (opts.length ? "Any one of these gets it to " + pctStr(goal, 0) + ": " + opts.join(", or ").replace(/, or ([^,]*)$/, ", or $1") + ". A mix of smaller changes works too." : "Saving more, retiring later and spending less all help."),
      go:"tune", btn:"See the options and apply one"});
  } else if (S){
    // Ahead of target: say what the surplus could buy, not just "you're fine".
    const O = gdOptions(), pick = id => O && O.list.find(o => o.id === id);
    const bits = [];
    const e = pick("earlier"), c = pick("coast"), m = pick("more");
    if (e) bits.push("retire at <b>" + e.set.retire + "</b>");
    if (c) bits.push(c.set.stopAge <= a.age ? "<b>stop saving now</b>" : "stop saving at <b>" + c.set.stopAge + "</b>");
    if (m) bits.push("spend <b>" + money(m.set.retSpend) + " a year</b>");
    const want = gdNeed(S);
    if (bits.length && want > 0 && S.fv >= want * 1.2)
      A.push({t:"Decide what to do with your surplus",
        d:"You're on course for " + money(S.fv) + " against the " + money(want) + " your plan needs. You could " + bits.join(", or ").replace(/, or ([^,]*)$/, ", or $1") +
          " and still last in " + (goal >= 1 ? "every" : pctStr(goal, 0) + " of") + " historical retirements. Or keep the margin: that's a fine choice too.",
        go:"tune", btn:"Compare and apply"});
  }
  if (gdOk(a.retire) && a.retire < 59.5 && !a.bridge)
    A.push({t:"Plan how you'll reach your money before 59½",
      d:"Retiring at " + fmtNum(a.retire) + " leaves " + Math.ceil(59.5 - a.retire) + " years before 401(k) and IRA withdrawals are penalty-free. The Early Retirement Bridge compares " + (a.retire >= 55 ? "the rule of 55, 72(t) payments" : "a Roth ladder, 72(t) payments") + " and living off a brokerage account, and shows what you'd have left at 59½.",
      trip:"bridge", btn:"Open Early Retirement Bridge"});
  else if (gdOk(a.retire) && a.retire < 59.5 && gdOk(a.bridgeHold) && a.bridgeHold < 80)
    A.push({t:"Shore up the bridge to 59½",
      d:"Your best plan in the Early Retirement Bridge held up in only " + a.bridgeHold + "% of markets. More savings in a Roth or taxable account, a later retirement or lower spending in the early years would widen the margin.",
      trip:"bridge", btn:"Revisit the bridge"});
  if (S && !gdTactics())
    A.push({t:"Let the Plan Optimizer tune your withdrawals",
      d:"It tries every age from 62 to 70 for " + (gdMar() ? "each of you to claim" : "claiming") + " Social Security, every order for drawing down your accounts and every Roth conversion level, through every market since 1926, and keeps the plan that does best. " +
        "Your plan now pays about " + money(S.lifeTax) + " in tax over retirement.", go:"optimize", btn:"Open the Plan Optimizer"});
  if (gdOk(a.retire) && a.retire < 65 && !a.hcSeen && S && S.hcYr > 0)
    A.push({t:"Get to know your health insurance costs before Medicare",
      d:"Your plan prices marketplace coverage at about " + money(S.hcYr) + " a year until 65, after the subsidy its income earns. The Healthcare Cost Planner shows how that subsidy moves with income, and what Medicare costs after.", trip:"healthcare", btn:"Open Healthcare Cost Planner"});
  if (a.college === "yes" && !gdPos(a.collegeMo))
    A.push({t:"Set a monthly college number", d:"Find out what to put aside each month, and consider a 529 plan for the tax break.", trip:"college", btn:"Open College Savings"});
  if (!gdPos(a.ssOwn) && S)
    A.push({t:"Check your Social Security estimate",
      d:"We estimated it from today's income. Your statement at ssa.gov/myaccount uses your real earnings record and takes five minutes to get.", go:"retspend", btn:"Add it to your answers"});
  if (S && S.success >= .85 && !a.ddTool)
    A.push({t:"Stress-test how you'll spend it", d:"The Drawdown Simulator tour replays your plan through 1929, 1966 and 2000, and walks through each withdrawal strategy, your stock mix, when to claim Social Security, and big one-time costs.", trip:"drawdown", btn:"Start the tour"});
  return A.slice(0, 6);
}
function gdResultsHTML(){
  const a = gd.a, R = gdScore(), rt = gdRating(R.score), S = gdSim();
  let s = "<h2 class='gd-q' tabindex='-1'>Your retirement readiness</h2>";
  s += gdBack("results");
  if (R.score == null) return s + "<div class='gd-callout warn'>There isn't enough to score yet. Answer the questions before this one and your score will appear here.</div>" +
    "<button type='button' class='btn primary' data-go='" + gdFirstOpen() + "'>Go to the next open question</button>";
  const summary = R.score >= 85 ? "You're doing the big things right. Keep it going, and use the list below to fine-tune."
    : R.score >= 70 ? "You're close. A couple of changes below would put you firmly on track."
    : R.score >= 50 ? "You've got a foundation to build on. Work down the list below, in order."
    : "There's real work to do, and the list below puts it in the order that matters most. Every item moves the score.";
  s += "<div class='gd-hero'>" + gdRing(R.score, 132) + "<div class='gd-hero-t'><div class='r' style='color:" + rt.color + "'>" + rt.label + "</div>" +
    "<p>" + summary + "</p>" + (R.n < GD_FACTORS.length ? "<p class='hint' style='margin-top:6px'>Based on " + R.n + " of " + GD_FACTORS.length + " areas. Answer the rest to complete it.</p>" : "") + "</div></div>";
  const A = gdActions();
  if (A.length){
    s += "<div class='gd-h3'>Your next moves, in order</div><ol class='gd-acts'>" + A.map(x => "<li class='gd-act'><div><b>" + x.t + "</b><p>" + x.d + "</p>" +
      (x.trip ? "<button type='button' class='btn mini' data-trip='" + x.trip + "' data-from='results'>" + x.btn + "<i class='arw' aria-hidden='true'></i></button>" : "") +
      (x.go ? "<button type='button' class='btn mini' data-go='" + x.go + "'>" + x.btn + "</button>" : "") + "</div></li>").join("") + "</ol>";
  }
  if (S){
    const pv = [];
    const prow = (k, v) => pv.push("<div class='kv'><span class='k'>" + k + "</span><span class='v'>" + v + "</span></div>");
    prow("Retire at", fmtNum(S.retire));
    prow("Saving", S.stop != null ? (S.stop <= a.age ? "Coasting: no new savings" : money(S.monthly) + "/mo until " + fmtNum(S.stop) + ", then coasting") : money(S.monthly) + "/mo until you retire");
    prow("Spending in retirement", money(S.spend) + " a year");
    prow("Social Security", gdMar() && S.ss.a2 > 0 ? money(S.ss.a1 / 12) + "/mo from " + S.ss.claim + ", spouse " + money(S.ss.a2 / 12) + "/mo from " + S.ss.claim2
      : money(S.ss.total / 12) + "/mo from " + S.ss.claim);
    if (S.pension) prow("Pension", money(S.pension / 12) + "/mo");
    prow("Withdrawals", S.tactics ? opTacticsLine(S.T, S.C) : "Brokerage, then traditional, then Roth");
    prow("Income tax", "About " + money(S.taxYr) + " a year, " + money(S.lifeTax) + " in all");
    prow("Withdrawal approach", gdStratName(a.strategy || "fixed"));
    if (gdMinSpend()) prow("Minimum spending", money(gdMinSpend()) + " a year");
    prow("Lasted, spending a fixed amount", pctStr(S.success, 0) + " of historical retirements");
    s += "<div class='gd-h3'>Your plan</div><div class='gd-kvs'>" + pv.join("") + "</div>" +
      "<button type='button' class='btn mini' data-go='tune' style='margin:-2px 8px 16px 0'>Adjust your plan</button>" +
      "<button type='button' class='btn mini' data-go='optimize' style='margin:-2px 0 16px'>" + (S.tactics ? "Your roadmap" : "Plan Optimizer") + "</button>";
  }
  const wins = GD_FACTORS.filter(f => R.P[f.id] && R.P[f.id].p >= .9).map(f => f.name + ": " + R.P[f.id].txt);
  if (wins.length) s += "<div class='gd-h3'>What's going well</div><div class='gd-wins'>" + wins.map(w => "<span>" + w + "</span>").join("") + "</div>";
  const kv = [];
  const row = (k, v) => kv.push("<div class='kv'><span class='k'>" + k + "</span><span class='v'>" + v + "</span></div>");
  if (gdPos(a.takehome)) row("Take-home pay", money(a.takehome) + "/mo");
  if (gdPos(a.spend)) row("Spending", money(a.spend) + "/mo");
  if (gdOk(a.cash)) row("Emergency fund", money(a.cash));
  if (a.debtHas === "yes" && gdOk(a.debtTotal)) row("Debt, not counting a mortgage", money(a.debtTotal));
  if (gdOk(a.saved)) row("Retirement savings", money(a.saved));
  if (gdOk(a.contrib)) row("Saving for retirement", gdCoastNow() ? "Nothing new: coasting" : money(gdSaveMo()) + "/mo");
  if (S){ row("Projected at " + fmtNum(S.retire), money(S.fv)); const w = gdNeed(S); if (w > 0) row("Needed at " + fmtNum(S.retire), money(w)); }
  if (a.fiAge) row(escapeHtml(a.fiLabel || "FIRE age"), escapeHtml(a.fiAge));
  if (kv.length) s += "<div class='gd-h3'>Your numbers</div><div class='gd-kvs'>" + kv.join("") + "</div>";
  s += "<div class='gd-share'><button type='button' class='btn' data-gd='print'>Print or save as PDF</button>" +
    "<button type='button' class='btn' data-gd='share'>Copy a link to this plan</button>" +
    "<span class='hint'>The link carries your answers, so share it only with people you'd show your finances to.</span></div>";
  s += "<div class='gd-h3'>Ready for more detail?</div>" +
    "<p class='hint' style='margin:-4px 0 10px'>Advanced, Stages and Portfolio Backtest open with your numbers and the guide panel beside them, walking you through what's there.</p><div class='gd-more'>" +
    "<button type='button' class='btn mini' data-trip='advanced' data-from='results'>Advanced: taxes and account types<i class='arw' aria-hidden='true'></i></button>" +
    "<button type='button' class='btn mini' data-trip='stages' data-from='results'>Stages: plans that change over time<i class='arw' aria-hidden='true'></i></button>" +
    "<button type='button' class='btn mini' data-trip='backtest' data-from='results'>Portfolio Backtest: what your mix has earned<i class='arw' aria-hidden='true'></i></button></div>" +
    "<p class='hint'>Retirement spending here is what you live on after tax. Each year's federal and state income tax, Medicare's income surcharge and health insurance before 65 are worked out from where the money comes from, and paid on top. " +
    "This score is a rule-of-thumb check, not financial advice, and it leaves out home equity.</p>";
  return s;
}

/* ---------- drawing the guide ---------- */
function gdCur(){
  let st = gdStep(gd.cur);
  if (!st){ gd.cur = "intro"; st = GD_STEPS[0]; }
  if (!gdApplies(st)){
    const i = GD_STEPS.indexOf(st);
    st = GD_STEPS.slice(i).find(gdApplies) || GD_STEPS[GD_STEPS.length - 1];
    gd.cur = st.id;
  }
  return st;
}
function gdRender(focus){
  gdSimCacheTrim();
  const st = gdCur(), L = gdNumbered(), idx = L.indexOf(st);
  const ch = st.ch >= 0 ? GD_CH[st.ch] : "Start";
  $("gdCount").textContent = idx >= 0 ? "Step " + (idx + 1) + " of " + L.length : "";
  let foot = st.foot ? st.foot() : null;
  if (!foot){
    const ok = !st.ok || st.ok(gd.a);
    foot = "<button type='button' class='btn' data-gd='prev'><i class='arw back' aria-hidden='true'></i>Back</button><span class='sp'></span>" +
      "<span class='gd-why' data-why" + (ok ? " hidden" : "") + ">" + (st.why ? st.why(gd.a) : "") + "</span>" +
      "<button type='button' class='btn primary' data-gd='next'" + (ok ? "" : " disabled") + ">" + (idx === L.length - 2 ? "See my score" : "Continue") + "<i class='arw' aria-hidden='true'></i></button>";
  }
  $("gdCard").innerHTML = "<div class='gd-eyebrow'><span>" + ch + "</span>" + (idx >= 0 && st.title !== ch ? "<span>" + st.title + "</span>" : "") + "</div>" +
    st.body() + "<div class='gd-foot'>" + foot + "</div>";
  initFields($("gdCard"));
  gdChartsDraw($("gdCard"));
  opDrawAll($("gdCard"));
  gdRenderSide();
  if (focus){
    const h = $("gdCard").querySelector(".gd-q");
    try { (h || $("gdCard")).focus({preventScroll:true}); } catch(e){}
    // Stay put unless the new question's top is scrolled out of view above
    // the tab rail; then bring just the card's top back, not the whole page.
    const top = $("gdCard").getBoundingClientRect().top;
    const css = getComputedStyle(document.documentElement);
    const rail = (parseFloat(css.getPropertyValue("--navh")) || 44) + (parseFloat(css.getPropertyValue("--gd-stick")) || 0) + 12;
    if (top < rail){
      try { window.scrollBy({top: top - rail, behavior:"auto"}); } catch(e){ window.scrollBy(0, top - rail); }
    }
  }
}
function gdSimCacheTrim(){
  const k = Object.keys(gdSimCache);
  if (k.length > 400) k.forEach(x => delete gdSimCache[x]);
}
function gdRenderSide(){
  const R = gdScore(), rt = gdRating(R.score);
  $("gdScore").innerHTML = "<div class='gd-score-top'>" + gdRing(R.score) + "<div class='gd-score-t'><div class='r' style='color:" + rt.color + "'>" + rt.label + "</div>" +
    "<div class='n'>" + (R.score == null ? (R.n ? "Your score appears once two areas are answered." : "Your score appears as you answer.") : R.n < GD_FACTORS.length ? "From " + R.n + " of " + GD_FACTORS.length + " areas so far" : "All five areas answered") + "</div></div></div>" +
    "<div class='gd-facs'>" + GD_FACTORS.map(f => {
      const p = R.P[f.id];
      return "<button type='button' class='gd-fac" + (p ? "" : " na") + "' data-go='" + f.step + "'><div class='top'><span>" + f.name + "</span><em>" +
        (p ? Math.round(p.p * f.w) + " / " + f.w : "—") + "</em></div>" +
        "<div class='bar'><i style='width:" + (p ? p.p * 100 : 0).toFixed(0) + "%;background:" + (p ? gdBarColor(p.p) : "transparent") + "'></i></div>" +
        "<div class='sub'>" + (p ? p.txt : "Not answered yet") + "</div></button>";
    }).join("") + "</div>";
  $("gdMini").innerHTML = R.score == null ? "" : "Score <b style='color:" + rt.color + "'>" + R.score + "</b>";
  const cur = gdCur();
  let map = "";
  GD_CH.forEach((c, ci) => {
    const st = GD_STEPS.filter(s => s.ch === ci);
    map += "<div class='gd-map-ch'>" + c + "</div>" + st.map(s => {
      const na = !gdApplies(s);
      const cls = na ? "na" : s.id === cur.id ? "cur" : gd.done[s.id] ? "done" : "";
      return "<button type='button' class='gd-map-st " + cls + "'" + (na ? " disabled" : " data-go='" + s.id + "'") + "><i aria-hidden='true'></i>" + s.title +
        (na ? "<span class='tag'>not needed</span>" : "") + "</button>";
    }).join("");
  });
  map += "<div class='gd-map-foot'><button type='button' class='gd-link' data-gd='restart'>Start over</button></div>";
  $("gdMap").innerHTML = map;
  const L = gdRoute();
  const hit = cur.id === "results" || L.every(s => s.id === "results" || s.id === "intro" || gd.done[s.id]);
  /* Bars are redrawn at their old widths, then grown to the new ones in
     step with the arrow, so the fill never runs out ahead of it. */
  const was = [...$("gdProg").querySelectorAll(".gd-seg i b")].map(b => b.style.width), fill = [];
  $("gdProg").innerHTML = GD_CH.map((c, ci) => {
    const st = L.filter(s => s.ch === ci);
    const d = st.filter(s => gd.done[s.id]).length;
    const on = cur.ch === ci;
    // Once the arrow is in the target, the last bar runs up to its tail.
    fill.push(hit && ci === GD_CH.length - 1 ? "calc(100% - 28px)" : (st.length ? d / st.length * 100 : 0).toFixed(0) + "%");
    return "<button type='button' class='gd-seg" + (on ? " on" : "") + "' data-go='" + (st[0] ? st[0].id : "intro") + "' aria-label='" + c + ": " + d + " of " + st.length + " done'>" +
      "<i><b style='width:" + (was[ci] || fill[ci]) + "'></b></i><span>" + c + "</span></button>";
  }).join("");
  if (was.length){
    void $("gdProg").offsetWidth;
    $("gdProg").querySelectorAll(".gd-seg i b").forEach((b, ci) => { b.style.width = fill[ci]; });
  }
  /* The arrow flies just ahead of the fill: its tail sits on the far edge of
     the last chapter with anything done, where each bar is (track - 5 gaps)
     / 6 wide, and its 46px length runs on from there. Before any answer it
     sits nocked on the drawn string, --nock from the left. */
  let far = 0;
  GD_CH.forEach((c, ci) => {
    const st = L.filter(s => s.ch === ci), d = st.filter(s => gd.done[s.id]).length;
    if (d) far = { ci: ci, f: d / st.length };
  });
  const pos = hit ? 7 : far ? far.ci + far.f : 0, tr = $("gdTrack"), ar = $("gdArrow");
  const prev = tr.dataset.pos == null ? null : +tr.dataset.pos;
  tr.dataset.pos = pos;
  ar.style.left = hit ? "calc(100% + 18px)"
    : far ? "calc((100% - 30px) * " + (pos / 6).toFixed(4) + " + " + (far.ci * 6 + 46) + "px)" : "var(--nock)";
  tr.classList.toggle("nocked", !far && !hit);
  tr.classList.toggle("hit", hit);
  // Motion only for moves made on this page, not for the state it loads in.
  if (prev != null && pos > prev){
    const again = (el, c) => { el.classList.remove(c); void el.offsetWidth; el.classList.add(c); };
    again(ar, "fly");
    if (prev === 0) again(tr, "loose");
    if (hit) again(tr, "fresh");
    clearTimeout(gdRenderSide.t);
    gdRenderSide.t = setTimeout(() => { ar.classList.remove("fly"); tr.classList.remove("loose", "fresh"); }, 1400);
  }
}
/* Typing redraws only the live notes, the score and the Continue button. */
function gdRefresh(){
  const st = gdCur();
  $("gdCard").querySelectorAll("[data-live]").forEach(el => {
    const f = GD_LIVE[el.getAttribute("data-live")];
    if (f) el.innerHTML = f();
  });
  if (st.ok){
    const ok = st.ok(gd.a), b = $("gdCard").querySelector("[data-gd='next']"), w = $("gdCard").querySelector("[data-why]");
    if (b) b.disabled = !ok;
    if (w){ w.hidden = ok; w.textContent = st.why ? st.why(gd.a) : ""; }
  }
  gdRenderSide();
}
function gdGoStep(id){
  const st = gdStep(id);
  if (!st || !gdApplies(st)) return;
  if (gd.back && gd.back.step !== id) gd.back = null;
  gd.cur = id;
  gdSave();
  gdRender(true);
}
function gdNext(){
  const st = gdCur();
  if (st.ok && !st.ok(gd.a)) return;
  if (st.commit) st.commit();
  if (st.id !== "intro") gd.done[st.id] = true;
  const L = gdRoute(), i = L.indexOf(st);
  gd.back = null;
  gd.cur = (L[i + 1] || L[L.length - 1]).id;
  gdSave();
  gdRender(true);
}
function gdPrev(){
  const L = gdRoute(), i = L.indexOf(gdCur());
  gd.back = null;
  gd.cur = (L[Math.max(0, i - 1)]).id;
  gdSave();
  gdRender(true);
}

