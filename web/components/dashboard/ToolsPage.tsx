"use client";

/* Tools: the site's own tool list (charts or compact), and each tool
   opened inside the Dashboard: the rail stays, Back returns to the page it
   was opened from, and everything the profile knows is filled in. What's
   changed in a tool stays in that tool. */

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { CheckIcon, ChevronLeftIcon } from "lucide-react";
import type { CollegeInputs } from "@/tools/college/model";
import { Button } from "@/components/ui/button";
import { ToolsBrowser } from "@/components/tools/ToolsBrowser";
import type { PickerData } from "@/components/tools/picker-data";
import { TOOLS, type ToolSub } from "@/lib/tools";
import { Frame, SECTIONS, SignedIn } from "./Frame";
import { Hosted, TOOL_VIEWS, householdOf, seedFor, toolHref } from "./host";
import { useDashboard, type Entry, type Profile } from "./store";
import { applyCollege, collegeNeedOf, sameCollege } from "./college";
import { flow } from "./flows";
import { money } from "./format";
import { holdings, mortgage, results } from "./model";
import { Note } from "./ui";

/** The tab that holds a tool's figures for the plan itself. */
const PLAN_TAB: Partial<Record<ToolSub, { id: string; name: string; hash?: string }>> = {
  budget: { id: "spending", name: "Spending" }, drawdown: { id: "retirement", name: "Retirement" },
  tax: { id: "taxes", name: "Taxes" }, social: { id: "income", name: "Income" },
  college: { id: "profile", name: "Profile", hash: "#college" },
};

/** A line of your own figures for each tool's card. */
function yoursFor(pr: Profile, entries: Entry[]): Partial<Record<ToolSub, string>> {
  const R = results(pr, entries), F = flow(pr), H = holdings(entries, pr), M = mortgage(pr, entries), retire = pr.p1.retire;
  const y: Partial<Record<ToolSub, string>> = {};
  if (R.success != null) y.drawdown = `Your plan: lasted in ${Math.round(R.success * 100)}% of past markets`;
  if (R.atRetire != null) y.optimizer = `Your savings at retirement: ${money(Math.round(R.atRetire / 1000) * 1000)}`;
  if (R.ss != null && !R.abroad) y.social = `Your estimate: ${money(R.ss)} per month${R.ssYear ? " from " + R.ssYear : ""}`;
  if (retire != null) {
    y.bridge = retire < 60 ? `You retire at ${retire}, before 59½` : `You retire at ${retire}, after 59½`;
    y.healthcare = retire < 65 ? `You retire at ${retire}: ${65 - retire} ${65 - retire === 1 ? "year" : "years"} before Medicare` : `You retire at ${retire}, with Medicare`;
  }
  if (R.S) y.roth = `Traditional at retirement: ${money(Math.round(R.S.P.trad / 1000) * 1000)}`;
  if (F.hasPay) y.fire = `You save ${money(F.invested + F.match)} per month, with the match`;
  y.backtest = `Your mix once retired: ${pr.assume.stocks}% in stocks`;
  const need = collegeNeedOf(pr);
  if (need > 0) y.college = `Your plan for college: about ${money(need)} per month`;
  y.rentbuy = pr.home === "rent" && pr.rent ? `You rent at ${money(pr.rent)} per month` : pr.home === "own" ? `You own: ${money(H.equity)} in equity` : undefined;
  if (F.tax) y.tax = `Your taxes: ${money(F.tax.total)} per year`;
  if (F.spend > 0) y.budget = `Your budget: ${money(F.spend)} per month`;
  if (pr.home === "own") y.mortgage = M.owed > 0 ? (M.payoff != null ? `Paid off in ${Math.floor(M.payoff)}, at today's payment` : `${money(M.owed)} left on the mortgage`) : "No mortgage";
  y.debt = H.debts > 0 ? `Your debts besides the mortgage: ${money(H.debts)}` : H.accounts ? "No other debts entered" : undefined;
  return y;
}

function ToolsList({ data }: { data: PickerData }) {
  const { data: d } = useDashboard();
  const yours = useMemo(() => yoursFor(d.profile, d.entries), [d.profile, d.entries]);
  return (
    <Frame current="tools" title="Tools" sub="Each one opens here, with what you've told us filled in">
      <ToolsBrowser data={data} hrefFor={(sub) => toolHref(sub, "/dashboard/tools")} yours={yours} />
    </Frame>
  );
}

export function ToolsListPage({ data }: { data: PickerData }) {
  return <SignedIn><ToolsList data={data} /></SignedIn>;
}

/* The page a tool was opened from, from its address: a dashboard page only. */
const fromNow = () => {
  const f = new URLSearchParams(window.location.search).get("from");
  return f && f.startsWith("/dashboard") ? f : "/dashboard/tools";
};
const noop = () => () => {};

function Tool({ sub }: { sub: ToolSub }) {
  const { data, setProfile } = useDashboard();
  // College Savings' figures as they stand, for "Apply to my plan".
  const [college, setCollege] = useState<CollegeInputs | null>(null);
  const [applied, setApplied] = useState(false);
  const apply = college && !sameCollege(data.profile, college) ? applyCollege(data.profile, college) : null;
  const mismatch = sub === "college" && college != null && apply == null && !sameCollege(data.profile, college);
  const back = useSyncExternalStore(noop, fromNow, () => "/dashboard/tools");
  const backName = back === "/dashboard" ? "Dashboard" : SECTIONS.find((s) => back === "/dashboard/" + s.id)?.name ?? "Tools";
  // The profile as the tool opens; later changes to the profile don't reach
  // a tool already open, and the tool's own changes never reach the profile.
  const seed = useMemo(() => seedFor(data.profile, data.entries), [data.profile, data.entries]);
  const household = useMemo(() => householdOf(data.profile, data.entries), [data.profile, data.entries]);
  const View = TOOL_VIEWS[sub], tab = PLAN_TAB[sub];
  return (
    <Frame current="tools" title={TOOLS[sub].name} help={sub}
      sub={tab ? undefined : "Filled in from your dashboard. Changes here stay in this tool."}
      actions={<>
        {sub === "college" ? <Button disabled={!apply || applied} onClick={() => { if (apply) { setProfile(() => apply); setApplied(true); } }}>{applied || (college && sameCollege(data.profile, college)) ? <><CheckIcon aria-hidden="true" />{applied ? "Applied to my plan" : "Your plan matches"}</> : "Apply to my plan"}</Button> : null}
        <Button variant="outline" nativeButton={false} render={<Link href={back} />}><ChevronLeftIcon aria-hidden="true" />Back to {backName}</Button>
      </>}>
      {sub === "college" ? (
        <div>
          <Note>Filled in from your plan. Change anything here (each child&apos;s cost, when they start and for how long, what&apos;s saved, the return, tuition inflation), then Apply to my plan to keep it.
            {data.profile.college.help === "part" && !data.profile.college.plan ? <> Each year&apos;s cost here is your half of the school&apos;s {money(data.profile.college.cost)}.</> : null}
            {mismatch ? <> <b>The children here don&apos;t match your plan&apos;s.</b> Add or remove children in <Button variant="link" size="inline" nativeButton={false} render={<Link href="/dashboard/profile#children" />}>Profile</Button>, then come back.</> : null}</Note>
        </div>
      ) : tab ? (
        <div>
          <Note>Filled in from your plan, to try things on: changes here don&apos;t change it. To change your plan, use <Button variant="link" size="inline" nativeButton={false} render={<Link href={"/dashboard/" + tab.id + (tab.hash ?? "")} />}>{tab.name}</Button>.</Note>
        </div>
      ) : null}
      <div className={tab ? "dsh-r4" : undefined}><Hosted key={sub} seed={seed} household={household}
        keep={sub === "college" ? (id, d) => { if (id === "college") { setCollege(d as unknown as CollegeInputs); setApplied(false); } } : undefined}><View /></Hosted></div>
    </Frame>
  );
}

export function ToolPage({ sub }: { sub: ToolSub }) {
  return <SignedIn><Tool sub={sub} /></SignedIn>;
}
