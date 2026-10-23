/* What to do next: every step that fills in or sharpens the plan, in the
   order it matters most, each done or not. The overview shows the first
   few not done; Next steps shows them all. */

import { couple, holdings, mortgage, nowYear, type Results } from "./model";
import { DEFAULT_ASSUMPTIONS, hasAccounts, type DashData } from "./store";
import { daysSince } from "./format";
import { detailed, flow } from "./flows";
import { toolHref } from "./host";

export interface Step { id: string; title: string; why: string; action: string; href: string; done: boolean }

export function allSteps(d: DashData, R: Results): Step[] {
  const pr = d.profile, accounts = hasAccounts(d.entries), H = holdings(d.entries, pr), last = d.entries[d.entries.length - 1];
  const M = mortgage(pr, d.entries), F = flow(pr);
  const out: Step[] = [
    { id: "setup", title: "Finish setting up", why: d.skipped.length ? `${d.skipped.length} ${d.skipped.length > 1 ? "steps" : "step"} skipped` : "Every setup step answered", action: "Finish", href: "/dashboard/setup", done: !d.skipped.length && d.done },
    { id: "accounts", title: "Split your savings into accounts", why: "401(k), Roth, brokerage and cash are taxed differently", action: "Add accounts", href: "/dashboard/accounts", done: accounts },
    { id: "cash", title: "Add your checking and savings", why: "Scores your emergency fund", action: "Add", href: "/dashboard/accounts", done: accounts && (H.cash ?? 0) > 0 },
    { id: "state", title: "Say where you live", why: "Taxes on your pay and in retirement depend on it", action: "Add", href: "/dashboard/income", done: !!pr.state },
    { id: "ss", title: "Check your Social Security", why: "Your statement's figure, not an estimate", action: "Check", href: "/dashboard/income", done: pr.ss.checked || R.abroad },
    { id: "strategy", title: "Choose a withdrawal strategy", why: "How you'll draw down in retirement", action: "Choose", href: "/dashboard/retirement", done: !!pr.strategy },
    { id: "cushion", title: `Build ${F.efMonths} months of cash`, why: R.cushion != null ? `You have ${R.cushion.toFixed(1)} months set aside` : "Once your cash is in", action: "See it", href: "/dashboard/spending", done: (R.cushion ?? 0) >= F.efMonths },
    { id: "debt", title: "Pay down debt at 8% or more", why: H.debtsHigh > 0 ? "It costs more than most savings earn" : "Nothing at 8% or more", action: "See debts", href: "/dashboard/accounts", done: accounts && H.debtsHigh === 0 },
    { id: "assume", title: "Review your assumptions", why: "Growth, inflation and stocks once retired", action: "Review", href: "/dashboard/profile", done: JSON.stringify(pr.assume) !== JSON.stringify(DEFAULT_ASSUMPTIONS) },
    { id: "match", title: "Get the full employer match", why: "It's money you'd otherwise leave behind", action: "See it", href: "/dashboard/savings", done: F.fullMatch !== false },
    { id: "budget", title: "Build a budget", why: "See where each month goes", action: "Start", href: "/dashboard/spending", done: detailed(F.b) },
    { id: "assign", title: "Put what's left to work", why: F.left > 0.5 ? `${Math.round(F.left).toLocaleString("en-US")} dollars a month aren't assigned` : "Everything's assigned", action: "Assign it", href: "/dashboard/savings", done: !(F.left > 0.5) },
  ];
  if (pr.home === "own") out.push({ id: "mortgage", title: "Add your mortgage's rate and payment", why: "Shows when it's paid off", action: "Add", href: "/dashboard/home", done: M.payoff != null || M.owed === 0 });
  const kids = pr.kidList.slice(0, pr.kids).filter((k) => k.by && k.by + 18 > nowYear());
  if (kids.length) out.push({ id: "college", title: "Plan for college", why: `${kids[0].name.trim() || "Your first child"} starts in ${kids[0].by! + 18}`, action: "Plan it", href: toolHref("college", "/dashboard/next"), done: false });
  if (couple(pr) && !pr.p2.by) out.push({ id: "partner", title: "Add your partner's birth date", why: "Ages drive Social Security and Medicare", action: "Add", href: "/dashboard/profile", done: false });
  if (last && d.entries.length > 0) out.push({ id: "update", title: "Update your balances", why: `Last entry was ${daysSince(last.date)} days ago`, action: "Update", href: "/dashboard/accounts", done: daysSince(last.date) < 28 });
  // Due updates come first once there's history to keep up.
  const upd = out.find((s) => s.id === "update");
  return upd && !upd.done ? [upd, ...out.filter((s) => s !== upd)] : out;
}

export const nextSteps = (d: DashData, R: Results, n = 4) => allSteps(d, R).filter((s) => !s.done).slice(0, n);
