"use client";

/* The Budget's printed summary and image card. From buildBudgetSheet() in
   src/js/app/10-summary-sheets.js and the budget card in 25-share-card.js. */

import { SheetPage, SheetSection } from "@/components/shell/Sheet";
import type { ShareKit } from "@/components/shell/share";
import { DASH, money, parseNum, pctStr } from "@/lib/format";
import { annualize, budgetTotals, isSavingsRow, type BudgetInputs, type BudgetRow } from "./model";

/* Spending by category, in the tool's own order. */
const ORDER = ["Housing", "Transportation", "Health", "Food", "Lifestyle", "Saving & debt", "Custom"];
function byGroup(rows: BudgetRow[]) {
  const g: Record<string, BudgetRow[]> = {};
  rows.forEach((r) => { if (annualize(r) > 0 && !isSavingsRow(r)) (g[r.group || "Custom"] ??= []).push(r); });
  return g;
}
const perMo = (yr: number) => money(yr / 12) + "/mo";

export function budgetShare(s: BudgetInputs): ShareKit {
  const T = budgetTotals(s), ef = Math.max(1, Math.round(parseNum(s.efMonths)) || 6);
  return {
    sheet: () => {
      if (!(T.incomeYr > 0) && !(T.spentYr > 0)) return "Add your income first";
      const groups = byGroup(s.rows), saves = s.rows.filter((r) => isSavingsRow(r) && annualize(r) > 0);
      const summary: [string, string][] = [["Income", perMo(T.incomeYr)], ["Spending", perMo(T.spentYr)]];
      if (T.savedYr > 0) summary.push(["Saving", perMo(T.savedYr)]);
      summary.push(["Left over", perMo(T.leftYr)], ["Percent of income spent", T.incomeYr ? pctStr(T.spentYr / T.incomeYr, 0) : DASH]);
      if (T.savedYr > 0) summary.push(["Percent of income saved", T.incomeYr ? pctStr(T.savedYr / T.incomeYr, 0) : DASH]);
      return (
        <SheetPage title="Monthly Budget" sub="Per month, unless noted"
          big={[["Income", money(T.incomeYr / 12), "per month"], ["Spending + saving", money((T.spentYr + T.savedYr) / 12), "per month"],
            ["Left over", money(T.leftYr / 12), (T.incomeYr ? pctStr(T.leftYr / T.incomeYr, 0) : DASH) + " of income"]]}
          foot="A snapshot of what you entered. Savings and retirement contributions are shown separately from spending and excluded from the emergency fund target. Doesn't include taxes withheld or account for irregular income.">
          <div className="sh-cols">
            <section className="flex-1 min-w-0"><div className="sh-t">Summary</div>{summary.map(([k, v]) => <div key={k} className="sh-r"><span>{k}</span><b>{v}</b></div>)}
              {saves.length ? <><div className="sh-t mt-2">Saving</div>{saves.map((r, i) => <div key={i} className="sh-r"><span>{r.desc}</span><b>{perMo(annualize(r))}</b></div>)}</> : null}
            </section>
            <SheetSection className="flex-1 min-w-0" t="Emergency fund" rows={[[ef + "-month target", money((T.spentYr / 12) * ef)], ["Based on", perMo(T.spentYr) + " actual expenses"]]} />
          </div>
          <div className="sh-cols">
            {ORDER.filter((g) => groups[g]).map((g) => <SheetSection key={g} className="flex-1 min-w-0" t={g} rows={groups[g].map((r) => [r.desc, perMo(annualize(r))])} />)}
          </div>
        </SheetPage>
      );
    },
    card: () => {
      const cats: Record<string, number> = {};
      s.rows.forEach((r) => { if (annualize(r) > 0 && !isSavingsRow(r)) cats[r.group || "Custom"] = (cats[r.group || "Custom"] || 0) + annualize(r); });
      const top = Object.keys(cats).sort((a, b) => cats[b] - cats[a]).slice(0, 3).map((g) => [g, perMo(cats[g])] as [string, string]);
      return { title: "My monthly budget", bigLabel: "Left over, per month", big: money(T.leftYr / 12),
        sub: money(T.incomeYr / 12) + " income · " + money(T.spentYr / 12) + " spending, per month",
        rows: [["Income", perMo(T.incomeYr)], ["Spending", perMo(T.spentYr)], ...(T.savedYr > 0 ? [["Saving", perMo(T.savedYr)] as [string, string]] : []), ...top,
          ["Emergency fund target", money((T.spentYr / 12) * ef) + " (" + ef + " mo)"]] };
    },
  };
}
