"use client";

/* The Drawdown Simulator's printed summary and image card. From
   buildDrawdownSheet() in src/js/app/10-summary-sheets.js, ddPlanRows() in
   15c-drawdown-strategies.js and the drawdown card in 25-share-card.js. */

import { SheetPage, SheetSection, SheetTable, type SheetRows } from "@/components/shell/Sheet";
import { copyChart, type ShareKit } from "@/components/shell/share";
import { DD_STRAT, HIST_START, HIST_STOCK, ddPrep, historicalBacktest, type DdOpts } from "@/lib/engine/typed-drawdown";
import { DASH, fmtNum, money, pctStr } from "@/lib/format";
import { DD_STRAT_NAMES, ageVal, ddN, describeItem, firstSpend, lineWords, mixText, rebalText, startLabel, wdOrder } from "./text";

/** The plan in rows: the strategy and its settings, the path, guaranteed
    income, spending limits and the history tested. */
function planRows(o: DdOpts): SheetRows {
  const P = ddPrep(o), first = firstSpend(o, P), out: SheetRows = [], p = (v: number, d = 2) => pctStr(v / 100, d);
  out.push(["Withdrawal strategy", DD_STRAT_NAMES[o.strategy] || o.strategy]);
  out.push(["Year one's spending", money(first) + (P.initial > 0 ? " (" + pctStr(first / P.initial, 2) + ")" : "")]);
  switch (o.strategy) {
    case "fixed": if (o.skipRaise) out.push(["After a losing year", "No raise for inflation"]); break;
    case "kitces":
      out.push(["Ratchet", ddN(o.kitRaise) + "% raise when " + ddN(o.kitThresh) + "% up, at most every " + ddN(o.kitGap) + " years"]);
      if (o.skipRaise) out.push(["After a losing year", "No raise for inflation"]);
      break;
    case "clyatt": out.push(["Never below", ddN(o.clyFloor) + "% of last year's"]); break;
    case "vpw": out.push(["Expected return, real", p(o.vpwRate || 0)], ["PMT future value", money(o.vpwFV || 0)]); break;
    case "guardrails":
      out.push(["Upper guardrail", ddN(o.guardBand) + "% above, cut " + ddN(o.adjustPct) + "%"], ["Lower guardrail", ddN(o.guardBandLo) + "% below, raise " + ddN(o.raisePct) + "%"]);
      if (o.gkFinalYears > 0) out.push(["No cuts in the final", ddN(o.gkFinalYears) + " years"]);
      if (o.skipRaise) out.push(["After a losing year", "No raise, when above the start rate"]);
      break;
    case "riskgr": out.push(["Chance of lasting", ddN(o.rgTarget) + "% target, reset below " + ddN(o.rgLo) + "% or above " + ddN(o.rgHi) + "%"]); break;
    case "floorceil": out.push(["Each year's change", "at most " + ddN(o.floorPct) + "% down, " + ddN(o.ceilPct) + "% up"]); break;
    case "vanguard": out.push(["Each year's change", "at most " + ddN(o.vgFloor) + "% down, " + ddN(o.vgCeil) + "% up"]); break;
    case "yale": out.push(["Weight on last year", ddN(o.yaleWeight) + "%"], ["Target spending rate", p(o.yaleRate)]); break;
    case "hebeler": out.push(["Last year / payment", ddN(o.hebWeight) + "% / " + ddN(100 - o.hebWeight) + "%, at " + p(o.hebRate) + " real"]); break;
    case "sensible": out.push(["Plus, of real gains", ddN(o.sensExtra) + "%"]); break;
    case "cape": out.push(["Rate each year", p(o.capeA) + " + " + ddN(o.capeB) + " × 1/CAPE"]); break;
  }
  if (o.path === "ease") out.push(["Spending path", "Easing " + ddN(o.pathEase) + "% a year"]);
  else if (o.path === "smile") out.push(["Spending path", "The retirement spending smile"]);
  else if (o.path === "stages") wdOrder(o.pathStages || []).forEach((w) => out.push([w.st.name || "Stage " + (w.i + 2),
    ddN(w.st.level == null ? 100 : w.st.level) + "% of year one from " + (o.retireAge != null ? "age " + ddN(o.retireAge + w.start - 1) : "year " + w.start)]));
  if (P.G.share > 0) out.push(["Guaranteed income", money(P.G.income) + "/yr from " + ddN(o.gShare) + "%, " +
    (o.gType === "annuity" ? "an annuity" + (o.gInflate ? " with raises" : "") : "a TIPS ladder at " + p(o.gYield) + " real")]);
  const limits = DD_STRAT[o.strategy]?.limits !== false;
  if (limits && P.floor.some((v) => v > 0)) out.push(["Minimum spending", lineWords(P.floor, o.retireAge, "/yr")]);
  if (o.spendCeil > 0 && limits) out.push(["Maximum spending", money(o.spendCeil) + "/yr"]);
  if (o.monthly || o.fromYear > HIST_START) out.push(["History tested", (o.monthly ? "A start every month" : "A start each January") + " from " + o.fromYear]);
  return out;
}

/** `sel`: the start the page is showing, by its index. */
export function drawdownShare(o: DdOpts, sel: number | null): ShareKit {
  const age = o.retireAge;
  return {
    sheet: () => {
      if (!(o.initial > 0)) return "Enter a portfolio value first";
      const H = historicalBacktest(o);
      const show = H.runs.find((r) => r.startIdx === sel) || H.firstFail || H.runs[0];
      if (!show) return "";
      const label = startLabel(show, H.monthly);
      const inputs: SheetRows = [["Starting portfolio", money(o.initial)], ["Years in retirement", fmtNum(o.years)], ["Asset mix", mixText(o)]];
      if (o.rebal !== "year") inputs.push(["Rebalancing", rebalText(o)]);
      inputs.push(...planRows(o));
      if (o.ssAnnual > 0 || o.ssAnnual2 > 0) inputs.push(["Social Security", money(o.ssAnnualTotal) + "/yr"]);
      (o.incomeItems || []).filter((it) => it.on !== false).forEach((it) => inputs.push([it.name, describeItem(it, age)]));
      (o.expenseItems || []).filter((it) => it.on !== false).forEach((it) => inputs.push([it.name + " (expense)", describeItem(it, age)]));
      // Spending through the start shown: what a single ending balance can't tell you.
      const real = show.rows.map((r) => (r.realSpend != null ? r.realSpend : r.realWithdrawal)), sorted = real.slice().sort((a, b) => a - b);
      let cuts = 0, maxCut = 0;
      for (let i = 1; i < real.length; i++) { const d = real[i] - real[i - 1]; if (d < -0.5) { cuts++; maxCut = Math.max(maxCut, -d); } }
      const spend: SheetRows = [["Highest year's spending", money(sorted[sorted.length - 1])], ["Lowest year's spending", money(sorted[0])], ["Years spending was cut", cuts + " of " + real.length]];
      if (maxCut > 0) spend.push(["Biggest single-year cut", "−" + money(maxCut)]);
      spend.push(["Total spent, example period", money(real.reduce((a, v) => a + v, 0))]);
      const verdict = H.successRate >= 0.99 ? "Survived every historical period, including the Depression, 1970s stagflation, and 2008."
        : H.successRate >= 0.9 ? "Survived most historical periods. Failed only when retirement began in " + H.failYears.slice(0, 8).join(", ") + (H.failYears.length > 8 ? ", and others" : "") + "."
          : "Ran out of money in " + H.failYears.length + " of " + H.total + " historical periods. Consider a lower withdrawal rate or a strategy that adjusts spending.";
      // Every year for a plan under 20 years, every other beyond, every third beyond 40.
      const step = show.rows.length <= 20 ? 1 : show.rows.length <= 40 ? 2 : 3;
      const rows = show.rows.filter((r, i) => i === 0 || i === show.rows.length - 1 || i % step === 0);
      const other = (o.incomeItems || []).some((it) => it.on !== false);
      return (
        <SheetPage title="Will My Money Last?" sub={<>{fmtNum(o.years)} year retirement &middot; tested since {H.first}</>}
          big={[["Success rate", pctStr(H.successRate, 0), H.survived + " of " + H.total + " periods"], ["Median ending balance", money(H.medianEnd), "today's dollars"],
            ["Worst case", money(H.worstEnd), "today's dollars"]]}
          chart={copyChart("#chartDD")}
          foot={verdict + " Tested against real US market history (" + H.first + "–" + (HIST_START + HIST_STOCK.length - 1) + "). Surviving every period is evidence a plan is reasonable, not a guarantee. Not financial advice."}>
          <div className="sh-cols">
            <SheetSection t="Plan" rows={inputs} />
            <SheetSection t="Results" rows={[["Success rate", pctStr(H.successRate, 1)], ["Tested against", H.total + " periods since " + H.first], ["Survived", H.survived + " of " + H.total],
              ["Median ending balance", money(H.medianEnd)], ["Worst case", money(H.worstEnd)], ["Best case", money(H.bestEnd)]]} />
            <SheetSection t={"Spending, retiring " + label} rows={spend} />
          </div>
          <SheetTable t={<>Year by year &middot; retiring in {label}{show.depleted ? " (ran out " + (age != null ? "at age " + ageVal(age, show.depletedYear!) : "in year " + show.depletedYear) + ")" : " (survived)"}</>}
            head={[age != null ? "Age" : "Year", "Withdrawal", "Soc. Sec.", ...(other ? ["Other Income"] : []), "Return", "End balance"]}
            rows={rows.map((r) => [ageVal(age, r.year), money(r.withdrawal), r.ss > 0 ? money(r.ss) : DASH, ...(other ? [r.customIncome > 0 ? money(r.customIncome) : DASH] : []),
              r.ret.toFixed(1) + "%", money(r.realEnd)])} />
        </SheetPage>
      );
    },
    card: () => {
      const H = historicalBacktest(o), first = firstSpend(o);
      const inc = (o.incomeItems || []).filter((it) => it.on !== false), exp = (o.expenseItems || []).filter((it) => it.on !== false);
      const rows: SheetRows = [["Withdrawal strategy", DD_STRAT_NAMES[o.strategy] || "Floor & ceiling"], ["Year one's withdrawal", money(first) + " (" + pctStr(first / Math.max(1, o.initial), 1) + ")"],
        ["Starting portfolio", money(o.initial)], ["Tested against", H.total + " real retirements"], ["Survived", H.survived + " of " + H.total + " periods"],
        ["Median ending balance", money(H.medianEnd)], ["Worst case", money(H.worstEnd)]];
      if (inc.length) rows.push(["Other income", inc.length === 1 ? inc[0].name : inc.length + " sources"]);
      if (exp.length) rows.push(["Future expenses", exp.length === 1 ? exp[0].name : exp.length + " planned"]);
      return { title: "Will my money last?", bigLabel: "Success rate, tested since " + HIST_START, big: pctStr(H.successRate, 0),
        sub: fmtNum(o.years) + " year retirement · " + mixText(o), rows,
        verdict: H.successRate >= 0.99 ? "Survived every historical period on record." : H.successRate >= 0.9 ? "Survived the large majority of historical periods." : "Failed in a meaningful share of historical periods.",
        chart: { sel: "#chartDD", w: 900, h: 300 } };
    },
  };
}
