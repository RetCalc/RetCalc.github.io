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
import { annualize, isSavingsRow, type BudgetInputs } from "@/tools/budget/model";
import { debtList, type DebtInputs } from "@/tools/debt/model";
import { mortgageInput, type Inputs as MortgageInputs } from "@/tools/mortgage/model";

/* ---- what only the screen shows ---- */
export const q = (sel: string) => (typeof document === "undefined" ? null : document.querySelector(sel));
export const on = (sel: string) => !!q(sel);
export const text = (sel: string) => (q(sel)?.textContent || "").trim();

export function budgetNums(s: BudgetInputs) {
  const inc = parseNum(s.income) * s.incomeFreq;
  let spent = 0, saved = 0, lines = 0;
  s.rows.forEach((r) => {
    if (isSavingsRow(r)) saved += annualize(r);
    else { spent += annualize(r); if (parseNum(r.amount) > 0) lines++; }
  });
  return { inc, spent, saved, lines, left: inc - spent - saved };
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
