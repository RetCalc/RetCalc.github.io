/* Paycheck to Retirement: the children's stages and how they're covered,
   and how each step fills the next. Run with `npm run test:plan`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNum } from "@/lib/format";
import { advancedCompute, advancedPlan } from "@/tools/advanced/model";
import { BUDGET_DEFAULTS } from "@/tools/budget/model";
import { changesCompute, compileChanges } from "@/tools/advanced/changes";
import { TAX_DEFAULTS } from "@/tools/tax/model";
import { coverStage, kidList, kidStages, monthlyByAccount } from "../kids";
import { freedOf, fromOldTaxes, paycheckOf, planAges, seedAdvanced, seedChanges, startDone, strip, taxOfPaycheck, toolOf } from "../flow";
import { NO_KIDS, PLAN_DEFAULTS, type PlanState } from "../model";

const near = (a: number, b: number, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} is not within ${tol} of ${b}`);

/** Someone 29, retiring at 60, $95,000, paid every two weeks, in Illinois
    (as Start asks it), putting $6,000 per year into a traditional 401(k)
    today: $219.23 per check on the match line (6% of pay), the rest beyond it. */
function plan(patch: Partial<PlanState> = {}): PlanState {
  return {
    ...PLAN_DEFAULTS, age: "29", retire: "60", freq: "26",
    tools: {
      budget: { ...BUDGET_DEFAULTS, pcStatus: "s", pcGross: "95,000", pcFreq: "26", pcState: "IL", pcMatch: "219.23", pcK401max: "11.54", rows: BUDGET_DEFAULTS.rows.map((r) => (r.desc === "Rent / Mortgage" ? { ...r, amount: "1,800" } : r.desc === "Groceries" ? { ...r, amount: "500" } : r)) },
    },
    ...patch,
  };
}

test("ages: both needed, retiring after today", () => {
  assert.deepEqual(planAges(plan()), { age: 29, retire: 60, years: 31 });
  assert.equal(planAges(plan({ retire: "29" })), null);
  assert.equal(planAges(plan({ age: "" })), null);
});

test("a plan saved when Taxes was a step: its answers fill the paycheck once, today's 401(k) up to the match first", () => {
  const old: PlanState = { ...PLAN_DEFAULTS, age: "29", retire: "60", freq: "26",
    tools: { tax: { ...TAX_DEFAULTS, gross: "95,000", status: "s", state: "IL", itemize: true, k401: "6,000" } } };
  const p = fromOldTaxes(old);
  const b = toolOf(p, "budget");
  assert.equal(b.pcGross, "95,000");
  assert.equal(b.pcStatus, "s");
  assert.equal(b.pcState, "IL");
  assert.equal(b.pcFreq, "26");
  // $6,000 per year is $230.77 per check; the match line holds up to 6% of pay ($219.23), the rest goes beyond it.
  near(parseNum(b.pcMatch), (0.06 * 95000) / 26);
  near(parseNum(b.pcMatch) + parseNum(b.pcK401max), 6000 / 26);
  // Once: what's typed on the paycheck afterwards stays.
  const moved = { ...p, tools: { ...p.tools, budget: { ...b, pcBrok: "300" } } };
  assert.equal(fromOldTaxes(moved), moved);
  // And a plan begun on the new Start is left alone.
  const fresh = plan();
  assert.equal(fromOldTaxes(fresh), fresh);
});

test("Income Tax, from the paycheck as planned (Copy into my tools): the 401(k) by kind", () => {
  const p = plan(), t = taxOfPaycheck(p)!;
  assert.equal(t.itemize, true);
  near(parseNum(t.k401), 6000, 0.2);
  assert.equal(t.state, "IL");
  // The running figures are the paycheck's.
  near(strip(p)!.takeHome, paycheckOf(p)!.r.deposit);
});

test("Start is done with your ages and your pay", () => {
  assert.equal(startDone(plan()), true);
  assert.equal(startDone(plan({ age: "" })), false);
  const noPay = plan();
  assert.equal(startDone({ ...noPay, tools: { ...noPay.tools, budget: { ...toolOf(noPay, "budget"), pcGross: "" } } }), false);
});

test("Your plan is filled from the paycheck: saving by account, the years, and spending as the target", () => {
  const p = seedAdvanced(plan(), null);
  const a = toolOf(p, "advanced");
  assert.equal(a.acOn, true);
  assert.equal(a.years, "31");
  assert.equal(a.period, "Bi-Weekly");
  near(parseNum(a.tradC), 6000 / 26);
  assert.equal(a.target, "27,600");
  // The projection runs.
  assert.ok(advancedCompute(a, null).R.fv > 0);
  // Unchanged paycheck: Advanced as edited stays.
  const edited = { ...p, tools: { ...p.tools, advanced: { ...a, tradBal: "40,000" } } };
  assert.equal(seedAdvanced(edited, null), edited);
});

test("children: stages where the cost changes, in the Guide's words", () => {
  // One child planned in 2 years, with childcare (a suburb): before, childcare to 6, 6 to 12, the teens, then after.
  const S = kidStages({ ...NO_KIDS, planned: 1, firstIn: 2 }, 29, 60);
  assert.deepEqual(S.map((s) => [s.from, s.to, s.cost, s.change]), [[29, 31, 0, 0], [31, 37, 2300, 2300], [37, 44, 1400, 1400], [44, 50, 1500, 1500], [50, 60, 0, 0]]);
  assert.equal(S[3].label, "A teenager");
  // A big city's childcare, and planned children each at their own gap.
  assert.equal(kidStages({ ...NO_KIDS, planned: 1, firstIn: 2, area: "city" }, 29, 60)[1].cost, 2800);
  const G = kidStages({ ...NO_KIDS, planned: 3, firstIn: 1, gaps: [2, 4] }, 29, 60);
  assert.deepEqual(G.filter((s) => /childcare/.test(s.label)).map((s) => s.from).slice(0, 1), [30]);
  // Up to six children in all.
  assert.equal(kidList({ ...NO_KIDS, now: [1, 2, 3, 4], planned: 5 }, 29).length, 6);
  assert.equal(S[1].label, "A child in childcare");
  // Two children you have (4 and 8, no childcare): already in the budget, so the change is from today's cost.
  const N = kidStages({ ...NO_KIDS, now: [4, 8], childcare: false }, 35, 65);
  assert.equal(N[0].change, 0);
  assert.ok(N.some((s) => s.change < 0));
  // No children: one stage.
  assert.deepEqual(kidStages(null, 29, 60).map((s) => [s.from, s.to, s.change]), [[29, 60, 0]]);
});

test("covering a stage: the brokerage first, typed amounts stand, the rest from spending", () => {
  const today = { brok: 500, roth: 300, trad: 600, hsa: 200 };
  const pick = (c: { take: unknown; short: number }) => ({ take: c.take, short: c.short });
  assert.deepEqual(pick(coverStage(700, today)), { take: { brok: 500, roth: 200, trad: 0, hsa: 0 }, short: 0 });
  assert.deepEqual(pick(coverStage(700, today, { brok: 100 })), { take: { brok: 100, roth: 300, trad: 300, hsa: 0 }, short: 0 });
  assert.deepEqual(pick(coverStage(2000, today)), { take: { brok: 500, roth: 300, trad: 600, hsa: 200 }, short: 400 });
  // Costing less than today adds to the brokerage.
  assert.deepEqual(coverStage(-300, today).take, { brok: -300, roth: 0, trad: 0, hsa: 0 });
});

test("covering a stage from pre-tax accounts: a cut frees less than itself, and can cost the match", () => {
  const p = seedAdvanced(plan(), null), F = freedOf(p), pc = paycheckOf(p)!;
  const today = monthlyByAccount(advancedPlan(toolOf(p, "advanced"), null), "Bi-Weekly");
  // $200 per month from the traditional 401(k): more than $200 is cut, and the freed pay is exactly $200.
  const c = coverStage(200, { ...today, brok: 0, roth: 0 }, {}, F);
  assert.ok(c.take.trad > 240 && c.take.trad < 290, "cut " + c.take.trad);
  // Whole dollars: the fewest that free the cost, and what it frees reads exactly the cost.
  assert.equal(c.take.trad, Math.round(c.take.trad));
  assert.ok(c.freed >= 200 && c.freed < 201, "freed " + c.freed);
  assert.equal(c.freedBy.trad, 200);
  assert.equal(c.short, 0);
  // A Roth cut then a traditional one: each frees its share, adding up to the cost to the dollar.
  const two = coverStage(900, { brok: 0, roth: 700, trad: today.trad, hsa: 0 }, {}, F);
  assert.equal(two.take.roth, 700);
  assert.equal(two.freedBy.roth + two.freedBy.trad, 900);
  // Brokerage and Roth free what they cut.
  near(F({ brok: 100, roth: 50, trad: 0, hsa: 0 }).freed, 150, 0.01);
  // Cutting the whole 401(k) costs the whole match.
  const all = F({ brok: 0, roth: 0, trad: today.trad, hsa: 0 });
  near(all.matchLost, (pc.r.match * 26) / 12, 0.05);
  assert.ok(all.freed < today.trad * 0.85);
});

test("Changes ahead: the walkthrough's children go into Advanced once, as its Children change, and the plan runs as their stages", () => {
  let p = seedAdvanced(plan(), null);
  const adv = toolOf(p, "advanced");
  // A brokerage line to take from: $400 per check.
  p = { ...p, tools: { ...p.tools, advanced: { ...adv, brokC: "400" } } };
  p = seedChanges({ ...p, stagesOn: true, kids: { ...NO_KIDS, planned: 1, firstIn: 2 } });
  const a = toolOf(p, "advanced");
  assert.equal(p.kids, null);
  assert.equal(a.kids?.planned, 1);
  assert.deepEqual(a.changes.map((c) => [c.kind, c.on]), [["children", true]]);
  // Carried once: a second time changes nothing.
  assert.deepEqual(seedChanges(p), p);
  const C = compileChanges(a, null);
  assert.equal(C.shown.reduce((t, x) => t + (x.to - x.from), 0), 31);
  assert.ok(C.shown.some((x) => x.names.includes("A child in childcare")));
  // The run works, and costs less at retirement than the plan without children.
  const R = changesCompute(a, null).V.R, A = advancedCompute({ ...a, changes: [] }, null).R;
  assert.ok(R.fv > 0 && R.fv < A.fv);
});

test("summary: the balance by account adds up to the plan's own figure, with or without changes ahead", async () => {
  const { planSummary } = await import("../results");
  let p = seedAdvanced(plan(), null);
  p = { ...p, tools: { ...p.tools, advanced: { ...toolOf(p, "advanced"), tradBal: "20,000", rothBal: "5,000", brokC: "200" } } };
  const A = planSummary(p, null)!;
  assert.equal(A.retire, 60);
  near(A.climb[0].total, 25000);
  near(A.climb[A.climb.length - 1].total, A.atRetire.total, A.atRetire.total * 1e-6);
  assert.ok(A.milestones.some((m) => m.label === "$100K"));
  // What it's made of adds back to the balance, in the dollars of the day.
  const M = A.made;
  near(M.start + M.own + M.match + M.growth, A.atRetire.fv, 1);
  near(M.start, 25000);
  assert.ok(M.match > 0 && M.growth > M.own);
  const MR = A.madeReal;
  near(MR.start + MR.own + MR.match + MR.growth, A.atRetire.total, 1);
  near(MR.start, 25000);
  assert.ok(MR.own < M.own && MR.growth < M.growth);
  const S = planSummary(seedChanges({ ...p, stagesOn: true, kids: { ...NO_KIDS, planned: 2, firstIn: 1 } }), null)!;
  assert.ok(S.stages && S.stages.length > 2);
  near(S.climb[S.climb.length - 1].total, S.atRetire.total, S.atRetire.total * 1e-6);
  assert.ok(S.atRetire.total < A.atRetire.total);
  // Take-home and where it goes add back to the paycheck.
  const y = A.pay;
  near(y.gross - y.taxes - y.health - y.preSave, y.takeHome, 0.02);
});

test("summary: a paycheck's parts add back to gross pay (the ribbon)", async () => {
  const { planSummary } = await import("../results");
  let p = seedAdvanced(plan(), null);
  p = { ...p, tools: { ...p.tools, budget: { ...toolOf(p, "budget"), pcBrok: "250", pcRothIra: "150", pcHsa: "80", pcEfOn: true, pcEf: "50" } } };
  const S = planSummary(seedAdvanced(p, null), null)!, y = S.pay;
  const lines = S.lines.reduce((t, l) => t + l.v, 0);
  near(y.taxes + y.health + lines + y.spend + y.left, y.gross, 0.02);
  near(S.inflow.trad + S.inflow.roth + S.inflow.brok + S.inflow.hsa + S.inflow.ef - S.inflow.match, lines, 0.02);
});

test("summary: what the children cost, child by child, and what it does to the balance", async () => {
  const { planSummary } = await import("../results");
  let p = seedAdvanced(plan(), null);
  p = { ...p, tools: { ...p.tools, advanced: { ...toolOf(p, "advanced"), brokC: "400" } } };
  const S = planSummary(seedChanges({ ...p, stagesOn: true, kids: { ...NO_KIDS, planned: 2, firstIn: 2 } }), null)!;
  const K = S.children!;
  assert.equal(K.rows.length, 2);
  // Child 1, born at 31: childcare to 36 at $2,500, then school at $1,500 to 49.
  assert.deepEqual(K.rows[0].bands.map((b) => [b.from, b.to, b.monthly, b.early]), [[31, 37, 2300, true], [37, 44, 1400, false], [44, 50, 1500, false]]);
  // Child 2 costs 20% less.
  assert.equal(K.rows[1].bands[0].monthly, 1840);
  near(K.total, K.rows.reduce((t, r) => t + r.bands.reduce((u, b) => u + b.monthly * 12 * (b.to - b.from), 0), 0), 1);
  assert.deepEqual(K.peak, { age: 34, monthly: 4140 });
  near(K.fromSaving + K.fromSpending, K.total, 1);
  assert.ok(K.without > S.atRetire.total);
  // No milestones already passed.
  assert.ok(S.milestones.every((m) => m.age > S.age));
});

test("filing status and state come from Start into Your plan, every time they change, not from the household", () => {
  const married = (p: PlanState): PlanState => ({ ...p, tools: { ...p.tools, budget: { ...toolOf(p, "budget"), pcStatus: "m2", pcGross2: "60,000", pcState: "CA" } } });
  const house = { status: "s", state: "TX" } as unknown as Parameters<typeof seedAdvanced>[1];
  let p = seedAdvanced(married(plan()), house);
  assert.deepEqual([toolOf(p, "advanced").acStatus, toolOf(p, "advanced").acState], ["m", "CA"]);
  // Back to Start: single, in Illinois. Your plan follows.
  p = { ...p, tools: { ...p.tools, budget: { ...toolOf(p, "budget"), pcStatus: "s", pcGross2: "", pcState: "IL" } } };
  p = seedAdvanced(p, house);
  assert.deepEqual([toolOf(p, "advanced").acStatus, toolOf(p, "advanced").acState], ["s", "IL"]);
});

test("children spaced in half years: 2.5 years apart stays 2.5, and stages can start mid-year", async () => {
  const S = kidStages({ ...NO_KIDS, planned: 2, firstIn: 2, spacing: 2.5 }, 29, 60);
  assert.ok(S.some((s) => s.from === 33.5), "the second child's arrival starts a stage at 33½");
  assert.equal(S[S.length - 1].to, 60);
  const { ageSpan } = await import("../kids");
  assert.equal(ageSpan(31, 34), "31 to 33");
  assert.equal(ageSpan(33.5, 36), "33½ to 36");
  // In Advanced's changes ahead: the years add up, a stage starting mid-year among them.
  let p = seedAdvanced(plan(), null);
  p = seedChanges({ ...p, stagesOn: true, kids: { ...NO_KIDS, planned: 2, firstIn: 2, spacing: 2.5 } });
  const st = compileChanges(toolOf(p, "advanced"), null).shown;
  near(st.reduce((t, s) => t + (s.to - s.from), 0), 31);
  assert.ok(st.some((s) => !Number.isInteger(s.from)));
});
