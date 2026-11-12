/* Year by year when your partner stops work before you: what you spend
   carries on and saving takes the drop, whatever share of each raise is
   saved; their 401(k) stops, the HSA goes on at the family limit, and the
   IRAs carry on (a spousal IRA counts on your pay). */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { PcInput } from "@/tools/budget/paycheck-math";
import type { Answers } from "@/tools/guide/store";
import type { Flow } from "../flows";
import type { Profile } from "../store";
import { yearlySaving } from "../cover";

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
const run = (keep: number | null, p: PcInput = pi) => {
  // (The paycheck goes in the profile too: yearlySaving caches by profile.)
  const pr = { _pi: p, scenarios: [], state: "TX", yearly: { raise: [0.01, 0.01], keep }, other: [], who: "couple", p2: { by: year0 - 35, retire: 38 } } as unknown as Profile;
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
