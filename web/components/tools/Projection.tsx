"use client";

/* The pieces Advanced and Stages show the same way: the headline figures
   under the inputs, and the balance chart with its rate-band, market-history
   and Monte Carlo modes. Each takes its own element ids, "r…" and "x…",
   "chart" and "chartS", as the old pages had them. From renderProjection(),
   drawChart(), renderSeries() and drawSeriesChart() in src/js/app/. */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BandChart, type BandPoint } from "@/components/charts/BandChart";
import { MaximizeIcon, MinimizeIcon } from "lucide-react";
import { HistBarNote, HistSummary, McSummary } from "@/components/charts/HistNotes";
import { HistLegend, Legend, McLegend } from "@/components/charts/Legend";
import { BandTipRows, FanTipRows } from "@/components/charts/TipRows";
import { Affixed, Field } from "@/components/fields/Field";
import { NumberInput } from "@/components/fields/NumberInput";
import { useToast } from "@/components/shell/Toast";
import { Tipped } from "@/components/shell/Tooltips";
import { Figure, KV, Segmented } from "@/components/common/Readout";
import { CompositionBar, HeroReading, PartKey } from "@/components/common/Reading";
import { BigValue } from "@/components/common/BigValue";
import type { HistRuns, MCBand, MCResult } from "@/lib/engine/types";
import { money } from "@/lib/format";
import { reroll } from "@/lib/mc-seed";
import { PERIOD_ADV } from "@/lib/periods";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type ChartMode = "band" | "hist" | "mc";

/* ---- the headline ---- */

interface Totals {
  fv: number; fvReal: number; afterTax: number; afterTaxMo: number; invested: number; growth: number;
  contribTotal: number; lastContribReal: number; wd: number; wdReal: number;
}

/** The eight totals under the headline: what went in and what comes out. */
function ProjectionTotals({ p, R, lastPeriod, keys }: { p: "r" | "x"; R: Totals; lastPeriod: string | null; keys?: boolean }) {
  return (
    <div className="grid2">
      <div>
        <KV k={keys ? <><PartKey tone="in" />Amount invested</> : "Amount invested"} id={p + "Invested"} v={money(R.invested)} />
        <KV k={keys ? <><PartKey tone="gain" />Growth</> : "Growth"} cls="pos" id={p + "Growth"} v={money(R.growth)} />
        <KV k="Total contributions" id={p + "Contribs"} v={money(R.contribTotal)} />
        <KV k="Final contribution, inflation adjusted" id={p + "LastContrib"} v={lastPeriod ? money(R.lastContribReal) + " " + PERIOD_ADV[lastPeriod] : money(0)} />
      </div>
      <div>
        <KV k="Annual withdrawal" id={p + "Wd"} v={money(R.wd)} />
        <KV k="Annual withdrawal, inflation adjusted" id={p + "WdReal"} v={money(R.wdReal)} />
        <KV k="After tax, per year" id={p + "AfterTax"} v={money(R.afterTax)} />
        <KV k="After tax, per month" id={p + "AfterTaxMo"} v={money(R.afterTaxMo)} />
      </div>
    </div>
  );
}

/** The three headline figures and the eight totals under them. `p`: the
    ids' prefix. `lastPeriod`: how often the final contribution is paid. */
export function ProjectionSummary({ p, R, lastPeriod, fvNote, realNote }: {
  p: "r" | "x"; R: Totals; lastPeriod: string | null; fvNote: string; realNote: string;
}) {
  return (
    <Card size="flush">
      <div className="headline">
        <Figure label="Future value" id={p + "FV"} className="v" value={money(R.fv)} noteId={p + "FVnote"} note={fvNote} />
        <Figure label="Inflation adjusted" id={p + "FVreal"} className="v" value={money(R.fvReal)} noteId={p + "FVrealnote"} note={realNote} />
        <Figure label="After-tax income, per year" id={p + "Monthly"} className="v gold" value={money(R.afterTax)} note="Inflation adjusted, first year of retirement" />
      </div>
      <CardContent><ProjectionTotals p={p} R={R} lastPeriod={lastPeriod} /></CardContent>
    </Card>
  );
}

/** The same figures as a hero reading (DESIGN.md, "Hero reading"): the
    after-tax income a year as the answer, the future and inflation-adjusted
    balances beside it, then what the balance is made of and the totals.
    `children` get a band under the reading (the target and its verdict). */
export function ProjectionReading({ p, R, lastPeriod, fvNote, realNote, id, children }: {
  p: "r" | "x"; R: Totals; lastPeriod: string | null; fvNote: string; realNote: string; id?: string; children?: React.ReactNode;
}) {
  // Amount invested and growth as shares of the balance, while it grew.
  const bar = R.fv > 0 && R.growth >= 0;
  return (
    <Card size="flush" id={id}>
      <HeroReading
        hero={{ label: "After-tax income, per year", id: p + "Monthly", value: money(R.afterTax), note: "Inflation adjusted, first year of retirement" }}
        figures={[
          { label: "Future value", id: p + "FV", value: money(R.fv), noteId: p + "FVnote", note: fvNote },
          { label: "Inflation adjusted", id: p + "FVreal", value: money(R.fvReal), noteId: p + "FVrealnote", note: realNote },
        ]} />
      {children ? <div className="border-t border-border px-4.5 py-3 max-sm:px-3.5">{children}</div> : null}
      <div className="border-t border-border px-4.5 pt-3.5 pb-4 max-sm:px-3.5">
        {bar ? <CompositionBar parts={[{ share: R.invested / R.fv, tone: "in" }, { share: R.growth / R.fv, tone: "gain" }]} /> : null}
        <ProjectionTotals p={p} R={R} lastPeriod={lastPeriod} keys={bar} />
      </div>
    </Card>
  );
}

/** One way to reach the target, in "Reach your target": the figure at
    Display size, in Text (the answer above keeps the amber), what it
    assumes, and its apply button. */
export function SolveOption({ label, id, value, sized = false, note, noteId, className, children }: {
  label: string; id: string; value: string; sized?: boolean; note: string; noteId: string; className?: string; children: React.ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col border-border px-4.5 pt-4 pb-4.5 max-sm:px-3.5", className)}>
      <div className="mb-2 text-label text-muted-foreground">{label}</div>
      <BigValue className="text-3xl leading-tight font-medium whitespace-nowrap tabular-nums sm:text-display" id={id} text={value} sized={sized} />
      <div className="mt-1.5 mb-1.5 min-h-4 text-label text-muted-foreground" id={noteId}>{note}</div>
      {children}
    </div>
  );
}

/* ---- the chart ---- */

/** What the chart draws: its points, whether they're a percentile fan, the
    market-history or Monte Carlo run behind them, and the per-start lines. */
export interface ChartData {
  pts: BandPoint[];
  fan: boolean;
  legend: ChartMode | null;
  H: HistRuns | null;
  mc: MCResult | null;
  traces: { xs: number[]; lines: (number | null)[][] } | null;
  marks: { year: number; label: string }[];
}

export function emptyChart(fan = false): ChartData {
  return { pts: [], fan, legend: null, H: null, mc: null, traces: null, marks: [] };
}

/** A percentile fan from the starting point and a run's yearly bands. */
export function fanPoints<B extends MCBand>(start: BandPoint, bands: B[], more?: (b: B, i: number) => Partial<BandPoint>): BandPoint[] {
  return [start, ...bands.map((b, i) => ({ year: b.year, base: b.p50, hi: b.p90, lo: b.p10, p25: b.p25, p75: b.p75, ...more?.(b, i) }))];
}

/** A market-history chart: the fan, and one faint line per starting year. */
export function histChart(start: BandPoint, H: HistRuns, marks: ChartData["marks"] = [], more?: (b: MCBand) => Partial<BandPoint>): ChartData {
  if (!H.count) return { ...emptyChart(true), H };
  const pts = fanPoints(start, H.bands, more);
  return {
    ...emptyChart(true), pts, legend: "hist", H, marks,
    traces: { xs: pts.map((a) => a.year), lines: (H.traces ?? []).map((t) => [start.base, ...t]) },
  };
}

interface PanelProps {
  /** "" on Advanced, "S" on Stages: the suffix on every id in the panel. */
  sfx: "" | "S";
  segId: string;
  ariaLabel: string;
  mode: ChartMode;
  setMode: (m: ChartMode) => void;
  band: string;
  setBand: (v: string) => void;
  histMix: string;
  setHistMix: (v: string) => void;
  histMixEnd: string;
  setHistMixEnd: (v: string) => void;
  /** The glide's ending mix is asked for only when the plan glides. */
  glides: boolean;
  /** In place of the stock share field: a button that opens a fuller mix
      (the Dashboard's Calculator: US stocks, small-cap value, bonds, cash). */
  mixButton?: React.ReactNode;
  /** Fields in the Monte Carlo bar before Re-roll, and the note after it. */
  mcFields?: React.ReactNode;
  mcHint: React.ReactNode;
  chart: ChartData;
  maxX: number;
  /** The rate band's three lines, labeled. */
  bandItems: [string, string][];
  /** A legend entry for the stage boundaries. */
  legendExtra?: string;
  /** The tooltip's first line. */
  tipHead: (b: BandPoint) => React.ReactNode;
  /** The portfolio the summary under the chart measures runs against. */
  target: number;
  targetLabel: string;
  /** Added to the years on the x axis: your age at year 0, where it's known. */
  xOffset?: number;
  /** The Dashboard's layout: the mode switch alone in the header, one row
      of the same height under it holding the mode's own control (the
      band, the asset mix, Re-roll), a taller drawing, and Full screen on
      wider screens. */
  layout?: "fixed";
  aspect?: number; gutter?: number;
  /** The fixed layout's words beside the return band. */
  bandHint?: string;
}

export function ProjectionChart(props: PanelProps) {
  const { sfx, segId, ariaLabel, mode, setMode, band, setBand, chart, legendExtra, target, targetLabel } = props;
  const toast = useToast();
  const [tracesOn, setTracesOn] = useState(true);
  const fixed = props.layout === "fixed";
  // Full screen (the fixed layout): the same card over the page, the
  // drawing drawn at the size of the space it gets, as wide as the window
  // and as tall as the rest of the card leaves room for. Escape closes it.
  const [full, setFull] = useState(false);
  const [fullPx, setFullPx] = useState<{ w: number; h: number } | undefined>();
  const fullRef = useRef<HTMLDivElement>(null);
  const fitFull = () => {
    const box = fullRef.current, svg = box?.querySelector<SVGSVGElement>(".chartwrap > svg"), card = box?.firstElementChild as HTMLElement | null;
    if (!box || !svg || !card) return;
    const wrap = svg.parentElement as HTMLElement, cs = getComputedStyle(wrap), bs = getComputedStyle(box);
    const w = Math.floor(wrap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
    const rest = card.offsetHeight - svg.getBoundingClientRect().height;
    const h = Math.floor(Math.max(320, box.clientHeight - parseFloat(bs.paddingTop) - parseFloat(bs.paddingBottom) - rest));
    setFullPx((p) => (p && Math.abs(p.w - w) < 2 && Math.abs(p.h - h) < 2 ? p : { w, h }));
  };
  // Again after every render: switching modes changes what sits around the drawing.
  useLayoutEffect(() => { if (full) fitFull(); });
  useEffect(() => {
    if (!full) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setFull(false); };
    window.addEventListener("resize", fitFull); window.addEventListener("keydown", key);
    return () => { window.removeEventListener("resize", fitFull); window.removeEventListener("keydown", key); };
  }, [full]);
  const bandField = (
    <Affixed prefix="±" suffix="%" className="w-24 max-sm:w-27.5">
      <NumberInput id={"band" + sfx} nonNeg step={0.5} value={band} onValueChange={setBand} aria-label="Return comparison band, percent" />
    </Affixed>
  );
  const mixField = props.mixButton ?? (
    <Field id={"histMix" + sfx} label={<Tipped text="Stock mix" k="histmix" />}>
      <Affixed suffix="%" className="w-26"><NumberInput id={"histMix" + sfx} nonNeg step={5} max={100} value={props.histMix} onValueChange={props.setHistMix} /></Affixed></Field>
  );
  const glideField = (
    <Field id={"histMixEnd" + sfx} wrapId={"histGlideWrap" + sfx} hidden={!props.glides} label={<Tipped text="Glides to" k="histglidemix" />}>
      <Affixed suffix="%" className="w-26"><NumberInput id={"histMixEnd" + sfx} nonNeg step={5} max={100} value={props.histMixEnd} onValueChange={props.setHistMixEnd} /></Affixed></Field>
  );
  const rerollBtn = (
    <Button variant="outline" id={"btnReroll" + sfx} onClick={() => {
      reroll();
      toast("New set of runs");
    }}>Re-roll</Button>
  );
  const body = (aspect: number | undefined, inFull: boolean, px?: { w: number; h: number }) => (
    <Card>
      {/* On a phone the controls drop under the title: the switch full
          width in three equal segments, the mode's field after it. */}
      <CardHeader className="max-sm:grid-cols-1"><CardTitle>Balance over time, inflation adjusted</CardTitle>
        <CardAction className="max-sm:col-start-1 max-sm:row-span-1 max-sm:row-start-2 max-sm:w-full max-sm:justify-self-stretch">
          <Segmented id={segId + (inFull ? "F" : "")} size="chart" attr="data-mode" options={[["band", "Rate band"], ["hist", "Historical"], ["mc", "Monte Carlo"]] as const} value={mode} onChange={setMode} />{"\n          "}
          {fixed ? null : <span className="modeopt" id={"optBand" + sfx} hidden={mode !== "band"}>{bandField}</span>}
        </CardAction></CardHeader>
      {fixed ? (
        <div className="mcbar mcbar-fixed" id={"modeBar" + sfx + (inFull ? "F" : "")}>
          {mode === "band" ? <><Field id={"band" + sfx} label="Return band">{bandField}</Field><div className="hint m-0">{props.bandHint ?? "Every stage's return this much higher, and this much lower."}</div></>
            : mode === "hist" ? <>{mixField}{glideField}<div className="hint m-0" id={"histNote" + sfx}>{chart.H ? <HistBarNote H={chart.H} /> : null}</div></>
              : <>{props.mcFields}{rerollBtn}<div className="hint m-0">{props.mcHint}</div></>}
          <span className="chart-fullbtn"><Button variant="outline" size="icon" onClick={() => setFull(!inFull)} aria-label={inFull ? "Close full screen" : "Full screen"} title={inFull ? "Close full screen" : "Full screen"}>{inFull ? <MinimizeIcon aria-hidden="true" /> : <MaximizeIcon aria-hidden="true" />}</Button></span>
        </div>
      ) : <>
        <div className="mcbar" id={"histBar" + sfx} hidden={mode !== "hist"}>
          {mixField}
          {glideField}
          <div className="hint m-0" id={"histNote" + sfx}>{chart.H ? <HistBarNote H={chart.H} /> : null}</div>
        </div>
        <div className="mcbar" id={"mcBar" + sfx} hidden={mode !== "mc"}>
          {props.mcFields}
          {rerollBtn}
          <div className="hint m-0">{props.mcHint}</div>
        </div>
      </>}
      <BandChart id={inFull ? sfx + "F" : sfx} pts={chart.pts} maxX={props.maxX} mode={chart.fan ? "mc" : "band"} stageMarks={chart.marks} enhanced ariaLabel={ariaLabel} xOffset={props.xOffset}
        aspect={aspect} gutter={props.gutter} px={px}
        traces={chart.traces && tracesOn ? chart.traces : undefined}
        tip={(b) => <>{props.tipHead(b)}{chart.fan ? <FanTipRows b={b} /> : <BandTipRows b={b} />}</>} />
      {chart.legend === "hist" ? <HistLegend id={"legend" + sfx + (inFull ? "F" : "")} tracesOn={tracesOn} onToggleTraces={() => setTracesOn((v) => !v)} extra={legendExtra} />
        : chart.legend === "mc" ? <McLegend id={"legend" + sfx + (inFull ? "F" : "")} extra={legendExtra} />
          : <Legend id={"legend" + sfx + (inFull ? "F" : "")} items={chart.legend === "band" ? props.bandItems : []} />}
      {mode === "hist" ? <HistSummary id={"mcNote" + sfx + (inFull ? "F" : "")} H={chart.H} target={chart.H?.count ? target : 0} label={targetLabel} />
        : mode === "mc" ? <McSummary id={"mcNote" + sfx + (inFull ? "F" : "")} mc={chart.mc} target={target} label={targetLabel} />
          : <div className="mcnote" id={"mcNote" + sfx + (inFull ? "F" : "")} hidden></div>}
    </Card>
  );
  return (
    <>
      {body(props.aspect, false)}
      {/* On the page's top layer, so the site's own header can't sit over it. */}
      {full ? createPortal(<div className="chart-full" ref={fullRef} role="dialog" aria-label="Balance over time, full screen">{body(props.aspect, true, fullPx)}</div>, document.body) : null}
    </>
  );
}

/** "2" for a 2% band, "0.5" for half a point. */
export function bandLabel(band: number): string {
  return (band * 100).toFixed(2).replace(/\.?0+$/, "");
}
