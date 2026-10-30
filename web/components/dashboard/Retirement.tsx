"use client";

/* Retirement: the Drawdown Simulator on your own plan, and, beside it, the
   Early Retirement Bridge (retiring before 59½) and the Healthcare Cost
   Planner. What you'll have at retirement (the Calculator's result), the
   retirement age and Social Security come from the plan and are said in
   place of their fields; the strategy and its settings, the mix once
   retired, the years and the starting rate are chosen here and saved, and
   the chosen strategy is the plan's everywhere (its chance across history
   is the dashboard's chance of success). The strategies are laid out first,
   each in a line, to learn them before choosing. */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowDownToLineIcon, BookOpenIcon, ChevronDownIcon, HeartPulseIcon, MilestoneIcon, SunsetIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { CardHeadingLevel } from "@/components/ui/card-heading";
import type { ToolInputs } from "@/components/tools/ToolState";
import { DD_UI } from "@/tools/drawdown/text";
import { DrawdownDialogs } from "@/tools/drawdown/Dialogs";
import type { DDView } from "@/tools/drawdown/Drawdown";
import { drawdownSetup } from "@/tools/drawdown/model";
import type { DrawdownState } from "@/tools/drawdown/model";
import type { BridgeInputs } from "@/tools/bridge/model";
import type { HealthcareInputs } from "@/tools/healthcare/model";
import { Frame } from "./Frame";
import { DD_LOCKED, DD_OWN, drawdownFor, fromDrawdown, mixWords, retireMix } from "./flows";
import { longDate, money, pctDown } from "./format";
import { Hosted, TOOL_VIEWS } from "./host";
import { couple, holdings, nameOf, people, results, spendMonth, type Results } from "./model";
import { today, useDashboard, type Entry, type Profile } from "./store";
import { bridgeBudget, bridgeChoices, bridgeFor, bridgeLocked, bridgeSummary, earlyRetirees, householdAt, partnerWork } from "./bridge";
import type { BrBudget } from "@/lib/engine/types";
import { healthChoices, healthFor, healthGap, healthWords } from "./health";
import { useLandedOn } from "./land";
import { Note, PlanFacts, Tile, TipLabel, To } from "./ui";

const STRATS_KEY = "retcalc.dashboard.strategiesOpen";
function readStratsOpen() { try { return localStorage.getItem(STRATS_KEY) === "1"; } catch { return false; } }
function saveStratsOpen(v: boolean) { try { localStorage.setItem(STRATS_KEY, v ? "1" : "0"); } catch { /* remembered for this visit only */ } }

const OWN_WORDS: Record<string, string> = { rate: "starting rate", years: "years in retirement" };

/* The address's part ("#bridge"), as it changes. */
const onHash = (f: () => void) => { window.addEventListener("hashchange", f); return () => window.removeEventListener("hashchange", f); };

type Side = "drawdown" | "early" | "health";

export function Retirement() {
  const { data, setProfile: set } = useDashboard();
  const pr = data.profile;
  // The page shows the drawdown, the bridge (retiring before 59½) or health
  // cover, switched under At retirement; a link to one opens on it.
  const early = earlyRetirees(pr).length > 0;
  const hash = useSyncExternalStore(onHash, () => window.location.hash, () => "");
  const [picked, setPicked] = useState<Side | null>(null);
  const fromHash: Side = hash === "#bridge" && early ? "early" : hash === "#health" ? "health" : "drawdown";
  const side: Side = picked === "early" && !early ? "drawdown" : picked ?? fromHash;
  const R = useMemo(() => results(pr, data.entries), [pr, data.entries]);
  const tax = R.abroad ? ", before taxes" : "";
  // Bumped when a strategy is chosen out here, so the simulator opens on it.
  const [rev, setRev] = useState(0);
  const choose = (id: string) => { set((p) => ({ ...p, strategy: id })); setRev((r) => r + 1); };
  const Drawdown = TOOL_VIEWS.drawdown;
  // The strategy the simulator opens on: picking it there is a choice, opening on it isn't.
  const opened = String(drawdownFor(pr, null).strategy);
  const own = DD_OWN.filter((k) => pr.ddOwn?.[k] != null), ownRate = pr.ddOwn?.rate != null;
  const plan = R.ddPlan;
  const gap = healthGap(pr);
  // The simulator's own comparison, on your numbers: "Use this strategy"
  // there chooses it here.
  const [guide, setGuide] = useState(false);
  const [allStrats, setAllStrats] = useState(false);
  // The strategies fold away until opened, and stay as last left.
  const [stratsOpen, setStratsOpen] = useState(readStratsOpen);
  const openStrats = (v: boolean) => { setStratsOpen(v); saveStratsOpen(v); };
  // "Compare strategies" lands on the strategies with the comparison open.
  useLandedOn("compare", useCallback(() => { window.setTimeout(() => setGuide(true), 600); }, [setGuide]));
  const view = useMemo(() => {
    if (!plan) return null;
    const st = drawdownFor(pr, plan);
    return { s: st, set: (k: string) => (v: unknown) => { if (k === "strategy") { set((p) => ({ ...p, strategy: String(v) })); setRev((r) => r + 1); setGuide(false); } }, ...drawdownSetup(st) } as unknown as DDView;
  }, [pr, plan, set, setGuide]);

  return (
    <Frame current="retirement" title="Retirement" sub={R.retireYear ? `Starting ${R.retireYear}` : R.gap ?? "Needs your ages and retirement age"} help={side === "health" ? "dsh-retirement-health" : early ? "dsh-retirement-early" : undefined}>
      <Tile id="at-retirement" icon={SunsetIcon} title="At retirement" right={<To href="/dashboard/profile#plan-retirement">Ages, spending and assumptions</To>}>
        <div className="dsh-stats">
          <div className="dsh-stat"><div className="dsh-label">Savings, {R.retireYear ?? "—"}</div><div className="dsh-fig dsh-key">{R.atRetire != null ? money(Math.round(R.atRetire / 1000) * 1000) : "—"}</div></div>
          <div className="dsh-stat"><div className="dsh-label"><TipLabel text="Chance of success" id="chance" /></div><div className="dsh-fig dsh-md">{R.success != null ? pctDown(R.success) + "%" : "—"}</div><div className="dsh-cap dsh-mt6">{R.strategy ? R.strategy.name : "Spending a fixed amount"}</div></div>
          <div className="dsh-stat"><div className="dsh-label">{ownRate ? <TipLabel text={"Your strategy spends" + tax} id="stratSpend" /> : <TipLabel text={"You plan to spend" + tax} id="retSpend" />}</div><div className="dsh-fig dsh-md">{money(R.spend ?? pr.retSpend ?? spendMonth(pr) ?? 0)}<small>per month</small></div>{ownRate && R.goal != null ? <div className="dsh-cap dsh-mt6">Your goal: {money(R.goal)}</div> : null}</div>
          {!R.abroad ? <div className="dsh-stat"><div className="dsh-label"><TipLabel text="Taxes, on top" id="taxes" /></div><div className="dsh-fig dsh-md">{R.S ? money(R.S.taxYr / 12) : "—"}<small>per month</small></div></div> : null}
          {!R.abroad ? <div className="dsh-stat"><div className="dsh-label"><TipLabel text={"Social Security" + (R.ssYear ? ", from " + R.ssYear : "")} id="ssTotal" /></div><div className="dsh-fig dsh-md">{R.ss != null ? money(R.ss) : "—"}<small>per month</small></div></div> : null}
        </div>
        {gap ? <HealthCallout pr={pr} R={R} onOpen={() => setPicked("health")} here={side === "health"} /> : null}
      </Tile>

      {/* What the page below shows: everything under At retirement changes with it. */}
      <div className="dsh-r4 dsh-retside">
        <Segmented role="group" aria-label="Show" id="retSide">
          <SegmentedItem pressed={side === "drawdown"} onClick={() => setPicked("drawdown")}><ArrowDownToLineIcon aria-hidden="true" />Drawdown</SegmentedItem>
          {early ? <SegmentedItem pressed={side === "early"} onClick={() => setPicked("early")}><MilestoneIcon aria-hidden="true" />Bridge to 59½</SegmentedItem> : null}
          {!R.abroad ? <SegmentedItem pressed={side === "health"} onClick={() => setPicked("health")}><HeartPulseIcon aria-hidden="true" />Health cover</SegmentedItem> : null}
        </Segmented>
      </div>

      {side === "early" ? <BridgeTile /> : null}
      {side === "health" ? <HealthTile /> : null}

      {side === "drawdown" ? <>
      <div className="dsh-r4" id="compare"><Collapsible open={stratsOpen} onOpenChange={openStrats}><Tile id="strategies" icon={BookOpenIcon} title="The withdrawal strategies"
        right={<>{plan ? <Button variant="link" size="inline" onClick={() => setGuide(true)}>How the withdrawal strategies compare</Button> : null}
          <CollapsibleTrigger>{stratsOpen ? "Hide" : "Show all " + Object.keys(DD_UI).length}<ChevronDownIcon aria-hidden="true" /></CollapsibleTrigger></>}>
        <p className="dsh-cap dsh-mt6">{stratsOpen ? "How each decides what you spend each year. Pick one to use it across your plan." : <>Your strategy: <b>{R.strategy?.name ?? "Fixed amount"}</b>. Open the list to read how each one decides what you spend, and to pick a different one.</>}</p>
        <CollapsibleContent variant="plain">
        <div className="dsh-strats" data-all={allStrats ? "" : undefined}>
          {Object.entries(DD_UI).map(([id, u]) => {
            const on = pr.strategy === id;
            return (
              <div className="dsh-strat" key={id} data-on={on ? "" : undefined}>
                <b>{u.card || u.name}</b>
                <span>{u.blurb}</span>
                <Button variant={on ? "default" : "outline"} size="sm" onClick={() => choose(id)}>{on ? "Your strategy" : "Use this one"}</Button>
              </div>
            );
          })}
        </div>
        {/* A phone shows yours (or the first three) until asked for all of them. */}
        <div className="dsh-more">
          <Button variant="outline" onClick={() => setAllStrats((v) => !v)} aria-expanded={allStrats}>{allStrats ? "Show fewer" : "Show all " + Object.keys(DD_UI).length + " strategies"}</Button>
        </div>
        <p className="dsh-cap dsh-mt">For each one&apos;s pros and cons side by side, open &ldquo;How the withdrawal strategies compare&rdquo;. Everything you set in the simulator below is saved to your plan as you change it: the mix, the starting rate, guardrails, floors and ceilings, and a spending path.</p>
        </CollapsibleContent>
      </Tile></Collapsible></div>

      <div className="dsh-r4">
        {plan ? (
          <Tile id="drawdown" icon={ArrowDownToLineIcon} title="Your drawdown" right={<span className="dsh-cap">On your savings at retirement, through every market since 1926</span>}>
            {own.length ? (
              <p className="dsh-cap dsh-mt6">Your own {own.map((k) => OWN_WORDS[k]).join(" and ")} {own.length > 1 ? "are" : "is"} saved to your plan in place of its figures.{ownRate ? " Your strategy's spending is now the plan's, and Profile's spending is your goal." : ""}{" "}
                <Button variant="link" size="inline" onClick={() => { set((p) => ({ ...p, ddOwn: undefined })); setRev((r) => r + 1); }}>Use the plan&apos;s figures</Button></p>
            ) : null}
            <div className="dsh-mt">
              {/* Opened again when the plan under it changes (the claiming ages on Income, say). */}
              <Hosted key={rev + "|" + JSON.stringify([plan, pr.ss.pct, pr.p2.retire])} household={null} locked={DD_LOCKED}
                slots={{ facts: <DrawdownFacts pr={pr} R={R} />, ssFacts: <SocialFacts pr={pr} R={R} /> }}
                seed={(id) => (id === "drawdown" ? (drawdownFor(pr, plan) as unknown as ToolInputs) : undefined)}
                keep={(id, d) => { if (id === "drawdown") set((p) => fromDrawdown(p, d as unknown as DrawdownState, opened, plan)); }}>
                {/* Inside this tile, the simulator's own card titles sit one level down. */}
                <CardHeadingLevel value={3}><Drawdown /></CardHeadingLevel>
              </Hosted>
            </div>
          </Tile>
        ) : <Note>The simulator opens once your profile has your ages, savings, retirement age and spending.</Note>}
      </div>
      </> : null}
      {guide && view ? <DrawdownDialogs v={view} dialog={{ kind: "guide" }} close={() => setGuide(false)} /> : null}
    </Frame>
  );
}

/** Each of you's retirement: "58, in 2041". */
function retireWords(pr: Profile) {
  return people(pr).map((p, k) => p.retire == null ? null : `${couple(pr) ? nameOf(pr, k as 0 | 1) + " at " : ""}${p.retire}${p.by ? ", in " + (p.by + p.retire) : ""}`).filter(Boolean).join("; ");
}

/** What the simulator takes from the plan, in place of its fields. */
function DrawdownFacts({ pr, R }: { pr: Profile; R: Results }) {
  return (
    <PlanFacts id="ddFacts" rows={[
      ["Savings at retirement", R.atRetire != null ? money(Math.round(R.atRetire)) : "—"],
      [couple(pr) ? "Retiring" : "Retiring at", retireWords(pr) || "—"],
    ]} note={<>Savings at retirement come from the <To href="/dashboard/calculator">Calculator</To>, the retirement age from <To href="/dashboard/profile#plan-retirement">Profile</To>. Change them there.</>} />
  );
}

/** Social Security as the plan has it, in place of the simulator's fields. */
function SocialFacts({ pr, R }: { pr: Profile; R: Results }) {
  if (R.abroad) return <p className="dsh-cap">Outside the US, Social Security isn&apos;t counted.</p>;
  const share = pr.ss.pct ?? 100;
  const row = (i: 0 | 1): [string, string] => {
    const ss = i ? R.ss2 : R.ss1, at = i ? R.claim2 : R.claim1;
    return [couple(pr) ? nameOf(pr, i) + "'s Social Security" : "Social Security", ss != null && ss > 0 ? `${money(ss)} per month from ${at ?? 67}` : "None"];
  };
  return (
    <div className="mt-1 mb-2">
      <PlanFacts rows={couple(pr) ? [row(0), row(1)] : [row(0)]}
        note={<>In today&apos;s dollars{share < 100 ? `, at ${share}% of the full benefit` : ""}. The benefits, the ages you claim and the share you expect are set on <To href="/dashboard/income#social-security">Income</To>.</>} />
    </div>
  );
}

/** Retiring before 59½: the years until retirement accounts open, planned
    in the Early Retirement Bridge on the plan's own figures. "Use this
    bridge plan" makes it the plan's (its choices are saved; later changes
    follow), and lifts the points the readiness score holds back. */
function BridgeTile() {
  const { data, setProfile: set } = useDashboard();
  const pr = data.profile, entries = data.entries;
  const R = useMemo(() => results(pr, entries), [pr, entries]);
  const early = earlyRetirees(pr)[0];
  const B = useMemo(() => (early && pr.bridge ? bridgeSummary(pr, entries, R) : null), [early, pr, entries, R]);
  // What Retirement's strategy withdraws in the bridge years, market by market.
  const budget = useMemo(() => (early ? bridgeBudget(pr, R) : null), [early, pr, R]);
  // The Bridge's choices as they stand, for "Use this bridge plan".
  const latest = useRef<BridgeInputs | null>(null);
  const BridgeView = TOOL_VIEWS.bridge;
  if (!early) return null;
  const yrs = early.years % 1 ? early.years.toFixed(1) : String(early.years);
  const who = early.name === "You" ? "You retire" : early.name + " retires";
  const use = () => set((p) => ({ ...p, bridge: { inputs: bridgeChoices(latest.current ?? bridgeFor(p, entries), p, entries), at: today() } }));
  const inputs = bridgeFor(pr, entries, R);
  return (
    <div className="dsh-r4">
      <Tile id="bridge" icon={MilestoneIcon} title="Bridge to 59½" right={<span className="dsh-cap">{early.from} to {Math.floor(early.to)}</span>}>
        {pr.bridge && B ? (
          <p className="dsh-cap dsh-mt6">Your bridge plan, saved {longDate(pr.bridge.at)}: <b>{B.plan}</b>. It lasted to 59½ in <b>{Math.round(B.hold * 100)}%</b> of past markets, costs about <b>{money(B.tax + B.pen + B.health)}</b> in taxes, penalties and health cover over the {yrs} years, and leaves <b>{money(Math.round(B.left / 1000) * 1000)}</b> at 59½. Changes below are saved to it.{" "}
            <Button variant="link" size="inline" onClick={() => set((p) => ({ ...p, bridge: undefined }))}>Remove it</Button></p>
        ) : (
          <div className="dsh-mt6 dsh-tip">
            <span>{who} at {early.retire}, {yrs} years before 401(k)s and IRAs open without the 10% penalty. Plan how you&apos;ll pay for those years below{R.bridgeDock > 0 ? <>. Until you do, <b>{R.bridgeDock} points</b> are held back from your readiness score</> : null}.</span>
            <Button size="sm" onClick={use}>Use this bridge plan</Button>
          </div>
        )}
        <div className="dsh-mt">
          <Hosted key={JSON.stringify(R.S?.P ? [R.S.P.trad, R.S.P.roth, R.S.P.brok, R.spend, early.retire, inputs.stock, inputs.sv, inputs.cash, inputs.household, inputs.work2, budget?.steady] : null)} household={null}
            locked={bridgeLocked(pr, entries)} bridgeBudget={budget} slots={{ facts: <BridgeFacts pr={pr} entries={entries} inputs={inputs} budget={budget} /> }}
            seed={(id) => (id === "bridge" ? (inputs as unknown as ToolInputs) : undefined)}
            keep={(id, d) => {
              if (id !== "bridge") return;
              latest.current = d as unknown as BridgeInputs;
              const c = bridgeChoices(d as unknown as BridgeInputs, pr, entries);
              set((p) => (p.bridge && JSON.stringify(p.bridge.inputs) !== JSON.stringify(c) ? { ...p, bridge: { ...p.bridge, inputs: c } } : p));
            }}>
            <CardHeadingLevel value={3}><BridgeView /></CardHeadingLevel>
          </Hosted>
        </div>
      </Tile>
    </div>
  );
}

/** What the Bridge takes from the plan, in place of its fields. */
function BridgeFacts({ pr, entries, inputs, budget }: { pr: Profile; entries: Entry[]; inputs: BridgeInputs; budget: BrBudget | null }) {
  const early = earlyRetirees(pr)[0], H = holdings(entries, pr), partner = early ? partnerWork(pr, early) : null;
  const m = (v: string) => money(Number(v.replace(/,/g, "")) || 0);
  const mix = retireMix(pr);
  const rows: [string, string][] = [
    ["Retiring", early ? `${early.name === "You" ? "" : early.name + " "}at ${early.retire}, in ${early.from}` : "—"],
    ["Filing", `${inputs.status === "m" ? "Married filing jointly" : "Single"}, ${inputs.state}`],
    budget ? ["Withdrawals, before tax", `Your strategy's: ${money(budget.steady[0])} in ${early?.from ?? "year one"}, then as it decides in each market`]
      : ["Spending, after tax", m(inputs.spend) + " per year"],
    ["Traditional 401(k) and IRA", m(inputs.trad) + (Number(inputs.k401.replace(/,/g, "")) > 0 ? `, ${m(inputs.k401)} of it in the plan ${early?.name === "You" ? "you're" : (early?.name ?? "") + " is"} leaving` : "")],
    ...(Number(inputs.g457.replace(/,/g, "")) > 0 ? [["457(b)", m(inputs.g457)] as [string, string]] : []),
    ...(Number(inputs.trad2.replace(/,/g, "")) > 0 && inputs.age2 ? [[`Of that, ${early && early.i ? nameOf(pr, 0) : nameOf(pr, 1)}'s`, `${m(inputs.trad2)}, open at their own 59½ in ${Math.ceil(early!.from + 59.5 - Number(inputs.age2))}`] as [string, string]] : []),
    ["Roth", m(inputs.roth) + (H.rothBasis != null ? `, ${m(inputs.rothBasis)} of it your contributions` : "")],
    ["Brokerage", m(inputs.brok) + `, cost basis ${inputs.basis}%${H.brokBasis == null && H.brok > 0 ? " (estimated)" : ""}`],
    ["Mix", mixWords({ ...mix, end: null })],
    ["Household", `${inputs.household} ${inputs.household === "1" ? "person" : "people"}`],
    ...(partner ? [[`${partner.name}'s pay`, `${money(partner.pay)} per year until ${Math.floor(early!.from + (partner.until - early!.retire))}, with their job's health plan`] as [string, string]] : []),
  ];
  return (
    <PlanFacts id="brFacts" rows={rows} note={<>Balances are what each account holds when you retire, from the <To href="/dashboard/calculator">Calculator</To>. Cost basis and Roth contributions come from <To href="/dashboard/accounts#assets">Net worth</To>{H.rothBasis == null ? " (add your Roth contributions there, or type them below)" : ""}, the mix{budget ? " and each year's withdrawal" : ""} from Retirement&apos;s Drawdown, and the rest from <To href="/dashboard/profile">Profile</To> and <To href="/dashboard/income">Income</To>. The bridge runs to {early?.name === "You" ? "your" : (early?.name ?? "your") + "'s"} 59½. Each traditional account opens at its owner&apos;s 59½, as set on Net worth (half each if no owner is given).</>} />
  );
}

/** The years with no job's health plan before Medicare, called out where
    retirement is shown. */
function HealthCallout({ pr, R, onOpen, here }: { pr: Profile; R: Results; onOpen: () => void; here: boolean }) {
  const gap = healthGap(pr);
  if (!gap) return null;
  const per = R.S && R.S.hcYr > 0 ? R.S.hcYr / 12 : null;
  return (
    <div className="dsh-mt dsh-tip dsh-warn-tip">
      <span>{healthWords(pr, gap)} Your plan counts about <b>{per != null ? money(per) : "—"} per month</b> for marketplace cover in those years, on average, on top of your spending.</span>
      {here ? null : <Button size="sm" variant="outline" onClick={onOpen}>Plan health cover</Button>}
    </div>
  );
}

/** Health cover once work stops: the Healthcare Cost Planner on the plan. */
function HealthTile() {
  const { data, setProfile: set } = useDashboard();
  const pr = data.profile, entries = data.entries;
  const R = useMemo(() => results(pr, entries), [pr, entries]);
  const Health = TOOL_VIEWS.healthcare;
  const gap = healthGap(pr), inputs = healthFor(pr, R);
  // Opened: Next steps' health cover step is done.
  useEffect(() => { if (!pr.healthSeen) set((p) => ({ ...p, healthSeen: true })); }, [pr.healthSeen, set]);
  if (!R.S) return <div className="dsh-r4"><Note>Health cover opens once your profile has your ages, savings, retirement age and spending.</Note></div>;
  const stop = gap?.from ?? R.retireYear;
  const before = R.S.hcYr / 12;
  return (
    <div className="dsh-r4">
      <Tile id="health" icon={HeartPulseIcon} title="Health cover" right={<span className="dsh-cap">{gap ? `${gap.from} to ${gap.to}, then Medicare` : "Medicare from 65"}</span>}>
        <p className="dsh-cap dsh-mt6">{gap
          ? <>{healthWords(pr, gap)} Until then it&apos;s a marketplace plan, priced on your income: your plan counts about <b>{money(before)} per month</b> for it on average, on top of your spending{earlyRetirees(pr).length ? " (the bridge counts it before 59½)" : ""}. From 65, your plan counts Medicare&apos;s premiums.</>
          : <>Work stops at 65 or later, so Medicare covers you from then. It isn&apos;t free: Part B, a drug plan and usually a supplement, more at higher incomes. Your plan counts Medicare&apos;s premiums on top of your spending.</>}</p>
        <div className="dsh-mt">
          <Hosted key={JSON.stringify(inputs)} household={null} locked={["household", "income"]}
            slots={{ facts: <PlanFacts id="hcFacts" rows={[
              ["Work stops", stop ? String(stop) : "—"],
              [couple(pr) ? "Your ages then" : "Your age then", couple(pr) ? people(pr).map((p, k) => `${nameOf(pr, k as 0 | 1)} ${p.by != null && stop ? stop - p.by : "—"}`).join(", ") : `${inputs.retireAge}`],
              ["Filing", `${inputs.status === "m" ? "Married filing jointly" : "Single"}, ${inputs.state}`],
              ["Household", `${stop ? householdAt(pr, stop) : inputs.household} ${inputs.household === "1" ? "person" : "people"}`],
              ["Income that year", inputs.income ? "$" + inputs.income + (inputs.ss ? `, with $${inputs.ss} of Social Security` : "") : "—"],
              ["Income at 65", inputs.income65 ? "$" + inputs.income65 : "—"],
            ]} note={<>From your plan: the ages from <To href="/dashboard/profile">Profile</To>, and the income your withdrawals give each year (the strategy on Drawdown{earlyRetirees(pr).length ? ", the bridge's conversions" : ""}, Social Security from <To href="/dashboard/income#social-security">Income</To>).</>} /> }}
            seed={(id) => (id === "healthcare" ? (inputs as unknown as ToolInputs) : undefined)}
            keep={(id, d) => { if (id === "healthcare") set((p) => ({ ...p, tools: { ...p.tools, healthcare: healthChoices(d as unknown as HealthcareInputs) as unknown as ToolInputs } })); }}>
            <CardHeadingLevel value={3}><Health /></CardHeadingLevel>
          </Hosted>
        </div>
      </Tile>
    </div>
  );
}
