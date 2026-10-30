"use client";

/* Plan summary: the whole plan on one page. Paycheck to Retirement's own
   summary cards (the answer, where your pay goes, your accounts, the climb,
   what the children cost, your life stages), run on the dashboard's
   numbers, with the dashboard's own pieces around them: the budget, net
   worth today, the drawdown, Your timeline and where you stand. */

import Link from "next/link";
import { useMemo } from "react";
import { BabyIcon, CalendarDaysIcon, ChartBarIcon, GaugeIcon, HeartPulseIcon, ListChecksIcon, MilestoneIcon, ReceiptIcon, SunsetIcon, TrendingUpIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShareBar } from "@/components/charts/Legend";
import { SERIES } from "@/lib/hues";
import { budgetGroups } from "@/tools/budget/model";
import { PLAN_DEFAULTS, type PlanState } from "@/tools/plan/model";
import { planSummary, type PlanSummary } from "@/tools/plan/results";
import { sim } from "@/tools/guide/calc";
import { childCost, children } from "@/tools/guide/schedule";
import { Accounts as PlanAccounts, ChildrenCost, Climb, PayCard, StageLine } from "@/tools/plan/Summary";
import type { ToolInputs } from "@/components/tools/ToolState";
import { Legend, TodayBars } from "./Accounts";
import { Frame } from "./Frame";
import { ReportButton } from "./report/ReportButton";
import { advancedFor, calcInputs, planKidsOf } from "./calc";
import { bridgeSummary, earlyRetirees } from "./bridge";
import { yearlySaving } from "./cover";
import { budgetFor, flow } from "./flows";
import { lastedWords, money, pctDown } from "./format";
import { FACTORS, ageOf, answers, areaPoints, holdings, nameOf, nowYear, results, spendMonth, toAges, type Results } from "./model";
import { collegeChildren } from "./college";
import { nextSteps } from "./nextsteps";
import { Readiness, timeline } from "./Overview";
import { Timeline } from "./charts";
import { entryFrom, netWorth, sum, useDashboard, type Entry, type Profile } from "./store";
import { Fold, Note, Tile, TipLabel, To } from "./ui";
import { healthGap, healthWords } from "./health";

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
        <div className="dsh-stat"><div className="dsh-label"><TipLabel text="Chance of success" id="chance" /></div><div className="dsh-fig dsh-md">{R.success != null ? pctDown(R.success) + "%" : "—"}</div></div>
      </div>
      <p className="dsh-cap dsh-mt">
        {R.success != null ? <>Your plan lasted to {toAges(R)} in <b>{lastedWords(R.success, R.runs)}</b>, {R.strategy ? <>drawing down with <b>{R.strategy.name}</b></> : "spending a fixed amount that rises with prices"}. Social Security pays part of your spending and taxes once it starts, and savings pay the rest. In today&apos;s dollars{tax}.</> : R.gap ?? "Fills in once your profile has your ages, savings, retirement age and spending."}
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
  // Without them: no children, and what they take from the budget today
  // (their costs this year and the college line) saved instead, every year
  // to retirement. Leaving that money in the budget would count it as spent
  // either way, so the plan with children came out ahead once they'd grown.
  const kidsNow = children(a).filter((c) => !c.planned);
  const extra = kidsNow.reduce((t, c) => t + childCost(c, Math.round(a.age!)), 0) + F.college;
  const a0 = answers({ ...pr, kids: 0, planned: { ...pr.planned, count: 0 }, college: { ...pr.college, help: "none" } }, entries);
  a0.contrib = (a0.contrib ?? 0) + extra;
  if (a0.yearly) a0.yearly = a0.yearly.map((y) => ({ ...y, b: y.b + extra }));
  if (a0.yearlyBase != null) a0.yearlyBase += extra;
  const without = sim(a0)?.fv ?? S.children.without;
  // Each child by name, in the plan's order (the ones you have, then the
  // ones planned): its rows are labeled "Child 1", "Child 2"...
  const names = collegeChildren(pr).filter((c) => c.planned || (c.age >= 0 && c.age < 30)).map((c) => c.name);
  const rows = S.children.rows.map((r) => { const i = Number(r.label.replace(/^Child /, "")) - 1; return names[i] ? { ...r, label: names[i] } : r; });
  return { ...S, children: { ...S.children, rows, fromSaving, fromSpending, without } };
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
    <Frame current="summary" title="Plan summary" sub="Everything we know, on one page" actions={<ReportButton />}>
      {S ? (
        <div className="dsh-psum">
          <PlanHero />
          <PayCard S={S} />
        </div>
      ) : <Note>The summary fills in once your profile has your age, retirement age and pay.</Note>}

      <EarlyRetirement pr={pr} entries={data.entries} R={R} />
      <HealthCover pr={pr} R={R} />

      <div className="dsh-grid dsh-two">
        <Tile icon={ReceiptIcon} title="Your budget" right={<span className="dsh-cap">{money(F.spend)} per month</span>}>
          <div className="dsh-mt">
            {groups.length ? groups.map((g, i) => <ShareBar key={g.group} label={g.group} value={g.yr / 12} share={total > 0 ? g.yr / total : 0} color={SERIES.lavender} idx={i} pct />)
              : <p className="dsh-cap">Spending is one number for now. Add detail on Spending.</p>}
          </div>
          <div className="dsh-foot dsh-cap">
            <span>Emergency fund goal: <b>{F.efMonths} months, {money(F.efTarget)}</b>{H.cash != null ? <>. You have {money(H.cash)}</> : null}.
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

      {/* The rest folds to a line each, opened for the whole of it. */}
      {S ? (
        <Fold icon={TrendingUpIcon} title="Saving to retirement" className="dsh-psum"
          summary={<>{money(S.atRetire.total)} at {S.retire}, in today&apos;s dollars: your accounts, the climb year by year{S.stages ? " and your life stages" : ""}</>}>
          <PlanAccounts S={S} />
          <Climb S={S} />
          {S.stages ? <StageLine S={S} /> : null}
        </Fold>
      ) : null}
      {S?.children ? (
        <Fold icon={BabyIcon} title="What the children cost" className="dsh-psum"
          summary={<>{money(S.children.total)} until you retire at {S.retire}, at the most {money(S.children.peak.monthly)} per month</>}>
          <ChildrenCost S={S} withoutWords="without children or their college" dash ageWho={pr.who === "couple" ? nameOf(pr, 0) + "'s age" : "your age"} />
        </Fold>
      ) : null}

      <Fold icon={GaugeIcon} title="Readiness score" summary={readinessLine(R)}>
        <Readiness R={R} pr={pr} entries={data.entries} />
      </Fold>

      {tl.lanes.length ? (
        <Fold icon={CalendarDaysIcon} title="Your timeline" summary={timelineLine(pr)}>
          <Tile icon={CalendarDaysIcon} title="Your timeline" right={<span className="dsh-cap">Today is the dashed line</span>}>
            <div className="dsh-mt"><Timeline lanes={tl.lanes} from={tl.from} to={tl.to} now={nowYear()} /></div>
          </Tile>
        </Fold>
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

/** The readiness score in a line, as its tile says it. */
function readinessLine(R: Results): string {
  if (R.score == null) return "Not scored yet: it needs at least two of its five areas";
  const pts = areaPoints(R.parts, R.score);
  if (!R.partial) return `${R.score} of 100`;
  const avail = FACTORS.reduce((s, f) => s + (R.parts[f.id] ? f.w : 0), 0), got = FACTORS.reduce((s, f) => s + (pts[f.id] ?? 0), 0);
  return `${got} of ${avail} so far, ${100 - avail} points not scored yet`;
}

/** The timeline in a line: when each of you retires. */
function timelineLine(pr: Profile): string {
  const two = pr.who === "couple";
  const parts = (two ? [pr.p1, pr.p2] : [pr.p1]).map((p, i) => (p.by && p.retire ? `${two ? nameOf(pr, i ? 1 : 0) + " retires in " : "You retire in "}${p.by + p.retire}` : null)).filter(Boolean);
  return parts.length ? parts.join("; ") : "Your household along the years";
}

/** The years with no job's health plan before Medicare: called out, with
    what the plan counts for them, and where to plan them. */
function HealthCover({ pr, R }: { pr: Profile; R: Results }) {
  const gap = healthGap(pr);
  if (!gap) return null;
  return (
    <div className="dsh-r4">
      <Tile icon={HeartPulseIcon} title="Health cover before Medicare" right={<To href="/dashboard/retirement#health">Plan health cover</To>}>
        <div className="dsh-stats">
          <div className="dsh-stat"><div className="dsh-label">With no job&apos;s plan</div><div className="dsh-fig dsh-md">{gap.years} {gap.years === 1 ? "year" : "years"}</div><div className="dsh-cap dsh-mt6">{gap.from} to {gap.to}</div></div>
          <div className="dsh-stat"><div className="dsh-label">Your plan counts</div><div className="dsh-fig dsh-md">{R.S && R.S.hcYr > 0 ? money(R.S.hcYr / 12) : "—"}<small>per month</small></div><div className="dsh-cap dsh-mt6">for marketplace cover, on top of your spending</div></div>
        </div>
        <p className="dsh-cap dsh-mt">{healthWords(pr, gap)} Until Medicare starts, cover is a marketplace plan priced on your income, and it&apos;s often one of the biggest costs of retiring early.</p>
      </Tile>
    </div>
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
