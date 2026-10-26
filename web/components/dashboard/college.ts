/* What saving ahead for college takes a month, kept apart from calc.ts so
   the plan (model.ts) can read it without importing the calculators. */

import { COLLEGE_DEFAULTS, collegeInput, collegeMonthly, type CollegeInputs } from "@/tools/college/model";
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

/** College Savings' inputs for the profile's plan: each child still to
    start, and the share of a year's cost the profile says you'll pay (all,
    or half for part). Null when not helping or no child is still to start.
    The Dashboard opens the tool with these, so it shows the same figure. */
export function collegeInputsOf(pr: Profile): CollegeInputs | null {
  if (pr.college.help === "none") return null;
  const starts = collegeYears(pr).filter((y) => y > 0);
  if (!starts.length) return null;
  const cost = pr.college.cost * (pr.college.help === "all" ? 1 : 0.5);
  const preset = ["27000", "59000", "82000"].includes(String(cost)) ? String(cost) : "0";
  return { ...COLLEGE_DEFAULTS, kids: starts.map((y) => ({ preset, cost: groupDigits(cost, true), years: String(Math.min(25, y)), collegeYrs: "4" })) };
}

/** A month of saving ahead for college, on College Savings' own math with
    the profile's children, school and share (0 when not helping). */
export function collegeNeedOf(pr: Profile): number {
  const c = collegeInputsOf(pr);
  return c ? collegeMonthly(collegeInput(c)) : 0;
}
