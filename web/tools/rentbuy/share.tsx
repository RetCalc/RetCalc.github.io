"use client";

/* Rent vs. Buy's printed summary and image card. From buildRentBuySheet()
   in src/js/app/10-summary-sheets.js and the rent vs. buy card in
   25-share-card.js. */

import { SheetPage, SheetSection, SheetTable, sampled } from "@/components/shell/Sheet";
import { copyChart, type ShareKit } from "@/components/shell/share";
import { rentBuyCalc } from "@/lib/engine/typed";
import { fmtNum, money, pctStr } from "@/lib/format";

export interface RentBuyInput {
  price: number; downPct: number; rate: number; term: number; rent: number; rentInc: number; appr: number; invest: number; horizon: number;
  [k: string]: number | string;
}

export function rentBuyShare(inp: RentBuyInput): ShareKit {
  const run = () => {
    const R = rentBuyCalc(inp), last = R.years[R.years.length - 1];
    return { R, last, buyWins: !!last && last.buyerNW >= last.renterNW };
  };
  return {
    sheet: () => {
      if (!(inp.price > 0)) return "Enter a home price first";
      const { R, last, buyWins } = run();
      if (!last) return "";
      const diff = Math.abs(last.buyerNW - last.renterNW);
      return (
        <SheetPage title="Rent vs. Buy" sub={"After " + fmtNum(inp.horizon) + " years"}
          big={[["Better choice", buyWins ? "Buying" : "Renting", "by " + money(diff)], ["Buyer net worth", money(last.buyerNW), "after " + fmtNum(inp.horizon) + " years"],
            ["Renter net worth", money(last.renterNW), "after " + fmtNum(inp.horizon) + " years"]]}
          chart={copyChart("#chartRB")}
          foot="Property tax, insurance and maintenance grow with home value; PMI is included above 80% loan-to-value. Excludes the mortgage interest deduction and non-financial factors like stability. Projections, not predictions.">
          <div className="sh-cols">
            <SheetSection t="Assumptions" rows={[["Home price", money(inp.price)], ["Down payment", pctStr(inp.downPct / 100, 0)], ["Interest rate", pctStr(inp.rate / 100, 2)],
              ["Loan term", fmtNum(inp.term) + " years"], ["Monthly rent (start)", money(inp.rent)], ["Rent increase", pctStr(inp.rentInc / 100, 1) + "/yr"],
              ["Home appreciation", pctStr(inp.appr / 100, 1) + "/yr"], ["Investment return", pctStr(inp.invest / 100, 1) + "/yr"], ["Time horizon", fmtNum(inp.horizon) + " years"]]} />
            <SheetSection t="Results" rows={[["Buyer net worth", money(last.buyerNW)], ["Renter net worth", money(last.renterNW)],
              ["Difference", (buyWins ? "+" : "−") + money(diff)], ["Break-even point", R.breakEven ? "Year " + fmtNum(R.breakEven) : "Not within horizon"],
              ["Renter invests upfront", money(R.initialInvest)], ["Monthly cost, buying", money(R.monthlyBuy)], ["Monthly cost, renting", money(inp.rent) + " (starting)"],
              ["Home value at end", money(last.homeVal)], ["Mortgage balance at end", money(last.balance)]]} />
          </div>
          {/* Sampled, always keeping the break-even year. */}
          <SheetTable t={<>Net worth by year{R.breakEven ? <> &middot; ★ marks the break-even year</> : null}</>} head={["Year", "Buyer NW", "Renter NW", "Home value", "Balance"]}
            rows={sampled(R.years, (y) => y.year === R.breakEven).map((y) => {
              const be = y.year === R.breakEven;
              return { className: be ? "font-bold bg-print-highlight" : undefined,
                cells: [y.year + (be ? " ★" : ""), money(y.buyerNW), money(y.renterNW), money(y.homeVal), money(y.balance)] };
            })} />
        </SheetPage>
      );
    },
    card: () => {
      const { R, last, buyWins } = run();
      return { title: "Rent vs. buy", bigLabel: "Better choice after " + fmtNum(inp.horizon) + " years", big: buyWins ? "Buying" : "Renting",
        sub: money(inp.price) + " home · " + money(inp.rent) + "/mo rent · " + pctStr(inp.downPct / 100, 0) + " down",
        rows: last ? [["Buyer net worth", money(last.buyerNW)], ["Renter net worth", money(last.renterNW)], ["Difference", (buyWins ? "+" : "−") + money(Math.abs(last.buyerNW - last.renterNW))],
          ["Break-even point", R.breakEven ? "Year " + fmtNum(R.breakEven) : "Not within horizon"], ["Renter invests upfront", money(R.initialInvest)],
          ["Home value at end", money(last.homeVal)], ["Monthly cost, buying", money(R.monthlyBuy)]] : [],
        chart: { sel: "#chartRB", w: 900, h: 300 } };
    },
  };
}
