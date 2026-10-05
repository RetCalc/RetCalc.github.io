/* The Mortgage Calculator's inputs, apart from its screen so Rent vs. Buy
   can copy the home from it. From src/js/app/12-mortgage.js. */
import type { ToolDef } from "@/components/tools/ToolState";
import { MORT_RATE_30 } from "@/lib/engine/typed";
import { groupDigits } from "@/lib/format";

export const MORTGAGE_DEFAULTS = {
  price: groupDigits(450000, true), downPct: "20", downAmt: groupDigits(90000, true),
  rate: String(MORT_RATE_30), term: "30", tax: "1.1", ins: groupDigits(1800, true), pmi: "0",
  hoa: "0", maint: "1", util: "300", extrasOn: "0", extraMo: "0", extraOnce: "0",
  extraWhen: "12", recast: "0", refiRate: "0", refiTerm: "30", refiCost: "0",
};
export type Inputs = typeof MORTGAGE_DEFAULTS;

export const MORTGAGE_DEF: ToolDef<Inputs> = { id: "mortgage", label: "Mortgage", noun: "mortgage scenario", defaults: MORTGAGE_DEFAULTS };
