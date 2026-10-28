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
      { h: "The <b>Type</b> matters: retirement accounts and brokerage pay for retirement, each taxed its own way; checking and savings are your emergency fund; your home counts toward net worth but isn't spent in retirement. A 457(b) is its own type, since it can be drawn from without the 10% penalty once you leave that job." },
      { h: "A couple says <b>Whose</b> each retirement account is: each opens without the penalty at its owner's 59½. It's guessed from the name, and <b>Not sure</b> counts it half each." },
      { h: "<b>What you put in</b> is optional: a brokerage account's <b>cost basis</b> (only the gain above it is taxed when you sell) and a Roth's <b>own contributions</b> (they can come out any time). Your brokerage and Roth statements show them. Once saved, a brokerage row shows its gain or loss in green or red." },
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
      { h: "Your taxes, take-home pay and what you can save all come from this, on Spending and Taxes & Savings." },
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
      { h: "<b>Claims</b> is the age each of you starts. Claiming at 62 cuts the check for life; each year you wait past 67 adds 8%, up to 70. They're set only here, and Retirement uses them." },
      { h: "<b>Share of the benefit you expect</b> plans for cuts: Social Security's trust fund is projected to run short in the 2030s, and benefits could then be cut to roughly 80%. Set it lower than 100% and every benefit in your plan is scaled by it.", ok: done(s.profile.ss.pct != null && s.profile.ss.pct < 100) },
    ] },
  ],
  chip: ({ s }) => { const F = flow(s.profile); return F.hasPay ? "After taxes<br><b>" + money(F.afterTax) + "/mo</b>" : ""; } };

const spending: Tour<DashData> = { name: "Spending", title: "Build a budget that works", read: plan,
  pages: [
    { title: "Each month", focus: "#month", tasks: () => [
      { h: "<b>Spending</b> is your budget's total, per month and per year. Everything on your dashboard that needs what you spend uses it." },
      { h: "<b>Left after spending</b> is pay after taxes less your spending. Your saving comes out of it, on Taxes & Savings." },
      { h: "The <b>Emergency fund</b> goal is a number of months of spending kept in cash: about 6 suits most people, up to 12 if your income varies." },
    ] },
    { title: "Your budget", focus: "#bgList", tasks: ({ s }) => {
      const lines = (budgetFor(s.profile).rows ?? []).filter((r) => parseFloat(String(r.amount).replace(/,/g, "")) > 0).length;
      return [
        { h: "Open your last two or three months of bank and card statements and work down the list. Rough is fine; a guess beats a blank.", ok: done(lines >= 5) },
        { h: "For bills that come once or twice a year, like car insurance, travel, gifts or repairs, tap <b>/yr</b> on the line and enter the yearly total. They're the ones budgets usually forget." },
        { h: "Click a line's name to rename it, <b>+</b> on a group adds a line, and <b>×</b> removes one you don't need." },
        { h: "Lines marked <b>from Home</b> are your rent, or your mortgage and what owning costs. They're set on Home, so they're the same everywhere." },
      ];
    } },
    { title: "Where it goes", focus: "#bgWhere", tasks: () => [
      { h: "<b>Where it goes</b> groups your spending, so the biggest pieces stand out. Housing, transportation and food are usually the three to look at first." },
      { h: "Planning to help with college? Saving ahead for it here, with <b>Add it to my budget</b>, keeps it from coming out of your retirement saving later." },
    ] },
  ],
  chip: ({ s }) => { const F = flow(s.profile); return F.spend > 0 ? "Spending<br><b>" + money(F.spend) + "/mo</b>" : ""; } };

const savings: Tour<DashData> = { name: "Taxes & Savings", title: "Your taxes, and a place for every dollar", read: plan,
  pages: [
    { title: "Taxes this year", focus: "#taxes", tasks: () => [
      { h: "<b>Pay after taxes</b> is what reaches your bank account each month, after income taxes, Social Security and Medicare, and anything taken out before tax (401(k), HSA, health premiums)." },
      { h: "<b>Federal</b> and <b>State income tax</b> are worked out from your pay, filing status and state, the same way your paycheck below figures them. <b>Social Security and Medicare</b> is a flat 7.65% of pay, up to a yearly limit for Social Security. <b>Of your pay</b> is all of it as a share of your pay." },
    ] },
    { title: "Your deduction", focus: "#taxChoices", tasks: ({ s }) => [
      { h: "<b>Deduction</b>, with your paycheck's other inputs: most people take the <b>standard deduction</b>, a flat amount of income that's never taxed. Pick <b>Itemized</b> only if mortgage interest, state and local taxes and gifts to charity add up to more.", ok: done(s.profile.tools.tax != null) },
      { h: "Live where cities or counties tax income too? A <b>Local income tax</b> field shows up for your state, with where to look your rate up." },
    ] },
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
    { title: "Changes ahead", focus: "#btnAddScenario", tasks: () => [
      { h: "A <b>change</b> is something you see coming: saving more or less from an age on, a lump sum put in or taken out, a different return, and your children. Each row shows what it does to your savings at retirement; switch one off to see your plan without it." },
      { h: "<b>Add a change</b> picks a kind and asks for a name, ages and amounts, in today's dollars, with the effect shown as you type. <b>View or edit</b> opens the big view: the chart, each change across your ages, and every one with its words, Edit and Remove. A change that takes more than you save, or more than an account holds that day, can't be kept." },
      { h: "The changes are saved to your plan, so Retirement, the chance of success and the overview all follow them. Children's costs, and which accounts give up the money for them, are edited from their row. <b>Use the plan's figures</b>, at the top, puts fees and the other settings back." },
    ] },
    { title: "The stages behind this", focus: "#btnStagesBehind", tasks: () => [
      { h: "Your plan and the changes ahead, year by year, become <b>stages</b>: stretches of years when you save about the same. A child arriving, college, a line reaching its limit or a change starting each begins a new one." },
      { h: "<b>See the stages</b> lists them by age: what goes into each account a month, how fast it rises after inflation, the return, any lump sum on the stage's first day, and what's going on. They're read, not edited: change one of the changes ahead to change them." },
    ] },
    { title: "Your savings", focus: "#calcFacts", tasks: () => [
      { h: "Today's balances by account come from your latest entry on Net worth: <b>Traditional</b> (taxed when it comes out), <b>Roth</b> (tax-free), <b>Brokerage</b> with its cost basis, and <b>HSA</b>." },
      { h: "Pay and the match come from Income, and filing status, state and inflation from Profile. They're listed here rather than typed, so they're the same everywhere: change them where they're set." },
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
      { h: "<b>You plan to spend</b> is your spending once retired, before taxes; <b>Taxes, on top</b> is the plan's average year. <b>Social Security</b> pays part of both once it starts; the ages you claim are set on Income." },
      { h: "Under it, switch what the page shows: <b>Drawdown</b> (how you spend your savings), <b>Bridge to 59½</b> if you retire before then, and <b>Health cover</b> until and after Medicare." },
    ] },
    { title: "Choose a strategy", focus: "#strategies", tasks: ({ s, base }) => [
      { h: "A <b>withdrawal strategy</b> is the rule for how much you take out each year. Some keep spending steady whatever markets do; others adjust with them to make the money last." },
      { h: "Open <b>The withdrawal strategies</b> to read each one, and <b>Use this one</b> to make it your plan's.", ok: done(s.profile.strategy !== base.strategy && s.profile.strategy != null) },
      { h: "<b>How the withdrawal strategies compare</b> lays them side by side on your own numbers." },
    ] },
    { title: "Try it in the simulator", focus: "#ddRate", tasks: ({ s }) => [
      { h: "The simulator runs your plan through every market since 1926. Your savings at retirement (from the Calculator), the retirement age and Social Security are listed at the top of its inputs and in <b>Income in retirement</b>; change them where they're set. The mix, the years, the starting rate and the strategy's settings are yours here, saved to your plan." },
      { h: "<b>Asset mix</b> is how your savings are invested once retired: US stocks, small-cap value, bonds and cash, and whether the stocks glide down over the years. It's your plan's mix everywhere." },
      { h: "<b>Starting withdrawal rate</b> is the share of your savings the first year takes, taxes included. Change it and your plan spends what that rate gives; Profile's spending stays as your goal.", ok: done(s.profile.ddOwn?.rate != null) },
      { h: "Around 4% has lasted through almost every market in history for a 30-year retirement. A longer retirement, or a strategy that never cuts, needs a lower rate." },
      { h: "Changed your mind? <b>Use the plan's figures</b>, above the simulator, puts them all back." },
    ] },
  ],
  chip: () => "" };

/* Retiring before 59½: the same walk-through, with the switch and the
   bridge to 59½ first. */
const retirementEarly: Tour<DashData> = { name: "Retirement", title: "Retire early and make your savings last", read: plan,
  start: ({ s }) => ({ strategy: s.profile.strategy, bridge: !!s.profile.bridge }),
  pages: [
    retirement.pages[0],
    { title: "Drawdown or the bridge", focus: "#retSide", tasks: () => [
      { h: "You retire before 59½, so this tab has a <b>Bridge to 59½</b> as well: the years until 401(k)s and IRAs open without the 10% penalty. <b>Drawdown</b> plans the rest of retirement, from your savings at retirement." },
      { h: "Switch between them here, under At retirement. The next pages are on the <b>Drawdown</b> side: choosing a strategy and the simulator. Each side is saved to your plan as you change it." },
    ] },
    { title: "Your bridge to 59½", focus: "#bridge || #retSide", tasks: ({ s }) => [
      { h: "On the <b>Bridge to 59½</b> side, the Early Retirement Bridge runs on your plan: the age you retire, what you'll spend, what each account holds when you get there, your mix, and a partner's pay while they keep working. They're listed at the top of its inputs." },
      { h: "It tries each way to pay for the bridge years (brokerage first, Roth contributions, the rule of 55, 72(t) payments, a Roth conversion ladder) and shows how often each lasted to 59½ in past markets, and what it costs in taxes, penalties and health cover." },
      { h: "When it looks right, <b>Use this bridge plan</b> makes it your plan's. Until then, part of your readiness score is held back.", ok: done(!!s.profile.bridge) },
    ] },
    { ...retirement.pages[1], focus: "#strategies || #retSide" },
    { ...retirement.pages[2], focus: "#ddRate || #retSide" },
  ],
  chip: () => "" };

/* Health cover: the Healthcare Cost Planner on the plan. */
const health: Tour<DashData> = { name: "Health cover", title: "Health cover until and after Medicare", read: plan,
  pages: [
    { title: "Before Medicare", focus: "#health", tasks: () => [
      { h: "A job's health plan ends when work does. Anyone under 65 then needs cover of their own until Medicare starts: a <b>marketplace (ACA) plan</b>, with a subsidy that depends on your income." },
      { h: "Your plan already counts these premiums on top of your spending, year by year. Retiring before 59½, the bridge counts them for those years too." },
    ] },
    { title: "From your plan", focus: "#hcFacts", tasks: () => [
      { h: "The ages, household, state and income come from your plan: income is what your withdrawals, Social Security and any conversions give that year. Change them where they're set." },
      { h: "Have a real quote from <b>healthcare.gov</b>? Type it as the <b>ACA benchmark premium</b> for a closer figure. It's kept with your plan." },
    ] },
    { title: "Reading it", focus: "#hcReading", tasks: () => [
      { h: "The subsidy shrinks as income rises and stops at 400% of the poverty line, so a little more income there can cost the whole credit. Roth conversions and capital gains count." },
      { h: "From 65, <b>Medicare</b>: Part B, a drug plan and usually a supplement. Higher incomes pay more (IRMAA), based on income two years before." },
    ] },
  ],
  chip: () => "" };

/* Home: the mortgage and what owning costs, or the rent. */
const home: Tour<DashData> = { name: "Home", title: "What your home costs", read: plan,
  pages: [
    { title: "Your mortgage", focus: "#mortgage || #rentbuy", tasks: ({ s }) => [
      { h: "What your home is worth and what's left on the mortgage come from Net worth. Here, give the mortgage's <b>interest rate</b> and its <b>payment</b> (principal and interest only); that gives when it's paid off.", ok: done(s.profile.mortPay != null || s.profile.home === "rent") },
      { h: "Once it's paid off before you retire, and you haven't set your spending once retired yourself, your plan leaves the payment out of retirement spending." },
    ] },
    { title: "What owning costs", focus: "#owning || #rentbuy", tasks: ({ s }) => [
      { h: "The Mortgage Calculator on your own loan. Set <b>property tax</b>, <b>insurance</b>, <b>PMI</b>, <b>HOA</b>, <b>maintenance</b> and <b>utilities</b>: they become your budget's housing lines on Spending.", ok: done(!!s.profile.homeCosts) },
      { h: "Try <b>extra payments</b> or a <b>refinance</b> to see how much sooner it's paid off, and the interest saved." },
      { h: "Renting? Your rent and renter's insurance are your budget's lines instead, and the Rent vs. Buy Calculator starts from your rent." },
    ] },
  ],
  chip: () => "" };

registerTours({ "dsh-retirement-early": retirementEarly, "dsh-retirement-health": health, "dsh-home": home, "dsh-accounts": accounts, "dsh-income": income, "dsh-spending": spending, "dsh-savings": savings, "dsh-calculator": calculator, "dsh-retirement": retirement } as Record<string, Tour<DashData>>);
export const TAB_TOURS = { accounts: "dsh-accounts", home: "dsh-home", income: "dsh-income", spending: "dsh-spending", savings: "dsh-savings", calculator: "dsh-calculator", retirement: "dsh-retirement" } as Record<string, string>;

