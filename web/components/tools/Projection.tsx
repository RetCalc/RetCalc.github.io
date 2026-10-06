"use client";

/* The pieces Advanced and Stages show the same way: the headline figures
   under the inputs, and the balance chart with its rate-band, market-history
   and Monte Carlo modes. Each takes its own element ids, "r…" and "x…",
   "chart" and "chartS", as the old pages had them. From renderProjection(),
   drawChart(), renderSeries() and drawSeriesChart() in src/js/app/. */

import { useState } from "react";
import { BandChart, type BandPoint } from "@/components/charts/BandChart";
import { HistBarNote, HistSummary, McSummary } from "@/components/charts/HistNotes";
import { HistLegend, Legend, McLegend } from "@/components/charts/Legend";
import { BandTipRows, FanTipRows } from "@/components/charts/TipRows";
import { Affixed, Field } from "@/components/fields/Field";
import { NumberInput } from "@/components/fields/NumberInput";
import { useToast } from "@/components/shell/Toast";
import { Tipped } from "@/components/shell/Tooltips";
import { Figure, KV, Segmented } from "@/components/common/Readout";
import type { HistRuns, MCBand, MCResult } from "@/lib/engine/types";
import { money } from "@/lib/format";
import { reroll } from "@/lib/mc-seed";
import { PERIOD_ADV } from "@/lib/periods";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type ChartMode = "band" | "hist" | "mc";

/* ---- the headline ---- */

interface Totals {
  fv: number; fvReal: number; afterTax: number; afterTaxMo: number; invested: number; growth: number;
  contribTotal: number; lastContribReal: number; wd: number; wdReal: number;
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
      <CardContent>
        <div className="grid2">
          <div>
            <KV k="Amount invested" id={p + "Invested"} v={money(R.invested)} />
            <KV k="Growth" cls="pos" id={p + "Growth"} v={money(R.growth)} />
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
      </CardContent>
    </Card>
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
}

export function ProjectionChart(props: PanelProps) {
  const { sfx, segId, ariaLabel, mode, setMode, band, setBand, chart, legendExtra, target, targetLabel } = props;
  const toast = useToast();
  const [tracesOn, setTracesOn] = useState(true);
  return (
    <Card>
      <CardHeader><CardTitle>Balance over time, inflation adjusted</CardTitle><CardAction>
          <Segmented id={segId} attr="data-mode" options={[["band", "Rate band"], ["hist", "Historical"], ["mc", "Monte Carlo"]] as const} value={mode} onChange={setMode} />{"\n          "}
          <span className="modeopt" id={"optBand" + sfx} hidden={mode !== "band"}>
            <Affixed prefix="±" suffix="%" className="w-24 max-sm:w-27.5">
              <NumberInput id={"band" + sfx} nonNeg step={0.5} value={band} onValueChange={setBand} aria-label="Return comparison band, percent" />
            </Affixed>
          </span>
        </CardAction></CardHeader>
      <div className="mcbar" id={"histBar" + sfx} hidden={mode !== "hist"}>
        <Field id={"histMix" + sfx} label={<Tipped text="Stock mix" k="histmix" />}>
          <Affixed suffix="%" className="w-26"><NumberInput id={"histMix" + sfx} nonNeg step={5} max={100} value={props.histMix} onValueChange={props.setHistMix} /></Affixed></Field>
        <Field id={"histMixEnd" + sfx} wrapId={"histGlideWrap" + sfx} hidden={!props.glides} label={<Tipped text="Glides to" k="histglidemix" />}>
          <Affixed suffix="%" className="w-26"><NumberInput id={"histMixEnd" + sfx} nonNeg step={5} max={100} value={props.histMixEnd} onValueChange={props.setHistMixEnd} /></Affixed></Field>
        <div className="hint m-0" id={"histNote" + sfx}>{chart.H ? <HistBarNote H={chart.H} /> : null}</div>
      </div>
      <div className="mcbar" id={"mcBar" + sfx} hidden={mode !== "mc"}>
        {props.mcFields}
        <Button variant="outline" id={"btnReroll" + sfx} onClick={() => {
          reroll();
          toast("New set of runs");
        }}>Re-roll</Button>
        <div className="hint m-0">{props.mcHint}</div>
      </div>
      <BandChart id={sfx} pts={chart.pts} maxX={props.maxX} mode={chart.fan ? "mc" : "band"} stageMarks={chart.marks} enhanced ariaLabel={ariaLabel}
        traces={chart.traces && tracesOn ? chart.traces : undefined}
        tip={(b) => <>{props.tipHead(b)}{chart.fan ? <FanTipRows b={b} /> : <BandTipRows b={b} />}</>} />
      {chart.legend === "hist" ? <HistLegend id={"legend" + sfx} tracesOn={tracesOn} onToggleTraces={() => setTracesOn((v) => !v)} extra={legendExtra} />
        : chart.legend === "mc" ? <McLegend id={"legend" + sfx} extra={legendExtra} />
          : <Legend id={"legend" + sfx} items={chart.legend === "band" ? props.bandItems : []} />}
      {mode === "hist" ? <HistSummary id={"mcNote" + sfx} H={chart.H} target={chart.H?.count ? target : 0} label={targetLabel} />
        : mode === "mc" ? <McSummary id={"mcNote" + sfx} mc={chart.mc} target={target} label={targetLabel} />
          : <div className="mcnote" id={"mcNote" + sfx} hidden></div>}
    </Card>
  );
}

/** "2" for a 2% band, "0.5" for half a point. */
export function bandLabel(band: number): string {
  return (band * 100).toFixed(2).replace(/\.?0+$/, "");
}
