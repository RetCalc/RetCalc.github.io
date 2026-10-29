/* Catch-up contributions on the Dashboard: the ages the paycheck's caps go
   by come from the birth years in Profile, taken at the end of this year, and
   a spouse's only in a couple. (The caps themselves, and how they move as
   the years pass for the plan's projections, are tested with the Paycheck
   tab in tools/budget/tests/catchup.test.ts: flows.ts loads screens, which
   plain Node can't.) */
import assert from "node:assert/strict";
import { test } from "node:test";
import { agesOf } from "../ages";

const D = new Date(2026, 5, 15);
const p = (by: number | null) => ({ by });

test("ages are taken at the end of this year, from the birth year", () => {
  // Born in 1974: 52 at the end of 2026, even though they are 51 until their birthday.
  assert.deepEqual(agesOf({ p1: p(1974), p2: p(null), who: "single" }, D), [52, null]);
  assert.deepEqual(agesOf({ p1: p(null), p2: p(null), who: null }, D), [null, null]);
  assert.deepEqual(agesOf({ p1: p(1976), p2: p(null), who: "single" }, D), [50, null]);
});

test("a spouse's age counts only in a couple", () => {
  assert.deepEqual(agesOf({ p1: p(1974), p2: p(1970), who: "couple" }, D), [52, 56]);
  assert.deepEqual(agesOf({ p1: p(1974), p2: p(1970), who: "single" }, D), [52, null]);
  assert.deepEqual(agesOf({ p1: p(1974), p2: p(null), who: "couple" }, D), [52, null]);
});
