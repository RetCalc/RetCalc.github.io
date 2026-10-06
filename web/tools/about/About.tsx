"use client";

/* The About page: the theme, your household, what the site is and how
   every tool works, and the fine print. Every panel after the first two
   folds shut until opened. Converted from src/main/09-about.html with
   web/scripts/html2jsx.py; the panels' folding from initAboutCollapse()
   and toggleAbout() in src/js/app/19-widgets-theme.js. */

import { useEffect, useRef, useState } from "react";
import { HouseholdBar } from "@/components/household/HouseholdBar";
import type { StateOption } from "@/lib/states";
import { setThemeChoice, useThemeChoice, type ThemeChoice } from "@/lib/theme";
import { Badge } from "@/components/ui/badge";

const SWEEP = 300;

/** A panel that folds: closed until its heading is clicked, sweeping open
    and shut (and reversing from wherever it is if clicked mid-sweep). */
function AboutPanel({ title, fixed, kind, children }: { title: string; fixed?: boolean; kind?: "disclaimer"; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null), timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  if (fixed || kind) return (
    <div className={"panel about " + (fixed ? "no-collapse" : kind)}><h2>{title}</h2><div className="body">{children}</div></div>
  );
  const toggle = () => {
    const w = wrap.current;
    const next = !open;
    setOpen(next);
    let reduce = false;
    try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { /* old browsers */ }
    if (!w || reduce) return;
    const from = w.getBoundingClientRect().height;
    clearTimeout(timer.current);
    w.style.display = "block";
    w.style.transition = "none";
    w.style.height = "auto";
    const full = w.scrollHeight;
    w.style.height = from + "px";
    void w.offsetHeight;
    w.style.transition = "height " + SWEEP / 1000 + "s cubic-bezier(.25,.8,.3,1)";
    w.style.height = (next ? full : 0) + "px";
    const done = () => {
      clearTimeout(timer.current);
      w.removeEventListener("transitionend", done);
      w.style.transition = w.style.height = w.style.display = "";
    };
    // transitionend can be skipped if the page changes mid-sweep
    timer.current = setTimeout(done, SWEEP + 60);
    w.addEventListener("transitionend", done);
  };
  return (
    <div className={"panel about" + (open ? "" : " collapsed")}>
      <h2 role="button" tabIndex={0} aria-expanded={open} onClick={toggle}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}>{title}<span className="about-chevron"><svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M5 6l3 3 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg></span></h2>
      <div className="about-collapse" ref={wrap}><div className="body">{children}</div></div>
    </div>
  );
}

/* The address is put together in the browser, so it isn't sitting in the
   page for address-harvesting bots. */
function MailMe({ user, domain }: { user: string; domain: string }) {
  const [addr, setAddr] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- only assembled once the page is in a browser
  useEffect(() => setAddr(user + "@" + domain), [user, domain]);
  return <a className="mailme" href={addr ? "mailto:" + addr : "#"}>{addr ?? user + " [at] " + domain}</a>;
}

function ThemeRow() {
  const choice = useThemeChoice();
  const opts: [ThemeChoice, string][] = [["system", "System"], ["dark", "Dark"], ["light", "Light"]];
  return (
    <div className="themerow">
      <span>Theme</span>
      <span className="seg" id="segTheme">
        {opts.map(([k, label]) => <button key={k} type="button" data-theme={k} className={choice === k ? "on" : undefined} onClick={() => setThemeChoice(k)}>{label}</button>)}
      </span>
    </div>
  );
}

export function About({ states }: { states: StateOption[] }) {
  return (
    <div className="stack" role="tabpanel" id="tab-about">
      <div className="panel about no-collapse"><h2>Appearance</h2><div className="body"><ThemeRow /></div></div>
      <div id="hhAboutSlot"><HouseholdBar states={states} inAbout /></div>
      <AboutPanel title="What this is" fixed>
        <p>A personal finance calculator built around one question: are you on track?
        You describe your savings, contributions, and expected returns, and it projects
        where you land at retirement, how long that money lasts, and what it all means
        in today&apos;s dollars. Everything runs in your browser; nothing is sent anywhere.</p>
        <p>The Guide tab is the place to start if you&apos;re not sure where you stand: it
        asks about your money one question at a time, gives you a readiness score, and
        walks you through whichever tool finds an answer you don&apos;t know.</p>
        <p>The core retirement planner, under the Calculator tab, has three modes for
        different levels of detail, from a five-question starting point (Basic) to a
        full multi-stage model (Stages). The Tools tab
        extends that with calculators for taxes, mortgage, college savings, rent vs.
        buy, drawdown, FIRE planning, budget, and more. Each tool is described in
        its own section below.</p>
        <p><b>Your household</b>, the bar above every tool, holds the facts most
        tools ask for: ages, when you plan to retire, state, savings, income and
        retirement spending. Saving it fills those numbers into Basic, Advanced,
        Stages, Drawdown, Roth Conversion, Healthcare, Income Tax, Budget and FIRE,
        and it fills them in again each time you open the site or reset a tool. It&apos;s
        a one-way fill: changing a number inside a tool never changes the profile or
        any other tool. A shared link opens with its own numbers, not your profile.</p>
      </AboutPanel>
      <AboutPanel title="How the projection works">
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
      </AboutPanel>
      <AboutPanel title="Basic">
        <p>The Basic tab answers five questions and nothing more: your age, when you
        want to stop working, what you&apos;ve saved, what you add, and roughly how it&apos;s
        invested. It&apos;s the right starting point if retirement planning is new to you.</p>
        <p>What makes it simple is that it works in <b>real</b> terms. The investment
        choices are stated as growth <i>after</i> inflation, so every number you see is
        already in today&apos;s dollars, with no separate inflation setting and no mental
        translation of what $2 million means in forty years.</p>
        <p>That simplicity costs you two things. It assumes you nudge your
        contribution up a little each year to keep pace with inflation; if you set
        $500 a month and never change it, real progress will be slower than shown. And
        it ignores tax and fees entirely, so the income figure is before both.</p>
        <p>The investment choices map to these rates of growth after inflation:</p>
        <dl className="gloss">
          <dt>Very conservative &middot; 2.0%</dt>
          <dd>Mostly cash and bonds. Steady, and barely ahead of rising prices.</dd>
          <dt>Conservative &middot; 3.0%</dt>
          <dd>Bond heavy, with a slice of stocks.</dd>
          <dt>Balanced &middot; 4.5%</dt>
          <dd>A mix of stocks and bonds. A common middle-of-the-road choice.</dd>
          <dt>Growth &middot; 5.75%</dt>
          <dd>Mostly stocks. Bigger swings, more expected over long periods.</dd>
          <dt>Aggressive &middot; 7.0%</dt>
          <dd>Nearly all stocks. Roughly what US stocks have returned after inflation
          over the very long run: an optimistic ceiling, not a floor.</dd>
        </dl>
        <p>The shaded band on the chart shows the same plan running 1.5 points better
        or worse, because no one earns an identical return every year. When you want
        tax, fees, volatility or changing assumptions, <b>Open these numbers in
        Advanced</b> carries your answers to the Advanced tab, splitting the real
        rate back into a return and 3% inflation (Advanced&apos;s own default), with contributions set to rise
        alongside it. Basic&apos;s own contribution already steps up once a year behind
        the scenes, the same way Advanced&apos;s does, so the inflation-adjusted total
        should land on the Basic figure almost exactly. Advanced does apply a 10%
        tax rate that Basic ignores, so the income figure will drop.</p>
      </AboutPanel>
      <AboutPanel title="Advanced">
        <p>The Advanced tab holds one set of assumptions for the whole period, but
        goes further than Basic in almost every direction: return and inflation as
        two separate figures instead of one blended real rate, an effective tax
        rate, fees, volatility for Monte Carlo, and two routes to solve backwards
        from a target. It&apos;s also where the historical comparison band, the Monte
        Carlo fan, and a Coast FIRE date once you&apos;ve set a target all live.</p>
        <dl className="gloss">
          <dt>Starting value</dt>
          <dd>What the account is worth today. Zero is fine.</dd>

          <dt>Contribution &amp; period</dt>
          <dd>What you add each time, and how often. Match it to how you actually
          save, whether per paycheck or per month. The <b>Convert frequency</b>{" "}
          link under the period translates between schedules.</dd>

          <dt>Contribution growth</dt>
          <dd>How much the contribution amount itself increases each year, as a
          percentage. It is a rate in its own right, not something added on top of
          the inflation figure. Match it to your inflation rate to keep contributions
          flat in today&apos;s dollars; match it to your expected raises to keep them a
          steady share of your income. Typical: 0&ndash;5%.</dd>

          <dt>Time period</dt>
          <dd>Years until you start drawing on the money.</dd>

          <dt>Rate of return</dt>
          <dd>Expected average annual return before inflation. For context, broad US
          stock indices have averaged roughly 9&ndash;10% a year over the very long
          run, bonds far less, and a mixed portfolio somewhere between. Many planners
          use 6&ndash;8% for a stock-heavy portfolio to stay conservative. Lower it as
          you shift toward bonds. The &plusmn; button lets you enter a negative return to
          stress-test a downturn.</dd>

          <dt>Glide path <Badge variant="outline" className="ml-1.25">optional</Badge></dt>
          <dd>Holds your rate of return steady, then blends it down in a straight
          line to an end rate over however many final years you choose: the
          common practice of shifting toward bonds as retirement nears. It shapes
          the projection, the chart, and both routes to a target.</dd>

          <dt>Inflation</dt>
          <dd>How fast prices rise. Long-run US inflation has averaged roughly 2&ndash;3%.
          The US Federal Reserve targets 2%. Most people use 2.5&ndash;3%.</dd>

          <dt>Volatility <Badge variant="outline" className="ml-1.25">Monte Carlo only</Badge></dt>
          <dd>How much returns bounce around year to year. Broad stock funds have
          historically run near 15&ndash;18%; a balanced stock-and-bond portfolio nearer
          8&ndash;12%; bond-heavy lower still. Higher volatility widens the fan without
          changing the average.</dd>

          <dt>Fees <Badge variant="outline" className="ml-1.25">optional</Badge></dt>
          <dd>Expense ratios plus any advisory fee, subtracted from your return. Index
          funds often charge under 0.10%; actively managed funds frequently 0.5&ndash;1%;
          advisors commonly around 1%. Leave at 0 to ignore. The Milestones panel shows
          what fees cost you over the full period, which is usually larger than expected.</dd>

          <dt>Withdrawal rate</dt>
          <dd>The share of the portfolio you take in the first year of retirement. The
          widely cited starting point is <b>4%</b>, from research suggesting that rate
          survived historical 30-year retirements. It is a rule of thumb, not a
          guarantee; some argue for 3&ndash;3.5% given today&apos;s conditions, others for more
          flexibility year to year.</dd>

          <dt>Effective tax rate</dt>
          <dd>The share of withdrawals lost to tax: your <i>average</i> rate, not your
          top bracket. It depends heavily on account type: withdrawals from a
          traditional 401(k) or IRA are generally taxed as income, Roth withdrawals
          generally are not, and taxable brokerage accounts are usually taxed at
          capital-gains rates. Many retirees land somewhere in the 10&ndash;15% range,
          but this varies enormously. Use 0 for an all-Roth plan.</dd>

          <dt>Split by account type <Badge variant="outline" className="ml-1.25">optional</Badge></dt>
          <dd>Swaps the single starting value, contribution and tax rate for a
          balance and contribution in each of traditional, Roth and taxable brokerage
          accounts, plus an employer match and your filing status and state. Every
          account grows at the same return, so the projection is unchanged; what
          changes is the tax. The first year&apos;s withdrawal is taken from each account in
          proportion to its balance and taxed with the 2026 rules the Income Tax tool
          uses: traditional as ordinary income, only the growth in the brokerage account
          at capital-gain rates, and Roth not at all. Contributions aren&apos;t capped at the
          annual limits, since backdoor and mega backdoor Roth strategies can go past
          them; enter what you actually put in. Switching back to one total
          carries the totals and the calculated rate across, so the answer doesn&apos;t jump.</dd>

          <dt>Target</dt>
          <dd>What you&apos;re aiming for, in today&apos;s dollars, either an after-tax income
          or a portfolio balance, your choice. It drives the two solve routes, the
          Coast FIRE figure, and the Monte Carlo success rate. On the Stages tab the
          solve changes <i>the final stage only</i>; see that section.</dd>
        </dl>
        <p>Once you&apos;ve got a projection, here&apos;s what the results panel is showing:</p>
        <dl className="gloss">
          <dt>Future value</dt>
          <dd>The balance at the end, in the dollars of that future year.</dd>
          <dt>Inflation adjusted</dt>
          <dd>The same balance expressed in today&apos;s spending power. This is the more
          meaningful of the two, and it is the smaller number at any inflation
          rate above zero.</dd>
          <dt>After-tax income, per year</dt>
          <dd>Withdrawal rate applied to the inflation-adjusted balance, less tax.
          Roughly what the portfolio could pay you in its first year of retirement,
          in money you can compare to your salary today.</dd>
          <dt>Amount invested vs. growth</dt>
          <dd>What you contributed versus what the market added. Over long periods
          growth typically overtakes contributions by a wide margin.</dd>
          <dt>Crossover</dt>
          <dd>The year your portfolio&apos;s growth first exceeds what you put in that year.
          After it, the account is doing more of the work than you are.</dd>
          <dt>Work backwards from a target</dt>
          <dd>Two routes to the same goal: raise the contribution, or extend the
          timeline. Either button applies its change to your inputs. On the Stages tab
          both routes act on the final stage. Both follow a glide if you have one
          set, and the timeline route re-anchors it: land on 26 years with a 5-year
          glide and the ramp runs years 22 through 26, not 26 through 30.</dd>
          <dt>Coast FIRE</dt>
          <dd>How far you are from the point where contributions could stop entirely
          and growth alone would still reach your target on schedule.</dd>
        </dl>
      </AboutPanel>
      <AboutPanel title="Stages">
        <p>Stages chains several periods together instead of holding one set of
        assumptions for the whole timeline. Use it for a raise partway through your
        career, a stretch of lighter contributions, or shifting toward a more
        conservative mix as retirement nears, anything that changes partway
        through the plan. Each stage has its own length, contribution, growth rate
        and return, and builds on whatever balance the stage before it left behind.</p>
        <p>Every input and result works the same way it does on the Advanced tab;
        see that section for what each one means. A few things are specific
        to Stages:</p>
        <dl className="gloss">
          <dt>Inflation adjusted <Badge variant="outline" className="ml-1.25">stage 2 onward</Badge></dt>
          <dd>Restates the contribution you typed into that stage&apos;s future dollars.
          Type $3,000 for a stage starting in year 5 at 2.5% inflation and it&apos;s
          modeled as $3,394, the amount that <i>feels like</i> $3,000 by
          then. The stage&apos;s own growth rate compounds from there. Turn it off to
          use the number exactly as typed.</dd>

          <dt>Glide path <Badge variant="outline" className="ml-1.25">final stage only</Badge></dt>
          <dd>Available on the last stage only, since that&apos;s the one closest to
          retirement; earlier stages don&apos;t get the option. Works the same
          way as on the Advanced tab: holds steady, then blends down to an end rate
          over however many final years you choose within that stage.</dd>

          <dt>Target <Badge variant="outline" className="ml-1.25">solving</Badge></dt>
          <dd>The solve, and &quot;Work backwards from a target&quot; on the results side,
          change <i>the final stage only</i>. Everything before it is treated as
          settled, which is what makes the answer meaningful when stages carry
          different assumptions.</dd>

          <dt>Split by account type <Badge variant="outline" className="ml-1.25">optional</Badge></dt>
          <dd>Works like the Advanced version, spread across stages. Starting
          balances, the employer match and your filing status and state are set once
          for the whole run; each stage card then says where that stage&apos;s
          contribution goes: a share to traditional, a share to Roth, and the rest to
          the taxable brokerage account. That lets a plan go Roth early in a career
          and traditional later, and the tax on your retirement income reflects the
          mix you end up with. The employer match works as on Advanced, from your
          salary, the match rate and the share of salary it applies to; your salary is
          assumed to grow at each stage&apos;s contribution growth rate.</dd>
        </dl>
      </AboutPanel>
      <AboutPanel title="Retirement Readiness Guide">
        <p>The Guide tab walks through your finances one question at a time, in the
        order a planner would: income, take-home pay, spending, emergency fund, debt,
        housing, college, then retirement. When you don&apos;t know an answer, the step
        opens the tool on this site that finds it, filled in with what you&apos;ve told the
        guide, and a panel docked over the tool lists what to do there and ticks items
        off as you go. <b>Back to guide</b> brings the result with you. Your answers
        are kept in this browser only, and the facts the household bar also holds
        (ages, state, income, savings, spending) are written through to it.</p>
        <p>As you answer, a readiness score out of 100 builds from five areas:
        the retirement outlook (40 points), savings rate (20), emergency fund (15),
        debt (15) and monthly cash flow (10). It appears once two areas are answered,
        and ends in an ordered list of next moves, each with the tool that does it.</p>
        <dl className="gloss">
          <dt>Retirement outlook</dt>
          <dd>Your savings are projected to your retirement age the same way the Basic
          tab does it: a steady return after inflation for the mix you pick, with
          contributions (yours and your employer&apos;s) raised with inflation each year so
          they stay the same in today&apos;s dollars. Each account type grows on its own:
          traditional, Roth and a taxable brokerage account, split the way you answer,
          with new saving going where you say and any employer match into traditional.
          The retirement is then run year by year through every historical market since
          1926 by the plan engine the Plan Optimizer uses, living on a fixed amount after
          tax that rises with inflation until you, or the younger of you and a spouse,
          reach 95. The outlook is the share of those retirements where the money
          lasted, and the guide also solves for what you&apos;d need saved by retirement to
          last in 90% of them.</dd>

          <dt>Social Security and pensions</dt>
          <dd>Estimated from your income and the years you&apos;ll have worked by
          retirement, counted from 22, since Social Security averages your best 35
          years and missing years count as zeros. A lower-earning spouse gets at least
          half the higher earner&apos;s benefit. It starts at 67, or at retirement if that&apos;s
          later, unless you choose a claiming age from 62 to 70; a figure from your
          Social Security statement replaces the estimate and is scaled for the age you
          claim. A pension or other steady income can be added with its own start age,
          fixed or rising with inflation.</dd>

          <dt>Adjust your plan</dt>
          <dd>Compares your plan with what it needs and offers ways to change it,
          each solved against a target: plans that lasted in 90%, 95% or every
          historical retirement. Ahead of target, it finds how much earlier you could
          retire, the age you could stop contributing and coast, how much less you
          could save, or how much more you could spend. Behind, it finds how much more
          to save, how much later to retire, or how much less to spend.{" "}
          <b>Balance it</b> combines the changes you allow, moving each the same share
          of the way to its own answer, and finds the smallest combination that
          reaches the target (or the most the plan can afford, when ahead).{" "}
          <b>Try your own numbers</b> takes any mix. Each option is drawn against your
          current plan on a chart and a before/after table, and <b>Apply to my plan</b>{" "}
          makes it your plan, with Undo.</dd>

          <dt>Drawing it down</dt>
          <dd>Runs all six of the Drawdown Simulator&apos;s withdrawal strategies on your
          plan and shows, for each, how often the money lasted, a typical year&apos;s
          spending and the leanest single year on record. A <b>minimum yearly
          spending</b> sets a floor the flexible strategies never go below while money
          remains, which shows what that floor costs in safety. The score itself
          always tests the fixed approach, the cautious case. From here, a seven-part
          tour of the Drawdown Simulator covers your result, a bad starting year, each
          strategy, your stock mix, Social Security timing, one-time costs and extra
          income, and stress tests; a strategy, mix, claiming age or minimum you
          change there comes back into your plan.</dd>

          <dt>Taxes and health insurance</dt>
          <dd>Retirement spending is what you live on after tax. Every year, the plan
          works out the 2026 federal and state income tax on where that year&apos;s money
          came from (traditional withdrawals as income, Roth withdrawals free, brokerage
          sales on their gain, part of Social Security by its own formula), Medicare&apos;s
          income surcharge on a two-year lookback, the 10% additional tax on traditional
          money taken before 59½, required minimum distributions from 73 or 75, and,
          before 65, a marketplace health plan less the subsidy that year&apos;s income earns.
          Unless you apply the Plan Optimizer&apos;s roadmap, withdrawals come from the
          brokerage first, then traditional, then Roth. Home equity isn&apos;t counted.</dd>

          <dt>Plan Optimizer</dt>
          <dd>Near the end, the guide hands your plan to the Plan Optimizer (below),
          which searches every claiming age, withdrawal order, Roth conversion level and
          income guard for the best way to run it. <b>Use this plan</b> makes its
          roadmap your plan&apos;s own, with Undo: the score, the projection and every step
          then test it.</dd>

          <dt>Save, share and print</dt>
          <dd>With the Guide tab open, <b>Save/Delete</b> saves your answers and plan
          under a name, like any other tool&apos;s scenario, and picking it from the list
          later loads the whole plan back, household bar included. From the results,
          or the Share button while on the Guide tab, print the
          finished plan on one page or copy a link that opens it in the guide. The link
          carries your answers (not your budget or debt lists), so share it only with
          people you&apos;d show your finances to. Someone opening it who has guide answers
          of their own is asked before theirs are replaced.</dd>
        </dl>
      </AboutPanel>
      <AboutPanel title="Plan Optimizer">
        <p>Once you know when you&apos;ll retire and what you&apos;ll spend, the rest is tactics,
        and they&apos;re worth a lot: when each of you claims Social Security, which account
        each year&apos;s money comes from, and how much to move from traditional to Roth
        while your income is low. The Plan Optimizer tries every combination and keeps
        the best, for the goal you pick.</p>
        <dl className="gloss">
          <dt>Where it starts</dt>
          <dd><b>Retirement day</b>, the default, starts from the balances you&apos;ll have
          when you retire, by account type, in today&apos;s dollars. Type them in, or use{" "}
          <b>Copy from Advanced or Stages</b> once either has <b>Split by account
          type</b> turned on: they project each account to retirement with their own
          contribution growth, fees, employer match, glide path and stages, and the
          optimizer takes it from there. <b>Today</b> starts from what you have now and
          what you save each month, and grows each account to retirement at a steady
          return after inflation first; its copy button brings over Advanced&apos;s or
          Stages&apos; current balances, monthly saving and return.</dd>

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
          runs in your browser, off the page&apos;s main thread, and nothing you enter is
          sent anywhere.</dd>

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
          dollars. It doesn&apos;t use 72(t) payments or 457(b) plans (the Early Retirement
          Bridge compares those), and it doesn&apos;t change your retirement age, saving or
          spending: the readiness guide&apos;s Adjust your plan step does that.</dd>
        </dl>
      </AboutPanel>
      <AboutPanel title="Drawdown Simulator">
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
      </AboutPanel>
      <AboutPanel title="Early Retirement Bridge">
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
          and brokerage accounts. From there, one button starts the Drawdown Simulator
          with that total, and another loads a year of withdrawals into Income Tax&apos;s
          retirement mode.</dd>
        </dl>
        <p><b>What it does not do.</b> Everything is one household with one age, and
        both spouses&apos; accounts are treated as one person&apos;s. Payroll tax is counted on
        part-time pay, but not the earned income credit or Roth contributions from that
        pay. The 72(t) annuitization method, HSAs, the SECURE 2.0 emergency and
        disability exceptions and state-specific exclusions that depend on age
        are left out, and the ACA premium uses your state&apos;s average benchmark plan
        unless you enter your own. Brackets and thresholds are held fixed in real
        terms.</p>
      </AboutPanel>
      <AboutPanel title="Portfolio Backtest">
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
        near 10% a year over the period.</p>
        <p><b>The assumptions.</b> Stock returns are S&amp;P 500 total return with
        dividends reinvested, and bond returns include the coupon, not just the price
        move &mdash; which is why stocks here compound near 10% a year rather than the
        6&ndash;7% price-only figure people often have in mind. Annual rebalancing, no
        fees, no taxes, no trading costs, so weigh in your own fund&apos;s expense ratio
        separately. The growth chart runs from a fixed $10,000, since
        that changes the dollar amounts but nothing else about the mix&apos;s behavior.
        The bond series is 10-year Treasuries, not a broad bond fund. Past returns
        describe what happened; they are not a forecast, and the further back the
        data goes the less the world it describes resembles this one.</p>
      </AboutPanel>
      <AboutPanel title="Income Tax">
        <p>Two modes, switched at the top of the input panel. <b>Normal income</b>{" "}
        estimates what you keep from a salary after federal income tax, state income
        tax and FICA. <b>Retirement income</b> answers a different question: you are
        no longer earning a paycheck, you are drawing one down, and what a
        withdrawal costs depends entirely on which account it comes out of.</p>
        <p><b>The numbers are tax year 2026.</b> Federal brackets, the standard
        deduction and FICA limits come from the IRS inflation adjustments
        (Rev. Proc. 2025-32). State brackets, standard deductions and personal
        exemptions are as of 1 January 2026. Standard deduction is $16,100 single and
        $32,200 married filing jointly. Social Security is 6.2% on the first $184,500,
        Medicare 1.45% on everything, plus a 0.9% surtax above $200,000 single or
        $250,000 joint.</p>
        <h3>Normal income</h3>
        <dl className="gloss">
          <dt>Gross income</dt>
          <dd>Salary before anything is taken out.</dd>
          <dt>Pre-tax deductions</dt>
          <dd>Traditional 401(k), HSA, and health premiums. These reduce income tax
          but <i>not</i> Social Security and Medicare, which is why the FICA figure
          doesn&apos;t move at all when you raise them.</dd>
          <dt>Standard vs itemized</dt>
          <dd>You take whichever is larger. Most people take the standard deduction;
          itemizing wins mainly with a big mortgage, large charitable giving, or high
          state and local taxes.</dd>
          <dt>Effective vs marginal rate</dt>
          <dd>Marginal is the rate on your <i>next</i> dollar. Effective is what you
          actually paid across all your income, and it&apos;s always lower. A single filer
          on $100,000 sits in the 22% bracket but pays about 13% of income in federal
          tax.</dd>
        </dl>
        <p><b>What Normal income mode leaves out:</b> tax credits (child tax credit,
        earned income credit), local and city income taxes, the Alternative Minimum
        Tax, capital gains and investment income, self-employment tax,
        head-of-household and married-filing-separately status, state credits and
        phase-outs, and the extra deductions available at 65 and over. Most states
        phase out deductions at higher incomes in ways this doesn&apos;t model; Illinois
        is the one exception, since its exemption cliff at $250,000 / $500,000 of
        income is applied. Treat the result as a solid estimate, not a tax return.</p>

        <h3>Retirement income</h3>
        <p>A salary is one kind of income taxed one way. A year of retirement
        spending is usually four or five kinds of income taxed four or five different
        ways, and the total bill depends less on how much you withdraw than on which
        accounts you withdraw it from. Instead of one gross income figure, you enter
        each source separately; the tool totals them for reference and then taxes
        each one on its own terms. There is no FICA, because none of it is wages, and
        no net pay vs. take-home switch, because you are no longer contributing to
        anything.</p>
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
      </AboutPanel>
      <AboutPanel title="Roth Conversion & RMDs">
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
      </AboutPanel>
      <AboutPanel title="Mortgage Calculator">
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
          <dd>Pre-filled with 6.71%, the Freddie Mac national average for a 30-year
          fixed loan as of 3 September 2026. Rates move weekly, and your own depends on
          credit score, term, points and lender, so replace it with a current quote.</dd>
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
        <p>The <b>Already have this loan?</b> toggle below the main inputs opens extra
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
      </AboutPanel>
      <AboutPanel title="College Savings">
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
          elsewhere in this app, often 3&ndash;5% a year versus the 2&ndash;3%
          typical of general prices. The default reflects that gap.</dd>
        </dl>
        <p><b>What it leaves out:</b> financial aid, scholarships, 529 plan tax
        advantages, and the possibility of a shorter or longer program than four
        years unless you change that input yourself.</p>
      </AboutPanel>
      <AboutPanel title="Rent vs. Buy">
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
      </AboutPanel>
      <AboutPanel title="Budget">
        <p>A simple worksheet for laying out where your money goes and seeing what&apos;s
        left. It starts with your income after taxes, lists the usual expenses grouped
        by category, and totals everything into a yearly and monthly figure.</p>
        <p>Each line has its own amount and a per-month or per-year switch, because
        some costs are naturally one and some the other: rent is monthly, travel
        and car repairs are easier to think of as a yearly lump. Everything is
        converted to a common basis before totaling, so mixing the two is fine.</p>
        <dl className="gloss">
          <dt>Income after taxes</dt>
          <dd>Type it in, or use <b>Copy from Income Tax</b> to pull your net pay
          (gross minus taxes) straight from that tool.</dd>
          <dt>The preset rows</dt>
          <dd>A starting point, not a rulebook. Leave anything at zero to ignore it.</dd>
          <dt>Add custom item</dt>
          <dd>Adds a blank row you can name yourself, for anything the presets miss.</dd>
          <dt>+ Retirement contribution &amp; + College savings</dt>
          <dd>Pull a monthly figure straight from another tool instead of retyping it.
          If more than one retirement mode (Basic, Advanced, Stages) has a contribution
          set, you&apos;ll be asked which one to use, with each option&apos;s monthly amount
          shown so the choice is never a guess.</dd>
          <dt>Left over</dt>
          <dd>Income minus everything budgeted, shown per year and per month, green
          when positive and red when you&apos;ve allocated more than you make. The
          percentage is how much of your income is left, or how far over you
          are.</dd>
        </dl>
        <p>Like the other tools, a budget can be saved, and Save/Delete act on the
        budget while you&apos;re on it. It keeps its own separate list.</p>
      </AboutPanel>
      <AboutPanel title="Debt Payoff">
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
      </AboutPanel>
      <AboutPanel title="Healthcare Cost Planner">
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
          income, taxable Social Security, and capital gains added together. Use{" "}
          <b>Copy from Income Tax</b> to pull it automatically when the Income Tax tool
          is in Retirement income mode.</dd>

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

          <dt>State and age adjustment</dt>
          <dd>The benchmark Silver premium is KFF&apos;s 2026 average for each state for a 40-year-old,
          scaled to your retirement age via the HHS multiplier table. Enter your own
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
      </AboutPanel>
      <AboutPanel title="Historical">
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
      </AboutPanel>
      <AboutPanel title="FIRE Calculator">
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
      </AboutPanel>
      <AboutPanel title="Monte Carlo">
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
      </AboutPanel>
      <AboutPanel title="Scenarios, sharing and the summary">
        <dl className="gloss">
          <dt>Save</dt>
          <dd>Names the current setup and adds it to the dropdown. Saving under
          the name of the scenario you already have loaded updates it; saving
          under a different existing name asks first before overwriting it.
          Scenarios are stored in your browser, on the
          device you&apos;re using; they don&apos;t sync between your phone and computer, and
          clearing site data removes them.</dd>

          <dt>The dropdown</dt>
          <dd>Each mode and tool keeps its own saved list (Basic, Advanced, Stages and
          every tool in the Tools tab), and the dropdown shows whichever list belongs to
          the one you&apos;re on. It remembers which scenario you loaded or saved as you
          move between tabs, and marks it &quot;(edited)&quot; once your current numbers no
          longer match what&apos;s saved. &quot;Unsaved&quot; means the current numbers don&apos;t match
          anything saved.</dd>

          <dt>Compare</dt>
          <dd>Opens a separate screen that puts two or three saved retirement
          scenarios side by side: their balances on one chart, then every result and
          every input in tables, with differing inputs highlighted. It reads saved
          scenarios only and changes nothing, so set your inputs and save them first.
          Each slot picks a mode (Basic, Advanced or Stages) and then a saved
          scenario from that mode&apos;s own list.</dd>

          <dt>Delete</dt>
          <dd>Removes the selected scenario. It doesn&apos;t change the numbers on screen,
          only the saved copy.</dd>

          <dt>Reset</dt>
          <dd>Returns just the tool or mode you&apos;re currently viewing to its
          defaults: Basic, Advanced and Stages each reset separately, and
          so does each tool in the Tools tab. Saved scenarios are untouched.</dd>

          <dt>Share</dt>
          <dd>One button, four options. <b>Copy link</b> encodes every input into the
          address itself, so anyone opening it sees exactly your numbers;
          nothing is uploaded, the whole scenario travels inside the URL, and it&apos;s
          also the most reliable way to move a setup between your own devices.
          On a phone it&apos;s <b>Share link</b> and opens your share sheet, so a
          text shows the site&apos;s preview card rather than a long address.{" "}
          <b>Summary</b> builds a clean one-page version and opens your print dialog,
          where you can choose Save as PDF; on iPhone use Share then Print. <b>Save
          image card</b> and <b>Copy image card</b> generate a shareable square image
          with your headline numbers, ready to post or send, built entirely in
          your browser, nothing leaves your device to create it.</dd>
        </dl>
      </AboutPanel>
      <AboutPanel title="Limitations worth knowing">
        <ul>
          <li>The retirement projections stop at retirement itself:
          &quot;success&quot; there means reaching a number, not that it lasts. The Drawdown
          Simulator is the tool that answers whether the money actually holds up once
          you start spending it.</li>
          <li>Tax in Basic, and in Advanced and Stages unless you split by account
          type, is a single flat rate. Split by account type works it out with the
          Income Tax tool&apos;s 2026 rules, but for the first year of retirement only, and
          without Social Security or other income.</li>
          <li>Contributions are assumed to continue uninterrupted. Job loss, career
          breaks and emergencies aren&apos;t modeled.</li>
          <li>Contribution limits and employer matching are only modeled when you
          split by account type. Social Security is modeled in the Drawdown Simulator,
          Income Tax and Roth Conversion tools, not in the retirement projections.</li>
          <li>Monte Carlo draws each period independently. Real markets show
          streaks and mean reversion that random draws don&apos;t capture; the
          Drawdown Simulator&apos;s historical mode exists specifically to get around
          this limitation for retirement spending.</li>
          <li>Every output is only as good as the assumptions typed in. Small changes
          to the return compound into very large differences over decades, which is
          exactly why the comparison band and Monte Carlo modes exist.</li>
        </ul>
      </AboutPanel>
      <AboutPanel title="Contact" fixed>
        <p>Found a bug, a number that looks off, or have an idea for a tool? Email{" "}
        <MailMe user="contact" domain="retcalc.app" />.
        Every message is read, and reports of anything that looks wrong are the most
        useful of all.</p>
        <p>One thing it can&apos;t do: give personal financial or tax advice. For decisions
        about your own money, a fee-only financial planner or a tax professional can
        look at your whole situation.</p>
      </AboutPanel>
      <AboutPanel title="Disclaimer" kind="disclaimer">
        <p><b>Tax figures are estimates.</b> The income tax tool uses published 2026
        rates but omits credits, local taxes and many special cases, and tax law
        changes. It is not tax advice and should not be used to file or to decide
        withholding. For anything that matters, talk to a tax professional.</p>
        <p><b>This is an educational tool, not financial advice.</b> It doesn&apos;t know
        your circumstances, goals, debts, taxes or risk tolerance, and nothing it
        produces is a recommendation to buy, sell or hold anything.</p>
        <p><b>Past performance does not predict future returns.</b> Historical averages
        are context, not forecasts. Markets can and do deliver long stretches well
        below their historical average, and the figures suggested above may not hold
        in future. The Drawdown Simulator&apos;s historical backtest uses 100 years of US
        market data, which is a real record, not a hypothesis, but it is one
        record of one country, and surviving every year in it is evidence a plan is
        reasonable, not proof it&apos;s safe.</p>
        <p>Projections are arithmetic applied to assumptions you chose. They are not
        predictions, and the true range of outcomes is wider than any model shows.
        For decisions that matter, talk to a qualified financial professional or tax
        adviser who can look at your whole situation.</p>
      </AboutPanel>
    </div>
  );
}
