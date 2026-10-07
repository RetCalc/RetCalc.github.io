"use client";

/* Chapter 6 · Make it stronger (doc 2): the lever table that teaches what
   each change does before any option is picked (lesson 16), and the two
   cards only some plans need, healthcare before 65 (lesson 18) and the
   years before 59½ (lesson 19). Adjust your plan, drawing it down and the
   Plan Optimizer keep their screens in tune.tsx, strategy.tsx and
   optimize.tsx, with their lessons added there. */

import { fmtNum, money, pctStr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { withGuess } from "../calc";
import { HcNote, BridgeNote } from "../live";
import { LEVERS, type LeverRow } from "../levers";
import { Lesson, Term } from "../lessons/Lesson";
import { After, BackNote, Choice, H3, Lead, Q, Task, useGuideView } from "../ui";
import { usePlanJob } from "../usePlan";
import { Learn } from "../zones";

/** The rows the table shows (doc 3, section 3, item 8): the same fixed
    changes every visit, the ones that close a gap when the plan is short,
    and those that spend a surplus when it's ahead. */
export const LEVER_ROWS = {
  behind: ["save+100", "save+250", "retire+1", "retire+3", "spend-5000"],
  ahead: ["save+100", "retire+1", "retire-1", "spend-5000", "spend+10000"],
};
const LABEL: Record<string, string> = {
  "save+100": "Save $100 a month more", "save+250": "Save $250 a month more",
  "retire-3": "Retire three years sooner", "retire-1": "Retire a year sooner", "retire+1": "Retire a year later", "retire+3": "Retire three years later",
  "spend-5000": "Spend $5,000 a year less", "spend+5000": "Spend $5,000 a year more", "spend+10000": "Spend $10,000 a year more",
};

/** Lesson 16's figure: the plan as it stands, then one change at a time. */
export function LeverTable({ ahead }: { ahead: boolean }) {
  const { a } = useGuideView();
  const job = usePlanJob<{ now: LeverRow; rows: (LeverRow | null)[] }>("levers", withGuess(a), { slot: "levers", prio: 3 });
  const R = job.res;
  if (R === undefined) return <p className="gd-means-empty">Running your plan with each change…</p>;
  if (!R) return null;
  const ids = ahead ? LEVER_ROWS.ahead : LEVER_ROWS.behind;
  const rows = ids.map((id) => ({ id, r: R.rows[LEVERS.findIndex((L) => L.id === id)] })).filter((x) => x.r);
  const cell = (v: string, was: string) => <td className={v !== was ? "chg" : undefined}>{v}</td>;
  return (
    <table className="gd-cmp-t gd-levers" aria-busy={job.stale || undefined}>
      <caption className="sr-only">Your plan with one change at a time</caption>
      <thead><tr><th scope="col">Change</th><th scope="col">Savings at retirement</th><th scope="col">The plan needs</th><th scope="col">Lasted</th></tr></thead>
      <tbody>
        <tr className="now"><th scope="row">As it stands, at {fmtNum(R.now.retire)}</th><td>{money(R.now.fv)}</td><td>{money(R.now.need)}</td><td>{pctStr(R.now.success, 0)}</td></tr>
        {rows.map(({ id, r }) => (
          <tr key={id} data-lever-row={id}><th scope="row">{LABEL[id]}</th>
            {cell(money(r!.fv), money(R.now.fv))}{cell(money(r!.need), money(R.now.need))}{cell(pctStr(r!.success, 0), pctStr(R.now.success, 0))}</tr>
        ))}
      </tbody>
    </table>
  );
}

export function LeversLesson({ ahead }: { ahead: boolean }) {
  return (
    <Learn>
      <Lesson id="levers" figure={<LeverTable ahead={ahead} />} caption="The same fixed changes every visit, so you can compare one visit with the next. Savings and needs in today's dollars.">
        <p>Four levers move a plan: saving more, working longer, spending less in retirement, and how long you keep saving. They don&apos;t move it equally.
          {" "}A year of work adds a year of saving and takes a year off what the savings must fund, which is why it&apos;s usually the strongest; spending
          {" "}moves what the plan needs; saving moves what you&apos;ll have.</p>
        <p>The table runs your plan again with one change at a time{ahead ? ", including ways to use what you have to spare" : ""}, before any option below is
          {" "}chosen. The options then solve for the exact change that {ahead ? "uses the margin" : "closes the gap"}.</p>
      </Lesson>
    </Learn>
  );
}

/* ---------- Healthcare before 65 ---------- */
export function HealthCard() {
  const { v, a } = useGuideView(), gap = 65 - Math.round(v.retire!);
  return (
    <>
      <Q>Healthcare before Medicare</Q>
      <Learn>
        <Lesson id="cliff">
          <p>Retiring at {fmtNum(v.retire!)} leaves <b>{gap + (gap === 1 ? " year" : " years")}</b> before Medicare starts at 65. Until then coverage comes from the
            {" "}<Term k="aca">ACA</Term> marketplace, where the price follows your income in retirement, measured as <Term k="magi">MAGI</Term>: the lower it is,
            {" "}the larger the subsidy. Above 400% of the poverty line the subsidy stops all at once, so a dollar of extra income there can cost thousands in premiums.</p>
          <p>Your plan prices it year by year: the benchmark Silver plan for your state and age, less the subsidy that year&apos;s income earns.</p>
        </Lesson>
      </Learn>
      <BackNote step="health" />
      <H3>Is health insurance already in your retirement spending?</H3>
      <div className="gd-choices two"><Choice k="hcIncl" val="no" title="No, price it for me" sub="The usual answer" /><Choice k="hcIncl" val="yes" title="Yes, it's included" sub="Your plan won't add premiums" /></div>
      <HcNote a={a} />
      <Task id="healthcare" head="Explore it in the Healthcare Cost Planner" after={<After>Optional. It shows how the subsidy moves with income, and Medicare&apos;s costs after 65.</After>} />
    </>
  );
}

/* ---------- Getting to 59½ ---------- */
export function BridgeCard() {
  const G = useGuideView(), { v, a } = G, gap = Math.ceil(59.5 - v.retire!);
  return (
    <>
      <Q>Getting to 59½</Q>
      <Learn>
        <Lesson id="ways-across">
          <p>Retiring at {fmtNum(v.retire!)} means about <b>{gap + (gap === 1 ? " year" : " years")}</b> before a 401(k) or IRA opens up without a 10% penalty.
            {" "}There are legal ways across. Live on a brokerage account first, then on Roth contributions, which can come out any time. Build a{" "}
            <Term k="rothladder">Roth conversion ladder</Term>: convert traditional money to Roth, and five years later it can come out. Take{" "}
            <Term k="t72">72(t) payments</Term>, a fixed series that avoids the penalty. Or use the <Term k="rule55">rule of 55</Term>, for a 401(k) from a job you
            {" "}leave in or after the year you turn 55.</p>
          <p>Which works best depends on where your money sits.</p>
        </Lesson>
      </Learn>
      <Lead>Your plan already follows the rules: before 59½ it lives on the brokerage account and Roth contributions first, and only pays the 10% penalty if
        {" "}nothing else is left. The Plan Optimizer, next, can build a Roth conversion ladder to open up traditional money early.</Lead>
      <BridgeNote a={a} />
      <p className="hint -mt-1.5 mx-0 mb-3.5">The split comes from your answers on Where it sits. <Button variant="quiet" size="inline" data-go="accounts" onClick={() => G.go("accounts")}>Change it</Button></p>
      {v.retire! >= 55 ? <><H3>Will you leave a job with a 401(k) at 55 or later?</H3>
        <div className="gd-choices two"><Choice k="rule55" val="yes" title="Yes" sub="The rule of 55 lets that 401(k) pay out without the penalty" /><Choice k="rule55" val="no" title="No, or not sure" /></div></> : null}
      <BackNote step="bridge" />
      <Task id="bridge" head="Plan it in the Early Retirement Bridge" after={<After>Optional: it also compares 72(t) payments, which this plan doesn&apos;t use.</After>} />
    </>
  );
}
