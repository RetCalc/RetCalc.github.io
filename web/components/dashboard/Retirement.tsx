"use client";

/* Retirement: the Drawdown Simulator on your own plan. What you'll have at
   retirement, the years to 95, the stock mix and Social Security come from
   the profile; the strategy, and each strategy's settings, are chosen here
   and saved, and the chosen strategy is the plan's everywhere (its chance
   across history is the dashboard's chance of success). The strategies are
   laid out first, each in a line, to learn them before choosing. */

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { ArrowDownToLineIcon, BookOpenIcon, ChevronDownIcon, SunsetIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CardHeadingLevel } from "@/components/ui/card-heading";
import type { ToolInputs } from "@/components/tools/ToolState";
import { DD_UI } from "@/tools/drawdown/text";
import { DrawdownDialogs } from "@/tools/drawdown/Dialogs";
import type { DDView } from "@/tools/drawdown/Drawdown";
import { drawdownSetup } from "@/tools/drawdown/model";
import type { DrawdownState } from "@/tools/drawdown/model";
import { Frame } from "./Frame";
import { drawdownFor, fromDrawdown } from "./flows";
import { money } from "./format";
import { Hosted, TOOL_VIEWS } from "./host";
import { ClaimField } from "./Income";
import { results, spendMonth } from "./model";
import { useDashboard } from "./store";
import { useLandedOn } from "./land";
import { Note, Tile, TipLabel } from "./ui";

const STRATS_KEY = "retcalc.dashboard.strategiesOpen";
function readStratsOpen() { try { return localStorage.getItem(STRATS_KEY) === "1"; } catch { return false; } }
function saveStratsOpen(v: boolean) { try { localStorage.setItem(STRATS_KEY, v ? "1" : "0"); } catch { /* remembered for this visit only */ } }

const OWN_WORDS: Record<string, string> = {
  rate: "starting rate", initial: "starting balance", years: "years", retireAge: "retirement age", ssMode: "Social Security setting",
  ssAmount: "Social Security amount", ssAmount2: "partner's Social Security amount", ssDelay2: "partner's claiming age",
};
/** "starting rate, years and starting balance". */
const ownWords = (keys: string[]) => { const w = keys.map((k) => OWN_WORDS[k] ?? k); return w.length > 1 ? w.slice(0, -1).join(", ") + " and " + w[w.length - 1] : w[0]; };

export function Retirement() {
  const { data, setProfile: set } = useDashboard();
  const pr = data.profile;
  const R = useMemo(() => results(pr, data.entries), [pr, data.entries]);
  const tax = R.abroad ? ", before taxes" : "";
  // Bumped when a strategy is chosen out here, so the simulator opens on it.
  const [rev, setRev] = useState(0);
  const choose = (id: string) => { set((p) => ({ ...p, strategy: id })); setRev((r) => r + 1); };
  const Drawdown = TOOL_VIEWS.drawdown;
  // The strategy the simulator opens on: picking it there is a choice, opening on it isn't.
  const opened = String(drawdownFor(pr, null).strategy);
  const own = Object.keys(pr.ddOwn ?? {}), ownRate = pr.ddOwn?.rate != null;
  const plan = R.ddPlan;
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
    <Frame current="retirement" title="Retirement" sub={R.retireYear ? `Starting ${R.retireYear}` : R.gap ?? "Needs your ages and retirement age"}>
      <Tile id="at-retirement" icon={SunsetIcon} title="At retirement" right={<Button variant="link" size="inline" nativeButton={false} render={<Link href="/dashboard/profile#plan-retirement" />}>Ages, spending and assumptions</Button>}>
        <div className="dsh-stats">
          <div className="dsh-stat"><div className="dsh-label">Savings, {R.retireYear ?? "—"}</div><div className="dsh-fig dsh-key">{R.atRetire != null ? money(Math.round(R.atRetire / 1000) * 1000) : "—"}</div></div>
          <div className="dsh-stat"><div className="dsh-label"><TipLabel text="Chance of success" id="chance" /></div><div className="dsh-fig dsh-md">{R.success != null ? Math.round(R.success * 100) + "%" : "—"}</div><div className="dsh-cap dsh-mt6">{R.strategy ? R.strategy.name : "Spending a fixed amount"}</div></div>
          <div className="dsh-stat"><div className="dsh-label">{ownRate ? <TipLabel text={"Your strategy spends" + tax} id="stratSpend" /> : <TipLabel text={"You plan to spend" + tax} id="retSpend" />}</div><div className="dsh-fig dsh-md">{money(R.spend ?? pr.retSpend ?? spendMonth(pr) ?? 0)}<small>per month</small></div>{ownRate && R.goal != null ? <div className="dsh-cap dsh-mt6">Your goal: {money(R.goal)}</div> : null}</div>
          {!R.abroad ? <div className="dsh-stat"><div className="dsh-label"><TipLabel text="Taxes, on top" id="taxes" /></div><div className="dsh-fig dsh-md">{R.S ? money(R.S.taxYr / 12) : "—"}<small>per month</small></div></div> : null}
          {!R.abroad ? <div className="dsh-stat"><div className="dsh-label"><TipLabel text={"Social Security" + (R.ssYear ? ", from " + R.ssYear : "")} id="ssTotal" /></div><div className="dsh-fig dsh-md">{R.ss != null ? money(R.ss) : "—"}<small>per month</small></div></div> : null}
        </div>
        {!R.abroad ? <div className="dsh-fields dsh-fields-sm"><div className="dsh-row3"><ClaimField pr={pr} set={set} />{pr.who === "couple" ? <ClaimField pr={pr} set={set} i={1} /> : <div />}<div className="dsh-hint dsh-self-end">The same ages as on Income: change them in either place.</div></div></div> : null}
      </Tile>

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
        <p className="dsh-cap dsh-mt">For each one&apos;s pros and cons side by side, open &ldquo;How the withdrawal strategies compare&rdquo;. Everything you set in the simulator below (the starting rate, guardrails, floors and ceilings, a spending path) is saved to your plan as you change it.</p>
        </CollapsibleContent>
      </Tile></Collapsible></div>

      <div className="dsh-r4">
        {plan ? (
          <Tile id="drawdown" icon={ArrowDownToLineIcon} title="Your drawdown" right={<span className="dsh-cap">On your savings at retirement, through every market since 1926</span>}>
            {own.length ? (
              <p className="dsh-cap dsh-mt6">Your own {ownWords(own)} {own.length > 1 ? "are" : "is"} saved to your plan in place of its figures.{ownRate ? " Your strategy's spending is now the plan's; Profile's spending is your goal." : ""}{" "}
                <Button variant="link" size="inline" onClick={() => { set((p) => ({ ...p, ddOwn: undefined })); setRev((r) => r + 1); }}>Use the plan&apos;s figures</Button></p>
            ) : null}
            <div className="dsh-mt">
              {/* Opened again when the plan under it changes (the claiming ages above, say). */}
              <Hosted key={rev + "|" + JSON.stringify(plan)} household={null}
                seed={(id) => (id === "drawdown" ? (drawdownFor(pr, plan) as unknown as ToolInputs) : undefined)}
                keep={(id, d) => { if (id === "drawdown") set((p) => fromDrawdown(p, d as unknown as DrawdownState, opened, plan)); }}>
                {/* Inside this tile, the simulator's own card titles sit one level down. */}
                <CardHeadingLevel value={3}><Drawdown /></CardHeadingLevel>
              </Hosted>
            </div>
          </Tile>
        ) : <Note>The simulator opens once your profile has your ages, savings, retirement age and spending.</Note>}
      </div>
      {guide && view ? <DrawdownDialogs v={view} dialog={{ kind: "guide" }} close={() => setGuide(false)} /> : null}
    </Frame>
  );
}
