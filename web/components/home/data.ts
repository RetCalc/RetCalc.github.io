/* The homepage's figures, worked out when the site is built (server only).
   Every number on the page comes from the same engine the tools run, with
   each tool's own defaults or the page's example household, so opening the
   tool shows the same thing the homepage promised. */
import { BASIC_INPUTS, basicInput } from "@/tools/basic/model";
import { DRAWDOWN_DEFAULTS, drawdownSetup } from "@/tools/drawdown/model";
import { MORTGAGE_DEFAULTS, mortgageInput } from "@/tools/mortgage/model";
import { RENTBUY_DEFAULTS, rentBuyInput } from "@/tools/rentbuy/model";
import { TAX_DEFAULTS, runTax, taxInput } from "@/tools/tax/model";
import { mortgage, projectBasic, rentBuyCalc } from "@/lib/engine/typed";
import { historicalBacktest } from "@/lib/engine/typed-drawdown";

/** The example household: 32, $60,000 saved, $1,500 a month, Balanced. */
export const EXAMPLE = { age: 32, retire: 65, saved: 60000, monthly: 1500 };

export interface HomeData {
  /** Balance at each age from 32 to 65, in today's dollars. */
  growth: number[];
  /** One line per January start since 1926 (real dollars, $1M start), and whether it ran out. */
  fan: { lines: number[][]; failed: boolean[] };
  /** Share of every monthly start since 1926 that lasted 30 years. */
  lasted: number;
  tax: { gross: number; takeHome: number; federal: number; fica: number; state: number; stateName: string };
  /** Buyer and renter net worth after 30 years, for Rent vs. Buy's blueprint (on
      this page and /tools). An illustrative case, rent $2,300 rising 4% a year
      with the rest the tool's defaults, where buying pulls ahead (in year 10):
      at the defaults renting stays ahead, and the picture is there to show a
      comparison, not a verdict. No figures show. */
  rentbuy: { buy: number; rent: number };
  /** Each year's mortgage payments: [interest, principal]. */
  mortgage: [number, number][];
}

export function homeData(): HomeData {
  const b = projectBasic(basicInput({ ...BASIC_INPUTS, age: String(EXAMPLE.age), retire: String(EXAMPLE.retire),
    saved: String(EXAMPLE.saved), contrib: String(EXAMPLE.monthly) }));
  const growth = [EXAMPLE.saved, ...b.years.map((y) => y.end)];

  // The Drawdown Simulator as it opens: $1M, 60/40, 4% raised with inflation, 30 years.
  const { o } = drawdownSetup({ ...DRAWDOWN_DEFAULTS });
  const H = historicalBacktest(o) as unknown as {
    successRate: number;
    runs: { startMonth: number; depleted: boolean; rows: { realEnd: number }[] }[];
  };
  const jan = H.runs.filter((r) => r.startMonth === 1);
  const fan = {
    lines: jan.map((r) => [o.initial as number, ...r.rows.map((x) => Math.max(0, Math.round(x.realEnd)))]),
    failed: jan.map((r) => r.depleted),
  };

  const t = runTax(taxInput({ ...TAX_DEFAULTS, gross: "140,000" }));

  const rb = rentBuyCalc(rentBuyInput({ ...RENTBUY_DEFAULTS, rent: "2300", rentInc: "4" })).years;
  const m = mortgage(mortgageInput(MORTGAGE_DEFAULTS));

  return {
    growth,
    fan,
    lasted: H.successRate,
    tax: { gross: t.gross, takeHome: t.takeHome, federal: t.federal, fica: t.fica, state: t.state, stateName: TAX_DEFAULTS.state },
    rentbuy: { buy: rb[rb.length - 1].buyerNW, rent: rb[rb.length - 1].renterNW },
    mortgage: m.years.map((y) => [y.interest, y.principal]),
  };
}
