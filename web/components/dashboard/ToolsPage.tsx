"use client";

/* Tools: the site's own tool list (charts or compact), and each tool
   opened inside the Dashboard: the rail stays, Back returns to the page it
   was opened from, and everything the profile knows is filled in. What's
   changed in a tool stays in that tool. */

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { ChevronLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToolsBrowser } from "@/components/tools/ToolsBrowser";
import type { PickerData } from "@/components/tools/picker-data";
import { TOOLS, type ToolSub } from "@/lib/tools";
import { Frame, SECTIONS, SignedIn } from "./Frame";
import { Hosted, TOOL_VIEWS, householdOf, seedFor, toolHref } from "./host";
import { useDashboard } from "./store";
import { Note } from "./ui";

/** The tab that holds a tool's figures for the plan itself. */
const PLAN_TAB: Partial<Record<ToolSub, { id: string; name: string }>> = {
  budget: { id: "spending", name: "Spending" }, drawdown: { id: "retirement", name: "Retirement" },
  tax: { id: "taxes", name: "Taxes" }, social: { id: "income", name: "Income" },
};

export function ToolsListPage({ data }: { data: PickerData }) {
  return (
    <SignedIn>
      <Frame current="tools" title="Tools" sub="Each one opens here, with what you've told us filled in">
        <ToolsBrowser data={data} hrefFor={(sub) => toolHref(sub, "/dashboard/tools")} />
      </Frame>
    </SignedIn>
  );
}

/* The page a tool was opened from, from its address: a dashboard page only. */
const fromNow = () => {
  const f = new URLSearchParams(window.location.search).get("from");
  return f && f.startsWith("/dashboard") ? f : "/dashboard/tools";
};
const noop = () => () => {};

function Tool({ sub }: { sub: ToolSub }) {
  const { data } = useDashboard();
  const back = useSyncExternalStore(noop, fromNow, () => "/dashboard/tools");
  const backName = back === "/dashboard" ? "Overview" : SECTIONS.find((s) => back === "/dashboard/" + s.id)?.name ?? "Tools";
  // The profile as the tool opens; later changes to the profile don't reach
  // a tool already open, and the tool's own changes never reach the profile.
  const seed = useMemo(() => seedFor(data.profile, data.entries), [data.profile, data.entries]);
  const household = useMemo(() => householdOf(data.profile, data.entries), [data.profile, data.entries]);
  const View = TOOL_VIEWS[sub], tab = PLAN_TAB[sub];
  return (
    <Frame current="tools" title={TOOLS[sub].name}
      sub="Filled in from your dashboard. Changes here stay in this tool."
      actions={<Button variant="outline" nativeButton={false} render={<Link href={back} />}><ChevronLeftIcon aria-hidden="true" />Back to {backName}</Button>}>
      {tab ? (
        <div>
          <Note>Filled in from your plan, to try things on: changes here don&apos;t change it. To change your plan, use <Link href={"/dashboard/" + tab.id} className="underline underline-offset-4">{tab.name}</Link>.</Note>
        </div>
      ) : null}
      <div className={tab ? "dsh-r4" : undefined}><Hosted key={sub} seed={seed} household={household}><View /></Hosted></div>
    </Frame>
  );
}

export function ToolPage({ sub }: { sub: ToolSub }) {
  return <SignedIn><Tool sub={sub} /></SignedIn>;
}
