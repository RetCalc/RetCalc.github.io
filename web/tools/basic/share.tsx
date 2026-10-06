"use client";

/* The Basic calculator's printed summary and image card. From
   buildBasicSheet() in src/js/app/10-summary-sheets.js and the Basic card
   in 25-share-card.js. */

import { SheetPage, SheetSection, SheetTable, sampled } from "@/components/shell/Sheet";
import { copyChart, type ShareKit } from "@/components/shell/share";
import { milestoneRows } from "@/components/ui/Milestones";
import { RISK_LEVELS, projectBasic } from "@/lib/engine/typed";
import { fmtNum, fmtYears, money, pctStr } from "@/lib/format";
import { PERIOD_ADV } from "@/lib/periods";
import { basicInput, type BasicInputs } from "./model";

export function basicShare(s: BasicInputs): ShareKit {
  const p = basicInput(s);
  return {
    sheet: () => {
      if (!(p.years > 0)) return "";
      const R = projectBasic(p), rows = R.years;
      const level = (RISK_LEVELS as { label: string; real: number }[]).find((r) => Math.abs(r.real - p.real) < 1e-9);
      return (
        <SheetPage title="Retirement Projection" sub={<>{fmtYears(p.years)} of saving &middot; every figure in today&apos;s dollars</>}
          big={[["Value at retirement", money(R.fv), "at age " + fmtNum(p.retire)], ["Income per year", money(R.fv * 0.04), "taking 4% a year"],
            ["Income per month", money((R.fv * 0.04) / 12), "before any tax"]]}
          chart={copyChart("#chartQ")}
          foot="All figures are in today's dollars and assume a steady return after inflation, no tax and no fees. Real returns vary year to year. Projections are not predictions, and this is not financial advice.">
          <div className="sh-cols">
            <SheetSection t="Your answers" rows={[["Age today", fmtNum(p.age)], ["Retiring at", fmtNum(p.retire)], ["Saved so far", money(p.initial)],
              ["Contributing", money(p.contrib, 2) + " " + PERIOD_ADV[p.period]], ["Invested as", level ? level.label : pctStr(p.real, 2)], ["Growth after inflation", pctStr(p.real, 2)]]} />
            <SheetSection t="Results" rows={[["You put in", money(R.contribTotal)], ["Growth added", money(R.growth)], ["Value at retirement", money(R.fv)],
              ["Income per year", money(R.fv * 0.04)], ["Income per month", money((R.fv * 0.04) / 12)]]} />
            <SheetSection t="Milestones" rows={milestoneRows(rows, R.fv, (y) => "Age " + fmtNum(p.age + y))} />
          </div>
          <SheetTable t="Year by year" head={["Age", "Contributed", "Growth", "Balance"]}
            rows={sampled(rows).map((r) => [p.age + r.year, money(r.contrib), money(r.growth), money(r.end)])} />
        </SheetPage>
      );
    },
    card: () => {
      const R = projectBasic(p);
      return { title: "My retirement projection", bigLabel: "Value at retirement, age " + fmtNum(p.retire), big: money(R.fv),
        sub: "In today's dollars · " + fmtYears(p.years) + " of saving · " + pctStr(p.real, 2) + " real return",
        rows: [["Income per year", money(R.fv * 0.04)], ["Income per month", money((R.fv * 0.04) / 12)], ["You put in", money(R.contribTotal)],
          ["Growth added", money(R.growth)], ["Growth after inflation", pctStr(p.real, 2)]],
        chart: { sel: "#chartQ", w: 900, h: 300 } };
    },
  };
}
