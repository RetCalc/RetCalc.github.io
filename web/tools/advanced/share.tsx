"use client";

/* The Advanced and Stages calculators' printed summary and image card: one
   template for both, as on the old site. From buildSheet() in
   src/js/app/10-summary-sheets.js and the projection card in 25-share-card.js. */

import { SheetPage, SheetSection, SheetTable, sampled, type SheetRows } from "@/components/shell/Sheet";
import { copyChart, type ShareKit } from "@/components/shell/share";
import { milestoneRows } from "@/components/ui/Milestones";
import type { Accounts } from "@/lib/accounts";
import { coastFire, goalSolve, solveYears } from "@/lib/engine/typed";
import type { Plan, Projection, Series } from "@/lib/engine/types";
import { fmtNum, fmtYears, money, parseNum, pctStr } from "@/lib/format";
import { PERIOD_ADV } from "@/lib/periods";
import { MC_RUNS } from "@/lib/mc-seed";
import type { EffStage } from "@/tools/stages/model";
import type { AdvancedPlan } from "./model";
import { solvePlan } from "./model";

/* Split by account type, the three starting balances rather than one total. */
const startRows = (a: Accounts | null | undefined, total: number): SheetRows =>
  a ? [["Traditional balance", money(a.tradBal)], ["Roth balance", money(a.rothBal)], ["Brokerage balance", money(a.brokBal)]] : [["Starting value", money(total)]];

export type ProjectionView =
  | { kind: "advanced"; P: AdvancedPlan; R: Projection; target: string; solveFor: string; mode: string }
  | { kind: "stages"; g: { initial: number; inflation: number; withdrawal: number; taxRate: number; fees: number; acct?: Accounts }; eff: EffStage[]; R: Series; mode: string };

export function projectionShare(v: ProjectionView): ShareKit {
  const series = v.kind === "stages";
  const chartSel = series ? "#chartS" : "#chart";
  return {
    sheet: () => {
      const R = v.R, years = series ? (v.R as Series).totalYears : (v as { P: AdvancedPlan }).P.p.years;
      const infl = series ? v.g.inflation : (v as { P: AdvancedPlan }).P.p.inflation;
      let inputs: SheetRows;
      if (v.kind === "stages") {
        const g = v.g;
        inputs = [...startRows(g.acct, g.initial), ["Inflation", pctStr(g.inflation, 2)], ["Withdrawal rate", pctStr(g.withdrawal, 2)],
          [g.acct ? "Tax on withdrawals, calculated" : "Effective tax rate", pctStr(g.taxRate, 2)]];
        if (g.fees > 0) inputs.push(["Fees", pctStr(g.fees, 2)]);
        // Capped so a plan with many stages can't push the sheet onto a
        // second page; a "+N more" line says what got left off.
        v.eff.slice(0, 5).forEach((st, i) => inputs.push(["Stage " + (i + 1) + " · " + fmtNum(st.years) + " yrs", money(st.contrib, 0) + " " + st.period.toLowerCase() + " @ " + pctStr(st.nominal, 2)]));
      } else {
        const p = v.P.p as Plan & { gross: number; fees: number }, a = v.P.a;
        inputs = [...startRows(a, p.initial), [a ? "Contribution, with match" : "Contribution", money(p.contrib, 2) + " " + p.period.toLowerCase()],
          ["Contribution growth", pctStr(p.growth, 2) + " / yr" + (a?.gRates ? " blended (traditional " + pctStr(a.gRates.t, 2) + ", Roth " + pctStr(a.gRates.r, 2) + ", taxable " + pctStr(a.gRates.b, 2) + ")" : "")],
          ["Time period", fmtNum(p.years) + " years"], ["Rate of return", pctStr(p.gross, 2)]];
        if (p.fees > 0) inputs.push(["Fees", "−" + pctStr(p.fees, 2)]);
        inputs.push(["Inflation", pctStr(p.inflation, 2)], ["Withdrawal rate", pctStr(p.withdrawal, 2)], [a ? "Tax on withdrawals, calculated" : "Effective tax rate", pctStr(p.taxRate, 2)]);
      }
      const lastPer = series ? (R as Series).lastPeriod : (v as { P: AdvancedPlan }).P.p.period;
      const out: SheetRows = [["Amount invested", money(R.invested)], ["Growth", money(R.growth)],
        ["Final contribution, inflation adj.", lastPer ? money(R.lastContribReal) + " " + PERIOD_ADV[lastPer] : money(0)],
        ["Future value", money(R.fv)], ["Inflation adjusted", money(R.fvReal)], ["Annual withdrawal", money(R.wdReal) + " (adj.)"],
        ["After tax, per year", money(R.afterTax)], ["After tax, per month", money(R.afterTaxMo)]];
      const rows = series ? (R as Series).calRows.map((r) => ({ year: r.year, end: r.end, growth: r.growth, contrib: r.contrib }))
        : (R as Projection).years.map((y) => ({ year: y.year, end: y.end, growth: y.growth, contrib: y.contrib }));
      // Goal-solve and Coast FIRE, single run only: where they live on screen.
      let goal: SheetRows | null = null;
      if (v.kind === "advanced") {
        const p = v.P.p, t = parseNum(v.target), S = goalSolve(solvePlan(v.P, v.solveFor, t), v.solveFor, t), C = coastFire(p, S.portFuture), Y = solveYears(p, S.portToday);
        goal = [["Target", v.solveFor === "After-Tax Withdrawal" ? money(t) + "/yr after tax" : money(t)], ["Portfolio needed", money(S.portToday)],
          ["Raise contribution to", money(S.perPeriod, 2) + " " + p.period.toLowerCase()], ["Or extend timeline to", Y.reached ? fmtYears(Y.years) : "Not reached in 100 yrs"],
          ["Coast FIRE", C.state === "already" ? "Already there" : C.state === "reachable" ? fmtYears(C.years) : "Not on track"]];
      }
      return (
        <SheetPage title="Investment Projection" sub={<>{series ? "Stages" : "Advanced"} &middot; {fmtNum(years)} years &middot; {v.mode === "mc" ? "Monte Carlo, " + MC_RUNS.toLocaleString() + " runs" : "Projection"}</>}
          big={[["Future value", money(R.fv), "after " + fmtNum(years) + " years"], ["Inflation adjusted", money(R.fvReal), "in today's spending power"],
            ["After-tax income / yr", money(R.afterTax), "first year of retirement"]]}
          chart={copyChart(chartSel)}
          foot="Figures are projections generated from the assumptions listed above, not predictions. Past performance does not predict future returns. This is not financial advice.">
          <div className="sh-cols">
            <section><div className="sh-t">Assumptions</div>{inputs.map(([k, x], i) => <div key={i} className="sh-r"><span>{k}</span><b>{x}</b></div>)}
              {v.kind === "stages" && v.eff.length > 5 ? <div className="sh-more">+ {v.eff.length - 5} more stage{v.eff.length - 5 === 1 ? "" : "s"}</div> : null}</section>
            <SheetSection t="Results" rows={out} />
            <SheetSection t="Milestones" rows={milestoneRows(rows, R.fv, (y) => "Year " + fmtNum(y))} />
            {goal ? <SheetSection t="Working toward a target" rows={goal} /> : null}
          </div>
          <SheetTable t="Year by year" head={["Year", "Contributed", "Growth", "Balance", "In today's $"]}
            rows={sampled(rows).map((r) => [r.year, money(r.contrib), money(r.growth), money(r.end), money(r.end / Math.pow(1 + infl, r.year))])} />
        </SheetPage>
      );
    },
    card: () => {
      const R = v.R;
      const years = series ? (R as Series).totalYears : (v as { P: AdvancedPlan }).P.p.years;
      const contrib = series ? v.eff[0] : (v as { P: AdvancedPlan }).P.p;
      const gross = series ? (v.eff[0]?.nominal ?? 0) : ((v as { P: AdvancedPlan }).P.p as Plan & { gross: number }).gross;
      return { title: series ? "My staged retirement plan" : "My retirement projection", bigLabel: "Inflation-adjusted value", big: money(R.fvReal),
        sub: fmtYears(years) + " · " + money(contrib?.contrib ?? 0, 0) + " " + (PERIOD_ADV[contrib?.period ?? ""] ?? "") + " · " + pctStr(gross, 2) + " return",
        rows: [["Future value", money(R.fv)], ["Inflation adjusted", money(R.fvReal)], ["After-tax income / yr", money(R.afterTax)],
          ["I put in", money(R.contribTotal)], ["Growth added", money(R.growth)]],
        chart: { sel: chartSel, w: 900, h: 300 } };
    },
  };
}
