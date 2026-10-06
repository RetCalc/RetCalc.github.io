"use client";

/* College Savings' printed summary and image card, for one child or a
   family. From buildCollegeSheet() and buildCollegeFamilySheet() in
   src/js/app/10-summary-sheets.js and the college cards in 25-share-card.js. */

import { SheetPage, SheetSection, SheetTable, sampled } from "@/components/shell/Sheet";
import { copyChart, type ShareKit } from "@/components/shell/share";
import { collegePlanCalc, collegeSavingsCalc } from "@/lib/engine/typed";
import { DASH, fmtNum, money, pctStr } from "@/lib/format";
import { collegeInput, phaseNote, type CollegeInputs } from "./model";

const FOOT = "Excludes financial aid, scholarships and 529 tax advantages. Tuition inflation is an assumption, not a guarantee.";
const assumptions = (inp: ReturnType<typeof collegeInput>): [string, string][] =>
  [["Currently saved", money(inp.saved)], ["Investment return", pctStr(inp.investRet, 1)], ["Tuition inflation", pctStr(inp.tuitionInfl, 1)]];

export function collegeShare(s: CollegeInputs): ShareKit {
  const inp = collegeInput(s), family = inp.kids.length > 1;
  return {
    sheet: () => {
      if (family) {
        const P = collegePlanCalc(inp);
        if (!P) return "Set an annual cost first";
        return (
          <SheetPage title="College Savings Plan" sub={fmtNum(P.kids.length) + " children"}
            big={[["Save per month", money(P.monthly), phaseNote(P)], ["Total cost, all children", money(P.totalFuture), "at future prices"], ["Needed today", money(P.pvToday), "present value"]]}
            chart={copyChart("#chartCl")} foot={FOOT}>
            <div className="sh-cols">
              <SheetSection t="Children" rows={inp.kids.map((k, i) => ["Child " + (i + 1), k.annualCost > 0 && k.yearsUntil > 0
                ? money(k.annualCost) + "/yr today, in " + fmtNum(k.yearsUntil) + " yrs, for " + fmtNum(k.collegeYrs) : "left out"])} />
              <SheetSection t="Assumptions" rows={assumptions(inp)} />
              <SheetSection t="Results" rows={[["Total cost, all children", money(P.totalFuture)], ["Needed today", money(P.pvToday)],
                ...P.phases.map((x, i) => [i ? "Then, from year " + fmtNum(Math.round((x.from / 12) * 10) / 10) : "Monthly savings needed", money(x.monthly) + "/mo"] as [string, string]),
                ...P.kids.map((k) => ["Child " + (k.index + 1) + ", all years", money(k.total)] as [string, string])]} />
            </div>
            <SheetTable t="One account for all of them" head={["Year", "Contributed", "Growth", "Paid for college", "Balance"]}
              rows={sampled(P.rows, (r) => r.paid > 0).map((r) => [r.year, money(r.contribs), money(r.growth), r.paid > 0 ? money(r.paid) : DASH, money(r.balance)])} />
          </SheetPage>
        );
      }
      if (!(inp.annualCost > 0)) return "Set an annual cost first";
      const R = collegeSavingsCalc(inp);
      return (
        <SheetPage title="College Savings Plan" sub={fmtNum(inp.yearsUntil) + " years to go"}
          big={[["Save per month", money(R.monthly), "to close the gap"], ["Total cost, all years", money(R.totalFuture), fmtNum(inp.collegeYrs) + " years"],
            ["Needed when college starts", money(R.targetAtStart), "present value"]]}
          chart={copyChart("#chartCl")} foot={FOOT}>
          <div className="sh-cols">
            <SheetSection t="Assumptions" rows={[["Annual cost today", money(inp.annualCost)], ["Years until college", fmtNum(inp.yearsUntil)],
              ["Years of college", fmtNum(inp.collegeYrs)], ["Currently saved", money(inp.saved)], ["Investment return", pctStr(inp.investRet, 1)], ["Tuition inflation", pctStr(inp.tuitionInfl, 1)]]} />
            <SheetSection t="Results" rows={[["Total cost, all years", money(R.totalFuture)], ["Savings grow to", money(R.savingsAtStart)],
              ["Needed when college starts", money(R.targetAtStart)], ["Shortfall to close", money(R.shortfall)], ["Monthly savings needed", money(R.monthly)]]} />
            <SheetSection t="Cost by college year" rows={R.yearCosts.map((c, i) => ["College year " + (i + 1), money(c)])} />
          </div>
          <SheetTable t="Savings accumulation" head={["Year", "Contributed", "Growth", "Balance"]}
            rows={sampled(R.rows).map((r) => [r.year, money(r.contribs), money(r.growth), money(r.balance)])} />
        </SheetPage>
      );
    },
    card: () => {
      const chart = { sel: "#chartCl", w: 900, h: 300 };
      if (family) {
        const P = collegePlanCalc(inp);
        return { title: "College savings plan", bigLabel: "Save per month", big: P ? money(P.monthly) : DASH, sub: P ? fmtNum(P.kids.length) + " children · " + phaseNote(P) : "",
          rows: P ? [["Total cost, all children", money(P.totalFuture)], ["Needed today", money(P.pvToday)],
            ...P.kids.map((k) => ["Child " + (k.index + 1) + ", in " + fmtNum(k.yearsUntil) + " yrs", money(k.total)] as [string, string]), ...assumptions(inp)] : [], chart };
      }
      const R = collegeSavingsCalc(inp);
      return { title: "College savings plan", bigLabel: "Save per month", big: money(R.monthly),
        sub: fmtNum(inp.yearsUntil) + " years to go · " + money(inp.annualCost) + "/yr today · " + fmtNum(inp.collegeYrs) + " years of school",
        rows: [["Total cost, all years", money(R.totalFuture)], ["Needed when college starts", money(R.targetAtStart)], ["Currently saved", money(inp.saved)],
          ["Savings grow to", money(R.savingsAtStart)], ["Shortfall to close", money(R.shortfall)], ["Investment return", pctStr(inp.investRet, 1)], ["Tuition inflation", pctStr(inp.tuitionInfl, 1)]], chart };
    },
  };
}
