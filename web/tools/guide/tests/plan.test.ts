/* The score's three corrections (doc 3, section 3, item 7) and the plan
   card's lists (doc 2, "The plan and the hand-off"; doc 3, items 10 and
   11): an answer the score can't use keeps its area at no points; what's
   going well never names an area a move is working on; each area says
   what it still has to give; the moves, the toolkit and what moved since
   the last snapshot. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parts, score, sim, withGuess } from "../calc";
import { factsHere, moves, planLists, toolkit, wins } from "../moves";
import { headroom } from "../score";
import { keep, snapshotOf, whatMoved, SNAPSHOT_CAP } from "../snapshot";
import { freshGuide, type Answers } from "../store";
import { FIXTURES } from "../../../scripts/baseline/guide-fixtures.mjs";

const fixture = (id: string) => structuredClone(FIXTURES.find((f) => f.id === id)!.a) as Answers;
const ALL = { retire: true, save: true, spend: true };

test("correction 1: an answer the score can't use keeps its area, at no points", () => {
  const a = fixture("maya-sam");
  // spending of $0: the emergency fund and cash flow stay in, at 0, pointing at the card
  const z = parts({ ...a, spend: 0 }, null);
  assert.deepEqual([z.cushion?.p, z.cushion?.bad, z.flow?.p, z.flow?.bad], [0, "spending", 0, "spending"]);
  // take-home of $0 with an income
  assert.equal(parts({ ...a, takehome: 0 }, null).flow?.bad, "income");
  // a retirement age before today's: the outlook stays in at 0 rather than lifting the score
  const r = score({ ...a, retire: 30 }, null);
  assert.equal(r.P.outlook?.bad, "about");
  assert.equal(r.n, 5);
  assert.ok(r.score! < score(a).score!);
  // not working: no income and no take-home leave cash flow unanswered, not scored (doc 2's edge case)
  assert.equal(parts({ ...a, income: 0, income2: 0, takehome: 0 }, null).flow, undefined);
  // the fixtures have nothing invalid, so their scores are as recorded (guide.mjs check)
  assert.equal(score(a).score, 89);
});

test("correction 3: each area says what it still has to give", () => {
  const a = fixture("maya-sam"), P = parts(a);
  assert.deepEqual(headroom("cushion", P.cushion, a), { pts: 8, line: "3 months earns 11; 6 months earns 15" });
  assert.deepEqual(headroom("debt", P.debt, a), { pts: 3, line: "Paying off the $9,000 at 8% or more earns 15" });
  assert.equal(headroom("outlook", P.outlook, a), null);
  const d = fixture("dan"), Q = parts(d);
  assert.equal(headroom("outlook", Q.outlook, d)!.line, "Lasting in 85% of history earns 34; 95% earns 40");
  assert.match(headroom("rate", Q.rate, d)!.line, /^All of your employer's match earns \d+; 15% of income earns 20$/);
});

test("Maya and Sam: the emergency fund, the 8% debt, then what the surplus could buy", () => {
  const a = fixture("maya-sam"), F = factsHere(a, ALL), L = moves(a, F);
  assert.deepEqual(L.slice(0, 3).map((m) => m.id), ["cushion", "debt", "surplus"]);
  assert.ok(L.length <= 6);
  assert.equal(L[0].t, "Grow your emergency fund to $21,000");
  assert.equal(L[0].pts, 8);
  // the toolkit: the tools tied to the moves, and the Drawdown Simulator always (doc 2)
  assert.deepEqual(toolkit(a, {}, F, L).map((k) => k.id).sort(), ["debt", "drawdown", "healthcare", "optimizer"]);
});

test("Dan, behind: the gap comes first", () => {
  const a = fixture("dan"), L = moves(a, factsHere(a, ALL));
  assert.equal(L[0].id, "gap");
  assert.match(L[0].d, /save <b>\$[\d,]+ a month more<\/b>/);
  assert.ok(L.some((m) => m.id === "match") && L.some((m) => m.id === "starter") && L.some((m) => m.id === "debt"));
});

test("correction 2: what's going well never names an area a move is working on", () => {
  // a little debt at 8%+: the debt area is above 90%, and there's a move for it
  const a = { ...fixture("maya-sam"), debtTotal: 1000, debtHi: 1000 }, F = factsHere(a, ALL), L = moves(a, F), P = parts(a, F.S);
  assert.ok(P.debt!.p >= 0.9);
  assert.ok(L.some((m) => m.area === "debt"));
  assert.ok(!wins(P, L).some((f) => f.id === "debt"));
  assert.ok(wins(P, L).some((f) => f.id === "outlook"));
});

test("snapshots keep 24, and what moved is only what changed", () => {
  const g = freshGuide(), a = fixture("maya-sam");
  g.a = a;
  const S = sim(withGuess(a))!, L = planLists(a, {}, factsHere(a, ALL));
  const s1 = snapshotOf(g, S, 567000, L.R, L.list.map((m) => m.id), "2026-10-01T00:00:00.000Z");
  assert.deepEqual([s1.score, s1.fv, s1.need, s1.areas.cushion], [89, 1518176, 567000, 7]);
  const b = { ...a, cash: 21000 }, T = sim(b)!, M = planLists(b, {}, factsHere(b, ALL));
  const s2 = snapshotOf(g, T, 567000, M.R, M.list.map((m) => m.id), "2026-10-07T00:00:00.000Z");
  const moved = whatMoved(s1, s2);
  assert.deepEqual(moved.map((m) => [m.label, m.d]), [["Readiness score", s2.score! - 89], ["Emergency fund", 4]]);
  for (let i = 0; i < 30; i++) keep(g, s1);
  assert.equal(g.snapshots.length, SNAPSHOT_CAP);
});
