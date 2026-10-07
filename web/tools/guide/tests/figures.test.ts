/* figures.ts: the lessons' live figures against doc 3's worked figures
   (calculations 2 and 3), and against the plan the rail shows, so a
   lesson never tells a different story from the number beside it. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { pias, sim, ssFor } from "../calc";
import { buckets, byMix, compounding, dollarAt, growthParts, ladder, mixHistory } from "../figures";
import type { Answers } from "../store";
import { FIXTURES } from "../../../scripts/baseline/guide-fixtures.mjs";

const fixture = (id: string) => structuredClone(FIXTURES.find((f) => f.id === id)!.a) as Answers;

test("a dollar at 38 is $3.83 at 62 for a growth mix", () => {
  assert.equal(dollarAt(38, 62, 0.0575).toFixed(2), "3.83");
});

test("$100 a month: started now, stopped after 14 years, started ten years late", () => {
  const C = compounding(38, 62, 0.0575, 100)!;
  assert.equal(C.gap, 10);
  assert.deepEqual(C.curves.map((c) => Math.round(c.fv)), [59562, 43774, 25027]);
  // one balance a birthday, today to retirement, for each curve
  for (const c of C.curves) assert.equal(c.path.length, 25, c.id);
  assert.equal(C.curves[2].path[9], 0);
  // short horizons take half the years; under two, no figure
  assert.equal(compounding(55, 63, 0.045, 100)!.gap, 4);
  assert.equal(compounding(60, 61, 0.045, 100), null);
});

test("what the balance and the saving grow to adds up to the plan's projection", () => {
  for (const id of ["maya-sam", "dan", "couple-58", "self-employed"]) {
    const a = fixture(id), G = growthParts(a)!, S = sim(a)!;
    assert.ok(Math.abs(G.total - S.fv) < 0.01, id + ": " + G.total + " vs " + S.fv);
  }
  const G = growthParts(fixture("maya-sam"))!;
  assert.equal(Math.round(G.fromSaved), 803431); // $210,000 × 3.83, doc 3's "$804,000"
  assert.equal(Math.round(G.total), 1518176);
  // a plan that coasts from now grows only what's saved
  const c = { ...fixture("maya-sam"), stopAge: 38 };
  assert.ok(Math.abs(growthParts(c)!.total - sim(c)!.fv) < 0.01);
});

test("the number moves with the mix, and the chosen mix's figure is the plan's", () => {
  const a = fixture("maya-sam"), M = byMix(a)!;
  assert.equal(M.length, 5);
  assert.ok(M.every((v, i) => i === 0 || v > M[i - 1]));
  assert.equal(Math.round(M[3]), 1518176); // Growth
});

test("each mix's record since 1926: a range around what it earned, the assumption below it", () => {
  const H = mixHistory();
  assert.deepEqual(H.map((h) => h.stock), [20, 40, 60, 80, 100]);
  for (const h of H) {
    assert.equal(h.first, 1926);
    assert.ok(h.worst < h.med && h.med < h.best, h.label);
    assert.ok(h.worst < 0, h.label + " has had a losing decade after inflation");
    assert.ok(h.real < h.cagr, h.label + ": the plan assumes less than history");
  }
  assert.ok(H[4].best - H[4].worst > H[0].best - H[0].worst);
});

test("the three buckets split the savings as the plan does", () => {
  const B = buckets(fixture("maya-sam"));
  assert.deepEqual(B.map((b) => b.v), [170000, 40000, 0]);
  assert.equal(B.reduce((s, b) => s + b.share, 0), 1);
  // a Roth figure over the total is capped, as planIn caps it
  assert.deepEqual(buckets({ saved: 100, rothNow: 500 }).map((b) => b.v), [0, 100, 0]);
});

test("Social Security from income, and the claiming ladder (doc 3, calculation 3)", () => {
  const a = fixture("maya-sam"), P = pias(a, a.retire!);
  assert.equal(Math.round(P.pia1), 3251);
  assert.equal(Math.round(P.pia2), 2346);
  assert.deepEqual(ladder(P.pia1).map((r) => [r.age, Math.round(r.mo)]), [[62, 2275], [64, 2601], [67, 3251], [70, 4031]]);
  assert.equal(Math.round(ssFor(a, a.retire!).total), 67159);
});
