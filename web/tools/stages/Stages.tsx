"use client";

/* The Stages calculator: a plan built from stages, each with its own
   contribution, return and length, worked backwards from a target by
   changing the final stage. Ported from src/js/app/08-stages.js and the
   Stages parts of src/main/02-calculator-inputs.html and
   03-calculator-results.html. */

import { useDeferredValue, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckToggle } from "@/components/fields/CheckToggle";
import { Affixed, Field, MoneyField, NumberField, SelectField } from "@/components/fields/Field";
import { MoneyInput } from "@/components/fields/NumberInput";
import { useHousehold, useHouseholdFill } from "@/components/household/HouseholdProvider";
import { useToast } from "@/components/shell/Toast";
import { TipDot, Tipped } from "@/components/shell/Tooltips";
import { AccountTable } from "@/components/tools/AccountTable";
import { ProjectionChart, ProjectionReading, SolveOption, bandLabel, emptyChart, fanPoints, histChart, type ChartData, type ChartMode } from "@/components/tools/Projection";
import { toolInputs, useToolState } from "@/components/tools/ToolState";
import { CsvButton } from "@/components/common/CsvButton";
import { Milestones } from "@/components/common/Milestones";
import { KV } from "@/components/common/Readout";
import { PPY, finalStageSolve, historicalRuns, monteCarlo, projectSeries } from "@/lib/engine/typed";
import { DASH, dollarsField, fmtNum, fmtYears, fraction, groupDigits, money, parseNum, pctStr } from "@/lib/format";
import { has } from "@/lib/household";
import { MC_RUNS, useMcSeed } from "@/lib/mc-seed";
import { PERIOD_ADV } from "@/lib/periods";
import { STATE_OPTIONS } from "@/lib/states";
import { TAX_DEFAULTS } from "@/tools/tax/model";
import { StageCard, type StageEdit } from "./StageCard";
import { useShareKit } from "@/components/shell/share";
import { projectionShare } from "@/tools/advanced/share";
import { STAGES_DEF, stagesCompute, readStage, stageSplit, stagesPlan, type StageInputs, type StagesInputs } from "./model";
import { useBusy } from "@/lib/busy";
import { Button } from "@/components/ui/button";
import { InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SERIES } from "@/lib/hues";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PinnedReading } from "@/components/common/Reading";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, LockIcon, PlusIcon } from "lucide-react";
import { sendToDrawdown } from "@/tools/drawdown/fields";

const TARGET_LABEL = "(your target above)";

export function Stages() {
  const { state: s, set, setState } = useToolState(STAGES_DEF);
  const { profile } = useHousehold();
  const router = useRouter();
  const toast = useToast();
  const seed = useMcSeed();
  const [mode, setMode] = useState<ChartMode>("band");
  const [band, setBand] = useState("2");
  const stageTable = useRef<HTMLTableElement>(null), yearTable = useRef<HTMLTableElement>(null);

  useHouseholdFill("stages", (h) => setState((c) => {
    const next = { ...c };
    if (c.saOn) {
      if (has(h.income)) next.saSalary = dollarsField(h.income!);
      next.saStatus = h.status === "m" ? "m" : "s";
      if (h.state) next.saState = h.state;
    } else if (has(h.saved)) next.initial = dollarsField(h.saved!);
    if (h.spend != null && h.spend > 0) Object.assign(next, { solveFor: "After-Tax Withdrawal", target: dollarsField(h.spend) });
    return next;
  }));

  const setStages = (f: (list: StageInputs[]) => StageInputs[]) => setState((c) => ({ ...c, stages: f(c.stages) }));
  const editStage: StageEdit = (i, f) => setStages((list) => list.map((st, j) => (j === i ? f(st) : st)));

  const typed = useDeferredValue(s);
  useBusy(typed !== s);
  const V = useMemo(() => stagesCompute(typed, profile), [typed, profile]);
  useShareKit(STAGES_DEF.id, projectionShare({ kind: "stages", g: V.P.g, eff: V.P.eff, R: V.R, mode }));
  const { P, R, F, portToday, rate } = V;
  const g = P.g;
  const chart = useMemo(() => chartData(typed, V, mode, parseNum(band) / 100, seed), [typed, V, mode, band, seed]);
  const n = s.stages.length;
  const split = s.saOn;

  /* ---- account split on and off ---- */
  const toggleAccounts = () => {
    if (!split) {
      // Start with the whole balance in traditional and every stage's
      // contribution there too, so nothing moves until you split it.
      const blank = (["saTradBal", "saRothBal", "saBrokBal"] as const).every((k) => !(parseNum(s[k]) > 0));
      const tax = toolInputs("tax", TAX_DEFAULTS), H = profile;
      setState((c) => ({
        ...c, saOn: true, stages: c.stages.map(dropTyped),
        ...(blank ? {
          saTradBal: dollarsField(parseNum(c.initial)), saRothBal: "0", saBrokBal: "0", saBrokBasis: "", saSalary: dollarsField(H?.income || 0),
          saMatchPct: "0", saMatchCap: "6", saStatus: H?.status || tax.status, saState: H?.state || tax.state,
        } : {}),
      }));
      toast("Tax is now worked out from each account type");
    } else {
      // Back to one total: carry the balance and calculated rate across, and
      // fold any match into each stage's contribution so the answer holds.
      // The match field is cleared so switching back doesn't count it twice.
      const now = stagesPlan(s, profile);
      const matched = now.eff.some((st) => st.mf > 1);
      setState((c) => ({
        ...c, saOn: false, initial: dollarsField(now.g.initial), taxRate: String(+(now.g.taxRate * 100).toFixed(2)),
        ...(matched ? { saMatchPct: "0" } : {}),
        stages: c.stages.map((st, i) => ({
          ...dropTyped(st), contrib: dollarsField(now.stages[i].contrib * (now.eff[i].mf || 1)),
          growth: st.gRates ? String(+(now.stages[i].growth * 100).toFixed(6)) : st.growth,
        })),
      }));
      toast("Back to one total, with a " + pctStr(now.g.taxRate, 1) + " tax rate" +
        (matched ? "; the match is now part of each stage's contribution" : ""));
    }
  };

  const addStage = () => setStages((list) => {
    const last = list[list.length - 1];
    // A copy of the previous stage as a starting point, but never its name.
    const next: StageInputs = last
      ? { ...dropTyped(last), years: "10", adj: true }
      : { years: "10", contrib: "500", period: "Monthly", growth: "3", nominal: "7", vol: "12", adj: true, glideOn: false, glideEnd: "", glideYears: "" };
    delete next.name;
    return [...list, next];
  });
  const removeStage = (i: number) => {
    setStages((list) => list.filter((_, j) => j !== i));
    toast("Stage removed");
  };

  /* ---- the solve changes the final stage ---- */
  const applyContribution = () => {
    const i = n - 1;
    if (i < 0) return;
    // Split by account type, a bigger final stage shifts the account mix and
    // so the tax rate the target needs; a few passes settle it.
    let c = s, contrib = 0;
    for (let pass = 0; pass < (c.saOn ? 5 : 1); pass++) {
      const now = stagesCompute(c, profile);
      if (!now.F) return;
      // the solve works on the fee- and inflation-adjusted stage, so undo the
      // contribution adjustment before writing the number back
      const start = now.P.stages.slice(0, i).reduce((a, st) => a + st.years, 0);
      const factor = now.P.stages[i].adj && i > 0 ? Math.pow(1 + (now.P.g.inflation || 0), start) : 1;
      contrib = Math.round(now.F.perPeriod / factor / (now.P.eff[i].mf || 1));
      c = { ...c, stages: c.stages.map((st, j) => (j === i ? { ...dropTyped(st), contrib: groupDigits(contrib, true) } : st)) };
    }
    setState(() => c);
    toast("Final stage contribution set to " + money(contrib));
  };
  const applyYears = () => {
    if (!F?.reached) {
      toast("That target isn't reachable within 100 years");
      return;
    }
    editStage(n - 1, (st) => ({ ...st, years: String(F.stageYears) }));
    toast("Final stage set to " + fmtYears(F.stageYears!));
  };

  // The results' own count, which can trail the cards by a moment.
  const dn = P.stages.length;
  const last = P.stages[dn - 1];
  const mf = P.eff[dn - 1]?.mf || 1;
  // The cards follow the inputs as typed; the results catch up a moment later.
  const nums = s.stages.map(readStage);
  const spans = nums.map((st, i) => {
    const from = nums.slice(0, i).reduce((a, x) => a + x.years, 0);
    return "Year " + fmtNum(from) + " – " + fmtNum(from + st.years);
  });

  // The target beside the answer: what it asks for, in its own words.
  const target = parseNum(typed.target);
  const income = typed.solveFor === "After-Tax Withdrawal";

  const toDrawdown = () => {
    sendToDrawdown({ initial: Math.round(R.fvReal) });
    router.push("/drawdown");
    toast("Portfolio set to " + money(R.fvReal) + ", your balance in today's dollars");
  };

  /* A segment of the timeline jumps to its stage's first field. */
  const goToStage = (i: number) => {
    const el = document.querySelector<HTMLInputElement>(`#stageList [data-f='years'][data-i='${i}']`);
    el?.closest(".stagecard")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    el?.focus({ preventScroll: true });
  };
  const totalTyped = nums.reduce((a, x) => a + Math.max(0, x.years), 0);

  return (
    <div className="col-span-full grid grid-cols-1 items-start gap-5 max-sm:gap-3.5 lg:grid-cols-3">
      <div className="min-w-0 lg:col-span-1 lg:self-stretch">
        {/* Phones and narrow screens: the answer leads, and stays under the
            tab rail while the inputs are on screen. */}
        <PinnedReading main={{ label: "After-tax income, per year", value: money(R.afterTax) }} side={{ label: "Inflation adjusted", value: money(R.fvReal) }} />

        <aside id="asideSeries" className="max-lg:static max-lg:max-h-none max-lg:overflow-visible">
          <Card>
            <CardHeader>
              <CardTitle>Your plan</CardTitle>
              <CardDescription>A plan in stages, each with its own contribution, return and length. The target is reached by changing the final stage.</CardDescription>
            </CardHeader>
            <CardContent>
              <GroupHead first>Your stages</GroupHead>
              {n ? (
                <div className="mb-4 flex gap-0.5" role="group" aria-label="Your stages, sized by their years">
                  {nums.map((st, i) => (
                    <button key={i} type="button" onClick={() => goToStage(i)}
                      className={cn("flex min-w-11 grow-(--g) basis-0 cursor-pointer flex-col items-start gap-0.5 overflow-hidden rounded-sm border border-transparent bg-muted px-2 py-1.5 text-left transition-colors outline-none first:rounded-l-md last:rounded-r-md hover:bg-foreground/10 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-solid focus-visible:outline-ring pointer-coarse:min-h-11",
                        !(st.years > 0) && "border-destructive")}
                      style={{ "--g": Math.max(0, st.years) || (totalTyped ? 0 : 1) } as React.CSSProperties}
                      aria-label={(s.stages[i].name || "Stage " + (i + 1)) + ", " + spans[i]}>
                      <span className="w-full truncate text-label font-medium text-foreground">{s.stages[i].name || "Stage " + (i + 1)}</span>
                      <span className="w-full truncate text-label text-muted-foreground tabular-nums">{fmtNum(Math.max(0, st.years)) + " yrs"}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              <div id="stageList">
                {s.stages.map((st, i) => (
                  <StageCard key={i} i={i} st={st} last={i === n - 1} split={split} mc={mode === "mc"} span={spans[i]}
                    adjNote={st.adj && i > 0 && P.eff[i] ? money(P.eff[i].contrib / (P.eff[i].mf || 1)) : ""}
                    num={nums[i]} blend={split && st.gRates ? P.stages[i]?.growth : undefined} fees={parseNum(s.fees) / 100} inflation={parseNum(s.inflation) / 100}
                    matchOn={parseNum(s.saMatchPct) > 0} edit={editStage} remove={removeStage} />
                ))}
              </div>
              <div className={n ? "hint hidden" : "hint mt-0 block"} id="stageEmpty">
                No stages yet. Add one to start building a run.
              </div>
              <Button variant="outline" className="mt-1 w-full" id="btnAddStage" onClick={addStage}><PlusIcon aria-hidden="true" />Add stage</Button>
              <div className="derived mb-1">
                <div><span>Stages</span><span className="num" id="gStages">{n}</span></div>
                <div><span>Fees</span><span className="num" id="gFeeNote">{(g.fees || 0) > 0 ? pctStr(g.fees, 2) + " off every stage" : "none"}</span></div>
                <div><span>Total horizon</span><span className="num" id="gTotalYears">{fmtNum(R.totalYears) + (R.totalYears === 1 ? " yr" : " yrs")}</span></div>
                <div><span>Total contributed</span><span className="num" id="gTotalContrib">{money(R.contribTotal)}</span></div>
              </div>

              <GroupHead>Your savings</GroupHead>
              <div className="glidewrap acwrap mt-0">
                <CheckToggle id="saToggle" on={split} onToggle={toggleAccounts} controls="saFields">Split by account type<TipDot k="staccttypes" /></CheckToggle>
                <div className="acfields" id="saFields" hidden={!split}>
                  <AcHead>Starting balances</AcHead>
                  <div className="two max-sm:grid-cols-2">
                    <MoneyField id="saTradBal" label="Traditional" value={s.saTradBal} onValueChange={set("saTradBal")} />
                    <MoneyField id="saRothBal" label="Roth" value={s.saRothBal} onValueChange={set("saRothBal")} />
                  </div>
                  <div className="two bottomalign max-sm:grid-cols-2">
                    <MoneyField id="saBrokBal" label="Brokerage" value={s.saBrokBal} onValueChange={set("saBrokBal")} />
                    <MoneyField id="saBrokBasis" label={<Tipped text="Cost basis" k="acbasis" />} value={s.saBrokBasis} onValueChange={set("saBrokBasis")} />
                  </div>
                  <div className="mb-3.5 border-t border-border pt-2.5" aria-live="polite">
                    <div className="actot flex-row items-baseline justify-between"><span className="k">Total starting balance</span><span className="v pr-0" id="saTotBal">{P.B ? money(g.initial) : ""}</span></div>
                  </div>
                  <AcHead note="paid into traditional" rule>Employer match</AcHead>
                  <MoneyField id="saSalary" label={<Tipped text="Your salary today" k="stsalary" />} unit="/yr" value={s.saSalary} onValueChange={set("saSalary")} />
                  <div className="two bottomalign max-sm:grid-cols-2">
                    <NumberField id="saMatchPct" label="Match rate" unit="%" step={10} value={s.saMatchPct} onValueChange={set("saMatchPct")} />
                    <NumberField id="saMatchCap" label="On the first" unit="% of salary" value={s.saMatchCap} onValueChange={set("saMatchCap")} />
                  </div>
                  <div className="hint -mt-1.5 empty:hidden" id="saMatchNote" aria-live="polite">{P.B ? matchNote(P) : ""}</div>
                  <AcHead rule>Taxes in retirement</AcHead>
                  <div className="two max-sm:grid-cols-2">
                    <SelectField id="saStatus" label="Filing status" value={s.saStatus} onChange={set("saStatus")}>
                      <option value="s">Single</option>
                      <option value="m">Married filing jointly</option>
                    </SelectField>
                    <SelectField id="saState" label="State" value={s.saState} onChange={set("saState")}>
                      {STATE_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
                    </SelectField>
                  </div>
                </div>
              </div>
              <MoneyField id="gInitial" wrapId="gInitialField" hidden={split} label="Starting value" value={s.initial} onValueChange={set("initial")} />

              <GroupHead>Markets</GroupHead>
              <div className="two bottomalign max-sm:grid-cols-2">
                <NumberField id="gInflation" label="Inflation" unit="%" value={s.inflation} onValueChange={set("inflation")} />
                <NumberField id="gFees" label={<>Fees <span className="tipglue"><Badge variant="outline" className="ml-1.25">optional</Badge><TipDot k="fees" /></span></>} unit="%/yr" step={0.1} value={s.fees} onValueChange={set("fees")} />
              </div>

              <GroupHead>Your goal</GroupHead>
              <div className="two bottomalign">
                <SelectField id="solveForS" label="Solve for" value={s.solveFor} onChange={set("solveFor")}>
                  <option value="After-Tax Withdrawal">After-tax income</option>
                  <option value="Portfolio Value">Portfolio value</option>
                </SelectField>
                <Field id="targetS" label="Target, inflation adjusted">
                  <Affixed prefix="$"><MoneyInput id="targetS" nonNeg value={s.target} onValueChange={set("target")} /></Affixed>
                </Field>
              </div>
              <div className="hint -mt-2 mb-3.5 empty:hidden" id="targetHintS">{F ? (s.solveFor === "After-Tax Withdrawal"
                ? "The after-tax income you want each year, in today's spending power."
                : "The portfolio balance you want, in today's spending power.") : ""}</div>
              <div className="two bottomalign max-sm:grid-cols-2">
                <NumberField id="gWithdrawal" label="Withdrawal rate" unit="%" value={s.withdrawal} onValueChange={set("withdrawal")} />
                <NumberField id="gTaxrate" wrapId="gTaxrateField" hidden={split} label={<Tipped text="Effective tax rate" k="efftaxrate" />} unit="%" value={s.taxRate} onValueChange={set("taxRate")} />
                <div className="field" id="saTaxField" hidden={!split}>
                  <Label className="mb-1.5"><span><Tipped text="Tax on withdrawals" k="actax" /></span></Label>
                  <Affixed suffix="calc">
                    <InputGroupInput variant="numeric" id="saTaxOut" type="text" readOnly tabIndex={-1} aria-label="Tax on withdrawals, calculated" value={V.saRate != null ? pctStr(V.saRate, 1) : ""} /></Affixed>
                </div>
              </div>
              <p className="mt-0.5 mb-0 flex items-center gap-1.5 text-label text-muted-foreground">
                <LockIcon className="size-3.5 shrink-0" aria-hidden="true" />Nothing leaves your browser.</p>
            </CardContent>
          </Card>
        </aside>
      </div>

      <div className="stack min-w-0 lg:col-span-2" role="tabpanel" aria-labelledby="tabbtn-calc" id="tab-series">
        {/* With no stages the figures are only the starting value's; they
            stay, dimmed, and everything under them gives way to one prompt. */}
        <div className={cn("min-w-0", !n && "opacity-60")}>
          <ProjectionReading p="x" R={R} lastPeriod={R.lastPeriod}
            fvNote={dn ? "Across " + dn + (dn === 1 ? " stage, " : " stages, ") + fmtNum(R.totalYears) + " years" : "Add a stage to begin"}
            realNote={"Inflation of " + pctStr(g.inflation, 2) + " over " + fmtNum(R.inflYears) + " years"}>
            {target > 0 ? (
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-note">
                <span className="text-muted-foreground">Your target</span>
                <span className="font-medium whitespace-nowrap tabular-nums">{money(target) + (income ? " a year, after tax" : " portfolio, in today's dollars")}</span>
              </div>
            ) : null}
          </ProjectionReading>
        </div>

        {!n ? (
          <Card>
            <CardHeader><CardTitle>Start with a stage</CardTitle>
              <CardDescription>Add a stage to see your balance over time, stage by stage.</CardDescription></CardHeader>
            <CardContent><Button variant="outline" onClick={addStage}><PlusIcon aria-hidden="true" />Add stage</Button></CardContent>
          </Card>
        ) : null}

        <Card id="saPanel" hidden={!split}>
          {P.B ? <AccountTable id="saResults" B={P.B} years={P.B.years ?? R.totalYears} /> : null}
        </Card>

        <Card hidden={!n}>
          <CardHeader><CardTitle>Reach your target</CardTitle>
            <CardDescription>Two ways to get there, both by changing the final stage: what it puts in, or how long it runs.</CardDescription></CardHeader>
          <div className="grid grid-cols-1 border-t border-border sm:grid-cols-2">
            <SolveOption label="Change the final stage's contribution" id="tPerPeriod" value={F ? money(F.perPeriod / mf, 2) : DASH} sized={!!F} noteId="tPerPeriodNote"
              note={F && last ? "Stage " + dn + ", paid " + PERIOD_ADV[last.period] + " for " + fmtYears(last.years) + (mf > 1 ? ", plus the match" : "") : ""}>
              <KV k="Per year" id="tPerYear" v={F ? money(F.perYear / mf) : ""} />
              <StageChange F={F} contrib={P.eff[dn - 1]?.contrib ?? 0} mf={mf} />
              <Button variant="outline" className="mt-3.5 self-start max-sm:self-stretch" id="btnApplyS" disabled={!n} onClick={applyContribution}>Use this contribution</Button>
            </SolveOption>
            <SolveOption label="Change the final stage's length" id="tYears" value={!F ? DASH : F.reached ? fmtYears(F.stageYears!) : "Out of reach"} sized={!!F} noteId="tYearsNote" className="max-sm:border-t sm:border-l"
              note={!F ? "" : F.reached ? "Keeping " + money(P.eff[dn - 1].contrib / mf, 2) + " " + PERIOD_ADV[last.period] : "Not reached within 100 years at this contribution."}>
              <KV k="Final stage now" id="tYearsNow" v={F && last ? fmtYears(last.years) : ""} />
              <KV k="Whole run becomes" id="tYearsTotal" v={!F ? "" : F.reached ? fmtYears(F.totalIfStretched!) : DASH} />
              <Button variant="outline" className="mt-3.5 self-start max-sm:self-stretch" id="btnApplyYearsS" disabled={!n || (!!F && !F.reached)} onClick={applyYears}>Use this length</Button>
            </SolveOption>
          </div>
          <div className="-mb-1 border-t border-border px-4.5 pt-1 max-sm:px-3.5">
            <div className="grid2">
              <div>
                <KV k="Portfolio needed, inflation adjusted" id="tPortToday" v={F ? money(portToday) : ""} />
                <KV k="That pays, after tax" id="tPays" v={F ? money(portToday * g.withdrawal * (1 - rate)) + " per year" : ""} />
                <KV k="Portfolio needed at retirement" id="tPortFuture" v={F ? money(F.targetFuture) : ""} />
              </div>
              <div>
                <KV k="Balance entering the final stage" id="tStartBal" v={F ? money(F.startBal) : ""} />
                <KV k="That balance alone grows to" id="tGrown" v={F ? money(F.grown) : ""} />
              </div>
            </div>
          </div>
        </Card>

        <div className="min-w-0" hidden={!n}>
          <ProjectionChart sfx="S" segId="segSeries" ariaLabel="Projected inflation-adjusted balance across stages"
            mode={mode} setMode={setMode} band={band} setBand={setBand}
            histMix={s.histMix} setHistMix={set("histMix")} histMixEnd={s.histMixEnd} setHistMixEnd={set("histMixEnd")}
            glides={mode === "hist" && R.rows.length > 0 && !!last?.glide?.on}
            mcHint={<>5,000 simulations per redraw. Volatility is
              set per stage, in your plan.</>}
            chart={chart} maxX={R.totalYears} bandItems={bandLegend(parseNum(band) / 100)} legendExtra="Stage boundary"
            tipHead={(b) => <><b>Year {fmtNum(b.year)}</b> <span className="text-dim">&middot; stage {String(b.stage)}</span></>}
            target={portToday} targetLabel={TARGET_LABEL} />
        </div>

        {/* Side by side from 1100px, stretched to one height so the shorter
            card doesn't leave a hole under it. */}
        <div className="grid min-w-0 grid-cols-1 items-start gap-5 max-sm:gap-3.5 wide:grid-cols-2 wide:items-stretch" hidden={!n}>
          <Card>
            <CardHeader><CardTitle>Milestones</CardTitle></CardHeader>
            <CardContent id="msBodyS">
              <Milestones rows={R.rows.map((r) => ({ year: r.endYear, end: r.end, growth: r.growth, contrib: r.contrib }))}
                infl={g.inflation} feeCost={V.feeCost} horizon={R.totalYears} wholeYears />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Take it further</CardTitle></CardHeader>
            <CardContent>
              <p className="hint mt-0">See how long this balance lasts once you start
                drawing on it. This carries your inflation-adjusted balance into the
                Drawdown Simulator.</p>
              <Button variant="outline" id="toDrawdownS" onClick={toDrawdown}>Test withdrawals</Button>
            </CardContent>
          </Card>
        </div>

        <Card hidden={!n}>
          <CardHeader><CardTitle>Stage by stage</CardTitle><CardAction><CsvButton table={stageTable} label="Stage by stage" /></CardAction></CardHeader>
          <div className="swipehint">Swipe the table sideways to see every column.</div>
          <div className="scroll">
            <table id="stageTable" ref={stageTable}>
              <thead><tr><th>Stage</th><th>Years</th><th>Return</th><th>Start balance</th><th>Contributions</th><th>Growth</th><th>End balance</th></tr></thead>
              <tbody>
                {R.summary.map((x) => (
                  <tr key={x.stage}><td>{x.stage}</td><td>{fmtNum(x.years)}</td><td>{pctStr(x.nominal, 2)}</td><td>{money(x.start)}</td>
                    <td>{money(x.contrib)}</td><td className="pos">{money(x.growth)}</td><td>{money(x.end)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Collapsible className="min-w-0" hidden={!n} render={<Card />}>
          <CardHeader>
            <CardTitle><CollapsibleTrigger>Year by year<ChevronDownIcon aria-hidden="true" /></CollapsibleTrigger></CardTitle>
            <CardAction><CsvButton table={yearTable} label="Year by year" /></CardAction>
          </CardHeader>
          <CollapsibleContent keepMounted>
            <div className="swipehint">Swipe the table sideways to see every column.</div>
            <div className="scroll">
              <table id="xYearTable" ref={yearTable}>
                <thead><tr><th>Year</th><th>Stage</th><th>Start balance</th><th>Contributions</th><th>Growth</th><th>End balance</th><th>Inflation adj.</th></tr></thead>
                <tbody>
                  {R.calRows.map((r) => (
                    <tr key={r.year}><td>{r.year}</td><td>{r.stageFrom === r.stage ? r.stage : r.stageFrom + "–" + r.stage}</td><td>{money(r.start)}</td>
                      <td>{money(r.contrib)}</td><td className="pos">{money(r.growth)}</td><td>{money(r.end)}</td><td>{money(r.end / Math.pow(1 + g.inflation, r.t))}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}

/** A heading over one group of the inputs, on a rule after the first. */
function GroupHead({ first, children }: { first?: boolean; children: React.ReactNode }) {
  return <h3 className={cn("m-0 mb-3 text-sm font-semibold", !first && "mt-1 border-t border-border pt-4")}>{children}</h3>;
}

/** A heading inside the account split, at Title size, with what it's for
    in Label/Muted after it. */
function AcHead({ note, rule, children }: { note?: string; rule?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("mb-2 text-sm font-semibold", rule && "mt-1 border-t border-border pt-3.5")}>
      {children}{note ? <span className="ml-1.5 text-label font-normal text-muted-foreground">{note}</span> : null}
    </div>
  );
}

/** The cached split amounts go when a stage is rebuilt from its numbers. */
function dropTyped(st: StageInputs): StageInputs {
  const { cT: _t, cR: _r, cB: _b, ...rest } = st;
  return rest;
}

function StageChange({ F, contrib, mf }: { F: ReturnType<typeof finalStageSolve>; contrib: number; mf: number }) {
  if (!F) return <KV k="Change from current" id="tChange" v="" />;
  const delta = (F.perPeriod - contrib) / mf;
  return <KV k="Change from current" id="tChange" v={(delta >= 0 ? "+" : "") + money(delta, 2)} />;
}

/* The match stage 1 earns in its first year, restated biweekly, beside the
   most the salary allows. */
function matchNote(P: ReturnType<typeof stagesPlan>): string {
  const a = P.g.acct, st = P.stages[0];
  if (!a || !st || !(a.salary > 0) || !(a.matchPct > 0)) return "";
  const sp = stageSplit(st), ppy = (PPY as Record<string, number>)[st.period];
  const capPer = a.salary * (a.matchCap || 0) / 100 / ppy;
  const per = Math.min(Math.max(0, st.contrib) * (sp.t + sp.r), capPer) * a.matchPct / 100;
  const bi = per * ppy / 26, full = capPer * a.matchPct / 100 * ppy / 26;
  return "Stage 1 match: " + money(bi, 2) + " biweekly" + (bi < full - 0.005 ? " (the full match is " + money(full, 2) + ")" : "") + ".";
}

function bandLegend(band: number): [string, string][] {
  const lbl = bandLabel(band);
  return [
    [SERIES.teal, band > 0 ? "Every stage +" + lbl + "%" : "Higher"],
    [SERIES.plan, "As entered"],
    [SERIES.rose, band > 0 ? "Every stage −" + lbl + "%" : "Lower"],
    ["var(--stageline)", "Stage boundary"],
  ];
}

/* ---- the numbers ---- */

function chartData(s: StagesInputs, V: ReturnType<typeof stagesCompute>, mode: ChartMode, band: number, seed: number): ChartData {
  const { P, R } = V, g = P.g;
  if (!R.rows.length) return emptyChart();
  const defl = (yr: number) => Math.pow(1 + g.inflation, yr);
  const marks = R.summary.slice(0, -1).map((x) => ({ year: x.endYear, label: String(x.stage + 1) }));
  const start = { year: 0, stage: 1, base: g.initial, hi: g.initial, lo: g.initial, p25: g.initial, p75: g.initial };
  if (mode === "hist") {
    const mix = fraction(s.histMix), endMix = fraction(s.histMixEnd);
    const H = historicalRuns({ initial: g.initial, fees: g.fees }, P.eff.map((st) => ({ ...st, mix, ...(st.glide?.on ? { glide: { ...st.glide, endMix } } : {}) })));
    return histChart(start, H, marks, (b) => ({ stage: (b as { stage?: number }).stage }));
  }
  if (mode === "mc") {
    const mc = monteCarlo(g, P.eff, MC_RUNS, seed);
    const pts = fanPoints({ ...start, det: g.initial }, mc.bands, (b, i) => ({
      stage: R.chartRows[i] ? R.chartRows[i].stage : 1,
      det: R.chartRows[i] ? R.chartRows[i].end / defl(R.chartRows[i].year) : b.p50,
    }));
    return { ...emptyChart(true), pts, marks, legend: "mc", mc };
  }
  const shift = (d: number) => P.eff.map((st) => ({ ...st, nominal: Math.max(-0.99, st.nominal + d) }));
  const hiR = projectSeries(g, shift(band)), loR = projectSeries(g, shift(-band));
  const pts = [{ year: 0, stage: 1, base: g.initial, hi: g.initial, lo: g.initial }, ...R.chartRows.map((r, i) => ({
    year: r.year, stage: r.stage, base: r.end / defl(r.year),
    hi: (hiR.chartRows[i] ? hiR.chartRows[i].end : r.end) / defl(r.year),
    lo: (loR.chartRows[i] ? loR.chartRows[i].end : r.end) / defl(r.year),
  }))];
  return { ...emptyChart(), pts, marks, legend: "band" };
}
