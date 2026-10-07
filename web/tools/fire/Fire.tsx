"use client";

/* The FIRE calculator: when the portfolio reaches financial independence,
   or, in Coast FIRE mode, when contributions could stop and growth alone
   would get there. Ported from src/js/app/35-fire.js and
   src/main/23-fire-inputs.html, 25-fire.html.

   Laid out answer-first (the FIRE critique, 2026-10-06), in Basic's thirds:
   the inputs a third, in four groups; then one reading whose hero is the
   FIRE age at your rate of return, with the portfolio then and the target
   beside it. The method switch sits in the reading's toolbar, and in
   Historical the reading gains a second answer, named as such: the age in
   market history at the success rate the slider sets. The chart follows,
   its target and FIRE marks labelled, then Year by year, folded. With no
   target, or a plan that never gets there, the reading says what to change.
   On a phone a compact reading leads and stays pinned. */

import { useRef, useState } from "react";
import { ChevronDownIcon, CircleXIcon, InfoIcon } from "lucide-react";
import { BandChart, type ChartGeometry } from "@/components/charts/BandChart";
import { HistBarNote } from "@/components/charts/HistNotes";
import { HistLegend, Legend } from "@/components/charts/Legend";
import { BandTipRows, FanTipRows } from "@/components/charts/TipRows";
import { useHouseholdFill } from "@/components/household/HouseholdProvider";
import { Affixed, Field, MoneyField, NumberField, SelectField } from "@/components/fields/Field";
import { NumberInput } from "@/components/fields/NumberInput";
import { Tipped } from "@/components/shell/Tooltips";
import { useToolState } from "@/components/tools/ToolState";
import { CsvButton } from "@/components/common/CsvButton";
import { KV, Segmented } from "@/components/common/Readout";
import { HeroReading, PinnedReading, type ReadingFigure } from "@/components/common/Reading";
import type { HistRuns } from "@/lib/engine/types";
import { DASH, dollarsField, fmtNum, money, pctStr } from "@/lib/format";
import { FIRE_DEF, fireBandPoints, fireCompute, fireHistRuns, type FireInputs, type FirePt } from "./model";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SERIES } from "@/lib/hues";
import { NativeRange } from "@/components/ui/native-range";
import { cn } from "@/lib/utils";

const trim1 = (v: number) => v.toFixed(1).replace(/\.0$/, "");
const two = "two bottomalign max-sm:grid-cols-2";

function GroupHead({ children }: { children: React.ReactNode }) {
  return <h3 className="m-0 mt-1 mb-3 border-t border-border pt-4 text-sm font-semibold">{children}</h3>;
}

/** A line in the reading that isn't a figure: a prompt, or what to change. */
function Band({ id, fail, children }: { id?: string; fail?: boolean; children: React.ReactNode }) {
  const Icon = fail ? CircleXIcon : InfoIcon;
  return (
    <div id={id} className="flex items-start gap-2 border-t border-border px-5.5 py-3.5 text-body text-foreground max-sm:px-4">
      <Icon className={cn("mt-1 size-4 shrink-0", fail ? "text-destructive" : "text-muted-foreground")} aria-hidden="true" />
      <p className="m-0 max-w-copy">{children}</p>
    </div>
  );
}

export function Fire() {
  const { state: s, set, setState } = useToolState(FIRE_DEF);
  const [tracesOn, setTracesOn] = useState(true);
  const tableRef = useRef<HTMLTableElement>(null);

  useHouseholdFill("fire", (h) => setState((c) => {
    const next: FireInputs = { ...c };
    const age = h.age != null && h.age > 0 && h.age < 120 ? Math.round(h.age) : null;
    const retire = h.retire != null && h.retire > 0 && h.retire < 120 ? Math.round(h.retire) : null;
    if (age) next.curAge = String(Math.max(18, Math.min(70, age)));
    if (retire) next.retireAge = String(retire);
    if (h.saved != null) next.initial = dollarsField(h.saved);
    if (h.monthly != null) Object.assign(next, { contrib: dollarsField(h.monthly), period: "Monthly" });
    if (h.spend != null && h.spend > 0) Object.assign(next, { target: dollarsField(h.spend), solveFor: "withdrawal" });
    return next;
  }));

  const { p, S, cr, histYear, displayYear, gains, keep, coastGap } = fireCompute(s);
  const coast = p.mode === "coast";
  const hist = s.chart === "hist";
  const modeLabel = coast ? "Coast FIRE" : "FIRE";
  const never = !!S && S.fireYear === null;

  // ---- the success-rate slider (market history only): its answer, as a
  // figure ("Age 60.3") and the years from now after it
  let successAge: [string, string] = [DASH, ""], successFail = false, sliderNote = "Enter a target to see results.";
  if (S && hist) {
    if (cr) {
      const y = histYear;
      if (y !== null && y >= 0) {
        const ageNum = p.curAge + y;
        const ageFmt = ageNum % 1 ? ageNum.toFixed(1) : String(ageNum), yFmt = y % 1 ? y.toFixed(1) : String(y);
        successAge = ["Age " + ageFmt, "(" + yFmt + (parseFloat(yFmt) === 1 ? " year" : " years") + " from now)"];
        sliderNote = p.successRate + "% of historical windows since 1926 show the portfolio reaching the " + (coast ? "coast " : "") + "target by age " + ageFmt + ".";
      } else {
        successAge = ["Not in range", ""];
        successFail = true;
        sliderNote = p.successRate + "% success rate not achievable within the projected window.";
      }
    } else sliderNote = "History too short for this horizon.";
  }

  // ---- the chart
  let chart: { pts: FirePt[]; maxX: number; mode: "band" | "mc"; H?: HistRuns; note: string } = { pts: [], maxX: 1, mode: "band", note: "" };
  if (S) {
    if (hist) {
      const H = fireHistRuns(p, displayYear, S.maxYears);
      chart = H.tooLong || !H.bands?.length
        ? { pts: [], maxX: 1, mode: "mc", H, note: H.tooLong ? "History too short for this horizon" : "" }
        : (() => {
          const pts = H.bands.map((b) => ({ year: Math.round(b.year), base: b.p50, hi: b.p90, lo: b.p10, p25: b.p25, p75: b.p75 }));
          return { pts, maxX: pts[pts.length - 1].year, mode: "mc" as const, H, note: "" };
        })();
    } else chart = { ...fireBandPoints(p, displayYear, S.maxYears), mode: "band", note: "" };
  }
  const lbl = (p.band * 100).toFixed(1).replace(/\.0$/, "");

  /* The target as a dashed rule from the plot's edge, named with its value,
     and the FIRE (or coast) year as a dashed upright named with the age,
     with a dot where the plan meets the target (or, coasting, where the
     contributions stop). The names are for the screen only. */
  const marks = (g: ChartGeometry) => {
    if (!(p.target > 0)) return null;
    const tY = g.Y(p.target), inside = tY >= g.T && tY <= g.T + g.ph;
    const fX = displayYear !== null && displayYear >= 0 && displayYear <= chart.maxX ? g.X(displayYear) : null;
    const x0 = g.X(0), xEnd = g.X(chart.maxX), fs = g.narrow ? 13 : 11;
    const coastPt = coast && !hist && displayYear !== null ? chart.pts.find((a) => a.year === Math.round(displayYear)) : undefined;
    const upLabel = displayYear !== null ? (hist ? p.successRate + "%: " : modeLabel + " ") + trim1(p.curAge + displayYear) : "";
    const right = fX !== null && fX > x0 + (xEnd - x0) * 0.6;
    return (
      <>
        {inside ? (
          <>
            <line x1={x0} x2={xEnd} y1={tY} y2={tY} stroke={SERIES.guide} strokeWidth="1.5" strokeDasharray="6 4" opacity="0.8" />
            <text x={x0 + 6} y={tY - 6} fontSize={fs} fill="var(--axis)" className="tabular-nums" data-screen-only>{"Target " + money(p.target)}</text>
          </>
        ) : null}
        {fX !== null ? <line x1={fX} x2={fX} y1={g.T} y2={g.T + g.ph} stroke={SERIES.guide} strokeWidth="1.5" strokeDasharray="4 3" opacity="0.7" /> : null}
        {fX !== null ? (
          <text x={right ? fX - 6 : fX + 6} y={g.T + fs} textAnchor={right ? "end" : "start"} fontSize={fs} fill="var(--axis)" className="tabular-nums" data-screen-only>{upLabel}</text>
        ) : null}
        {fX !== null && !coast && inside ? <circle cx={fX} cy={tY} r={g.narrow ? "6" : "4.5"} fill={SERIES.plan} stroke="var(--dotstroke)" strokeWidth="2" /> : null}
        {coastPt ? <circle cx={g.X(coastPt.year)} cy={g.Y(coastPt.base)} r={g.narrow ? "6" : "4.5"} fill={SERIES.plan} stroke="var(--dotstroke)" strokeWidth="2" data-screen-only /> : null}
      </>
    );
  };

  const kvs = S ? {
    target: money(p.target), withdrawal: money(p.target * p.withdrawal), contribs: money(S.contribs),
    gains: money(gains), nominal: pctStr(p.nominal, 2), real: pctStr(S.realRate, 2),
  } : null;
  let keepSaving = "", coastGapText = "";
  if (keep !== null && coastGap !== null) {
    keepSaving = money(keep);
    coastGapText = money(coastGap);
  }

  /* The reading: the FIRE age at your rate of return, named by that
     method, with the years from now in its note; a plan that never gets
     there reads as a failure (Loss, a cross and the words). */
  const ageText = S ? (S.fireYear !== null ? trim1(p.curAge + S.fireYear) : "Not in range") : DASH;
  const retireAt = fmtNum(p.retireAge);
  const ageNote = !S ? "" : never ? (
    <span className="inline-flex items-start gap-1.5" id="fiAgeNote">
      <CircleXIcon className="mt-px size-3.5 shrink-0 text-destructive" aria-hidden="true" />
      <span>{coast ? "Won't reach it by your retirement at " + retireAt : "Won't reach it by age 100"}</span>
    </span>
  ) : (
    <span id="fiAgeNote">
      {S.fireYear === 0 ? <span id="fiYears">Already there</span> : (
        <><b className="font-medium text-foreground tabular-nums" id="fiYears">{trim1(S.fireYear!)}</b>{" "}
          <span id="fiYearsLabel">{S.fireYear === 1 ? "year from now" : "years from now"}</span></>
      )}
      <span id="fiYearsNote">{coast ? ", then growth alone gets there by " + retireAt : ""}</span>
    </span>
  );
  const hero: ReadingFigure = {
    label: <><span id="fiAgeLabel">{modeLabel + " age"}</span>, at your rate of return</>,
    id: "fiAge", value: ageText, note: ageNote,
  };
  const figures: ReadingFigure[] = [
    { label: <span id="fiPortfolioLabel">{coast ? "Portfolio at coast" : "Portfolio at FIRE"}</span>, id: "fiPortfolio",
      value: S && S.fireYear !== null ? money(S.real) : DASH, note: S ? "In today's dollars" : "" },
    { label: "Target portfolio", id: "fiKVTarget", value: kvs?.target ?? DASH,
      note: S ? (s.solveFor === "withdrawal" ? "Spending " + money(p.targetAmt) + " a year at " + pctStr(p.withdrawal, 2) : "Your portfolio target") : "" },
  ];
  const heroTone = !S ? "text" : never ? "loss" : "answer";

  return (
    <div className="col-span-full grid grid-cols-1 items-start gap-5 max-sm:gap-3.5 lg:grid-cols-3">
      <div className="min-w-0 lg:col-span-1 lg:self-stretch">
        {/* Phones and narrow screens: the answer leads, and stays under the
            tab rail while the inputs are on screen. */}
        <PinnedReading tone={heroTone} main={{ label: modeLabel + " age", value: ageText }}
          side={{ label: coast ? "Portfolio at coast" : "Portfolio at FIRE", value: figures[0].value }} />

        <aside id="asideFire" className="max-lg:static max-lg:max-h-none max-lg:overflow-visible">
          <Card>
            <CardHeader>
              <CardTitle>Your plan</CardTitle>
              <CardDescription>When your savings could pay for your life, or when you could stop adding to them.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="field mb-3.5">
                <Segmented id="segFireMode" attr="data-firemode" options={[["fire", "FIRE"], ["coast", "Coast FIRE"]] as const} value={s.mode} onChange={set("mode")} />
              </div>

              <GroupHead>You</GroupHead>
              <div className={coast ? two : undefined}>
                <NumberField id="fiCurAge" label="Current age" unit="age" max={70} negative value={s.curAge} onValueChange={set("curAge")} />
                <NumberField id="fiRetireAge" wrapId="fiRetireAgeWrap" hidden={!coast} label="Planned retirement age" unit="age" max={100} negative value={s.retireAge} onValueChange={set("retireAge")} />
              </div>

              <GroupHead>Saving</GroupHead>
              <MoneyField id="fiInitial" label="Current savings" value={s.initial} onValueChange={set("initial")} />
              <div className={two}>
                <MoneyField id="fiContrib" label="Contribution" value={s.contrib} onValueChange={set("contrib")} />
                <SelectField id="fiPeriod" label="Frequency" value={s.period} onChange={set("period")}>
                  <option>Monthly</option><option>Quarterly</option><option>Annually</option>
                </SelectField>
              </div>
              <NumberField id="fiGrowth" label={<Tipped text="Contribution growth" k="figrowth" />} unit="%/yr" step={0.5} negative value={s.growth} onValueChange={set("growth")} />

              <GroupHead>Market</GroupHead>
              <div className={two}>
                <NumberField id="fiNominal" label="Rate of return" unit="%" step={0.5} negative value={s.nominal} onValueChange={set("nominal")}
                  aria-describedby={hist ? "fiMarketHint" : undefined} />
                <NumberField id="fiInflation" label="Inflation" unit="%" step={0.5} negative value={s.inflation} onValueChange={set("inflation")}
                  aria-describedby={hist ? "fiMarketHint" : undefined} />
              </div>
              {hist ? (
                <div className="-mt-1 mb-3.5 flex items-start gap-1.5 text-note text-foreground" id="fiMarketHint">
                  <InfoIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span>Not used with market history. The stock mix is.</span>
                </div>
              ) : null}
              <Field id="fiHistMix" wrapId="fiHistMixWrap" hidden={!hist} label="Stock mix">
                <Affixed suffix="%"><NumberInput id="fiHistMix" nonNeg step={5} max={100} value={s.histMix} onValueChange={set("histMix")} /></Affixed>
              </Field>

              <GroupHead>Goal</GroupHead>
              {/* One column on phones, where the select's text would be cut. */}
              <div className="two bottomalign">
                <SelectField id="fiSolveFor" label="Target type" value={s.solveFor} onChange={set("solveFor")}>
                  <option value="withdrawal">Annual withdrawal</option>
                  <option value="portfolio">Portfolio value</option>
                </SelectField>
                <NumberField id="fiWithdrawal" label={<Tipped text="Withdrawal rate" k="withdrawal" />} unit="%" step={0.25} negative value={s.withdrawal} onValueChange={set("withdrawal")} />
              </div>
              <MoneyField id="fiTarget" label={<Tipped text={(s.solveFor === "withdrawal" ? "Yearly spending" : "Portfolio target") + " (today's dollars)"} k="fitarget" />}
                value={s.target} onValueChange={set("target")} aria-describedby={!S ? "fiEmpty" : undefined} />
            </CardContent>
          </Card>
        </aside>
      </div>

      <div className="stack min-w-0 lg:col-span-2" id="tab-fire">
        <Card size="flush" className="min-w-0" id="fiReading">
          {/* Which question the reading answers: your rate of return alone,
              or that and every market since 1926. */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-5.5 py-3 max-sm:px-4">
            <Segmented id="segFireChart" attr="data-mode" options={[["band", "Rate band"], ["hist", "Historical"]] as const} value={s.chart} onChange={set("chart")} />
            <span className="text-label text-muted-foreground">{hist ? "Your rate of return, and every market since 1926" : "Your rate of return, with a band either side"}</span>
          </div>
          <HeroReading tone={heroTone} sized={!!S} hero={hero} figures={figures} />

          {/* Market history's own answer, beside the slider that sets how
              sure you want to be. */}
          <div id="fiSliderWrap" hidden={!hist || !S} className="border-t border-border px-5.5 py-4.5 max-sm:px-4">
            <div className="grid items-center gap-x-8 gap-y-4 sm:grid-cols-2">
              <div className="min-w-0">
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <label htmlFor="fiSuccessSlider" className="text-label text-muted-foreground">Historical success rate</label>
                  <b className="text-body font-semibold text-foreground tabular-nums" id="fiSuccessPct">{p.successRate}%</b>
                </div>
                <NativeRange id="fiSuccessSlider" min="1" max="99" value={s.successRate} onChange={(e) => set("successRate")(e.target.value)} />
                <div className="mt-1 flex justify-between text-label text-muted-foreground tabular-nums"><span>1% (aggressive)</span><span>99% (conservative)</span></div>
              </div>
              <div className="min-w-0 sm:border-l sm:border-border sm:pl-8" data-pair>
                <span className="block text-label text-muted-foreground" data-k>{modeLabel + " age, in market history"}</span>
                <div id="fiSuccessAge" className={cn("tabular-nums", successFail ? "text-destructive" : "text-foreground")}>
                  <span className="inline-flex items-center gap-2 text-3xl leading-tight font-medium sm:text-display">
                    {successFail ? <CircleXIcon className="size-6 shrink-0" aria-hidden="true" /> : null}{successAge[0]}
                  </span>{" "}
                  {successAge[1] ? <span className="block text-label text-muted-foreground">{successAge[1]}</span> : null}
                </div>
              </div>
            </div>
            <p className="m-0 mt-3.5 max-w-copy text-note text-muted-foreground" id="fiSliderNote">{sliderNote}</p>
          </div>

          {!S ? <Band id="fiEmpty">Enter a target to see when you&apos;d get there.</Band> : null}
          {never ? (
            <Band fail>{coast
              ? "Coasting can't reach the target by your planned retirement at " + retireAt + ", even saving every year until then. Try a later retirement age, saving more, or a smaller target."
              : "At this pace the portfolio doesn't reach the target. Try saving more, a higher rate of return, or a smaller target."}</Band>
          ) : null}

          {/* The rest of the plan, quietly. */}
          <div className="border-t border-border px-4.5 pt-3.5 pb-4 max-sm:px-3.5" hidden={!S}>
            <div className="grid2">
              <div>
                <KV k="Annual withdrawal" id="fiKVWithdrawal" v={kvs?.withdrawal ?? DASH} />
                <KV k="Contributions, future dollars" id="fiKVContribs" v={kvs?.contribs ?? DASH} />
                <KV k="Investment gains, future dollars" cls={gains > 0 ? "pos" : undefined} id="fiKVGains" v={kvs?.gains ?? DASH} />
              </div>
              <div>
                <div id="fiCoastExtra" hidden={!coast}>
                  <KV k="Portfolio if you kept saving" id="fiKeepSaving" v={keepSaving || DASH} />
                  <KV k="Extra vs. coasting" id="fiCoastGap" v={coastGapText || DASH} />
                </div>
                <KV k="Nominal return" id="fiKVNominal" v={kvs?.nominal ?? DASH} />
                <KV k="Real return" id="fiKVRealReturn" v={kvs?.real ?? DASH} />
              </div>
            </div>
          </div>
        </Card>

        <Card className="min-w-0" hidden={!S}>
          <CardHeader>
            <CardTitle>Portfolio growth</CardTitle>
            <CardDescription id="fiChartNote">{chart.note}</CardDescription>
            <CardAction>
              <span id="fiOptBand" className={hist ? "hidden" : "flex items-center gap-2"}>
                <span className="text-label text-muted-foreground max-sm:hidden" aria-hidden="true">Band</span>
                <Affixed prefix="&plusmn;" suffix="%" className="w-24 max-sm:w-27.5">
                  <NumberInput id="fiBand" nonNeg step={0.5} value={s.band} onValueChange={set("band")} aria-label="Return band" />
                </Affixed>
              </span>
            </CardAction>
          </CardHeader>
          <div className="hint m-0 max-w-copy px-4.5 pb-1" id="fiHistBar" hidden={!hist}>
            <span id="fiHistNote">{chart.H ? <HistBarNote H={chart.H} /> : null}</span>
          </div>
          <BandChart id="Fire" pts={chart.pts} maxX={chart.maxX} mode={chart.mode} xOffset={p.curAge} ariaLabel="Portfolio growth to FIRE"
            traces={hist && tracesOn && chart.H?.traces ? { xs: chart.pts.map((a) => a.year), lines: chart.H.traces } : undefined}
            extras={marks}
            tip={(b) => (
              <>
                <b>Year {b.year} Age {p.curAge + b.year}</b>
                {hist ? <FanTipRows b={b} /> : <BandTipRows b={b} />}
              </>
            )} />
          {!chart.pts.length ? <Legend id="legendFire" items={[]} />
            : hist ? <HistLegend id="legendFire" tracesOn={tracesOn} onToggleTraces={() => setTracesOn((v) => !v)} />
            : <Legend id="legendFire" items={[
              [SERIES.teal, p.band > 0 ? "At " + pctStr(p.nominal + p.band, 2) + " (+" + lbl + "%)" : "Higher"],
              [SERIES.plan, "At " + pctStr(p.nominal, 2) + " (your rate)"],
              [SERIES.rose, p.band > 0 ? "At " + pctStr(Math.max(0.001, p.nominal - p.band), 2) + " (−" + lbl + "%)" : "Lower"],
            ]} />}
        </Card>

        <div className="min-w-0" hidden={!S}>
          <Collapsible render={<Card />}>
            <CardHeader>
              <CardTitle><CollapsibleTrigger>Year by year<ChevronDownIcon aria-hidden="true" /></CollapsibleTrigger></CardTitle>
              {coast ? <CardDescription>Saving every year, as if you never stopped to coast.</CardDescription> : null}
              <CardAction><CsvButton table={tableRef} label="Year by year" /></CardAction>
            </CardHeader>
            <CollapsibleContent keepMounted>
              <div className="swipehint">Swipe the table sideways to see every column.</div>
              <div className="scroll max-h-none">
                <table id="fiTable" ref={tableRef}>
                  <thead><tr><th>Age</th><th>Start balance</th><th>Contributions</th><th>Growth</th><th>End balance</th><th>Inflation adj.</th></tr></thead>
                  <tbody id="fiTableBody">
                    {S?.pp.years.map((y) => (
                      <tr key={y.year} className={S.fireYear !== null && y.year === Math.ceil(S.fireYear) ? "firow-fire" : undefined}>
                        <td>{p.curAge + y.year}</td><td>{money(y.start || 0)}</td><td>{money(y.contrib || 0)}</td><td className="pos">{money(y.growth || 0)}</td>
                        <td>{money(y.end || 0)}</td><td>{money((y.end || 0) / Math.pow(1 + p.inflation, y.year))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </div>
  );
}
