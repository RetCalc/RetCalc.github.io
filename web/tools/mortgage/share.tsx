"use client";

/* The Mortgage Calculator's printed summary and image card. From
   buildMortSheet() in src/js/app/10-summary-sheets.js and the mortgage card
   in 25-share-card.js. */

import { SheetPage, SheetSection, SheetTable, sampled, type SheetRows } from "@/components/shell/Sheet";
import { copyChart, type ShareKit } from "@/components/shell/share";
import { mortgage, refiCompare } from "@/lib/engine/typed";
import { fmtNum, money, pctStr } from "@/lib/format";
import { dur, mortgageInput, when, type Inputs } from "./model";

export function mortgageShare(s: Inputs): ShareKit {
  const m = mortgageInput(s);
  return {
    sheet: () => {
      if (!(m.price > 0)) return "Enter a home price first";
      const R = mortgage(m);
      const loan: SheetRows = [["Home price", money(m.price)], ["Down payment", money(m.down) + " (" + pctStr(m.price ? m.down / m.price : 0, 0) + ")"],
        ["Loan amount", money(R.loan)], ["Interest rate", pctStr(m.rate, 2)], ["Term", fmtNum(m.term) + " years"]];
      if (R.pmi > 0) loan.push(["PMI", money(R.pmi) + "/mo until 20% equity"]);
      const pay: SheetRows = [["Principal & interest", money(R.pi)], ["Property tax", money(R.tax)], ["Insurance", money(R.ins)]];
      if (R.pmi > 0) pay.push(["PMI", money(R.pmi)]);
      if (R.maint > 0) pay.push(["Maintenance", money(R.maint)]);
      if (R.util > 0) pay.push(["Utilities", money(R.util)]);
      if (R.hoa > 0) pay.push(["HOA", money(R.hoa)]);
      pay.push(["Total monthly payment", money(R.total)]);
      const life: SheetRows = [["Total interest paid", money(R.totalInterest)], ["Total cost of loan", money(R.loan + R.totalInterest)]];
      if (R.pmiPaid > 0) life.push(["Total PMI paid", money(R.pmiPaid)]);
      const half = R.years.findIndex((y) => y.balance <= R.loan / 2) + 1;
      if (half > 0) life.push(["Halfway point (balance)", "Year " + half]);
      life.push(["Payoff", when(R.payoffMonth)]);
      if (R.extraActive) {
        const base = mortgage({ ...m, extraMonthly: 0, extraOnce: 0, extraOnceMonth: 0, recast: false });
        life.push(["With extra payments", dur(base.payoffMonth - R.payoffMonth) + " sooner, " + money(base.totalInterest - R.totalInterest) + " less interest"]);
        if (R.recastPI != null) life.push(["Payment after recast", money(R.recastPI) + "/mo"]);
      }
      if (m.refiOn) {
        const RF = refiCompare(m, { rate: m.refiRate, term: m.refiTerm, cost: m.refiCost });
        life.push(["Refinance to " + pctStr(m.refiRate ?? 0, 2) + ", " + fmtNum(m.refiTerm ?? 0) + "yr",
          money(RF.then.pi) + "/mo, breaks even in " + (RF.breakEvenMonths == null ? "never" : RF.breakEvenMonths <= 0 ? "immediately" : dur(RF.breakEvenMonths)) +
          ", " + (RF.lifetimeDelta >= 0 ? "saves " : "costs ") + money(Math.abs(RF.lifetimeDelta)) + " lifetime"]);
      }
      return (
        <SheetPage title="Mortgage Summary" sub={fmtNum(m.term) + " year term"}
          big={[["Monthly payment", money(R.total), "all in"], ["Loan amount", money(R.loan), pctStr(m.price ? m.down / m.price : 0, 0) + " down"],
            ["Total interest", money(R.totalInterest), "over the loan"]]}
          chart={copyChart("#chartMo")}
          foot="Rate and costs are estimates. Actual terms depend on credit, lender and location. Not a loan offer.">
          <div className="sh-cols">
            <SheetSection t="The loan" rows={loan} />
            <SheetSection t="Monthly payment" rows={pay} />
            <SheetSection t="Over the life of the loan" rows={life} />
          </div>
          <SheetTable t="Amortization" head={["Year", "Interest", "Principal", "Total paid", "Balance"]}
            rows={sampled(R.years).map((y) => [y.year, money(y.interest), money(y.principal), money(y.paid), money(y.balance)])} />
        </SheetPage>
      );
    },
    card: () => {
      const R = mortgage(m);
      return { title: "My mortgage", bigLabel: "Total monthly payment", big: money(R.total),
        sub: money(m.price) + " home · " + pctStr(m.rate, 2) + " rate · " + fmtNum(m.term) + " year term",
        rows: [["Principal & interest", money(R.pi)], ["Property tax & insurance", money(R.tax + R.ins)], ["Loan amount", money(R.loan)],
          ["Down payment", money(m.down) + " (" + pctStr(m.price ? m.down / m.price : 0, 0) + ")"], ["Total interest, full loan", money(R.totalInterest)],
          ["Total cost of the loan", money(R.loan + R.totalInterest)], ["Payoff", "Year " + R.years.length]],
        chart: { sel: "#chartMo", w: 900, h: 300 } };
    },
  };
}
