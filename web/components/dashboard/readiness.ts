/* The readiness score, explained: for each of its five areas, why it
   scored what it did and what would raise it, with real numbers from the
   plan (the Guide's own solver finds the saving, retirement age or
   spending that reaches the plan's target), and the tab to do it on. */

import { fixes, target, type FactorId } from "@/tools/guide/calc";
import { drawdownFor, drawdownSuccess, flow } from "./flows";
import { money, money10 } from "./format";
import { answers, drawdownPlan, holdings, spendMonth, type Results } from "./model";
import type { Entry, Profile } from "./store";

export interface Why { why: string; how: string[]; href: string; action: string }

const pct = (v: number) => Math.round(v * 100) + "%";

/** What a strategy that adapts would do for the chance of success. */
export function guardrailsChance(pr: Profile, R: Results): number | null {
  if (!R.S || pr.strategy === "guardrails") return null;
  return drawdownSuccess(drawdownFor({ ...pr, strategy: "guardrails" }, drawdownPlan(R.S, R.ss1, R.ss2, R.claim1)));
}

export function explain(id: FactorId, pr: Profile, entries: Entry[], R: Results): Why {
  const part = R.parts[id], F = flow(pr), H = holdings(entries, pr);
  switch (id) {
    case "outlook": {
      const a = answers(pr, entries), goal = target(a), fx = R.S ? fixes(a, { retire: true, save: true, spend: true }) : null;
      const how: string[] = [];
      if (fx && fx.extra != null) how.push(`Save ${money10(fx.extra)} more per month`);
      if (fx && fx.retire != null) how.push(`Retire at ${fx.retire}`);
      if (fx && fx.spend != null) how.push(`Plan to spend ${money10(fx.spend / 12)} per month in retirement`);
      const g = guardrailsChance(pr, R);
      if (g != null && R.success != null && g > R.success + 0.02) how.push(`Use a strategy that adapts, like guardrails: ${pct(g)} lasted`);
      return {
        why: R.success == null ? "Needs your ages, savings, retirement age and spending."
          : `${pct(R.success)} of historical retirements lasted to 95${R.strategy ? ` with ${R.strategy.name}` : ", spending a fixed amount"}. Full marks take about 95%; the plan aims for ${pct(goal)}.`,
        how: how.length ? how : R.success != null && R.success >= goal ? ["You're at the plan's target already."] : [],
        href: "/dashboard/retirement", action: "Open Retirement",
      };
    }
    case "rate": return {
      why: part ? `You save ${part.txt}. About 15% of pay before taxes is a common goal, and less is fine once the plan shows it's enough.` : "Needs your pay and what you save.",
      how: [
        ...(F.fullMatch === false ? ["Raise the first 401(k) line to get the whole employer match"] : []),
        ...(F.left > 50 ? [`Put the ${money10(F.left)} per month not yet assigned to work`] : []),
      ],
      href: "/dashboard/savings", action: "Open Savings",
    };
    case "cushion": {
      const target$ = F.efTarget, cash = H.cash ?? 0;
      return {
        why: part ? `${part.txt} set aside in cash; your goal is ${F.efMonths} months, ${money(target$)}.` : "Needs your checking and savings, on Net worth.",
        how: part && cash < target$ ? [`Set aside ${money(target$ - cash)} more`, F.ef > 0 ? `At ${money10(F.ef)} per month to it, about ${Math.ceil((target$ - cash) / F.ef)} months` : "Add an emergency fund line on Savings"] : [],
        href: part ? "/dashboard/savings" : "/dashboard/accounts", action: part ? "Open Savings" : "Open Net worth",
      };
    }
    case "debt": return {
      why: part ? `${part.txt}. Debt at 8% or more costs more than most saving earns.` : "Needs your debts, on Net worth (none is an answer too).",
      how: part && H.debtsHigh > 0 ? [`Pay down the ${money(H.debtsHigh)} at 8% or more first`] : [],
      href: "/dashboard/accounts", action: "Open Net worth",
    };
    case "flow": {
      const s = spendMonth(pr) ?? 0, left = (R.takehome ?? 0) - s;
      return {
        why: part ? `${money10(Math.abs(left))} per month ${left >= 0 ? "is left" : "short"} of what comes in after taxes, after spending ${money(s)} per month.` : "Needs your pay and your spending.",
        how: part && part.p < 1 ? ["Keep about a fifth of what comes in unspent: trim the biggest lines of the budget"] : [],
        href: "/dashboard/spending", action: "Open Spending",
      };
    }
  }
}

/** Points each area could still add, for ordering what to do next. */
export const room = (R: Results, id: FactorId, w: number) => (R.parts[id] ? (1 - R.parts[id]!.p) * w : w * 0.5);

