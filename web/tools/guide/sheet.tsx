"use client";

/* The readiness plan on one printed page: the score, savings and how often
   it lasted, the chart, the plan, the numbers, the score by area and the
   next moves. From gdGuideSheet() in src/js/app/33-guide-share-controls.js. */

import { SheetPage, SheetSection, type SheetRows } from "@/components/shell/Sheet";
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
  const plan: SheetRows = [["Retire at", fmtNum(S.retire)],
    ["Saving", S.stop != null ? (S.stop <= a.age! ? "Coasting, nothing new" : money(S.monthly) + "/mo to " + fmtNum(S.stop)) : money(S.monthly) + "/mo to retirement"],
    ["Spending in retirement", money(S.spend) + "/yr"]];
  if (minSpend(a)) plan.push(["Minimum spending", money(minSpend(a)) + "/yr"]);
  plan.push(["Social Security", money(S.ss.total / 12) + "/mo from " + S.ss.claim]);
  if (S.pension) plan.push(["Pension", money(S.pension / 12) + "/mo"]);
  plan.push(["Withdrawals", S.tactics ? opTacticsLine(S.T, S.C) : "Brokerage, then traditional, then Roth"], ["Income tax", "About " + money(S.taxYr) + "/yr"],
    ["Withdrawal approach", stratName(a.strategy || "fixed")], ["Stocks in retirement", S.mix + "%"]);
  const nums: SheetRows = [];
  if (pos(a.takehome)) nums.push(["Take-home pay", money(a.takehome) + "/mo"]);
  if (pos(a.spend)) nums.push(["Spending today", money(a.spend) + "/mo"]);
  if (ok(a.cash)) nums.push(["Emergency fund", money(a.cash)]);
  if (a.debtHas === "yes" && ok(a.debtTotal)) nums.push(["Debt, excluding mortgage", money(a.debtTotal)]);
  if (ok(a.saved)) nums.push(["Retirement savings", money(a.saved)]);
  nums.push(["Projected at " + fmtNum(S.retire), money(S.fv)]);
  if (want > 0) nums.push(["Needed at " + fmtNum(S.retire), money(want)]);
  const d = new Date();
  return (
    <SheetPage title="Retirement Readiness Plan" sub={<>{d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} &middot; every figure in today&apos;s dollars</>}
      big={[["Readiness score", R.score + " / 100", rt.label], ["Savings at " + fmtNum(S.retire), money(S.fv), want > 0 ? "needs about " + money(want) : "projected"],
        ["Lasted in", pctStr(S.success, 0), "of retirements since " + S.H.first]]}
      foot={<>Savings grow at {pctStr(S.real, 1)} a year after inflation for a {riskLabel(S.real)} mix, with contributions rising with inflation.
        {" "}Retirement is tested against every historical retirement since {S.H.first} with {S.mix}% in stocks, spending a fixed amount that rises with inflation.
        {" "}Spending is after tax: each year&apos;s income tax, Medicare surcharge and health insurance before 65 are worked out from where the money comes from and paid on top
        {S.tactics ? ", with the Plan Optimizer's roadmap applied (" + opTacticsLine(S.T, S.C).toLowerCase() + ")" : ""}.
        {" "}Social Security is an estimate. This is a rule-of-thumb plan, not financial advice.</>}>
      <div className="sh-chart"><PlanDrawing id="sheet" series={[series(S, a.age!, "Your plan", "p")]} caption="Your retirement savings over time, in today's dollars" /></div>
      <div className="sh-cols">
        <SheetSection t="Your plan" rows={plan} />
        <SheetSection t="Your numbers" rows={nums} />
        <SheetSection t="Score by area" rows={FACTORS.filter((f) => R.P[f.id]).map((f) => [f.name, Math.round(R.P[f.id]!.p * f.w) + " / " + f.w])} />
      </div>
      {A.length ? <div className="sh-moves"><div className="sh-t">Your next moves, in order</div><ol>{A.map((x) => <li key={x.t}><b>{x.t}</b> <Html as="span" html={x.d} /></li>)}</ol></div> : null}
    </SheetPage>
  );
}
