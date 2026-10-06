/* The Mortgage Calculator's inputs, apart from its screen so Rent vs. Buy
   can copy the home from it. From src/js/app/12-mortgage.js. */
import type { ToolDef } from "@/components/tools/ToolState";
import { MORT_RATE_30, mortgage, refiCompare } from "@/lib/engine/typed";
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

/** The loan, and with extra payments the same loan without them (how much
    sooner it's paid off and the interest saved), and with a refinance rate
    the comparison. base is null without extras, RF without a refinance. */
export function mortgageCompute(s: Inputs) {
  const m = mortgageInput(s);
  const R = mortgage(m);
  const base = R.extraActive ? mortgage({ ...m, extraMonthly: 0, extraOnce: 0, extraOnceMonth: 0, recast: false }) : null;
  const sooner = base ? base.payoffMonth - R.payoffMonth : 0;
  const interestSaved = base ? Math.max(0, base.totalInterest - R.totalInterest) : 0;
  const RF = m.refiOn ? (refiCompare(m, { rate: m.refiRate, term: m.refiTerm, cost: m.refiCost })) : null;
  return { m, R, base, sooner, interestSaved, RF };
}

/** A month as "year 3, month 4". */
export function when(months: number): string {
  const y = Math.floor(months / 12), m = months % 12;
  if (!y) return m + (m === 1 ? " month" : " months") + " in";
  if (!m) return "year " + y;
  return "year " + y + ", month " + m;
}
/** A span as "3y 4m". */
export function dur(months: number): string {
  const y = Math.floor(months / 12), m = months % 12;
  if (!y) return m + (m === 1 ? " month" : " months");
  if (!m) return y + (y === 1 ? " year" : " years");
  return y + "y " + m + "m";
}
