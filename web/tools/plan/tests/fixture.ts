/* A sample walkthrough, built the way the steps build it, for screenshots
   and the report's checks: 29, retiring at 60, $95,000 every two weeks in
   Illinois, "The usual order" on the paycheck, some savings already, two
   children planned. `node --import ./scripts/test-hooks.mjs tools/plan/tests/fixture.ts > plan.json` */
import { BUDGET_DEFAULTS } from "@/tools/budget/model";
import { paycheckInput, pcAmountKey, pcPlanApply, PC_STEPS } from "@/tools/budget/paycheck-math";
import { seedAdvanced, seedChanges, toolOf } from "../flow";
import { NO_KIDS, PLAN_DEFAULTS, type PlanState } from "../model";

/** The Start step's answers, in the Paycheck tab's fields. */
export const START = { pcStatus: "s", pcGross: "95,000", pcFreq: "26", pcState: "IL" };

const amounts: Record<string, string> = { "Rent / Mortgage": "1,800", Utilities: "200", "Internet & phone": "90", "Car payment": "350", "Car insurance": "120", Gas: "150",
  "Health insurance": "150", Groceries: "500", "Eating out": "300", Subscriptions: "45", Travel: "3,000", Gifts: "800" };
export function samplePlan(stages = true): PlanState {
  let p: PlanState = {
    ...PLAN_DEFAULTS, age: "29", retire: "60", freq: "26",
    tools: {
      // As Start asks it: single, $95,000, every two weeks, in Illinois.
      budget: { ...BUDGET_DEFAULTS, ...START, rows: BUDGET_DEFAULTS.rows.map((r) => (amounts[r.desc] ? { ...r, amount: amounts[r.desc] } : r)) },
    },
  };
  const b = toolOf(p, "budget"), pi = paycheckInput(b, "IL"), { roth, amounts: a } = pcPlanApply(pi, "usual");
  p = { ...p, tools: { ...p.tools, budget: { ...b, ...Object.fromEntries(PC_STEPS.map((x) => [pcAmountKey(x), String(Math.round(a[x] * 100) / 100)])),
    pcMatchRoth: roth.match, pcK401maxRoth: roth.k401max, pcIraRoth: roth.rothIra, pcPlan: "usual" } } };
  p = seedAdvanced(p, null);
  p = { ...p, tools: { ...p.tools, advanced: { ...toolOf(p, "advanced"), tradBal: "38,000", rothBal: "12,500", brokBal: "8,000", hsaBal: "3,200" } } };
  if (stages) p = seedChanges({ ...p, stagesOn: true, kids: { ...NO_KIDS, planned: 2, firstIn: 2 } });
  return { ...p, step: "summary", reached: "summary" };
}

/** The sample with a long budget: thirty more lines, for the report's page breaks. */
export function longPlan(): PlanState {
  const p = samplePlan(true), b = toolOf(p, "budget");
  const extra = Array.from({ length: 30 }, (_, i) => ({ group: ["Lifestyle", "Housing", "Food", "Custom"][i % 4], desc: "Line " + (i + 1), amount: String(20 + i), freq: 12, custom: true }));
  return { ...p, tools: { ...p.tools, budget: { ...b, rows: [...b.rows, ...extra] } } };
}

if (process.argv[1]?.endsWith("fixture.ts")) process.stdout.write(JSON.stringify(process.argv[2] === "long" ? longPlan() : samplePlan(process.argv[2] !== "advanced")));
