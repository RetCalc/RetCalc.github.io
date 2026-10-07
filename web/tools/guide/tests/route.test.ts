/* route.ts: both paces, each when() branch, promotion, switching pace and
   time left (doc 3, Testing: "route.ts: both paces, each when() branch,
   time left"). Run with `npm run test:guide`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { after, before, current, deeper, firstOpen, landing, minutesLeft, numbered, paceMinutes, route, STEPS } from "../route";
import type { Answers, Pace } from "../store";
import { FIXTURES } from "../../../scripts/baseline/guide-fixtures.mjs";

const fixture = (id: string) => structuredClone(FIXTURES.find((f) => f.id === id)!.a) as Answers;
const ids = (a: Answers, pace: Pace, behind = false) => numbered(a, pace, { behind }).map((s) => s.id);
const at = (a: Answers, pace: Pace, cur: string, done: Record<string, boolean> = {}) => ({ a, pace, cur, done });

const QUICK = ["about", "income", "spending", "cash", "debt", "savings", "invested", "retspend", "social", "number", "lasting", "plan"];

test("every step has a chapter, a type, a pace and its minutes", () => {
  assert.equal(new Set(STEPS.map((s) => s.id)).size, STEPS.length);
  for (const s of STEPS) {
    assert.ok(s.chapter >= 0 && s.chapter <= 7, s.id);
    assert.ok(s.minutes > 0, s.id);
    assert.ok(["quick", "full"].includes(s.pace), s.id);
  }
  // Welcome and every card, as far as the chapters rewritten so far go
  assert.equal(STEPS[0].id, "welcome");
});

test("the Quick check walks its own twelve cards, for a plan on track, with the number on card 6", () => {
  assert.deepEqual(ids(fixture("maya-sam"), "quick"), QUICK);
  assert.equal(QUICK.length, 12);
  assert.equal(QUICK.indexOf("savings") + 1, 6);
  assert.equal(route(fixture("maya-sam"), "quick")[0].id, "welcome");
});

test("the Full walkthrough walks every card that applies", () => {
  // retiring at 62: healthcare before 65, no bridge
  assert.deepEqual(ids(fixture("maya-sam"), "full"),
    ["about", "income", "spending", "cash", "debt", "goals", "savings", "invested", "accounts", "changes", "retspend", "social", "number", "lasting", "adjust", "strategy", "health", "optimize", "plan"]);
  // retiring at 55: both
  assert.ok(ids(fixture("early-55"), "full").includes("health"));
  assert.ok(ids(fixture("early-55"), "full").includes("bridge"));
  // retiring at 65 or later: neither
  const d = ids(fixture("dan"), "full");
  assert.ok(!d.includes("health") && !d.includes("bridge"));
  // before the retirement age is known, neither
  assert.ok(!ids({}, "full").includes("health"));
});

test("a plan that falls short brings Adjust your plan into the Quick check", () => {
  assert.deepEqual(ids(fixture("dan"), "quick", true), [...QUICK.slice(0, -1), "adjust", "plan"]);
  assert.deepEqual(ids(fixture("dan"), "quick", false), QUICK);
});

test("deeper cards are listed on the Quick check, not walked", () => {
  const a = fixture("maya-sam");
  const d = STEPS.filter((s) => deeper(s, a, "quick")).map((s) => s.id);
  assert.deepEqual(d, ["goals", "accounts", "changes", "adjust", "strategy", "health", "optimize"]);
  assert.deepEqual(STEPS.filter((s) => deeper(s, a, "full")), []);
});

test("Continue and Back follow the route, from a deeper card too", () => {
  const a = fixture("maya-sam");
  assert.equal(after(at(a, "quick", "debt")).id, "savings");
  assert.equal(after(at(a, "full", "debt")).id, "goals");
  assert.equal(before(at(a, "quick", "savings")).id, "debt");
  // a deeper card opened from the route stays open on the Quick check
  assert.equal(current(at(a, "quick", "goals")).id, "goals");
  assert.equal(after(at(a, "quick", "goals")).id, "savings");
  assert.equal(before(at(a, "quick", "goals")).id, "debt");
  // a card that no longer applies gives way to the next on the route
  assert.equal(current(at({ ...a, retire: 66 }, "full", "health")).id, "optimize");
  assert.equal(current(at(a, "quick", "nonsense")).id, "about");
  // the last card stays the last
  assert.equal(after(at(a, "quick", "plan")).id, "plan");
  assert.equal(before(at(a, "quick", "about")).id, "welcome");
});

test("the first open card skips what's done", () => {
  const a = fixture("maya-sam");
  assert.equal(firstOpen(at(a, "quick", "about", { about: true, income: true })), "spending");
  assert.equal(firstOpen(at(a, "quick", "about", Object.fromEntries(QUICK.map((k) => [k, true])))), "plan");
});

test("time left counts the cards ahead on the pace, and the trips on the full one", () => {
  const a = fixture("maya-sam");
  // the whole Quick check is about ten minutes; the Full walkthrough an hour or more
  assert.ok(paceMinutes(a, "quick") >= 8 && paceMinutes(a, "quick") <= 13, String(paceMinutes(a, "quick")));
  assert.ok(paceMinutes(a, "full") >= 60, String(paceMinutes(a, "full")));
  assert.equal(minutesLeft(at(a, "quick", "about")), paceMinutes(a, "quick"));
  assert.ok(minutesLeft(at(a, "quick", "number")) < minutesLeft(at(a, "quick", "savings")));
  assert.equal(minutesLeft(at(a, "quick", "plan")), 1);
});

test("switching pace keeps your place, or moves to the next card the pace walks", () => {
  const a = fixture("maya-sam");
  assert.equal(landing(at(a, "quick", "debt"), "full"), "debt");
  assert.equal(landing(at(a, "full", "goals"), "quick"), "savings");
  assert.equal(landing(at(a, "full", "strategy"), "quick"), "plan");
  // after finishing the Quick check, the Full walkthrough opens on the first deeper card
  const done = Object.fromEntries(QUICK.map((k) => [k, true]));
  assert.equal(landing({ ...at(a, "quick", "plan", done), finishedAt: "2026-10-07" }, "full"), "goals");
  assert.equal(landing({ ...at(a, "quick", "plan", { ...done, goals: true }) }, "full"), "accounts");
  assert.equal(landing({ ...at(a, "quick", "plan", { ...done, goals: true, accounts: true }) }, "full"), "changes");
  assert.equal(landing({ ...at(a, "quick", "plan", { ...done, goals: true, accounts: true, changes: true }) }, "full"), "adjust");
  assert.equal(landing(at(a, "full", "accounts"), "quick"), "retspend");
});

test("already retired: the route is the Welcome card and the on-ramp, and nothing else", () => {
  const a = { ...fixture("maya-sam"), retired: true };
  assert.deepEqual(route(a, "quick").map((s) => s.id), ["welcome", "retired"]);
  assert.deepEqual(route(a, "full").map((s) => s.id), ["welcome", "retired"]);
  assert.equal(current(at(a, "quick", "plan")).id, "retired");
  // and the on-ramp is on no one else's route
  assert.ok(!route(fixture("maya-sam"), "full").some((s) => s.id === "retired"));
});
