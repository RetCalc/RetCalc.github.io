/* What the plan spreadsheet is made from: the printed report's model (so the
   two always agree), the working years as Year by year has them, and the
   tax plan as Retirement's Taxes view shows it. No React, no spreadsheet
   library: plain figures, so it can be checked on its own. */

import type { DashData } from "../store";
import { dashReport, type DashReport } from "../report/model";
import { planYearsOf } from "../model";
import { NO_PLAN, compare, marketYear, planOf, planWords, samePlan, taxDetail, taxSetup } from "../taxes";

export interface WorkbookData {
  M: DashReport;
  /** The working years, a month each, in today's dollars (Year by year). */
  years: ReturnType<typeof planYearsOf>["years"];
  /** The tax plan in the median market, against no conversions. */
  tax: {
    words: string; converts: boolean; year: number;
    run: NonNullable<ReturnType<typeof taxDetail>>; base: NonNullable<ReturnType<typeof taxDetail>>;
    cmp: ReturnType<typeof compare>; year0: number; bridged: boolean;
  } | null;
}

export function workbookData(d: DashData, today = new Date()): WorkbookData | { missing: string } {
  const M = dashReport(d, today);
  if (M.missing != null) return { missing: M.missing };
  const R = M as DashReport;
  const years = planYearsOf(R.pr, R.entries).years;
  const s = R.abroad ? null : taxSetup(R.pr, R.entries, R.R);
  let tax: WorkbookData["tax"] = null;
  if (s) {
    const T = planOf(R.pr), year = marketYear(s, "p50"), run = taxDetail(s, T, year), base = taxDetail(s, NO_PLAN, year);
    if (run && base) tax = { words: planWords(T), converts: !samePlan(T, NO_PLAN), year, run, base, cmp: compare(s, T), year0: s.year0, bridged: s.bridged };
  }
  return { M: R, years, tax };
}
