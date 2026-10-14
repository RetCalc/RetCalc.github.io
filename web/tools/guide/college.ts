/* College in the plan's own money. The College Savings tool works in the
   dollars of the year each bill is paid (tuition rising 4% a year by
   default); everything else the Guide shows is in today's dollars. This
   takes the tool's own figures for the children the Guide sent there and
   brings each year's bill back to today's dollars at the plan's inflation,
   so a report or a card can set college beside the rest of the plan. The
   monthly figure stays as the tool gives it: a fixed amount a month, the
   same in every month, which is how it would be set up at a bank. No React,
   so tests run it in Node. */

import { BASIC_INFL, collegePlanCalc } from "@/lib/engine/typed";
import { COLLEGE_DEFAULTS, collegeInput, collegeMonthly, type CollegeInputs } from "@/tools/college/model";
import type { Answers } from "./store";

const ok = (v: unknown): v is number => typeof v === "number" && isFinite(v);
const INFL = BASIC_INFL as number;

export interface CollegeKid {
  /** Your age the year college starts, and the year after it ends. */
  from: number; to: number;
  yearsUntil: number;
  /** Each year's bill: as the College Savings tool shows it, and in today's dollars. */
  bills: number[]; billsToday: number[];
  total: number; totalToday: number;
}
export interface CollegePlanToday {
  kids: CollegeKid[];
  /** A month, fixed: the College Savings figure, or the plan's own. */
  monthly: number;
  /** Your age when that saving stops (the last child starts college). */
  saveUntil: number;
  totalToday: number;
  /** The yearly cost the tool started from, today, for the first child. */
  costNow: number;
  tuitionInfl: number; investRet: number;
}

/** The College Savings inputs the Guide holds: what the trip brought back,
    or the tool's defaults timed from the child's age. */
function inputs(a: Answers): CollegeInputs | null {
  if (a.clState && typeof a.clState === "object") return { ...COLLEGE_DEFAULTS, ...(a.clState as Partial<CollegeInputs>) };
  if (ok(a.kidAge)) return { ...COLLEGE_DEFAULTS, kids: [{ ...COLLEGE_DEFAULTS.kids[0], years: String(Math.max(0, 18 - Math.round(a.kidAge))) }] };
  return null;
}

/** College for the children in College Savings, in today's dollars beside
    the tool's own figures; null when the Guide has no college plan. */
export function collegeToday(a: Answers): CollegePlanToday | null {
  if (a.college !== "yes" || !ok(a.age)) return null;
  const s = inputs(a);
  if (!s) return null;
  const inp = collegeInput(s), P = collegePlanCalc(inp);
  if (!P) return null;
  const kids = P.kids.map((k): CollegeKid => {
    const billsToday = k.yearCosts.map((v, j) => v / Math.pow(1 + INFL, k.yearsUntil + j));
    const from = Math.round(a.age! + k.yearsUntil);
    return { from, to: from + k.yearCosts.length, yearsUntil: k.yearsUntil, bills: k.yearCosts, billsToday,
      total: k.total, totalToday: billsToday.reduce((t, v) => t + v, 0) };
  });
  const last = P.phases[P.phases.length - 1];
  return { kids, monthly: ok(a.collegeMo) && a.collegeMo > 0 ? a.collegeMo : collegeMonthly(inp), saveUntil: Math.round(a.age + (last ? last.to : 0) / 12),
    totalToday: kids.reduce((t, k) => t + k.totalToday, 0), costNow: inp.kids[0]?.annualCost ?? 0, tuitionInfl: inp.tuitionInfl, investRet: inp.investRet };
}
