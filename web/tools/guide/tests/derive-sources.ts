/* Where each answer of a fixture came from, as the old (v1) guide's trips
   would have left a trace: a test helper only, kept from migrate.ts (v1
   saves are no longer migrated) so the fixtures get the same sources. */
import type { AnswerKey, Answers, SourceKind, Sources } from "../store";
import { BOOKKEEPING } from "../sources";

const present = (v: unknown) => v != null && v !== "" && !(typeof v === "number" && !isFinite(v));

/** Where each answer of a v1 guide came from, as far as the old trips left
    a trace: a budget brought back from Budget, debts listed in Debt Payoff,
    take-home from Income Tax (or the quick estimate beside it), a house
    payment from the Mortgage Calculator, a college figure from College
    Savings, the bridge plan, a premium from the Healthcare Cost Planner and
    the FIRE age. Everything else present was typed or tapped: "entered",
    the Social Security statement figures included. */
export function deriveSources(a: Answers, at: string): Sources {
  const src: Sources = {};
  const set = (k: AnswerKey, kind: SourceKind, tool?: string) => { if (present(a[k])) src[k] = tool ? { kind, tool, at } : { kind, at }; };
  for (const k of Object.keys(a) as AnswerKey[]) if (!BOOKKEEPING.has(k)) set(k, "entered");
  if (a.spendSrc === "budget") (["spend", "bgSave", "bgMort", "bgHousing"] as const).forEach((k) => set(k, "tool", "budget"));
  if (a.debtSrc === "tool") (["debtTotal", "debtHi", "debtMin", "debtN", "debtTop", "debtExtra", "debtMonths"] as const).forEach((k) => set(k, "tool", "debt"));
  // v1's Take-home step: "help me work it out" either opened Income Tax,
  // whose capture also writes the pre-tax deductions, or took the estimate.
  if (a.thKnow === "no") {
    if (present(a.txPre)) { set("takehome", "tool", "tax"); set("txPre", "tool", "tax"); }
    else set("takehome", "estimated");
  }
  if (a.moState) (["housePay", "mortPI"] as const).forEach((k) => set(k, "tool", "mortgage"));
  if (a.clState) set("collegeMo", "tool", "college");
  if (present(a.bridge)) (["bridge", "bridgeHold", "bridgeLeft"] as const).forEach((k) => set(k, "tool", "bridge"));
  if (a.hcSeen) set("hcPrem", "tool", "healthcare");
  if (present(a.fiAge)) (["fiAge", "fiLabel"] as const).forEach((k) => set(k, "tool", "fire"));
  return src;
}
