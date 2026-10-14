/* The tool list's chart figures, worked out when the site is built (server
   only): the homepage's own (components/home/data.ts), so a chart reads the
   same on both pages, and the Portfolio Backtest as it opens. */
import { homeData, type HomeData } from "@/components/home/data";
import { BT_DEFAULTS, runBacktest } from "@/tools/backtest/model";

export interface PickerData {
  fan: HomeData["fan"];
  lasted: number;
  tax: HomeData["tax"];
  rentbuy: HomeData["rentbuy"];
  mortgage: HomeData["mortgage"];
  /** $10,000 in the Backtest's default mix: the start, then each year's end, after inflation. */
  backtest: { first: number; last: number; mix: string; values: number[] };
}

export function pickerData(): PickerData {
  const h = homeData();
  const B = runBacktest(BT_DEFAULTS);
  const mix = [[B.stockPct, "stocks"], [B.svPct, "small value"], [B.bondPct, "bonds"], [B.cashPct, "cash"]]
    .filter(([p]) => (p as number) > 0).map(([p, n]) => `${Math.round(p as number)}% ${n}`).join(", ");
  return {
    fan: h.fan, lasted: h.lasted, tax: h.tax, rentbuy: h.rentbuy, mortgage: h.mortgage,
    backtest: { first: B.first, last: B.last, mix, values: [B.start, ...B.rows.map((r) => Math.round(r.endReal))] },
  };
}
