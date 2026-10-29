/* Guide and Budget figures that must match the screens they point at:
   the Safety card and the score size the emergency fund on the same
   spending; the Drawdown trip loads the whole mix. Run with `npm run test:guide`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { BUDGET_DEFAULTS, budgetCompute, emergencyYear, type BudgetInputs } from "@/tools/budget/model";
import { parts } from "../calc";
import type { Answers } from "../store";
import { FIXTURES } from "../../../scripts/baseline/guide-fixtures.mjs";

const fx = () => structuredClone(FIXTURES.find((f) => f.id === "priya-tom")!.a) as Answers;

test("the emergency fund score is months of the emergency budget when that's what the fund is sized on", () => {
  const a = { ...fx(), cash: 12000, spend: 4000, cashSpend: 3000, cashEmergency: true } as Answers;
  const P = parts(a);
  // 12,000 / 3,000: the figure the Safety card now shows.
  assert.equal(P.cushion?.m, 4);
  assert.match(P.cushion?.txt ?? "", /emergency budget/);
  const plain = parts({ ...a, cashSpend: null, cashEmergency: false } as Answers);
  assert.equal(plain.cushion?.m, 3);
});

test("the Budget's printed sheet and its screen size the fund on the same basis", () => {
  const rows = BUDGET_DEFAULTS.rows.map((r, i) => (i === 0 ? { ...r, amount: "2,000", freq: 12, emerg: "1,200" } : r));
  const b = { ...BUDGET_DEFAULTS, rows, efEmerg: true, efBasis: "emergency", efMonths: "6" } as BudgetInputs;
  const C = budgetCompute(b);
  // The sheet takes the target, and its monthly basis, from budgetCompute.
  assert.equal(Math.round(C.efTarget), Math.round((emergencyYear(b) / 12) * 6));
  assert.equal(Math.round((C.efTarget / C.ef) * 12), Math.round(emergencyYear(b)));
  const normal = budgetCompute({ ...b, efBasis: "normal" });
  assert.ok(normal.efTarget > C.efTarget);
});
