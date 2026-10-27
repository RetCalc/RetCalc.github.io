/* Health cover until Medicare. Once the household's last paycheck stops,
   anyone under 65 needs cover of their own (a marketplace plan, with the
   subsidy their income earns) until Medicare starts at 65; after that,
   Medicare's premiums. The plan already counts both on top of spending
   (the Guide's engine prices them each year); Retirement's Health cover
   view runs the Healthcare Cost Planner on the plan's own figures, and the
   Dashboard calls out the years before 65 when there are any. */

import { withDefaults } from "@/components/tools/ToolState";
import { dollarsField } from "@/lib/format";
import { HEALTHCARE_DEF, type HealthcareInputs } from "@/tools/healthcare/model";
import { householdAt } from "./bridge";
import { taxState } from "./flows";
import { couple, nameOf, outsideUS, people, type Results } from "./model";
import type { Profile } from "./store";

export const MEDICARE_AGE = 65;

/** The years with no job's health plan before Medicare: from the year the
    last of you stops work to the year the youngest turns 65, and each of
    you who needs cover then, with the year they reach Medicare. Null when
    nobody does (or outside the US, or before the ages are in). */
export interface HealthGap { from: number; to: number; years: number; who: { i: 0 | 1; name: string; medicare: number }[] }
export function healthGap(pr: Profile): HealthGap | null {
  if (outsideUS(pr)) return null;
  const ps = people(pr);
  if (ps.some((p) => p.by == null || p.retire == null)) return null;
  const from = Math.max(...ps.map((p) => p.by! + p.retire!));
  const who = ps.map((p, k) => ({ i: k as 0 | 1, name: nameOf(pr, k as 0 | 1), medicare: p.by! + MEDICARE_AGE })).filter((w) => w.medicare > from);
  if (!who.length) return null;
  const to = Math.max(...who.map((w) => w.medicare));
  return { from, to, years: to - from, who };
}

/** The Healthcare Cost Planner on the plan: who's covered and their ages
    the year work stops (the younger of you first, as the one on a
    marketplace plan longest), the household, the state, and the plan's own
    income that year and at 65; the benchmark premium is the person's own. */
export function healthFor(pr: Profile, R: Results): HealthcareInputs {
  const cur = withDefaults(HEALTHCARE_DEF, (pr.tools.healthcare ?? {}) as Partial<HealthcareInputs>);
  const ps = people(pr);
  if (ps.some((p) => p.by == null || p.retire == null)) return cur;
  const stop = Math.max(...ps.map((p) => p.by! + p.retire!));
  const ages = ps.map((p) => stop - p.by!), young = ages.length > 1 && ages[1] < ages[0] ? 1 : 0;
  const rows = R.S?.D.rows ?? [], start = R.retireYear ?? stop;
  const row = (y: number) => rows[Math.max(0, Math.min(rows.length - 1, Math.round(y)))];
  const first = row(stop - start), at65 = row(MEDICARE_AGE - (R.S?.retire ?? MEDICARE_AGE));
  const money = (v: number | undefined) => (v != null && v > 0 ? dollarsField(v) : "");
  return {
    ...cur,
    retireAge: String(Math.round(ages[young])), spouseAge: String(Math.round(ages[young ? 0 : 1] ?? ages[0])),
    status: couple(pr) ? "m" : "s", household: String(householdAt(pr, stop)), state: taxState(pr),
    income: money(first?.agi), ss: money(first?.ss), income65: money(at65?.agi),
  };
}

/** What the profile keeps from the planner: the benchmark premium, the one
    figure that's the person's own. */
export const healthChoices = (h: HealthcareInputs) => ({ premium: h.premium });

/** "You both stop work by 2043. Sam reaches Medicare in 2049 and Jordan in
    2052: 9 years of health cover to buy yourselves." */
export function healthWords(pr: Profile, gap: HealthGap): string {
  const two = couple(pr);
  const stop = two ? `You both stop work by ${gap.from}.` : `You stop work in ${gap.from}.`;
  const [a, b] = gap.who, who = (w: HealthGap["who"][number]) => (w.name === "You" ? "You reach" : w.name + " reaches");
  const med = b ? `${who(a)} Medicare in ${a.medicare} and ${b.name === "You" ? "you" : b.name} in ${b.medicare}` : `${who(a)} Medicare in ${a.medicare}`;
  return `${stop} ${med}: ${gap.years} ${gap.years === 1 ? "year" : "years"} of health cover to buy ${two ? "yourselves" : "yourself"}.`;
}
