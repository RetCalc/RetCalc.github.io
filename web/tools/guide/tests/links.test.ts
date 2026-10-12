/* stored.ts and links.ts: a saved v2 guide read back, and share links
   going out and coming in (doc 3; the unit tests listed under "Testing").
   Guides and links from before v2 aren't opened. Run with `npm run test:guide`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanLink, linkPayload } from "../links";
import { normalizeV2 } from "../stored";
import type { Answers } from "../store";
import { deriveSources } from "./derive-sources";
import { FIXTURES } from "../../../scripts/baseline/guide-fixtures.mjs";

const NOW = "2026-10-07T12:00:00.000Z";
const fixture = (id: string): Answers => structuredClone(FIXTURES.find((f) => f.id === id)!.a) as Answers;

test("a v2 state read back is filled in and capped", () => {
  const snap = { at: NOW, pace: "quick", score: 80, areas: {}, fv: 1, need: 1, success: 1, retire: 62, spend: 1, monthly: 1, moves: [] };
  const g = normalizeV2({ v: 2, a: { age: 40 }, src: { age: { kind: "entered", at: NOW }, retire: { kind: "entered", at: NOW }, cash: { kind: "bogus", at: NOW } },
    snapshots: Array.from({ length: 30 }, (_, i) => ({ ...snap, score: i })), pace: "sideways" }, NOW)!;
  assert.equal(g.pace, "quick");
  assert.equal(g.cur, "welcome");
  assert.equal(g.snapshots.length, 24);
  assert.equal(g.snapshots[0].score, 6);
  assert.deepEqual(Object.keys(g.src), ["age"]); // no answer for retire; cash's kind unknown
  assert.deepEqual(g.moves, {});
  assert.deepEqual(g.done, {});
});

test("a v2 link round-trips answers, sources, pace and events", () => {
  const a: Answers = { ...fixture("priya-tom"), bgRows: [{ desc: "x" }], kidsNow: [4, 1], events: [
    { id: "c1", kind: "child", born: 35, childcare: true, earlyCost: 2500 },
    { id: "r1", kind: "raise", at: 40, extra: 500 },
    { id: "x1", kind: "custom", from: 50, delta: -300, label: "Care for a parent" },
  ] };
  const src = { ...deriveSources(a, NOW), spend: { kind: "tool" as const, tool: "budget", at: NOW } };
  const payload = linkPayload({ a, src, pace: "quick" });
  assert.ok(!("bgRows" in payload.a));
  const L = cleanLink(JSON.parse(JSON.stringify(payload)), NOW)!;
  assert.equal(L.pace, "quick");
  assert.deepEqual(L.a.events, a.events);
  assert.deepEqual(L.a.kidsNow, [4, 1]);
  assert.deepEqual(L.src.spend, { kind: "tool", tool: "budget", at: NOW });
  assert.equal(L.a.income, 240000);
  // an event's label is plain text only
  const M = cleanLink({ v: 2, a: { events: [{ kind: "custom", from: 1, delta: 2, label: "<b>x</b>" }, { kind: "nope" }] } }, NOW)!;
  assert.deepEqual(M.a.events, [{ id: "e0", kind: "custom", from: 1, delta: 2 }]);
});

test("anything that isn't a v2 link is turned away, older links included", () => {
  for (const o of [null, { v: 3, a: {} }, { v: 1 }, { v: 1, a: { age: 40 } }, { v: 2, a: "x" }]) assert.equal(cleanLink(o, NOW), null);
});
