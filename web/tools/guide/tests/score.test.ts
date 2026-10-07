/* score.ts's explanations and calc.ts's placeholder spending (D5): the
   confidence line counts sources over the answers the scored areas read;
   the placeholder is 80% of take-home, rounded to $500, until spending is
   entered, and a plan that has its own spending is left alone. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { guessing, need, score, sim, spendGuess, withGuess } from "../calc";
import { RULES, confidence, confidenceLine } from "../score";
import { deriveSources } from "../migrate";
import type { Answers } from "../store";
import { FIXTURES } from "../../../scripts/baseline/guide-fixtures.mjs";

const NOW = "2026-10-07T12:00:00.000Z";
const fixture = (id: string) => structuredClone(FIXTURES.find((f) => f.id === id)!.a) as Answers;

test("every area states its rule", () => {
  assert.deepEqual(Object.keys(RULES).sort(), ["cushion", "debt", "flow", "outlook", "rate"]);
});

test("the placeholder is 80% of take-home, to the nearest $500, until spending is entered", () => {
  const a = fixture("maya-sam");
  assert.equal(spendGuess(a), 88500); // 0.8 × 9,200 × 12 = 88,320
  assert.equal(guessing(a), false);
  assert.equal(withGuess(a), a);
  const b = { ...a, retSpend: null };
  assert.equal(guessing(b), true);
  assert.equal(withGuess(b).retSpend, 88500);
  assert.equal(spendGuess({ ...b, takehome: null }), 0);
  assert.equal(withGuess({ ...b, takehome: null }).retSpend, null);
  // the renter's recorded spending is the placeholder itself
  const r = fixture("renter-29");
  assert.equal(spendGuess(r), r.retSpend);
});

test("with the placeholder, the plan needs $1,145,000 for Maya and Sam (doc 3, section 3, item 5)", () => {
  const a = { ...fixture("maya-sam"), retSpend: null }, S = sim(withGuess(a))!;
  assert.equal(Math.round(S.fv), 1518176);
  assert.equal(S.spend, 88500);
  assert.equal(need(withGuess(a), S), 1145000);
});

test("the score with the worker's plan is the score worked out here", () => {
  for (const f of FIXTURES) {
    const a = structuredClone(f.a) as Answers;
    assert.deepEqual(score(a, sim(a)), score(a), f.id);
  }
});

test("the confidence line counts what you gave, what's estimated and what's a default", () => {
  const a = fixture("maya-sam"), src = deriveSources(a, NOW);
  const all = ["outlook", "rate", "cushion", "debt", "flow"] as const;
  const c = confidence(a, src, [...all]);
  // Social Security from income is an estimate; everything else was typed
  assert.equal(c.estimated, 1);
  assert.equal(c.defaults, 0);
  assert.ok(c.entered >= 10);
  assert.equal(confidenceLine({ entered: 4, estimated: 1, defaults: 0 }), "Based on 4 answers you gave and 1 estimate.");
  assert.equal(confidenceLine({ entered: 1, estimated: 2, defaults: 1 }), "Based on 1 answer you gave, 2 estimates and 1 default.");
  // the placeholder counts as a default; a default risk mix too
  const b = { ...a, retSpend: null }, srcB = { ...src, risk: { kind: "default" as const, at: NOW } };
  delete srcB.retSpend;
  const d = confidence(b, srcB, ["outlook"]);
  assert.equal(d.defaults, 2);
  // a statement figure for Social Security is the person's own
  assert.equal(confidence({ ...a, ssOwn: 3200 }, src, ["outlook"]).estimated, 0);
});
