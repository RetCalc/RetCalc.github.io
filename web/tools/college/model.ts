/* The College Savings tool's inputs, apart from its screen so the Budget can
   read the monthly amount. From src/js/app/14-college-rentbuy.js. */
import type { ToolDef } from "@/components/tools/ToolState";
import { collegePlanCalc, collegeSavingsCalc } from "@/lib/engine/typed";
import type { CollegeInput } from "@/lib/engine/types";
import { groupDigits, parseNum } from "@/lib/format";

export const CL_PRESETS: [string, string][] = [
  ["27000", "Public in-state · ~$27,000/yr"], ["59000", "Private non-profit · ~$59,000/yr"],
  ["82000", "Elite / Ivy · ~$82,000/yr"], ["0", "Custom"],
];

export interface Kid { preset: string; cost: string; years: string; collegeYrs: string }

export const COLLEGE_DEFAULTS = {
  kids: [{ preset: "27000", cost: groupDigits(27000, true), years: "18", collegeYrs: "4" }] as Kid[],
  saved: "0", ret: "6", infl: "4",
};
export type CollegeInputs = typeof COLLEGE_DEFAULTS;

export const COLLEGE_DEF: ToolDef<CollegeInputs> = { id: "college", label: "College", noun: "college plan", defaults: COLLEGE_DEFAULTS };

/** The inputs as the calculators take them. */
export function collegeInput(c: CollegeInputs): CollegeInput {
  const kids = c.kids.map((k) => ({
    yearsUntil: Math.min(25, parseNum(k.years) || 0),
    annualCost: parseNum(k.cost) || 0,
    collegeYrs: Math.max(1, Math.round(parseNum(k.collegeYrs) || 0)),
  }));
  return {
    yearsUntil: kids[0].yearsUntil, annualCost: kids[0].annualCost, collegeYrs: kids[0].collegeYrs,
    tuitionInfl: parseNum(c.infl) / 100, investRet: parseNum(c.ret) / 100, saved: parseNum(c.saved), kids,
  };
}

/** The amount to save each month now, for however many children. */
export function collegeMonthly(inp: CollegeInput): number {
  if (inp.kids.length > 1) return collegePlanCalc(inp)?.monthly ?? 0;
  return inp.annualCost > 0 && inp.yearsUntil > 0 ? collegeSavingsCalc(inp).monthly : 0;
}

export type { CollegeInput };
