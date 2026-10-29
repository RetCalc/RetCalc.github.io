/* Full retirement age from the birth year, wherever a claiming adjustment is
   applied: the Retirement Plan Optimizer's inputs, the Guide's plan and
   Social Security figures (the Dashboard feeds the Guide the same answers). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { NEWEST_YEAR, ssFRA } from "@/lib/engine/typed";
import { OP_DEFAULTS, opFras, opToolIn, type OptimizerInputs } from "../../optimizer/model";
import { births, claimAge, fras, planIn, ssFor } from "../calc";
import type { Answers } from "../store";
import { FIXTURES } from "../../../scripts/baseline/guide-fixtures.mjs";

const fixture = (id: string) => structuredClone(FIXTURES.find((f) => f.id === id)!.a) as Answers;
const op = (f: Partial<OptimizerInputs>) => ({ ...OP_DEFAULTS, ...f });

test("Optimizer: the default is 67 and claims at 67, as before", () => {
  const I = opToolIn(op({}));
  assert.equal(I.fra1, 67);
  assert.equal(I.claim1, 67);
  assert.equal(I.claim2, 67);
});

test("Optimizer: the birth year typed sets the full retirement age", () => {
  for (const [birth, fra] of [["1950", 66], ["1955", 66 + 2 / 12], ["1957", 66.5], ["1959", 66 + 10 / 12], ["1960", 67], ["1965", 67]] as const) {
    assert.ok(Math.abs(opFras(op({ birth })).fra1 - fra) < 1e-9, birth);
  }
});

test("Optimizer: with no birth year it comes from the age, as the Social Security Calculator reads it", () => {
  const born57 = String(NEWEST_YEAR - 1957);
  assert.equal(opFras(op({ mode: "now", age: born57 })).fra1, 66.5);
  // a plan from before the field: nothing typed, the age decides
  const old = { ...OP_DEFAULTS, age: born57 } as Record<string, string>;
  delete old.birth; delete old.spBirth;
  assert.equal(opToolIn(old as OptimizerInputs).fra1, 66.5);
  // a year that is not a year is ignored
  assert.equal(opFras(op({ birth: "19", age: born57 })).fra1, 66.5);
  assert.equal(opFras(op({ birth: "", age: "" })).fra1, 67);
});

test("Optimizer: a typed birth year wins over the age", () => {
  assert.equal(opFras(op({ age: String(NEWEST_YEAR - 1957), birth: "1950" })).fra1, 66);
});

test("Optimizer: the usual plan claims at the whole year nearest each full retirement age; a choice stays", () => {
  const born57 = op({ birth: "1957" });
  assert.equal(opToolIn(born57).claim1, 67);
  assert.equal(opToolIn(op({ birth: "1950" })).claim1, 66);
  assert.equal(opToolIn(op({ birth: "1955" })).claim1, 66);
  assert.equal(opToolIn({ ...born57, claim: "62" }).claim1, 62);
  assert.equal(opToolIn({ ...op({ birth: "1950" }), claim: "67" }).claim1, 67);
});

test("Optimizer: a couple has a full retirement age each", () => {
  const I = opToolIn(op({ status: "m", birth: "1950", spBirth: "1957" }));
  assert.equal(I.fra1, 66);
  assert.equal(I.fra2, 66.5);
  assert.equal(I.claim1, 66);
  assert.equal(I.claim2, 67);
  // single: the spouse's year is not read
  assert.equal(opToolIn(op({ status: "s", spBirth: "1950" })).fra2, 67);
});

test("Guide: the answers' ages set the full retirement ages, the birth year when it is known", () => {
  const a = { ...fixture("couple-58"), age: NEWEST_YEAR - 1957, spouseAge: NEWEST_YEAR - 1950 };
  assert.deepEqual(fras(a), { fra1: 66.5, fra2: 66 });
  assert.deepEqual(births(a), { birth1: "1957", birth2: "1950" });
  assert.deepEqual(fras({ ...a, birth: 1955, birth2: 1960 }), { fra1: ssFRA(1955), fra2: 67 });
  assert.deepEqual(fras({ ...a, age: null, spouseAge: null }), { fra1: 67, fra2: 67 });
});

test("Guide: the plan carries them, and a blank claim means each one's own", () => {
  const a = { ...fixture("couple-58"), age: 60, retire: 62, spouseAge: NEWEST_YEAR - 1950, ssClaim: null };
  const I = planIn(a)!;
  assert.equal(I.fra1, 67);
  assert.equal(I.fra2, 66);
  assert.equal(claimAge(a, 62, 1), 67);
  assert.equal(claimAge(a, 62, 2), 66);
  assert.equal(I.claim1, 67);
  assert.equal(I.claim2, 66);
  // a chosen age is for both
  assert.equal(claimAge({ ...a, ssClaim: 64 }, 62, 2), 64);
});

test("Guide: Social Security counts the cut and the credits from the full retirement age", () => {
  const base = { ...fixture("dan"), age: 66, retire: 66, ssOwn: 2400, ssClaim: 62 };
  const at67 = ssFor({ ...base, age: NEWEST_YEAR - 1962 }, 66);
  const at66 = ssFor({ ...base, age: NEWEST_YEAR - 1950 }, 66);
  assert.equal(at67.fra1, 67);
  assert.equal(at66.fra1, 66);
  // claiming is held to retirement, so compare at 66 and 70
  const late67 = ssFor({ ...base, age: NEWEST_YEAR - 1962, ssClaim: 70 }, 66).a1;
  const late66 = ssFor({ ...base, age: NEWEST_YEAR - 1950, ssClaim: 70 }, 66).a1;
  assert.ok(Math.abs(late67 - 2400 * 12 * 1.24) < 0.01);
  assert.ok(Math.abs(late66 - 2400 * 12 * 1.32) < 0.01);
});
