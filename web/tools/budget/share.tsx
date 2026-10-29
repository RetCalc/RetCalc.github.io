"use client";

/* The Budget's printed summary and image card: what you spend, by group,
   and the emergency fund it sizes. Pay and saving are the Paycheck tab's.
   From buildBudgetSheet() in src/js/app/10-summary-sheets.js and the
   budget card in 25-share-card.js. */

import { SheetPage, SheetSection } from "@/components/shell/Sheet";
import type { ShareKit } from "@/components/shell/share";
import { money } from "@/lib/format";
import { annualize, budgetCompute, budgetGroups, budgetTotals, isPlannedRow, type BudgetInputs, type BudgetRow } from "./model";

/* The lines by group, in the tool's own order. */
const ORDER = ["Housing", "Transportation", "Health", "Food", "Lifestyle", "Debt", "Custom"];
function byGroup(rows: BudgetRow[]) {
  const g: Record<string, BudgetRow[]> = {};
  rows.forEach((r) => { if (annualize(r) > 0 && !isPlannedRow(r)) (g[r.group || "Custom"] ??= []).push(r); });
  return g;
}
const perMo = (yr: number) => money(yr / 12) + "/mo";

export function budgetShare(s: BudgetInputs): ShareKit {
  // The emergency fund as the screen sizes it: on the emergency budget when that's chosen.
  const T = budgetTotals(s), C = budgetCompute(s), ef = C.ef, target = money(C.efTarget);
  const emerg = !!s.efEmerg && s.efBasis === "emergency", basis = perMo((C.efTarget / ef) * 12);
  return {
    sheet: () => {
      if (!(T.totalYr > 0)) return "Add your expenses first";
      const groups = byGroup(s.rows);
      const order = [...ORDER, ...Object.keys(groups).filter((g) => !ORDER.includes(g))];
      return (
        <SheetPage title="Monthly Budget" sub="Per month, unless noted"
          big={[["Budget", money(T.totalYr / 12), "per month"], ["Per year", money(T.totalYr), "every line"],
            ["Emergency fund", target, ef + " months of " + (emerg ? "emergency " : "") + "spending"]]}
          foot="A snapshot of what you entered. Goals set aside for, like college savings, count in the budget but not in the emergency fund target. Pay, taxes and saving are on the Budget's Paycheck tab.">
          <div className="sh-cols">
            <SheetSection className="flex-1 min-w-0" t="Where it goes" rows={budgetGroups(s).map((x) => [x.group, perMo(x.yr)])} />
            <SheetSection className="flex-1 min-w-0" t="Emergency fund" rows={[[ef + "-month target", target], ["Based on", basis + " of " + (emerg ? "emergency budget" : "spending")]]} />
          </div>
          <div className="sh-cols">
            {order.filter((g) => groups[g]).map((g) => <SheetSection key={g} className="flex-1 min-w-0" t={g} rows={groups[g].map((r) => [r.desc, perMo(annualize(r))])} />)}
          </div>
        </SheetPage>
      );
    },
    card: () => {
      const top = budgetGroups(s).slice(0, 3).map((x) => [x.group, perMo(x.yr)] as [string, string]);
      return { title: "My monthly budget", bigLabel: "Budget, per month", big: money(T.totalYr / 12),
        sub: money(T.totalYr) + " per year",
        rows: [...top, ["Emergency fund target", target + " (" + ef + " mo)"]] };
    },
  };
}
