/* What to do next: every step that fills in or sharpens the plan, each
   done or not, the ones to do ordered by how much they'd raise the
   readiness score (or, for a missing answer, how much it leaves unknown).
   The overview shows the first few; Next steps shows them all. */

import { couple, holdings, mortgage, nowYear, type Results } from "./model";
import { DEFAULT_ASSUMPTIONS, hasAccounts, type DashData } from "./store";
import { daysSince, money10 } from "./format";
import { detailed, flow } from "./flows";
import { collegeNeedOf } from "./college";
import { toolHref } from "./host";
import { room } from "./readiness";

/** A stage's words without the yearly growth in them ("after the raise"
    once for each year saving has grown). */
const words = (label: string) => {
  const w = label.split(", ").filter((x) => !/^after the raise$/i.test(x)).join(", ");
  return w ? w.charAt(0).toUpperCase() + w.slice(1) : "Saving";
};

export interface Step { id: string; title: string; why: string; action: string; href: string; done: boolean; gain: number }

export function allSteps(d: DashData, R: Results): Step[] {
  const pr = d.profile, accounts = hasAccounts(d.entries), H = holdings(d.entries, pr), last = d.entries[d.entries.length - 1];
  const M = mortgage(pr, d.entries), F = flow(pr);
  const out: Step[] = [];
  const add = (s: Omit<Step, "gain"> & { gain?: number }) => out.push({ gain: 1, ...s });

  // Answers still missing: each leaves part of the score unknown.
  add({ id: "setup", title: "Finish setting up", why: d.skipped.length ? `${d.skipped.length} ${d.skipped.length > 1 ? "steps" : "step"} skipped` : "Every setup step answered", action: "Finish", href: "/dashboard/setup", done: !d.skipped.length && d.done, gain: 30 });
  add({ id: "accounts", title: "Split your savings into accounts", why: "401(k), Roth, brokerage and cash are taxed differently", action: "Add accounts", href: "/dashboard/accounts#assets", done: accounts, gain: 12 });
  add({ id: "cash", title: "Add your checking and savings", why: "Scores your emergency fund", action: "Add", href: "/dashboard/accounts#assets", done: accounts && (H.cash ?? 0) > 0, gain: room(R, "cushion", 15) });
  add({ id: "state", title: "Say where you live", why: "Taxes on your pay and in retirement depend on it", action: "Add", href: "/dashboard/income#pay", done: !!pr.state, gain: 6 });

  // The plan itself: lasting, saving, the match, money left unassigned.
  if (R.success != null && R.success < 0.9) {
    add({ id: "outlook", title: `Raise your chance of success from ${Math.round(R.success * 100)}%`, why: "Your readiness score shows what would get you there", action: "See how", href: "/dashboard#readiness-outlook", done: false, gain: room(R, "outlook", 40) });
  }
  if (F.fullMatch === false) {
    add({ id: "match", title: "Get the full employer match", why: "It's money you'd otherwise leave behind", action: "Fix it", href: "/dashboard/savings#rest", done: false, gain: room(R, "rate", 20) + 4 });
  }
  if (F.left > 50) add({ id: "assign", title: `Put ${money10(F.left)} per month to work`, why: "It's left after spending and isn't assigned to saving", action: "Assign it", href: "/dashboard/savings#rest", done: false, gain: room(R, "rate", 20) });
  add({ id: "cushion", title: `Build ${F.efMonths} months of cash`, why: R.cushion != null ? `You have ${R.cushion.toFixed(1)} months set aside` : "Once your cash is in", action: "See it", href: "/dashboard/spending#emergency", done: (R.cushion ?? 0) >= F.efMonths, gain: room(R, "cushion", 15) });
  add({ id: "debt", title: "Pay down debt at 8% or more", why: H.debtsHigh > 0 ? "It costs more than most saving earns" : "Nothing at 8% or more", action: "See debts", href: "/dashboard/accounts#debts", done: accounts && H.debtsHigh === 0, gain: room(R, "debt", 15) });

  // Children and college: what's planned but not yet in the budget.
  const need = collegeNeedOf(pr);
  if (need > 0) add({ id: "college", title: F.college > 0 ? `Raise college saving to ${money10(need)} per month` : `Save ${money10(need)} per month for college`, why: "You plan to help with college, and saving ahead keeps it out of your saving later", action: "Add to budget", href: "/dashboard/spending#month", done: F.college >= need - 25, gain: 8 });
  const drop = R.S?.sched?.find((s, i, all) => i > 0 && s.monthly < all[0].monthly - 50);
  if (drop && R.S) {
    // The calendar year you reach that age, as the Calculator and timeline count it.
    const year = pr.p1.by ? pr.p1.by + drop.from : Math.round(nowYear() + (drop.from - (R.S.I.age ?? 0)));
    add({ id: "kids-drop", title: `Saving drops to ${money10(drop.monthly)} per month in ${year}, with the match`, why: `${words(drop.label)}: see how each stage saves`, action: "Open Calculator", href: "/dashboard/calculator", done: false, gain: 3 });
  }
  const kids = pr.kidList.slice(0, pr.kids).filter((k) => k.by && k.by + 18 > nowYear());
  if (kids.length && pr.college.help !== "none") add({ id: "college-tool", title: "Plan college in detail", why: `${kids[0].name.trim() || "Your first child"} starts in ${kids[0].by! + 18}`, action: "Plan it", href: toolHref("college", "/dashboard/next"), done: false, gain: 2 });

  // Sharper figures.
  add({ id: "ss", title: "Check your Social Security", why: "Your statement's figure or your pay history, not an estimate", action: "Check", href: "/dashboard/income#social-security", done: pr.ss.checked || R.abroad, gain: 5 });
  add({ id: "strategy", title: "Choose a withdrawal strategy", why: "How you'll draw down in retirement; it sets your chance of success", action: "Choose", href: "/dashboard/retirement#strategies", done: !!pr.strategy, gain: 5 });
  add({ id: "budget", title: "Build a budget", why: "See where each month goes", action: "Start", href: "/dashboard/spending#budget", done: detailed(F.b), gain: room(R, "flow", 10) / 2 + 2 });
  add({ id: "assume", title: "Review your assumptions", why: "Growth, inflation and stocks once retired", action: "Review", href: "/dashboard/profile#assumptions", done: JSON.stringify(pr.assume) !== JSON.stringify(DEFAULT_ASSUMPTIONS), gain: 2 });
  if (pr.home === "own") add({ id: "mortgage", title: "Add your mortgage's rate and payment", why: "Shows when it's paid off", action: "Add", href: "/dashboard/home#mortgage", done: M.payoff != null || M.owed === 0, gain: 1 });
  if (couple(pr) && !pr.p2.by) add({ id: "partner", title: "Add your partner's birth date", why: "Ages drive Social Security and Medicare", action: "Add", href: "/dashboard/profile#household", done: false, gain: 6 });
  if (last) add({ id: "update", title: "Update your balances", why: `Last entry was ${daysSince(last.date)} days ago`, action: "Update", href: "/dashboard/accounts#assets", done: daysSince(last.date) < 28, gain: daysSince(last.date) > 60 ? 20 : 4 });

  return out.sort((a, b) => b.gain - a.gain);
}

export const nextSteps = (d: DashData, R: Results, n = 4) => allSteps(d, R).filter((s) => !s.done).slice(0, n);
