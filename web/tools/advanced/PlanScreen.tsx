"use client";

/* The Advanced calculator on the Dashboard: your plan, year by year, as
   the stages it runs. The Dashboard builds the stages itself (its children,
   college years, saving that grows to its limits, both employers' match
   and your changes ahead: components/dashboard/calc.ts) and keeps them read,
   not edited; this screen shows them. What it shows in place of fields
   comes from the page: the plan's facts, the changes ahead, where each
   change starts on the chart, your age at year 0 and "When you could stop
   saving". Fees, the goal and historical mode's mix are changed here and
   saved back to the plan. The stages math is tools/stages/model.ts. */

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Affixed, Field, NumberField, SelectField } from "@/components/fields/Field";
import { MoneyInput } from "@/components/fields/NumberInput";
import { useHouseholdFill, useHousehold } from "@/components/household/HouseholdProvider";
import { TipDot, Tipped } from "@/components/shell/Tooltips";
import { AccountTable } from "@/components/tools/AccountTable";
import { ProjectionChart, ProjectionReading, bandLabel, emptyChart, fanPoints, histChart, type ChartData, type ChartMode } from "@/components/tools/Projection";
import { useToolScope, useToolState } from "@/components/tools/ToolState";
import { CsvButton } from "@/components/common/CsvButton";
import { Milestones } from "@/components/common/Milestones";
import { PPY, historicalRuns, monteCarlo, projectSeries } from "@/lib/engine/typed";
import { DASH, fmtNum, fraction, money, parseNum, pctStr } from "@/lib/format";
import { MC_RUNS, useMcSeed } from "@/lib/mc-seed";
import { useShareKit } from "@/components/shell/share";
import { useBusy } from "@/lib/busy";
import { Button } from "@/components/ui/button";
import { InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PinnedReading } from "@/components/common/Reading";
import { Modal, ModalTop } from "@/components/shell/Modal";
import { SERIES } from "@/lib/hues";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, ChevronRightIcon, CircleAlertIcon } from "lucide-react";
import { MixRows, mixForm, mixOk, type MixForm } from "@/tools/drawdown/MixRows";
import { STAGES_DEF, stagesCompute, readStage, stageSplit, type StagesInputs } from "@/tools/stages/model";
import { projectionShare } from "./share";
import { GroupHead } from "./ui";

const TARGET_LABEL = "(your target above)";

export function PlanScreen() {
  const { state: s, set, setState } = useToolState(STAGES_DEF);
  const { profile } = useHousehold();
  const scope = useToolScope();
  // Figures the page sets itself (the Dashboard's, from its plan): said in
  // its own words in place of their fields.
  const locked = new Set(scope?.locked ?? []);
  const seed = useMcSeed();
  // The page keeps the chart's mode and band in a holder: read when the
  // tool opens (its changes build the stages again, so it opens again),
  // written as they change, so the chart stays as it was.
  const held = scope?.slots?.chart;
  const [mode, setMode] = useState<ChartMode>(held?.mode ?? "band");
  const [band, setBand] = useState(held?.band ?? "2");
  useEffect(() => { held?.keep(mode, band); }, [held, mode, band]);
  const age0 = scope?.slots?.stagesAge;
  const stageTable = useRef<HTMLTableElement>(null), yearTable = useRef<HTMLTableElement>(null);
  // The page fills these in from its plan.
  useHouseholdFill("stages", s, setState, (_h, c) => c);

  const typed = useDeferredValue(s);
  useBusy(typed !== s);
  const V = useMemo(() => stagesCompute(typed, profile), [typed, profile]);
  useShareKit(STAGES_DEF.id, projectionShare({ kind: "stages", g: V.P.g, eff: V.P.eff, R: V.R, mode }));
  const { P, R, portToday, rate } = V;
  const g = P.g;
  // Where each change starts, in place of the stage boundaries.
  const scMarks = scope?.slots?.marks;
  const chart = useMemo(() => { const c = chartData(typed, V, mode, parseNum(band) / 100, seed); return scMarks ? { ...c, marks: scMarks } : c; }, [typed, V, mode, band, seed, scMarks]);
  const markWord = scMarks ? "A change starts" : "Stage boundary";
  const n = s.stages.length;
  const split = s.saOn;
  const dn = P.stages.length;
  const last = P.stages[dn - 1];
  const nums = s.stages.map(readStage);

  // The target beside the answer, in its own words.
  const target = parseNum(typed.target);
  const income = typed.solveFor === "After-Tax Withdrawal";
  // An after-tax income target can't be met by a portfolio that pays
  // nothing after tax.
  const noPay = income && target > 0 && !(g.withdrawal > 0 && rate < 1);
  const payWarn = !noPay ? "" : g.withdrawal > 0
    ? "At a 100% tax rate nothing is left after tax, so no portfolio reaches an after-tax income. Lower the tax rate."
    : "At a 0% withdrawal rate the portfolio pays no income, so no amount reaches your target. Set a withdrawal rate above 0%.";
  const badWd = noPay && !(g.withdrawal > 0), badTax = noPay && !badWd && !split;

  // The read-only view of the stages the plan and its changes build.
  const [behind, setBehind] = useState(false);
  const names = s.stages.map((st, i) => st.name || "Stage " + (i + 1));

  return (
    <div className="col-span-full grid grid-cols-1 items-start gap-5 max-sm:gap-3.5 lg:grid-cols-3">
      <div className="min-w-0 lg:col-span-1 lg:self-stretch">
        {/* Phones and narrow screens: the answer leads, and stays under the
            tab rail while the inputs are on screen. */}
        <PinnedReading main={{ label: "After-tax income, per year", value: money(R.afterTax) }} side={{ label: "At retirement, today's dollars", value: money(R.fvReal) }} />

        <aside id="asideSeries" className="max-lg:static max-lg:max-h-none max-lg:overflow-visible">
          {/* Screen readers' outline: the input groups below are h3s under this. */}
          <h2 className="sr-only">Your inputs</h2>
          <Card>
            <CardContent>
              {/* The page's facts and changes ahead; the stages they build are read, not edited. */}
              {locked.has("savings") ? <><GroupHead first>Your savings</GroupHead>{scope?.slots?.facts}</> : null}
              {scope?.slots?.scenarios}
              <GroupHead>The stages behind this</GroupHead>
              <p className="hint mt-0 mb-2.5">Your plan and the changes ahead, year by year, as the {n === 1 ? "stage" : n + " stages"} the calculator runs. Change one of them to change these.</p>
              <Button variant="outline" className="w-full" id="btnStagesBehind" disabled={!n} onClick={() => setBehind(true)}>{n === 1 ? "See the stage" : "See the " + n + " stages"}</Button>
              {behind && n ? (
                <Modal size="table" onClose={() => setBehind(false)}>
                  <ModalTop title="The stages behind your plan" onClose={() => setBehind(false)} />
                  <StagesBehind s={s} nums={nums} names={names} age={age0} />
                </Modal>
              ) : null}
              <div className="derived mb-1">
                <div><span>Stages</span><span className="num" id="gStages">{n}</span></div>
                <div><span>Fees</span><span className="num" id="gFeeNote">{(g.fees || 0) > 0 ? pctStr(g.fees, 2) + " off every stage" : "none"}</span></div>
                <div><span>Total horizon</span><span className="num" id="gTotalYears">{fmtNum(R.totalYears) + (R.totalYears === 1 ? " yr" : " yrs")}</span></div>
                <div><span>Total contributed</span><span className="num" id="gTotalContrib">{money(R.contribTotal)}</span></div>
              </div>

              <GroupHead>Markets</GroupHead>
              <div className="two bottomalign max-sm:grid-cols-2">
                {locked.has("inflation") ? null : <NumberField id="gInflation" label="Inflation" unit="%" value={s.inflation} onValueChange={set("inflation")} />}
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
              <div className="two bottomalign max-sm:grid-cols-2">
                <NumberField id="gWithdrawal" label="Withdrawal rate" unit="%" value={s.withdrawal} onValueChange={set("withdrawal")}
                  aria-invalid={badWd || undefined} aria-describedby={badWd ? "payWarnTextS" : undefined} />
                <NumberField id="gTaxrate" wrapId="gTaxrateField" hidden={split} label={<Tipped text="Effective tax rate" k="efftaxrate" />} unit="%" value={s.taxRate} onValueChange={set("taxRate")}
                  aria-invalid={badTax || undefined} aria-describedby={badTax ? "payWarnTextS" : undefined} />
                <div className="field" id="saTaxField" hidden={!split}>
                  <Label className="mb-1.5"><span><Tipped text="Tax on withdrawals" k="actax" /></span></Label>
                  <Affixed suffix="calc">
                    <InputGroupInput variant="numeric" id="saTaxOut" type="text" readOnly tabIndex={-1} aria-label="Tax on withdrawals, calculated" value={V.saRate != null ? pctStr(V.saRate, 1) : ""} /></Affixed>
                </div>
              </div>
              <div className="-mt-1 mb-1 flex items-start gap-2 text-note text-destructive" id="payWarnS" hidden={!noPay}>
                <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span id="payWarnTextS" role="alert">{payWarn}</span>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      <div className="stack min-w-0 lg:col-span-2" role="tabpanel" aria-labelledby="tabbtn-calc" id="tab-series">
        {/* With no stages the figures are only the starting value's; they
            stay, dimmed, and everything under them gives way to one prompt. */}
        <div className={cn("min-w-0", !n && "opacity-60")}>
          <ProjectionReading p="x" R={R} lastPeriod={R.lastPeriod}
            fvNote={dn ? "Across " + dn + (dn === 1 ? " stage, " : " stages, ") + fmtNum(R.totalYears) + " years" : "No stages yet"}
            realNote={"Inflation of " + pctStr(g.inflation, 2) + " over " + fmtNum(R.inflYears) + " years"}>
            {target > 0 ? (
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-note">
                <span className="text-muted-foreground">Your target</span>
                <span className="font-medium whitespace-nowrap tabular-nums">{money(target) + (income ? " per year, after tax" : " portfolio, in today's dollars")}</span>
              </div>
            ) : null}
          </ProjectionReading>
        </div>

        {!n ? (
          <Card>
            <CardHeader><CardTitle>No stages yet</CardTitle>
              <CardDescription>Your plan needs a retirement age after today to have years to run.</CardDescription></CardHeader>
          </Card>
        ) : null}

        <Card id="saPanel" hidden={!split}>
          {P.B ? <AccountTable id="saResults" B={P.B} years={P.B.years ?? R.totalYears} /> : null}
        </Card>

        {scope?.slots?.reach ? <div className="min-w-0" hidden={!n}>{scope.slots.reach}</div> : null}

        <div className="min-w-0" hidden={!n}>
          <ProjectionChart sfx="S" segId="segSeries" ariaLabel="Projected inflation-adjusted balance across stages"
            mode={mode} setMode={setMode} band={band} setBand={setBand}
            histMix={s.histMix} setHistMix={set("histMix")} histMixEnd={s.histMixEnd} setHistMixEnd={set("histMixEnd")}
            glides={mode === "hist" && R.rows.length > 0 && !!last?.glide?.on}
            mixButton={<HistMixButton s={s} setState={setState} />}
            mcHint={<>5,000 simulations per redraw, at 15% volatility per year.</>}
            chart={chart} maxX={R.totalYears} bandItems={bandLegend(parseNum(band) / 100, markWord)} legendExtra={markWord}
            tipHead={(b) => <><b>{age0 != null ? "Age " + fmtNum(age0 + b.year) : "Year " + fmtNum(b.year)}</b> <span className="text-dim">&middot; stage {String(b.stage)}</span></>}
            target={portToday} targetLabel={TARGET_LABEL} xOffset={age0 ?? 0} layout="fixed" aspect={0.5} gutter={64} />
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-5 max-sm:gap-3.5" hidden={!n}>
          <Card>
            <CardHeader><CardTitle>Milestones</CardTitle></CardHeader>
            <CardContent id="msBodyS">
              <Milestones rows={R.rows.map((r) => ({ year: r.endYear, end: r.end, growth: r.growth, contrib: r.contrib }))}
                infl={g.inflation} feeCost={V.feeCost} horizon={R.totalYears} wholeYears />
            </CardContent>
          </Card>
        </div>

        <Card hidden={!n}>
          <CardHeader><CardTitle>Stage by stage</CardTitle><CardAction><CsvButton table={stageTable} label="Stage by stage" /></CardAction></CardHeader>
          <div className="swipehint">Swipe the table sideways to see every column.</div>
          <div className="scroll" tabIndex={0} role="region" aria-label="Stage by stage">
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
            <div className="scroll" tabIndex={0} role="region" aria-label="Year by year">
              <table id="xYearTable" ref={yearTable}>
                {/* Your age at each year's end, as the chart has it. */}
                <thead><tr><th>{age0 != null ? "Age" : "Year"}</th><th>Stage</th><th>Start balance</th><th>Contributions</th><th>Growth</th><th>End balance</th><th>Inflation adj.</th></tr></thead>
                <tbody>
                  {R.calRows.map((r) => (
                    <tr key={r.year}><td>{age0 != null ? fmtNum(age0 + r.year) : r.year}</td><td>{r.stageFrom === r.stage ? r.stage : r.stageFrom + "–" + r.stage}</td><td>{money(r.start)}</td>
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

function bandLegend(band: number, markWord = "Stage boundary"): [string, string][] {
  const lbl = bandLabel(band);
  return [
    [SERIES.teal, band > 0 ? "Every stage +" + lbl + "%" : "Higher"],
    [SERIES.plan, "As entered"],
    [SERIES.rose, band > 0 ? "Every stage −" + lbl + "%" : "Lower"],
    ["var(--stageline)", markWord],
  ];
}

/** The stages, read-only: each one's ages, length, saving a
    month by account (your own, before the match), return and what's going
    on, as the plan and the scenarios build them. */
function StagesBehind({ s, nums, names, age }: { s: StagesInputs; nums: ReturnType<typeof readStage>[]; names: string[]; age?: number }) {
  const split = s.saOn, hsa = split && nums.some((st) => stageSplit(st).h > 0), infl = parseNum(s.inflation) / 100;
  const starts = nums.reduce<number[]>((acc, st) => [...acc, acc[acc.length - 1] + st.years], [0]);
  const rows = nums.map((st, i) => {
    const start = starts[i], from = starts[i + 1];
    const ppy = (PPY as Record<string, number>)[st.period] ?? 12, mo = (st.contrib * ppy) / 12, sp = stageSplit(st);
    const ages = age != null ? fmtNum(age + start) + " to " + fmtNum(age + from) : "Year " + fmtNum(start) + " to " + fmtNum(from);
    // The rise after inflation: the stage's rate is kept before it.
    const rises = (1 + st.growth) / (1 + infl) - 1;
    // A lump sum on the stage's first day, and the account it moves.
    const lump = st.lump ? { v: st.lump, acct: { t: "traditional", r: "Roth", b: "brokerage", h: "HSA" }[st.lumpTo ?? "b"] } : null;
    return { i, ages, years: st.years, mo, t: mo * sp.t, r: mo * sp.r, b: mo * sp.b, h: mo * sp.h, nominal: st.nominal, rises, name: names[i], lump };
  });
  const anyLump = rows.some((r) => r.lump);
  return (
    <>
      <p className="hint mt-0 mb-3">Amounts are per month, in today&apos;s dollars: your own money before the match. Rises is how much a stage&apos;s saving grows each year, after inflation.{anyLump ? " On day one is a lump sum put in or taken out on the stage's first day." : ""}</p>
      <div className="swipehint">Swipe the table sideways to see every column.</div>
      <div className="scroll" tabIndex={0} role="region" aria-label="The stages behind your plan">
        <table id="stagesBehind">
          <thead><tr><th>Stage</th><th>{age != null ? "Ages" : "When"}</th><th>Years</th><th>Per month</th>{split ? <><th>Traditional</th><th>Roth</th><th>Brokerage</th>{hsa ? <th>HSA</th> : null}</> : null}<th><Tipped text="Rises" k="stagerises" /></th>{anyLump ? <th><Tipped text="On day one" k="stagelump" /></th> : null}<th>Return</th><th className="text-center">What&apos;s going on</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.i}><td>{r.i + 1}</td><td>{r.ages}</td><td>{fmtNum(r.years)}</td><td><b>{money(r.mo)}</b></td>
                {split ? <><td>{money(r.t)}</td><td>{money(r.r)}</td><td>{money(r.b)}</td>{hsa ? <td>{money(r.h)}</td> : null}</> : null}
                <td>{Math.abs(r.rises) < 0.0005 ? "none" : pctStr(r.rises, 1) + "/yr"}</td>
                {anyLump ? <td className={r.lump ? (r.lump.v < 0 ? "neg" : "pos") : undefined}>{r.lump ? <><b>{(r.lump.v < 0 ? "−" : "+") + money(Math.abs(r.lump.v))}</b> {r.lump.v < 0 ? "out of" : "into"} {r.lump.acct}</> : DASH}</td> : null}
                <td>{pctStr(r.nominal, 2)}</td><td className="text-left whitespace-normal">{r.name}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ---- the numbers ---- */

function chartData(s: StagesInputs, V: ReturnType<typeof stagesCompute>, mode: ChartMode, band: number, seed: number): ChartData {
  const { P, R } = V, g = P.g;
  if (!R.rows.length) return emptyChart();
  const defl = (yr: number) => Math.pow(1 + g.inflation, yr);
  const marks = R.summary.slice(0, -1).map((x) => ({ year: x.endYear, label: String(x.stage + 1) }));
  const start = { year: 0, stage: 1, base: g.initial, hi: g.initial, lo: g.initial, p25: g.initial, p75: g.initial };
  if (mode === "hist") {
    // US stocks and small-cap value together are the stocks; small value's
    // share of them and cash's share of the rest (bonds are what's left).
    const us = fraction(s.histMix), svP = fraction(s.histSv ?? "0"), cashP = fraction(s.histCash ?? "0"), stocks = Math.min(1, us + svP);
    const mix = stocks, endMix = fraction(s.histMixEnd);
    const full = svP > 0 || cashP > 0 ? { sv: stocks > 0 ? svP / stocks : 0, cash: stocks < 1 ? cashP / (1 - stocks) : 0 } : {};
    const H = historicalRuns({ initial: g.initial, fees: g.fees }, P.eff.map((st) => ({ ...st, mix, ...full, ...(st.glide?.on ? { glide: { ...st.glide, endMix } } : {}) })));
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

/* Historical mode's mix in the Dashboard's Calculator: the four holdings of
   the Drawdown Simulator's and the Backtest's pop-ups, adding up to 100%,
   each earning its actual returns. */
function mixWords(s: StagesInputs): string {
  const us = parseNum(s.histMix), sv = parseNum(s.histSv ?? "0"), cash = parseNum(s.histCash ?? "0"), bond = Math.max(0, 100 - us - sv - cash);
  const parts: [number, string][] = [[us, "US stocks"], [sv, "small-cap value"], [bond, "bonds"], [cash, "cash"]];
  return parts.filter(([v]) => v > 0).map(([v, n]) => fmtNum(v) + "% " + n).join(", ") || "Nothing invested";
}
function HistMixButton({ s, setState }: { s: StagesInputs; setState: (f: (c: StagesInputs) => StagesInputs) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Field id="histMixBtnS" label={<Tipped text="Asset mix" k="histmix" />}>
      <Button variant="outline" className="w-full max-w-90 justify-between" id="histMixBtnS" onClick={() => setOpen(true)}>
        <span className="min-w-0 flex-1 truncate text-left">{mixWords(s)}</span><ChevronRightIcon className="text-muted-foreground" aria-hidden="true" /></Button>
      {open ? <HistMixDialog s={s} close={() => setOpen(false)} save={(f) => setState((c) => ({ ...c, histMix: f.stock, histSv: f.sv, histCash: f.cash }))} /> : null}
    </Field>
  );
}
function HistMixDialog({ s, close, save }: { s: StagesInputs; close: () => void; save: (f: MixForm) => void }) {
  const [f, setF] = useState<MixForm>(() => {
    const stock = parseNum(s.histMix), sv = parseNum(s.histSv ?? "0"), cash = parseNum(s.histCash ?? "0");
    return mixForm({ stock, sv, bond: Math.max(0, 100 - stock - sv - cash), cash });
  });
  const up = (k: keyof MixForm) => (v: string) => setF((c) => ({ ...c, [k]: v }));
  const ok = mixOk(f);
  return (
    <Modal size="wide" onClose={close} focus="[data-mix]">
      <h3>Asset mix</h3>
      <div className="formhint">How your savings are invested while you save. Each holding earns its actual monthly returns; small-cap value and cash start in July 1926, so a mix with either starts its runs there. A glide in your last stage moves the stocks&apos; total, small-cap value keeping its share of them.</div>
      <MixRows f={f} up={up} totId="histMixTotS" />
      <div className="formactions"><Button variant="outline" className="flex-1" data-mixcancel onClick={close}>Cancel</Button>
        <Button className="flex-1" data-mixok disabled={!ok} onClick={() => {
          if (!ok) return;
          save({ stock: String(parseNum(f.stock)), sv: String(parseNum(f.sv)), bond: f.bond, cash: String(parseNum(f.cash)) });
          close();
        }}>Use this mix</Button></div>
    </Modal>
  );
}
