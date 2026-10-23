"use client";

/* About, inside the Dashboard: laid out like the site's About page
   (tools/about/About.tsx), a reading column with a sticky index beside it
   from 1100px, groups of sections folded to their headings, and the same
   fine print. It says how the dashboard works, then the Calculator, the
   tools and the methods behind them. The site's own settings, scenarios
   and walkthroughs aren't part of the dashboard, so they're left out. */

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { ChevronDownIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FinePrint } from "./FinePrint";
import { Frame } from "./Frame";

/* The sections, in reading order. Each section's id is "about-" + its key,
   so /dashboard/about#about-networth opens that one. */
const GROUPS = [
  { key: "works", label: "How the dashboard works", sections: [["profile", "One profile behind every tab"], ["networth", "Net worth and its history"], ["paycheck", "Income, Taxes, Spending and Savings"], ["assume", "What the plan assumes"], ["tools", "Tools opened here"], ["saved", "What's saved to your account"]] },
  { key: "calc", label: "Calculator and tools", sections: [["calculator", "Calculator"], ["retirement", "Retirement income"], ["saving", "Saving and investing"], ["everyday", "Everyday money"]] },
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
                  <ul>
                    <li><b>Profile</b> shows every answer on one page, each one editable where it
                    stands.</li>
                    <li>A dot on a tab means it still has something to fill in.</li>
                  </ul>
                </Section>
                <Section id="networth">
                  <p><b>Net worth</b> lists what you have and what you owe, account by account.</p>
                  <ul>
                    <li>It&apos;s read-only until you press <b>Edit</b>.</li>
                    <li><b>Save as new entry</b> records it with today&apos;s date. One entry per day:
                    saving again the same day replaces that day&apos;s entry.</li>
                    <li>Each entry is a point in your net worth history, so the chart grows as you
                    update it.</li>
                    <li>The plan always starts from your latest entry.</li>
                  </ul>
                </Section>
                <Section id="paycheck">
                  <p>These four tabs follow one paycheck, in order.</p>
                  <dl className="gloss">
                    <dt>Income</dt>
                    <dd>Each person&apos;s pay, the employer&apos;s 401(k) match (X% on the first Y% of
                    pay), other income, and Social Security: estimated from your pay, typed from
                    your statement, or worked out from your pay history.</dd>
                    <dt>Taxes</dt>
                    <dd>The Income Tax calculator on your numbers. What it leaves is your pay after
                    taxes, everywhere on the dashboard.</dd>
                    <dt>Spending</dt>
                    <dd>One number per month, or your budget line by line under <b>More
                    detail</b>. Once you use the budget, its total is your spending everywhere.
                    Your emergency fund is sized here, in months of spending or of a leaner
                    emergency budget.</dd>
                    <dt>Savings</dt>
                    <dd>Where the rest goes: your 401(k) up to the match, HSA, IRA, 401(k) beyond the
                    match, brokerage and emergency fund. Each line can grow each year beyond
                    inflation, and stops growing at its contribution limit.</dd>
                  </dl>
                  <p><b>Pre-tax saving lowers your taxes.</b> Move a 401(k) or HSA slider on
                  Savings and the Taxes tab changes with it.</p>
                </Section>
                <Section id="assume">
                  <ul>
                    <li><b>Before you retire</b>, savings grow at a steady rate: your growth per
                    year less inflation. Both are set in Profile.</li>
                    <li><b>Once you retire</b>, the plan runs through every market since 1926
                    instead, with the share in stocks you set in Profile.</li>
                    <li><b>Everything is in today&apos;s dollars.</b></li>
                    <li><b>Children</b> cost what families typically spend on a child at each age,
                    plus childcare where you live. A second or later child costs a share of the
                    first. These costs come out of saving in the years they run.</li>
                    <li><b>College</b> comes out of saving in the college years, unless you&apos;re
                    saving for it ahead in your budget.</li>
                    <li><b>Your chance of success</b> is how often the plan lasted through past
                    markets, starting in each year since 1926, with the withdrawal strategy you
                    choose on Retirement.</li>
                  </ul>
                </Section>
                <Section id="tools">
                  <p>Every RetCalc tool opens inside your dashboard, filled in with what your
                  profile knows. <b>Back</b> returns to the tab you came from.</p>
                  <ul>
                    <li>Changes you make in a tool opened from <b>Tools</b> stay in that tool. They
                    never change your profile.</li>
                    <li>Taxes, Spending, Savings and Retirement are built on tools too. What you
                    change on those tabs is saved to your profile.</li>
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
                  <p>The Calculator projects your saving to retirement, built from your plan:
                  balances by account, what you save into each and how it grows, the employer
                  match, your assumptions and your years to retirement.</p>
                  <p>It works in stages. Each stage has its own length, saving, growth and return,
                  and starts from the balance the one before it left. Children are part of it:
                  their costs come out of saving in the years they run.</p>
                  <dl className="gloss">
                    <dt>Future value</dt>
                    <dd>The balance at retirement, in the dollars of that year.</dd>
                    <dt>Inflation adjusted</dt>
                    <dd>The same balance in today&apos;s dollars. This is the one to compare with
                    what you spend now.</dd>
                    <dt>Work backwards from a target</dt>
                    <dd>Two ways to reach a goal: save more, or work longer. Both change the final
                    stage only.</dd>
                    <dt>Coast FIRE</dt>
                    <dd>How far you are from the point where you could stop saving and growth alone
                    would still reach your target.</dd>
                  </dl>
                  <p>What you change in the Calculator stays there. Your profile doesn&apos;t change.</p>
                </Section>
                <Section id="retirement">
                  <dl className="gloss">
                    <dt>Drawdown Simulator</dt>
                    <dd>Will your money last? It tests 15 withdrawal strategies against every
                    retirement since 1926. On the Retirement tab it runs on your plan, and the
                    strategy you choose sets your chance of success.</dd>
                    <dt>Retirement Plan Optimizer</dt>
                    <dd>Tries thousands of ways to claim Social Security, draw down your accounts
                    and convert to Roth, and finds the one that leaves you the most.</dd>
                    <dt>Social Security Calculator</dt>
                    <dd>Your check at every age you could claim, 62 to 70, and what each choice adds
                    up to.</dd>
                    <dt>Early Retirement Bridge</dt>
                    <dd>Retiring before 59½? Compares the ways to reach your savings early, with the
                    tax, penalties and ACA premiums each costs.</dd>
                    <dt>Roth Conversion Calculator</dt>
                    <dd>Projects required distributions, then tests a conversion schedule against
                    doing nothing.</dd>
                    <dt>Healthcare Cost Planner</dt>
                    <dd>ACA premiums and subsidies before Medicare, then Medicare and IRMAA
                    surcharges by income.</dd>
                  </dl>
                </Section>
                <Section id="saving">
                  <dl className="gloss">
                    <dt>FIRE Calculator</dt>
                    <dd>When your savings reach financial independence, or the point where you
                    could stop saving and let growth carry the rest.</dd>
                    <dt>Portfolio Backtest</dt>
                    <dd>What a mix of stocks, bonds and cash actually did: return, swings, the worst
                    year and the deepest fall.</dd>
                    <dt>College Savings</dt>
                    <dd>How much to save per month to cover college, with costs rising faster than
                    prices.</dd>
                    <dt>Rent vs. Buy</dt>
                    <dd>Which leaves you with more net worth after a number of years: renting and
                    investing the difference, or buying.</dd>
                  </dl>
                </Section>
                <Section id="everyday">
                  <dl className="gloss">
                    <dt>Income Tax</dt>
                    <dd>Federal, state and FICA tax on your pay, or on what you draw in retirement.</dd>
                    <dt>Budget</dt>
                    <dd>Your spending line by line, and where each paycheck goes.</dd>
                    <dt>Debt Payoff</dt>
                    <dd>Avalanche against snowball: payoff date and total interest for each.</dd>
                    <dt>Mortgage Calculator</dt>
                    <dd>The full monthly cost of owning, and how the balance falls.</dd>
                  </dl>
                </Section>
              </Group>

              <Group id="methods">
                <Section id="historical">
                  <p>Historical testing asks what your plan would have done in markets that
                  actually happened.</p>
                  <ul>
                    <li>It runs the plan through every overlapping stretch of the record since
                    1926, month by month.</li>
                    <li>Returns come from your stock mix: that share in the S&amp;P 500, the rest in
                    10-year Treasuries, rebalanced every year.</li>
                    <li>Each stretch is brought to today&apos;s dollars with the inflation it
                    actually had.</li>
                    <li>Your retirement is always tested this way. Your chance of success is the
                    share of those stretches the plan lasted through.</li>
                  </ul>
                  <p><b>What it can&apos;t do.</b> It&apos;s one country&apos;s record, and the stretches
                  share most of their months, so they aren&apos;t independent trials. The worst one
                  isn&apos;t the worst that could happen.</p>
                </Section>
                <Section id="montecarlo">
                  <p>Monte Carlo runs your plan hundreds or thousands of times, each with returns
                  drawn at random around your expected return. Volatility sets how widely they
                  swing.</p>
                  <ul>
                    <li>The <b>median</b> is the middle outcome: half of runs did better.</li>
                    <li>The <b>10th to 90th percentile</b> band covers 80% of runs.</li>
                    <li>The <b>success rate</b> is the share of runs that reached your target.</li>
                  </ul>
                  <p>The same inputs give the same results every time. You&apos;ll find it in the
                  Calculator and the Drawdown Simulator.</p>
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
