/* migrate.ts: a v1 saved guide and a v1 link open as v2 with every answer
   and a source for each (doc 3, "Migration"; the unit tests listed under
   "Testing"). Run with `npm run test:guide`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanLink, deriveSources, doneFromV1, fromV1, linkPayload, loadState, mapStep, normalizeV2 } from "../migrate";
import type { Answers, GuideStateV2 } from "../store";
import { FIXTURES } from "../../../scripts/baseline/guide-fixtures.mjs";

const NOW = "2026-10-07T12:00:00.000Z";
const fixture = (id: string): Answers => structuredClone(FIXTURES.find((f) => f.id === id)!.a) as Answers;

/* Maya and Sam's guide as v1 saved it after two trips: a budget brought
   back from Budget and debts listed in Debt Payoff, an Income Tax trip, a
   Social Security statement, and one field from before income tax was built
   in. Stopped on Your projection with Adjust your plan's note pending. */
function v1State() {
  const a: Record<string, unknown> = {
    ...fixture("maya-sam"), thKnow: "no", txPre: 0, spendSrc: "budget", bgSave: 900, bgMort: 1700, bgHousing: 2100,
    bgRows: [{ desc: "Rent / Mortgage", amount: "1,700", freq: 12 }],
    debtSrc: "tool", debtMin: 450, debtN: 2, debtTop: 0.24, debtExtra: 200, debtMonths: 31,
    debtRows: [{ desc: "Card", balance: "9,000", apr: "24", min: "250" }, { desc: "Car", balance: "9,000", apr: "5", min: "200" }],
    ssOwn: 3200, brRothNow: 99999, retTaxAdded: true, retTax: 5000,
  };
  a.retSpend = 75000; // includes the old hand-added tax estimate
  return {
    v: 1, cur: "outlook", a,
    done: { about: true, income: true, takehome: true, spending: true, cash: true, debt: true, home: true, college: true, savings: true, retspend: true },
    trip: null, back: { step: "tune", msg: "Applied.", undo: { retire: 62 } }, coachMin: true,
  };
}

test("a v1 state opens as v2 with every answer", () => {
  const v1 = v1State(), g = fromV1(v1, NOW)!;
  assert.equal(g.v, 2);
  assert.equal(g.pace, "full");
  assert.equal(g.cur, "number");
  assert.deepEqual(g.back, { step: "adjust", msg: "Applied.", undo: { retire: 62 } });
  assert.equal(g.coachMin, true);
  assert.deepEqual(g.snapshots, []);
  assert.deepEqual(g.moves, {});
  assert.deepEqual(g.lessons, {});
  assert.equal(g.startedAt, NOW);
  // v1's own fixes ran: the Roth balance was already there, so the old
  // field is dropped; the hand-added tax comes off retirement spending.
  assert.equal(g.a.rothNow, 40000);
  assert.equal(g.a.retSpend, 70000);
  assert.ok(!("brRothNow" in g.a) && !("retTax" in g.a) && !("retTaxAdded" in g.a));
  // every other answer is carried over untouched
  for (const [k, v] of Object.entries(v1.a)) {
    if (["brRothNow", "retTax", "retTaxAdded", "retSpend"].includes(k)) continue;
    assert.deepEqual((g.a as Record<string, unknown>)[k], v, k);
  }
  // the v1 object itself is left as it was (it stays under its own key)
  assert.equal(v1.a.retSpend, 75000);
});

test("sources come from what the old trips left behind", () => {
  const g = fromV1(v1State(), NOW)!, s = g.src;
  for (const k of ["spend", "bgSave", "bgMort", "bgHousing"] as const) assert.deepEqual(s[k], { kind: "tool", tool: "budget", at: NOW }, k);
  for (const k of ["debtTotal", "debtHi", "debtMin", "debtN", "debtTop", "debtExtra", "debtMonths"] as const) assert.deepEqual(s[k], { kind: "tool", tool: "debt", at: NOW }, k);
  assert.deepEqual(s.takehome, { kind: "tool", tool: "tax", at: NOW });
  assert.deepEqual(s.ssOwn, { kind: "entered", at: NOW });
  for (const k of ["age", "spouseAge", "retire", "income", "income2", "cash", "saved", "contrib", "employer", "risk", "retSpend"] as const)
    assert.deepEqual(s[k], { kind: "entered", at: NOW }, k);
  // bookkeeping carries no source
  for (const k of ["thKnow", "spendSrc", "debtSrc", "bgRows", "debtRows"] as const) assert.equal(s[k], undefined, k);
});

test("take-home from the quick estimate is marked estimated", () => {
  const a = { ...fixture("renter-29") }; // thKnow "no", no Income Tax trip
  assert.deepEqual(deriveSources(a, NOW).takehome, { kind: "estimated", at: NOW });
  const b = { ...fixture("maya-sam") }; // thKnow "yes": typed
  assert.deepEqual(deriveSources(b, NOW).takehome, { kind: "entered", at: NOW });
});

test("the other trips' figures are marked with their tool", () => {
  const a: Answers = { ...fixture("early-55"), moState: { price: "1" }, housePay: 2400, mortPI: 1800, clState: { kids: [] }, college: "yes", collegeMo: 350,
    bridge: "Roth ladder", bridgeHold: 92, bridgeLeft: 400000, hcSeen: true, hcPrem: 610, fiAge: "53", fiLabel: "FIRE age" };
  const s = deriveSources(a, NOW);
  assert.equal(s.housePay?.tool, "mortgage"); assert.equal(s.mortPI?.tool, "mortgage");
  assert.equal(s.collegeMo?.tool, "college");
  assert.equal(s.bridge?.tool, "bridge"); assert.equal(s.bridgeHold?.tool, "bridge");
  assert.equal(s.hcPrem?.tool, "healthcare");
  assert.equal(s.fiAge?.tool, "fire");
  assert.equal(s.college?.kind, "entered");
});

test("old step ids map onto the new cards", () => {
  const want: Record<string, string> = { retspend: "retspend", outlook: "number", lasting: "lasting", tune: "adjust", results: "plan",
    home: "goals", college: "goals", takehome: "income", intro: "welcome", fire: "adjust" };
  for (const [from, to] of Object.entries(want)) assert.equal(mapStep(from), to, from);
  assert.equal(mapStep("savings"), "savings");
  const g = fromV1({ ...v1State(), cur: "fire", trip: { id: "budget", from: "spending" } }, NOW)!;
  assert.equal(g.cur, "adjust");
  assert.equal(g.trip!.from, "spending");
  // v1 dropped a note left on the old Retiring early step
  assert.equal(fromV1({ ...v1State(), back: { step: "fire", msg: "x" } }, NOW)!.back, null);
});

test("a card is done when every v1 step it took over was", () => {
  assert.deepEqual(doneFromV1({ income: true }), {});
  assert.deepEqual(doneFromV1({ income: true, takehome: true }), { income: true });
  assert.deepEqual(doneFromV1({ home: true }), {});
  assert.deepEqual(doneFromV1({ home: true, college: true, savings: true, retspend: true, outlook: true, tune: true }),
    { goals: true, savings: true, invested: true, accounts: true, retspend: true, social: true, number: true, adjust: true });
});

test("anything that isn't a v1 state is turned away", () => {
  for (const o of [null, 1, "x", [], {}, { v: 2, a: {} }, { v: 1 }, { v: 1, a: [] }]) assert.equal(fromV1(o, NOW), null);
});

test("loading prefers v2, falls back to v1, else a first visit", () => {
  const v2: GuideStateV2 = { ...fromV1(v1State(), NOW)!, pace: "quick", cur: "cash" };
  assert.equal(loadState(v2, v1State(), NOW)!.cur, "cash");
  assert.equal(loadState(null, v1State(), NOW)!.cur, "number");
  assert.equal(loadState(null, null, NOW), null);
  assert.equal(loadState({ v: 3 }, null, NOW), null);
});

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

test("a v1 link opens with sources and the full pace", () => {
  const a = { ...fixture("dan"), brBrokNow: 5000, evil: "<script>", "bad key": 1, retSpend: 52000 };
  const L = cleanLink({ v: 1, a }, NOW)!;
  assert.equal(L.pace, "full");
  assert.equal(L.a.brokNow, 5000);
  assert.ok(!("evil" in L.a) && !("bad key" in L.a) && !("brBrokNow" in L.a));
  assert.equal(L.a.retSpend, 52000);
  assert.deepEqual(L.src.saved, { kind: "entered", at: NOW });
  assert.deepEqual(L.src.takehome, { kind: "entered", at: NOW });
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

test("anything that isn't a link is turned away", () => {
  for (const o of [null, { v: 3, a: {} }, { v: 1 }, { v: 2, a: "x" }]) assert.equal(cleanLink(o, NOW), null);
});
