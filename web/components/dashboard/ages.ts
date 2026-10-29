/* The ages the contribution limits go by. Kept apart from flows.ts so it
   can be tested without the screens. */
import type { PcAges } from "@/tools/budget/paycheck-math";
import type { Person, Profile } from "./store";

/** Your age and your spouse's at the end of this calendar year, from the
    birth years in Profile (null: not given). The year-end age is the one
    the catch-up contributions go by (50, 60 to 63, and 55 for the HSA). */
export function agesOf(pr: { p1: Pick<Person, "by">; p2: Pick<Person, "by">; who: Profile["who"] }, d = new Date()): PcAges {
  const end = (p: Pick<Person, "by">) => (p.by ? d.getFullYear() - p.by : null);
  return [end(pr.p1), pr.who === "couple" ? end(pr.p2) : null];
}
