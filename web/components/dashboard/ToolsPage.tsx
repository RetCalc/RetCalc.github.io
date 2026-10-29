"use client";

/* Tools: the site's own tool list (charts or compact), and each tool
   opened inside the Dashboard: the rail stays, Back returns to the page it
   was opened from, and everything the profile knows is filled in. What's
   changed in a tool stays in that tool. */

import Link from "next/link";
import dynamic from "next/dynamic";
import { ScenarioBar } from "@/components/shell/ScenarioBar";
import type { ToolInputs } from "@/components/tools/ToolState";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { CheckIcon, ChevronLeftIcon } from "lucide-react";
import type { CollegeInputs } from "@/tools/college/model";
import { Button } from "@/components/ui/button";
import { ToolsBrowser, type ToolsLead } from "@/components/tools/ToolsBrowser";
import { ToolCardLink } from "@/components/tools/ToolCardLink";
import { GrowthChart } from "@/components/home/charts";
import type { PickerData } from "@/components/tools/picker-data";
import { TOOLS, type ToolSub } from "@/lib/tools";
import { Frame, SECTIONS, SignedIn } from "./Frame";
import { Hosted, TOOL_VIEWS, householdOf, seedFor, toolHref } from "./host";
import { useDashboard, type Entry, type Profile } from "./store";
import { applyCollege, collegeNeedOf, sameCollege } from "./college";
import { flow, mixWords, retireMix } from "./flows";
import { money, pctDown } from "./format";
import { holdings, mortgage, results } from "./model";
import { Note } from "./ui";

/** The Dashboard's own tools beside the site's: the Advanced calculator,
    to try anything on with every input open (the Calculator tab keeps the
    plan's facts fixed), and Compare, for its saved scenarios. */
export type DashTool = ToolSub | "advanced";
const NAMES: Record<"advanced", string> = { advanced: "Advanced Calculator" };
const nameOf = (sub: DashTool) => (sub === "advanced" ? NAMES.advanced : TOOLS[sub].name);
const Advanced = dynamic(() => import("@/tools/advanced/Advanced").then((m) => m.Advanced), { ssr: false });
const VIEWS: Record<DashTool, React.ComponentType> = { ...TOOL_VIEWS, advanced: Advanced };
/** The site's own page for a tool, which a share link opens. */
const sitePath = (sub: DashTool) => "/" + (sub === "advanced" ? "advanced" : TOOLS[sub].path);

/** The tab that holds a tool's figures for the plan itself. */
const PLAN_TAB: Partial<Record<DashTool, { id: string; name: string; hash?: string }>> = {
  advanced: { id: "calculator", name: "Calculator" },
  budget: { id: "spending", name: "Spending" }, drawdown: { id: "retirement", name: "Retirement" },
  tax: { id: "savings", name: "Taxes & Savings" }, social: { id: "income", name: "Income" },
  college: { id: "profile", name: "Profile", hash: "#college" },
};

/** A line of your own figures for each tool's card. */
function yoursFor(pr: Profile, entries: Entry[]): Partial<Record<ToolSub, string>> {
  const R = results(pr, entries), F = flow(pr), H = holdings(entries, pr), M = mortgage(pr, entries), retire = pr.p1.retire;
  const y: Partial<Record<ToolSub, string>> = {};
  if (R.success != null) y.drawdown = `Your plan: lasted in ${pctDown(R.success)}% of past markets`;
  if (R.atRetire != null) y.optimizer = `Your savings at retirement: ${money(Math.round(R.atRetire / 1000) * 1000)}`;
  if (R.ss != null && !R.abroad) y.social = `Your estimate: ${money(R.ss)} per month${R.ssYear ? " from " + R.ssYear : ""}`;
  if (retire != null) {
    y.bridge = retire < 60 ? `You retire at ${retire}, before 59½` : `You retire at ${retire}, after 59½`;
    y.healthcare = retire < 65 ? `You retire at ${retire}: ${65 - retire} ${65 - retire === 1 ? "year" : "years"} before Medicare` : `You retire at ${retire}, with Medicare`;
  }
  if (R.S) y.roth = `Traditional at retirement: ${money(Math.round(R.S.P.trad / 1000) * 1000)}`;
  if (F.hasPay) y.fire = `You save ${money(F.invested + F.match)} per month, with the match`;
  y.backtest = `Your mix once retired: ${mixWords(retireMix(pr))}`;
  const need = collegeNeedOf(pr);
  if (need > 0) y.college = `Your plan for college: about ${money(need)} per month`;
  y.rentbuy = pr.home === "rent" && pr.rent ? `You rent at ${money(pr.rent)} per month` : pr.home === "own" ? `You own: ${money(H.equity)} in equity` : undefined;
  if (F.tax) y.tax = `Your taxes: ${money(F.tax.total)} per year`;
  if (F.spend > 0) y.budget = `Your budget: ${money(F.spend)} per month`;
  if (pr.home === "own") y.mortgage = M.owed > 0 ? (M.payoff != null ? `Paid off in ${Math.floor(M.payoff)}, at today's payment` : `${money(M.owed)} left on the mortgage`) : "No mortgage";
  y.debt = H.debts > 0 ? `Your debts besides the mortgage: ${money(H.debts)}` : H.accounts ? "No other debts entered" : undefined;
  return y;
}

/** The Advanced Calculator's icon: a calculator, in the plan's own color. */
const CALC_ICON = (
  <span className="toolcard-icon" aria-hidden="true" style={{ "--tool-hue": "var(--ds-series-plan)" } as React.CSSProperties}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="3" width="14" height="18" rx="2.5" /><path d="M8.5 7.5h7" /><path d="M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 15.5h.01M12 15.5h.01M15.5 15.5v.01" />
    </svg>
  </span>
);
const CALC_HREF = "/dashboard/tools/advanced";
const CALC_Q = "What will my savings grow to, with the changes I see coming?";

/** The Advanced Calculator's card and tile, ahead of the site's tools. */
function calcLead(data: PickerData, yours: string | undefined): ToolsLead {
  const top = <div className="toolcard-top">{CALC_ICON}<div className="toolcard-name">{NAMES.advanced}</div><div className="toolcard-arrow">&#8250;</div></div>;
  return {
    // First and widest in Saving and investing, with the rest a third each.
    group: "Saving and investing",
    layout: [["rentbuy", "third"], ["fire", "third"], ["backtest", "third"], ["college", "third"]],
    charts: (
      <ToolCardLink href={CALC_HREF} sub="advanced" i={0} className="tp-card tp-lead" charted>
        {top}
        <div className="tp-lead-body">
          <div>
            <h3 className="tp-lead-q">{CALC_Q}</h3>
            <p className="toolcard-desc">The Advanced Calculator, filled in from your plan with every input open: balances, saving, returns, taxes and the changes ahead. Try anything. Your plan stays as it is.</p>
            {yours ? <div className="tp-yours">{yours}</div> : null}
          </div>
          <div className="tp-chart"><GrowthChart values={data.growth} /></div>
        </div>
      </ToolCardLink>
    ),
    compact: (
      <ToolCardLink href={CALC_HREF} sub="advanced" i={0} className="tp-tile">
        {CALC_ICON}
        <div className="tp-tile-text">
          <div className="toolcard-name">{NAMES.advanced}</div>
          <div className="toolcard-desc">{CALC_Q}</div>
          {yours ? <div className="tp-yours">{yours}</div> : null}
        </div>
        <div className="toolcard-arrow">&#8250;</div>
      </ToolCardLink>
    ),
  };
}

function ToolsList({ data }: { data: PickerData }) {
  const { data: d } = useDashboard();
  const yours = useMemo(() => yoursFor(d.profile, d.entries), [d.profile, d.entries]);
  const atRetire = useMemo(() => results(d.profile, d.entries).atRetire, [d.profile, d.entries]);
  const lead = calcLead(data, atRetire != null ? `Your plan: ${money(Math.round(atRetire / 1000) * 1000)} at retirement, in today's dollars` : undefined);
  return (
    <Frame current="tools" title="Tools" sub="Each one opens here, with what you've told us filled in">
      <ToolsBrowser data={data} hrefFor={(sub) => toolHref(sub, "/dashboard/tools")} yours={yours} lead={lead} />
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
/* What each tool held when you left it, for the visit: coming back to a
   tool finds it as you left it (Reset goes back to your plan's figures). */
const kept = new Map<string, ToolInputs>();

function Tool({ sub }: { sub: DashTool }) {
  const { data, setProfile } = useDashboard();
  // College Savings' figures as they stand, for "Apply to my plan".
  const [college, setCollege] = useState<CollegeInputs | null>(null);
  const [applied, setApplied] = useState(false);
  const apply = college && !sameCollege(data.profile, college) ? applyCollege(data.profile, college) : null;
  const mismatch = sub === "college" && college != null && apply == null && !sameCollege(data.profile, college);
  const back = useSyncExternalStore(noop, fromNow, () => "/dashboard/tools");
  const backName = back === "/dashboard" ? "Dashboard" : back.startsWith("/dashboard/learn/") ? "the lesson" : SECTIONS.find((s) => back === "/dashboard/" + s.id)?.name ?? "Tools";
  // The profile as the tool opens; later changes to the profile don't reach
  // a tool already open, and the tool's own changes never reach the profile.
  const seed = useMemo(() => seedFor(data.profile, data.entries), [data.profile, data.entries]);
  const opening = useCallback((id: string) => kept.get(id) ?? seed(id), [seed]);
  const household = useMemo(() => householdOf(data.profile, data.entries), [data.profile, data.entries]);
  const View = VIEWS[sub], tab = PLAN_TAB[sub];
  return (
    <Frame current="tools" title={nameOf(sub)} help={sub === "advanced" ? undefined : sub}
      sub={tab ? undefined : "Filled in from your Dashboard. Changes here stay in this tool."}
      actions={<>
        {/* Saved scenarios, the site's own lists: one saved here is there too.
            Reset goes back to your plan's figures. */}
        <ScenarioBar compareHref="/dashboard/tools/compare" resetTo={(id) => seed(id)} sharePath={sitePath(sub)} />
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
          <Note>Filled in from your plan, to try things on. Changes here don&apos;t change it. To change your plan, use <Button variant="link" size="inline" nativeButton={false} render={<Link href={"/dashboard/" + tab.id + (tab.hash ?? "")} />}>{tab.name}</Button>.</Note>
        </div>
      ) : null}
      <div className={tab ? "dsh-r4" : undefined}><Hosted key={sub} seed={opening} household={household} scenarios
        keep={(id, d) => { kept.set(id, d); if (sub === "college" && id === "college") { setCollege(d as unknown as CollegeInputs); setApplied(false); } }}><View /></Hosted></div>
    </Frame>
  );
}

export function ToolPage({ sub }: { sub: DashTool }) {
  return <SignedIn><Tool sub={sub} /></SignedIn>;
}

/* Compare: the site's own, on the Dashboard's page. */
const CompareView = dynamic(() => import("@/tools/compare/Compare").then((m) => m.Compare), { ssr: false });
function CompareTool() {
  return (
    <Frame current="tools" title="Compare scenarios" sub="Saved Basic and Advanced scenarios side by side. Nothing here changes your plan."
      actions={<Button variant="outline" nativeButton={false} render={<Link href="/dashboard/tools/advanced" />}><ChevronLeftIcon aria-hidden="true" />Back to the Advanced Calculator</Button>}>
      <div className="dsh-embed"><CompareView /></div>
    </Frame>
  );
}
export function ComparePage() {
  return <SignedIn><CompareTool /></SignedIn>;
}
