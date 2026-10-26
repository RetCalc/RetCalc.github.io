/* College: each child's years until it starts, what saving ahead for it
   takes a month, and College Savings' inputs for the plan, kept apart from
   calc.ts so the plan (model.ts) can read it without importing the
   calculators. Profile gives the quick version (a kind of school, and how
   much of it you'll pay); "Apply to my plan" in College Savings keeps the
   tool's own figures instead (Profile.college.plan): each child's cost,
   start and years, what's saved, its return and tuition's inflation. */

import { COLLEGE_DEFAULTS, collegeInput, collegeMonthly, type CollegeInputs } from "@/tools/college/model";
import { groupDigits, parseNum } from "@/lib/format";
import { ageOf } from "./model";
import type { CollegeKid, CollegePlan, Profile } from "./store";

/** Every child college is planned for, in order: the ones you have (with a
    birth year), then the ones planned. `bornIn` is years until a planned
    one's birth (0 for one already born); `age` is a child's age today. */
export function collegeChildren(pr: Profile): { name: string; age: number; bornIn: number; planned: boolean; by?: number }[] {
  const now = pr.kidList.slice(0, pr.kids).filter((k) => k.by).map((k, i) => ({ name: k.name.trim() || "Child " + (i + 1), age: ageOf(k) ?? 0, bornIn: 0, planned: false, by: k.by! }));
  const planned = Array.from({ length: pr.planned.count }, (_, i) => ({ name: "Planned child" + (pr.planned.count > 1 ? " " + (i + 1) : ""), age: 0, bornIn: pr.planned.firstIn + i * pr.planned.spacing, planned: true }));
  return [...now, ...planned];
}

/** Each child's own college: its age at the start (18 unless applied),
    years of it (4) and what you'll pay a year (the school's cost, all of
    it or half). */
export function collegeKid(pr: Profile, i: number): CollegeKid {
  const own = pr.college.plan?.kids[i];
  return own ?? { start: 18, years: 4, cost: pr.college.cost * (pr.college.help === "all" ? 1 : 0.5) };
}

/** Each child's years until college; negative once it's begun. */
export function collegeYears(pr: Profile): number[] {
  return collegeChildren(pr).map((c, i) => c.bornIn + collegeKid(pr, i).start - c.age);
}

/** College Savings' inputs for the plan: each child still to start, with
    what you'll pay a year, and what's saved, its return and tuition's
    inflation. Null when not helping or no child is still to start. The
    Dashboard opens the tool with these, so it shows the plan's figure. */
export function collegeInputsOf(pr: Profile): CollegeInputs | null {
  if (pr.college.help === "none") return null;
  const P = pr.college.plan, ys = collegeYears(pr);
  const kids = ys.flatMap((y, i) => {
    if (y <= 0) return [];
    const k = collegeKid(pr, i), preset = ["26000", "61000", "82000"].includes(String(k.cost)) ? String(k.cost) : "0";
    return [{ preset, cost: groupDigits(k.cost, true), years: String(Math.min(25, y)), collegeYrs: String(k.years) }];
  });
  if (!kids.length) return null;
  return { ...COLLEGE_DEFAULTS, kids, ...(P ? { saved: groupDigits(P.saved, true), ret: String(P.ret), infl: String(P.infl) } : {}) };
}

/** Which of collegeChildren the tool's children are: the ones still to start. */
export function toolChildren(pr: Profile): number[] {
  return collegeYears(pr).flatMap((y, i) => (y > 0 ? [i] : []));
}

/** The plan with College Savings' figures applied: each of its children
    to the profile's child it stands for (by order, the ones still to
    start), and the rest as they were. Null when the tool's children don't
    match the profile's (added or removed there). */
export function applyCollege(pr: Profile, c: CollegeInputs): Profile | null {
  const idx = toolChildren(pr), all = collegeChildren(pr);
  if (c.kids.length !== idx.length) return null;
  const kids: CollegeKid[] = all.map((_, i) => collegeKid(pr, i));
  c.kids.forEach((k, j) => {
    const i = idx[j], ch = all[i];
    kids[i] = { start: Math.max(0, ch.age - ch.bornIn + parseNum(k.years)), years: Math.max(1, Math.round(parseNum(k.collegeYrs))), cost: Math.max(0, Math.round(parseNum(k.cost))) };
  });
  const plan: CollegePlan = { kids, saved: Math.max(0, Math.round(parseNum(c.saved))), ret: parseNum(c.ret), infl: parseNum(c.infl) };
  // The costs are what you'll pay, so it's all of them from here.
  return { ...pr, college: { ...pr.college, help: "all", plan } };
}

/** Whether College Savings' figures are the plan's already. */
export function sameCollege(pr: Profile, c: CollegeInputs): boolean {
  const mine = collegeInputsOf(pr), n = (v: string) => Math.round(parseNum(v) * 100);
  if (!mine || mine.kids.length !== c.kids.length) return false;
  return n(mine.saved) === n(c.saved) && n(mine.ret) === n(c.ret) && n(mine.infl) === n(c.infl)
    && mine.kids.every((k, i) => n(k.cost) === n(c.kids[i].cost) && n(k.years) === n(c.kids[i].years) && n(k.collegeYrs) === n(c.kids[i].collegeYrs));
}

/** A month of saving ahead for college, on College Savings' own math with
    the plan's children, costs and savings (0 when not helping). */
export function collegeNeedOf(pr: Profile): number {
  const c = collegeInputsOf(pr);
  return c ? collegeMonthly(collegeInput(c)) : 0;
}
