"use client";

/* Drawing it down: every withdrawal strategy the Drawdown Simulator offers,
   run on the plan's own numbers through the same history, so the choice is
   made on what each would have meant for this person. From gdStratHTML(),
   gdStratTableHTML() and gdStratPickHTML() in src/js/app/30-guide-steps.js. */

import { fmtNum, money, pctStr } from "@/lib/format";
import { STRATS, minSpend, pos, sim, strats, target, yearsList } from "./calc";
import { MinNote } from "./live";
import type { Answers } from "./store";
import { NeedsPlan, fill } from "./steps";
import { After, BackNote, Callout, Choice, Fields, H3, Lead, MoneyF, Q, Task, useGuideView } from "./ui";

function StratTable({ a }: { a: Answers }) {
  const S = sim(a);
  if (!S) return null;
  const R = strats(a, S), cur = a.strategy || "fixed", fl = minSpend(a);
  return (
    <>
      <div className="gd-strat"><div className="gd-strat-h" aria-hidden="true"><span>Approach</span><span>Lasted</span><span>Typical year</span><span>Leanest year</span></div>
        {R.map((r) => (
          <div key={r.st.id} className={"gd-strat-r" + (r.st.id === cur ? " on" : "")}><div className="nm"><b>{r.st.name}</b><span>{r.st.d}</span></div>
            <div className="c"><i>Lasted</i>{r.canFail ? pctStr(r.success, 0) : "Can't run out"}</div>
            <div className="c"><i>Typical year</i>{money(r.typical)}</div>
            <div className="c"><i>Leanest year</i>{money(r.lean)}{r.lean >= S.spend * 0.995 ? <small>never below your plan</small> : r.leanYear ? <small>retiring in {r.leanYear}, at {r.leanAge}</small> : null}</div></div>
        ))}</div>
      <p className="hint" style={{ margin: "-6px 0 14px" }}>Spending after tax, in today&apos;s dollars, counting Social Security{S.pension ? " and your pension" : ""}. The leanest year is the worst single year across all of history; when the money ran out, it&apos;s what Social Security{S.pension ? " and the pension" : ""} paid alone.
        {fl ? <> Flexible approaches never go below your {money(fl)} minimum while money remains, so each can now run out; <b>Lasted</b> counts how often it held.</> : null}</p>
    </>
  );
}

function StratPick({ a }: { a: Answers }) {
  const S = sim(a);
  if (!S || !a.strategy) return null;
  const R = strats(a, S), cur = a.strategy, r = R.find((q) => q.st.id === cur), fl = minSpend(a);
  if (!r) return null;
  const cut = r.lean < S.spend - 1 ? Math.round((1 - r.lean / S.spend) * 100) : 0;
  let t: string;
  if (cur === "fixed") t = r.success >= 0.995 ? "You'd never cut back, and it lasted in every retirement on record. Simple, and it held up."
    : "You'd never cut back, but retiring in " + yearsList(r.H!.failYears) + " the money ran out, leaving " + money(r.lean) + " a year from Social Security" + (S.pension ? " and your pension" : "") + ". Being willing to trim in a bad stretch is what the other approaches add.";
  else t = "In a typical retirement you'd have spent about " + money(r.typical) + " a year. " +
    (cut ? "The hardest case was retiring in " + r.leanYear + ": at " + r.leanAge + " spending would have been " + money(r.lean) + ", " + cut + "% under your plan." : "Spending never had to drop below your plan.") +
    (r.canFail ? " It lasted in " + pctStr(r.success, 0) + " of retirements, against " + pctStr(S.success, 0) + " spending a fixed amount." : " It can't run out, because spending follows the balance down.") +
    (fl ? (r.success < target(a) - 1e-9 ? " Your " + money(fl) + " minimum is what costs it here: holding spending up through a bad market drains the portfolio, so a lower minimum, or a bigger cushion, buys safety."
      : " Your " + money(fl) + " minimum held in " + pctStr(r.success, 0) + " of retirements, enough for your target.")
      : " Ask yourself whether you could live on the lean year; if not, set a minimum above and see what it costs.");
  return <Callout cls={r.success < 0.9 && r.canFail ? "warn" : "ok"}>{t}</Callout>;
}

export function StrategyStep() {
  const G = useGuideView(), { v, a } = G, S = sim(v);
  if (!S) return <NeedsPlan title="How will you spend it down?" msg="This needs a projection first: your age, savings and retirement spending." />;
  // The floor under the flexible approaches, before the comparison it changes.
  const base = S.ss.total + S.pension, picks: [string, number][] = [];
  if (base > 0 && base < S.spend) picks.push(["Social Security" + (S.pension ? " and pension" : "") + " alone", base]);
  picks.push(["80% of your plan", S.spend * 0.8]);
  if (pos(v.spend)) picks.push(["Today's spending, less 20%", v.spend * 12 * 0.8]);
  return (
    <>
      <Q>How will you spend it down?</Q>
      <Lead>So far your plan spends the same amount every year, raised with inflation, whatever markets do. It&apos;s the simplest approach and the most cautious test.
        {" "}Most retirees flex a little instead. Here&apos;s how six common approaches would have handled your plan ({money(S.fv)} at {fmtNum(S.retire)}, aiming to spend {money(S.spend)}
        {" "}a year) in every retirement since {S.H.first}.</Lead>
      <BackNote step="strategy" />
      <H3>What&apos;s the least you could live on?</H3>
      <p className="hint" style={{ margin: "-4px 0 10px", maxWidth: "64ch" }}>Flexible approaches cut spending in bad markets, and some cut deep. A minimum stops them going lower: housing, food, insurance, utilities and the other essentials, in today&apos;s dollars. Leave it blank for no minimum.</p>
      <div className="gd-picks">{picks.filter((p) => p[1] < S.spend).map(([lab, val]) => {
        const r = Math.round(val / 500) * 500;
        return <button key={lab} type="button" className="gd-pick" data-fill="minSpend" data-v={r} onClick={() => fill(G, "minSpend", r)}>{lab}: <b>{money(r) + "/yr"}</b></button>;
      })}</div>
      <Fields><MoneyF k="minSpend" label="Minimum yearly spending" per="/yr" ph="no minimum" full /></Fields>
      <MinNote a={a} />
      <StratTable a={a} />
      <H3>Which would you follow?</H3>
      <div className="gd-choices two">{STRATS.map((x) => <Choice key={x.id} k="strategy" val={x.id} title={x.name} />)}</div>
      <StratPick a={a} />
      <Callout>Your score keeps testing the fixed approach, the cautious case. A flexible approach only adds safety if you&apos;d really cut back when it says to.</Callout>
      <Task id="drawdown" head="Walk through the Drawdown Simulator" label="Start the tour"
        after={<After>Optional. Seven short parts: your result, a bad start, strategies, your mix, Social Security timing, life events and stress tests. Anything you change there can come back into your plan.</After>} />
    </>
  );
}
