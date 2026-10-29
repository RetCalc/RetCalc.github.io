/* Reading a tool from outside it, for the panels that walk through one
   (the guide's coach on a trip, Tool Help): its totals, worked out from its
   inputs the way its page does, and what only the page shows, read off the
   screen. From gdBudgetNums(), gdDebtNums(), gdHousing() and gdHcPrem() in
   src/js/app/29-guide-trips.js. */
import { debtRun, mortgage } from "@/lib/engine/typed";
import { mcSeed } from "@/lib/mc-seed";
import { parseNum } from "@/lib/format";
import { bridgeInput, type BridgeInputs } from "@/tools/bridge/model";
import { runBridge, type BridgeRun } from "@/tools/bridge/run";
import { BUDGET_DEFAULTS, annualize, isPlannedRow, isSavingsRow, type BudgetInputs } from "@/tools/budget/model";
import { paycheckMonthly } from "@/tools/budget/paycheck-math";
import { toolInputs } from "@/components/tools/ToolState";
import { TAX_DEFAULTS } from "@/tools/tax/model";
import { debtList, type DebtInputs } from "@/tools/debt/model";
import { mortgageInput, type Inputs as MortgageInputs } from "@/tools/mortgage/model";

/* ---- what only the screen shows ---- */
export const q = (sel: string) => (typeof document === "undefined" ? null : document.querySelector(sel));
export const on = (sel: string) => !!q(sel);
export const text = (sel: string) => (q(sel)?.textContent || "").trim();

/** The budget's spending and goals, a year, and, once the Paycheck tab has
    a gross pay, what it deposits and what's still unassigned there, a year
    (0 until then: the Budget tab has no income of its own). */
export function budgetNums(s: BudgetInputs) {
  let spent = 0, saved = 0, lines = 0;
  s.rows.forEach((r) => {
    if (isPlannedRow(r)) return;
    if (isSavingsRow(r)) saved += annualize(r);
    else { spent += annualize(r); if (parseNum(r.amount) > 0) lines++; }
  });
  const pay = paycheckMonthly(s, toolInputs("tax", TAX_DEFAULTS).state);
  return { inc: pay ? pay.deposit * 12 : 0, spent, saved, lines, left: pay ? pay.left * 12 : 0, paid: !!pay };
}
/** What the Budget's Paycheck tab has unassigned, a month, as the Budget
    stands in this browser: pay less taxes, the budget and the saving planned
    there. It is what Debt Payoff's "Copy from Budget" takes, and what the
    Guide's Debt task quotes. null until the Paycheck tab has a gross pay. */
export function budgetUnassigned(): number | null {
  const pay = paycheckMonthly(toolInputs("budget", BUDGET_DEFAULTS), toolInputs("tax", TAX_DEFAULTS).state);
  return pay ? pay.left : null;
}
export function debtNums(s: DebtInputs) {
  const live = debtList(s.rows).filter((d) => d.balance > 0);
  const total = live.reduce((t, d) => t + d.balance, 0);
  const hi = live.filter((d) => d.apr >= 8).reduce((t, d) => t + d.balance, 0);
  const min = live.reduce((t, d) => t + (d.min || 0), 0);
  const top = live.reduce((m, d) => Math.max(m, d.apr || 0), 0);
  const pick = live.length ? debtRun(debtList(s.rows), parseNum(s.extra), s.mode) : null;
  return { live, total, hi, min, top, pick };
}
export function housing(s: MortgageInputs) {
  const R = mortgage(mortgageInput(s));
  return { R, piti: R.pi + R.tax + R.ins + R.pmi + R.hoa };
}
/* The bridge's plans, as its page works them out: one at a time is kept. */
let bridgeMemo: { key: string; run: BridgeRun | null } | null = null;
export function bridgeRun(s: BridgeInputs) {
  const mode = on('#segBR [data-brmode="mc"].on') ? "mc" : "hist", seed = mcSeed();
  const key = JSON.stringify([s, mode, seed]);
  if (bridgeMemo?.key !== key) bridgeMemo = { key, run: runBridge(bridgeInput(s), mode, seed).run };
  return bridgeMemo.run;
}
export const hcPrem = () => {
  const t = text("#hcACABody .kv.total .v");
  if (!t) return null;
  const v = parseFloat(t.replace(/[^0-9.]/g, ""));
  return isFinite(v) ? v : null;
};
