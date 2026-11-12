/* Year by year when pay changes other than by a raise (your partner stops
   work before you, or a pay change cuts it): what you spend carries on and
   saving takes the difference, whatever share of each raise is saved. Each
   limit follows the pay under it: at no pay your partner's 401(k) stops,
   the HSA goes on at the family limit, and the IRAs carry on (a spousal IRA
   counts on your pay). */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { PcInput } from "@/tools/budget/paycheck-math";
import type { Answers } from "@/tools/guide/store";
import type { Flow } from "../flows";
import type { Profile } from "../store";
import { yearlySaving } from "../cover";
import { newScenario, type Scenario } from "../scenarios";

const year0 = new Date().getFullYear();
const match = (0.06 * 300000 + 0.06 * 100000) / 12;
// Both of you maxing the 401(k), a family HSA and two IRAs, and more in the brokerage.
const pi: PcInput = {
  gross: 300000, gross2: 100000, two: true, p: 12, pays: [26, 26], status: "m", state: "TX",
  health: [0, 0], match: [{ rate: 50, upTo: 6 }, { rate: 50, upTo: 6 }], hsa: "family", ages: [35, 35], efCap: 0, efOn: false,
  roth: { match: false, k401max: false, rothIra: true }, spendYear: 0, order: ["match", "hsa", "ef", "rothIra", "k401max", "brok"],
  amounts: { match, hsa: 8750 / 12, ef: 0, rothIra: 14000 / 12, k401max: 47000 / 12 - match, brok: 5000 },
};
// Your partner stops at 38, three years from now; you work to 42.
const run = (keep: number | null, p: PcInput = pi, scenarios: Scenario[] = [], retire2: number | null = 38) => {
  // (The paycheck goes in the profile too: yearlySaving caches by profile.)
  const pr = { _pi: p, scenarios, state: "TX", yearly: { raise: [0.01, 0.01], keep }, other: [], who: "couple", p2: { by: year0 - 35, retire: retire2 } } as unknown as Profile;
  return yearlySaving(pr, { pi: p, ef: 0 } as unknown as Flow, { age: 35, retire: 42 } as unknown as Answers).years;
};
const yr = (n: number) => Math.round(n * 12);

for (const keep of [null, 0, 0.25, 0.5, 1]) {
  test(`spending carries on when your partner stops (saving ${keep ?? "the same share"} of raises)`, () => {
    const Y = run(keep), before = Y[2], after = Y[3];
    assert.equal(after.works[1], false);
    // The year they stop spends what it would have with them working:
    // within the one year's raise of the year before, never a drop.
    assert.ok(after.spending >= before.spending - 1, `${yr(before.spending)} -> ${yr(after.spending)}`);
    assert.ok(after.spending <= before.spending * 1.02, `${yr(before.spending)} -> ${yr(after.spending)}`);
    // And on from there, spending follows the raises as before.
    for (let i = 4; i < Y.length; i++) assert.ok(Y[i].spending >= Y[i - 1].spending - 1);
  });
}

test("your partner's 401(k) stops; the HSA and both IRAs carry on, the brokerage gives way", () => {
  const after = run(0.5)[3];
  assert.equal(yr(after.saved.trad), 24500); // one person's 401(k) (2026)
  assert.equal(yr(after.saved.hsa), 8750); // the family limit
  assert.equal(yr(after.saved.roth), 14000); // both IRAs, as today
  assert.ok(after.saved.brok > 0);
});

test("two self-only HSAs become one family one", () => {
  const p = { ...pi, hsa: "self2" as const, amounts: { ...pi.amounts, hsa: 8800 / 12 } };
  assert.equal(yr(run(1, p)[3].saved.hsa), 8750);
});

test("saving no more than the lost pay allows: spending gives way only past it", () => {
  const p = { ...pi, gross: 150000, gross2: 150000, amounts: { ...pi.amounts, brok: 0 } };
  const Y = run(0.5, p);
  assert.ok(Y[3].spending < Y[2].spending);
  assert.equal(Math.round(Y[3].saved.brok + Y[3].saved.roth + Y[3].saved.trad + Y[3].saved.hsa), 0);
});

// A pay change for your partner: by a share from 38 (until 40 when given).
const cut = (amount: number, until = 0): Scenario => ({ ...newScenario("cut", "income", 35, 0.075), who: 1, from: 38, until, mode: "pct", amount, ramp: 0 });
const totalOf = (y: { saved: Record<string, number> }) => Object.values(y.saved).reduce((a, b) => a + b, 0);

test("a 100% pay cut is the same as stopping work", () => {
  for (const keep of [null, 0, 0.5, 1]) {
    const stop = run(keep), off = run(keep, pi, [cut(-100)], null);
    for (const i of [3, 5]) {
      assert.ok(Math.abs(stop[i].spending - off[i].spending) < 1, `${keep} ${i}: ${yr(stop[i].spending)} vs ${yr(off[i].spending)}`);
      assert.deepEqual(Object.values(off[i].saved).map(yr), Object.values(stop[i].saved).map(yr));
    }
  }
});

test("a pay cut keeps spending; saving takes it, the 401(k) held to the pay", () => {
  // Down 90%: your partner earns $10,100, so their 401(k) can take no more than that.
  const Y = run(0.5, pi, [cut(-90)], null), before = Y[2], after = Y[3];
  assert.ok(after.spending >= before.spending - 1 && after.spending <= before.spending * 1.02, `${yr(before.spending)} -> ${yr(after.spending)}`);
  assert.ok(Math.abs(yr(after.saved.trad) - (24500 + yr(after.pay[1]))) <= 1, `${yr(after.saved.trad)}`);
  assert.equal(yr(after.saved.roth), 14000);
  assert.ok(totalOf(after) < totalOf(before));
});

test("pay that comes back brings saving back, and spending carries on", () => {
  for (const keep of [null, 0.5]) {
    const Y = run(keep, pi, [cut(-100, 40)], null);
    // Back at 40: saving is about where it was, spending carried on throughout.
    for (let i = 3; i < Y.length; i++) assert.ok(Y[i].spending >= Y[i - 1].spending - 1 && Y[i].spending <= Y[i - 1].spending * 1.02, `${keep} ${i}`);
    assert.ok(Math.abs(totalOf(Y[5]) - totalOf(Y[2])) / totalOf(Y[2]) < 0.05, `${yr(totalOf(Y[2]))} -> ${yr(totalOf(Y[5]))}`);
  }
});

test("a cut deeper than the saving: spending gives way, and comes back with the pay", () => {
  const p = { ...pi, gross: 150000, gross2: 150000, amounts: { ...pi.amounts, brok: 0 } };
  const Y = run(0.5, p, [cut(-100, 40)], null);
  assert.ok(Y[3].spending < Y[2].spending);
  assert.ok(Math.abs(Y[5].spending - Y[2].spending) / Y[2].spending < 0.03, `${yr(Y[2].spending)} -> ${yr(Y[5].spending)}`);
});
