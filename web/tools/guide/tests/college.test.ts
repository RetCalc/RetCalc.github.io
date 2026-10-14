/* college.ts: the College Savings figures the Guide holds, with each year's
   bill also in today's dollars, so the report can set college beside a
   plan kept in today's dollars. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { BASIC_INFL, collegePlanCalc } from "@/lib/engine/typed";
import { COLLEGE_DEFAULTS, collegeInput } from "@/tools/college/model";
import { collegeToday } from "../college";
import type { Answers } from "../store";

const two = { ...COLLEGE_DEFAULTS, kids: [
  { preset: "27000", cost: "27,000", years: "12", collegeYrs: "4" },
  { preset: "27000", cost: "27,000", years: "21", collegeYrs: "4" }] };

test("two children: the tool's own bills, and the same bills in today's dollars", () => {
  const a: Answers = { age: 38, college: "yes", kidAge: 6, clState: two };
  const C = collegeToday(a)!, P = collegePlanCalc(collegeInput(two))!;
  assert.equal(C.kids.length, 2);
  assert.deepEqual(C.kids.map((k) => [k.from, k.to]), [[50, 54], [59, 63]]);
  assert.deepEqual(C.kids[0].bills, P.kids[0].yearCosts);
  // the first year of the first child's college, brought back twelve years
  assert.ok(Math.abs(C.kids[0].billsToday[0] - P.kids[0].yearCosts[0] / Math.pow(1 + (BASIC_INFL as number), 12)) < 1e-6);
  // tuition rises faster than prices, so a year of college costs more than $27,000 today, but far less than the future figure
  assert.ok(C.kids[0].billsToday[0] > 27000 && C.kids[0].billsToday[0] < P.kids[0].yearCosts[0]);
  assert.ok(Math.abs(C.monthly - P.monthly) < 1e-6);
  assert.equal(C.saveUntil, 59);
  assert.ok(Math.abs(C.totalToday - C.kids[0].totalToday - C.kids[1].totalToday) < 1e-6);
});

test("the figure the Guide brought back wins, a child's age alone times one child, and no plan is null", () => {
  assert.equal(collegeToday({ age: 38, college: "yes", kidAge: 6, clState: two, collegeMo: 1000 })!.monthly, 1000);
  const one = collegeToday({ age: 38, college: "yes", kidAge: 6 })!;
  assert.deepEqual(one.kids.map((k) => [k.from, k.to]), [[50, 54]]);
  assert.equal(collegeToday({ age: 38, college: "no", kidAge: 6 }), null);
  assert.equal(collegeToday({ age: 38, college: "yes" }), null);
});
