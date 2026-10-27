"use client";

/* Plan summary: the whole plan on one page. Paycheck to Retirement's own
   summary cards (the answer, where your pay goes, your accounts, the climb,
   what the children cost, your life stages), run on the dashboard's
   numbers, with the dashboard's own pieces around them: the budget, net
   worth today, the drawdown, Your timeline and where you stand. */

import Link from "next/link";
import { useMemo } from "react";
import { CalendarDaysIcon, ChartBarIcon, ListChecksIcon, MilestoneIcon, ReceiptIcon, SunsetIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShareBar } from "@/components/charts/Legend";
import { SERIES } from "@/lib/hues";
import { budgetGroups } from "@/tools/budget/model";
import { PLAN_DEFAULTS, type PlanState } from "@/tools/plan/model";
import { planSummary, type PlanSummary } from "@/tools/plan/results";
import { Accounts as PlanAccounts, ChildrenCost, Climb, PayCard, StageLine } from "@/tools/plan/Summary";
import type { ToolInputs } from "@/components/tools/ToolState";
import { Legend, TodayBars } from "./Accounts";
import { Frame } from "./Frame";
import { advancedFor, calcInputs, planKidsOf } from "./calc";
import { bridgeSummary, earlyRetirees } from "./bridge";
import { yearlySaving } from "./cover";
import { budgetFor, flow } from "./flows";
import { money } from "./format";
import { ageOf, answers, holdings, nowYear, results, spendMonth, type Results } from "./model";
import { nextSteps } from "./nextsteps";
import { Readiness, timeline } from "./Overview";
import { Timeline } from "./charts";
import { entryFrom, netWorth, sum, useDashboard, type Entry, type Profile } from "./store";
import { Note, Tile, TipLabel } from "./ui";

/** The answer, from the plan itself: what you'll have at retirement, what
    your withdrawal strategy and Social Security pay the first year against
    what you plan to spend, and how often it lasted across history. */
function PlanHero() {
  const { data } = useDashboard();
  const pr = data.profile;
  const R = useMemo(() => results(pr, data.entries), [pr, data.entries]);
  const ss = R.abroad ? 0 : R.ss ?? 0;
  const goal = pr.retSpend ?? spendMonth(pr) ?? 0, ownRate = pr.ddOwn?.rate != null;
  const tax = R.abroad ? ", before taxes" : "";
  return (
    <Tile icon={SunsetIcon} title="Your plan">
      <div className="dsh-stats">
        <div className="dsh-stat"><div className="dsh-label">Savings at retirement{R.retireYear ? ", " + R.retireYear : ""}</div><div className="dsh-fig dsh-key">{R.atRetire != null ? money(Math.round(R.atRetire / 1000) * 1000) : "—"}</div></div>
        <div className="dsh-stat"><div className="dsh-label">{ownRate ? <TipLabel text="Your strategy spends" id="stratSpend" /> : <TipLabel text="You plan to spend" id="retSpend" />}</div><div className="dsh-fig dsh-md">{money(R.spend ?? goal)}<small>per month</small></div>{ownRate && R.goal != null ? <div className="dsh-cap dsh-mt6">Your goal: {money(R.goal)}</div> : null}</div>
        {!R.abroad ? <div className="dsh-stat"><div className="dsh-label"><TipLabel text="Taxes, on top" id="taxes" /></div><div className="dsh-fig dsh-md">{R.S ? money(R.S.taxYr / 12) : "—"}<small>per month</small></div></div> : null}
        {!R.abroad ? <div className="dsh-stat"><div className="dsh-label"><TipLabel text={"Social Security" + (R.ssYear ? ", from " + R.ssYear : "")} id="ssTotal" /></div><div className="dsh-fig dsh-md">{money(ss)}<small>per month</small></div></div> : null}
        <div className="dsh-stat"><div className="dsh-label"><TipLabel text="Chance of success" id="chance" /></div><div className="dsh-fig dsh-md">{R.success != null ? Math.round(R.success * 100) + "%" : "—"}</div></div>
      </div>
      <p className="dsh-cap dsh-mt">
        {R.success != null ? <>Your plan lasted to 95 in <b>{Math.round(R.success * 100)}%</b> of past markets since 1926, {R.strategy ? <>drawing down with <b>{R.strategy.name}</b></> : "spending a fixed amount that rises with prices"}. Social Security pays part of your spending and taxes once it starts; savings pay the rest. In today&apos;s dollars{tax}.</> : R.gap ?? "Fills in once your profile has your ages, savings, retirement age and spending."}
      </p>
    </Tile>
  );
}

/** What the children cost the plan, from the plan: the saving their costs
    take (beyond what they cost today, which the budget already pays) from
    the accounts "How will you cover it?" says, what the budget has to cover
    when they cost more than is saved, and the plan's savings at retirement
    without them. */
function withPlanChildren(S: PlanSummary, pr: Profile, entries: Entry[]): PlanSummary {
  if (!S.children) return S;
  const a = answers(pr, entries), F = flow(pr);
  if (!F.hasPay || a.age == null || a.retire == null) return S;
  // The children and their college, each year against that year's saving
  // without them, taken from the accounts the profile says; so all three
  // figures (saving given up, spending cut, the balance) count the same.
  const college = Array.from({ length: a.retire - a.age }, (_, k) => (a.events ?? []).reduce((t, e) => t + (e.kind === "custom" && e.label === "College" && a.age! + k >= e.from && (e.to == null || a.age! + k < e.to) ? -e.delta : 0), 0));
  const Y = yearlySaving(pr, F, a, { college });
  const fromSaving = Y.rows.reduce((t, r, k) => t + Math.max(0, Y.base[k] - (r.t + r.r + r.b)) * 12, 0);
  const fromSpending = Y.rows.reduce((t, r) => t + r.short * 12, 0);
  const none = { ...pr, kids: 0, planned: { ...pr.planned, count: 0 } };
  const without = results(none, entries).S?.fv ?? S.children.without;
  return { ...S, children: { ...S.children, fromSaving, fromSpending, without } };
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
      tools: { budget: { ...budgetFor(pr), view: "paycheck" } as unknown as ToolInputs, advanced: advancedFor(pr, data.entries) as unknown as ToolInputs, stages: calcInputs(pr, data.entries) as unknown as ToolInputs },
      stagesOn: true, kids: planKidsOf(pr), cover: (pr.kidCover ?? {}) as PlanState["cover"],
    };
    const out = planSummary(plan, null);
    return out ? withPlanChildren(out, pr, data.entries) : null;
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

      <EarlyRetirement pr={pr} entries={data.entries} R={R} />

      <div className="dsh-grid dsh-two">
        <Tile icon={ReceiptIcon} title="Your budget" right={<span className="dsh-cap">{money(F.spend)} per month</span>}>
          <div className="dsh-mt">
            {groups.length ? groups.map((g, i) => <ShareBar key={g.group} label={g.group} value={g.yr / 12} share={total > 0 ? g.yr / total : 0} color={SERIES.lavender} idx={i} pct />)
              : <p className="dsh-cap">Spending is one number for now. Add detail on Spending.</p>}
          </div>
          <div className="dsh-foot dsh-cap">
            <span>Emergency fund goal: <b>{F.efMonths} months, {money(F.efTarget)}</b>{H.cash != null ? <>; you have {money(H.cash)}</> : null}.
            {F.college > 0 ? <> Saving {money(F.college)} per month for college.</> : null}</span>
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
          {S.children ? <ChildrenCost S={S} withoutWords="without children or their college" /> : null}
          {S.stages ? <StageLine S={S} /> : null}
        </div>
      ) : null}

      <div className="dsh-r4">
        <Readiness R={R} pr={pr} entries={data.entries} />
      </div>

      {tl.lanes.length ? (
        <div className="dsh-r4">
          <Tile icon={CalendarDaysIcon} title="Your timeline" right={<span className="dsh-cap">Today is the dashed line</span>}>
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

/** Retiring before 59½: the years until retirement accounts open, and the
    bridge plan that pays for them (or that there isn't one yet). */
function EarlyRetirement({ pr, entries, R }: { pr: Profile; entries: Entry[]; R: Results }) {
  const early = earlyRetirees(pr)[0];
  const B = useMemo(() => (early && pr.bridge ? bridgeSummary(pr, entries, R) : null), [early, pr, entries, R]);
  if (!early) return null;
  const yrs = early.years % 1 ? early.years.toFixed(1) : String(early.years);
  return (
    <div className="dsh-r4">
      <Tile icon={MilestoneIcon} title="Early retirement" right={<Button variant="link" size="inline" nativeButton={false} render={<Link href="/dashboard/retirement#bridge" />}>{B ? "See the bridge" : "Plan the bridge"}</Button>}>
        <div className="dsh-stats">
          <div className="dsh-stat"><div className="dsh-label">{early.name === "You" ? "You retire" : early.name + " retires"}</div><div className="dsh-fig dsh-md">{early.from}<small>age {early.retire}</small></div></div>
          <div className="dsh-stat"><div className="dsh-label">Years before 59½</div><div className="dsh-fig dsh-md">{yrs}</div><div className="dsh-cap dsh-mt6">to {Math.floor(early.to)}</div></div>
          {B ? <>
            <div className="dsh-stat"><div className="dsh-label">Bridge plan</div><div className="dsh-fig dsh-md">{B.plan}</div></div>
            <div className="dsh-stat"><div className="dsh-label">Lasted to 59½</div><div className="dsh-fig dsh-md">{Math.round(B.hold * 100)}%</div><div className="dsh-cap dsh-mt6">of past markets</div></div>
            <div className="dsh-stat"><div className="dsh-label">Taxes, penalties and health cover</div><div className="dsh-fig dsh-md">{money(B.tax + B.pen + B.health)}</div><div className="dsh-cap dsh-mt6">over the bridge</div></div>
            <div className="dsh-stat"><div className="dsh-label">Left at 59½</div><div className="dsh-fig dsh-md">{money(Math.round(B.left / 1000) * 1000)}</div></div>
          </> : <div className="dsh-stat"><div className="dsh-label">Bridge plan</div><div className="dsh-fig dsh-md">Not planned yet</div><div className="dsh-cap dsh-mt6">{R.bridgeDock > 0 ? `${R.bridgeDock} points held back from your readiness score` : "Plan it on Retirement"}</div></div>}
        </div>
      </Tile>
    </div>
  );
}
