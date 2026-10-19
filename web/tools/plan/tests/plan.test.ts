/* Paycheck to Retirement: the children's stages and how they're covered,
   and how each step fills the next. Run with `npm run test:plan`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNum } from "@/lib/format";
import { advancedCompute, advancedPlan } from "@/tools/advanced/model";
import { BUDGET_DEFAULTS } from "@/tools/budget/model";
import { stagesCompute } from "@/tools/stages/model";
import { TAX_DEFAULTS } from "@/tools/tax/model";
import { coverStage, kidStages, monthlyByAccount, stagesFromKids } from "../kids";
import { freedOf, paycheckOf, planAges, seedAdvanced, seedPaycheck, seedStages, strip, taxesFromPaycheck, toolOf } from "../flow";
import { NO_KIDS, PLAN_DEFAULTS, type PlanState } from "../model";

const near = (a: number, b: number, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} is not within ${tol} of ${b}`);

/** Someone 29, retiring at 60, $95,000, paid every two weeks, in Illinois,
    putting $6,000 a year into a traditional 401(k) today. */
function plan(patch: Partial<PlanState> = {}): PlanState {
  return {
    ...PLAN_DEFAULTS, age: "29", retire: "60", freq: "26",
    tools: {
      tax: { ...TAX_DEFAULTS, gross: "95,000", status: "s", state: "IL", itemize: true, k401: "6,000" },
      budget: { ...BUDGET_DEFAULTS, rows: BUDGET_DEFAULTS.rows.map((r) => (r.desc === "Rent / Mortgage" ? { ...r, amount: "1,800" } : r.desc === "Groceries" ? { ...r, amount: "500" } : r)) },
    },
    ...patch,
  };
}

test("ages: both needed, retiring after today", () => {
  assert.deepEqual(planAges(plan()), { age: 29, retire: 60, years: 31 });
  assert.equal(planAges(plan({ retire: "29" })), null);
  assert.equal(planAges(plan({ age: "" })), null);
});

test("Paycheck is filled from Taxes: the facts, and the first time today's 401(k) up to the match first", () => {
  const p = seedPaycheck(plan());
  const b = toolOf(p, "budget");
  assert.equal(b.pcGross, "95,000");
  assert.equal(b.pcStatus, "s");
  assert.equal(b.pcState, "IL");
  assert.equal(b.pcFreq, "26");
  // $6,000 a year is $230.77 a check; the match line holds up to 6% of pay ($219.23), the rest goes beyond it.
  near(parseNum(b.pcMatch), (0.06 * 95000) / 26);
  near(parseNum(b.pcMatch) + parseNum(b.pcK401max), 6000 / 26);
  // Nothing changed: nothing is filled again, so the lines stay as moved.
  const moved = { ...p, tools: { ...p.tools, budget: { ...b, pcBrok: "300" } } };
  assert.equal(seedPaycheck(moved), moved);
  // A raise in Taxes carries the pay over and leaves the lines alone.
  const raise = { ...moved, tools: { ...moved.tools, tax: { ...toolOf(moved, "tax"), gross: "105,000" } } };
  const b2 = toolOf(seedPaycheck(raise), "budget");
  assert.equal(b2.pcGross, "105,000");
  assert.equal(b2.pcBrok, "300");
  assert.equal(b2.pcMatch, b.pcMatch);
});

test("Taxes, from the paycheck as planned: the same take-home both ways", () => {
  const p = taxesFromPaycheck(seedPaycheck(plan()));
  const s = strip(p)!, pc = paycheckOf(p)!;
  near(s.takeHome, pc.r.deposit);
  const t = toolOf(p, "tax");
  assert.equal(t.itemize, true);
  near(parseNum(t.k401), 6000, 0.2);
  // And it doesn't fill the paycheck again: the facts already match.
  assert.equal(seedPaycheck(p), p);
});

test("Your plan is filled from the paycheck: saving by account, the years, and spending as the target", () => {
  const p = seedAdvanced(seedPaycheck(plan()), null);
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
  // One child planned in 2 years, with childcare: before, childcare to 6, school to 19, then after.
  const S = kidStages({ ...NO_KIDS, planned: 1, firstIn: 2 }, 29, 60);
  assert.deepEqual(S.map((s) => [s.from, s.to, s.cost, s.change]), [[29, 31, 0, 0], [31, 37, 2500, 2500], [37, 50, 1500, 1500], [50, 60, 0, 0]]);
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
  const p = seedAdvanced(seedPaycheck(plan()), null), F = freedOf(p), pc = paycheckOf(p)!;
  const today = monthlyByAccount(advancedPlan(toolOf(p, "advanced"), null), "Bi-Weekly");
  // $200 a month from the traditional 401(k): more than $200 is cut, and the freed pay is exactly $200.
  const c = coverStage(200, { ...today, brok: 0, roth: 0 }, {}, F);
  assert.ok(c.take.trad > 240 && c.take.trad < 290, "cut " + c.take.trad);
  near(c.freed, 200, 0.05);
  near(c.taxUp, c.take.trad - 200, 0.05);
  assert.equal(c.short, 0);
  // Brokerage and Roth free what they cut.
  near(F({ brok: 100, roth: 50, trad: 0, hsa: 0 }).freed, 150, 0.01);
  // Cutting the whole 401(k) costs the whole match.
  const all = F({ brok: 0, roth: 0, trad: today.trad, hsa: 0 });
  near(all.matchLost, (pc.r.match * 26) / 12, 0.05);
  assert.ok(all.freed < today.trad * 0.85);
});

test("Life stages: one per children's stage, saving less what each stage takes, the years adding up", () => {
  let p = seedAdvanced(seedPaycheck(plan()), null);
  const adv = toolOf(p, "advanced");
  // A brokerage line to take from: $400 a check.
  p = { ...p, tools: { ...p.tools, advanced: { ...adv, brokC: "400" } } };
  p = seedStages({ ...p, stagesOn: true, kids: { ...NO_KIDS, planned: 1, firstIn: 2 } }, null);
  const st = toolOf(p, "stages");
  assert.equal(st.stages.length, 4);
  assert.equal(st.stages.reduce((t, s) => t + parseNum(s.years), 0), 31);
  assert.equal(st.stages[1].name, "A child in childcare");
  const P = advancedPlan(toolOf(p, "advanced"), null), today = monthlyByAccount(P, "Bi-Weekly");
  // Childcare at $2,500 a month: the brokerage ($866.67 a month) and then the traditional 401(k) give.
  const per = (m: number) => (m * 12) / 26;
  near(parseNum(st.stages[0].contrib), per(today.brok + today.trad), 0.02);
  near(parseNum(st.stages[1].contrib), 0, 0.02);
  assert.equal(st.stages[1].adj, true);
  // The run works, and costs less at retirement than the plan without children.
  const R = stagesCompute(st, null).R, A = advancedCompute(toolOf(p, "advanced"), null).R;
  assert.ok(R.fv > 0 && R.fv < A.fv);
  // With no children, one stage that matches Advanced.
  const one = stagesFromKids(P, toolOf(p, "advanced"), st, kidStages(null, 29, 60), {});
  assert.equal(one.stages.length, 1);
  near(stagesCompute(one, null).R.fv, A.fv, A.fv * 0.001);
});

test("summary: the balance by account adds up to the plan's own figure, with Advanced or Stages", async () => {
  const { planSummary } = await import("../results");
  let p = seedAdvanced(seedPaycheck(plan()), null);
  p = { ...p, tools: { ...p.tools, advanced: { ...toolOf(p, "advanced"), tradBal: "20,000", rothBal: "5,000", brokC: "200" } } };
  const A = planSummary(p, null)!;
  assert.equal(A.retire, 60);
  near(A.climb[0].total, 25000);
  near(A.climb[A.climb.length - 1].total, A.atRetire.total, A.atRetire.total * 1e-6);
  assert.ok(A.milestones.some((m) => m.label === "$100K"));
  const S = planSummary(seedStages({ ...p, stagesOn: true, kids: { ...NO_KIDS, planned: 2, firstIn: 1 } }, null), null)!;
  assert.ok(S.stages && S.stages.length > 2);
  near(S.climb[S.climb.length - 1].total, S.atRetire.total, S.atRetire.total * 1e-6);
  assert.ok(S.atRetire.total < A.atRetire.total);
  // Take-home and where it goes add back to the paycheck.
  const y = A.pay;
  near(y.gross - y.taxes - y.health - y.preSave, y.takeHome, 0.02);
});

test("summary: a paycheck's parts add back to gross pay (the ribbon)", async () => {
  const { planSummary } = await import("../results");
  let p = seedAdvanced(seedPaycheck(plan()), null);
  p = { ...p, tools: { ...p.tools, budget: { ...toolOf(p, "budget"), pcBrok: "250", pcRothIra: "150", pcHsa: "80", pcEfOn: true, pcEf: "50" } } };
  const S = planSummary(seedAdvanced(p, null), null)!, y = S.pay;
  const lines = S.lines.reduce((t, l) => t + l.v, 0);
  near(y.taxes + y.health + lines + y.spend + y.left, y.gross, 0.02);
  near(S.inflow.trad + S.inflow.roth + S.inflow.brok + S.inflow.hsa + S.inflow.ef - S.inflow.match, lines, 0.02);
});

test("summary: each year's money adds up to the year's pay, and the children show where they cost", async () => {
  const { planSummary } = await import("../results");
  let p = seedAdvanced(seedPaycheck(plan()), null);
  p = { ...p, tools: { ...p.tools, advanced: { ...toolOf(p, "advanced"), brokC: "400" } } };
  const S = planSummary(seedStages({ ...p, stagesOn: true, kids: { ...NO_KIDS, planned: 1, firstIn: 2 } }, null), null)!;
  const M = S.money!, gross = S.pay.gross * S.p;
  assert.equal(M.length, 31);
  for (const y of M) near(y.taxes + y.spend + y.kids + y.save + y.left, gross, 1);
  assert.equal(M[0].kids, 0);
  near(M[2].kids, 30000);
  // Saving cut from the 401(k) in childcare brings more tax.
  assert.ok(M[2].taxes > M[0].taxes);
  assert.ok(M[2].save < M[0].save);
  // No milestones already passed.
  assert.ok(S.milestones.every((m) => m.age > S.age));
});
