"use client";

/* Retirement: the Drawdown Simulator on your own plan. What you'll have at
   retirement, the years to 95, the stock mix and Social Security come from
   the profile; the strategy, and each strategy's settings, are chosen here
   and saved, and the chosen strategy is the plan's everywhere (its chance
   across history is the dashboard's chance of success). The strategies are
   laid out first, each in a line, to learn them before choosing. */

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { ArrowDownToLineIcon, BookOpenIcon, SunsetIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ToolInputs } from "@/components/tools/ToolState";
import { DD_UI } from "@/tools/drawdown/text";
import { DrawdownDialogs } from "@/tools/drawdown/Dialogs";
import type { DDView } from "@/tools/drawdown/Drawdown";
import { drawdownSetup } from "@/tools/drawdown/model";
import type { DrawdownState } from "@/tools/drawdown/model";
import { Frame } from "./Frame";
import { drawdownFor, fromDrawdown } from "./flows";
import { money, money10, shortMoney } from "./format";
import { Hosted, TOOL_VIEWS } from "./host";
import { ClaimField } from "./Income";
import { drawdownPlan, results, spendMonth } from "./model";
import { useDashboard } from "./store";
import { useLandedOn } from "./land";
import { Note, Tile } from "./ui";

export function Retirement() {
  const { data, setProfile: set } = useDashboard();
  const pr = data.profile;
  const R = useMemo(() => results(pr, data.entries), [pr, data.entries]);
  const tax = R.abroad ? ", before taxes" : "";
  // Bumped when a strategy is chosen out here, so the simulator opens on it.
  const [rev, setRev] = useState(0);
  const choose = (id: string) => { set((p) => ({ ...p, strategy: id })); setRev((r) => r + 1); };
  const Drawdown = TOOL_VIEWS.drawdown;
  const plan = drawdownPlan(R.S, R.ss1, R.ss2, R.claim1);
  // The simulator's own comparison, on your numbers: "Use this strategy"
  // there chooses it here.
  const [guide, setGuide] = useState(false);
  const [allStrats, setAllStrats] = useState(false);
  // "Compare strategies" lands on the strategies with the comparison open.
  useLandedOn("compare", useCallback(() => { window.setTimeout(() => setGuide(true), 600); }, []));
  const view = useMemo(() => {
    if (!plan) return null;
    const st = drawdownFor(pr, plan);
    return { s: st, set: (k: string) => (v: unknown) => { if (k === "strategy") { set((p) => ({ ...p, strategy: String(v) })); setRev((r) => r + 1); setGuide(false); } }, ...drawdownSetup(st) } as unknown as DDView;
  }, [pr, plan, set]);

  return (
    <Frame current="retirement" title="Retirement" sub={R.retireYear ? `Starting ${R.retireYear}` : "Needs your ages and retirement age"}>
      <Tile id="at-retirement" icon={SunsetIcon} title="At retirement" right={<Button variant="link" size="inline" nativeButton={false} render={<Link href="/dashboard/profile#plan-retirement" />}>Ages, spending and assumptions</Button>}>
        <div className="dsh-stats">
          <div className="dsh-stat"><div className="dsh-label">Savings, {R.retireYear ?? "—"}</div><div className="dsh-fig dsh-key">{R.atRetire != null ? shortMoney(R.atRetire) : "—"}</div></div>
          <div className="dsh-stat"><div className="dsh-label">Chance of success</div><div className="dsh-fig">{R.success != null ? Math.round(R.success * 100) + "%" : "—"}</div><div className="dsh-cap dsh-mt6">{R.strategy ? R.strategy.name : "Spending a fixed amount"}</div></div>
          <div className="dsh-stat"><div className="dsh-label">First year&apos;s spending, with taxes{tax}</div><div className="dsh-fig">{R.strategy ? money10(R.strategy.first) : R.S ? money10((R.S.spend + R.S.taxYr) / 12) : "—"}<small>per month</small></div></div>
          {!R.abroad ? <div className="dsh-stat"><div className="dsh-label">Social Security</div><div className="dsh-fig">{R.ss != null ? money10(R.ss) : "—"}<small>per month</small></div></div> : null}
          <div className="dsh-stat"><div className="dsh-label">You plan to spend</div><div className="dsh-fig">{money(pr.retSpend ?? spendMonth(pr) ?? 0)}<small>per month</small></div></div>
        </div>
        {!R.abroad ? <div className="dsh-fields dsh-fields-sm"><div className="dsh-row3"><ClaimField pr={pr} set={set} />{pr.who === "couple" ? <ClaimField pr={pr} set={set} i={1} /> : <div />}<div className="dsh-hint dsh-self-end">The same ages as on Income: change them in either place.</div></div></div> : null}
      </Tile>

      <div className="dsh-r4" id="compare"><Tile id="strategies" icon={BookOpenIcon} title="The withdrawal strategies" right={plan ? <Button variant="link" size="inline" onClick={() => setGuide(true)}>How the withdrawal strategies compare</Button> : null}>
        <p className="dsh-cap dsh-mt6">How each decides what you spend each year. Pick one to use it across your plan.</p>
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
        <p className="dsh-cap dsh-mt">For each one&apos;s pros and cons side by side, open &ldquo;How the withdrawal strategies compare&rdquo; in the simulator below. Its settings (the starting rate, guardrails, floors and ceilings) are saved as you change them.</p>
      </Tile></div>

      <div className="dsh-r4">
        {plan ? (
          <Tile id="drawdown" icon={ArrowDownToLineIcon} title="Your drawdown" right={<span className="dsh-cap">On your savings at retirement, through every market since 1926</span>}>
            <div className="dsh-mt">
              <Hosted key={rev} household={null}
                seed={(id) => (id === "drawdown" ? (drawdownFor(pr, plan) as unknown as ToolInputs) : undefined)}
                keep={(id, d) => { if (id === "drawdown") set((p) => fromDrawdown(p, d as unknown as DrawdownState)); }}>
                <Drawdown />
              </Hosted>
            </div>
          </Tile>
        ) : <Note>The simulator opens once your profile has your ages, savings, retirement age and spending.</Note>}
      </div>
      {guide && view ? <DrawdownDialogs v={view} dialog={{ kind: "guide" }} close={() => setGuide(false)} /> : null}
    </Frame>
  );
}
