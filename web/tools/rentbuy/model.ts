/* Rent vs. Buy's inputs, and the parsing that turns them into what
   rentBuyCalc() takes. From src/js/app/14-college-rentbuy.js. */
import type { ToolDef } from "@/components/tools/ToolState";
import { MORT_RATE_30 } from "@/lib/engine/typed";
import { groupDigits, parseNum } from "@/lib/format";

export const RENTBUY_DEFAULTS = {
  price: groupDigits(450000, true), down: "20", rate: String(MORT_RATE_30), term: "30", propTax: "1.1",
  ins: groupDigits(1800, true), maint: "1", close: "3", sell: "3", rent: groupDigits(1800, true), rentInc: "3.2",
  appr: "4", invest: "7", horizon: "30", gainTax: "15", status: "m",
};
export type RentBuyInputs = typeof RENTBUY_DEFAULTS;
export const RENTBUY_DEF: ToolDef<RentBuyInputs> = { id: "rentbuy", label: "Rent vs. Buy", noun: "rent vs. buy scenario", defaults: RENTBUY_DEFAULTS };

/** The inputs as the engine takes them: the horizon held to 1-40 years and
    the gains tax to 0-50%. */
export function rentBuyInput(s: RentBuyInputs) {
  const n = (k: keyof RentBuyInputs) => parseNum(s[k]);
  return {
    price: n("price"), downPct: n("down"), rate: n("rate"), term: parseFloat(s.term), propTax: n("propTax"),
    ins: n("ins"), maint: n("maint"), closePct: n("close"), sellPct: n("sell"), rent: n("rent"), rentInc: n("rentInc"),
    appr: n("appr"), invest: n("invest"),
    horizon: Math.min(40, Math.max(1, Math.round(n("horizon")))),
    gainTax: Math.min(50, Math.max(0, n("gainTax") || 0)),
    status: s.status === "s" ? "s" : "m",
  };
}
