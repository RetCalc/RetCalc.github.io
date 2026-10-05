/* The Portfolio Backtest's inputs, and the run they make. From
   readBTState() and renderBacktest() in src/js/app/22-backtest.js. */
import type { ToolDef } from "@/components/tools/ToolState";
import { HIST_START, HIST_YEARS, backtest } from "@/lib/engine/typed";
import type { BtResult } from "@/lib/engine/types";
import { parseNum } from "@/lib/format";

export const BT_DEFAULTS = { stock: "80", sv: "0", cash: "0", rebal: "year", rebalN: "3", rebalBand: "5", from: "1926", to: "2025" };
export type BacktestInputs = typeof BT_DEFAULTS;

export const BT_DEF: ToolDef<BacktestInputs> = { id: "backtest", label: "Portfolio Backtest", noun: "backtest", defaults: BT_DEFAULTS };

/** The years the data covers. */
export const BT_FIRST = HIST_START as number, BT_LAST = BT_FIRST + HIST_YEARS - 1;

/** A year field held to the data once you leave it; blank means the end it names. */
export function yearClamp(raw: string, blank: number): string {
  const v = Math.round(parseNum(raw));
  return String(!v ? blank : Math.max(BT_FIRST, Math.min(BT_LAST, v)));
}

/** The first year of an era button: all of it, or the last 50 or 30 years. */
export const eraFrom = (era: string) => (era === "all" ? BT_FIRST : BT_LAST - parseInt(era, 10) + 1);

export function runBacktest(s: BacktestInputs): BtResult {
  const from = Math.max(BT_FIRST, Math.min(BT_LAST, Math.round(parseNum(s.from) || BT_FIRST)));
  const to = Math.max(from, Math.min(BT_LAST, Math.round(parseNum(s.to) || BT_LAST)));
  return backtest({
    stockPct: parseNum(s.stock), svPct: parseNum(s.sv), cashPct: parseNum(s.cash), rebal: s.rebal,
    rebalN: parseNum(s.rebalN), rebalBand: parseNum(s.rebalBand), fee: 0, initial: 10000, startYear: from, endYear: to,
  });
}

/** The ten-year average under each year's inflation, from the tenth year on:
    single years are noise, sustained stretches are what reprice a plan. */
export function decadeInflation(B: BtResult) {
  const out: { year: number; value: number }[] = [];
  for (let i = 9; i < B.rows.length; i++) {
    let g = 1;
    for (let k = i - 9; k <= i; k++) g *= 1 + B.rows[k].infl;
    out.push({ year: i + 1, value: Math.pow(g, 1 / 10) - 1 });
  }
  return out;
}
