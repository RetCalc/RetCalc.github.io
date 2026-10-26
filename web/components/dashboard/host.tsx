"use client";

/* The tools, inside the Dashboard. Each runs in a tool scope: its inputs
   start from the profile (everything known filled in, with no notice), and
   its edits stay with it. A tab built on a tool (Spending, Savings, Taxes,
   Retirement) passes `keep`, which takes the edits into the profile; a tool
   opened from Tools passes none, so nothing it does reaches the profile.
   Either way the site's own copies of the tools (tab memory, the saved
   household, share links) are never touched. */

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ToolScopeProvider, type ToolInputs, type ToolScope } from "@/components/tools/ToolState";
import type { SavedHousehold } from "@/lib/household";
import { TOOLS, type ToolSub } from "@/lib/tools";
import { MORTGAGE_DEFAULTS } from "@/tools/mortgage/model";
import { RENTBUY_DEFAULTS } from "@/tools/rentbuy/model";
import { groupDigits } from "@/lib/format";
import { budgetFor, drawdownFor, flow, socialFor, taxFor, taxState } from "./flows";
import { advancedFor, stagesFor } from "./calc";
import { collegeInputsOf } from "./college";
import { ageOf, contribMonth, couple, drawdownPlan, grossYear, holdings, results, spendMonth } from "./model";
import type { Entry, Profile } from "./store";

const pick = <T,>(load: () => Promise<T>) => dynamic(load as () => Promise<React.ComponentType>, { ssr: false });
/** Every tool, loaded only when it's opened. */
export const TOOL_VIEWS: Record<ToolSub, React.ComponentType> = {
  optimizer: pick(() => import("@/tools/optimizer/Optimizer").then((m) => m.Optimizer)),
  drawdown: pick(() => import("@/tools/drawdown/Drawdown").then((m) => m.Drawdown)),
  social: pick(() => import("@/tools/social/Social").then((m) => m.Social)),
  bridge: pick(() => import("@/tools/bridge/Bridge").then((m) => m.Bridge)),
  roth: pick(() => import("@/tools/roth/Roth").then((m) => m.Roth)),
  healthcare: pick(() => import("@/tools/healthcare/Healthcare").then((m) => m.Healthcare)),
  fire: pick(() => import("@/tools/fire/Fire").then((m) => m.Fire)),
  backtest: pick(() => import("@/tools/backtest/Backtest").then((m) => m.Backtest)),
  college: pick(() => import("@/tools/college/College").then((m) => m.College)),
  rentbuy: pick(() => import("@/tools/rentbuy/RentBuy").then((m) => m.RentBuy)),
  tax: pick(() => import("@/tools/tax/Tax").then((m) => m.Tax)),
  budget: pick(() => import("@/tools/budget/Budget").then((m) => m.Budget)),
  debt: pick(() => import("@/tools/debt/Debt").then((m) => m.Debt)),
  mortgage: pick(() => import("@/tools/mortgage/Mortgage").then((m) => m.Mortgage)),
};

/** A tool's page on the site ("/rentbuy") as its place in the Dashboard. */
export function toolFromPath(path: string): ToolSub | null {
  const p = path.split(/[?#]/)[0].replace(/^\//, "");
  return (Object.keys(TOOLS) as ToolSub[]).find((k) => TOOLS[k].path === p) ?? null;
}
/** A tool opened from a dashboard page, which its Back returns to. */
export const toolHref = (sub: ToolSub, from?: string) => `/dashboard/tools/${sub}${from ? "?from=" + encodeURIComponent(from) : ""}`;

/** What goes into savings each month, with the match: the paycheck's, or setup's. */
const flowMonthly = (pr: Profile) => { const F = flow(pr); return F.hasPay ? F.invested + F.match : contribMonth(pr); };

const round = (v: number | null, times = 1) => (v == null ? null : Math.round(v * times));

/** The household every tool knows how to take in, from the profile. */
export function householdOf(pr: Profile, entries: Entry[]): SavedHousehold {
  const H = holdings(entries, pr), two = couple(pr);
  return {
    status: two ? "m" : "s", age: ageOf(pr.p1), spouseAge: two ? ageOf(pr.p2) : null, retire: pr.p1.retire,
    state: taxState(pr), saved: Math.round(H.trad + H.roth + H.brok), monthly: round(flowMonthly(pr)),
    income: round(grossYear(pr.p1)), income2: two ? round(grossYear(pr.p2)) : null,
    // The household's spending is spending once retired, per year: what the plan spends.
    spend: round(results(pr, entries).spend ?? spendMonth(pr), 12),
    savedAt: 1,
  };
}

/** Each tool's first inputs beyond the household: what the profile knows. */
export function seedFor(pr: Profile, entries: Entry[]): (id: string) => ToolInputs | undefined {
  return (id) => {
    const H = holdings(entries, pr);
    switch (id) {
      case "budget": return budgetFor(pr);
      case "tax": return taxFor(pr);
      case "social": return socialFor(pr);
      case "drawdown": {
        const R = results(pr, entries), S = R.S;
        const plan = S && R.retireYear ? drawdownPlan(S, R.ss1, R.ss2, R.claim1) : null;
        return drawdownFor(pr, plan);
      }
      case "rentbuy": return {
        ...RENTBUY_DEFAULTS, status: couple(pr) ? "m" : "s",
        ...(pr.home === "rent" && pr.rent ? { rent: groupDigits(pr.rent, true) } : {}),
        ...(pr.home === "own" && H.home > 0 ? { price: groupDigits(H.home, true) } : {}),
      };
      case "mortgage": return pr.home === "own" && H.home > 0 ? {
        ...MORTGAGE_DEFAULTS, price: groupDigits(H.home, true), downAmt: groupDigits(Math.max(0, H.home - H.mortgage), true),
        downPct: String(Math.round(((H.home - H.mortgage) / H.home) * 1000) / 10),
        ...(pr.mortRate != null ? { rate: String(Math.round(pr.mortRate * 10000) / 100) } : {}),
      } : undefined;
      case "college": return collegeInputsOf(pr) ?? undefined;
      case "advanced": return advancedFor(pr, entries);
      case "stages": return stagesFor(pr, entries);
      default: return undefined;
    }
  };
}

/** Runs tools in the Dashboard's scope. `seed` gives each tool's first
    inputs; `keep`, when given, takes its edits into the profile; links
    between tools stay inside the Dashboard. */
export function Hosted({ seed, keep, household, slots, cover, children }: {
  seed: (id: string) => ToolInputs | undefined; keep?: (id: string, data: ToolInputs) => void;
  household: SavedHousehold | null; slots?: ToolScope["slots"]; cover?: ToolScope["cover"]; children: ReactNode;
}) {
  const router = useRouter();
  const latest = useRef({ seed, keep });
  useEffect(() => { latest.current = { seed, keep }; });
  // One scope for the host's life: the tools read it as they open.
  const [scope] = useState<ToolScope>(() => {
    const mem = new Map<string, ToolInputs>();
    return {
      name: "dashboard", household, slots, cover,
      read: (id) => mem.get(id) ?? latest.current.seed(id),
      write: (id, data) => { mem.set(id, data); latest.current.keep?.(id, data); },
      go: (path) => { const t = toolFromPath(path); if (t) router.push(toolHref(t)); return true; },
    };
  });
  return <ToolScopeProvider value={scope}><div className="dsh-embed">{children}</div></ToolScopeProvider>;
}

