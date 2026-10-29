"use client";

/* About, inside the Dashboard: laid out like the site's About page
   (tools/about/About.tsx), a reading column with a sticky index beside it
   from 1100px, groups of sections folded to their headings, and the same
   fine print. It says how the dashboard works, then the Calculator, the
   tools and the methods behind them, in the site's own words (copied from
   its About, with what's different here said where it is). The site's own
   settings, scenarios and walkthroughs aren't part of the dashboard, so
   they're left out. */

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { ChevronDownIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FinePrint } from "./FinePrint";
import { Frame } from "./Frame";

/* The sections, in reading order. Each section's id is "about-" + its key,
   so /dashboard/about#about-networth opens that one. */
const GROUPS = [
  { key: "works", label: "How the dashboard works", sections: [["profile", "One profile behind every tab"], ["networth", "Net worth and its history"], ["home", "Home"], ["paycheck", "Income, Spending, and Taxes & Savings"], ["retire", "Retirement, the bridge and health cover"], ["assume", "What the plan assumes"], ["tools", "Tools opened here"], ["saved", "What's saved to your account"]] },
  { key: "calc", label: "Calculator", sections: [["calculator", "Calculator"], ["projection", "How the projection works"]] },
  { key: "retirement", label: "Retirement income", sections: [["optimizer", "Retirement Plan Optimizer"], ["drawdown", "Drawdown Simulator"], ["social", "Social Security Calculator"], ["bridge", "Early Retirement Bridge"], ["roth", "Roth Conversion Calculator"], ["healthcare", "Healthcare Cost Planner"]] },
  { key: "saving", label: "Saving and investing", sections: [["fire", "FIRE Calculator"], ["backtest", "Portfolio Backtest"], ["college", "College Savings"], ["rentbuy", "Rent vs. Buy"]] },
  { key: "everyday", label: "Everyday money", sections: [["tax", "Income Tax"], ["budget", "Budget"], ["debt", "Debt Payoff"], ["mortgage", "Mortgage Calculator"]] },
  { key: "methods", label: "Methods", sections: [["historical", "Historical"], ["montecarlo", "Monte Carlo"], ["data", "Where the numbers come from"]] },
] as const;
type GroupKey = (typeof GROUPS)[number]["key"];
type SectionKey = (typeof GROUPS)[number]["sections"][number][0];
const TITLE = Object.fromEntries(GROUPS.flatMap((g): readonly (readonly [string, string])[] => g.sections)) as Record<SectionKey, string>;
const LABEL = Object.fromEntries(GROUPS.map((g) => [g.key, g.label])) as Record<GroupKey, string>;

/* Which sections are open, shared by the sections and the index. */
const OpenCtx = createContext<{ open: Partial<Record<SectionKey, boolean>>; set: (k: SectionKey, v: boolean) => void }>({ open: {}, set: () => {} });

/** A group: its eyebrow heading over one panel of hairline-divided rows. */
function Group({ id, children }: { id: GroupKey; children: ReactNode }) {
  return (
    <section className="about-group" id={"about-" + id} aria-labelledby={"about-" + id + "-h"}>
      <h2 className="toolgroup-h" id={"about-" + id + "-h"}>{LABEL[id]}</h2>
      <Card size="flush">
        <div className="divide-y divide-border overflow-hidden rounded-(--r-panel)">{children}</div>
      </Card>
    </section>
  );
}

/** A section, closed to its heading until opened; the browser's find opens it too. */
function Section({ id, children }: { id: SectionKey; children: ReactNode }) {
  const { open, set } = useContext(OpenCtx);
  return (
    <Collapsible id={"about-" + id} open={!!open[id]} onOpenChange={(v) => set(id, v)}>
      <h3 className="m-0">
        <CollapsibleTrigger variant="row">{TITLE[id]}<ChevronDownIcon aria-hidden="true" /></CollapsibleTrigger>
      </h3>
      <CollapsibleContent variant="reveal" hiddenUntilFound>
        <div className="about px-4.5 pt-1 pb-6">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** The index beside the text from 1100px. A link to a section opens it. */
function Index() {
  const { set } = useContext(OpenCtx);
  const link = "block min-h-6 rounded-sm py-0.5 text-note text-muted-foreground no-underline hover:text-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring";
  return (
    <nav className="about-index" aria-label="On this page">
      <a className={link} href="#about-what">What this is</a>
      {GROUPS.map((g) => (
        <div key={g.key} className="mt-4">
          <a className="toolgroup-h about-index-h" href={"#about-" + g.key}>{g.label}</a>
          {g.sections.map(([k, t]) => (
            <a key={k} className={link} href={"#about-" + k} onClick={() => set(k, true)}>{t}</a>
          ))}
        </div>
      ))}
      <div className="mt-4">
        <a className="toolgroup-h about-index-h" href="#about-fineprint">Fine print</a>
        <a className={link} href="#about-who">Who makes this</a>
        <a className={link} href="#about-contact">Contact</a>
        <a className={link} href="#disclaimer">Disclaimer</a>
      </div>
    </nav>
  );
}

export function About() {
  const [open, setOpen] = useState<Partial<Record<SectionKey, boolean>>>({});
  const set = useCallback((k: SectionKey, v: boolean) => setOpen((o) => ({ ...o, [k]: v })), []);
  // A link to a section opens it, on arrival and after.
  useEffect(() => {
    const fromHash = () => {
      const k = window.location.hash.replace(/^#about-/, "");
      if (k in TITLE) {
        set(k as SectionKey, true);
        requestAnimationFrame(() => document.getElementById("about-" + k)?.scrollIntoView());
      }
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [set]);
  return (
    <Frame current="about" title="About" sub="How your dashboard works, what it assumes, and the fine print">
      <OpenCtx.Provider value={{ open, set }}>
        <div className="dsh-about" id="tab-about">
          <div className="about-layout">
            <Index />
            <div className="about-main">
              <Card id="about-what">
                <CardHeader><CardTitle>What this is</CardTitle></CardHeader>
                <CardContent><div className="about">
                  <p>Your dashboard keeps your whole financial picture in one place and turns it
                  into one plan for retirement.</p>
                  <p>Each tab looks at one part of it: what you have and owe, what you earn, what
                  you pay in taxes, what you spend and what you save. <b>Retirement</b> and{" "}
                  <b>Calculator</b> show where it all leads, and <b>Next steps</b> lists what to
                  do about it.</p>
                  <p>It&apos;s yours alone. It&apos;s saved to your account, and nothing in it changes
                  the rest of RetCalc.</p>
                </div></CardContent>
              </Card>

              <Group id="works">
                <Section id="profile">
                  <p>Setup asks for the basics once: your household and ages, your children
                  (including any you plan to have), when you want to retire, where you live, your
                  pay, savings and spending, and your home.</p>
                  <p>Every tab reads from that one profile. Change a number in one place and every
                  tab that uses it follows.</p>
                  <p><b>Each figure is set in one place</b>, where that part of the plan is made:
                  your ages and retirement age in Profile, pay and Social Security on Income,
                  balances on Net worth, what your home costs on Home. Later tabs list those
                  figures instead of letting you type them, with a link to where each is set, so
                  two tabs can never disagree.</p>
                  <ul>
                    <li><b>Profile</b> shows every answer on one page, each one editable where it
                    stands.</li>
                    <li>A dot on a tab means it still has something to fill in.</li>
                  </ul>
                </Section>
                <Section id="networth">
                  <p><b>Net worth</b> lists what you have and what you owe, account by account.</p>
                  <ul>
                    <li>It&apos;s read-only until you press <b>Update balances</b>.</li>
                    <li>For a brokerage account you can add its <b>cost basis</b>, what you paid
                    for what&apos;s in it, and for a Roth <b>your own contributions</b>. Both are
                    optional. Once saved, the row shows the gain or loss beside the amount. The
                    plan uses them for the tax on brokerage sales and for what can come out of a
                    Roth before 59½; left out, it estimates them.</li>
                    <li>A <b>457(b)</b> is its own type: it can be drawn from without the 10%
                    penalty once you leave that job, which matters for retiring early.</li>
                    <li>For a couple, each retirement account says <b>whose</b> it is, since each
                    opens without the penalty at its owner&apos;s 59½. It&apos;s guessed from the
                    name (&ldquo;Sam&apos;s 401(k)&rdquo;); one you&apos;re not sure of counts half
                    each. Brokerage, cash and the home are shared.</li>
                    <li><b>Save as new entry</b> records it with today&apos;s date. One entry per day:
                    saving again the same day replaces that day&apos;s entry.</li>
                    <li>Each entry is a point in your net worth history, so the chart grows as you
                    update it.</li>
                    <li>The plan always starts from your latest entry.</li>
                  </ul>
                </Section>
                <Section id="home">
                  <p><b>Owning:</b> what the home is worth and what&apos;s owed come from Net worth.
                  On Home you give the mortgage&apos;s interest rate and its payment (principal and
                  interest), which gives when it&apos;s paid off, and the Mortgage Calculator runs on
                  your own loan. There you set what owning costs beyond the loan: property tax,
                  insurance, PMI, HOA, maintenance and utilities, and try extra payments or a
                  refinance.</p>
                  <p><b>Renting:</b> your rent and renter&apos;s insurance, with the Rent vs. Buy
                  Calculator starting from your rent.</p>
                  <ul>
                    <li>Either way, those costs are your budget&apos;s housing lines on
                    <b> Spending</b>, marked &ldquo;from Home&rdquo; and changed on Home.</li>
                    <li>The first time you set what owning costs, a budget that&apos;s still
                    setup&apos;s one number gives up what the new lines count, so your spending stays
                    what you said it was.</li>
                    <li>If the mortgage is paid off before you retire and you haven&apos;t set your
                    spending once retired yourself, the plan leaves the payment out of it. Paid
                    off later, it keeps counting it.</li>
                  </ul>
                </Section>
                <Section id="paycheck">
                  <p>These three tabs follow one paycheck, in order.</p>
                  <dl className="gloss">
                    <dt>Income</dt>
                    <dd>Each person&apos;s pay, the employer&apos;s 401(k) match (X% on the first Y% of
                    pay), other income, and Social Security: estimated from your pay, typed from
                    your statement, or worked out from your pay history.</dd>
                    <dt>Spending</dt>
                    <dd>Your budget, line by line. Setup&apos;s one number starts it as one line;
                    its total is your spending everywhere. Housing lines come from Home. Your
                    emergency fund is sized here, in months of spending or of a leaner
                    emergency budget.</dd>
                    <dt>Taxes &amp; Savings</dt>
                    <dd>The year&apos;s taxes on your pay: federal, state, Social Security and
                    Medicare, and a local income tax where your state has them. Choose the
                    standard deduction or itemize with your paycheck&apos;s inputs. Then where the rest goes: your 401(k) up
                    to the match, HSA, IRA, 401(k) beyond the match, brokerage and emergency
                    fund. Each line can grow each year beyond inflation, and stops growing at
                    its contribution limit.</dd>
                  </dl>
                  <p><b>The paycheck is the one tax calculator.</b> Its taxes are your pay after
                  taxes everywhere on the dashboard, and pre-tax saving lowers them: move a
                  401(k) or HSA slider and the taxes above it change with it.</p>
                  <p><b>Social Security</b> is on Income too: each benefit, the age each of you
                  claims, and the share of the benefit you expect (100% unless you plan for
                  cuts; every benefit in the plan is scaled by it).</p>
                </Section>
                <Section id="retire">
                  <p><b>Retirement</b> starts with what you&apos;ll have when you retire, then
                  switches between up to three views.</p>
                  <dl className="gloss">
                    <dt>Drawdown</dt>
                    <dd>The Drawdown Simulator on your plan. Your savings at retirement (the
                    Calculator&apos;s result), your retirement age and your Social Security are
                    listed, not typed: change them where they&apos;re set. The withdrawal strategy
                    and its settings, the years in retirement, the starting rate and your mix
                    once retired are chosen here and saved to your plan.</dd>
                    <dt>Bridge to 59½</dt>
                    <dd>Only when one of you retires before 59½. The Early Retirement Bridge
                    runs on your plan&apos;s ages, filing status, state, spending, what each
                    account holds at retirement, your mix and your household. If your partner
                    keeps working, their pay counts until they retire, and their job&apos;s health
                    plan covers you both. How you fill the bridge, 72(t), health cover and any
                    part-time work are your choices. The bridge runs to the early
                    retiree&apos;s 59½, and each of your traditional accounts opens at its own
                    owner&apos;s 59½: a partner older than the early retiree has theirs open
                    partway through.</dd>
                    <dt>Health cover</dt>
                    <dd>The Healthcare Cost Planner on your plan: the year work stops, your ages
                    then, your household, and the income your plan gives that year and at 65.
                    If anyone is under 65 once the last paycheck stops, the years until Medicare
                    are called out here, on Plan summary and in Next steps.</dd>
                  </dl>
                </Section>
                <Section id="assume">
                  <ul>
                    <li><b>Before you retire</b>, savings grow at a steady rate: your growth per
                    year less inflation. Both are set in Profile.</li>
                    <li><b>Once you retire</b>, the plan runs through every market since 1926
                    instead, invested in your mix once retired: US stocks, small-cap value, bonds
                    and cash, gliding toward fewer stocks over the years if you choose. It&apos;s set
                    in the Retirement simulator.</li>
                    <li><b>When you two stop work at different times</b>, the plan follows both.
                    A partner who stops first stops saving through work that year. A partner
                    who keeps working after you retire brings in their pay, taxed as wages, keeps
                    saving through work, and their job&apos;s health plan covers you both until
                    they stop.</li>
                    <li><b>Taxes and health premiums come on top of your spending</b> once you
                    retire: a marketplace plan priced on your income until Medicare at 65, then
                    Medicare&apos;s premiums.</li>
                    <li><b>Everything is in today&apos;s dollars.</b></li>
                    <li><b>Children</b> cost what families typically spend on a child at each age,
                    plus childcare where you live. A second or later child costs a share of the
                    first. These costs come out of saving in the years they run, from the
                    accounts you choose in <b>How you cover it</b> (in Profile, or the
                    Calculator&apos;s children row). Where you haven&apos;t chosen, they come
                    out of the brokerage first, then the 401(k) beyond the match, the IRA and
                    the HSA, and the 401(k) up to the match last, so the match is kept as long
                    as it can be. A cut from pre-tax saving is taxed as pay again, so it&apos;s
                    cut far enough to cover the cost after that tax.</li>
                    <li><b>College</b> comes out of saving in the college years, unless you&apos;re
                    saving for it ahead in your budget, in the same order.</li>
                    <li><b>Your chance of success</b> is how often the plan lasted through past
                    markets, starting in each month since 1926, with the withdrawal strategy you
                    choose on Retirement (spending a fixed amount until you choose one). It&apos;s
                    the same run the simulator on Retirement shows.</li>
                  </ul>
                </Section>
                <Section id="tools">
                  <p>Every RetCalc tool opens inside your dashboard, filled in with what your
                  profile knows. <b>Back</b> returns to the tab you came from.</p>
                  <ul>
                    <li>Changes you make in a tool opened from <b>Tools</b> stay in that tool. They
                    never change your profile.</li>
                    <li>Home, Spending, Taxes &amp; Savings, the Calculator and Retirement are built on
                    tools too. What you change on those tabs is saved to your profile, and the
                    figures they take from your plan are listed rather than typed.</li>
                    <li>The tools on the rest of RetCalc are separate. Nothing you do here changes
                    them, or the household you set up there.</li>
                  </ul>
                </Section>
                <Section id="saved">
                  <ul>
                    <li>Your profile, your net worth entries and your choices on each tab are
                    saved to your account.</li>
                    <li>They sync, so you see the same numbers on your phone and your computer.</li>
                    <li>They&apos;re private: only you can see them, once you&apos;re signed in.</li>
                    <li>The rest of RetCalc keeps its own saved numbers, apart from these.</li>
                  </ul>
                </Section>
              </Group>

              <Group id="calc">
                <Section id="calculator">
                  <p>Your Calculator is filled in from your plan and driven by the{" "}
                  <b>changes ahead</b>: the things you see coming.
                  <b>Save more or less</b> changes what you save from an age on, by dollars a
                  month or a share of what you&apos;d save then, all at once or phased in, into or
                  out of the account you name (a cut comes out of the accounts in the order
                  below once that one runs out). <b>A lump sum</b> is one amount put into or
                  taken out of an account on the day you turn an age: an inheritance, a home
                  sale, a down payment. <b>Different returns</b> changes the return from an
                  age on, stepped or climbing. <b>Children</b> are the plan&apos;s own row: their
                  costs and <b>How you cover it</b> are edited from it, and switching it off
                  runs the plan without them. Everything is in today&apos;s dollars, and each row
                  says what it does to your savings at retirement, with the other changes as
                  they are. <b>View or edit</b> opens the big view: each change across your
                  ages, and every one with its words; a click on one opens it, and the X
                  removes it. A change
                  that takes more than you save in any year, or a lump sum
                  bigger than its account holds that day, can&apos;t be added or kept: saving
                  never goes below $0, and no tax is counted on a lump taken out (the
                  brokerage&apos;s cost basis at retirement does follow it).</p>
                  <p>Underneath, the stages are the plan&apos;s own saving year by year: every
                  change the plan makes, with children, college years, saving that grows each
                  year to its limits, both employers&apos; match, and the changes ahead on top, so
                  what it reaches at retirement is what your plan has. <b>See the stages</b>
                  lists them by age, read-only: change one of the changes ahead to change them. Today&apos;s
                  balances and cost basis, pay and the match, filing status, state and
                  inflation are listed, not typed: they&apos;re set on Net worth, Income and
                  Profile. Anything else you change (the goal, fees, the chart&apos;s settings)
                  is saved to your plan. Changes to saving run inside the plan itself, so every
                  tab follows them; a different return or a lump sum runs only here, and the
                  Calculator&apos;s result is then your savings at retirement everywhere.</p>
                  <p>A few things worth knowing:</p>
                  <dl className="gloss">
                    <dt>The stages behind this</dt>
                    <dd>Each stage is a stretch of years when you save about the same; a child
                    arriving, college, a line reaching its limit or a change starting each
                    begins a new one. The table gives each stage&apos;s ages, saving a month by
                    account (your own money before the match), <b>Rises</b> (how much its saving
                    grows each year after inflation, a steady rate fitted to the plan&apos;s
                    year-by-year figures), <b>On day one</b> (a lump sum, when a stage has one),
                    the return, and what&apos;s going on.</dd>

                    <dt>Inflation adjusted <Badge variant="outline" className="ml-1.25">stage 2 onward</Badge></dt>
                    <dd>Restates the contribution you typed into that stage&apos;s future dollars.
                    Type $3,000 for a stage starting in year 5 at 2.5% inflation and it&apos;s
                    modeled as $3,394, the amount that <i>feels like</i> $3,000 by
                    then. The stage&apos;s own growth rate compounds from there. Turn it off to
                    use the number exactly as typed. In the editor it&apos;s the <b>Inf. Adj.</b> box
                    under the contribution, with the amount it becomes beside it.</dd>

                    <dt>Glide path <Badge variant="outline" className="ml-1.25">final stage only</Badge></dt>
                    <dd>Available on the last stage only, since that&apos;s the one closest to
                    retirement; earlier stages don&apos;t get the option. The return holds
                    steady, then blends down to an end rate
                    over however many final years you choose within that stage.</dd>

                    <dt>Target <Badge variant="outline" className="ml-1.25">solving</Badge></dt>
                    <dd>The solve, and &quot;Work backwards from a target&quot; on the results side,
                    change <i>the final stage only</i>. Everything before it is treated as
                    settled, which is what makes the answer meaningful when stages carry
                    different assumptions.</dd>

                    <dt>Split by account type <Badge variant="outline" className="ml-1.25">optional</Badge></dt>
                    <dd>Starting
                    balances, the employer match and your filing status and state are set once
                    for the whole run; each stage then says how much of its contribution goes
                    into each of traditional, Roth, the taxable brokerage account and the HSA. That lets a plan go Roth early in a career
                    and traditional later, and the tax on your retirement income reflects the
                    mix you end up with. In your dashboard it&apos;s on from the start, with your
                    balances by account, and the employer match is both employers&apos; together, as
                    one rate on what you put in.</dd>
                  </dl>
                </Section>
                <Section id="projection">
                  <ul>
                    <li><b>Contributions land at the end of each period.</b> Money added in
                    March doesn&apos;t earn a full year of growth; it earns the remainder of the
                    year. This is the conservative convention.</li>
                    <li><b>The annual return is converted to a periodic rate.</b> A 7% annual
                    return becomes the bi-weekly rate that compounds to exactly 7% over a year,
                    not 7% divided by 26. The difference compounds noticeably over decades.</li>
                    <li><b>Contribution growth applies once a year</b>, on the anniversary, not
                    continuously.</li>
                    <li><b>A partial final period is dropped</b> rather than counted whole.</li>
                    <li><b>Fees come off the return</b> before anything else is calculated.</li>
                    <li><b>Inflation adjustment</b> divides by (1 + inflation) raised to the
                    number of years, converting future dollars into what they&apos;d buy today.</li>
                    <li><b>The withdrawal figure is the first year of retirement.</b> The model
                    stops at your retirement date; it does not simulate spending the money down.</li>
                  </ul>
                </Section>
              </Group>

              <Group id="retirement">
                <Section id="optimizer">
                  <p>Once you know when you&apos;ll retire and what you&apos;ll spend, the rest is tactics,
                  and they&apos;re worth a lot: when each of you claims Social Security, which account
                  each year&apos;s money comes from, and how much to move from traditional to Roth
                  while your income is low. The Retirement Plan Optimizer tries every combination and keeps
                  the best, for the goal you pick.</p>
                  <dl className="gloss">
                    <dt>Where it starts</dt>
                    <dd><b>Retirement day</b>, the default, starts from the balances you&apos;ll have
                    when you retire, by account type, in today&apos;s dollars. Type them in, or use{" "}
                    <b>Copy from Advanced</b> once it has <b>Split by account type</b> turned on:
                    it projects each account to retirement with its own contribution growth,
                    fees, employer match, glide path and changes ahead, and the optimizer takes
                    it from there. <b>Today</b> starts from what you have now and what you save
                    each month, and grows each account to retirement at a steady return after
                    inflation first; its copy button brings over Advanced&apos;s current balances,
                    monthly saving and return.</dd>

                    <dt>What it tries</dt>
                    <dd>Every claiming age from 62 to 70 for each of you (never before you
                    retire). Six ways to draw down: the usual order (brokerage, then traditional,
                    then Roth), or traditional money first each year up to the standard deduction
                    or the top of the 10%, 12%, 22% or 24% bracket, then brokerage, then Roth. For
                    each fill, three conversion windows: never convert, convert what you don&apos;t
                    spend until Social Security starts, or until required distributions start. And
                    two income guards, on or off: staying under Medicare&apos;s first surcharge line
                    from 63, and under the ACA subsidy cliff before 65. For a couple that&apos;s a few
                    thousand plans.</dd>

                    <dt>How each plan is tested</dt>
                    <dd>Year by year, account by account, through every historical starting year
                    since 1926 with the stock mix you choose, by the same engine the readiness
                    guide uses. Each year it finds the smallest withdrawal, down the plan&apos;s list
                    of accounts, that pays for your spending plus the income tax, early-withdrawal
                    penalty, Medicare surcharge and health premiums that withdrawal itself causes.
                    The tax is the Income Tax tool&apos;s whole 2026 federal and state retirement
                    return, read from a cache so thousands of plans run in seconds. Conversions
                    before 59½ can be spent after five years, as a conversion ladder. The search
                    runs in your browser, off the page&apos;s main thread, and sends nothing
                    anywhere.</dd>

                    <dt>The three goals</dt>
                    <dd><b>Leave the most</b> picks the plan with the most left after tax in the
                    median historical market, among plans that last at least as often as the
                    usual way (or your target, if that&apos;s lower). Traditional money left at the end
                    counts at 76% of its value by default, for the income tax whoever inherits it
                    will owe. <b>Make it last</b> picks the plan that lasted in the most historical
                    markets, then the one that leaves the most in the worst tenth of them.{" "}
                    <b>Spend the most</b> finds, for the strongest finalists, the highest yearly
                    spending that still lasts in your target share of markets, and keeps the
                    highest.</dd>

                    <dt>Reading the answer</dt>
                    <dd>The headline compares the best plan with the usual way, run on the same
                    numbers. <b>Your roadmap</b> lays the best plan out as stretches of years,
                    on the average path: where the money comes from, what&apos;s converted, the tax
                    and the health premiums. <b>What makes the difference</b> splits the gain
                    between claiming Social Security at different ages and changing how the
                    accounts are drawn and converted, each tested through all of history.</dd>

                    <dt>What it assumes</dt>
                    <dd>A couple is one household with one pool of each account type; the 59½ line
                    and required distributions follow your age, and both of you live to the end of
                    the plan, which favors claiming later (a survivor keeping the larger benefit
                    isn&apos;t modeled). Brackets and thresholds are held at 2026 levels in today&apos;s
                    dollars. When it prices health coverage, years before 65 pay the ACA
                    marketplace premium the year&apos;s income earns, and years from 65 pay the
                    standard Part B premium plus an average Part D plan per person (Medigap
                    isn&apos;t assumed). It doesn&apos;t use 72(t) payments or 457(b) plans (the Early Retirement
                    Bridge compares those), and it doesn&apos;t change your retirement age, saving or
                    spending: the readiness guide&apos;s Adjust your plan step does that.</dd>
                  </dl>
                </Section>
                <Section id="drawdown">
                  <p>In your dashboard the <b>Retirement</b> tab runs it on your plan, and the strategy you choose there sets your chance of success everywhere. Your savings at retirement, retirement age and Social Security come from the plan there; your mix once retired is set there and is the plan&apos;s mix everywhere. Opened from <b>Tools</b>, it&apos;s a copy to try things on.</p>
                  <p>Every other tool in this app answers &quot;how much will I have?&quot; This one
                  answers the harder question: once you stop contributing and start spending,{" "}
                  <b>will it last?</b> It takes a portfolio balance, a withdrawal strategy, and
                  tests it against real market history and randomized simulation to produce a
                  success rate: the share of tested retirements where the money didn&apos;t
                  run out.</p>

                  <p><b>Historical mode</b> runs your plan starting from every single year since
                  1926: retire in 1929 right before the Depression, retire in 1966 into a lost
                  decade, retire in 2000 before two crashes in one decade. Each is a genuine
                  sequence of stock returns, bond returns, and inflation that actually happened,
                  not a statistical approximation of one. This matters because <i>the order</i>{" "}
                  returns arrive in changes everything: a bad decade in your first few years
                  of retirement does far more damage than the same bad decade arriving later,
                  even though the average return over the full period is identical. This is
                  called sequence-of-returns risk, and it&apos;s the single biggest reason a plan
                  that looks safe on a spreadsheet can fail in reality.</p>

                  <p><b>Monte Carlo mode</b> draws years at random from that same 100-year
                  record, thousands of times, to show the range of outcomes a purely random
                  ordering could produce. It&apos;s a useful complement, but it misses the way real
                  bad years cluster together; the historical mode is the more honest test
                  of a specific plan.</p>

                  <p>Click any row in <b>&quot;How each starting year fared&quot;</b> to drill into that
                  exact period: what was withdrawn each year, how the balance moved, and how
                  much of that came from Social Security versus the portfolio itself.</p>

                  <dl className="gloss">
                    <dt>Withdrawal strategy</dt>
                    <dd>The rule for how much to take out each year. <b>Fixed amount</b> sets a
                    dollar figure and raises it with inflation every year, no matter what
                    markets do: the classic 4% rule. <b>Percentage of portfolio</b> takes
                    the same share of whatever the account is worth, so it can never run dry but
                    income swings with the market. <b>Guyton-Klinger Guardrails</b> follows
                    inflation but cuts spending if the withdrawal rate climbs past an upper
                    guardrail and raises it if the rate falls past a lower one; each guardrail
                    has its own distance and step, and cuts can optionally stop in the final
                    years of retirement (15 in Guyton and Klinger&apos;s paper). <b>Floor &amp; ceiling</b> aims at a percentage of the balance
                    but limits how much spending can change from one year to the next.{" "}
                    <b>Yale Endowment</b> blends last year&apos;s spending with a fresh percentage of
                    the current balance, smoothing swings while still tracking the market.{" "}
                    <b>Variable percentage withdrawal (VPW)</b>, from the Bogleheads community,
                    takes the payment that would spend the current balance down to a future
                    value (usually $0) over the years left at an expected real return, so the
                    share rises as the horizon shortens. <b>How the strategies compare</b>,
                    under the picker, covers each in depth with its pros and cons.</dd>

                    <dt>Other income &amp; future expenses</dt>
                    <dd>Beyond Social Security, add any other income (a pension, rental
                    property, part-time work) or a planned future cost like a car or
                    long-term care. Each can start in a specific year, last once, for a set
                    number of years, or the rest of retirement, and can grow with inflation or
                    stay fixed. Income offsets what the portfolio needs to provide, the same way
                    Social Security does, with any surplus invested rather than wasted; expenses
                    add directly to that year&apos;s spending regardless of the strategy chosen
                    above.</dd>

                    <dt>Minimum spending</dt>
                    <dd>An optional hard floor, in today&apos;s dollars, that spending never falls
                    below, even in a year the strategy above would otherwise call for
                    less. Available on every strategy except fixed amount, which by design
                    never drops in real terms anyway.</dd>

                    <dt>Maximum spending</dt>
                    <dd>The mirror of the minimum: a hard cap, in today&apos;s dollars, that the
                    strategy&apos;s spending never goes above, however much a good year would allow.
                    A future expense you add is on top of it, so that year can go past the cap
                    by the expense. If the minimum is set above the maximum, the maximum wins.
                    Available on the same strategies as the minimum.</dd>

                    <dt>Stock / bond mix</dt>
                    <dd>How the portfolio is split during retirement. A higher stock allocation
                    has historically grown faster but swings harder in a downturn, which matters
                    more once you&apos;re withdrawing from it.</dd>

                    <dt>Social Security</dt>
                    <dd>Optional income that offsets what the portfolio needs to provide. Enter
                    your income for a rough estimate using the real Social Security benefit
                    formula, or paste your own number from a statement at ssa.gov, which is
                    always more accurate since it reflects your actual earnings history rather
                    than an assumed steady career.</dd>

                    <dt>Success rate</dt>
                    <dd>The share of tested periods, historical years or Monte Carlo runs,
                    where the portfolio lasted the full length of retirement without
                    hitting zero. Higher isn&apos;t automatically better on its own: a 100% success
                    rate paired with very low spending might mean money is being left behind
                    that could have funded a better retirement.</dd>
                  </dl>

                  <p><b>What it leaves out:</b> the 1926&ndash;2025 record is US markets only, so
                  it says nothing about how other countries&apos; markets have behaved, and the
                  historical test has at most 100 starting years (71 for a 30-year retirement),
                  not an infinite set of possible futures. Required minimum distributions and taxes on withdrawals
                  aren&apos;t modeled. Above all: a strategy surviving every year since 1926 is
                  strong evidence, not a guarantee: markets have never been obligated to
                  repeat their history, and the next 30 years don&apos;t have to look like any of
                  the last 100.</p>
                </Section>
                <Section id="bridge">
                  <p>In your dashboard, retiring before 59½, it&apos;s the <b>Bridge to 59½</b> view on Retirement, run on your plan&apos;s own figures (listed, not typed) with a partner&apos;s pay counted while they keep working. Opened from <b>Tools</b>, it&apos;s a copy to try things on.</p>
                  <p>Retire before 59½ and most of your savings sits behind a 10% additional
                  tax. This tool plans the years in between. You enter your balances by account
                  type, your spending and your state, and it builds a separate plan for every
                  way the tax code lets you reach that money early, runs each one year by year
                  with the real 2026 tax, penalty and ACA rules, and tests each against every
                  market since 1926.</p>
                  <dl className="gloss">
                    <dt>Brokerage, then Roth contributions</dt>
                    <dd>The simplest bridge: sell taxable investments, where only the growth is
                    taxed and often at 0%, then take back your own Roth contributions, which are
                    never taxed or penalized.</dd>
                    <dt>Roth conversion ladder</dt>
                    <dd>Convert a year&apos;s spending from traditional to Roth every year, paying
                    income tax at today&apos;s low early-retirement rates, and spend each conversion
                    five years later, penalty-free. The first five years still need another
                    source.</dd>
                    <dt>72(t) payments</dt>
                    <dd>Substantially equal periodic payments from an IRA carry no penalty at any
                    age, but they&apos;re rigid: set by IRS formula and locked in until the later of five
                    years or 59½. The plan splits off an IRA just big enough for the payment.</dd>
                    <dt>Rule of 55</dt>
                    <dd>Leave an employer in or after the year you turn 55 and that employer&apos;s
                    401(k) pays out penalty-free.</dd>
                    <dt>Pay the 10% penalty</dt>
                    <dd>Shown for comparison: what it costs to ignore every exception.</dd>
                    <dt>The blended plan</dt>
                    <dd>Mixes the routes: fills low tax brackets with conversions (or rule of 55
                    withdrawals), lives off the brokerage and Roth contributions while the ladder
                    matures, and adds 72(t) payments only if the plan would otherwise run short. It
                    tries each conversion level and keeps the one that holds up in the most
                    historical markets, then the cheapest, counting lost ACA subsidies as a real
                    cost.</dd>
                    <dt>Holds up in</dt>
                    <dd>The share of historical start years in which a plan gets to 59½ without
                    running short or dipping into penalized money it didn&apos;t intend to. Monte Carlo
                    draws random years from the same record instead.</dd>
                    <dt>At 59½</dt>
                    <dd>The tool stops at 59½ and shows what each plan leaves in traditional, Roth
                    and brokerage accounts. On the tool&apos;s own page, one button starts the
                    Drawdown Simulator with that total, and another loads a year of withdrawals
                    into Income Tax&apos;s retirement mode.</dd>
                  </dl>
                  <p><b>What it does not do.</b> Everything is one household with one age, and
                  both spouses&apos; accounts are treated as one person&apos;s. Payroll tax is counted on
                  part-time pay, but not the earned income credit or Roth contributions from that
                  pay. The 72(t) annuitization method, HSAs, the SECURE 2.0 emergency and
                  disability exceptions and state-specific exclusions that depend on age
                  are left out, and the ACA premium uses your state&apos;s average benchmark plan
                  unless you enter your own. Brackets and thresholds are held fixed in real
                  terms.</p>
                </Section>
                <Section id="roth">
                  <p>A traditional 401(k) or IRA is a loan from the IRS, not a gift. The tax was
                  deferred, not forgiven, and <b>required minimum distributions</b> are the year
                  the bill comes due: from age 73, or 75 if you were born in 1960 or later,
                  a slice of the balance has to come out every year whether you need the
                  money or not. The slice is set by the IRS Uniform Lifetime Table and it widens
                  with age, from about 3.8% at 73 to over 15% in your nineties.</p>

                  <p>That is the problem a <b>Roth conversion</b> is trying to get ahead of.
                  Moving money from traditional to Roth means paying tax on it now, voluntarily,
                  at a rate you choose, in order to avoid paying tax on a larger balance later at
                  a rate somebody else chooses. The tool runs your household twice, once
                  converting on the schedule you set and once not touching anything, and puts
                  the two side by side.</p>

                  <dl className="gloss">
                    <dt>Fill to the top of a bracket</dt>
                    <dd>The usual approach. Each year it converts exactly enough to reach the top
                    of the bracket you pick and not a dollar more, after Social Security, RMDs and
                    everything else has been counted. Because it solves the whole return rather
                    than a simple subtraction, it picks up the Social Security tax torpedo and
                    capital-gain stacking on the way.</dd>

                    <dt>Fill to an IRMAA threshold</dt>
                    <dd>The same idea against a different line. Medicare&apos;s income-related
                    surcharge is a cliff, not a phase-in: one dollar over and the whole
                    tier applies, so for some households the binding constraint is the
                    IRMAA bracket, not the tax bracket.</dd>

                    <dt>Where the tax comes from</dt>
                    <dd>The largest single lever here. Paying conversion tax out of a taxable
                    account moves the full conversion into the Roth. Withholding it from the
                    conversion means a smaller amount actually lands, and every future year
                    compounds on the smaller number. Switch between the two and watch the
                    after-tax figure move.</dd>

                    <dt>The survivor&apos;s bracket</dt>
                    <dd>Sometimes called the widow&apos;s penalty. When the first spouse dies,
                    the survivor files single the following year: roughly the same income, but
                    single brackets and a single standard deduction. It is one of the strongest
                    arguments for converting while both are alive, and the tool flags the year it
                    happens.</dd>

                    <dt>Lifetime tax, present value</dt>
                    <dd>Every dollar of federal, state and IRMAA discounted back to today. A
                    conversion always costs money now to save money later, so comparing raw totals
                    across thirty years flatters it; discounting is the honest version.</dd>

                    <dt>After-tax net worth</dt>
                    <dd>Roth and brokerage at face value, traditional discounted by the rate you
                    expect to be paid on it, whether by you later or by whoever inherits it.
                    Comparing pre-tax balances across a Roth and a traditional account compares
                    two different currencies.</dd>

                    <dt>Break-even</dt>
                    <dd>The first year the converting plan&apos;s after-tax net worth passes the
                    do-nothing plan and stays there. Early years always look worse. If break-even
                    lands past your horizon, the conversion is a bet on your heirs, not on you.</dd>
                  </dl>

                  <p><b>What it does not do.</b> Returns are a single real rate, not a sequence,
                  so a market crash in the middle of a conversion window changes the answer
                  and is not modeled here. Estate tax, state estate tax, QCDs, the ACA premium
                  credit for anyone retiring before 65, and the inherited-IRA ten-year rule are
                  all absent. Brackets and thresholds are held fixed in real terms, so a change in
                  the law, the most likely reason any of this turns out differently,
                  is outside the model by construction.</p>
                </Section>
                <Section id="social">
                  <p>In your dashboard your Social Security is on <b>Income</b>: estimated from your pay, typed from your statement, or worked out from your pay history with this tool&apos;s editor. Your claiming ages there are the plan&apos;s, and so is the share of the benefit you expect, which scales every benefit in the plan.</p>
                  <p>The Social Security Calculator shows your monthly check at every age you
                  could claim, 62 to 70, worked out from your pay or from your statement, and
                  what each choice adds up to, so the trade-off is plain: a smaller check for
                  more years, or a larger one for fewer. Everything is in today&apos;s dollars.
                  Social Security&apos;s yearly cost-of-living raise keeps a benefit level in real
                  terms, and the delayed credits are real too, so no inflation assumption is
                  needed.</p>

                  <dl className="gloss">
                    <dt>Full retirement age and the factors</dt>
                    <dd>Full retirement age comes from the birth year: 66 for 1943 to 1954, two
                    months more for each year to 67 from 1960 on. A benefit claimed early is cut
                    5/9 of 1% for each of the first 36 months and 5/12 of 1% for each month
                    beyond; claimed late it grows 2/3 of 1% per month, 8% per year, until 70.
                    These are the Social Security Administration&apos;s own rules, applied to whole
                    months. The staircase shows each age&apos;s check and its share of the full
                    benefit, and &ldquo;How it&apos;s figured&rdquo; walks through the arithmetic for the age
                    chosen.</dd>

                    <dt>The benefit from your pay</dt>
                    <dd>The monthly figure at full retirement age on a statement from ssa.gov is
                    the right input for anyone near claiming: it reflects the actual earnings
                    record. The estimate builds a whole career instead, from the age work started
                    to the age it stops. Years before today are estimated by walking today&apos;s pay back at
                    the raise set for the past, and any of them can be typed in as it was actually
                    earned, the figure a Social Security statement lists for that year; a year typed
                    in is that year alone, and the tool indexes it the way Social Security does:
                    times the national average wage index two years before the benefit year, over
                    that year&apos;s (so $65,000 earned in 2020 counts as about $81,600 in 2026). Years
                    after the index year count as paid. Years after today rise from the
                    year before at the raise set for the future, so a year typed in (a promotion,
                    a cut) carries forward, and the raises go on from it. Raises are above
                    national wage growth, and the chart shows every year in today&apos;s wages: Social Security
                    indexes past pay to wage growth, so pay that only kept pace counts as level,
                    and the bend points and wage base move with wages too. Each year is capped at
                    the wage base, the best 35 are averaged (zeros fill a shorter career) and the
                    monthly average goes through the current year&apos;s bend points: 90% of the
                    first part, 32% of the next and 15% of the rest. The Optimizer&apos;s and the
                    Drawdown Simulator&apos;s simpler estimators assume level pay.</dd>

                    <dt>Couples</dt>
                    <dd>Each spouse claims their own benefit at their own age. A spouse whose own
                    full benefit is under half the other&apos;s gets the difference as a spousal top-up,
                    starting once both have claimed and reduced on the spousal schedule (25/36 of
                    1% per month for the first 36 months early, 35% at 62 with a full retirement
                    age of 67) for the age it starts; it never earns delayed credits. &ldquo;Best ages
                    for the two of you&rdquo; runs the household total for all 81 pairs of claiming
                    ages, through the ages each of you expects to live to, and marks the pair that
                    collects the most.</dd>

                    <dt>The survivor benefit</dt>
                    <dd>When one spouse dies the survivor keeps the larger of the two checks, the
                    deceased&apos;s delayed credits included, and the smaller one stops. The figure
                    shown is that larger check, and when the deceased claimed early it is never
                    less than 82.5% of the deceased&apos;s full benefit (Social Security&apos;s floor). Survivor
                    claims before the survivor&apos;s own full retirement age and the family maximum
                    aren&apos;t modeled.</dd>

                    <dt>The earnings test</dt>
                    <dd>Claiming before full retirement age while still working, $1 of benefit is
                    withheld for every $2 earned over the year&apos;s limit ($24,480 in 2026). The year
                    full retirement age is reached runs on a higher limit and $1 in $3; the tool
                    treats it like the earlier years, which overstates the withholding a little for
                    that one year. At full retirement age the benefit is refigured as if claimed
                    later by the months withheld (every month with any benefit held back counts, as
                    Social Security counts them), which the tool counts as the higher benefit from
                    then on.</dd>

                    <dt>Break-even and the best age by lifespan</dt>
                    <dd>Two claiming choices break even at the age where the later, larger check has
                    paid as much in all as the earlier one: for annual benefits A at age a and B at
                    age b, (B&times;b &minus; A&times;a) / (B &minus; A). The lifespan bar runs the
                    household total for every lifespan from 70 to 100 and marks which claiming age
                    collects the most at each. Neither counts taxes or what the money could earn
                    invested.</dd>

                    <dt>Taxes</dt>
                    <dd>The share of the benefit taxed follows the federal provisional-income rules
                    (other income plus half the benefit against the $25,000/$32,000 and
                    $34,000/$44,000 thresholds, which aren&apos;t indexed), at the other income entered.
                    The Income Tax tool&apos;s retirement mode works out the tax itself, including the
                    senior deduction and any state tax on benefits.</dd>
                  </dl>
                </Section>

                <Section id="healthcare">
                  <p>In your dashboard it&apos;s the <b>Health cover</b> view on Retirement, run on your plan: the year work stops, your ages, household and state, and the income your plan gives that year and at 65 (Medicare uses the second). Only the benchmark premium is yours to type. Opened from <b>Tools</b>, it&apos;s a copy to try things on.</p>
                  <p>Healthcare is one of the largest and most variable costs in early retirement.
                  This tool covers two phases: the ACA bridge between retirement and Medicare,
                  and Medicare itself from age 65 on.</p>

                  <p><b>Pre-65: ACA bridge.</b> Most early retirees buy coverage on the ACA
                  marketplace until Medicare starts. Premiums are set by age and state; the tool
                  uses the official HHS age-rating multipliers to scale a state-level benchmark to
                  your retirement age. The premium tax credit reduces what you actually pay, and
                  its size depends on where your income falls relative to the federal poverty line.</p>

                  <dl className="gloss">
                    <dt>Retirement MAGI</dt>
                    <dd>Modified Adjusted Gross Income (MAGI) is the income figure the ACA and
                    Medicare both use. In retirement this is typically taxable withdrawals, pension
                    income, taxable Social Security, and capital gains added together. On the
                    tool&apos;s own page, <b>Copy from Income Tax</b> pulls it automatically when
                    the Income Tax tool is in Retirement income mode.</dd>

                    <dt>2026 rules, and the enhanced credits</dt>
                    <dd>The standard rules cap your premium at a sliding percentage of income, from
                    2.10% to 9.96% in 2026, and end subsidies above 400% FPL (the &quot;subsidy cliff&quot;).
                    Enhanced rules, in place from 2021 through 2025, removed the cliff and capped
                    contributions at 8.5% at every income. They expired at the end of 2025, so 2026
                    coverage runs on the standard rules; the tool also shows what the enhanced rules
                    would give, in case Congress restores them.</dd>

                    <dt>The 400% FPL cliff</dt>
                    <dd>Under standard rules, crossing this line eliminates the entire subsidy in
                    one dollar. The tool warns you when you&apos;re close and quantifies the exact monthly
                    cost, which matters when weighing Roth conversions, capital gains realizations,
                    or IRA withdrawal timing against ACA premium exposure.</dd>

                    <dt>Low incomes: Medicaid and the coverage gap</dt>
                    <dd>In a state that expanded Medicaid, income below 138% of the poverty line
                    (the 2026 guidelines) means Medicaid at no premium and no marketplace credit.
                    In the ten states that didn&apos;t, income below 100% of the poverty line (the
                    2025 guidelines, which the credit uses) gets neither, so the tool shows the full
                    price. Every tool that prices health coverage uses this same rule.</dd>

                    <dt>State and age adjustment</dt>
                    <dd>The benchmark Silver premium is KFF&apos;s 2026 average for each state for a 40-year-old,
                    scaled to your retirement age via the HHS multiplier table (except in New York and Vermont, where every adult pays the same rate). Enter your own
                    quote from healthcare.gov in the sidebar for a precise number.</dd>
                  </dl>

                  <p><b>Post-65: Medicare.</b> Medicare Part B (outpatient) and Part D
                  (prescriptions) both carry income-related surcharges known as IRMAA, based on
                  your income from two years prior. Most enrollees add Medigap coverage to cap
                  out-of-pocket exposure.</p>

                  <dl className="gloss">
                    <dt>IRMAA</dt>
                    <dd>Income-Related Monthly Adjustment Amount. If your MAGI two years ago
                    exceeded a threshold ($109,000 single / $218,000 married in 2026), Part B and
                    Part D cost more, in six tiers up to 3.4 times the $202.90 standard Part B
                    premium. The tool
                    shows your tier, the dollar surcharge, and the exact savings from keeping income
                    below the next tier down, which matters for withdrawal sequencing and Roth
                    conversion decisions in the years before Medicare starts.</dd>

                    <dt>Medigap</dt>
                    <dd>Supplement plans like Plan G cover most of what Original Medicare leaves
                    unpaid. Premiums vary widely by state, insurer, and age at enrollment; the range
                    shown is a rough national estimate for a 65-year-old. Medicare Advantage
                    (Part C) plans have lower premiums but narrower networks and different
                    cost-sharing, and are not modeled here.</dd>
                  </dl>
                </Section>
              </Group>
              <Group id="saving">
                <Section id="fire">
                  <p><b>FIRE</b> (Financial Independence, Retire Early) means accumulating a portfolio large
                  enough that investment returns can fund your spending indefinitely. The classic benchmark is
                  25&times; your annual expenses, which corresponds to a 4% annual withdrawal rate &mdash; though
                  you can enter any target and withdrawal rate here.</p>
                  <p><b>FIRE mode</b> finds the year your inflation-adjusted portfolio first reaches your target.
                  The number shown is in today&apos;s dollars, so it stays meaningful even decades out.</p>
                  <p><b>Coast FIRE mode</b> finds the year your portfolio is large enough that, with no further
                  contributions, it will compound to your target by your planned retirement age. You still need
                  earned income to live on &mdash; but the saving race is over. The &quot;if you kept saving&quot;
                  stat shows how much larger your retirement portfolio would be had you never coasted, and the
                  gap is the optional extra you&apos;re leaving on the table in exchange for financial freedom
                  from saving.</p>
                  <p><b>Rate band</b> shades the range between a return &plusmn; your chosen band, giving a fast
                  read on how sensitive your FIRE date is to return assumptions. <b>Historical mode</b> runs the
                  plan against every starting year since 1926, showing the p10/p25/p50/p75/p90 spread of real
                  outcomes.</p>
                  <p><b>Success rate slider.</b> The slider picks a percentile of historical starting years.
                  At 50% you see the median outcome &mdash; half of historical periods hit your target sooner,
                  half later. At 75% you see the date by which 75% of periods succeeded, which requires a later
                  (more conservative) target date. Move it toward 99% to stress-test against nearly every
                  historical period; toward 1% for the aggressive best-case. The success rate is purely
                  historical &mdash; it says nothing about future markets.</p>
                </Section>
                <Section id="backtest">
                  <p>Every projection in this app starts with a rate of return you have to
                  supply, and most people pick one out of the air. This tool is where that
                  number comes from. Choose a stock and bond mix, choose a stretch of history,
                  and it reports what that mix did: compound return, the same return after
                  inflation, volatility, the best and worst years by name, and the deepest
                  fall from a previous high.</p>
                  <p>The rolling-returns table is the part worth sitting with. It shows every
                  overlapping 1, 5, 10, 20 and 30-year window in the range, annualized. The
                  median tells you what was typical; the worst column tells you what someone
                  who started at the wrong moment actually earned, which is the figure a plan
                  should survive.</p>
                  <p>Inflation gets its own panel rather than being buried in the real-return
                  figure, because the spread is the point: the record runs from about &minus;10% in
                  1932 to +18% in 1946 in single years, and the stretches that did the damage to retirements
                  were sustained ones, not spikes. The ten-year line is drawn over the annual one
                  for exactly that reason.</p>
                  <p><b>Use these figures in Advanced</b> carries the return, the volatility and
                  the average inflation over together. They belong together: a nominal return
                  earned through a high-inflation stretch is only meaningful next to the inflation
                  that came with it, and pairing that return with a different inflation assumption
                  quietly changes the answer.</p>
                  <p><b>The data.</b> Monthly, January 1926 to December 2025. Stock prices,
                  dividend yields and 10-year Treasury yields come from Robert Shiller&apos;s
                  dataset (Yale); CPI-U comes from the US Bureau of Labor Statistics. Monthly
                  stock total return is the price change plus that month&apos;s share of the
                  trailing dividend; monthly bond return is one month of coupon plus the price
                  move implied by the change in yield. The calendar-year figures the Drawdown
                  Simulator and this tool use are compounded up from those same monthly
                  numbers, so there is one dataset aggregated two ways rather than two
                  datasets that can disagree.</p>
                  <p>Shiller&apos;s prices are <b>monthly averages of daily closes</b>, not month-end
                  closes &mdash; his long-standing convention, and the one most long-run
                  retirement research is built on. It slightly damps single-year extremes
                  against a December-to-December series (2008 reads about &minus;39% here rather
                  than &minus;37%) while leaving long-run compounding alone: stocks still run
                  near 10% per year over the period.</p>
                  <p><b>The assumptions.</b> Stock returns are S&amp;P 500 total return with
                  dividends reinvested, and bond returns include the coupon, not just the price
                  move &mdash; which is why stocks here compound near 10% per year rather than the
                  6&ndash;7% price-only figure people often have in mind. Annual rebalancing, no
                  fees, no taxes, no trading costs, so weigh in your own fund&apos;s expense ratio
                  separately. The growth chart runs from a fixed $10,000, since
                  that changes the dollar amounts but nothing else about the mix&apos;s behavior.
                  The bond series is 10-year Treasuries, not a broad bond fund. Past returns
                  describe what happened; they are not a forecast, and the further back the
                  data goes the less the world it describes resembles this one.</p>
                </Section>
                <Section id="college">
                  <p>Works backward from a target: pick a school type or type in your own
                  annual cost, and it solves for the monthly savings needed to cover it,
                  accounting for tuition rising faster than general prices.</p>
                  <dl className="gloss">
                    <dt>School type presets</dt>
                    <dd>Rough all-in figures (tuition, room and board, and fees)
                    for a public in-state school, a private non-profit, and an elite or Ivy
                    League school. Overwrite the cost field with your own number if you have a
                    specific school in mind.</dd>
                    <dt>Tuition inflation</dt>
                    <dd>College costs have historically risen faster than the inflation used
                    elsewhere in this app, often 3&ndash;5% per year versus the 2&ndash;3%
                    typical of general prices. The default reflects that gap.</dd>
                  </dl>
                  <p><b>What it leaves out:</b> financial aid, scholarships, 529 plan tax
                  advantages, and the possibility of a shorter or longer program than four
                  years unless you change that input yourself.</p>
                </Section>
                <Section id="rentbuy">
                  <p>In your dashboard, renting, <b>Home</b> runs it starting from your rent.</p>
                  <p>The question isn&apos;t just &quot;which payment is bigger&quot;; it&apos;s which path
                  leaves you with more net worth after some number of years. This tool runs
                  both scenarios month by month: the buyer builds equity as the mortgage is
                  paid down and the home appreciates; the renter invests whatever they didn&apos;t
                  spend, starting with the down payment and closing costs they never paid, and
                  continuing every month renting is cheaper than owning.</p>
                  <dl className="gloss">
                    <dt>Break-even point</dt>
                    <dd>The year buying&apos;s net worth first overtakes renting&apos;s. Before that
                    point, renting and investing the difference wins; after it, owning does.
                    This shifts a lot with the interest rate, how long you stay, and how fast
                    rent rises where you live.</dd>
                    <dt>Renter invests</dt>
                    <dd>The amount the renter has invested from day one (the down
                    payment and closing costs they didn&apos;t spend), which then compounds
                    for the entire comparison. This opportunity cost is often the most
                    underrated part of the rent-versus-buy decision.</dd>
                    <dt>Home appreciation &amp; investment return</dt>
                    <dd>Two separate assumptions that drive most of the result. Home
                    appreciation has historically run below broad stock market returns over
                    long periods, which is part of why the comparison isn&apos;t as one-sided as it
                    might first appear.</dd>
                  </dl>
                  <p><b>What it leaves out:</b> the mortgage interest deduction, moving costs
                  beyond a percentage-based selling cost, rent control, and the non-financial
                  value of owning (stability, the ability to renovate, not having a
                  landlord), which matters to a lot of people and isn&apos;t something a
                  spreadsheet can price in.</p>
                </Section>
              </Group>
              <Group id="everyday">
                <Section id="tax">
                  <p>In your dashboard your taxes are on <b>Taxes &amp; Savings</b>, figured by your paycheck with the deduction and any local tax chosen there. Opened from <b>Tools</b>, this calculator is a copy to try things on.</p>
                  <p>Two modes, switched at the top of the input panel. <b>Normal income</b>{" "}
                  estimates what you keep from a salary after federal income tax, state income
                  tax and FICA, and a local income tax if you give one. <b>Retirement income</b> answers a different question: you are
                  no longer earning a paycheck, you are drawing one down, and what a
                  withdrawal costs depends entirely on which account it comes out of.</p>
                  <p><b>The numbers are tax year 2026.</b> Federal brackets, the standard
                  deduction and FICA limits come from the IRS inflation adjustments
                  (Rev. Proc. 2025-32). State brackets, standard deductions and personal
                  exemptions are as of 1 January 2026. Standard deduction is $16,100 single and
                  $32,200 married filing jointly. Social Security is 6.2% on the first $184,500,
                  Medicare 1.45% on everything, plus a 0.9% surtax above $200,000 single or
                  $250,000 joint.</p>
                  <h4>Normal income</h4>
                  <dl className="gloss">
                    <dt>Filing status and gross income</dt>
                    <dd>Filing status comes first, since it decides how many incomes there are.
                    Gross income is salary before anything is taken out; married filing jointly
                    asks for each spouse&apos;s separately, because Social Security and Medicare
                    are figured per person.</dd>
                    <dt>Pre-tax deductions</dt>
                    <dd>Money taken out of your pay before income tax. Typed as one figure, it
                    lowers income tax only. <b>Split</b> breaks it down by kind, and on a joint
                    return by spouse, because each kind comes off different taxes. A traditional
                    401(k), 403(b) or 457, and other pre-tax benefits such as FSAs and commuter
                    accounts, come off income tax but not Social Security and Medicare. An HSA
                    through payroll and health, dental and vision premiums come off both. A
                    traditional IRA comes off income tax as far as the income limits allow when
                    you have a plan at work (a 401(k) line counts as one). Each line can be
                    typed per paycheck, per month or per year, whichever you know it by, and
                    anything over the year&apos;s contribution limits is flagged. A few states keep
                    some kinds in their own base; the state rules table says which.</dd>
                    <dt>Standard vs itemized</dt>
                    <dd>You take whichever is larger. Most people take the standard deduction;
                    itemizing wins mainly with a big mortgage, large charitable giving, or high
                    state and local taxes.</dd>
                    <dt>Local income tax (optional)</dt>
                    <dd>Some cities, counties and school districts tax income too. The field
                    appears only in the states where that happens: Alabama, Colorado, Delaware,
                    Indiana, Iowa, Kentucky, Maryland, Michigan, Missouri, New York, Ohio, Oregon,
                    Pennsylvania and West Virginia. You give the rate, and choose what it&apos;s on:
                    wages (most cities and school districts, on the same wages as Medicare) or your
                    state taxable income (Maryland and Indiana counties, New York City), each
                    state starting on its usual one. Each state&apos;s note says how it works there
                    and, where there is one, links its official lookup. It counts only once it has
                    a rate, it&apos;s an estimate (a place&apos;s own rules and credits aren&apos;t modeled),
                    and a rate set for one state doesn&apos;t carry to a state without local taxes.
                    California&apos;s and New Jersey&apos;s local payroll taxes are paid by employers, so
                    they aren&apos;t asked for.</dd>
                    <dt>Effective vs marginal rate</dt>
                    <dd>Marginal is the rate on your <i>next</i> dollar. Effective is what you
                    actually paid across all your income, and it&apos;s always lower. A single filer
                    on $100,000 sits in the 22% bracket but pays about 13% of income in federal
                    tax.</dd>
                  </dl>
                  <p><b>What Normal income mode leaves out:</b> tax credits (child tax credit,
                  earned income credit), local taxes beyond the one rate you give (each place&apos;s
                  own rules, credits between where you live and where you work, flat local fees),
                  the Alternative Minimum
                  Tax, capital gains and investment income, self-employment tax,
                  head-of-household and married-filing-separately status, state credits and
                  phase-outs, and the extra deductions available at 65 and over. Most states
                  phase out deductions at higher incomes in ways this doesn&apos;t model; Illinois
                  is the one exception, since its exemption cliff at $250,000 / $500,000 of
                  income is applied. Treat the result as a solid estimate, not a tax return.</p>

                  <h4>Retirement income</h4>
                  <p>A salary is one kind of income taxed one way. A year of retirement
                  spending is usually four or five kinds of income taxed four or five different
                  ways, and the total bill depends less on how much you withdraw than on which
                  accounts you withdraw it from. Instead of one gross income figure, you enter
                  each source separately; the tool totals them for reference and then taxes
                  each one on its own terms. There is no FICA, because none of it is wages, and
                  no net pay vs. take-home switch, because you are no longer contributing to
                  anything. A local income tax on state taxable income (Maryland, New York City)
                  still applies; one on wages doesn&apos;t, since there are none.</p>
                  <dl className="gloss">
                    <dt>Traditional 401(k) / IRA withdrawal</dt>
                    <dd>You deducted it going in, so all of it comes out as ordinary income at
                    the same 10&ndash;37% brackets a salary would face. Required minimum
                    distributions belong here too.</dd>
                    <dt>Roth withdrawal</dt>
                    <dd>Zero tax, federal and state. It also stays out of the provisional
                    income figure that decides how much of your Social Security is taxable, and
                    out of the MAGI that drives the net investment income tax and the senior
                    deduction phase-out. That second effect is invisible on a tax return but
                    worth real money.</dd>
                    <dt>Taxable brokerage withdrawal, and the gain percentage</dt>
                    <dd>Only the growth is taxable; the rest is your own basis coming
                    back untouched, which is why the gain percentage matters as much as the
                    withdrawal itself. Sell $40,000 from a position that is 30% gain and only
                    $12,000 hits the return. Everything here is assumed to be long-term, held
                    over a year, so it gets the preferential 0/15/20% rates rather than
                    ordinary ones.</dd>
                    <dt>Social Security benefits</dt>
                    <dd>Somewhere between none and 85% of the benefit becomes taxable, worked
                    out under the actual IRC &sect;86 formula rather than assumed. What drives
                    it is provisional income, everything else on the return plus half
                    your benefits, against thresholds of $25,000 and $34,000 single, or
                    $32,000 and $44,000 joint. Those four numbers were set in 1983 and 1993 and
                    have never been indexed, which is why a rising share of retirees crosses
                    them every year.</dd>
                    <dt>Other ordinary income</dt>
                    <dd>Pensions, annuity payments, interest, non-qualified dividends, rental
                    income. Ordinary rates, no FICA.</dd>
                    <dt>Age 65 or older</dt>
                    <dd>Two separate deductions stack on top of the regular standard deduction.
                    The long-standing age add-on is $2,050 for a single filer or $1,650 per
                    qualifying spouse, and needs the standard deduction. The newer senior
                    deduction from the 2025 tax act (OBBBA &sect;70103) is $6,000 per
                    qualifying person, runs only through 2028, is available to itemizers too,
                    and shrinks by 6 cents per dollar of income above $75,000 single or
                    $150,000 joint. A single filer 65 and over can reach $24,150 of deduction
                    against the $16,100 a younger filer gets.</dd>
                  </dl>
                  <p><b>Why gains stack.</b> Long-term gains do not get their own run at the
                  brackets. Ordinary income fills the brackets first and then acts as the floor
                  the gain sits on, so what the gain costs depends on what else you withdrew
                  that year. In 2026 the 0% band runs to $49,450 of total taxable income single
                  and $98,900 joint, 15% to $545,500 and $613,700, and 20% above. The stacking
                  chart draws exactly this: your ordinary income as the floor, the gain on top
                  of it, and the band boundaries it crosses. Where there is unused room in the
                  0% band the tool tells you how much, because that headroom is the whole basis
                  of gain harvesting.</p>
                  <p><b>Why the marginal rate isn&apos;t the bracket.</b> On a salary, the rate on
                  your next dollar is just the bracket you are in. In retirement it usually
                  isn&apos;t. Another $1,000 from a traditional account can pull several hundred
                  dollars of Social Security into the tax base alongside it, and can shove gain
                  out of the 0% band into the 15% band, so the real cost of that $1,000 runs
                  well above the nominal rate through a wide band of middle incomes. Rather
                  than report the bracket and call it the marginal rate, this runs the entire
                  calculation a second time with $1,000 more of ordinary income and reports
                  what actually changed. A 12% bracket showing a 22% marginal rate is not a bug;
                  it is the effect worth planning around.</p>
                  <p><b>The 3.8% surtax.</b> Above $200,000 of MAGI single or $250,000 joint,
                  the net investment income tax applies to the lesser of your investment income
                  and the amount you are over the line, on top of the capital gain rate,
                  not instead of it. Those thresholds are statutory and have never been indexed
                  either.</p>
                  <p><b>Pension / annuity, and why it has its own field.</b> Pension income
                  is split out from Other ordinary income because state law splits it out.
                  A dozen states exempt government pensions in full while taxing private
                  ones at full rates, and most states that give a retirement exclusion give
                  it to pensions and retirement-account withdrawals but not to interest or
                  rent. Federally the distinction does not exist; it is all ordinary
                  income, so it changes only the state figure, but it can change it
                  by thousands.</p>
                  <p><b>States, in full.</b> Every state that taxes income is modeled on
                  its own retirement rules, not just its brackets: whether Social Security
                  is in the base, what pension and retirement-account income is excluded
                  and up to what ceiling, what extra deduction, exemption or credit arrives
                  at 65, and how long-term gain is treated. The rules are as of 1 January
                  2026 and include the phase-ins that finish this year. Select a state and
                  the per-source table explains in a line what it does.</p>
                  <p><b>Social Security.</b> Eight states still include some benefits in
                  taxable income for 2026: Colorado, Connecticut, Minnesota, Montana, New
                  Mexico, Rhode Island, Utah and Vermont. West Virginia finished phasing its
                  tax out effective this year, and Missouri, Kansas and Nebraska dropped off
                  earlier. Six of the eight are income-tested and the test is applied here:
                  Connecticut and Rhode Island cut off at fixed AGI thresholds,
                  Minnesota and Vermont phase out over a band, New Mexico is a cliff, and
                  Colorado exempts benefits outright at 65. Utah taxes benefits and then
                  hands back a credit for the tax on them, withdrawn above $54,000 single or
                  $90,000 joint; that credit is computed here. Montana alone taxes the
                  federal taxable amount flat, with no relief.</p>
                  <p><b>Where retirement income is barely taxed at all.</b> Illinois,
                  Mississippi and Pennsylvania take qualified retirement income out of the
                  base entirely (pensions, annuities, 401(k) and IRA withdrawals
                  alike), so in those three only the gain on a brokerage sale and
                  genuinely other income are left. Iowa has done the same since 2023 for
                  anyone 55 or older. Alabama and Hawaii exempt pension income in full but
                  still tax the retirement account. Michigan&apos;s deduction is fully restored
                  for 2026, the last step of its 2023 phase-in, at roughly $68,000 single
                  and $136,000 joint.</p>
                  <p><b>Where the exclusion has a ceiling or an income test.</b> Kentucky
                  gives $31,110 a person at any age; Georgia $65,000 a person at 65, against
                  unearned income of any kind; New York $20,000 a person on top of a full
                  exemption for government pensions; New Jersey up to $100,000 joint but on
                  a hard income test that steps to nothing by $200,000; Connecticut a full
                  exemption below $75,000 single or $100,000 joint, phased out over the next
                  $25,000. Maine and Maryland reduce their exclusions dollar for dollar by
                  the Social Security you receive, which for a large benefit can consume
                  them outright. South Carolina, Virginia, West Virginia and Montana give a
                  flat deduction at 65 against income of any kind rather than a retirement
                  exclusion; Virginia&apos;s is withdrawn dollar for dollar above $50,000 single
                  or $75,000 joint.</p>
                  <p><b>State capital gain treatment.</b> Most states tax long-term gain at
                  their ordinary rates, and that is the default here. The exceptions are
                  modeled: Arkansas excludes 50%, South Carolina 44%, New Mexico and North
                  Dakota 40%, Wisconsin 30%, Vermont a flat $5,000. Hawaii caps the rate on
                  gain at 7.25% and Montana taxes it at reduced rates of 3.0% and 4.1%, both
                  as alternative computations that can never cost more than ordinary
                  treatment.</p>
                  <p><b>What the state figure still leaves out.</b> Age thresholds below 65
                  are treated as met only when you mark someone 65 or older, so a 62-year-old
                  in Georgia or New Jersey, or a 60-year-old in Delaware, is shown a higher
                  state bill than they would actually pay. Per-person exclusions are applied
                  per qualifying person without checking which spouse the income belongs to.
                  Occupational carve-outs (military, police, fire, railroad, federal
                  Civil Service) and rules that turn on a birth year rather than an
                  age are not modeled, and they are generous where they apply. Neither are
                  local and city income taxes, which matter most in Maryland, New York City,
                  Ohio and the Portland area. Also absent everywhere: short-term gains and
                  non-qualified dividends, which would be taxed as ordinary income; qualified
                  charitable distributions; IRMAA Medicare premium surcharges, which behave
                  like a tax cliff just above these thresholds; the Alternative Minimum Tax;
                  and state credits that phase out on income in ways too intricate to
                  generalize. Treat the federal number as solid and the state number as a
                  good estimate rather than a return.</p>
                </Section>
                <Section id="budget">
                  <p>Two tabs. <b>Budget</b> lays out what you spend. <b>Paycheck</b> starts from
                  your gross pay, takes out the taxes and that budget, and plans where the rest of
                  each paycheck goes.</p>
                  <p>In your dashboard the Budget tab is <b>Spending</b> and the Paycheck tab is{" "}
                  <b>Savings</b>, and what you change there is your plan&apos;s.</p>

                  <h4>Budget</h4>
                  <p>What you spend, line by line, grouped by category and totaled per month and
                  per year. Your pay isn&apos;t entered here; it&apos;s on the Paycheck tab. Each line
                  has its own amount and a per-month or per-year switch, because some costs are
                  naturally one and some the other: rent is monthly, travel and car repairs are
                  easier to think of as a yearly lump. Everything is converted to a common basis
                  before totaling, so mixing the two is fine.</p>
                  <dl className="gloss">
                    <dt>The preset rows</dt>
                    <dd>A starting point, not a rulebook. Leave anything at zero to ignore it.</dd>
                    <dt>Adding and removing lines</dt>
                    <dd>The + beside a group&apos;s name adds a blank line to that group, counted
                    with it in Where it goes. Add custom item adds one under Custom, for anything
                    that fits no group. Click a line&apos;s name to rename it, and the × removes it.
                    Health insurance is the one fixed line: the Paycheck tab reads it as your
                    premiums, so it keeps its name.</dd>
                    <dt>+ College savings</dt>
                    <dd>Pulls the monthly amount the College Savings tool works out, instead of
                    retyping it.</dd>
                    <dt>Where it goes</dt>
                    <dd>Each group&apos;s share of the total, with yearly bills spread over the year.</dd>
                    <dt>Emergency fund</dt>
                    <dd>A target in months of your expenses, six unless you change it, and what
                    that comes to. Three to six months is a common starting goal. On{" "}
                    <b>Spending</b> you can also build an emergency budget, a second amount on
                    every line for what you&apos;d cut back to, and size the fund on it instead.</dd>
                  </dl>

                  <h4>Paycheck</h4>
                  <p>One paycheck from the top: gross pay, what comes out before tax, the taxes,
                  what lands in your bank, your budget, and what&apos;s left to save. The facts sit on
                  the left and the decisions on the right. Every change reruns the 2026 federal,
                  state and payroll taxes the Income Tax tool uses, so the effect of pre-tax saving
                  shows up in the same paycheck. A local income tax set in Income Tax comes out of
                  it too, as its own line.</p>
                  <dl className="gloss">
                    <dt>Your paycheck</dt>
                    <dd>Filing status first: single, married with one income, or married with two
                    incomes. Then gross pay for the year (each of yours with two incomes), how
                    often each of you is paid, and your state. With two incomes everything is
                    planned by the month, since two paychecks rarely line up, and taxed as one
                    joint return.</dd>
                    <dt>Through work</dt>
                    <dd>Health, dental and vision premiums per check, starting from the Budget&apos;s
                    Health insurance line; set them to 0 if your coverage isn&apos;t through work and
                    that line stays an expense. The employer 401(k) match, as a rate on the first
                    share of pay, one for each job. And HSA coverage, which sets the HSA limit:
                    self-only or family, and with two incomes, one self-only plan, one each, or
                    family.</dd>
                    <dt>The results</dt>
                    <dd><b>Saved and invested</b> each check, as a share of gross pay, plus your
                    employer&apos;s match. <b>Free before saving</b> is pay less taxes and your budget
                    with nothing saved. <b>Still unassigned</b> is what has no place yet; it turns
                    into <b>Short</b> when more is assigned than the deposit covers. The chart
                    splits the paycheck into saving, taxes, expenses and what&apos;s unassigned.</dd>
                    <dt>Where the rest goes</dt>
                    <dd>One slider for each place money can go: the 401(k) up to the match, the
                    HSA, an IRA, the 401(k) beyond the match, taxable brokerage, and, if you add
                    one, an emergency fund. Each 401(k) line and the IRA switch between
                    traditional and Roth. <b>Max</b> fills a line to its 2026 limit, or to what&apos;s
                    left. A plan sets every slider at once: <b>The usual order</b> (the full match,
                    then the HSA, a Roth IRA, the rest of the 401(k) and brokerage), <b>Max tax
                    breaks</b> (everything pre-tax first, all traditional) or <b>Stay
                    flexible</b> (the match, then money you can reach before retirement: a Roth
                    IRA and brokerage). A traditional IRA shows how much of it is deductible at
                    your income. The Roth IRA isn&apos;t capped by income; past the 2026 income range
                    the line says to use a backdoor Roth instead.</dd>
                    <dt>Two incomes</dt>
                    <dd>The six lines stay six, each split between you: the match line goes to the
                    better match first, the 401(k) beyond it by each person&apos;s room under the
                    limit, and the HSA and IRA evenly. HSA money through payroll also skips Social
                    Security tax, but only on pay under the wage cap, so when one of you earns
                    above it the HSA comes out of the other&apos;s pay first.</dd>
                    <dt>Itemized paycheck</dt>
                    <dd>Every line per check, per month and per year (with two incomes, each of
                    your checks, then the household by the month and year): gross pay, the pre-tax
                    lines, federal and state income tax, Social Security and Medicare, the
                    deposit, your budget with its lines on demand, and the saving that comes out
                    of the deposit. It downloads as a CSV, and <b>Open in Income Tax</b> carries
                    the pay, state and pre-tax money over to that tool.</dd>
                    <dt>Federal brackets and state rules</dt>
                    <dd>Under the itemized paycheck, as on Income Tax: each federal bracket and
                    what you pay in it, then your state&apos;s rules and what the figures leave out.</dd>
                  </dl>
                </Section>
                <Section id="debt">
                  <p>Two well-known ways to clear several debts at once, and they differ in
                  exactly one respect: which debt gets the extra money. Everything else,
                  how much you pay each month, the minimums, the rates, is identical.</p>

                  <dl className="gloss">
                    <dt>Avalanche</dt>
                    <dd>Attack the highest interest rate first. This is arithmetically optimal:
                    no other ordering of the same dollars pays less interest. If the only thing
                    you care about is cost, the argument is over.</dd>

                    <dt>Snowball</dt>
                    <dd>Attack the smallest balance first, regardless of rate. It costs more,
                    sometimes a lot more, but it clears an entire debt sooner, and there is
                    decent evidence that people stick with it better. The tool prices that
                    directly: it shows how much earlier the first debt disappears, and what those
                    months cost you in interest. That is the real decision, and it is a personal
                    one rather than a mathematical one.</dd>

                    <dt>The rollover</dt>
                    <dd>The engine behind both. Your monthly payment is held fixed at the sum of
                    the original minimums plus anything extra. When a debt is cleared, its minimum
                    does not go back into your pocket; it rolls onto the next debt in line.
                    That is why the last debt gets paid off so much faster than the first, and why
                    both strategies crush paying minimums alone.</dd>

                    <dt>Minimums only</dt>
                    <dd>The third row of the comparison, and the one worth looking at. It pays each
                    minimum with no extra and no rollover, which is what happens by default if you
                    do nothing. On typical card balances it is usually decades and tens of
                    thousands of dollars worse.</dd>

                    <dt>Underwater minimums</dt>
                    <dd>If a minimum payment is smaller than one month of interest, the balance
                    grows no matter how long you pay. The tool flags this rather than quietly
                    projecting a payoff date sixty years out.</dd>
                  </dl>

                  <p><b>What it does not do.</b> Real credit card minimums are a percentage of the
                  balance, so they shrink as you pay down; this uses the fixed figure you
                  enter, which makes the projection slightly optimistic unless you keep paying the
                  original amount (which is what you should do anyway). Rates are fixed, so
                  promotional 0% periods, variable-rate cards and balance transfers are not
                  modeled, and neither is new borrowing. It also ignores the case for skipping all
                  of this and grabbing an employer match first: a 50% match beats paying off a 24%
                  card.</p>
                </Section>
                <Section id="mortgage">
                  <p>In your dashboard, owning a home, <b>Home</b> runs it on your own loan: your home&apos;s worth and what&apos;s owed, your rate, and the years left at your payment. What owning costs, set there, is your budget&apos;s housing lines.</p>
                  <p>Works out the full monthly cost of owning, not just the loan payment, and
                  shows how the balance falls over time.</p>
                  <p>Principal and interest use the standard amortization formula. Every payment
                  is the same size, but the split shifts: early on almost all of it is interest,
                  and only near the end does most of it go to principal. The chart makes that
                  crossover visible, and it&apos;s usually later than people expect.</p>
                  <dl className="gloss">
                    <dt>Down payment</dt>
                    <dd>Enter a percentage or a dollar amount; the other updates itself.</dd>
                    <dt>Interest rate</dt>
                    <dd>Pre-filled with a rounded recent national average for a 30-year fixed
                    loan, as a starting point rather than a live figure. Rates move weekly, and your own
                    depends on credit score, term, points and lender, so replace it with a
                    current quote.</dd>
                    <dt>PMI</dt>
                    <dd>Private mortgage insurance, charged when you put down less than 20%.
                    Typically 0.3&ndash;1.5% of the loan a year. Modeled here as ending once the
                    balance falls to 80% of the purchase price, which is when you can request
                    cancellation; federal law only forces automatic removal later, at 78%, if
                    you never ask.</dd>
                    <dt>Property tax and insurance</dt>
                    <dd>Pre-filled with rough national averages. Both vary enormously by
                    location: property tax alone ranges from well under 0.5% to over 2%
                    of value, so replace them with local figures if you have them.</dd>
                  </dl>
                  <p>The <b>Extra payments and refinancing</b> card under the payment opens extra
                  payments, a recast, and a refinance comparison &mdash; skip it entirely for a
                  quick estimate on a home you haven&apos;t bought yet.</p>
                  <dl className="gloss">
                    <dt>Extra payments</dt>
                    <dd>A recurring amount, a one-time amount, or both, applied straight to
                    principal. By default the required payment stays what it was &mdash; you&apos;re
                    just finishing early and paying less interest along the way.</dd>
                    <dt>Recast</dt>
                    <dd>After a one-time payment, choose to lower the monthly payment instead of
                    shortening the loan: the balance re-amortizes over whatever&apos;s left of the
                    original term, at the same rate. The payoff date doesn&apos;t move, but every
                    payment after that point is smaller. Lenders often charge $150&ndash;500 for
                    this, which isn&apos;t included.</dd>
                    <dt>Refinance comparison</dt>
                    <dd>Assumes you refinance today, on the loan as entered, into a new rate and
                    term with the same extra-payment plan carried over &mdash; so the comparison
                    isolates the refinance itself. Shows the new payment, how long closing costs
                    take to earn back in lower payments, and which loan costs less in total once
                    those costs are counted. Closing costs are assumed paid out of pocket rather
                    than rolled into the new balance.</dd>
                  </dl>
                  <p><b>What it leaves out:</b> closing costs rolled into the loan, adjustable
                  rates, cash-out refinancing, the mortgage interest deduction, and maintenance
                  beyond a flat percentage. A common rule of thumb is to budget roughly 1% of the
                  home&apos;s value a year for upkeep.</p>
                </Section>
              </Group>

              <Group id="methods">
                <Section id="historical">
                  <p>Monte Carlo asks what could happen if returns are drawn from a
                  distribution. Historical asks a different question: what would this plan
                  have done in the past that actually happened? It takes your contribution
                  schedule and runs it through every overlapping window of the real record,
                  January 1926 to December 2025, <b>compounding month by month</b>. A 30-year
                  plan gets 841 runs &mdash; one starting in each month from January 1926 to
                  January 1996.</p>
                  <p>The monthly step is the point. If the market falls 5% in March and you
                  contribute that month, you buy at March&apos;s lower level and get the full
                  benefit of whatever April does. Running a year as a single step averages
                  that away. It also means a quarterly contributor buys in March, June,
                  September and December rather than in twelve equal slices, and that
                  starting in July 1974 is a different plan from starting in January 1974.</p>
                  <p>Two inputs stop being used in this mode, and it is worth being clear
                  about which:</p>
                  <ul>
                    <li>Your <b>rate of return</b> is ignored. Returns come from the{" "}
                    <b>stock mix</b> instead: that share in the S&amp;P 500, the rest in
                    10-year Treasuries, rebalanced once a year. Fees still come off every
                    year.</li>
                    <li>Your <b>inflation</b> setting is ignored. Each window is converted to
                    today&apos;s dollars using the inflation that window actually had, so a run
                    through the 1970s is judged against 1970s prices.</li>
                  </ul>
                  <p>A <b>glide</b> works differently here too. There is no rate to glide, so
                  it walks the stock mix down instead, from your starting share to the ending
                  share over the final years of the plan.</p>
                  <p>The bands read the same way the Monte Carlo fan does, except each one is a
                  real stretch of history rather than a simulated draw. The line labeled worst
                  is not a bad scenario someone invented; it is a period people lived through
                  while saving. Worth knowing: the worst outcome for a saver is rarely the
                  crash, because a crash early buys shares cheaply for decades afterwards.
                  A long flat stretch just before retirement does more damage.</p>
                  <p><b>What it can&apos;t do.</b> A century is a single overlapping sample, heavily
                  US-biased, and the windows share almost all their months with each other,
                  so 841 runs are emphatically not 841 independent trials &mdash; consecutive
                  windows differ by one month at each end. A plan longer than 100 years has no
                  window to run in and the mode says so instead of guessing.</p>
                </Section>
                <Section id="montecarlo">
                  <p>The plain projection assumes you earn the same return every single year.
                  Real markets don&apos;t work that way, and the order of good and bad years matters:
                  a poor stretch early does more damage than the same stretch late, even at an
                  identical average.</p>
                  <p>Switching the chart to Monte Carlo runs your plan hundreds or thousands of
                  times, drawing each period&apos;s return at random from a distribution centered on
                  your expected return, with the spread set by <b>volatility</b>. The result is a
                  fan of outcomes rather than a single line.</p>
                  <ul>
                    <li>The <b>median</b> is the middle outcome: half of runs did better.</li>
                    <li>The <b>10th to 90th percentile</b> band covers 80% of runs. One run in
                    ten lands below the bottom edge.</li>
                    <li>The <b>dashed line</b> is the no-volatility projection. The median usually
                    sits below it. That gap is real and is called volatility drag.</li>
                    <li>The <b>success rate</b> is the share of runs that reached your target.</li>
                  </ul>
                  <p>Results are reproducible: the same inputs give the same fan every time.{" "}
                  <b>Re-roll</b> deliberately draws a fresh set.</p>
                </Section>
                <Section id="data">
                  <ul>
                    <li><b>Market history:</b> US stock prices, dividends and 10-year Treasury
                    yields from Robert Shiller&apos;s dataset (Yale); inflation is CPI-U from the
                    Bureau of Labor Statistics.</li>
                    <li><b>Taxes and benefits:</b> federal brackets, standard deductions and
                    payroll-tax limits from the IRS and the Social Security Administration;
                    Medicare from CMS; ACA premiums and subsidies from KFF and HHS.</li>
                    <li><b>What children cost:</b> the USDA&apos;s study of what families spend on a
                    child, brought to today&apos;s prices, and the Department of Labor&apos;s
                    childcare prices by county.</li>
                  </ul>
                  <p>Past returns are context, not a forecast. If a number looks wrong,{" "}
                  <a href="#about-contact">email it in</a>.</p>
                </Section>
              </Group>

              <FinePrint />
            </div>
          </div>
        </div>
      </OpenCtx.Provider>
    </Frame>
  );
}
