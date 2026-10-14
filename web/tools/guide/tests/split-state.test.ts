/* The Income step's state-by-state take-home estimate, and the monthly
   saving's split across the three tax buckets (split.ts): the estimate
   follows the person's state and waits for one; the split starts 50/25/25,
   fills the plan's three saving streams, and carries a guide saved with the
   old four-way choice over to percentages. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { payParts, planIn, splitOff, splitShares, taxEst } from "../calc";
import { refreshEstimates } from "../sources";
import { migrateSplit } from "../split";
import { STEPS } from "../steps/decl";
import { normalizeV2 } from "../stored";
import type { Answers, Sources } from "../store";
import { FIXTURES } from "../../../scripts/baseline/guide-fixtures.mjs";

const NOW = "2026-10-07T12:00:00.000Z";
const dan = () => structuredClone(FIXTURES.find((f) => f.id === "dan")!.a) as Answers;
const step = (id: string) => STEPS.find((s) => s.id === id)!;

test("take-home follows the state: more in Texas than California on the same salary, and nothing without a state", () => {
  const base: Answers = { status: "s", income: 120000 };
  assert.equal(taxEst(base), 0);
  assert.equal(payParts(base), null);
  const tx = taxEst({ ...base, state: "TX" }), ca = taxEst({ ...base, state: "CA" });
  assert.ok(tx > ca + 300, `TX ${tx} vs CA ${ca}`);
  const P = payParts({ ...base, state: "TX" })!;
  assert.equal(P.state, 0);
  assert.equal(P.stateNone, true);
  assert.equal(P.stateName, "Texas");
  assert.ok(payParts({ ...base, state: "CA" })!.state > 500);
  assert.ok(Math.abs(P.net + P.federal + P.state + P.fica - P.gross) < 0.01);
});

test("the estimate waits for a state, and an estimate already worked out stays", () => {
  const g = { a: { status: "s", income: 90000 } as Answers, src: {} as Sources };
  refreshEstimates(g);
  assert.equal(g.a.takehome, undefined);
  g.a.state = "WA";
  refreshEstimates(g);
  assert.equal(g.a.takehome, Math.round(taxEst(g.a)));
  assert.equal(g.src.takehome?.kind, "estimated");
  g.a.state = "NY";
  refreshEstimates(g);
  assert.equal(g.a.takehome, Math.round(taxEst(g.a)));
  const old = { a: { status: "s", income: 90000, takehome: 5000 } as Answers, src: { takehome: { kind: "estimated", at: NOW } } as Sources };
  refreshEstimates(old);
  assert.equal(old.a.takehome, 5000);
});

test("Continue on About you needs a state; on the savings cards, a split that adds to 100", () => {
  const a = dan();
  assert.equal(step("about").needs!({ ...a, state: "TX" }), null);
  assert.match(step("about").needs!({ ...a, state: null })!, /state/i);
  assert.equal(step("savings").needs!({ ...a, splitTrad: 50, splitRoth: 25, splitBrok: 25 }), null);
  assert.match(step("savings").needs!({ ...a, splitTrad: 50, splitRoth: 25, splitBrok: 20 })!, /95%/);
  assert.match(step("accounts").needs!({ ...a, splitTrad: 60, splitRoth: 60, splitBrok: 0 })!, /120%/);
  assert.equal(splitOff({ splitTrad: 33.3, splitRoth: 33.3, splitBrok: 33.4 }), null);
});

test("the split starts 50/25/25 and feeds the plan's three streams, with the employer's share traditional", () => {
  const a: Answers = { ...dan(), contrib: 1000, employer: 400, splitTrad: undefined, splitRoth: undefined, splitBrok: undefined };
  assert.deepEqual(splitShares(a), { t: 0.5, r: 0.25, b: 0.25 });
  const I = planIn({ ...a, retSpend: 60000 })!;
  assert.equal(I.saveTrad, 500 + 400);
  assert.equal(I.saveRoth, 250);
  assert.equal(I.saveBrok, 250);
  const J = planIn({ ...a, retSpend: 60000, splitTrad: 0, splitRoth: 100, splitBrok: 0 })!;
  assert.deepEqual([J.saveTrad, J.saveRoth, J.saveBrok], [400, 1000, 0]);
});

test("a split that doesn't add to 100 is scaled to fill the month, so no money is lost", () => {
  const a: Answers = { ...dan(), contrib: 1000, employer: 0, retSpend: 60000, splitTrad: 30, splitRoth: 10, splitBrok: 10 };
  const I = planIn(a)!;
  assert.ok(Math.abs(I.saveTrad + I.saveRoth + I.saveBrok - 1000) < 1e-9);
  assert.ok(Math.abs(I.saveTrad - 600) < 1e-9);
});

test("a guide saved with the four-way choice reads back as the same split in percentages", () => {
  const read = (saveTo: string, kind?: "entered" | "default") => {
    const g = normalizeV2({ v: 2, a: { age: 40, saveTo }, src: kind ? { saveTo: { kind, at: NOW } } : {} }, NOW)!;
    return [g.a.splitTrad, g.a.splitRoth, g.a.splitBrok, g.a.saveTo];
  };
  assert.deepEqual(read("trad", "entered"), [100, 0, 0, undefined]);
  assert.deepEqual(read("roth"), [0, 100, 0, undefined]);
  assert.deepEqual(read("half", "entered"), [50, 50, 0, undefined]);
  assert.deepEqual(read("brok"), [0, 0, 100, undefined]);
  // A choice the guide made for the person is replaced by the new default, not carried over.
  assert.deepEqual(read("trad", "default"), [undefined, undefined, undefined, undefined]);
  // Percentages already given win over an old choice left beside them.
  const a: Answers = { splitTrad: 10, splitRoth: 10, splitBrok: 80, saveTo: "trad" };
  migrateSplit(a);
  assert.deepEqual([a.splitTrad, a.splitRoth, a.splitBrok, a.saveTo], [10, 10, 80, undefined]);
});
