/* The Budget's Paycheck tab: the paycheck adds up, the budget comes across
   without what the tab plans itself, pre-tax lines cost the deposit less
   than they put away, and Fill assigns every cent in order without going
   over. Run with `npm run test:budget`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { yearData } from "@/lib/engine/typed";
import { BUDGET_DEFAULTS, budgetCompute, dropPlanned, type BudgetInputs } from "../model";
import { PC_STEPS, PC_ZERO, paycheckFill, paycheckInput, paycheckRun, pcCap, pcCostPer, pcOrder, rowRole, type PcStep } from "../paycheck-math";

const L = yearData().limits;
/** A budget like the mock's: $95,000, every two weeks, Illinois. */
function budget(patch: Partial<BudgetInputs> = {}): BudgetInputs {
  const set: Record<string, [string, number]> = {
    "Rent / Mortgage": ["1,650", 12], "Utilities": ["165", 12], "Health insurance": ["184", 12], "Groceries": ["560", 12],
    "Travel": ["2,400", 1], "Savings & investments": ["500", 12], "Other debt payments": ["150", 12],
  };
  const rows = BUDGET_DEFAULTS.rows.map((r) => (set[r.desc] ? { ...r, amount: set[r.desc][0], freq: set[r.desc][1] } : r));
  // A saving line as a budget saved before the Paycheck tab still has it.
  rows.push({ group: "Saving & debt", desc: "Savings & investments", amount: "500", freq: 12, custom: false });
  return { ...BUDGET_DEFAULTS, rows, pcGross: "95,000", pcState: "IL", ...patch };
}
const near = (a: number, b: number, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} is not within ${tol} of ${b}`);

test("a saving line from before the Paycheck tab is dropped, and never counted", () => {
  const b = budget();
  assert.ok(b.rows.some((r) => r.desc === "Savings & investments"));
  assert.ok(!dropPlanned(b).rows.some((r) => r.desc === "Savings & investments"));
  near(budgetCompute(b).totalYr, budgetCompute(dropPlanned(b)).totalYr);
  assert.ok(!BUDGET_DEFAULTS.rows.some((r) => r.desc === "Savings & investments"));
});

test("the budget comes across without the saving row, and health premiums move above the taxes", () => {
  const b = budget();
  const roles = Object.fromEntries(b.rows.map((r, i) => [r.desc, rowRole(b, r, i)]));
  assert.equal(roles["Savings & investments"], "save");
  assert.equal(roles["Health insurance"], "work");
  assert.equal(roles["Other debt payments"], "count");
  const pi = paycheckInput(b, "TX");
  near(pi.spendYear, (1650 + 165 + 560 + 150) * 12 + 2400);
  near(pi.health, (184 * 12) / 26);
  assert.equal(pi.state, "IL");
  // Premiums set to 0 (not through work): the row stays in the budget and nothing comes out before tax.
  const off = paycheckInput(budget({ pcHealth: "0" }), "TX");
  assert.equal(off.health, 0);
  near(off.spendYear, pi.spendYear + 184 * 12);
  // No state of its own: the Income Tax tool's.
  assert.equal(paycheckInput(budget({ pcState: "" }), "PA").state, "PA");
});

test("one paycheck adds up, from gross to unassigned", () => {
  const b = budget({ pcMatch: "219.23", pcHsa: "100", pcEf: "150", pcRothIra: "100" });
  const pi = paycheckInput(b, "IL"), r = paycheckRun(pi);
  near(r.check, 95000 / 26);
  near(r.deposit, r.check - r.k401 - r.hsa - r.health - r.taxes - r.roth401);
  near(r.left, r.deposit - r.spend - r.ef - r.rothIra - r.brok);
  near(r.match, 219.23 * 0.5);
  // A Roth 401(k) line comes out after tax: the taxes rise and the deposit takes the full amount.
  const roth = paycheckRun(paycheckInput({ ...b, pcMatchRoth: true }, "IL"));
  assert.ok(roth.taxes > r.taxes);
  near(roth.roth401, 219.23);
});

test("pre-tax lines cost the deposit less than they put away", () => {
  const pi = paycheckInput(budget({ pcMatch: "250", pcHsa: "100" }), "IL");
  near(pcCostPer(pi, "match"), 1 - 0.22 - 0.0495, 0.001);
  near(pcCostPer(pi, "hsa"), 1 - 0.22 - 0.0495 - 0.0765, 0.001);
  // A Roth IRA comes out of the deposit, after it lands: it doesn't change it.
  near(pcCostPer(pi, "rothIra"), 0, 1e-9);
  near(pcCostPer({ ...pi, roth: { ...pi.roth, match: true } }, "match"), 1, 1e-9);
});

test("Fill assigns every cent, in order, within each line's limit", () => {
  const orders: PcStep[][] = [
    [...PC_STEPS], ["match", "k401max", "hsa", "ef", "rothIra", "brok"],
    ["ef", "rothIra", "match", "hsa", "k401max", "brok"], ["hsa", "match", "rothIra", "k401max", "ef", "brok"],
  ];
  for (const gross of ["72,500", "95,000", "130,000", "210,000"]) for (const state of ["IL", "CA", "PA", "TX"]) for (const o of orders) {
    const pi = paycheckInput(budget({ pcGross: gross, pcState: state, pcOrder: o.join(",") }), "IL");
    const a = paycheckFill(pi), r = paycheckRun(pi, a);
    assert.ok(r.left >= 0, `${gross} ${state} ${o}: short ${r.left}`);
    assert.ok(r.left >= 0 && r.left < 0.01, `${gross} ${state} ${o}: ${r.left} left unassigned`);
    for (const s of pi.order) if (s !== "brok") assert.ok(a[s] <= pcCap(pi, s, a) + 1e-9, `${s} over its cap`);
    // One paycheck: the spouse's lines aren't shown, and nothing goes on them.
    assert.equal(a.match2 + a.hsa2 + a.rothIra2 + a.k401max2, 0);
    // No stray cent: brokerage only gets money when every line above it is full.
    if (a.brok > 0) for (const s of pi.order.slice(0, pi.order.indexOf("brok"))) near(a[s], pcCap(pi, s, a), 0.01);
    near(a.match + a.k401max, Math.min(a.match + a.k401max, L.k401.base / 26), 1e-9);
  }
});

test("Fill stops the emergency fund where it's told", () => {
  const pi = paycheckInput(budget({ pcEfCap: "20", pcOrder: "ef,match,hsa,rothIra,k401max,brok" }), "IL");
  assert.equal(paycheckFill(pi).ef, 20);
  assert.equal(paycheckFill({ ...pi, efCap: 0 }).ef, 0);
});

test("a budget bigger than the pay leaves Fill with nothing to give", () => {
  const pi = paycheckInput(budget({ pcGross: "40,000" }), "IL");
  assert.deepEqual(paycheckFill(pi), PC_ZERO);
  assert.ok(paycheckRun(pi, PC_ZERO).left < 0);
});

test("a stored order with lines missing or repeated is put right", () => {
  assert.deepEqual(pcOrder("brok,ef,brok,junk"), ["brok", "ef", "match", "match2", "hsa", "hsa2", "rothIra", "rothIra2", "k401max", "k401max2"]);
  // An order saved before two incomes: each spouse's line lands right after its counterpart.
  assert.deepEqual(pcOrder("hsa,match,ef,rothIra,k401max,brok"), ["hsa", "hsa2", "match", "match2", "ef", "rothIra", "rothIra2", "k401max", "k401max2", "brok"]);
});

/* Married, two incomes: the household by the month. */
const two = (patch: Partial<BudgetInputs> = {}) =>
  budget({ pcStatus: "m2", pcGross: "120,000", pcGross2: "80,000", pcState: "IL", ...patch });

test("two incomes: the month adds up, taxed jointly", () => {
  const pi = paycheckInput(two({ pcMatch: "300", pcMatch2: "200", pcHsa: "100", pcHsa2: "50", pcEf: "150", pcRothIra: "200", pcRothIra2: "100" }), "IL");
  assert.equal(pi.p, 12);
  assert.ok(pi.order.includes("match2") && pi.order.includes("rothIra2"));
  const r = paycheckRun(pi);
  near(r.check, 200000 / 12);
  near(r.gross1, 10000); near(r.gross2, 80000 / 12);
  near(r.deposit, r.check - r.k401 - r.hsa - r.health - r.taxes - r.roth401);
  near(r.left, r.deposit - r.spend - r.ef - r.rothIra - r.rothIra2 - r.brok);
  assert.deepEqual(r.k401s, [300, 200]);
  // Each person's match on their own pay: 50% of what they defer, up to 6% of it.
  near(r.match, 300 * 0.5 + 200 * 0.5);
  // The spending is a month of the budget.
  near(r.spend, pi.spendYear / 12);
});

test("two incomes: premiums come off the FICA of the job they come through", () => {
  // You're over the Social Security wage cap; your spouse isn't.
  const you = paycheckRun(paycheckInput(two({ pcGross: "250,000", pcGross2: "60,000", pcHealth: "500", pcHealthFrom: "1" }), "IL"));
  const spouse = paycheckRun(paycheckInput(two({ pcGross: "250,000", pcGross2: "60,000", pcHealth: "500", pcHealthFrom: "2" }), "IL"));
  // Through your job they save only Medicare (and the surtax); through your spouse's, Social Security too.
  near(you.fica - spouse.fica, 500 * 0.062, 0.01);
});

test("two incomes on family HSA coverage share one family limit", () => {
  const pi = paycheckInput(two({ pcHsaFamily: true, pcOrder: "hsa,hsa2,match,match2,ef,rothIra,rothIra2,k401max,k401max2,brok" }), "IL");
  const a = paycheckFill(pi);
  near(a.hsa + a.hsa2, L.hsa.family / 12, 0.01);
  near(a.hsa, L.hsa.family / 12, 0.01);
  assert.equal(a.hsa2, 0);
  // Self-only: each their own.
  const b = paycheckFill(paycheckInput(two({ pcHsaFamily: false, pcOrder: pi.order.join(",") }), "IL"));
  near(b.hsa, L.hsa.self / 12, 0.01); near(b.hsa2, L.hsa.self / 12, 0.01);
});

test("two incomes: Fill assigns every cent, in order, within each person's limits", () => {
  for (const [g1, g2] of [["70,000", "45,000"], ["120,000", "80,000"], ["260,000", "190,000"]]) for (const state of ["IL", "CA", "NJ"]) {
    const pi = paycheckInput(two({ pcGross: g1, pcGross2: g2, pcState: state }), "IL");
    const a = paycheckFill(pi), r = paycheckRun(pi, a);
    assert.ok(r.left >= 0 && r.left < 0.01, `${g1}+${g2} ${state}: ${r.left} left`);
    for (const s of pi.order) if (s !== "brok") assert.ok(a[s] <= pcCap(pi, s, a) + 1e-9, `${s} over its cap`);
    assert.ok(a.match + a.k401max <= L.k401.base / 12 + 1e-9 && a.match2 + a.k401max2 <= L.k401.base / 12 + 1e-9);
    if (a.brok > 0) for (const s of pi.order.slice(0, pi.order.indexOf("brok"))) near(a[s], pcCap(pi, s, a), 0.01);
  }
});

test("one income keeps the spouse's lines out, whatever was typed on them", () => {
  const pi = paycheckInput(budget({ pcStatus: "m", pcMatch2: "500", pcRothIra2: "200", pcGross2: "80,000" }), "IL");
  assert.equal(pi.gross2, 0);
  assert.ok(!pi.order.includes("match2"));
  assert.equal(pi.amounts.match2 + pi.amounts.rothIra2, 0);
});
