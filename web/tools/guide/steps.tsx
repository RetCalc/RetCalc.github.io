"use client";

/* The steps, in the order a planner would take them: about you, cash flow,
   safety net, big goals, retirement, and your plan. Each has its card, what
   it needs before Continue, and what it settles on the way out. From
   GD_STEPS in src/js/app/30-guide-steps.js. */

import { fmtNum, money, pctStr } from "@/lib/format";
import { RISKS } from "@/lib/engine/typed";
import { STATE_OPTIONS } from "@/lib/states";
import {
  SAVE_TO, mar, need, ok, pos, riskLabel, saveMo, sim, target, taxEst, yearsList,
} from "./calc";
import { PlanChart, series } from "./chart";
import {
  AboutNote, AcctNote, BridgeNote, CashNote, FlowNote, HcNote, HouseNote, IncomeNote, InflNote, PensionNote, RateNote, SSNote, TaxNote,
} from "./live";
import { OptimizeStep } from "./optimize";
import { Results, ResultsFoot } from "./results";
import type { Answers, GuideState } from "./store";
import { StrategyStep } from "./strategy";
import { TuneStep } from "./tune";
import { After, BackNote, Callout, Choice, Fields, H3, Lead, MoneyF, NumF, Q, SelF, Task, useGuideView } from "./ui";
import { Button } from "@/components/ui/button";

export const CHAPTERS = ["About you", "Cash flow", "Safety net", "Big goals", "Retirement", "Your plan"];

export interface Step {
  id: string; ch: number; title: string;
  /** Steps that only apply to some plans (healthcare before 65, the bridge). */
  when?: (a: Answers) => boolean;
  /** What Continue needs, and what it says until then. */
  ok?: (a: Answers) => boolean;
  why?: (a: Answers) => string;
  /** Settles answers on the way out. */
  commit?: (a: Answers) => void;
  /** Writes the household bar on the way out. */
  sync?: boolean;
  /** Answers the card assumes on arrival (a default mix, say). */
  prep?: (a: Answers) => void;
  Body: () => React.ReactNode;
  Foot?: () => React.ReactNode;
}

/** "Go to Retirement savings" when a step needs a projection first. */
export function NeedsPlan({ title, msg = "This needs your age, savings and retirement spending first." }: { title: string; msg?: string }) {
  const G = useGuideView();
  return (
    <>
      <Q>{title}</Q>
      <Callout cls="warn">{msg}</Callout>
      <Button variant="outline" data-go="savings" onClick={() => G.go("savings")}>Go to Retirement savings</Button>
    </>
  );
}

function Intro() {
  const { g } = useGuideView();
  const started = Object.keys(g.done).length > 0;
  return (
    <>
      <Q>{started ? "Welcome back" : "How ready are you for retirement?"}</Q>
      <Lead>This guide goes through your money one question at a time: what you earn, what you spend, what you owe and what you&apos;ve saved.
        {" "}When you don&apos;t know an answer, it opens the tool on this site that finds it, tells you exactly what to fill in, and brings the result back here.</Lead>
      <ul className="gd-perks">
        <li><i>1</i><span><b>A readiness score out of 100</b> that updates as you answer, and shows what&apos;s pulling it down.</span></li>
        <li><i>2</i><span><b>A tour of the tools that apply to you.</b> No mortgage? No kids? Those get skipped.</span></li>
        <li><i>3</i><span><b>A plan you can adjust, with taxes built in.</b> Ahead of schedule? See what retiring sooner, coasting or spending more would look like, and apply it. Behind? Pick the fix that suits you. Then the Plan Optimizer finds the best way to claim Social Security, draw down your accounts and convert to Roth.</span></li>
        <li><i>4</i><span><b>A short, ordered list</b> of what to do next, with the tool for each step.</span></li>
      </ul>
      <Callout>Plan on 20 to 40 minutes, depending on how many tools you open. Stop whenever you like: your answers are kept in this browser only and never leave it.</Callout>
    </>
  );
}
function IntroFoot() {
  const { g, act } = useGuideView();
  return Object.keys(g.done).length > 0
    ? <><Button variant="outline" size="lg" data-gd="restart" onClick={() => act("restart")}>Start over</Button><span className="sp"></span>
      <Button size="lg" className="max-sm:flex-auto" data-gd="resume" onClick={() => act("resume")}>Pick up where you left off<i className="arw" aria-hidden="true"></i></Button></>
    : <><span className="sp"></span><Button size="lg" className="max-sm:flex-auto" data-gd="next" onClick={() => act("next")}>Let&apos;s begin<i className="arw" aria-hidden="true"></i></Button></>;
}

function About() {
  const { v, a } = useGuideView();
  return (
    <>
      <Q>First, a little about you</Q>
      <Lead>These set the timeline for everything else. They also fill in the household bar at the top of the page, so every tool on the site starts from your numbers.</Lead>
      <Fields>
        <SelF k="status" label="Household" opts={[["s", "Just me"], ["m", "Me and a spouse or partner"]]} redraw full />
        <NumF k="age" label="Your age" affix="age" />
        {mar(v) ? <NumF k="spouseAge" label="Spouse's age" affix="age" /> : null}
        <NumF k="retire" label="Age you'd like to retire" affix="age" hint="A guess is fine. You can try other ages later." />
        <SelF k="state" label="State" opts={[["", "Choose your state"], ...STATE_OPTIONS.map((o) => [o.code, o.name] as [string, string])]} hint="For state income tax and healthcare costs." />
      </Fields>
      <AboutNote a={a} />
    </>
  );
}

function Income() {
  const { v, a } = useGuideView();
  return (
    <>
      <Q>What do you earn in a year?</Q>
      <Lead>Your salary or wages <b>before</b> taxes and paycheck deductions come out: the headline number on an offer letter. If your pay moves around, use last year&apos;s total.</Lead>
      <Fields>
        <MoneyF k="income" label="Your gross income" per="/yr" hint="Self-employed? Use your net profit. Not working right now? Enter 0." />
        {mar(v) ? <MoneyF k="income2" label="Spouse's gross income" per="/yr" /> : null}
      </Fields>
      <IncomeNote a={a} />
    </>
  );
}

function TakeHome() {
  const G = useGuideView(), { v } = G, est = taxEst(v);
  const showField = v.thKnow === "yes" || pos(v.takehome);
  return (
    <>
      <Q>Do you know your monthly take-home pay?</Q>
      <Lead>Take-home is what actually lands in your bank account after taxes and anything your employer takes out, like 401(k) contributions and health insurance. It&apos;s the number your budget has to live within.</Lead>
      <div className="gd-choices two">
        <Choice k="thKnow" val="yes" title="Yes, I know it" sub="I'll type it in" />
        <Choice k="thKnow" val="no" title="No, help me work it out" sub="The Income Tax tool estimates it from your salary" />
      </div>
      <BackNote step="takehome" />
      {v.thKnow === "no" ? <Task id="tax" head="Find it with the Income Tax tool" label={pos(v.takehome) ? "Open Income Tax again" : null}
        after={est > 0 && !pos(v.takehome) ? <div className="mt-3 text-note"><Button variant="quiet" size="inline" data-fill="takehome" data-v={Math.round(est)}
          onClick={() => fill(G, "takehome", Math.round(est))}>Or skip the tool and use a quick estimate: about {money(est)}/mo</Button></div> : null} /> : null}
      {showField ? <Fields><MoneyF k="takehome" label="Monthly take-home pay" per="/mo"
        hint={mar(v) ? "For the two of you together." : "Paid every two weeks? Multiply one paycheck by 26, then divide by 12."} /></Fields> : null}
    </>
  );
}

/** A suggested figure: into its field if the field is showing, or the card
    is drawn again with it. */
export function fill(G: ReturnType<typeof useGuideView>, k: keyof Answers, val: number) {
  const shown = typeof document !== "undefined" && !!document.getElementById("gdf-" + k);
  G.set(k, val as never, !shown);
}

function Spending() {
  const { v, a } = useGuideView();
  const showField = v.bgKnow === "yes" || pos(v.spend);
  return (
    <>
      <Q>Do you know what you spend each month?</Q>
      <Lead>Knowing where the money goes is the foundation for the rest: it sizes your emergency fund, shows what you can put toward debt or savings, and hints at what retirement will cost.</Lead>
      <div className="gd-choices two">
        <Choice k="bgKnow" val="yes" title="Yes, I track it" sub="I have a budget or a good handle on it" />
        <Choice k="bgKnow" val="no" title="Not really" sub="Let's build a budget together" />
      </div>
      <BackNote step="spending" />
      {v.bgKnow === "no" ? <Task id="budget" head="Build it in the Budget tool" label={pos(v.spend) ? "Open Budget again" : null} /> : null}
      {showField ? <Fields><MoneyF k="spend" label="Monthly spending" per="/mo" hint="Everything except what you save or invest: housing, bills, food, car, fun. Add yearly costs divided by 12." /></Fields> : null}
      <FlowNote a={a} />
    </>
  );
}

function Cash() {
  const { a } = useGuideView();
  return (
    <>
      <Q>How much cash do you have for emergencies?</Q>
      <Lead>An emergency fund covers a job loss, a car repair or a medical bill without new debt. Count checking, savings and money market accounts, not retirement accounts or investments you&apos;d have to sell.</Lead>
      <Fields><MoneyF k="cash" label="Cash savings" hint="One income, children, or pay that varies? Aim toward six months. Two steady incomes can aim toward three." /></Fields>
      <CashNote a={a} />
    </>
  );
}

function Debt() {
  const G = useGuideView(), { v } = G;
  return (
    <>
      <Q>Do you owe money on anything besides a mortgage?</Q>
      <Lead>Credit cards you carry a balance on, car loans, student loans, personal or medical loans. Interest on high-rate debt often costs more than investments earn, so paying it off comes before most other goals.</Lead>
      <div className="gd-choices two">
        <Choice k="debtHas" val="no" title="No, nothing" sub="Or only a mortgage" />
        <Choice k="debtHas" val="yes" title="Yes" sub="Let's see how fast you can be rid of it" />
      </div>
      <BackNote step="debt" />
      {v.debtHas === "yes" ? (
        <>
          {v.debtSrc !== "tool" ? <Task id="debt" head="Make a plan in Debt Payoff" label="List them in Debt Payoff"
            after={v.debtSrc !== "quick" ? <div className="mt-3 text-note"><Button variant="quiet" size="inline" data-set="debtSrc" data-val="quick"
              onClick={() => G.set("debtSrc", "quick", true)}>Rather not list them? Enter the totals instead</Button></div> : null} /> : null}
          {v.debtSrc === "quick" || v.debtSrc === "tool" ? <Fields><MoneyF k="debtTotal" label="Total you owe" />
            <MoneyF k="debtHi" label="Of that, at 8% interest or more" hint="Credit cards almost always are." /></Fields> : null}
          {v.debtSrc === "tool" ? <Button variant="quiet" size="inline-xs" data-trip="debt" onClick={() => G.trip("debt")}>Open your plan in Debt Payoff again</Button> : null}
        </>
      ) : null}
    </>
  );
}

function Home() {
  const { v, a } = useGuideView();
  const optional = <After>Optional. Continue whenever you&apos;re ready.</After>;
  return (
    <>
      <Q>What&apos;s your housing situation?</Q>
      <Lead>Housing is most people&apos;s biggest cost. If a home purchase or a mortgage is part of your picture, the Mortgage Calculator shows what it really costs. If not, we&apos;ll skip it.</Lead>
      <div className="gd-choices">
        <Choice k="home" val="rent" title="I rent, with no plans to buy soon" />
        <Choice k="home" val="buy" title="I'd like to buy in the next few years" sub="See what a home would cost each month" />
        <Choice k="home" val="mortgage" title="I own and I'm paying off a mortgage" sub="See what extra payments would do" />
        <Choice k="home" val="own" title="I own my home outright" />
        <Choice k="home" val="other" title="Something else" sub="Living with family, or it's complicated" />
      </div>
      <BackNote step="home" />
      {v.home === "buy" ? <Task id="mortBuy" head="Price it in the Mortgage Calculator" after={optional} /> : null}
      {v.home === "mortgage" ? (
        <>
          <Task id="mortOwn" head="Try extra payments in the Mortgage Calculator" after={optional} />
          <H3>Will it be paid off by the time you retire?</H3>
          <div className="gd-choices two"><Choice k="mortPaid" val="yes" title="Yes" sub="Your spending drops once it's gone" /><Choice k="mortPaid" val="no" title="No, or not sure" /></div>
        </>
      ) : null}
      {v.home === "buy" || v.home === "mortgage" ? (
        <>
          <Fields><MoneyF k="housePay" label={v.home === "buy" ? "Expected house payment" : "Your house payment"} per="/mo"
            hint={v.home === "mortgage" && pos(v.bgHousing) && v.housePay === v.bgHousing ? "From your budget's housing lines. Loan, property tax, insurance, PMI and HOA."
              : "Loan, property tax, insurance, PMI and HOA. The calculator fills this in."} /></Fields>
          <HouseNote a={a} />
        </>
      ) : null}
    </>
  );
}

function College() {
  const { v } = useGuideView();
  return (
    <>
      <Q>Are you saving for a child&apos;s college?</Q>
      <Lead>If helping with college is a goal, it helps to know the monthly number now. If not, or your children are grown, skip ahead.</Lead>
      <div className="gd-choices two"><Choice k="college" val="yes" title="Yes, or I'd like to" /><Choice k="college" val="no" title="No, or it doesn't apply" /></div>
      <BackNote step="college" />
      {v.college === "yes" ? (
        <>
          <Fields><NumF k="kidAge" label="Youngest child's age" affix="age" hint="Not born yet? Enter 0." /></Fields>
          <Task id="college" head="Find the number with College Savings" />
          <Fields><MoneyF k="collegeMo" label="Monthly for college" per="/mo" hint="The tool fills this in." /></Fields>
          <Callout cls="warn"><b>Retirement comes first.</b> There are loans for college but none for retirement, and your own security is a gift to your children too.</Callout>
        </>
      ) : null}
    </>
  );
}

function Savings() {
  const { v, a } = useGuideView();
  return (
    <>
      <Q>Where do your retirement savings stand?</Q>
      <Lead>Add up everything set aside for retirement: 401(k), 403(b), IRAs, Roth accounts and any investments you&apos;ve earmarked for it. Your account websites show the balances.</Lead>
      <Fields>
        <MoneyF k="saved" label="Saved for retirement so far" full />
        <MoneyF k="contrib" label="You contribute" per="/mo" hint={pos(v.bgSave) ? "Your budget shows " + money(v.bgSave) + "/mo going to savings." : "From your paycheck and on your own."} />
        <MoneyF k="employer" label="Your employer adds" per="/mo" hint="Matching or profit sharing. 0 if none." />
      </Fields>
      <InflNote a={a} />
      <H3>Does your employer match what you put in?</H3>
      <div className="gd-choices two">
        <Choice k="match" val="full" title="Yes, and I get all of it" /><Choice k="match" val="partial" title="Yes, but I'm not getting all of it" />
        <Choice k="match" val="none" title="No match, or I'm self-employed" /><Choice k="match" val="unsure" title="Not sure" />
      </div>
      <Fields><SelF k="risk" label="How is it invested?" opts={RISKS.map((r) => [r.real, r.label + " · " + r.sub])} num full
        hint="Target-date funds are usually Balanced or Growth until the last decade before retirement." /></Fields>
      <RateNote a={a} />
      <H3>What kind of accounts is it in?</H3>
      <p className="hint -mt-1 mx-0 mb-2.5 max-w-copy">It changes the tax you&apos;ll pay in retirement: traditional money is taxed when it comes out, Roth money isn&apos;t, and a brokerage account is taxed only on its gains. Leave these blank if it&apos;s all in a regular 401(k) or IRA.</p>
      <Fields>
        <MoneyF k="rothNow" label="Of that, in Roth accounts" ph="0" hint="Roth 401(k) and Roth IRA." />
        <MoneyF k="brokNow" label="In a taxable brokerage account" ph="0" hint="Only money meant for retirement." />
      </Fields>
      <AcctNote a={a} />
      <H3>Where does your monthly saving go?</H3>
      <div className="gd-choices two">{SAVE_TO.map(([k, t, s]) => <Choice key={k} k="saveTo" val={k} title={t} sub={s} />)}</div>
      <p className="hint -mt-1 mx-0 mb-0">Your employer&apos;s share goes into a traditional account either way.</p>
    </>
  );
}

function RetSpend() {
  const G = useGuideView(), { v, a } = G, picks: [string, number][] = [];
  if (pos(v.spend)) {
    picks.push(["Same as today", v.spend * 12]);
    picks.push(["80% of today", v.spend * 12 * 0.8]);
    // Only the loan itself goes away; property tax and insurance don't.
    const loan = pos(v.mortPI) ? v.mortPI : pos(v.bgMort) ? v.bgMort : 0;
    if (v.home === "mortgage" && v.mortPaid === "yes" && loan > 0 && v.spend > loan) picks.push(["Today, less the loan payment", (v.spend - loan) * 12]);
  }
  const m = mar(v);
  return (
    <>
      <Q>What will you spend in retirement?</Q>
      <Lead>A year of the retirement you want, priced at today&apos;s prices: what you&apos;ll live on, <b>after</b> income tax. Many people spend around 80% of what they do now: no commute, no saving for retirement, often no mortgage. Travel can push it back up.</Lead>
      {picks.length ? <div className="gd-picks">{picks.map(([lab, val]) => {
        const r = Math.round(val / 100) * 100;
        return <button key={lab} type="button" className="gd-pick" data-fill="retSpend" data-v={r} onClick={() => fill(G, "retSpend", r)}>{lab}: <b>{money(r) + "/yr"}</b></button>;
      })}</div> : null}
      <Fields><MoneyF k="retSpend" label="Yearly spending in retirement" per="/yr" full hint="In today's dollars, after tax. Leave out health insurance before 65 too: the plan prices it." /></Fields>
      <BackNote step="retspend" />
      <TaxNote />
      <SSNote a={a} />
      <Fields>
        <MoneyF k="ssOwn" label={m ? "Have a Social Security statement? Your benefit" : "Have a Social Security statement? Your monthly benefit"} per="/mo" full={!m}
          ph="optional" hint="From ssa.gov/myaccount, at 67. It reflects your real earnings, so it beats our estimate." />
        {m ? <MoneyF k="ssOwn2" label="Your spouse's benefit" per="/mo" ph="optional" hint="From their own statement, at 67." /> : null}
        <SelF k="ssClaim" label={m ? "When would you each claim it?" : "When would you claim it?"} num full
          opts={[["", "At 67, or when I retire if that's later"], ...[62, 63, 64, 65, 66, 67, 68, 69, 70].map((x) =>
            [x, "At " + x + (x === 62 ? ", the earliest" : x === 67 ? ", full retirement age" : x === 70 ? ", the most it pays" : "")] as [number, string])]}
          hint={"Each year you wait past 62 raises the benefit for life, up to 70. In this plan it never starts before you retire. The Plan Optimizer, near the end, tries every age for " + (m ? "each of you." : "you.")} />
      </Fields>
      <H3>A pension, or other steady income in retirement?</H3>
      <Fields>
        <MoneyF k="pension" label="Pension, annuity or part-time pay" per="/mo" ph="optional" hint="In today's dollars. Leave blank if none." />
        <NumF k="pensionAge" label="Starting at" affix="age" hint="Blank means when you retire." />
        <SelF k="pensionCola" label="Does it rise with inflation?" opts={[["no", "No, it's a fixed amount"], ["yes", "Yes, it has cost-of-living raises"]]} full />
      </Fields>
      <PensionNote a={a} />
    </>
  );
}

function Outlook() {
  const { v } = useGuideView(), S = sim(v);
  if (!S) return <NeedsPlan title="Your retirement projection" />;
  const spendNeed = S.spend + S.taxYr, port = S.portIncome, ss = S.ss.total, pen = S.pension;
  const sc = Math.max(spendNeed, port + ss + pen) || 1;
  const want = need(v, S), goal = target(v);
  const coast = S.stop != null && S.stop <= v.age!;
  let close: React.ReactNode;
  // Size the plan against what it needs: the balance at retirement that
  // lasts in the target share of history.
  if (S.success >= goal - 1e-9 && want > 0 && S.fv >= want * 1.2)
    close = <Callout cls="ok">You&apos;re on course for <b>{money(S.fv)}</b>. To last in {goal >= 1 ? "every" : pctStr(goal, 0) + " of"} historical retirements, this plan needs about <b>{money(want)}</b>, so you&apos;re{" "}
      {S.fv >= want * 9.5 ? <b>covered many times over</b> : S.fv >= want * 1.9 ? <>at about <b>{(Math.round((S.fv / want) * 10) / 10).toString().replace(/\.0$/, "") + " times"}</b> that</> : <><b>{money(S.fv - want)}</b> ahead</>}
      . Two steps on, <b>Adjust your plan</b> shows what that extra could buy: retiring sooner, coasting, saving less or spending more.</Callout>;
  else if (S.coverage >= 1) close = <Callout cls="ok">On this path, savings{pen ? ", Social Security and your pension" : " and Social Security"} together cover <b>{pctStr(Math.min(S.coverage, 9.99), 0)}</b> of the retirement you described.</Callout>;
  else close = <Callout cls="warn">That covers <b>{pctStr(S.coverage, 0)}</b> of the {money(spendNeed)} a year you plan to spend, a gap of about <b>{money(spendNeed - port - ss - pen) + " a year"}</b>
    {want > S.fv ? <>: you&apos;d want about <b>{money(want)}</b> saved by {fmtNum(S.retire)}</> : null}. <b>Adjust your plan</b>, two steps on, shows the quickest ways to close it and applies the one you pick.</Callout>;
  return (
    <>
      <Q>Your retirement projection</Q>
      <Lead>Where your current path leads by {fmtNum(S.retire)}, in today&apos;s dollars, if a {riskLabel(S.real)} mix earns about {pctStr(S.real, 1)} a year after inflation and your saving keeps pace with inflation
        {S.stop != null ? (coast ? ". You've stopped saving, so it grows on its own from here" : " until you stop saving at " + fmtNum(S.stop)) : ""}.</Lead>
      <BackNote step="outlook" />
      <div className="gd-stats">
        <div><div className="k">Savings at {fmtNum(S.retire)}</div><div className="v gold">{money(S.fv)}</div><div className="n">{coast ? "What you have grows to" : "What " + money(saveMo(v)) + "/mo grows to"}</div></div>
        <div><div className="k">Income it supports</div><div className="v">{money(port)}</div><div className="n">A year, taking 4%</div></div>
        <div><div className="k">{pen ? "Social Security + pension" : "Social Security"}</div><div className="v">{money(ss + pen)}</div><div className="n">A year, Social Security from {S.ss.claim}</div></div>
      </div>
      <div className="gd-cover">
        <div className="gd-cover-bar" role="img" aria-label={"Income covers " + pctStr(Math.min(9.99, S.coverage), 0) + " of planned spending"}>
          <i className="w-(--w) bg-jade" style={{ "--w": ((port / sc) * 100).toFixed(1) + "%" } as React.CSSProperties}></i>
          <i className="w-(--w) bg-steel" style={{ "--w": ((ss / sc) * 100).toFixed(1) + "%" } as React.CSSProperties}></i>
          {pen ? <i className="w-(--w) bg-gold" style={{ "--w": ((pen / sc) * 100).toFixed(1) + "%" } as React.CSSProperties}></i> : null}
          <span className="need left-(--x)" style={{ "--x": "calc(" + ((spendNeed / sc) * 100).toFixed(1) + "% - 1px)" } as React.CSSProperties}></span>
        </div>
        <div className="gd-cover-key"><span><s className="bg-jade"></s>From savings</span><span><s className="bg-steel"></s>Social Security</span>
          {pen ? <span><s className="bg-gold"></s>Pension</span> : null}
          <span><s className="bg-text w-0.5"></s>Your spending and its tax: {money(spendNeed)}/yr</span></div>
      </div>
      <Callout><b>Taxes are built in.</b> In a typical year this plan pays about <b>{money(S.taxYr)}</b> in income tax
        {S.hcYr > 0 ? <>, and about <b>{money(S.hcYr)}</b> a year for health insurance before Medicare, after the subsidy your income earns</> : null}
        , on top of the {money(S.spend)} you live on. Across the whole retirement that comes to about <b>{money(S.lifeTax)}</b> in tax, in today&apos;s dollars
        {S.tactics ? ", with the Plan Optimizer's choices applied." : ". The Plan Optimizer, near the end, looks for ways to pay less of it."}</Callout>
      <PlanChart id="outlook" series={[series(S, v.age!, "Your plan", "p")]} caption="Your retirement savings over time, in today's dollars" />
      {close}
      {S.retire < S.ss.claim ? <Callout>Social Security starts at {S.ss.claim}, so for the first {S.ss.claim - Math.round(S.retire)} years of retirement your savings carry everything. The next step tests exactly that.</Callout> : null}
      <Task id="basic" head="See it in the Basic calculator" after={<After>Optional. Any change you make there can come back with you.</After>} />
    </>
  );
}

function Lasting() {
  const { v } = useGuideView(), S = sim(v);
  if (!S) return <NeedsPlan title="Will your money last?" />;
  const r = S.success;
  return (
    <>
      <Q>Will your money last?</Q>
      <Lead>Averages hide the real risk: retiring into a bad market. We replayed your plan through every retirement since 1926:
        {" "}{money(S.fv)} at {fmtNum(S.retire)}, living on {money(S.spend)} a year after tax, rising with inflation, for {S.years} years,
        {" "}with each year&apos;s income tax{S.hcYears ? ", health insurance before Medicare" : ""} and any Medicare surcharge paid on top, Social Security from {S.ss.claim}{S.pension ? ", your pension" : ""} and {S.mix}% in stocks.</Lead>
      <BackNote step="lasting" />
      <div className="gd-stats">
        <div><div className="k">Success rate</div><div className={"v " + (r >= 0.85 ? "jade" : "gold")}>{pctStr(r, 0)}</div><div className="n">{S.H.survived} of {S.H.total} starting years</div></div>
        <div><div className="k">Length tested</div><div className="v">{S.years} years</div><div className="n">To age {Math.round(S.retire) + S.years}</div></div>
        <div><div className="k">Typical balance left</div><div className="v">{money(S.H.medianEnd)}</div><div className="n">In today&apos;s dollars</div></div>
      </div>
      {S.H.failYears.length ? <p className="gd-fails">It ran short retiring in {yearsList(S.H.failYears)}.</p> : null}
      {r >= 0.95 ? <Callout cls="ok"><b>Very solid.</b> The plan survived {r >= 1 ? "every" : "nearly every"} market in history, which can mean you have room to spend more or retire sooner.</Callout>
        : r >= 0.85 ? <Callout cls="ok"><b>A solid plan.</b> The few failures came from the worst starting years, and small spending cuts during a bad stretch usually fix those.</Callout>
          : r >= 0.7 ? <Callout cls="warn"><b>Borderline.</b> It works in most markets but fails in enough of them to take seriously. A flexible withdrawal strategy, or the fixes in your plan, would firm it up.</Callout>
            : <Callout cls="bad"><b>At risk.</b> This plan runs short in too many historical markets. The next step shows what closes the gap.</Callout>}
      <p className="hint">Next: adjust your plan, then choose how you&apos;d spend it down, with a guided tour of the Drawdown Simulator.</p>
    </>
  );
}

function Health() {
  const { v, a } = useGuideView(), gap = 65 - Math.round(v.retire!);
  return (
    <>
      <Q>Healthcare before Medicare</Q>
      <Lead>Retiring at {fmtNum(v.retire!)} leaves <b>{gap + (gap === 1 ? " year" : " years")}</b> before Medicare starts at 65.
        {" "}Until then you&apos;ll buy coverage on the ACA marketplace, where the price depends heavily on your income in retirement: keeping it low can earn a large subsidy.
        {" "}Your plan prices it for you, year by year: the benchmark Silver plan for your state and age, less the subsidy that year&apos;s income earns.</Lead>
      <BackNote step="health" />
      <H3>Is health insurance already in your retirement spending?</H3>
      <div className="gd-choices two"><Choice k="hcIncl" val="no" title="No, price it for me" sub="The usual answer" /><Choice k="hcIncl" val="yes" title="Yes, it's included" sub="Your plan won't add premiums" /></div>
      <HcNote a={a} />
      <Task id="healthcare" head="Explore it in the Healthcare Cost Planner" after={<After>Optional. It shows how the subsidy moves with income, and Medicare&apos;s costs after 65.</After>} />
    </>
  );
}

function Bridge() {
  const G = useGuideView(), { v, a } = G, gap = Math.ceil(59.5 - v.retire!);
  return (
    <>
      <Q>Getting to 59½</Q>
      <Lead>Retiring at {fmtNum(v.retire!)} means about <b>{gap + (gap === 1 ? " year" : " years")}</b> before a 401(k) or IRA
        {" "}opens up without a 10% penalty. There are several legal ways across: living off a taxable account and your Roth contributions,
        {" "}{v.retire! >= 55 ? "72(t) payments and the rule of 55" : "a Roth conversion ladder and 72(t) payments"}. Which works best depends on where your money sits.</Lead>
      <BridgeNote a={a} />
      <p className="hint -mt-1.5 mx-0 mb-3.5">The split comes from your Retirement savings step. <Button variant="quiet" size="inline" data-go="savings" onClick={() => G.go("savings")}>Change it</Button></p>
      <Callout>Your plan already follows the rules: before 59½ it lives on the brokerage account and Roth contributions first, and only pays the 10% penalty if nothing else is left. The Plan Optimizer, next, can build a Roth conversion ladder to open up traditional money early.</Callout>
      {v.retire! >= 55 ? <><H3>Will you leave a job with a 401(k) at 55 or later?</H3>
        <div className="gd-choices two"><Choice k="rule55" val="yes" title="Yes" sub="The rule of 55 lets that 401(k) pay out without the penalty" /><Choice k="rule55" val="no" title="No, or not sure" /></div></> : null}
      <BackNote step="bridge" />
      <Task id="bridge" head="Plan it in the Early Retirement Bridge" after={<After>Optional: it also compares 72(t) payments, which this plan doesn&apos;t use.</After>} />
    </>
  );
}

export const STEPS: Step[] = [
  { id: "intro", ch: -1, title: "Welcome", Body: Intro, Foot: IntroFoot },
  { id: "about", ch: 0, title: "About you", Body: About, sync: true,
    ok: (a) => ok(a.age) && a.age >= 16 && a.age < 100 && ok(a.retire) && a.retire > a.age && a.retire <= 90,
    why: () => "Enter your age and a retirement age after it",
    commit: (a) => { if (!a.status) a.status = "s"; } },
  { id: "income", ch: 1, title: "Your income", Body: Income, sync: true, ok: (a) => ok(a.income), why: () => "Enter your yearly income" },
  { id: "takehome", ch: 1, title: "Take-home pay", Body: TakeHome, ok: (a) => pos(a.takehome),
    why: (a) => (a.thKnow === "no" ? "Open the Income Tax tool, or use the estimate" : "Enter your monthly take-home") },
  { id: "spending", ch: 1, title: "Monthly spending", Body: Spending, ok: (a) => pos(a.spend),
    why: (a) => (a.bgKnow === "no" ? "Build your budget first" : "Enter your monthly spending") },
  { id: "cash", ch: 2, title: "Emergency fund", Body: Cash, ok: (a) => ok(a.cash), why: () => "Enter your cash savings, even if it's 0" },
  { id: "debt", ch: 2, title: "Debt", Body: Debt, ok: (a) => a.debtHas === "no" || (a.debtHas === "yes" && ok(a.debtTotal)),
    why: (a) => (a.debtHas === "yes" ? "List your debts, or enter the total" : "Choose an answer") },
  { id: "home", ch: 3, title: "Housing", Body: Home, ok: (a) => !!a.home, why: () => "Choose an answer",
    prep: (a) => { if (a.home === "mortgage" && !ok(a.housePay) && pos(a.bgHousing)) a.housePay = a.bgHousing; } },
  { id: "college", ch: 3, title: "College", Body: College, ok: (a) => !!a.college, why: () => "Choose an answer" },
  { id: "savings", ch: 4, title: "Retirement savings", Body: Savings, sync: true,
    prep: (a) => { if (a.risk == null) a.risk = 0.045; if (!a.saveTo) a.saveTo = "trad"; },
    ok: (a) => ok(a.saved) && ok(a.contrib) && !!a.match, why: () => "Fill in your savings and contributions, and answer the match question",
    commit: (a) => { if (!ok(a.employer)) a.employer = 0; } },
  { id: "retspend", ch: 4, title: "Spending in retirement", Body: RetSpend, sync: true, ok: (a) => pos(a.retSpend), why: () => "Enter your yearly spending in retirement" },
  { id: "outlook", ch: 4, title: "Your projection", Body: Outlook },
  { id: "lasting", ch: 4, title: "Will it last?", Body: Lasting },
  { id: "tune", ch: 5, title: "Adjust your plan", Body: TuneStep },
  { id: "strategy", ch: 5, title: "Drawing it down", Body: StrategyStep },
  { id: "health", ch: 5, title: "Healthcare before 65", Body: Health, when: (a) => ok(a.retire) && a.retire < 65,
    prep: (a) => { if (!a.hcIncl) a.hcIncl = "no"; } },
  { id: "bridge", ch: 5, title: "Getting to 59½", Body: Bridge, when: (a) => ok(a.retire) && a.retire < 59.5 },
  { id: "optimize", ch: 5, title: "Plan Optimizer", Body: OptimizeStep },
  { id: "results", ch: 5, title: "Score and plan", Body: Results, Foot: ResultsFoot },
];

export const stepById = (id: string) => STEPS.find((s) => s.id === id);
export const applies = (s: Step, a: Answers) => !s.when || s.when(a);
export const route = (a: Answers) => STEPS.filter((s) => applies(s, a));
export const numbered = (a: Answers) => route(a).filter((s) => s.id !== "intro");
export function firstOpen(g: GuideState): string {
  const L = numbered(g.a);
  return (L.find((s) => !g.done[s.id]) || L[L.length - 1]).id;
}
/** The step to show: the one you're on, or the next that applies. */
export function current(g: GuideState): Step {
  let st = stepById(g.cur) || STEPS[0];
  if (!applies(st, g.a)) {
    const i = STEPS.indexOf(st);
    st = STEPS.slice(i).find((s) => applies(s, g.a)) || STEPS[STEPS.length - 1];
  }
  return st;
}
