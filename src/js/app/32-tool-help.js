/* ---------- tool help ----------
   The guide's coach panel on its own: the Help button in each tool's header
   opens a short walkthrough of that tool, a few parts long, written for
   someone who hasn't met the terms before. Unlike a guide trip it fills in
   nothing and carries nothing back; it just explains, and ticks off the
   things worth trying as you try them. Opening it steps the guide's panel
   aside until it closes. `base` is what the tool looked like when help
   opened, so "tried a different X" can be told apart from the starting
   value. */
var th = null;   // {tool, page, min, base}; var, since the guide can ask before this line runs
const thB = () => (th && th.base) || {};
var TH_TOURS = {
  tax: {name:"Income Tax", title:"How your taxes are figured",
    start(){ return {view:txView}; },
    pages:[
      {title:"Your situation", focus:"#asideTax", tasks(){
        const ret = txMode === "retire";
        const T = [
          {h:"At the top, choose <b>Normal income</b> for a paycheck today, or <b>Retirement income</b> for the years you live on savings, Social Security and pensions. The steps here follow whichever is on."},
          {h:"<b>Filing status</b> and <b>State</b>. Married couples almost always file jointly, which is what <b>Married</b> means here. States tax very differently, and several have no income tax at all."}
        ];
        if (!ret){
          T.push({h:"<b>Gross income</b> is your pay before anything comes out: the top line of your pay stub, for the whole year. A married couple enters each spouse's pay separately."});
          T.push({h:"<b>Pre-tax deductions</b> is what your employer takes out before tax: 401(k), 403(b) and HSA contributions. It lowers your income tax, though not Social Security or Medicare tax.", ok: num("txPre") > 0 ? true : undefined});
        } else {
          T.push({h:"Each kind of income is taxed its own way. <b>Traditional</b> withdrawals are taxed like a paycheck. <b>Roth</b> withdrawals are tax-free. From a <b>Brokerage</b> account only the growth, the <b>Gain portion</b>, is taxed, at lower capital-gain rates."});
          T.push({h:"Only part of <b>Social Security</b> is ever taxed (at most 85%), and none of it at lower incomes. <b>Age 65 or older</b> adds extra deductions, so answer it for each of you."});
        }
        T.push({h:"<b>Deduction</b>: most people take the <b>Standard deduction</b>, a flat amount of income that's never taxed. Pick <b>Itemized</b> only if your mortgage interest, state and local taxes and charitable gifts add up to more."});
        return T;
      }},
      {title:"Reading the result", focus:"#txNet", tasks(){
        if (txMode === "retire") return [
          {h:"<b>Income after tax</b> is what you keep from everything you took in. <b>Effective tax rate</b> is the share that went to tax: your average rate, well below your bracket."},
          {h:"<b>Where each dollar came from</b> splits the bill by source, so you can see which withdrawals cost the most. Roth and the cost basis of a brokerage sale come out untaxed."},
          {h:"<b>Marginal federal rate</b>, on the left, is the tax on your next $1,000 of traditional withdrawals. In retirement it can run above your bracket, because more income can pull more Social Security into tax with it."}
        ];
        return [
          {h:"<b>Net pay</b> is your pay minus taxes. Switch to <b>Take-home pay</b> to also take out pre-tax savings: that's what reaches your bank account.", ok: num("txPre") > 0 ? txView === "take" : undefined},
          {h:"<b>Per month</b> and <b>Every two weeks</b> are the same thing, per paycheck."},
          {h:"<b>Tax breakdown</b> splits the bill: federal and state income tax, and FICA, the 6.2% for Social Security and 1.45% for Medicare that comes out of every paycheck."},
          {h:"<b>Effective rate</b> is tax divided by income: your average rate. It's always lower than your bracket, because only your top dollars pay the top rate."}
        ];
      }},
      {title:"How brackets work", focus:"#txBrackets", tasks(){
        const T = [
          {h:"Income is taxed in layers. <b>Federal brackets</b> shows each band: only the dollars inside a band pay its rate. A raise that crosses into a higher bracket never lowers what you take home."},
          {h:"<b>Marginal federal rate</b>, on the left, is the rate on your next dollar. It's the one that matters for decisions: a $1,000 401(k) contribution at 22% saves $220 of tax."},
          {h:"<b>Room before</b> the next bracket is how much more income fits at your current rate."}
        ];
        if (txMode === "retire") T.push({h:"<b>Your capital gain</b> chart shows gains sitting on top of your other income. Gains that fit under the 0% line are tax-free, which is why some retirees sell investments on purpose in low-income years."});
        T.push({h:"<b>State rules</b>, at the bottom, spells out what your state taxes and exempts, and anything it charges that isn't counted here."});
        return T;
      }}
    ],
    chip(){
      const R = runTax(readTax());
      if (!(R.gross > 0)) return "";
      return txMode === "retire" ? "Total tax<br><b>" + money(R.total) + "/yr</b>" : "Take-home<br><b>" + money(R.net / 12) + "/mo</b>";
    }},

  mortgage: {name:"Mortgage Calculator", title:"What a home really costs",
    start(){ return {rate:num("moRate"), term:$("moTerm").value}; },
    pages:[
      {title:"The home and loan", focus:"#asideMort", tasks(){
        return [
          {h:"<b>Home price</b> and <b>Down payment</b>, as a percent or a dollar amount. Put down less than 20% and lenders add <b>PMI</b>, insurance that protects them, until you own 20% of the home."},
          {h:"<b>Interest rate</b> starts at a recent national average. Your own rate depends on your credit score and the loan, so a lender's quote makes this much more accurate."},
          {h:"<b>Length</b>: a 30-year loan has the lowest payment; a 15-year loan costs more each month but far less interest over its life. Try both.", ok: $("moTerm").value !== thB().term ? true : undefined},
          {h:"<b>Property tax</b>, <b>Insurance</b> and <b>HOA</b> vary a lot by area. Your county's tax rate and an insurance quote are worth looking up."},
          {h:"<b>Maintenance</b>: owners should expect to spend about 1% of the home's value a year on repairs. It's not part of the bill, but it is part of the cost."}
        ];
      }},
      {title:"Your monthly cost", focus:"#moTotal", tasks(){
        return [
          {h:"<b>Monthly payment</b> is everything together. <b>Principal &amp; interest</b> is the loan itself; <b>Everything else</b> is tax, insurance, PMI, HOA and upkeep."},
          {h:"A common guideline is to keep the house payment under about 28% of your income before tax. Lenders may approve more, but that's the most they'll lend, not what's comfortable."},
          {h:"<b>Loan balance</b> shows how slowly the loan shrinks at first. In <b>Amortization by year</b>, compare year 1 with later years: early payments are mostly interest."},
          {h:"Try a rate a point higher or lower and watch the payment move. Even small rate differences add up over 30 years.", ok: num("moRate") !== thB().rate ? true : undefined}
        ];
      }},
      {title:"Extra payments and refinancing", focus:"#moExtrasOn", tasks(){
        const on = $("moExtrasOn").value === "1";
        return [
          {h:"Under <b>Already have this loan?</b>, choose <b>Yes, show these options</b>. For a loan you already have, enter today's balance as the <b>Home price</b>, 0% down, and the years left as the <b>Length</b>.", ok: on},
          {h:"Try $100 or $200 in <b>Extra toward principal</b>. The panel on the right shows the interest you'd save and how much sooner you'd be done.", ok: on && num("moExtraMo") > 0},
          {h:"A <b>One-time extra payment</b>, like a bonus, can either finish the loan early or, with a <b>Recast</b>, lower the monthly payment instead."},
          {h:"<b>New rate</b>, <b>New length</b> and <b>Closing costs</b> test a refinance. The break-even is how long the lower payment takes to repay the closing costs: if you might move before then, it isn't worth it."},
          {h:"Paying extra earns a sure return equal to your rate. Above about 6% it often beats investing; below about 4%, investing usually comes out ahead. Build an emergency fund first either way."}
        ];
      }}
    ],
    chip(){
      const R = mortgage(readMort());
      return R.loan > 0 ? "Monthly payment<br><b>" + money(R.total) + "</b>" : "";
    }},

  budget: {name:"Budget", title:"Build a budget that works",
    pages:[
      {title:"Your income", focus:"#bgIncomeIn", tasks(){
        return [
          {h:"<b>Income after taxes</b> is what actually lands in your bank account, not your salary. Choose <b>/mo</b> or <b>/yr</b> for how you typed it.", ok: num("bgIncomeIn") > 0 ? true : undefined},
          {h:"Not sure? <b>Copy from Income Tax</b> brings over your pay after taxes from that tool."},
          {h:"If you save through a 401(k) at work, count your pay before that comes out, then enter the 401(k) on the savings line. That way it shows up as saving instead of disappearing."}
        ];
      }},
      {title:"Your spending", focus:"#bgList", tasks(){
        const B = gdBudgetNums();
        return [
          {h:"Open your last two or three months of bank and card statements and work down the list. Rough is fine; a guess beats a blank." + (B.lines ? "<em>" + B.lines + " filled</em>" : ""), ok: B.lines >= 5 ? true : undefined},
          {h:"For bills that come once or twice a year, like car insurance, travel, gifts or repairs, tap <b>/yr</b> on the line and enter the yearly total. They're the ones budgets usually forget."},
          {h:"Click any item's name to rename it, and <b>Add custom item</b> for anything missing. Skip lines that don't apply."},
          {h:"<b>Savings &amp; investments</b> counts as saving, not spending. <b>+ Retirement contribution</b> and <b>+ College savings</b> bring those amounts in from the other tools.", ok: B.saved > 0 ? true : undefined}
        ];
      }},
      {title:"Reading it", focus:"#bgLeft", tasks(){
        return [
          {h:"<b>Total spending</b> is everything but saving. <b>Left over</b> is what's free after spending and saving. Below zero means spending more than comes in, which usually means debt is growing."},
          {h:"A common starting point is the 50/30/20 split: about half on needs, 30% on wants and 20% to savings and extra debt payments. Treat it as a gauge, not a rule."},
          {h:"<b>Emergency fund</b> sizes a cash cushion from your spending. Three to six months is typical; more if your income is irregular or you're the only earner."},
          {h:"<b>CSV</b>, next to the title, downloads the budget as a spreadsheet."}
        ];
      }}
    ],
    chip(){
      const B = gdBudgetNums();
      return B.inc > 0 || B.spent > 0 ? "Left over<br><b>" + money(B.left / 12) + "/mo</b>" : "";
    }},

  college: {name:"College Savings", title:"Saving for college",
    pages:[
      {title:"Your plan", focus:"#asideCollege", tasks(){
        return [
          {h:"<b>School type</b> fills in a typical yearly cost, tuition plus room and board. Choose <b>Custom</b> to type a particular school's price."},
          {h:"<b>Annual cost today</b> is in today's prices; the tool raises it for you. <b>Years until college</b> is 18 minus your child's age: 16 for a two-year-old, 20 for a child due in two years."},
          {h:"More than one child? <b>Add a child</b> for each. They share one account, and the monthly amount covers them all."},
          {h:"<b>Currently saved</b> is what's already set aside, in a 529 plan or anywhere else."}
        ];
      }},
      {title:"The assumptions", focus:"#clReturn", tasks(){
        return [
          {h:"<b>Investment return</b> is what the savings earn each year. 5% to 6% is a reasonable middle; 529 plans usually shift toward safer investments as college gets close."},
          {h:"<b>Tuition inflation</b> is how fast college prices rise. It has run ahead of everyday prices for decades; 4% to 5% is a common assumption."}
        ];
      }},
      {title:"Reading the result", focus:"#clMonthly", tasks(){
        return [
          {h:"<b>Save per month</b> is what to set aside from now until college starts."},
          {h:"<b>Total projected cost</b> is every year of college at future prices, which is why it looks so large. <b>Needed when college starts</b> is less, because the money still in the account keeps growing while earlier years are paid."},
          {h:"You don't have to cover all of it. Grants, scholarships, what you can pay from income at the time and modest loans usually fill part. Saving even half makes a real difference."},
          {h:"With more than one child, the amount runs until the youngest starts college. If an older child starts soon, it can be higher at first and step down once that child is in college; the note under it says when."},
          {h:"A 529 plan grows tax-free when spent on school, and many states add a tax deduction. Each child usually has their own 529, but you can change a 529's beneficiary to a sibling, so saving in one pot and splitting it later works."}
        ];
      }}
    ],
    chip(){
      const mo = collegeMonthly(readCollege());
      return mo > 0 ? "Save<br><b>" + money(mo) + "/mo</b>" : "";
    }},

  rentbuy: {name:"Rent vs. Buy", title:"Is buying better than renting?",
    start(){ return {horizon:num("rbHorizon"), appr:num("rbAppr")}; },
    pages:[
      {title:"The home", focus:"#asideRB", tasks(){
        return [
          {h:"Enter the home as you would in the Mortgage Calculator: price, down payment, rate, length, property tax, insurance and upkeep. <b>Copy from Mortgage</b> brings them over."},
          {h:"<b>Closing costs</b> are the fees to buy, often 2% to 5% of the price. <b>Selling costs</b> are mostly agent commission, often 5% to 6%. Together they're why buying rarely pays off over just a few years."}
        ];
      }},
      {title:"Renting and the assumptions", focus:"#rbRent", tasks(){
        return [
          {h:"<b>Monthly rent</b> for a comparable place, and its <b>Annual increase</b>."},
          {h:"<b>Home appreciation</b> is how fast the home gains value. Across the country it has averaged roughly 3% to 4% a year, but it varies enormously by area and decade. Try 2% and 5%.", ok: num("rbAppr") !== thB().appr ? true : undefined},
          {h:"<b>Investment return</b> is what the renter earns by investing the down payment, and any month renting costs less, instead of putting it into a house."},
          {h:"<b>Time horizon</b> is how long you'd stay. It matters most of all: try 5 years and then 20.", ok: num("rbHorizon") !== thB().horizon ? true : undefined},
          {h:"<b>Tax on gains</b> and <b>Filing status</b>: investment gains are taxed when sold, while up to $250,000 of gain on a home you live in ($500,000 married) is tax-free."}
        ];
      }},
      {title:"Who comes out ahead", focus:"#rbWinner", tasks(){
        return [
          {h:"It's a fair race: both households spend the same each month, and whichever side's costs are lower invests the difference."},
          {h:"<b>Buyer net worth</b> is the home sold at that year's value, less the loan left, selling costs and tax, plus anything invested. <b>Renter net worth</b> is everything the renter invested."},
          {h:"The break-even year, under the chart, is when buying pulls ahead. Before it, the up-front costs of buying haven't been earned back."},
          {h:"This is only about money. Stability, space, and freedom to move or not to fix a roof are worth something too, and only you can price them."}
        ];
      }}
    ],
    chip(){
      const w = $("rbWinner").textContent.trim(), n = $("rbWinNote").textContent.trim();
      return w && w !== "—" ? "Ahead<br><b>" + escapeHtml(w) + "</b> " + escapeHtml(n) : "";
    }},

  drawdown: {name:"Drawdown Simulator", title:"Will your savings last?",
    start(){ return {strategy:$("ddStrategy").value, mix:$("ddMixText").textContent, inputs:ddInputs, seen:{}}; },
    pages:[
      {title:"Your plan", focus:"#asideDD", show(){ ddShowTab("plan"); }, tasks(){
        const b = thB();
        return [
          {h:"<b>Simple</b> shows the five things a first run needs; <b>Advanced</b>, at the top of the panel, adds the rest: rebalancing, fees, Social Security, other income, spending limits, goals and how history is tested. Settings you've hidden still count, and Simple lists any that are in use.", ok: ddInputs !== b.inputs ? true : undefined},
          {h:"<b>Portfolio value</b> is all your savings the day you stop working. <b>Copy from your plan</b> brings a projection over from the retirement calculators."},
          {h:"<b>Asset mix</b> opens the split among US stocks, small-cap value, bonds and cash, each with its real returns since 1926. It can also glide the stock share over retirement, and set part of the savings aside to buy guaranteed income: a TIPS ladder or an annuity.", ok: $("ddMixText").textContent !== b.mix ? true : undefined},
          {h:"<b>Years in retirement</b>: plan to about 95. Running out late is the costly mistake."},
          {h:"<b>Withdrawal strategy</b> and its rate decide each year's spending. The 4% rule takes 4% of savings the first year and raises it with inflation. Amounts are before income tax."}
        ];
      }},
      {title:"Your result", focus:"#ddSuccess", show(){ ddShowTab("plan"); }, tasks(){
        return [
          {h:"Each test is a real retirement: one starting every month since 1926, 835 of them for a 30-year plan. <b>Success rate</b> is the share where the money never ran out."},
          {h:"<b>Median ending balance</b> is what's typically left, in today's dollars. <b>Worst case</b> is the leanest ending on record."},
          {h:"<b>Pin as baseline</b> keeps these results. Change anything and every figure shows whether it got better or worse, and the charts draw the baseline dashed.", ok: ddBase ? true : undefined},
          {h:"The <b>Spending scorecard</b> below measures what living on the plan was like: how often spending stayed above your <b>comfort line</b> (set your own under Goals), the leanest year, cuts, and what a typical retirement spent in all."}
        ];
      }},
      {title:"When you retired", focus:"#ddSeqPanel", show(){
        if (ddMode !== "hist") $("segDD").querySelector("[data-dd='hist']").click();
        ddShowTab("plan");
      }, tasks(){
        return [
          {h:"<b>When you retire</b> plots each start's first ten years against how it ended. A bad first decade, when withdrawals are largest against the balance, decides most failures: that's <b>sequence risk</b>."},
          {h:"Switch to <b>By start year</b> to see every start in order, with 1929, 1937, 1966, 1973, 2000 and 2008 marked. <b>What happened in the marked years</b> explains each.", ok: ddSeqKind === "year" ? true : undefined},
          {h:"Tap a dot, or a row in <b>How each starting month fared</b>, to follow that retirement. <b>Year by year</b> then says why it went the way it did.", ok: ddView === "year" ? true : undefined}
        ];
      }},
      {title:"Withdrawal strategies", focus:"#ddStrategy", show(){ ddShowTab("plan"); }, tasks(){
        const seen = thB().seen || {};
        seen[$("ddStrategy").value] = 1;
        const n = Object.keys(seen).length;
        return [
          {h:"Fifteen strategies in five families: steady income, a share of the portfolio, guardrails, smoothed and valuation-based. Change it and watch the scorecard." + (n > 1 ? "<em>" + n + " tried</em>" : ""), ok: n >= 3 ? true : undefined},
          {h:"The card under the picker sketches each one's spending through 1966, the classic hard start. <b>How the strategies compare</b> sets out the pros and cons."},
          {h:"<b>Reproduce a classic study</b> runs Bengen, the Trinity study, Guyton-Klinger, Vanguard, VPW and the Kitces ratchet as the papers did, and puts what each found beside what the simulator finds."},
          {h:"Under Advanced: <b>Minimum</b> and <b>Maximum spending</b> bound what a flexible strategy spends, and the minimum can change with age. <b>Spending through retirement</b> shapes a steady strategy's path, easing or in stages."}
        ];
      }},
      {title:"Compare strategies", focus:"#ddTargetPanel", show(){ ddShowTab("compare"); }, tasks(){
        return [
          {h:"Comparing strategies at the same rate isn't fair: 4% means different things to each. The <b>Risk target</b> sets one bar, like never dropping below your comfort line in every start, and each strategy is tuned to spend the most that clears it."},
          {h:"The <b>Strategy showdown</b> plots each one's typical lifetime spending against what it leaves, its leanest year or year one, with the full figures in the table."},
          {h:"<b>Through a hard start</b> draws their spending through 1966, 1929 or 1973, or any year you pick."}
        ];
      }},
      {title:"Safe spending", focus:"#ddSafePanel", show(){ ddShowTab("safe"); }, tasks(){
        return [
          {h:"<b>The most you could have started with</b>: for each start, the highest first-year withdrawal that met the risk target. The dips are the hard eras, marked on the chart."},
          {h:"The two answers below it, the <b>highest setting</b> that meets the target and the <b>portfolio needed</b> for your spending, each have a <b>Use it</b> button."},
          {h:"The <b>Success grid</b> tries settings around yours against stock shares or retirement lengths; tap a cell to use it. <b>Valuations at the start</b> sets each start's safe rate against its CAPE, and marks today's."}
        ];
      }},
      {title:"Income and the rest", focus:"#ddSSMode", show(){ ddShowTab("plan"); }, tasks(){
        return [
          {h:"<b>Social Security</b>: choose <b>Estimate it for me</b>, or better, <b>I know my benefit</b> with the figure from your statement at ssa.gov. The table near the bottom compares claiming at 62, 64, 67 and 70.", ok: $("ddSSMode").value !== "none" ? true : undefined},
          {h:"<b>Other income</b> for a pension, part-time work or rent; <b>Future expenses</b> for a roof, a car or helping a child. Each has its own start and length.", ok: ddIncomeItems.length || ddExpenseItems.length ? true : undefined},
          {h:"<b>Rebalancing</b> and <b>Fees</b> are with the portfolio. Try 1% in fees to see what an advisor or pricier funds cost over a retirement."},
          {h:"<b>Market history</b>: test a retirement every month or each January, and from any year, say 1950 to leave out the Depression."}
        ];
      }},
      {title:"Monte Carlo", focus:"#segDD", show(){ ddShowTab("plan"); }, tasks(){
        return [
          {h:"Switch <b>Historical</b> to <b>Monte Carlo</b> for 5,000 retirements built from years drawn at random from the record, including sequences history never produced.", ok: ddMode === "mc" ? true : undefined},
          {h:"<b>Years drawn together</b>, under Market history, keeps runs of consecutive years intact, so streaks like the 1970s' inflation stay together. 1 draws each year on its own.", ok: num("ddMcBlock") > 1 ? true : undefined},
          {h:"<b>Returns: Your own</b> sets the long-run return for each asset and for inflation. History is shifted to match, keeping its ups and downs, to test a leaner future.", ok: $("ddMcRet").value === "own" ? true : undefined},
          {h:"<b>Return sensitivity</b>, near the bottom, shows the success rate if every year earns a little less, or more, than it did."}
        ];
      }}
    ],
    chip(){
      const t = $("ddSuccess").textContent.trim();
      return t && t !== "—" ? "Success rate<br><b>" + escapeHtml(t) + "</b>" : "";
    }},

  roth: {name:"Roth Conversion & RMDs", title:"Should you convert to Roth?",
    start(){ return {strategy:$("rcStrategy").value}; },
    pages:[
      {title:"The idea", focus:"#asideRC", tasks(){
        return [
          {h:"Money in a traditional 401(k) or IRA hasn't been taxed yet. A <b>Roth conversion</b> moves some of it into a Roth: you pay income tax on it now, and from then on it grows and comes out tax-free."},
          {h:"It pays off when your tax rate now is lower than it would be later. For many people that's the years between retiring and starting Social Security, when income is low."},
          {h:"Later, from 73 or 75, the IRS requires withdrawals from traditional accounts every year, called <b>RMDs</b>, taxed whether you need the money or not. Converting earlier shrinks them."},
          {h:"Start with <b>Your age</b>, <b>Plan through</b> (how far to run it), <b>Filing status</b> and <b>State</b>."}
        ];
      }},
      {title:"Your accounts and income", focus:"#rcTrad", tasks(){
        return [
          {h:"Enter each balance. For <b>Brokerage</b>, <b>Cost basis</b> is the share that's money you put in rather than growth; only growth is taxed when sold."},
          {h:"<b>Real return</b> is growth after inflation, so every figure stays in today's dollars. 4% to 5% suits a balanced mix."},
          {h:"<b>Annual spending</b> is what you live on, before tax. The tax each year is paid on top of it, from the brokerage first."},
          {h:"<b>Your Social Security</b> and your spouse's, with the age each of you claims, and any <b>Other income</b>."},
          {h:"<b>Survivor transition</b>: the year the first spouse is assumed to die. The survivor keeps the larger benefit but files single, often into a higher bracket on similar income. Converting earlier can soften that."}
        ];
      }},
      {title:"The conversion plan", focus:"#rcStrategy", tasks(){
        return [
          {h:"<b>Strategy</b> sets how much to convert each year. <b>Fill to the top of a bracket</b> is the most common: convert just enough to use up a low bracket without spilling into the next.", ok: $("rcStrategy").value !== thB().strategy ? true : undefined},
          {h:"<b>Convert from</b> and <b>Through</b> set the years. Try starting the year you retire and stopping when Social Security or RMDs begin."},
          {h:"<b>Conversion tax paid from</b>: paying from a taxable account moves the whole amount into the Roth. Having it withheld leaves less in the Roth, and before 59½ the withheld part also owes a 10% penalty."},
          {h:"<b>Medicare IRMAA</b>: income two years earlier sets Medicare premiums from 65, and a big conversion can raise them. Leave it included."}
        ];
      }},
      {title:"Is it worth it?", focus:"#rcSaved", tasks(){
        return [
          {h:"<b>Lifetime tax saved</b> compares all the tax (and Medicare surcharges) with and without converting, with later years counted for less, at the <b>Discount rate</b>, since a dollar owed later costs less than one paid now."},
          {h:"<b>After-tax net worth</b> is what's left at the end with the traditional balance reduced by the tax still owed on it, at the <b>Rate on what's left</b>: your rate late in life, or your heirs'."},
          {h:"When both are positive, converting wins. When they disagree, read the explanation under them. Early years always look worse, since the tax is paid up front."},
          {h:"Switch the chart between <b>Balance</b> and <b>Tax</b>, and the table between <b>Converting</b> and <b>Doing nothing</b>, to see each year side by side.", ok: rcView !== "bal" || rcTableView !== "plan" ? true : undefined},
          {h:"Conversions can't be undone, and the details matter. Use this to see whether the idea is worth raising with a tax professional."}
        ];
      }}
    ],
    chip(){
      const t = $("rcSaved").textContent.trim();
      return t && t !== "—" ? "Lifetime tax saved<br><b>" + escapeHtml(t) + "</b>" : "";
    }},

  debt: {name:"Debt Payoff", title:"Your fastest way out of debt",
    start(){ return {mode:dtMode}; },
    pages:[
      {title:"Your debts", focus:"#dtList", tasks(){
        const D = gdDebtNums();
        return [
          {h:"Enter each debt: a name, the <b>Balance</b>, the <b>Rate</b> (the APR on your statement) and the <b>Minimum</b> payment. <b>Add a debt</b> gives you another row. Sample debts are there to start; replace them." + (D.live.length ? "<em>" + D.live.length + " entered</em>" : "")},
          {h:"Include credit cards, car loans, student loans and personal loans. A mortgage is usually left out: it's long, cheap debt with its own tool."},
          {h:"If a minimum doesn't even cover the interest, the balance grows no matter what, and the tool will warn you. Check the figure on your statement."}
        ];
      }},
      {title:"Your plan", focus:"#dtExtra", tasks(){
        return [
          {h:"<b>Extra payment</b> is what you can pay each month on top of all the minimums. Even a little matters. <b>Copy from Budget</b> uses your budget's left-over.", ok: num("dtExtra") > 0 ? true : undefined},
          {h:"The extra goes to one debt at a time. When that debt is gone, its minimum rolls over to the next one, so your payoff speeds up as you go."},
          {h:"<b>Avalanche</b> targets the highest rate first and costs the least interest. <b>Snowball</b> clears the smallest balance first, for quick wins that keep you going. Compare both.", ok: dtMode !== thB().mode ? true : undefined}
        ];
      }},
      {title:"Reading the result", focus:"#dtFree", tasks(){
        return [
          {h:"<b>Debt-free</b> is the month the last debt is paid. <b>Total interest</b> is what you'd pay along the way; <b>Saved vs. minimums</b> is what this plan saves over paying only the minimums."},
          {h:"<b>Avalanche vs. snowball</b> puts the two side by side. The best plan is the one you'll actually stick with."},
          {h:"<b>Payoff order</b> and <b>The schedule</b> show which debt goes when, and your balance month by month."},
          {h:"It only works if balances stop growing, so pause new card spending while you pay down. Keep a small emergency fund so a surprise bill doesn't go back on a card."}
        ];
      }}
    ],
    chip(){
      const D = gdDebtNums();
      if (!D.live.length || !dtLast) return "";
      return "Debt-free<br><b>" + (dtLast.pick.stalled ? "never" : debtDate(dtLast.pick.monthsTotal)) + "</b>";
    }},

  backtest: {name:"Portfolio Backtest", title:"What a mix has actually earned",
    start(){ return {stock:num("btStock")}; },
    pages:[
      {title:"Pick a mix and a period", focus:"#asideBT", tasks(){
        const era = document.querySelector("#segBTEra button.on");
        return [
          {h:"<b>Stocks</b> is the share in stocks (the S&amp;P 500); the rest is bonds (10-year Treasuries). Stocks grow more over time but fall harder; bonds steady the ride.", ok: num("btStock") !== thB().stock ? true : undefined},
          {h:"<b>From</b> and <b>Through</b> pick the years. <b>All</b> runs from 1926; try <b>Last 50</b> and <b>Last 30</b> to see how much the answer depends on the period.", ok: era && era.getAttribute("data-era") !== "all" ? true : undefined}
        ];
      }},
      {title:"Reading the result", focus:"#btCagr", tasks(){
        return [
          {h:"<b>Return, per year</b> is the average yearly growth over the whole period, compounded. <b>After inflation</b> is the same after rising prices: the figure that tells you what the money could actually buy."},
          {h:"<b>Volatility</b> is how much returns swing from year to year. Higher means a bumpier ride."},
          {h:"<b>Worst year</b> and <b>Deepest fall</b> show what you'd have had to sit through. If a drop like that would have made you sell, a lower stock mix may suit you better, since selling in a crash locks in the loss."}
        ];
      }},
      {title:"A range, not a promise", focus:"#btRollTable", tasks(){
        return [
          {h:"<b>Rolling returns</b> looks at every stretch of years, not one average: the best, the worst and the typical. Longer stretches have a much narrower range. Switch to <b>Real</b> to see them after inflation.", ok: btRoll === "real" ? true : undefined},
          {h:"<b>Year by year</b> lists each year's stock, bond and inflation figures."},
          {h:"Use it to pick a reasonable rate for planning. <b>Use these figures in Advanced</b> carries it over. The past doesn't predict the future, so plan toward the cautious end of the range."}
        ];
      }}
    ],
    chip(){
      const t = $("btReal").textContent.trim();
      return t && t !== "—" ? "After inflation<br><b>" + escapeHtml(t) + "</b>" : "";
    }},

  healthcare: {name:"Healthcare Cost Planner", title:"Health coverage in retirement",
    pages:[
      {title:"Your situation", focus:"#asideHC", tasks(){
        return [
          {h:"<b>Retirement age</b>: Medicare starts at 65. Retire earlier and you'll need your own coverage until then, usually from the ACA marketplace (healthcare.gov)."},
          {h:"<b>Household</b> is everyone on your tax return. It sets the poverty line your subsidy is measured against."},
          {h:"<b>Spouse's age then</b>, for a couple: premiums rise with age, so each of you is priced at your own. Then your <b>State</b>."}
        ];
      }},
      {title:"Income sets the price", focus:"#hcIncome", tasks(){
        return [
          {h:"<b>Retirement MAGI</b> is your income as the tax return counts it: traditional 401(k) and IRA withdrawals, pensions, interest, dividends, capital gains you sell for, and the taxed part of Social Security."},
          {h:"Roth withdrawals, cash savings and the money you originally put into a brokerage account don't count. Living on those before 65 can keep MAGI low and the subsidy large."},
          {h:"<b>Copy from Income Tax</b> brings the figure over from that tool's Retirement income mode. If you'll collect <b>Social Security</b> before 65, enter it: the marketplace counts all of it."},
          {h:"<b>ACA benchmark premium</b> is optional: your household's second-cheapest Silver plan from healthcare.gov. Without it, a state average is used."}
        ];
      }},
      {title:"Before 65: the marketplace", focus:"#hcACABody", tasks(){
        return [
          {h:"The subsidy, a <b>premium tax credit</b>, caps what you pay for the benchmark Silver plan at a share of your income. The government pays the rest, straight to the insurer."},
          {h:"Above 400% of the poverty line the credit stops completely, so one dollar over can cost thousands a year. The tool warns you when you're close."},
          {h:"The same credit applies to any plan tier: <b>Bronze</b> costs less each month but more when you use care; <b>Gold</b> the reverse. Below about 250% of the poverty line, Silver plans also come with lower deductibles."}
        ];
      }},
      {title:"From 65: Medicare", focus:"#hcMedicareBody", tasks(){
        return [
          {h:"<b>Part B</b> covers doctors and outpatient care; <b>Part D</b> covers prescriptions. Most people add a <b>Medigap</b> plan to cover what those leave unpaid, or choose a Medicare Advantage plan instead."},
          {h:"<b>IRMAA</b> is a surcharge on Parts B and D at higher incomes, based on your income from two years earlier. Each tier is a cliff, so a large Roth conversion or sale can raise premiums two years later."},
          {h:"Add these premiums to your retirement spending, in the Drawdown Simulator or the guide, so the plan pays for them."}
        ];
      }}
    ],
    chip(){
      const v = gdHcPrem();
      return v != null ? "Premium before 65<br><b>" + money(v) + "/mo</b>" : "";
    }},

  fire: {name:"FIRE Calculator", title:"When could work become optional?",
    start(){ return {contrib:num("fiContrib")}; },
    pages:[
      {title:"The idea", focus:"#segFireMode", tasks(){
        return [
          {h:"FIRE stands for <b>financial independence, retire early</b>: saving enough that your investments could pay for your life, so working becomes a choice."},
          {h:"<b>FIRE</b> finds the age your savings could cover your spending on their own. <b>Coast FIRE</b> finds when you could stop saving and still reach your goal by a normal retirement age, just by letting what you have grow.", ok: gdFireMode() === "coast" ? true : undefined}
        ];
      }},
      {title:"Your numbers", focus:"#fiCurAge", tasks(){
        return [
          {h:"<b>Current savings</b> and <b>Contribution</b>: count retirement accounts and other investments, not your emergency fund or home."},
          {h:"<b>Contribution growth</b> raises what you save each year. <b>Rate of return</b> is before inflation; <b>Inflation</b> converts everything back to today's dollars."},
          {h:"<b>Target type</b>: <b>Annual withdrawal</b> is the yearly spending you'd need, in today's dollars; <b>Portfolio value</b> is a savings number if you have one in mind."},
          {h:"<b>Withdrawal rate</b> turns spending into a savings target. At 4%, you need 25 times your yearly spending; 3.5% is more cautious for early retirees, whose money has to last longer."}
        ];
      }},
      {title:"Reading the result", focus:"#fiAge", tasks(){
        return [
          {h:"<b>FIRE age</b> is when you'd reach the target, <b>Portfolio at FIRE</b> what you'd have then in today's dollars, and <b>Years until FIRE</b> how far away it is."},
          {h:"Raise the <b>Contribution</b> a little and see how many years it takes off. Early on, saving more speeds things up far more than a higher return.", ok: num("fiContrib") !== thB().contrib ? true : undefined},
          {h:"Above the chart, switch <b>Rate band</b> to <b>Historical</b> to see when you'd have reached it in real markets since 1926, with a slider for how sure you want to be."},
          {h:"Retiring early usually needs a plan for health insurance before 65 and for reaching retirement accounts before 59½. The Early Retirement Bridge and Healthcare tools cover both."}
        ];
      }}
    ],
    chip(){
      const t = $("fiAge").textContent.trim();
      return t && t !== "—" ? escapeHtml($("fiAgeLabel").textContent) + "<br><b>" + escapeHtml(t) + "</b>" : "";
    }},

  bridge: {name:"Early Retirement Bridge", title:"Getting to 59½",
    start(){ return {seen:{}, fill:$("brFill").value}; },
    pages:[
      {title:"The problem it solves", focus:"#asideBR", tasks(){
        return [
          {h:"Retirement accounts charge a 10% penalty on withdrawals before age 59½, on top of income tax. Retire earlier and you need a way to live until then. This tool compares every legal route."},
          {h:"Enter what you'll have at retirement in each kind of account: <b>Traditional</b> (pre-tax 401(k) and IRA), <b>Roth</b>, and <b>Brokerage and cash</b>, which you can spend any time."},
          {h:"<b>Of that, contributions</b>: what you put into a Roth yourself can come out any time, tax- and penalty-free. Only the growth is locked up. <b>Cost basis</b> is how much of the brokerage is money you put in rather than growth."},
          {h:"<b>Yearly spending, after tax</b>, and leave out health insurance: the tool prices marketplace coverage for each plan, since your income changes the subsidy."},
          {h:"Retiring at 55 or later? The <b>rule of 55</b> lets you draw the 401(k) from the job you're leaving penalty-free, so enter that balance when it's asked for."}
        ];
      }},
      {title:"The best way across", focus:"#brBest", tasks(){
        return [
          {h:"<b>Best way to 59½</b> is the plan that makes it without penalties in the most historical markets, then costs the least. What it does is listed underneath."},
          {h:"<b>Holds up in</b> is the share of retirements since 1926 where that plan reached 59½ without running short or needing penalized money."},
          {h:"<b>Cost of the bridge</b> is the income tax, penalties and health premiums it pays along the way."}
        ];
      }},
      {title:"Compare the routes", focus:"#brCompare", tasks(){
        const seen = thB().seen || {};
        if (brSel) seen[brSel] = 1;
        const n = Object.keys(seen).length, live = k => brLast && brLast.live.some(p => p.key === k);
        const row = (k, txt) => ({h:txt, ok: seen[k] ? true : undefined});
        const T = [{h:"<b>Ways to 59½</b> lists every route. Click a few rows to see each one play out below." + (n > 1 ? "<em>" + n + " tried</em>" : ""), ok: n >= 3 ? true : undefined}];
        if (live("ladder")) T.push(row("ladder", "<b>Roth conversion ladder</b>: move a year's spending into a Roth each year and spend it five years later. The first five years need another source."));
        if (live("sepp")) T.push(row("sepp", "<b>72(t) payments</b>: fixed yearly payments from an IRA with no penalty, but locked in until 59½ or for five years, whichever is later."));
        T.push(row("brok", "<b>Brokerage, then Roth contributions</b>: often nearly tax-free, but it only lasts as long as those accounts do."));
        if (live("r55")) T.push(row("r55", "<b>Rule of 55</b>: draw the 401(k) you left, penalty-free."));
        T.push({h:"<b>Pay the 10% penalty</b> is there to compare against: look at its <b>Penalties</b> column."});
        return T;
      }},
      {title:"What you'll have at 59½", focus:"#brAtOut", tasks(){
        return [
          {h:"The table shows each account at 59½ in an <b>Average</b> market, and in <b>Above average</b> and <b>Below average</b> ones, all real starts from history.", ok: brPath !== "avg" ? true : undefined},
          {h:"Under <b>Account balances</b>, switch to <b>Across history</b> to see the range over every start since 1926.", ok: brBalView === "hist" ? true : undefined},
          {h:"<b>Blended plan converts</b>, on the left, picks how much to convert automatically. Try <b>To the top of the 12% bracket</b> to see what converting more costs now in tax and health premiums.", ok: $("brFill").value !== thB().fill ? true : undefined},
          {h:"<b>Send to Drawdown Simulator</b> carries these balances into the years after 59½."}
        ];
      }}
    ],
    chip(){
      const L = brLast;
      if (!L) return "";
      const t = L.best.test;
      return "Holds up in<br><b>" + (t.of ? pctStr(t.hold / t.of, 0) : "—") + "</b>";
    }}
};
function thSyncBtn(){
  const b = $("toolHelpBtn");
  b.hidden = !TH_TOURS || !TH_TOURS[toolSub] || chartMode.tab !== "tools";
  b.setAttribute("aria-expanded", String(!!th && th.tool === toolSub));
}
function thOpen(tool){
  const T = TH_TOURS[tool];
  if (!T) return;
  let base = null;
  try { base = T.start ? T.start() : null; } catch(e){}
  th = {tool, page:0, min:false, base};
  $("thCoach").hidden = false;
  document.body.classList.add("gd-on");
  gdCoachSync();          // the guide's panel steps aside while help is open
  thShow(T.pages[0]);
  thFill();
  thSyncBtn();
  const f = document.querySelector(T.pages[0].focus);
  if (f) thScrollTo(f);
  const nb = $("thCoachBody").querySelector("[data-tp='1']");
  if (nb) try { nb.focus({preventScroll:true}); } catch(e){}
}
/* A part about a view that isn't showing (another of the tool's tabs)
   brings it up first. */
function thShow(pg){
  if (pg && pg.show) try { pg.show(); } catch(e){}
}
function thClose(){
  if (!th) return;
  th = null;
  $("thCoach").hidden = true;
  document.body.classList.remove("gd-on");
  thSyncBtn();
  gdCoachSync();          // and comes back, if a guide trip is under way
}
function thScrollTo(f){
  ddReveal(f);
  const r = f.getBoundingClientRect(), rail = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--navh")) || 44) + 16;
  if (r.top < rail || r.bottom > window.innerHeight - $("thCoach").offsetHeight - 16){
    let smooth = true;
    try { smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch(e){}
    try { window.scrollBy({top:r.top - rail, behavior:smooth ? "smooth" : "auto"}); } catch(e){ window.scrollBy(0, r.top - rail); }
  }
}
function thFill(){
  const el = $("thCoach");
  if (!th || el.hidden) return;
  const T = TH_TOURS[th.tool], P = T.pages, pi = Math.max(0, Math.min(P.length - 1, th.page));
  let tasks = [];
  try { tasks = P[pi].tasks(); } catch(e){}
  $("thCoachSub").textContent = "Help · " + T.name;
  $("thCoachTitle").textContent = T.title;
  $("thCoachBody").innerHTML =
    "<div class='gd-cpage'><span>Part " + (pi + 1) + " of " + P.length + "</span><b>" + P[pi].title + "</b></div>" +
    "<ol class='gd-steps'>" + tasks.map(k => "<li" + (k.ok === true ? " class='ok'" : "") + ">" + k.h + "</li>").join("") + "</ol>" +
    "<div class='gd-cnav'><button type='button' class='btn mini' data-tp='-1'" + (pi ? "" : " disabled") + "><i class='arw back' aria-hidden='true'></i>Back</button>" +
    "<span class='gd-cdots' aria-hidden='true'>" + P.map((x, i) => "<i" + (i === pi ? " class='on'" : "") + "></i>").join("") + "</span>" +
    (pi < P.length - 1 ? "<button type='button' class='btn mini primary' data-tp='1'>Next: " + P[pi + 1].title + "<i class='arw' aria-hidden='true'></i></button>" : "") + "</div>";
  let chip = "";
  try { chip = T.chip ? T.chip() || "" : ""; } catch(e){}
  $("thCoachChip").innerHTML = chip;
  // Collapsed, the panel still says which part you're on.
  $("thCoachNext").innerHTML = "<span>Part " + (pi + 1) + " of " + P.length + "</span>" + P[pi].title;
  $("thCoachNext").hidden = false;
  el.classList.toggle("min", th.min);
  const tog = $("thCoachTog"), lbl = th.min ? "Show the steps" : "Hide the steps";
  tog.setAttribute("aria-expanded", String(!th.min));
  tog.setAttribute("aria-label", lbl); tog.setAttribute("title", lbl);
  document.body.style.setProperty("--gdh", el.offsetHeight + "px");
}
let thTimer = null, thTimer2 = null;
function thLater(){
  if (!th) return;
  clearTimeout(thTimer); clearTimeout(thTimer2);
  thTimer = setTimeout(thFill, 120);
  thTimer2 = setTimeout(thFill, TWEEN_MS + 160);
}
document.addEventListener("input", thLater, true);
document.addEventListener("change", thLater, true);
document.addEventListener("click", e => {
  if (e.target.closest && e.target.closest("#thCoach")) return;
  thLater();
}, true);
window.addEventListener("resize", () => {
  if (th) document.body.style.setProperty("--gdh", $("thCoach").offsetHeight + "px");
});
$("toolHelpBtn").addEventListener("click", () => {
  if (th && th.tool === toolSub) thClose(); else thOpen(toolSub);
});
$("thCoachX").addEventListener("click", thClose);
$("thCoachDone").addEventListener("click", thClose);
$("thCoachTog").addEventListener("click", () => { if (th){ th.min = !th.min; thFill(); } });
/* On a phone the open panel and the keyboard together would bury the field
   being typed in, so starting to type in the tool folds the panel down. */
document.addEventListener("focusin", e => {
  const el = e.target;
  if (!th || th.min || !el.matches || !el.matches("input,select,textarea")) return;
  if (el.closest("#thCoach") || !window.matchMedia("(max-width:640px)").matches) return;
  th.min = true;
  thFill();
});
$("thCoachBody").addEventListener("click", e => {
  const b = e.target.closest ? e.target.closest("[data-tp]") : null;
  if (!b || !th) return;
  const P = TH_TOURS[th.tool].pages;
  th.page = Math.max(0, Math.min(P.length - 1, th.page + parseInt(b.getAttribute("data-tp"), 10)));
  thShow(P[th.page]);
  thFill();
  $("thCoachBody").scrollTop = 0;
  const f = document.querySelector(P[th.page].focus);
  if (f) thScrollTo(f);
  const nb = $("thCoachBody").querySelector("[data-tp='1']") || $("thCoachBody").querySelector("[data-tp='-1']");
  if (nb) try { nb.focus({preventScroll:true}); } catch(e2){}
});
document.addEventListener("keydown", e => {
  // A pop-up's own Escape handler runs first and claims the key.
  if (e.key === "Escape" && th && !e.defaultPrevented) thClose();
});

