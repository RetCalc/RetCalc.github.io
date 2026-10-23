/* What saving ahead for college takes a month, kept apart from calc.ts so
   the plan (model.ts) can read it without importing the calculators. */

import { COLLEGE_DEFAULTS, collegeInput, collegeMonthly } from "@/tools/college/model";
import { groupDigits } from "@/lib/format";
import { ageOf } from "./model";
import type { Profile } from "./store";

/** Each child's years until college (18), the ones you have and the ones
    planned; negative once it's begun. */
export function collegeYears(pr: Profile): number[] {
  const now = pr.kidList.slice(0, pr.kids).filter((k) => k.by).map((k) => 18 - (ageOf(k) ?? 0));
  const planned = Array.from({ length: pr.planned.count }, (_, i) => 18 + pr.planned.firstIn + i * pr.planned.spacing);
  return [...now, ...planned];
}

/** A month of saving ahead for college, on College Savings' own math with
    the profile's children, school and share (0 when not helping). */
export function collegeNeedOf(pr: Profile): number {
  if (pr.college.help === "none") return 0;
  const starts = collegeYears(pr).filter((y) => y > 0);
  if (!starts.length) return 0;
  const cost = pr.college.cost, preset = ["27000", "59000", "82000"].includes(String(cost)) ? String(cost) : "0";
  const c = { ...COLLEGE_DEFAULTS, kids: starts.map((y) => ({ preset, cost: groupDigits(cost, true), years: String(Math.min(25, y)), collegeYrs: "4" })) };
  return collegeMonthly(collegeInput(c)) * (pr.college.help === "all" ? 1 : 0.5);
}
