"use client";

/* Saved Drawdown Simulator scenarios side by side: each one's median
   balance through history, and its results. Read only, like the retirement
   compare. From buildDDComparePickers() and renderDDCompare() in
   src/js/app/05-compare.js. */

import { useMemo, useRef, useState } from "react";
import { CircleAlertIcon, CircleCheckIcon, CircleXIcon, InfoIcon } from "lucide-react";
import { MULTI_COLORS, MultiChart } from "@/components/charts/MultiChart";
import { Legend } from "@/components/charts/Legend";
import { readScenarios } from "@/components/tools/ToolState";
import { CsvButton } from "@/components/common/CsvButton";
import { ddOptsFromState, historicalBacktest } from "@/lib/engine/typed-drawdown";
import { fmtNum, money, pctStr } from "@/lib/format";
import { DRAWDOWN_DEFAULTS, ddRaw, type DrawdownState } from "@/tools/drawdown/fields";
import { DD_STRAT_NAMES, mixText } from "@/tools/drawdown/text";
import { CMP_LETTERS } from "./model";
import { CompareHead, SlotFigure, SlotHint, SlotRow, SlotSecond } from "./Slot";
import { cn } from "@/lib/utils";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";

/* The slots, kept for the visit. */
const slotMemory = { names: ["", "", ""] };
function remember(names: string[]) {
  slotMemory.names = names;
}

function run(name: string) {
  const sc = name ? readScenarios("drawdown").find((x) => x.name === name) : null;
  if (!sc) return null;
  const o = ddOptsFromState(ddRaw({ ...DRAWDOWN_DEFAULTS, ...(sc.data as Partial<DrawdownState>) } as DrawdownState));
  if (!(o.initial > 0) || !(o.years > 0)) return null;
  const H = historicalBacktest(o);
  if (!H.total) return null;
  const med = [{ year: 0, value: o.initial }];
  for (let y = 1; y <= o.years; y++) {
    const vals = H.runs.map((r) => (r.rows[y - 1] ? r.rows[y - 1].realEnd : 0)).sort((a, b) => a - b);
    med.push({ year: y, value: vals[Math.floor(vals.length * 0.5)] || 0 });
  }
  return { o, H, med };
}

const TONE_ICON = { gain: CircleCheckIcon, text: CircleAlertIcon, loss: CircleXIcon } as const;
const TONE_TEXT = { gain: "text-gain", text: "text-foreground", loss: "text-destructive" } as const;
// The success rate is a rating: gain from 95%, plain text from 85%, loss below.
const toneOf = (s: number) => (s >= 0.95 ? "gain" : s >= 0.85 ? "text" : "loss");

export function DDCompare() {
  const names = readScenarios("drawdown").map((x) => x.name);
  const [slots, setSlots] = useState<string[]>(() => {
    const [a, b, c] = slotMemory.names;
    const s0 = names.includes(a) ? a : names[0] || "";
    const s1 = names.includes(b) && b !== s0 ? b : names.find((x) => x !== s0) || "";
    return [s0, s1, names.includes(c) ? c : ""];
  });
  const table = useRef<HTMLTableElement>(null);
  const all = useMemo(() => slots.map((name, i) => ({ i, name, r: run(name) })), [slots]);
  const live = all.filter((x) => x.r);
  const enough = names.length >= 2;
  /* The success rate with its rating's glyph; the row's label is its word. */
  const rate = (x: (typeof live)[number]) => {
    const s = x.r!.H.successRate, t = toneOf(s), Icon = TONE_ICON[t];
    return <span className={cn("inline-flex items-center gap-1.5", TONE_TEXT[t])}><Icon className="size-3.5 shrink-0" aria-hidden="true" />{pctStr(s, 1)}</span>;
  };
  const rows: [string, (x: (typeof live)[number]) => React.ReactNode][] = [
    ["Strategy", (x) => DD_STRAT_NAMES[x.r!.o.strategy] || x.r!.o.strategy],
    ["Withdrawal rate", (x) => (x.r!.o.strategy === "vpw" ? "VPW at " + (x.r!.o.vpwRate || 0).toFixed(2) + "% real" : x.r!.o.initialPct.toFixed(1) + "%")],
    ["Asset mix", (x) => mixText(x.r!.o)],
    ["Periods tested", (x) => x.r!.H.total + ""],
    ["Success rate", rate],
    ["Median ending balance", (x) => money(x.r!.H.medianEnd)],
    ["Worst case", (x) => money(x.r!.H.worstEnd)],
    ["Failure years", (x) => { const f = x.r!.H.failYears; return f.length ? f.slice(0, 5).join(", ") + (f.length > 5 ? "…" : "") : "None"; }],
  ];
  const swatch = (i: number) => <i className="mr-1.5 inline-block size-2 rounded-xs bg-(--swatch) align-middle" style={{ "--swatch": MULTI_COLORS[i] } as React.CSSProperties} aria-hidden="true"></i>;
  return (
    <div className="grid grid-cols-1 items-start gap-5 max-sm:gap-3.5 lg:grid-cols-3" id="tab-dd-compare">
      <CompareHead backId="ddCmpBack" title="Compare drawdown scenarios">
        <span id="ddCmpHelp" hidden={!enough}>Comparison reads saved scenarios only. Nothing here changes the numbers on the Drawdown Simulator tab.</span>
      </CompareHead>

      <Card className="col-span-full" hidden={enough}>
        <div className="flex items-start gap-2.5 px-4.5 text-body max-sm:px-4" id="ddCmpEmpty" hidden={enough}>
          {enough ? null : <>
            <InfoIcon className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="m-0 max-w-copy">{"You have " + (names.length ? "one saved scenario" : "no saved scenarios") +
              ". Save at least two Drawdown scenarios from the bar above, then come back to compare."}</p>
          </>}
        </div>
      </Card>

      <Card size="flush" className="min-w-0 lg:self-stretch" hidden={!enough}>
        <div id="ddCmpPickers">
          {enough ? slots.map((name, i) => {
            const x = all[i], t = x.r ? toneOf(x.r.H.successRate) : "text", Icon = TONE_ICON[t];
            return (
              <SlotRow key={i} i={i} pickers={
                <NativeSelect className="min-w-0 flex-1" data-ddcmp={i} aria-label={"Scenario " + CMP_LETTERS[i]} value={name} onChange={(e) => {
                  const next = slots.map((y, j) => (j === i ? e.target.value : y));
                  remember(next);
                  setSlots(next);
                }}>
                  {i === 2 ? <option value="">None</option> : null}
                  {names.map((nm) => <option key={nm}>{nm}</option>)}
                </NativeSelect>
              }>
                {x.r ? (
                  <SlotFigure id={"ddCmpFig" + i} label="Success rate" value={pctStr(x.r.H.successRate, 1)} tone={t}
                    icon={<Icon className="size-6 shrink-0" aria-hidden="true" />}>
                    <SlotSecond value={money(x.r.H.medianEnd)} note="median ending balance" />
                  </SlotFigure>
                ) : !name ? <SlotHint>Optional: pick a third scenario.</SlotHint> : null}
              </SlotRow>
            );
          }) : null}
        </div>
      </Card>

      <Card id="ddCmpChartPanel" className="min-w-0 lg:col-span-2" hidden={!enough}>
        <CardHeader><CardTitle>Median portfolio balance</CardTitle><CardDescription>in today&apos;s dollars, historical backtest</CardDescription></CardHeader>
        <MultiChart id="DDC" ariaLabel="Drawdown scenarios compared" maxX={Math.max(0, ...live.map((x) => x.r!.o.years)) || 1}
          series={live.map((x) => ({ name: x.name, color: MULTI_COLORS[x.i], pts: x.r!.med }))} head={(y) => <b>Year {fmtNum(y)}</b>} />
        <Legend id="legendDDC" items={live.map((x) => [MULTI_COLORS[x.i], x.name])} />
      </Card>

      <Card id="ddCmpOutPanel" className="col-span-full min-w-0" hidden={!enough}>
        <CardHeader><CardTitle>Results</CardTitle><CardAction><CsvButton table={table} label="Results" /></CardAction></CardHeader>
        <div className="swipehint">Swipe the table sideways to see every column.</div>
        <div className="scroll">
          <table id="ddCmpOutTable" ref={table}>
            <thead>{live.length ? <tr><th>Result</th>{live.map((x) => <th key={x.i}>{swatch(x.i)}{CMP_LETTERS[x.i] + " · " + x.name}</th>)}</tr> : null}</thead>
            <tbody>{live.length ? rows.map(([k, f]) => <tr key={k}><td className="whitespace-normal text-muted-foreground">{k}</td>{live.map((x) => <td key={x.i}>{f(x)}</td>)}</tr>) : null}</tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
