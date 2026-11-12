/* Debts being paid off (debts.ts): when each is paid off, its payments in
   today's dollars year by year, and what they free going to saving in the
   plan's years (cover.ts). */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { PcInput } from "@/tools/budget/paycheck-math";
import type { Answers } from "@/tools/guide/store";
import type { Flow } from "../flows";
import type { Profile } from "../store";
import { yearlySaving } from "../cover";
import { fixedYears, linesOf, payoff, planLines, type DebtLine } from "../debts";

const near = (a: number, b: number, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} is not within ${tol} of ${b}`);
const car: DebtLine = { id: "car", name: "Car loan", kind: "car", balance: 12000, rate: 0.06, pay: 400 };
const card: DebtLine = { id: "card", name: "Visa", kind: "card", balance: 5000, rate: 0.24, pay: 200 };

test("a debt is paid off at its payment, every dollar of it and its interest", () => {
  const P = payoff([car], true);
  // 12,000 at 6% and 400 a month: 33 months.
  assert.equal(P.paid.car, 33);
  near(P.months.reduce((s, v) => s + v, 0), 12000 + P.total, 0.05);
  assert.ok(P.months.slice(0, 32).every((v) => Math.abs(v - 400) < 0.01));
  assert.equal(P.stalled, false);
});

test("rolling a paid-off debt's payment on pays the rest off sooner", () => {
  const roll = payoff([car, card], true), not = payoff([car, card], false);
  assert.ok(roll.paid.card! < not.paid.card! || roll.paid.car! < not.paid.car!);
  assert.ok(roll.total < not.total);
  // Rolled, the payments stay at 600 a month until the last month.
  const last = Math.max(roll.paid.car!, roll.paid.card!);
  assert.ok(roll.months.slice(0, last - 1).every((v) => Math.abs(v - 600) < 0.01));
});

test("a payment under the interest never pays it off, and keeps being paid", () => {
  const P = payoff([{ ...card, pay: 90 }], true);
  assert.equal(P.paid.card, null);
  assert.equal(P.stalled, true);
  assert.equal(P.pool, 90);
});

test("payments in today's dollars: fixed in dollars, gone once paid off, by calendar year", () => {
  // From January: plan year k is months 12k to 12k + 11 from now.
  const F = fixedYears([car], true, { pay: 2000, months: 60 }, 0.03, 0);
  assert.equal(F.today, 2400);
  near(F.realAt(0), 2400);
  // Year 2: the car loan's last 9 full payments and its final one; the mortgage all year; each worth 3% less a year.
  near(F.realAt(2), (2000 + (400 * 9 + P33(car)) / 12) / 1.03 ** 2, 0.5);
  // The mortgage's last payment is month 60, in year 5; nothing after.
  near(F.realAt(5), 2000 / 12 / 1.03 ** 5, 0.5);
  assert.equal(F.realAt(6), 0);
  assert.deepEqual(F.paidOff, [{ k: 2, name: "Car loan" }, { k: 5, name: "Mortgage" }]);
  // From November, this year is November and December: paid off in month 2 (January) is next year.
  const N = fixedYears([{ ...car, balance: 700 }], true, null, 0.03, 10);
  assert.deepEqual(N.paidOff, [{ k: 1, name: "Car loan" }]);
  near(N.realAt(0), 400);
});
const P33 = (l: DebtLine) => payoff([l], true).months[32];

test("the plan's lines: no card paid in full, no car loan the next one replaces", () => {
  const debts = [
    { id: "a", name: "Visa", kind: "card" as const, pay: 0, full: true, balance: 900, rate: 0.2 },
    { id: "b", name: "Car", kind: "car" as const, pay: 400, replace: true, balance: 9000, rate: 0.05 },
    { id: "c", name: "Student loan", kind: "student" as const, pay: 300, balance: 20000, rate: 0.05 },
  ];
  assert.deepEqual(linesOf(debts).map((l) => l.id), ["c"]);
  const pr = { debtPlan: { roll: true, debts } } as unknown as Profile;
  const entries = [{ date: "2026-01-01", from: "accounts" as const, items: debts.map((d) => ({ id: d.id, side: "debt" as const, kind: d.kind, name: d.name, value: d.balance, rate: d.rate })) }];
  assert.deepEqual(planLines(pr, entries).map((l) => l.id), ["c"]);
  // Paid off (no balance left on the latest entry): out of the plan.
  entries[0].items[2].value = 0;
  assert.deepEqual(planLines(pr, entries), []);
});

// Year by year: what's freed goes to saving, spending stays where it was.
const match = (0.06 * 120000) / 12;
const pi: PcInput = {
  gross: 120000, gross2: 0, two: false, p: 26, pays: [26, 26], status: "s", state: "TX",
  health: [0, 0], match: [{ rate: 50, upTo: 6 }, { rate: 0, upTo: 0 }], hsa: "self", ages: [40, null], efCap: 0, efOn: false,
  roth: { match: false, k401max: false, rothIra: true }, spendYear: 0, order: ["match", "hsa", "ef", "rothIra", "k401max", "brok"],
  amounts: { match: (match * 12) / 26, hsa: 0, ef: 0, rothIra: 0, k401max: 0, brok: 0 },
};
const years = (freed: number[] | null) => {
  const pr = { scenarios: [], state: "TX", yearly: { raise: [0, 0], keep: 0 }, other: [], who: "single", p2: {} } as unknown as Profile;
  return yearlySaving(pr, { pi, ef: 0 } as unknown as Flow, { age: 40, retire: 45, ...(freed ? { debtFreed: freed, paidOff: [{ k: 2, name: "Car loan" }] } : {}) } as unknown as Answers).years;
};

test("what paid-off debts free goes to saving, in the paycheck's order", () => {
  const base = years(null), Y = years([0, 0, 400, 400, 400]);
  const saved = (y: (typeof Y)[number]) => y.saved.trad + y.saved.roth + y.saved.hsa + y.saved.brok;
  assert.ok(Math.abs(saved(Y[1]) - saved(base[1])) < 0.5);
  // From the year it's paid off, saving is up by what was paid (a pre-tax
  // dollar saves some tax, which the plan spends as the rule says: here none of it).
  assert.ok(saved(Y[2]) - saved(base[2]) >= 399.5, `${saved(Y[2]) - saved(base[2])}`);
  assert.ok(Y[2].spending <= base[2].spending + 0.5 && Y[2].spending >= base[2].spending - 400.5);
  // Only lines already in use take it: the match line is full, so the brokerage.
  near(Y[2].saved.trad, base[2].saved.trad, 0.5);
  near(Y[2].saved.brok - base[2].saved.brok, 400, 0.5);
  near(base[2].spending - Y[2].spending, 400, 0.5);
  assert.deepEqual(Y[2].paidOff, ["Car loan"]);
  assert.deepEqual(Y[1].paidOff, []);
});

test("payments still made once retired: fixed expenses in the Drawdown, a stretch at each amount", async () => {
  const { loanItems } = await import("../debts");
  // 2,400 a year in today's dollars at retirement, worth 3% less each year, for 3 years; then nothing.
  const extra = [2400, 2400 / 1.03, 2400 / 1.03 ** 2, 0, 0];
  assert.deepEqual(loanItems(extra, 0.03, 30, " (plan)"), [{ name: "Loan payments (plan)", annual: 2400, inflate: false, startYear: 1, duration: { type: "years", years: 3 } }]);
  // A second loan ending a year in: two stretches.
  assert.deepEqual(loanItems([3600, 2400 / 1.03, 0], 0.03, 30, "").map((x) => [x.annual, x.startYear, x.duration]), [[3600, 1, { type: "years", years: 1 }], [2400, 2, { type: "years", years: 1 }]]);
});
