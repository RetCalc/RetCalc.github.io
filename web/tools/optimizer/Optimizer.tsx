"use client";

/* The Plan Optimizer's own page: your situation, what the best plan should
   do, and the search. Every claiming age, withdrawal order, Roth conversion
   and income guard, each through every market since 1926. From
   src/main/25b-optimizer-inputs.html, 25c-optimizer.html and
   renderOptimizer() in src/js/app/31b-plan-optimizer.js. */

import { useMemo, useRef, useState } from "react";
import { MoneyField, NumberField, SelectField } from "@/components/fields/Field";
import { useHousehold, useHouseholdFill } from "@/components/household/HouseholdProvider";
import { usePopup } from "@/components/shell/Popup";
import { useToast } from "@/components/shell/Toast";
import { TipDot, Tipped } from "@/components/shell/Tooltips";
import { useToolState } from "@/components/tools/ToolState";
import { Segmented } from "@/components/common/Readout";
import { plAtRetire } from "@/lib/engine/typed-plan";
import { dollarsField, groupDigits, money, parseNum, pctStr } from "@/lib/format";
import { has } from "@/lib/household";
import { STATE_OPTIONS } from "@/lib/states";
import { copyFrom, opSources, sourceDesc } from "./copy";
import { OP_DEF, opSetMode, opToolIn, opView, type OptimizerInputs } from "./model";
import { RISKS } from "@/lib/engine/typed";
import { OptimizerStatus, Progress } from "./Progress";
import { OptimizerResult, heroFigure } from "./Result";
import { opEstimate, opSig, startOptimizer, useOptimizer, type Goal, type Host } from "./run";
import { OP_GOALS } from "./words";
import { useShareKit } from "@/components/shell/share";
import { optimizerCard } from "./share";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PinnedReading } from "@/components/common/Reading";
import { CircleAlertIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/* The goal picked, kept for the visit. */
const goalMemory = { goal: "legacy" as Goal };

/** What should the best plan do? The tool page's and the guide's. Each
    goal is its own button and Tab stop, pressed with Enter or Space: Base
    UI's RadioGroup would move focus and the choice with the arrow keys
    instead (SHADCN_PLAN.md keeps controls whose keyboard use would change),
    so these stay hand-built, on the design tokens. */
export function OpGoals({ host, goal, onPick }: { host: Host; goal: Goal; onPick: (g: Goal) => void }) {
  return (
    <div className="op-goals" role="radiogroup" aria-label="What should the best plan do?">
      {(Object.keys(OP_GOALS) as Goal[]).map((g) => {
        const [name, desc] = OP_GOALS[g], on = g === goal;
        return (
          <button key={g} type="button" className={"op-goal" + (on ? " on" : "")} role="radio" aria-checked={on} data-op="goal" data-host={host} data-goal={g} onClick={() => onPick(g)}>
            <i className="dot" aria-hidden="true"></i><b>{name}</b><span>{desc}</span></button>
        );
      })}
    </div>
  );
}

const CLAIMS: [string, string][] = [["62", "62, the earliest"], ["63", "63"], ["64", "64"], ["65", "65"], ["66", "66"], ["67", "67, full retirement age"], ["68", "68"], ["69", "69"], ["70", "70, the most it pays"]];

export function Optimizer() {
  const toast = useToast();
  const showPopup = usePopup();
  const { profile } = useHousehold();
  const { state: s, set, setState } = useToolState(OP_DEF);
  const H = useOptimizer("tool");
  useShareKit(OP_DEF.id, { card: () => optimizerCard(H.res) });
  const [goal, setGoalState] = useState<Goal>(goalMemory.goal);
  const setGoal = (g: Goal) => { goalMemory.goal = g; setGoalState(g); };
  const out = useRef<HTMLDivElement>(null);

  useHouseholdFill("optimizer", (h) => setState((c) => {
    const married = h.status === "m", m = (v: number) => dollarsField(v), next: OptimizerInputs = { ...c, status: married ? "m" : "s" };
    const age = h.age && h.age > 0 ? Math.round(h.age) : null, retire = h.retire && h.retire > 0 && h.retire < 120 ? Math.round(h.retire) : null;
    if (age) next.age = String(age);
    if (married && has(h.spouseAge) && h.spouseAge! > 0) next.spAge = String(Math.round(h.spouseAge!));
    if (retire && (!age || retire >= age)) next.retire = String(retire);
    if (married && retire && age && has(h.spouseAge) && h.spouseAge! > 0) next.spRet = String(Math.round(h.spouseAge! + (retire - age)));
    if (h.state && STATE_OPTIONS.some((o) => o.code === h.state)) next.state = h.state;
    if (h.spend != null && h.spend > 0) next.spend = m(h.spend);
    // The profile has one total; spread it over the accounts in the shares
    // the tool already holds, so the split stays the tool's own. In
    // Retirement day mode the balances are what you'll have then, so
    // today's total doesn't belong in them.
    const scale = (ks: (keyof OptimizerInputs)[], total: number) => {
      const now = ks.map((k) => parseNum(c[k])), sum = now.reduce((x, y) => x + y, 0);
      ks.forEach((k, i) => { next[k] = m(sum > 0 ? (total * now[i]) / sum : i === 0 ? total : 0); });
    };
    if (c.mode === "now" && has(h.saved)) {
      scale(["trad", "roth", "brok"], h.saved!);
      const r0 = parseNum(c.roth);
      next.rothBasis = m(r0 > 0 ? (parseNum(c.rothBasis) * parseNum(next.roth)) / r0 : 0);
    }
    if (c.mode === "now" && has(h.monthly)) scale(["saveTrad", "saveRoth", "saveBrok"], h.monthly!);
    if (has(h.income)) { next.inc1 = m(h.income!); next.ss1 = ""; }
    if (has(h.income2)) { next.inc2 = m(h.income2!); next.ss2 = ""; }
    return next;
  }));

  const v = opView(s);
  // the plan at retirement, and how big its search is: worked out once per change
  const { I, P, E } = useMemo(() => {
    const In = opToolIn(s), Pl = plAtRetire(In);
    return { I: In, P: Pl, E: opEstimate(Pl) };
  }, [s]);
  const sig = opSig(P, goal), spend = I.spend > 0;
  const fresh = H.res != null && H.res.sig === sig;

  const run = () => {
    if (!spend) { toast("Enter your spending in retirement first", "warn"); return; }
    startOptimizer("tool", P, goal);
    try { out.current?.scrollIntoView({ behavior: "smooth", block: "start" }); } catch { /* old browsers */ }
  };
  const setMode = (to: "ret" | "now") => {
    if (to === s.mode) return;
    setState((c) => opSetMode(c, to));
    toast(to === "ret" ? "Enter what you'll have on the day you retire, or copy it from Advanced or Stages"
      : "Enter what you have today and what you save each month, or copy them from Advanced or Stages");
  };
  const copy = async () => {
    const src = opSources(profile);
    if (!src.length) { toast("Turn on Split by account type in Advanced or Stages first, then copy it here", "warn"); return; }
    let i = 0;
    if (src.length > 1) {
      i = await showPopup(v.now ? "Copy today's savings from which plan?" : "Copy your balances at retirement from which plan?",
        src.map((x) => ({ label: x.label, desc: sourceDesc(x, v.now), money: true })));
      if (i < 0) return;
    }
    const { next, msg } = copyFrom(s, src[i], profile);
    setState(() => next);
    toast(msg);
  };
  const risk = parseFloat(s.risk), riskHit = RISKS.some((r) => String(r.real) === s.risk);
  const stale = H.res != null && H.res.sig !== sig;

  // Out of date: the result stays, dimmed, and says why, with the rerun
  // beside it (or, with no spending, where to fix it).
  const staleBand = stale ? (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-5.5 py-3 text-note max-sm:px-4">
      <CircleAlertIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 flex-1">{spend ? "Your numbers or the goal changed since this ran." : "Enter what you'll spend each year in retirement to run it again."}</span>
      <Button variant="outline" size="sm" data-op="run" data-host="tool" disabled={!spend} onClick={run}>Run it again</Button>
    </div>
  ) : null;

  let body: React.ReactNode;
  if (H.run) body = (
    // As tall as the reading that replaces it, so the page doesn't jump
    // twice: once when the bar comes in, again when the answer lands.
    <Card className="min-h-80 justify-center"><CardContent><Progress host="tool" R={H.run} /></CardContent></Card>
  );
  else if (H.res) body = <OptimizerResult key={H.res.sig + H.res.runs} host="tool" res={H.res} fresh={H.fresh} stale={staleBand} />;
  else if (!spend) body = (
    <Card><CardContent>
      <p className="m-0 flex items-start gap-2 text-body"><CircleAlertIcon className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span>Enter what you&apos;ll spend each year in retirement to find your plan.</span></p>
    </CardContent></Card>
  );
  else body = (
    <Card>
      <CardHeader><CardTitle>What the search starts from</CardTitle></CardHeader>
      <CardContent>
        <div className="op-ready-in grid gap-x-8 gap-y-5 sm:grid-cols-2">
          <div>
            <div className="text-label text-muted-foreground">{v.now ? "At " + P.age1 + " you'll have about" : "On the day you retire, at " + P.age1}</div>
            <div className="my-1 text-3xl leading-tight font-medium tabular-nums">{money(P.fv)}</div>
            <div className="text-label text-muted-foreground tabular-nums">{money(P.trad) + " traditional · " + money(P.roth) + " Roth · " + money(P.brok) + " brokerage, in today's dollars"}</div>
          </div>
          <div>
            <div className="text-label text-muted-foreground">Social Security at 67</div>
            <div className="my-1 text-3xl leading-tight font-medium tabular-nums">{money(I.pia1 + I.pia2)}<span className="text-body text-muted-foreground">/mo</span></div>
            <div className="text-label text-muted-foreground tabular-nums">{I.status === "m" ? money(I.pia1) + " + " + money(I.pia2) + ", before any spousal top-up" : "Before claiming earlier or later"}</div>
          </div>
        </div>
        <p className="mt-5 mb-0 border-t border-border pt-4 text-note text-muted-foreground">Pick a goal above and press <b className="font-semibold text-foreground">Find my best plan</b>. The search runs in your browser: nothing you enter is sent anywhere.</p>
      </CardContent>
    </Card>
  );

  // The reading's figure, for the copy pinned over the inputs on phones.
  const pin = H.res ? heroFigure(H.res) : null;

  return (
    <div className="col-span-full grid grid-cols-1 items-start gap-5 max-sm:gap-3.5 lg:grid-cols-3">
      <div className="min-w-0 lg:col-span-1 lg:self-stretch">
        {/* Phones and narrow screens: once there's an answer, it leads the
            inputs and stays under the tab rail while they're on screen. */}
        {pin ? <PinnedReading tone={stale ? "text" : "answer"} main={{ label: stale ? pin.short + ", out of date" : pin.short, value: pin.value }}
          side={{ label: "The usual way", value: pin.was }} /> : null}

        <aside id="asideOP" className="max-lg:static max-lg:max-h-none max-lg:overflow-visible">
          <Card>
            <CardHeader>
              <CardTitle>Your situation</CardTitle>
              <CardDescription>Your household, savings and retirement, as the search should see them.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="field mb-4">
                <Label className="mb-1.5"><span>Start from<TipDot k="opmode" /></span></Label>
                <Segmented id="opModeSeg" size="fill" attr="data-opmode" options={[["ret", "Retirement day"], ["now", "Today"]] as const}
                  value={v.now ? "now" : "ret"} onChange={setMode} />
                <input type="hidden" id="opMode" value={s.mode} />
              </div>

              <GroupHead first>Household</GroupHead>
              <div className="grid grid-cols-2 items-end gap-x-2.5 max-sm:grid-cols-1">
                <SelectField id="opStatus" label="Filing status" value={s.status} onChange={set("status")}>
                  <option value="m">Married filing jointly</option>
                  <option value="s">Single</option>
                </SelectField>
                <SelectField id="opState" label="State" value={s.state} onChange={set("state")}>
                  {STATE_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
                </SelectField>
              </div>
              <div className="two bottomalign max-sm:grid-cols-2" hidden={!v.now}>
                <NumberField id="opAge" label="Your age" unit="age" max={90} value={s.age} onValueChange={set("age")} />
                <NumberField id="opSpAge" hidden={!v.married} label="Spouse's age" unit="age" max={95} value={s.spAge} onValueChange={set("spAge")} />
              </div>
              <div className={"two bottomalign max-sm:grid-cols-2" + (v.now || !v.married ? " one" : "")} id="opRetRow">
                <NumberField id="opRetire" label={<><span id="opRetireLbl">{v.now ? "Retire at" : "Your age at retirement"}</span><TipDot k="opretire" /></>}
                  unit="age" max={90} value={s.retire} onValueChange={set("retire")} />
                <NumberField id="opSpRet" hidden={v.now || !v.married} label="Spouse's age then" unit="age" max={95} value={s.spRet} onValueChange={set("spRet")} />
              </div>

              <div className="mt-1 mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-4">
                <h3 className="m-0 mr-auto text-sm font-semibold" id="opBalHead">{v.now ? "Saved for retirement today" : "Saved on the day you retire"}</h3>
                <Button variant="outline" size="sm" id="opCopy" onClick={copy}>Copy from Advanced or Stages</Button>
                <p className="m-0 basis-full text-label text-muted-foreground" id="opBalNote">{v.now ? "Today's balances. Advanced or Stages can fill these in, with what you save each month."
                  : "In today's dollars. Advanced or Stages can project these for you, account by account."}</p>
              </div>
              <MoneyField id="opTrad" label={<Tipped text="Traditional 401(k) / IRA" k="optrad" />} value={s.trad} onValueChange={set("trad")} />
              <div className="two bottomalign max-sm:grid-cols-2">
                <MoneyField id="opRoth" label="Roth 401(k) / IRA" value={s.roth} onValueChange={set("roth")} />
                <MoneyField id="opRothBasis" label={<Tipped text="Of that, contributions" k="oprothbasis" />} value={s.rothBasis} onValueChange={set("rothBasis")} />
              </div>
              <div className="two bottomalign max-sm:grid-cols-2">
                <MoneyField id="opBrok" label="Brokerage and cash" value={s.brok} onValueChange={set("brok")} />
                <NumberField id="opBasis" label={<Tipped text="Cost basis" k="opbasis" />} unit="% of it" step={5} max={100} value={s.basis} onValueChange={set("basis")} />
              </div>

              <div id="opSaveWrap" hidden={!v.now || !(v.retire > v.age)}>
                <h4 className="mt-1 mb-2.5 text-note font-semibold">Saving until you retire, a month</h4>
                <div className="two bottomalign max-sm:grid-cols-2">
                  <MoneyField id="opSaveTrad" label={<Tipped text="Traditional" k="opsavetrad" />} unit="/mo" value={s.saveTrad} onValueChange={set("saveTrad")} />
                  <MoneyField id="opSaveRoth" label="Roth" unit="/mo" value={s.saveRoth} onValueChange={set("saveRoth")} />
                </div>
                <div className="two bottomalign max-sm:grid-cols-2">
                  <MoneyField id="opSaveBrok" label="Brokerage" unit="/mo" value={s.saveBrok} onValueChange={set("saveBrok")} />
                  <SelectField id="opRisk" label="Invested" value={riskHit ? s.risk : String(risk)} onChange={(val) => setState((c) => ({ ...c, risk: val, riskFrom: "" }))}>
                    {RISKS.map((r) => <option key={r.real} value={String(r.real)}>{r.label + " · " + pctStr(r.real, 1) + " after inflation"}</option>)}
                    {!riskHit && isFinite(risk) ? <option data-custom="1" value={String(risk)}>{"From " + (s.riskFrom || "your plan") + " · " + pctStr(risk, 1) + " after inflation"}</option> : null}
                  </SelectField>
                </div>
              </div>

              <GroupHead>In retirement</GroupHead>
              <div className="two bottomalign max-sm:grid-cols-2">
                <MoneyField id="opSpend" label={<Tipped text="Spending, after tax" k="opspend" />} unit="/yr" value={s.spend} onValueChange={set("spend")}
                  aria-invalid={!spend || undefined} aria-describedby={!spend ? "opSpendWarn" : undefined} />
                <NumberField id="opMix" label={<Tipped text="Stocks" k="opmix" />} unit="%" step={5} max={100} value={s.mix} onValueChange={set("mix")} />
              </div>
              <div className="-mt-1 mb-3.5 flex items-start gap-2 text-note text-destructive" hidden={spend}>
                <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span id="opSpendWarn" role="alert">{spend ? "" : "Enter what you'll spend each year; the search needs it."}</span>
              </div>
              <div className="two bottomalign max-sm:grid-cols-2">
                <MoneyField id="opSS1" label={<Tipped text="Your benefit at 67" k="opss" />} unit="/mo" value={s.ss1} onValueChange={set("ss1")} />
                <MoneyField id="opInc1" label={<Tipped text="Or your salary" k="opinc" />} unit="/yr" value={s.inc1} onValueChange={set("inc1")} />
              </div>
              <div className="two bottomalign max-sm:grid-cols-2" hidden={!v.married}>
                <MoneyField id="opSS2" label="Spouse's benefit at 67" unit="/mo" value={s.ss2} onValueChange={set("ss2")} />
                <MoneyField id="opInc2" label="Or their salary" unit="/yr" value={s.inc2} onValueChange={set("inc2")} />
              </div>
              <SelectField id="opClaim" label={<Tipped text="You'd claim it at" k="opclaim" />} value={s.claim} onChange={set("claim")}>
                {CLAIMS.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
              </SelectField>
              <div className="two bottomalign max-sm:grid-cols-2">
                <MoneyField id="opPension" label={<>Pension <Badge variant="outline" className="ml-1.25">optional</Badge></>} unit="/yr" value={s.pension} onValueChange={set("pension")} />
                <NumberField id="opPenAge" label="Starting at" unit="age" max={90} placeholder="retiring" value={s.penAge} onValueChange={set("penAge")} />
              </div>
              <SelectField id="opPenCola" label="Pension raises" value={s.penCola} onChange={set("penCola")}>
                <option value="0">Fixed amount</option>
                <option value="1">Rises with inflation</option>
              </SelectField>

              <GroupHead>Health, heirs and safety</GroupHead>
              <SelectField id="opAca" wrapId="opAcaWrap" hidden={!(v.retire < 65)} label={<Tipped text="Health insurance before 65" k="opaca" />} value={s.aca} onChange={set("aca")}>
                <option value="1">ACA plan, with the subsidy income earns</option>
                <option value="0">Already in my spending</option>
              </SelectField>
              <SelectField id="opRule55" wrapId="opRule55Wrap" hidden={!(v.retire >= 55 && v.retire < 60)} label={<Tipped text="Leaving a job with a 401(k)" k="oprule55" />} value={s.rule55} onChange={set("rule55")}>
                <option value="0">No, or it&apos;s rolled over</option>
                <option value="1">Yes, at 55 or later: rule of 55</option>
              </SelectField>
              {/* One column on phones: "90% of markets" needs the full row. */}
              <div className="two bottomalign max-sm:grid-cols-1">
                <NumberField id="opHeir" label={<Tipped text="Heirs' tax rate" k="opheir" />} unit="%" max={50} value={s.heir} onValueChange={set("heir")} />
                <SelectField id="opTarget" label={<Tipped text="Must last in" k="optarget" />} value={s.target} onChange={set("target")}>
                  <option value="0.9">90% of markets</option>
                  <option value="0.95">95% of markets</option>
                  <option value="1">Every market</option>
                </SelectField>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* Below 1024px this column dissolves into the page's, so the goal and
          the button lead (before the inputs) and the answer follows them. */}
      <div className="flex min-w-0 flex-col gap-5 max-lg:contents lg:col-span-2" id="tab-optimizer">
        <Card className="min-w-0 max-lg:-order-1">
          <CardHeader>
            <CardTitle>What should the best plan do?</CardTitle>
          </CardHeader>
          <CardContent>
            <div id="opGoals"><OpGoals host="tool" goal={goal} onPick={setGoal} /></div>
            <div className="op-go">
              <Button size="lg" id="opRunBtn" data-op="run" data-host="tool" disabled={!!H.run || !spend} onClick={run}>
                {fresh ? "Run it again" : "Find my best plan"}<i className="arw" aria-hidden="true"></i></Button>
              <span className="text-label text-muted-foreground tabular-nums" id="opEst">{groupDigits(E.n, true) + " plans × " + E.w + " historical markets = " + groupDigits(E.runs, true) + " retirements, about " + E.secs + " seconds."}</span>
            </div>
            {!spend ? (
              <p className="mt-2 mb-0 flex items-start gap-2 text-note text-destructive">
                <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>Enter your spending in retirement first, under In retirement.</span>
              </p>
            ) : null}
            <p className="mt-4 mb-0 max-w-copy border-t border-border pt-4 text-note text-muted-foreground">Every age from 62 to 70 for each of you to claim Social Security. Every order for drawing down your accounts. Every level of Roth conversion, for every stretch of years, with and without staying under the ACA and Medicare income lines. Each plan runs through every market since 1926, with 2026 federal and state tax worked out year by year, and the best one wins.</p>
          </CardContent>
        </Card>
        <OptimizerStatus host="tool" />
        <div id="opOut" className="op-out min-w-0" ref={out}>{body}</div>
      </div>
    </div>
  );
}

/** A heading over one group of the inputs, on a rule after the first (as on
    Advanced). */
function GroupHead({ first, children }: { first?: boolean; children: React.ReactNode }) {
  return <h3 className={cn("m-0 mb-3 text-sm font-semibold", !first && "mt-1 border-t border-border pt-4")}>{children}</h3>;
}
