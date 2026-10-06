"use client";

/* Debt Payoff's printed summary. From buildDebtSheet() in
   src/js/app/18-debt.js. */

import { SheetPage, SheetSection, SheetTable } from "@/components/shell/Sheet";
import { copyChart, type ShareKit } from "@/components/shell/share";
import { debtDate, debtDur, debtRun } from "@/lib/engine/typed";
import { money, parseNum, pctStr } from "@/lib/format";
import { debtList, type DebtInputs } from "./model";

export function debtShare(s: DebtInputs): ShareKit {
  return {
    sheet: () => {
      const debts = debtList(s.rows), live = debts.filter((d) => d.balance > 0);
      if (!live.length) return "Add a debt first";
      const extra = Math.max(0, parseNum(s.extra) || 0), snow = s.mode === "snowball";
      const av = debtRun(debts, extra, "avalanche")!, sn = debtRun(debts, extra, "snowball")!, mn = debtRun(debts, 0, "min")!;
      const pick = snow ? sn : av, owed = live.reduce((a, d) => a + d.balance, 0);
      // Minimums that never clear have no total to compare against.
      const saved = mn.stalled ? "—" : money(Math.max(0, mn.totalInterest - pick.totalInterest));
      return (
        <SheetPage title="Debt Payoff" sub={money(owed) + " across " + live.length + (live.length === 1 ? " debt" : " debts")}
          big={[["Debt-free", pick.stalled ? "Never" : debtDate(pick.monthsTotal), pick.stalled ? "Payments never clear the balance" : debtDur(pick.monthsTotal) + " from now"],
            ["Total interest", money(pick.totalInterest), money(pick.totalPaid) + " paid in all"], ["Saved vs. minimums", saved, "in interest"]]}
          chart={copyChart("#chartDT")}
          foot="Assumes fixed minimums, fixed rates, and no new borrowing. Card minimums usually fall as the balance does, which makes real payoff slower than this unless you keep paying the original amount. Not financial advice.">
          <div className="sh-cols">
            <SheetSection t="The debts" rows={[["Total owed", money(owed)], ["Number of debts", String(live.length)], ["Minimum payments", money(pick.baseMin) + "/mo"],
              ["Extra payment", money(extra) + "/mo"], ["Total going at debt", money(pick.monthlyPool) + "/mo"],
              ["Strategy", snow ? "Snowball, smallest balance first" : "Avalanche, highest rate first"]]} />
            <SheetSection t="Your plan" rows={[["Debt-free", pick.stalled ? "Never" : debtDate(pick.monthsTotal)], ["How long", pick.stalled ? "—" : debtDur(pick.monthsTotal)],
              ["Total interest", money(pick.totalInterest)], ["Total paid", money(pick.totalPaid)], ["Interest saved vs. minimums", saved]]} />
            <SheetSection t="Avalanche vs. snowball" rows={[["Avalanche interest", money(av.totalInterest)], ["Snowball interest", money(sn.totalInterest)],
              ["Difference", money(Math.abs(sn.totalInterest - av.totalInterest))], ["Minimums only", mn.stalled ? "Never clears" : money(mn.totalInterest)],
              ["First debt gone", debtDur(pick.firstCleared)]]} />
          </div>
          <SheetTable t="Payoff order" head={["#", "Debt", "Balance", "Rate", "Minimum", "Interest paid", "Cleared"]}
            rows={pick.order.map((d, i) => [i + 1, d.desc, money(d.start), pctStr(d.apr, 2), money(d.min), money(d.interest), d.paidMonth ? debtDate(d.paidMonth) : "Not cleared"])} />
        </SheetPage>
      );
    },
  };
}
