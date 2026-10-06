"use client";

/* The Income Tax tool's printed summary and image card. From
   buildTaxSheet() in src/js/app/10-summary-sheets.js and the tax card in
   25-share-card.js. */

import { SheetChart, SheetPage, SheetSection, SheetTable, type SheetRows } from "@/components/shell/Sheet";
import { copyChart, type ShareKit } from "@/components/shell/share";
import { FED_STD } from "@/lib/engine/typed";
import { money, pctStr } from "@/lib/format";
import { runTax, taxInput, type TaxInputs } from "./model";

export function taxShare(s: TaxInputs): ShareKit {
  const inp = taxInput(s), ret = inp.mode === "retire";
  return {
    sheet: () => {
      if (!(inp.gross + inp.gross2 > 0)) return "Enter your income first";
      const R = runTax(inp);
      const situation: SheetRows = [];
      if (ret) {
        if (inp.trad > 0) situation.push(["Traditional withdrawal", money(inp.trad)]);
        if (inp.roth > 0) situation.push(["Roth withdrawal", money(inp.roth)]);
        if (inp.brok > 0) situation.push(["Brokerage withdrawal", money(inp.brok) + " (" + pctStr(inp.gainPct, 0) + " gain)"]);
        if (inp.ss > 0) situation.push(["Social Security", money(inp.ss)]);
        if (inp.pension > 0) situation.push(["Pension / annuity", money(inp.pension) + (inp.penPublic ? " (government)" : " (private)")]);
        if (inp.other > 0) situation.push(["Other ordinary income", money(inp.other)]);
        situation.push(["Gross income", money(R.gross)]);
      } else if (inp.status === "m") situation.push(["Your gross income", money(inp.gross)], ["Spouse's gross income", money(inp.gross2)], ["Household gross income", money(R.gross)]);
      else situation.push(["Gross income", money(inp.gross)]);
      situation.push(["Filing status", inp.status === "m" ? "Married filing jointly" : "Single"]);
      if (ret && R.seniors > 0) situation.push(["Age 65 or older", R.seniors === 2 ? "Both spouses" : "Yes"]);
      situation.push(["State", R.stateName || "None"]);
      if (inp.pre > 0) situation.push(["Pre-tax deductions", money(inp.pre)]);
      situation.push(["Deduction", inp.dedType === "item" ? "Itemized (" + money(inp.item) + ")" : "Standard (" + money(ret ? R.fedDed : (FED_STD as Record<string, number>)[inp.status]) + ")"]);
      if (ret && R.ssGross > 0) situation.push(["Taxable Social Security", money(R.taxableSS)]);
      situation.push(["Taxable income", money(R.fedTaxable)]);
      const out: SheetRows = ret
        ? [["Federal, ordinary income", money(R.fedOrdinary)], ["Federal, long-term gains", money(R.ltcg) + (R.gainTaxable > 0 ? " (" + pctStr(R.ltcgRate, 1) + ")" : "")],
          ...(R.niit > 0 ? [["Net investment income tax", money(R.niit)] as [string, string]] : []),
          ["State tax", money(R.state)], ["Total tax", money(R.total)], ["Effective rate", pctStr(R.effTotal, 1)], ["Marginal rate", pctStr(R.marginal, 1)]]
        : [["Federal tax", money(R.federal)], ["State tax", money(R.state)],
          ...(inp.status === "m" ? [["Your Social Security", money(R.ss1)], ["Spouse's Social Security", money(R.ss2)]] as SheetRows : [["Social Security", money(R.ss)]] as SheetRows),
          ["Medicare" + (R.addl > 0 ? " (+ surtax)" : ""), money(R.med + R.addl)], ["Total tax", money(R.total)], ["Effective rate", pctStr(R.effTotal, 1)], ["Marginal rate", pctStr(R.marginal, 0)]];
      const pay: SheetRows = ret
        ? [["Income after tax, per year", money(R.net)], ["Per month", money(R.net / 12)],
          ...(R.gain > 0 ? [["Gain realized", money(R.gain)]] as SheetRows : []), ...(R.zeroRoom > 0 ? [["Room left in 0% band", money(R.zeroRoom)]] as SheetRows : [])]
        : [["Take-home, per year", money(R.net)], ["Per month", money(R.net / 12)], ["Per biweekly check", money(R.net / 26)],
          ...(inp.pre > 0 ? [["Net pay (before pre-tax)", money(R.gross - R.total)]] as SheetRows : [])];
      const chart = copyChart("#txPie");
      return (
        <SheetPage title={ret ? "Retirement Tax Summary" : "Income Tax Summary"} sub="Tax year 2026"
          big={[[ret ? "Income after tax" : "Take-home pay", money(R.net), "per year"], ["Total tax", money(R.total), pctStr(R.effTotal, 1) + " effective"],
            ["Per month", money(R.net / 12), ret ? "after tax" : "take-home"]]}
          foot="Based on published 2026 federal and state rates. Omits credits, local taxes and many special cases. Not tax advice.">
          <div className="flex gap-4 mb-2.5 items-stretch">
            {chart ? <SheetChart html={chart} className="w-36 flex-none m-0" /> : null}
            <div className="flex-1 flex gap-4">
              <SheetSection t="Your situation" rows={situation} className="flex-1" />
              <SheetSection t="Tax breakdown" rows={out} className="flex-1" />
              <SheetSection t={ret ? "What you keep" : "Paycheck"} rows={pay} className="flex-1" />
            </div>
          </div>
          <SheetTable t="Federal tax brackets" head={["Rate", "Income range", "Taxed in band", "Tax"]}
            rows={(R.bands as { rate: number; lo: number; hi: number; amount: number; tax: number }[]).map((b) => ({ className: b.amount > 0 ? undefined : "text-print-faint",
              cells: [pctStr(b.rate, 0), money(b.lo) + (b.hi === Infinity ? " and up" : " – " + money(b.hi)), money(b.amount), money(b.tax)] }))} />
        </SheetPage>
      );
    },
    card: () => {
      const R = runTax(inp);
      return { title: ret ? "My tax in retirement" : "My take-home pay", bigLabel: ret ? "Income after tax, per year" : "Take-home, per year", big: money(R.net),
        sub: money(R.gross) + (ret ? " withdrawn · " : " gross · ") + (R.stateName || "no state tax") + " · tax year 2026",
        rows: ret
          ? [["Federal, ordinary income", money(R.fedOrdinary)], ["Federal, long-term gains", money(R.ltcg)], ["Net investment income tax", money(R.niit)],
            ["State tax", money(R.state)], ["Total tax", money(R.total)], ["Effective rate", pctStr(R.effTotal, 1)], ["Per month", money(R.net / 12)]]
          : [["Federal tax", money(R.federal)], ["State tax", money(R.state)], ["Social Security + Medicare", money(R.fica)], ["Total tax", money(R.total)],
            ["Effective rate", pctStr(R.effTotal, 1)], ["Per month", money(R.net / 12)], ["Per biweekly check", money(R.net / 26)]],
        chart: { sel: "#txPie", w: 400, h: 400 } };
    },
  };
}
