/* The Calculator's scenarios (scenarios.ts): what each kind does to a
   year's saving and return, the words for it, and reading saved ones. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { lumpAccount, newScenario, nominalAt, ownOn, payAt, readScenarios, scenarioSentence, spanOf, withoutOwn, yearChange, type Scenario } from "../scenarios";

const sc = (over: Partial<Scenario>): Scenario => ({ ...newScenario("x", "saving", 34, 0.075), from: 40, until: 0, mode: "amount", amount: 0, ramp: 0, acct: "auto", ...over });

test("a dollar change runs from its age to retirement, out of brokerage first", () => {
  const s = sc({ amount: -900 });
  assert.equal(yearChange([s], 39, 65, 4000).cut, 0);
  const y = yearChange([s], 40, 65, 4000);
  assert.equal(y.cut, 900);
  assert.deepEqual(y.typed, {});
  assert.deepEqual(y.tags, ["x"]);
  assert.equal(yearChange([s], 64, 65, 4000).cut, 900);
  assert.deepEqual(spanOf(s, 65), [40, 65]);
});

test("saving more goes into the account named; a cut names its account for the cover", () => {
  const more = sc({ amount: 600, acct: "roth" });
  assert.equal(yearChange([more], 45, 65, 4000).add.roth, 600);
  const less = sc({ amount: -300, acct: "trad" });
  const y = yearChange([less], 45, 65, 4000);
  assert.equal(y.cut, 300);
  assert.deepEqual(y.typed, { trad: 300 });
});

test("until an age stops it there; phased in, it climbs over its years", () => {
  const s = sc({ amount: -900, until: 50, ramp: 3 });
  assert.equal(yearChange([s], 40, 65, 4000).cut, 300);
  assert.equal(yearChange([s], 41, 65, 4000).cut, 600);
  assert.equal(yearChange([s], 42, 65, 4000).cut, 900);
  assert.equal(yearChange([s], 49, 65, 4000).cut, 900);
  assert.equal(yearChange([s], 50, 65, 4000).cut, 0);
  assert.deepEqual(spanOf(s, 65), [40, 50]);
});

test("a share works on the saving then; a share each year compounds", () => {
  assert.equal(yearChange([sc({ mode: "pct", amount: -10 })], 40, 65, 4000).cut, 400);
  const yearly = sc({ mode: "pctYearly", amount: -10, from: 55 });
  assert.equal(yearChange([yearly], 55, 65, 4000).cut, 400);
  assert.equal(yearChange([yearly], 56, 65, 4000).cut, Math.round(4000 * (1 - 0.81)));
});

test("later scenarios build on earlier ones", () => {
  const raise = sc({ id: "a", amount: 1000 }), ease = sc({ id: "b", mode: "pct", amount: -10 });
  const y = yearChange([raise, ease], 45, 65, 4000);
  assert.equal(y.add.brok, 1000);
  assert.equal(y.cut, 500);
  assert.deepEqual(y.tags, ["a", "b"]);
  // Off, a scenario does nothing.
  assert.equal(yearChange([{ ...raise, on: false }, ease], 45, 65, 4000).cut, 400);
});

test("a lump sum is the Calculator's own: it never touches the year's saving", () => {
  const s = { ...newScenario("l", "lump", 34, 0.075), from: 45, amount: 60000, acct: "roth" as const };
  assert.equal(yearChange([s], 45, 65, 4000).add.roth, 0);
  assert.deepEqual(yearChange([s], 45, 65, 4000).tags, []);
  assert.deepEqual(spanOf(s, 65), [45, 46]);
  assert.equal(lumpAccount(s), "r");
  assert.equal(lumpAccount({ ...s, acct: "auto" }), "b");
  assert.ok(ownOn([s]));
  assert.deepEqual(withoutOwn([s, sc({ id: "a" })]).map((x) => x.id), ["a"]);
});

test("a return steps or climbs from its age", () => {
  const step = { ...newScenario("r", "returns", 34, 0.075), from: 44, nominal: 0.09, ramp: 0 };
  assert.equal(nominalAt([step], 43, 0.075).nominal, 0.075);
  assert.equal(nominalAt([step], 44, 0.075).nominal, 0.09);
  const climb = { ...step, ramp: 10 };
  assert.ok(Math.abs(nominalAt([climb], 44, 0.075).nominal - 0.0765) < 1e-9);
  assert.ok(Math.abs(nominalAt([climb], 53, 0.075).nominal - 0.09) < 1e-9);
  assert.equal(nominalAt([climb], 60, 0.075).nominal, 0.09);
  // A return scenario never changes saving.
  assert.equal(yearChange([climb], 50, 65, 4000).cut, 0);
});

test("each scenario is one sentence", () => {
  assert.equal(scenarioSentence(sc({ amount: -900 }), 65, 0.075), "Save $900 per month less from 40 to retirement, out of brokerage first.");
  assert.equal(scenarioSentence(sc({ amount: 600, acct: "roth", until: 50, ramp: 3 }), 65, 0.075), "Save $600 per month more from 40 until 50, phased in over 3 years, into Roth.");
  assert.equal(scenarioSentence(sc({ mode: "pctYearly", amount: -10, from: 55 }), 65, 0.075), "Save 10% less each year from 55 to retirement, compounding (10% less than the year before, every year), out of brokerage first.");
  assert.equal(scenarioSentence({ ...newScenario("r", "returns", 34, 0.075), from: 44, nominal: 0.09, ramp: 10 }, 65, 0.075), "Returns climb from 7.5% to 9% over 10 years from 44, before inflation.");
  assert.equal(scenarioSentence({ ...newScenario("l", "lump", 34, 0.075), from: 45, amount: 50000, acct: "brok" }, 65, 0.075), "$50,000 put into brokerage on the day you turn 45.");
});

test("saved scenarios are read back, unsound ones dropped", () => {
  const list = readScenarios([
    { id: "a", kind: "saving", name: "A raise", on: true, from: 38, until: 0, mode: "amount", amount: 600, ramp: 0, acct: "roth", nominal: 0 },
    { id: "k", kind: "children", on: false },
    { id: "z", kind: "nothing" },
    "junk",
    { id: "a", kind: "lump", amount: 5 },
  ]);
  assert.equal(list.length, 2);
  assert.equal(list[0].acct, "roth");
  assert.equal(list[1].id, "children");
  assert.equal(list[1].on, false);
  assert.deepEqual(readScenarios(null), []);
});

test("stopping saving takes all of it, whatever other changes add, before or after it", () => {
  const raise = sc({ id: "r", amount: 6000, from: 41 }), stop = sc({ id: "c", mode: "pct", amount: -100, from: 45 });
  for (const list of [[raise, stop], [stop, raise]]) {
    assert.equal(yearChange(list, 44, 65, 4000).add.brok, 6000);
    const y = yearChange(list, 45, 65, 4000);
    assert.equal(y.cut, 4000);
    assert.deepEqual(y.add, { brok: 0, roth: 0, trad: 0, hsa: 0 });
    assert.ok(y.tags.includes("c"));
  }
  assert.equal(scenarioSentence(stop, 65, 0.07), "Stop saving from 45 to retirement: nothing more goes in, the employer match included.");
});

test("spending more is saving less, dollar for dollar; spending less adds to saving", () => {
  const more = sc({ kind: "spending", amount: 800 });
  assert.equal(yearChange([more], 45, 65, 4000).cut, 800);
  const less = sc({ kind: "spending", amount: -300, acct: "roth" });
  const y = yearChange([less], 45, 65, 4000);
  assert.equal(y.cut, 0);
  assert.equal(y.add.roth, 300);
  assert.match(scenarioSentence(more, 65, 0.075), /^Spend \$800 per month more from 40 to retirement/);
});

test("a pay change sets one person's pay, or moves it by a share, while it runs", () => {
  const set = sc({ kind: "income", who: 1, mode: "amount", amount: 90000, until: 50 });
  assert.equal(payAt([set], 1, 39, 65, 80000, 0.02).pay, 80000);
  assert.equal(payAt([set], 0, 45, 65, 120000, 0.02).pay, 120000);
  // Raises carry on from the new figure.
  assert.equal(Math.round(payAt([set], 1, 42, 65, 85000, 0.02).pay), Math.round(90000 * 1.02 * 1.02));
  assert.equal(payAt([set], 1, 50, 65, 85000, 0.02).pay, 85000);
  const half = sc({ kind: "income", mode: "pct", amount: -50 });
  assert.equal(payAt([half], 0, 41, 65, 100000, 0).pay, 50000);
  assert.deepEqual(payAt([half], 0, 41, 65, 100000, 0).tags, ["x"]);
  assert.match(scenarioSentence(set, 65, 0.075, { names: ["Sam", "Jordan"] }), /^Jordan's pay becomes \$90,000 per year from when you're 40 until when you're 50/);
});

test("new kinds read back, with whose pay a change is", () => {
  const back = readScenarios([{ id: "a", kind: "income", who: 1, mode: "pctYearly", amount: 5 }, { id: "b", kind: "spending", mode: "pct", amount: 200 }, { id: "c", kind: "nope" }]);
  assert.deepEqual(back.map((s) => [s.kind, s.who, s.mode]), [["income", 1, "pct"], ["spending", 0, "amount"]]);
});
