/* A sample walkthrough, built the way the steps build it, for screenshots
   and the report's checks: 29, retiring at 60, $95,000 every two weeks in
   Illinois, "The usual order" on the paycheck, some savings already, two
   children planned. `node --import ./scripts/test-hooks.mjs tools/plan/tests/fixture.ts > plan.json` */
import { BUDGET_DEFAULTS } from "@/tools/budget/model";
import { paycheckInput, pcAmountKey, pcPlanApply, PC_STEPS } from "@/tools/budget/paycheck-math";
import { TAX_DEFAULTS } from "@/tools/tax/model";
import { seedAdvanced, seedPaycheck, seedStages, toolOf } from "../flow";
import { NO_KIDS, PLAN_DEFAULTS, type PlanState } from "../model";

const amounts: Record<string, string> = { "Rent / Mortgage": "1,800", Utilities: "200", "Internet & phone": "90", "Car payment": "350", "Car insurance": "120", Gas: "150",
  "Health insurance": "150", Groceries: "500", "Eating out": "300", Subscriptions: "45", Travel: "3,000", Gifts: "800" };
export function samplePlan(stages = true): PlanState {
  let p: PlanState = {
    ...PLAN_DEFAULTS, age: "29", retire: "60", freq: "26",
    tools: {
      tax: { ...TAX_DEFAULTS, gross: "95,000", status: "s", state: "IL", itemize: true, k401: "6,000" },
      budget: { ...BUDGET_DEFAULTS, rows: BUDGET_DEFAULTS.rows.map((r) => (amounts[r.desc] ? { ...r, amount: amounts[r.desc] } : r)) },
    },
  };
  p = seedPaycheck(p);
  const b = toolOf(p, "budget"), pi = paycheckInput(b, "IL"), { roth, amounts: a } = pcPlanApply(pi, "usual");
  p = { ...p, tools: { ...p.tools, budget: { ...b, ...Object.fromEntries(PC_STEPS.map((x) => [pcAmountKey(x), String(Math.round(a[x] * 100) / 100)])),
    pcMatchRoth: roth.match, pcK401maxRoth: roth.k401max, pcIraRoth: roth.rothIra, pcPlan: "usual" } } };
  p = seedAdvanced(p, null);
  p = { ...p, tools: { ...p.tools, advanced: { ...toolOf(p, "advanced"), tradBal: "38,000", rothBal: "12,500", brokBal: "8,000", hsaBal: "3,200" } } };
  if (stages) p = seedStages({ ...p, stagesOn: true, kids: { ...NO_KIDS, planned: 2, firstIn: 2 } }, null);
  return { ...p, step: "summary", reached: "summary" };
}

if (process.argv[1]?.endsWith("fixture.ts")) process.stdout.write(JSON.stringify(samplePlan(process.argv[2] !== "advanced")));
