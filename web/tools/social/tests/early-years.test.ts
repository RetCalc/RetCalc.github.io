/* Social Security's pay history before full-time work: a career starts at
   18 by default, past years before 22 are a third of age 22's pay (rounded
   to $100 as earned) walking back at the past raise, and years typed by
   hand or still ahead are left alone. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { careerYears, SOCIAL_DEFAULTS, wageIndex } from "../model";

const base = { ...SOCIAL_DEFAULTS.you, pay: "85,000", gPast: "2", edits: {} as Record<string, string> };

test("both people start at 18 by default", () => {
  assert.equal(SOCIAL_DEFAULTS.you.start, "18");
  assert.equal(SOCIAL_DEFAULTS.spouse.start, "18");
  assert.equal(careerYears(base, 36)[0].age, 18);
});

test("age 21 is a third of age 22, rounded to $100 as earned", () => {
  const L = careerYears(base, 36), at = (a: number) => L.find((y) => y.age === a)!;
  const p22 = 85000 / Math.pow(1.02, 14);
  assert.ok(Math.abs(at(22).pay - p22) < 0.01);
  for (const a of [18, 19, 20, 21]) {
    assert.equal(at(a).earned % 100, 0, `age ${a} earned is a round hundred`);
    const want = p22 / 3 / Math.pow(1.02, 21 - a);
    assert.ok(Math.abs(at(a).pay - want) <= 50 * wageIndex(at(a).year) + 0.01, `age ${a} near a third of 22, walked back`);
  }
  assert.ok(at(21).pay < at(22).pay / 2.9 && at(18).pay < at(21).pay);
});

test("a first job at 16 walks back from 21 the same way", () => {
  const L = careerYears({ ...base, start: "16" }, 36);
  assert.equal(L[0].age, 16);
  assert.ok(L[0].pay < L[2].pay && L[2].pay < L[5].pay);
});

test("a year typed by hand stays as typed", () => {
  const L = careerYears({ ...base, edits: { "19": "4,321" } }, 36);
  assert.equal(L.find((y) => y.age === 19)!.earned, 4321);
});

test("someone younger than 22 walks back from today's pay alone", () => {
  const L = careerYears(base, 20), at = (a: number) => L.find((y) => y.age === a)!;
  assert.equal(at(20).pay, 85000);
  assert.ok(Math.abs(at(19).pay - 85000 / 1.02) < 0.01);
});
