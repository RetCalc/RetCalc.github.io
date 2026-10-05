/* The Plan Optimizer's words for its plans: amounts, claiming ages and
   tactics. From src/js/app/31b-plan-optimizer.js. */
import type { PlPlan, PlTactics } from "@/lib/engine/types";
import { money } from "@/lib/format";

/** What a plan needs to word itself: married, the spouses' age gap, the RMD age. */
export interface PlanWho { married: boolean; gap?: number; rmdAge?: number }

export function opCompact(v: number): string {
  const x = Math.abs(v);
  if (x >= 1e6) return "$" + (Math.round(v / 1e4) / 100).toFixed(2) + "M";
  if (x >= 1e4) return "$" + Math.round(v / 1e3) + "k";
  return money(v);
}
/** An axis label: $1.2M, $250k, $40. From gdCompact() in 28-guide-core.js. */
export function axisCompact(v: number): string {
  const x = Math.abs(v);
  if (x >= 1e6) return "$" + (Math.round(v / 1e5) / 10).toString().replace(/\.0$/, "") + "M";
  if (x >= 1e3) return "$" + Math.round(v / 1e3) + "k";
  return "$" + Math.round(v);
}
export function opSigned(v: number, f: (v: number) => string = money): string {
  return (v >= 0 ? "+" : "−") + f(Math.abs(v));
}
export function opFillName(f: number): string {
  return ["", "the standard deduction, so it's tax-free", "the top of the 10% bracket", "the top of the 12% bracket",
    "the top of the 22% bracket", "the top of the 24% bracket"][f] || "";
}
export const opFillShort = (f: number) => ["", "0%", "10%", "12%", "22%", "24%"][f] || "";

/** The age conversions stop at, as plTactics works it. */
export function opConvUntil(T: PlTactics, C: PlanWho): number | null {
  if (!(T.f > 0) || !T.u) return null;
  if (T.u === 1) return Math.max(T.c1, C.married ? T.c2 - (C.gap ?? 0) : T.c1) - 1;
  return (C.rmdAge ?? 75) - 1;
}
export function opClaims(T: PlTactics, C: PlanWho, short = false): string {
  if (!C.married) return String(T.c1);
  if (T.c1 === T.c2) return short ? T.c1 + " & " + T.c2 : T.c1 + " for both of you";
  return short ? T.c1 + " & " + T.c2 : T.c1 + " for you, " + T.c2 + " for your spouse";
}
export function opTacticsShort(T: PlTactics, P: PlPlan): string {
  const married = P.status === "m";
  let s = married ? "you claim at " + T.c1 + ", your spouse at " + T.c2 : "claim at " + T.c1;
  if (T.f > 0) {
    s += " · traditional first, to " + (T.f === 1 ? "the standard deduction" : "the " + opFillShort(T.f) + " bracket");
    if (T.u) s += " · convert the rest " + (T.u === 1 ? "until Social Security" : "until RMDs");
  } else s += " · brokerage, traditional, then Roth";
  if (T.ac) s += " · under the ACA cliff";
  if (T.im) s += " · under IRMAA";
  return s;
}
/** One line for a plan summary. */
export function opTacticsLine(T: PlTactics, C: PlanWho): string {
  if (!(T.f > 0)) return "Brokerage, then traditional, then Roth";
  const until = opConvUntil(T, C);
  let s = "Traditional first, up to " + (T.f === 1 ? "the standard deduction" : "the " + opFillShort(T.f) + " bracket");
  s += until != null ? ", converting the rest to Roth until " + until : "";
  const g = [];
  if (T.ac) g.push("the ACA subsidy cliff");
  if (T.im) g.push("Medicare's surcharge");
  if (g.length) s += ", staying under " + g.join(" and ");
  return s;
}
export const lowerFirst = (s: string) => s.replace(/^./, (c) => c.toLowerCase());

export const OP_GOALS: Record<"legacy" | "last" | "spend", [name: string, desc: string]> = {
  legacy: ["Leave the most", "Most money left after tax, for you and your heirs"],
  last: ["Make it last", "Lasts in the most historical markets, then leaves the most in the worst"],
  spend: ["Spend the most", "The highest yearly spending that still lasts"],
};
