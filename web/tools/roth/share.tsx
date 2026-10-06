"use client";

/* The Roth Conversion tool's printed summary. From buildRothSheet() in
   src/js/app/17-roth.js. */

import { SheetPage, SheetSection, SheetTable, sampled, type SheetRows } from "@/components/shell/Sheet";
import { copyChart, type ShareKit } from "@/components/shell/share";
import { STATES, runRoth } from "@/lib/engine/typed";
import { DASH, fmtNum, money, pctStr } from "@/lib/format";
import { STRATEGIES, rothInput, type RothInputs } from "./model";

export function rothShare(s: RothInputs): ShareKit {
  return {
    sheet: () => {
      const inp = rothInput(s);
      if (!(inp.trad > 0)) return "Enter a traditional balance first";
      const plan = runRoth(inp, true), base = runRoth(inp, false);
      const taxSaved = base.lifeTaxPV - plan.lifeTaxPV, nwDelta = plan.endAfterTax - base.endAfterTax;
      const st = (STATES as Record<string, { n?: string }>)[inp.state];
      const strat: SheetRows = [["Strategy", STRATEGIES[inp.strategy]]];
      if (inp.strategy === "brk") strat.push(["Fill to", pctStr(inp.bracket, 0) + " bracket"]);
      if (inp.strategy === "irm") strat.push(["Stay within", "IRMAA tier " + inp.irmaaTarget]);
      if (inp.strategy !== "none") strat.push(["Window", "Ages " + fmtNum(inp.startAge) + "–" + fmtNum(inp.stopAge)],
        ["Tax paid from", inp.payFrom === "withhold" ? "Withheld from the conversion" : "Taxable account"]);
      strat.push(["Heir rate on traditional", pctStr(inp.heirRate, 0)], ["Discount rate", pctStr(inp.disc, 1) + " real"]);
      const out: SheetRows = [["Lifetime tax, converting", money(plan.lifeTax)], ["Lifetime tax, no conversions", money(base.lifeTax)],
        ["Present value saved", money(taxSaved)], ["Total converted", money(plan.totalConv)]];
      if (inp.irmaaOn) out.push(["Lifetime IRMAA", money(plan.lifeIrmaa) + " vs " + money(base.lifeIrmaa)]);
      out.push(["Traditional at " + fmtNum(inp.endAge), money(plan.endTrad) + " vs " + money(base.endTrad)], ["Peak RMD", money(base.peakRMD) + " → " + money(plan.peakRMD)]);
      return (
        <SheetPage title="Roth Conversion & RMDs" sub={<>Ages {fmtNum(inp.age)}–{fmtNum(inp.endAge)} &middot; today&apos;s dollars</>}
          big={[["Lifetime tax saved", money(taxSaved), "present value"], ["After-tax net worth", (nwDelta >= 0 ? "+" : "−") + money(Math.abs(nwDelta)), "at age " + fmtNum(inp.endAge)],
            ["Total converted", money(plan.totalConv), "over " + fmtNum(plan.rows.filter((x) => x.conv > 0).length) + " years"]]}
          chart={copyChart("#chartRC")}
          foot="Estimates only. Brackets, the standard deduction and the IRMAA thresholds are held fixed in real terms, and every figure is in today's dollars. Not tax advice.">
          <div className="sh-cols">
            <SheetSection t="Your situation" rows={[["Age", fmtNum(inp.age) + (inp.status === "m" ? " · spouse " + fmtNum(inp.spouseAge) : "")],
              ["Filing status", inp.status === "m" ? "Married filing jointly" : "Single"], ["State", st?.n ? st.n : inp.state],
              ["Traditional", money(inp.trad)], ["Roth", money(inp.roth)], ["Brokerage", money(inp.brokerage) + " at " + pctStr(inp.basisPct, 0) + " basis"],
              ["Real return", pctStr(inp.ret, 2)], ["Annual spending", money(inp.spend)], ["RMDs begin", "Age " + plan.rmdStart]]} />
            <SheetSection t="The plan" rows={strat} />
            <SheetSection t="Converting vs. not" rows={out} />
          </div>
          <SheetTable t="Year by year, converting" head={["Age", "Converted", "RMD", "MAGI", "Tax", "Marginal", "Traditional", "Roth"]}
            rows={sampled(plan.rows, (y) => y.conv > 0).map((y) => [y.age, y.conv > 0 ? money(y.conv) : DASH, y.rmd > 0 ? money(y.rmd) : DASH, money(y.magi),
              money(y.tax), pctStr(y.marginal, 1), money(y.trad), money(y.roth)])} />
        </SheetPage>
      );
    },
  };
}
