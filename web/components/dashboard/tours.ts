/* The Dashboard tabs' Help: the same walkthrough as the tools' (tools/help),
   a few parts long, each part scrolling to and lighting the place it talks
   about, ticking things off as they're done. These read the plan (the
   profile and its entries), not a tool's inputs, and register themselves
   when the Dashboard's code loads, so the site's own pages never load them.
   The words follow the tools' tours: plain, for someone new to the terms. */

import { registerTours } from "@/tools/help/state";
import type { Tour } from "@/tools/help/tours";
import { money } from "./format";
import { budgetFor, flow } from "./flows";
import { hasAccounts, netWorth, readDashboard, type DashData } from "./store";

const plan = () => readDashboard();
const done = (b: boolean) => (b ? true : undefined);
const last = (s: DashData) => s.entries[s.entries.length - 1];

const accounts: Tour<DashData> = { name: "Net worth", title: "Keep track of what you own and owe", read: plan,
  start: ({ s }) => ({ entries: s.entries.length }),
  pages: [
    { title: "What it shows", focus: "#picture", tasks: () => [
      { h: "<b>Net worth</b> is everything you own less everything you owe. It's the one number that tells you whether you're moving forward over the years." },
      { h: "<b>Today</b> shows what makes it up, assets on top and debts below. <b>Over time</b> shows one column for each entry you've saved." },
    ] },
    { title: "Your accounts and debts", focus: "#assets", tasks: ({ s }) => [
      { h: "Press <b>Update balances</b> and list each account with today's balance: 401(k)s and IRAs, Roth accounts, brokerage, HSA, checking and savings, and your home if you own one.", ok: done(hasAccounts(s.entries)) },
      { h: "The <b>Type</b> matters: retirement accounts and brokerage pay for retirement, each taxed its own way; checking and savings are your emergency fund; your home counts toward net worth but isn't spent in retirement." },
      { h: "Under <b>Debts</b>, add each loan and card with its balance and <b>Interest rate</b>. Debt at 8% or more usually comes first in your next steps." },
      { h: "Rough figures are fine. Your bank's app or last statement has them; round to the nearest hundred." },
    ] },
    { title: "Come back and update", focus: "#entries", tasks: ({ s, base }) => [
      { h: "<b>Save as new entry</b> keeps today's balances as a dated entry. Come back each month or quarter and save another; the date can be set back if you're catching up.", ok: done(s.entries.length > Number(base.entries ?? 0)) },
      { h: "<b>Your entries</b> lists every one, with the change since the one before." + (last(s) ? " Your latest: <b>" + money(netWorth(last(s)!)) + "</b>." : "") },
      { h: "Saved one by mistake? The <b>×</b> at the end of its row deletes it, after asking." },
    ] },
  ],
  chip: ({ s }) => (last(s) ? "Net worth<br><b>" + money(netWorth(last(s)!)) + "</b>" : "") };

const income: Tour<DashData> = { name: "Income", title: "Everything that comes in", read: plan,
  pages: [
    { title: "Your pay", focus: "#pay", tasks: ({ s }) => [
      { h: "<b>Pay</b> for each of you, before taxes as on an offer letter, or after taxes as it reaches your bank account. Pick which with the switch beside it.", ok: done(s.profile.p1.pay != null) },
      { h: "<b>How often</b> is how the figure is given: per year, per month, every two weeks. Everything else works it out from there." },
      { h: "Your taxes, take-home pay and what you can save all come from this, on Taxes, Spending and Savings." },
    ] },
    { title: "The match and other income", focus: "#match", tasks: ({ s }) => {
      const b = budgetFor(s.profile);
      return [
        { h: "An <b>Employer 401(k) match</b> is money your employer adds when you contribute: often 50 cents or a dollar for each dollar, up to a share of your pay. Your benefits site or HR has the exact rule.", ok: done(parseFloat(b.pcMatchRate) > 0) },
        { h: "<b>Matches</b> is how much they add for each dollar you put in, and <b>On the first</b> is how much of your pay it applies to. Getting all of it is the first thing worth saving for." },
        { h: "<b>Other income</b> is anything else that comes in now, after taxes: side work, rent from a property, a pension.", ok: done(s.profile.other.length > 0) },
      ];
    } },
    { title: "Social Security", focus: "#social-security", tasks: ({ s }) => [
      { h: "Each benefit is estimated from today's pay until you give the real one. Your statement at <b>ssa.gov</b> shows your benefit at full retirement age (67 for anyone born in 1960 or later).", ok: done(s.profile.ss.checked) },
      { h: "No statement handy? <b>Estimate from my pay history</b> works it out from what you earned each year." },
      { h: "<b>Claims</b> is the age each of you starts. Claiming at 62 cuts the check for life; each year you wait past 67 adds 8%, up to 70. The same ages are on Retirement." },
    ] },
  ],
  chip: ({ s }) => { const F = flow(s.profile); return F.hasPay ? "After taxes<br><b>" + money(F.afterTax) + "/mo</b>" : ""; } };

const taxes: Tour<DashData> = { name: "Taxes", title: "How your taxes are figured", read: plan,
  pages: [
    { title: "This year", focus: "#this-year", tasks: () => [
      { h: "<b>Pay after taxes</b> is what reaches your bank account each month, after income taxes, Social Security and Medicare, and anything taken out before tax (401(k), HSA, health premiums)." },
      { h: "<b>Federal</b> and <b>State income tax</b> are worked out from your pay, filing status and state. <b>Social Security and Medicare</b> is a flat 7.65% of pay, up to a yearly limit for Social Security." },
      { h: "<b>Of your pay</b> is your effective rate: all of it divided by your pay. It's always lower than your bracket, because only your top dollars pay the top rate." },
    ] },
    { title: "Your deductions", focus: "#asideTax", tasks: () => [
      { h: "Pay comes from Income, and what goes to your 401(k), HSA and health premiums from Savings. Change those there; they lower your taxes here." },
      { h: "<b>Deduction</b>: most people take the <b>Standard deduction</b>, a flat amount of income that's never taxed. Pick <b>Itemized</b> only if mortgage interest, state and local taxes and gifts to charity add up to more." },
    ] },
    { title: "Reading the result", focus: "#txBrackets", tasks: () => [
      { h: "Income is taxed in layers. <b>Federal brackets</b> shows each band: only the dollars inside a band pay its rate. A raise into a higher bracket never lowers what you take home." },
      { h: "Your <b>marginal rate</b> is the rate on your next dollar. It's the one that matters for decisions: a $1,000 traditional 401(k) contribution at 22% saves $220 of tax." },
    ] },
  ],
  chip: ({ s }) => { const F = flow(s.profile); return F.tax ? "Taxes<br><b>" + money(F.tax.total) + "/yr</b>" : ""; } };

const spending: Tour<DashData> = { name: "Spending", title: "Build a budget that works", read: plan,
  pages: [
    { title: "Each month", focus: "#month", tasks: () => [
      { h: "<b>Spending</b> is your budget's total, per month and per year. Everything on your dashboard that needs what you spend uses it." },
      { h: "<b>Left after spending</b> is pay after taxes less your spending. Your saving comes out of it, on Savings." },
      { h: "The <b>Emergency fund</b> goal is a number of months of spending kept in cash: about 6 suits most people, up to 12 if your income varies." },
    ] },
    { title: "Your budget", focus: "#bgList", tasks: ({ s }) => {
      const lines = (budgetFor(s.profile).rows ?? []).filter((r) => parseFloat(String(r.amount).replace(/,/g, "")) > 0).length;
      return [
        { h: "Open your last two or three months of bank and card statements and work down the list. Rough is fine; a guess beats a blank.", ok: done(lines >= 5) },
        { h: "For bills that come once or twice a year, like car insurance, travel, gifts or repairs, tap <b>/yr</b> on the line and enter the yearly total. They're the ones budgets usually forget." },
        { h: "Click a line's name to rename it, <b>+</b> on a group adds a line, and <b>×</b> removes one you don't need." },
      ];
    } },
    { title: "Where it goes", focus: "#bgWhere", tasks: () => [
      { h: "<b>Where it goes</b> groups your spending, so the biggest pieces stand out. Housing, transportation and food are usually the three to look at first." },
      { h: "Planning to help with college? Saving ahead for it here, with <b>Add it to my budget</b>, keeps it from coming out of your retirement saving later." },
    ] },
  ],
  chip: ({ s }) => { const F = flow(s.profile); return F.spend > 0 ? "Spending<br><b>" + money(F.spend) + "/mo</b>" : ""; } };

const savings: Tour<DashData> = { name: "Savings", title: "Give every dollar a place", read: plan,
  pages: [
    { title: "Each month", focus: "#month", tasks: () => [
      { h: "<b>You save and invest</b> is what goes into your accounts each month, and <b>Employer match</b> what your employer adds on top." },
      { h: "<b>Not assigned</b> is what's left after taxes, spending and saving. It sits in checking earning nothing; giving it a place below raises your plan." },
      { h: "<b>Savings rate, with the match</b> is all of it as a share of your pay before taxes. Around 15% is a common goal." },
    ] },
    { title: "Where the rest goes", focus: "#pcSliders", tasks: ({ s }) => {
      const F = flow(s.profile);
      return [
        { h: "Each slider is an account, in the order most people fill them: the 401(k) up to the match first, then an HSA, an IRA, more 401(k), then a brokerage account.", ok: done(F.invested > 0) },
        { h: "<b>Traditional</b> lowers your taxes now and is taxed when you take it out; <b>Roth</b> is taxed now and comes out tax-free. Lower earners often favor Roth, higher earners traditional." },
        { h: "<b>Max</b> fills a line to its legal limit for the year. A line you can't reach the limit on is fine; anything helps." },
        { h: "<b>Start from a plan</b> sets every slider at once: <b>The usual order</b>, <b>Max tax breaks</b> or <b>Stay flexible</b>. Drag from there." },
      ];
    } },
    { title: "How your saving grows", focus: "#growth", tasks: () => [
      { h: "Many people save more as their pay grows. <b>Set by account</b> lets each line rise by a share each year, beyond inflation, until it reaches its limit." },
      { h: "Your plan counts that rise when it projects your savings, on the Calculator and at retirement." },
    ] },
  ],
  chip: ({ s }) => { const F = flow(s.profile); return F.hasPay ? "Saving<br><b>" + money(F.invested + F.match) + "/mo</b>" : ""; } };

const calculator: Tour<DashData> = { name: "Calculator", title: "How your savings grow to retirement", read: plan,
  pages: [
    { title: "Your stages", focus: "#gStages", tasks: () => [
      { h: "The Calculator follows your saving year by year until you retire. Each <b>stage</b> is a stretch of years when you save about the same: a child arriving, college, or a line reaching its limit each start a new one." },
      { h: "<b>Edit stages</b> opens them one by one: what goes in each month, how fast it grows and for how many years. They come from your plan, so they already match Income, Spending and Savings." },
      { h: "Everything you change here is saved to your plan: fees, returns, the stages themselves. Children's costs, and which accounts give up the money for them, change everywhere they're used. <b>Use the plan's figures</b>, at the top, puts the rest back." },
    ] },
    { title: "Your accounts", focus: "#saFields", tasks: () => [
      { h: "Today's balances by account, from your latest entry on Net worth: <b>Traditional</b> (taxed when it comes out), <b>Roth</b> (tax-free), <b>Brokerage</b> and <b>HSA</b>." },
      { h: "<b>Salary</b> and the <b>match</b> come from Income. With them the Calculator splits each stage's saving between accounts, the way your paycheck does." },
    ] },
    { title: "What you'll have", focus: "#xFVreal", tasks: () => [
      { h: "This is what you'll have saved when you retire, in today's dollars. It's your plan's savings at retirement everywhere: Retirement, the chance of success and the overview all start from it." },
      { h: "<b>In today's dollars</b> takes inflation out, so it compares with what things cost now. The larger figure beside it is the same money in future dollars." },
    ] },
  ],
  chip: () => "" };

const retirement: Tour<DashData> = { name: "Retirement", title: "Make your savings last", read: plan,
  start: ({ s }) => ({ strategy: s.profile.strategy }),
  pages: [
    { title: "At retirement", focus: "#at-retirement", tasks: () => [
      { h: "<b>Savings</b> is what your plan has when you retire. <b>Chance of success</b> is how often it lasted to 95 when retirement started in each month since 1926." },
      { h: "<b>You plan to spend</b> is your spending once retired, before taxes; <b>Taxes, on top</b> is the plan's average year. <b>Social Security</b> pays part of both once it starts." },
      { h: "Each person's claiming age is here too, the same as on Income. Waiting longer means a bigger check for life." },
    ] },
    { title: "Choose a strategy", focus: "#strategies", tasks: ({ s, base }) => [
      { h: "A <b>withdrawal strategy</b> is the rule for how much you take out each year. Some keep spending steady whatever markets do; others adjust with them to make the money last." },
      { h: "Open <b>The withdrawal strategies</b> to read each one, and <b>Use this one</b> to make it your plan's.", ok: done(s.profile.strategy !== base.strategy && s.profile.strategy != null) },
      { h: "<b>How the withdrawal strategies compare</b> lays them side by side on your own numbers." },
    ] },
    { title: "Try it in the simulator", focus: "#ddRate", tasks: ({ s }) => [
      { h: "The simulator runs your plan through every market since 1926. Its <b>Portfolio value</b> is your savings at retirement from the Calculator; change that there. Everything else you change here is saved to your plan." },
      { h: "<b>Starting withdrawal rate</b> is the share of your savings the first year takes, taxes included. Change it and your plan spends what that rate gives; Profile's spending stays as your goal.", ok: done(s.profile.ddOwn?.rate != null) },
      { h: "Around 4% has lasted through almost every market in history for a 30-year retirement. A longer retirement, or a strategy that never cuts, needs a lower rate." },
      { h: "Changed your mind? <b>Use the plan's figures</b>, above the simulator, puts them all back." },
    ] },
  ],
  chip: () => "" };

/* Retiring before 59½: the same walk-through, with the switch at the top
   and the bridge to 59½ first. */
const retirementEarly: Tour<DashData> = { name: "Retirement", title: "Retire early and make your savings last", read: plan,
  start: ({ s }) => ({ strategy: s.profile.strategy, bridge: !!s.profile.bridge }),
  pages: [
    retirement.pages[0],
    { title: "Drawdown or early retirement", focus: "#retSide", tasks: () => [
      { h: "You retire before 59½, so this tab has two sides. <b>Early retirement</b> plans the years until 401(k)s and IRAs open without the 10% penalty; <b>Drawdown</b> plans the rest of retirement, from your savings at retirement." },
      { h: "Switch between them here at the top. The next pages are on the <b>Drawdown</b> side: choosing a strategy and the simulator. Each side is saved to your plan as you change it." },
    ] },
    { title: "Your bridge to 59½", focus: "#bridge || #retSide", tasks: ({ s }) => [
      { h: "On the <b>Early retirement</b> side, the Early Retirement Bridge runs on your plan: the age you retire, what you'll spend, and what each account holds when you get there." },
      { h: "It tries each way to pay for the bridge years (brokerage first, Roth contributions, the rule of 55, 72(t) payments, a Roth conversion ladder) and shows how often each lasted to 59½ in past markets, and what it costs in taxes, penalties and health cover." },
      { h: "When it looks right, <b>Use this bridge plan</b> makes it your plan's. Until then, part of your readiness score is held back.", ok: done(!!s.profile.bridge) },
    ] },
    { ...retirement.pages[1], focus: "#strategies || #retSide" },
    { ...retirement.pages[2], focus: "#ddRate || #retSide" },
  ],
  chip: () => "" };

registerTours({ "dsh-retirement-early": retirementEarly, "dsh-accounts": accounts, "dsh-income": income, "dsh-taxes": taxes, "dsh-spending": spending, "dsh-savings": savings, "dsh-calculator": calculator, "dsh-retirement": retirement } as Record<string, Tour<DashData>>);
export const TAB_TOURS = { accounts: "dsh-accounts", income: "dsh-income", taxes: "dsh-taxes", spending: "dsh-spending", savings: "dsh-savings", calculator: "dsh-calculator", retirement: "dsh-retirement" } as Record<string, string>;

