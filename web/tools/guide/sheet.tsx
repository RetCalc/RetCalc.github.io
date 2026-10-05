"use client";

/* The readiness plan on one printed page: the score, savings and how often
   it lasted, the chart, the plan, the numbers, the score by area and the
   next moves. From gdGuideSheet() in src/js/app/33-guide-share-controls.js. */

import { SheetMark, SheetRow as Row } from "@/components/shell/Sheet";
import { Html } from "@/components/ui/Html";
import { fmtNum, money, pctStr } from "@/lib/format";
import { opTacticsLine } from "@/tools/optimizer/words";
import { FACTORS, minSpend, need, ok, pos, rating, riskLabel, score, sim, stratName } from "./calc";
import { PlanDrawing, series } from "./chart";
import { actions } from "./results";
import type { Answers } from "./store";

export function GuideSheet({ a }: { a: Answers }) {
  const R = score(a), S = sim(a)!;
  const rt = rating(R.score), want = need(a, S), A = actions(a);
  const d = new Date();
  return (
    <>
      <div className="sh-h"><SheetMark /><h1>Retirement Readiness Plan</h1><span>{d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} &middot; every figure in today&apos;s dollars</span></div>
      <div className="sh-big">
        <div><div className="k">Readiness score</div><div className="v">{R.score} / 100</div><div className="n">{rt.label}</div></div>
        <div><div className="k">Savings at {fmtNum(S.retire)}</div><div className="v">{money(S.fv)}</div><div className="n">{want > 0 ? "needs about " + money(want) : "projected"}</div></div>
        <div><div className="k">Lasted in</div><div className="v">{pctStr(S.success, 0)}</div><div className="n">of retirements since {S.H.first}</div></div>
      </div>
      <div className="sh-chart"><PlanDrawing id="sheet" series={[series(S, a.age!, "Your plan", "p")]} caption="Your retirement savings over time, in today's dollars" /></div>
      <div className="sh-cols">
        <section><div className="sh-t">Your plan</div>
          <Row k="Retire at" v={fmtNum(S.retire)} />
          <Row k="Saving" v={S.stop != null ? (S.stop <= a.age! ? "Coasting, nothing new" : money(S.monthly) + "/mo to " + fmtNum(S.stop)) : money(S.monthly) + "/mo to retirement"} />
          <Row k="Spending in retirement" v={money(S.spend) + "/yr"} />
          {minSpend(a) ? <Row k="Minimum spending" v={money(minSpend(a)) + "/yr"} /> : null}
          <Row k="Social Security" v={money(S.ss.total / 12) + "/mo from " + S.ss.claim} />
          {S.pension ? <Row k="Pension" v={money(S.pension / 12) + "/mo"} /> : null}
          <Row k="Withdrawals" v={S.tactics ? opTacticsLine(S.T, S.C) : "Brokerage, then traditional, then Roth"} />
          <Row k="Income tax" v={"About " + money(S.taxYr) + "/yr"} />
          <Row k="Withdrawal approach" v={stratName(a.strategy || "fixed")} />
          <Row k="Stocks in retirement" v={S.mix + "%"} />
        </section>
        <section><div className="sh-t">Your numbers</div>
          {pos(a.takehome) ? <Row k="Take-home pay" v={money(a.takehome) + "/mo"} /> : null}
          {pos(a.spend) ? <Row k="Spending today" v={money(a.spend) + "/mo"} /> : null}
          {ok(a.cash) ? <Row k="Emergency fund" v={money(a.cash)} /> : null}
          {a.debtHas === "yes" && ok(a.debtTotal) ? <Row k="Debt, excluding mortgage" v={money(a.debtTotal)} /> : null}
          {ok(a.saved) ? <Row k="Retirement savings" v={money(a.saved)} /> : null}
          <Row k={"Projected at " + fmtNum(S.retire)} v={money(S.fv)} />
          {want > 0 ? <Row k={"Needed at " + fmtNum(S.retire)} v={money(want)} /> : null}
        </section>
        <section><div className="sh-t">Score by area</div>
          {FACTORS.map((f) => (R.P[f.id] ? <Row key={f.id} k={f.name} v={Math.round(R.P[f.id]!.p * f.w) + " / " + f.w} /> : null))}
        </section>
      </div>
      {A.length ? <div className="sh-moves"><div className="sh-t">Your next moves, in order</div><ol>{A.map((x) => <li key={x.t}><b>{x.t}</b> <Html as="span" html={x.d} /></li>)}</ol></div> : null}
      <div className="sh-foot">Savings grow at {pctStr(S.real, 1)} a year after inflation for a {riskLabel(S.real)} mix, with contributions rising with inflation.
        {" "}Retirement is tested against every historical retirement since {S.H.first} with {S.mix}% in stocks, spending a fixed amount that rises with inflation.
        {" "}Spending is after tax: each year&apos;s income tax, Medicare surcharge and health insurance before 65 are worked out from where the money comes from and paid on top
        {S.tactics ? ", with the Plan Optimizer's roadmap applied (" + opTacticsLine(S.T, S.C).toLowerCase() + ")" : ""}.
        {" "}Social Security is an estimate. This is a rule-of-thumb plan, not financial advice.</div>
    </>
  );
}
