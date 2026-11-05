/* "How will you cover it?" on the Dashboard: the rule for which accounts
   the children's costs come out of, on the dashboard's paycheck lines,
   with the 401(k) up to the match last whatever the rule. */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { PcInput } from "@/tools/budget/paycheck-math";
import type { Freed } from "@/tools/plan/kids";
import { coverDash, dashKindOrder, linesInOrder } from "../cover";

// A traditional 401(k) and a Roth IRA; only the lines' tax treatment matters here.
const pi = { roth: { k401max: false, rothIra: true, match: false } } as unknown as PcInput;
const lines = { brok: 400, k401max: 300, rothIra: 500, hsa: 100, match: 250 };
// A dollar cut frees a dollar; traditional cuts reach the match line only past the 401(k) beyond it.
const F: Freed = (t) => ({ freed: t.brok + t.roth + t.trad + t.hsa, matchLost: Math.max(0, t.trad - lines.k401max) });

test("the usual order is the dashboard's lines; an order of accounts keeps the match line last", () => {
  assert.deepEqual(linesInOrder(pi, null), ["brok", "k401max", "rothIra", "hsa", "match"]);
  assert.deepEqual(dashKindOrder(pi), ["brok", "trad", "roth", "hsa"]);
  assert.deepEqual(linesInOrder(pi, { by: "order", order: ["trad", "roth", "brok", "hsa"] }), ["k401max", "rothIra", "brok", "hsa", "match"]);
});

test("covering by a rule on the dashboard: in order, or a share of each, the match kept", () => {
  const usual = coverDash(900, pi, {}, lines, F);
  assert.deepEqual(usual.take, { brok: 400, roth: 200, trad: 300, hsa: 0 });
  const rothFirst = coverDash(900, pi, {}, lines, F, { by: "order", order: ["roth", "brok", "trad", "hsa"] });
  assert.deepEqual(rothFirst.take, { brok: 400, roth: 500, trad: 0, hsa: 0 });
  // A share of the saving beyond the match: 900 of 1,300, so the match line is untouched.
  const share = coverDash(900, pi, {}, lines, F, { by: "share" });
  assert.equal(share.short, 0);
  assert.ok(share.take.trad <= lines.k401max, "trad " + share.take.trad);
  assert.equal(share.matchLost, 0);
  // Past everything else, the match line goes too.
  const most = coverDash(1400, pi, {}, lines, F, { by: "share" });
  assert.equal(most.take.trad, 400);
  assert.equal(most.matchLost, 100);
});
