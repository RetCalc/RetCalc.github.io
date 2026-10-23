"use client";

/* Plan summary: the whole plan on one page. Paycheck to Retirement's own
   summary cards (the answer, where your pay goes, your accounts, the climb,
   what the children cost, your life stages), run on the dashboard's
   numbers, with the dashboard's own pieces around them: the budget, net
   worth today, the drawdown, Your timeline and where you stand. */

import Link from "next/link";
import { useMemo } from "react";
import { CalendarDaysIcon, ChartBarIcon, ListChecksIcon, ReceiptIcon, SunsetIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShareBar } from "@/components/charts/Legend";
import { SERIES } from "@/lib/hues";
import { budgetGroups } from "@/tools/budget/model";
import { PLAN_DEFAULTS, type PlanState } from "@/tools/plan/model";
import { planSummary } from "@/tools/plan/results";
import { Accounts as PlanAccounts, ChildrenCost, Climb, PayCard, StageLine } from "@/tools/plan/Summary";
import type { ToolInputs } from "@/components/tools/ToolState";
import { Legend, TodayBars } from "./Accounts";
import { Frame } from "./Frame";
import { advancedFor, planKidsOf, stagesFor } from "./calc";
import { budgetFor, flow } from "./flows";
import { money, money10 } from "./format";
import { ageOf, holdings, nowYear, results, spendMonth } from "./model";
import { nextSteps } from "./nextsteps";
import { Readiness, timeline } from "./Overview";
import { Timeline } from "./charts";
import { entryFrom, netWorth, sum, useDashboard } from "./store";
import { Note, Tile } from "./ui";

/** The answer, from the plan itself: what you'll have at retirement, what
    your withdrawal strategy and Social Security pay the first year against
    what you plan to spend, and how often it lasted across history. */
function PlanHero() {
  const { data } = useDashboard();
  const pr = data.profile;
  const R = useMemo(() => results(pr, data.entries), [pr, data.entries]);
  // The first year's spending (taxes and premiums included), as the strategy
  // sets it; Social Security pays part of it once claimed, savings the rest.
  const first = R.strategy ? R.strategy.first : R.S ? (R.S.spend + R.S.taxYr) / 12 : null;
  const ssYear = R.claim1 != null && pr.p1.by ? pr.p1.by + R.claim1 : null;
  const ss = R.abroad ? 0 : R.ss ?? 0;
  const goal = pr.retSpend ?? spendMonth(pr) ?? 0;
  const tax = R.abroad ? ", before taxes" : "";
  return (
    <Tile icon={SunsetIcon} title="Your plan">
      <div className="dsh-stats">
        <div className="dsh-stat"><div className="dsh-label">Savings at retirement{R.retireYear ? ", " + R.retireYear : ""}</div><div className="dsh-fig dsh-key">{R.atRetire != null ? money(Math.round(R.atRetire / 1000) * 1000) : "—"}</div></div>
        <div className="dsh-stat"><div className="dsh-label">First year&apos;s spending, with taxes{tax}</div><div className="dsh-fig">{first != null ? money10(first) : "—"}<small>per month</small></div></div>
        {!R.abroad ? <div className="dsh-stat"><div className="dsh-label">Social Security{ssYear ? ", from " + ssYear : ""}</div><div className="dsh-fig">{money10(ss)}<small>per month</small></div></div> : null}
        <div className="dsh-stat"><div className="dsh-label">You plan to spend</div><div className="dsh-fig">{money(goal)}<small>per month</small></div></div>
        <div className="dsh-stat"><div className="dsh-label">Chance of success</div><div className="dsh-fig">{R.success != null ? Math.round(R.success * 100) + "%" : "—"}</div></div>
      </div>
      <p className="dsh-cap dsh-mt">
        {R.success != null ? <>Your plan lasted to 95 in <b>{Math.round(R.success * 100)}%</b> of past markets since 1926, {R.strategy ? <>drawing down with <b>{R.strategy.name}</b></> : "spending a fixed amount that rises with prices"}. Social Security pays part of what you spend once it starts; savings pay the rest. In today&apos;s dollars{tax}.</> : "Fills in once your profile has your ages, savings, retirement age and spending."}
      </p>
    </Tile>
  );
}

export function Summary() {
  const { data } = useDashboard();
  const pr = data.profile;
  const R = useMemo(() => results(pr, data.entries), [pr, data.entries]);
  const F = flow(pr);
  // The dashboard as Paycheck to Retirement's plan: its paycheck, its
  // calculator and its children, so its summary runs on the same numbers.
  const S = useMemo(() => {
    const age = ageOf(pr.p1);
    if (age == null || !pr.p1.retire) return null;
    const plan: PlanState = {
      ...PLAN_DEFAULTS, step: "summary" as PlanState["step"], reached: "summary" as PlanState["reached"],
      age: String(age), retire: String(pr.p1.retire), freq: F.b.pcFreq,
      tools: { budget: { ...budgetFor(pr), view: "paycheck" } as unknown as ToolInputs, advanced: advancedFor(pr, data.entries) as unknown as ToolInputs, stages: stagesFor(pr, data.entries) as unknown as ToolInputs },
      stagesOn: true, kids: planKidsOf(pr), cover: (pr.kidCover ?? {}) as PlanState["cover"],
    };
    return planSummary(plan, null);
  }, [pr, data.entries, F.b.pcFreq]);
  const last = data.entries[data.entries.length - 1] ?? entryFrom(pr);
  const items = last?.items ?? [];
  const groups = budgetGroups(F.b), total = groups.reduce((s, g) => s + g.yr, 0);
  const tl = timeline(data, R);
  const steps = nextSteps(data, R, 5);
  const H = holdings(data.entries, pr);

  return (
    <Frame current="summary" title="Plan summary" sub="Everything we know, on one page">
      {S ? (
        <div className="dsh-psum">
          <PlanHero />
          <PayCard S={S} />
        </div>
      ) : <Note>The summary fills in once your profile has your age, retirement age and pay.</Note>}

      <div className="dsh-grid dsh-two">
        <Tile icon={ReceiptIcon} title="Your budget" right={<span className="dsh-cap">{money(F.spend)} per month</span>}>
          <div className="dsh-mt">
            {groups.length ? groups.map((g, i) => <ShareBar key={g.group} label={g.group} value={g.yr / 12} share={total > 0 ? g.yr / total : 0} color={SERIES.lavender} idx={i} pct />)
              : <p className="dsh-cap">Spending is one number for now. Add detail on Spending.</p>}
          </div>
          <div className="dsh-foot dsh-cap">
            Emergency fund goal: <b>{F.efMonths} months, {money(F.efTarget)}</b>{H.cash != null ? <>; you have {money(H.cash)}</> : null}.
            {F.college > 0 ? <> Saving {money10(F.college)} per month for college.</> : null}
          </div>
        </Tile>
        <Tile icon={ChartBarIcon} title="Net worth today" right={<span className="dsh-cap">{last ? money(netWorth(last)) : "—"}</span>}>
          <div className="dsh-stats">
            <div className="dsh-stat"><div className="dsh-label">Assets</div><div className="dsh-fig dsh-md">{money(sum(items, "asset"))}</div></div>
            <div className="dsh-stat"><div className="dsh-label">Debts</div><div className="dsh-fig dsh-md">{money(sum(items, "debt"))}</div></div>
          </div>
          <div className="dsh-mt"><TodayBars items={items} /></div>
          <Legend />
        </Tile>
      </div>

      {S ? (
        <div className="dsh-psum dsh-r4">
          <PlanAccounts S={S} />
          <Climb S={S} />
          {S.children ? <ChildrenCost S={S} /> : null}
          {S.stages ? <StageLine S={S} /> : null}
        </div>
      ) : null}

      <div className="dsh-r4">
        <Readiness R={R} pr={pr} entries={data.entries} />
      </div>

      {tl.lanes.length ? (
        <div className="dsh-r4">
          <Tile icon={CalendarDaysIcon} title="Your timeline" right={<span className="dsh-cap">Today is the amber line</span>}>
            <div className="dsh-mt"><Timeline lanes={tl.lanes} from={tl.from} to={tl.to} now={nowYear()} /></div>
          </Tile>
        </div>
      ) : null}

      <div className="dsh-r4">
        <Tile icon={ListChecksIcon} title="What to do next" right={<Button variant="link" size="inline" nativeButton={false} render={<Link href="/dashboard/next" />}>All next steps</Button>}>
          <ol className="dsh-steps">
            {steps.map((s, i) => (
              <li key={s.id} className="dsh-step"><span className="dsh-num">{i + 1}</span><div><b>{s.title}</b><span>{s.why}</span></div><Button variant="outline" size="sm" nativeButton={false} render={<Link href={s.href} />}>{s.action}</Button></li>
            ))}
          </ol>
        </Tile>
      </div>
    </Frame>
  );
}
