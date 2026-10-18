/* The Budget's Paycheck tab: the paycheck adds up, the budget comes across
   without what the tab plans itself, pre-tax lines cost the deposit less
   than they put away, and Fill assigns every cent in order without going
   over. Run with `npm run test:budget`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { yearData } from "@/lib/engine/typed";
import { BUDGET_DEFAULTS, budgetCompute, dropPlanned, type BudgetInputs } from "../model";
import { PC_PLANS, PC_STEPS, PC_ZERO, paycheckFill, paycheckInput, paycheckRun, pcCap, pcCostPer, pcMost, pcOrder, pcPlanOrder, pcSplit, rowRole, type PcStep } from "../paycheck-math";

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
  near(pi.health[0], (184 * 12) / 26);
  assert.equal(pi.state, "IL");
  // Premiums set to 0 (not through work): the row stays in the budget and nothing comes out before tax.
  const off = paycheckInput(budget({ pcHealth: "0" }), "TX");
  assert.deepEqual(off.health, [0, 0]);
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
    // No stray cent: brokerage only gets money when every line above it is full.
    if (a.brok > 0) for (const s of pi.order.slice(0, pi.order.indexOf("brok"))) near(a[s], pcCap(pi, s, a), 0.01);
    near(a.match + a.k401max, Math.min(a.match + a.k401max, L.k401.base / 26), 1e-9);
  }
});

test("Fill stops the emergency fund where it's told", () => {
  const pi = paycheckInput(budget({ pcEfOn: true, pcEfCap: "20", pcOrder: "ef,match,hsa,rothIra,k401max,brok" }), "IL");
  assert.equal(paycheckFill(pi).ef, 20);
  assert.equal(paycheckFill({ ...pi, efCap: 0 }).ef, 0);
});

test("a budget bigger than the pay leaves Fill with nothing to give", () => {
  const pi = paycheckInput(budget({ pcGross: "40,000" }), "IL");
  assert.deepEqual(paycheckFill(pi), PC_ZERO);
  assert.ok(paycheckRun(pi, PC_ZERO).left < 0);
});

test("a stored order with lines missing or repeated is put right", () => {
  assert.deepEqual(pcOrder("brok,ef,brok,junk"), ["brok", "ef", "match", "hsa", "rothIra", "k401max"]);
  // An earlier version's per-person lines are dropped.
  assert.deepEqual(pcOrder("hsa,hsa2,match,match2,ef,rothIra,rothIra2,k401max,k401max2,brok"), ["hsa", "match", "ef", "rothIra", "k401max", "brok"]);
});

/* Married, two incomes: the household by the month. */
const two = (patch: Partial<BudgetInputs> = {}) =>
  budget({ pcStatus: "m2", pcGross: "120,000", pcGross2: "80,000", pcState: "IL", ...patch });

test("two incomes: one line per kind, each split between you", () => {
  const pi = paycheckInput(two({ pcMatch: "1,000", pcHsa: "300", pcHsaFamily: true, pcEf: "150", pcRothIra: "400", pcK401max: "500" }), "IL");
  assert.equal(pi.p, 12);
  // An amount on the emergency fund keeps its line on.
  assert.deepEqual(pi.order, ["match", "ef", "hsa", "rothIra", "k401max", "brok"]);
  const r = paycheckRun(pi), sp = pcSplit(pi);
  near(r.check, 200000 / 12); near(r.gross1, 10000); near(r.gross2, 80000 / 12);
  near(r.deposit, r.check - r.k401 - r.hsa - r.health - r.taxes - r.roth401);
  near(r.left, r.deposit - r.spend - r.ef - r.rothIra - r.brok);
  // Equal matches: yours fills first (6% of $10,000 = $600), the rest is your spouse's.
  assert.deepEqual(sp.match, [600, 400]);
  near(r.match, 600 * 0.5 + 400 * 0.5);
  // Beyond the match: in proportion to each person's room left.
  const room = [L.k401.base / 12 - 600, L.k401.base / 12 - 400];
  near(sp.k401max[0], 500 * room[0] / (room[0] + room[1])); near(sp.k401max[1], 500 * room[1] / (room[0] + room[1]));
  // HSA (family) and Roth IRA: evenly.
  assert.deepEqual(sp.hsa, [150, 150]); assert.deepEqual(sp.rothIra, [200, 200]);
  near(r.k401s[0], 600 + sp.k401max[0]); near(r.k401s[1], 400 + sp.k401max[1]);
  near(r.spend, pi.spendYear / 12);
});

test("two incomes: the match line funds the higher match first", () => {
  // Your spouse's employer matches 100% of the first 4% ($266.67 a month); yours 50% of 6% ($600).
  const pi = paycheckInput(two({ pcMatchRate2: "100", pcMatchUpTo2: "4", pcMatch: "400" }), "IL");
  const m = pcSplit(pi).match;
  near(m[1], 80000 * 0.04 / 12); near(m[0], 400 - 80000 * 0.04 / 12);
  near(pcCap(pi, "match", pi.amounts), 600 + 80000 * 0.04 / 12);
});

test("two incomes: premiums come off the FICA of the job they come through", () => {
  // You're over the Social Security wage cap; your spouse isn't.
  const you = paycheckRun(paycheckInput(two({ pcGross: "250,000", pcGross2: "60,000", pcHealth: "500", pcHealth2: "0" }), "IL"));
  const spouse = paycheckRun(paycheckInput(two({ pcGross: "250,000", pcGross2: "60,000", pcHealth: "0", pcHealth2: "500" }), "IL"));
  // Typed per check (every two weeks): $500 a check is $1,083.33 a month. Through your job
  // they save only Medicare (and the surtax); through your spouse's, Social Security too.
  near(you.fica - spouse.fica, (500 * 26 / 12) * 0.062, 0.01);
  // Both through work: both count, and the Budget's row moves up.
  const both = paycheckInput(two({ pcHealth: "300", pcHealth2: "200", pcFreq2: "24" }), "IL");
  // Each on its own schedule: yours every two weeks, your spouse's twice a month.
  near(both.health[0], 300 * 26 / 12); near(both.health[1], 200 * 24 / 12);
  // Both 0: not through work, and the Budget's Health insurance row stays a bill.
  const none = paycheckInput(two({ pcHealth: "0", pcHealth2: "0" }), "IL");
  near(none.spendYear, both.spendYear + 184 * 12);
});

test("two incomes: each person's check adds up to the household's", () => {
  const pi = paycheckInput(two({ pcMatch: "1,000", pcHsa: "300", pcHsaFamily: true, pcHealth: "100", pcHealth2: "80", pcMatchRoth: true }), "IL");
  const r = paycheckRun(pi), [y, sp] = r.people;
  for (const k of ["gross", "k401", "roth401", "hsa", "health", "fed", "state", "fica", "deposit"] as const) near(y[k] + sp[k], k === "gross" ? r.check : k === "deposit" ? r.deposit : (r as unknown as Record<string, number>)[k], 0.01);
  // Social Security is each person's own: 6.2% of their pay less their HSA and premiums.
  near(y.fica + sp.fica, r.fica, 0.01);
  assert.ok(y.fed > sp.fed, "the higher earner carries more of the joint tax");
});

test("two incomes: HSA limits follow the coverage", () => {
  const fill = (patch: Partial<BudgetInputs>) => {
    const pi = paycheckInput(two({ pcOrder: "hsa,match,ef,rothIra,k401max,brok", ...patch }), "IL");
    const a = paycheckFill(pi);
    return { a, sp: pcSplit(pi, a) };
  };
  const fam = fill({ pcHsaFamily: true });
  near(fam.a.hsa, L.hsa.family / 12, 0.01);
  const each = fill({ pcHsaFamily: false, pcHsaBoth: true });
  near(each.a.hsa, 2 * L.hsa.self / 12, 0.01); near(each.sp.hsa[0], L.hsa.self / 12, 0.01);
  const one = fill({ pcHsaFamily: false, pcHsaBoth: false });
  near(one.a.hsa, L.hsa.self / 12, 0.01); assert.equal(one.sp.hsa[1], 0);
});

test("two incomes: Fill assigns every cent, in order, within each person's limits", () => {
  for (const [g1, g2] of [["70,000", "45,000"], ["120,000", "80,000"], ["260,000", "190,000"]]) for (const state of ["IL", "CA", "NJ"]) {
    const pi = paycheckInput(two({ pcGross: g1, pcGross2: g2, pcState: state }), "IL");
    const a = paycheckFill(pi), r = paycheckRun(pi, a);
    assert.ok(r.left >= 0 && r.left < 0.01, `${g1}+${g2} ${state}: ${r.left} left`);
    for (const s of pi.order) if (s !== "brok") assert.ok(a[s] <= pcCap(pi, s, a) + 1e-9, `${s} over its cap`);
    // Neither person past their own 401(k) limit.
    for (const i of [0, 1]) assert.ok(r.k401s[i] + r.roth401s[i] <= L.k401.base / 12 + 0.01, `person ${i} over the 401(k) limit`);
    if (a.brok > 0) for (const s of pi.order.slice(0, pi.order.indexOf("brok"))) near(a[s], pcCap(pi, s, a), 0.01);
  }
});

test("one income keeps the spouse's pay and premiums out, whatever was typed", () => {
  const pi = paycheckInput(budget({ pcStatus: "m", pcGross2: "80,000", pcHealth2: "300" }), "IL");
  assert.equal(pi.gross2, 0);
  assert.equal(pi.health[1], 0);
  assert.equal(pcCap(pi, "rothIra", pi.amounts), L.ira.base / 26);
});

test("the emergency fund is off until added, and a saved amount keeps it on", () => {
  assert.ok(!paycheckInput(budget(), "IL").order.includes("ef"));
  assert.equal(paycheckInput(budget({ pcEf: "150" }), "IL").amounts.ef, 150);
  assert.ok(paycheckInput(budget({ pcEfOn: true }), "IL").order.includes("ef"));
});

test("plans: each fills its own order, and leaves out what it skips", () => {
  const pi = paycheckInput(budget({ pcEfOn: true, pcEfCap: "100" }), "IL");
  const flex = paycheckFill(pi, [...PC_PLANS.flex.order]);
  assert.equal(flex.hsa, 0); assert.equal(flex.k401max, 0);
  near(flex.ef, 100); near(flex.match, pcCap(pi, "match", flex));
  assert.deepEqual(pcPlanOrder("flex"), ["match", "ef", "rothIra", "brok", "hsa", "k401max"]);
  const tax = paycheckFill({ ...pi, roth: { match: false, k401max: false } }, [...PC_PLANS.tax.order]);
  // Max tax breaks fills the 401(k) to its limit before a Roth IRA.
  near(tax.match + tax.k401max, Math.min(L.k401.base / 26, tax.match + tax.k401max));
  assert.ok(paycheckRun(pi, tax).taxes < paycheckRun(pi, flex).taxes);
});

test("Max fills a line as far as the check allows, the others as they are", () => {
  const pi = paycheckInput(budget({ pcMatch: "219.23", pcRothIra: "100" }), "IL");
  near(pcMost(pi, "hsa"), L.hsa.self / 26, 0.01);
  const room = pcMost(pi, "brok");
  assert.ok(Math.abs(paycheckRun(pi, { ...pi.amounts, brok: room }).left) < 0.01);
});

test("two incomes: the HSA comes out of the pay under the Social Security wage cap first", () => {
  const cap = yearData().fica.ssCap;
  // You earn over the cap, your spouse under: the HSA favors your spouse's pay.
  const fam = paycheckInput(two({ pcGross: String(cap + 50000), pcGross2: "80,000", pcHsaFamily: true, pcHsa: "600" }), "IL");
  const sp = pcSplit(fam);
  assert.equal(sp.hsaFirst, 1); assert.deepEqual(sp.hsa, [0, 600]);
  // Self-only each: your spouse's own limit first, the rest on yours.
  const each = paycheckInput(two({ pcGross: String(cap + 50000), pcGross2: "80,000", pcHsaBoth: true, pcHsa: "500" }), "IL");
  near(pcSplit(each).hsa[1], L.hsa.self / 12); near(pcSplit(each).hsa[0], 500 - L.hsa.self / 12);
  // And it saves Social Security tax against an even split.
  const even = paycheckRun({ ...fam, gross: 80000 + 1, gross2: 80000 }, fam.amounts);
  assert.equal(pcSplit({ ...fam, gross: 80000 + 1, gross2: 80000 }).hsaFirst, null);
  assert.ok(even.fica > 0);
  // Both under the cap: evenly.
  assert.equal(pcSplit(paycheckInput(two({ pcHsaFamily: true, pcHsa: "600" }), "IL")).hsaFirst, null);
});
