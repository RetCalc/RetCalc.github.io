/* The Paycheck tab's saving, copied into Advanced: each account's
   amount on the right schedule, the match to the same dollars, and the HSA
   kept for health care in the account math. Run with `npm run test:budget`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PER_YEAR } from "@/lib/engine/typed";
import { ADVANCED_DEFAULTS, advancedPlan } from "@/tools/advanced/model";
import { BUDGET_DEFAULTS, type BudgetInputs } from "../model";
import { paycheckInput, paycheckRun } from "../paycheck-math";
import { advancedHasSaving, intoAdvanced, paycheckCopy } from "../to-calculator";

const T = { status: "s", state: "IL" };
const near = (a: number, b: number, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} is not within ${tol} of ${b}`);
const pay = (patch: Partial<BudgetInputs>) => paycheckInput({ ...BUDGET_DEFAULTS, pcGross: "95,000", pcState: "IL", ...patch }, "IL");

test("one paycheck: each account per check, every two weeks, and the match's own terms", () => {
  const pi = pay({ pcMatch: "219.23", pcHsa: "100", pcRothIra: "150", pcK401max: "80", pcK401maxRoth: true, pcBrok: "60", pcEf: "40", pcEfOn: true });
  const c = paycheckCopy(pi);
  assert.equal(c.period, "Bi-Weekly");
  near(c.trad, 219.23); near(c.roth, 80 + 150); near(c.brok, 60); near(c.hsa, 100);
  assert.deepEqual([c.salary, c.matchPct, c.matchCap], [95000, 50, 6]);
  // In Advanced: the same amounts, and the match to the cent.
  const P = advancedPlan(intoAdvanced(ADVANCED_DEFAULTS, c, T), null);
  near(P.B!.match!, paycheckRun(pi).match);
  near(P.p.contrib, 219.23 + 230 + 60 + 100 + paycheckRun(pi).match);
  // A traditional IRA goes to traditional.
  near(paycheckCopy({ ...pi, roth: { ...pi.roth, rothIra: false } }).trad, 219.23 + 150);
});

test("twice a month comes across monthly, and two incomes on one schedule keep it", () => {
  const semi = paycheckCopy(pay({ pcFreq: "24", pcHsa: "100" }));
  assert.equal(semi.period, "Monthly"); near(semi.hsa, 200);
  const two = pay({ pcStatus: "m2", pcGross2: "80,000", pcFreq2: "26", pcHsa: "260" });
  const c = paycheckCopy(two);
  assert.equal(c.period, "Bi-Weekly"); near(c.hsa, (260 * 12) / 26);
  assert.equal(paycheckCopy({ ...two, pays: [26, 24] }).period, "Monthly");
});

test("two incomes: combined match terms come to the same dollars", () => {
  const pi = pay({ pcStatus: "m2", pcGross2: "60,000", pcFreq2: "26", pcMatchRate2: "100", pcMatchUpTo2: "4", pcMatch: "1,000" });
  const c = paycheckCopy(pi), yearMatch = paycheckRun(pi).match * 12;
  assert.equal(c.salary, 155000);
  const P = advancedPlan(intoAdvanced(ADVANCED_DEFAULTS, c, T), null);
  near(P.B!.match! * PER_YEAR[c.period], yearMatch, 0.5);
});

test("one income short of its match, with an IRA: terms that don't count the IRA", () => {
  const pi = pay({ pcMatch: "100", pcRothIra: "200" });
  const c = paycheckCopy(pi);
  const P = advancedPlan(intoAdvanced(ADVANCED_DEFAULTS, c, T), null);
  near(P.B!.match!, paycheckRun(pi).match);
});

test("what counts as saving already there", () => {
  assert.equal(advancedHasSaving(ADVANCED_DEFAULTS), false);
  const c = paycheckCopy(pay({ pcMatch: "219.23" }));
  assert.equal(advancedHasSaving(intoAdvanced(ADVANCED_DEFAULTS, c, T)), true);
});

test("the HSA grows with the rest but nothing is withdrawn from it", () => {
  const base = { ...ADVANCED_DEFAULTS, acOn: true, tradBal: "100,000", tradC: "500", rothBal: "0", rothC: "0", brokBal: "0", brokC: "0", hsaBal: "0", hsaC: "0" };
  const without = advancedPlan(base, null).B!, withH = advancedPlan({ ...base, hsaBal: "20,000", hsaC: "100" }, null).B!;
  assert.ok(withH.real.hsa > 0);
  assert.equal(withH.w.hsa, 0);
  near(withH.wTotal, withH.totalReal * advancedPlan(base, null).p.withdrawal, 1e-6);
  // Everything withdrawn comes from traditional here, so it's all taxed.
  near(withH.w.trad, withH.wTotal, 1e-6);
  assert.ok(withH.tax.total > without.tax.total);
  near(withH.effRate, withH.tax.total / withH.wTotal, 1e-9);
  near(withH.totalReal, without.totalReal + withH.real.hsa, 1e-6);
  // Only an HSA: it's all there is to draw on, tax-free.
  const only = advancedPlan({ ...base, tradBal: "0", tradC: "0", hsaBal: "50,000", hsaC: "100" }, null).B!;
  near(only.w.hsa, only.wTotal, 1e-6); assert.equal(only.tax.total, 0);
});
