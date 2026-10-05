/* The Mortgage Calculator's inputs, apart from its screen so Rent vs. Buy
   can copy the home from it. From src/js/app/12-mortgage.js. */
import type { ToolDef } from "@/components/tools/ToolState";
import { MORT_RATE_30 } from "@/lib/engine/typed";
import type { MortgageInput } from "@/lib/engine/types";
import { groupDigits, parseNum } from "@/lib/format";

export const MORTGAGE_DEFAULTS = {
  price: groupDigits(450000, true), downPct: "20", downAmt: groupDigits(90000, true),
  rate: String(MORT_RATE_30), term: "30", tax: "1.1", ins: groupDigits(1800, true), pmi: "0",
  hoa: "0", maint: "1", util: "300", extrasOn: "0", extraMo: "0", extraOnce: "0",
  extraWhen: "12", recast: "0", refiRate: "0", refiTerm: "30", refiCost: "0",
};
export type Inputs = typeof MORTGAGE_DEFAULTS;

export const MORTGAGE_DEF: ToolDef<Inputs> = { id: "mortgage", label: "Mortgage", noun: "mortgage scenario", defaults: MORTGAGE_DEFAULTS };

/** The inputs as the engine takes them. */
export function mortgageInput(s: Inputs): MortgageInput {
  const extras = s.extrasOn === "1";
  const pct = (v: string) => parseNum(v) / 100;
  return {
    price: parseNum(s.price), down: parseNum(s.downAmt), rate: pct(s.rate), term: parseFloat(s.term),
    taxPct: pct(s.tax), ins: parseNum(s.ins), pmiPct: pct(s.pmi), hoa: parseNum(s.hoa),
    maintPct: pct(s.maint), util: parseNum(s.util),
    // Zero whenever the panel is collapsed, so turning it off is the same as
    // never having touched it, not just hiding the fields.
    extraMonthly: extras ? parseNum(s.extraMo) : 0,
    extraOnce: extras ? parseNum(s.extraOnce) : 0,
    extraOnceMonth: extras ? parseNum(s.extraWhen) : 0,
    recast: extras && s.recast === "1",
    refiOn: extras && pct(s.refiRate) > 0,
    refiRate: pct(s.refiRate), refiTerm: parseFloat(s.refiTerm), refiCost: parseNum(s.refiCost),
  };
}
