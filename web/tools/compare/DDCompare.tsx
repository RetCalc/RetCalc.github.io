"use client";

/* Saved Drawdown Simulator scenarios side by side: each one's median
   balance through history, and its results. Read only, like the retirement
   compare. From buildDDComparePickers() and renderDDCompare() in
   src/js/app/05-compare.js. */

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MULTI_COLORS, MultiChart } from "@/components/charts/MultiChart";
import { Legend } from "@/components/charts/Legend";
import { readScenarios } from "@/components/tools/ToolState";
import { CsvButton } from "@/components/common/CsvButton";
import { compareNav } from "@/lib/compare-nav";
import { ddOptsFromState, historicalBacktest } from "@/lib/engine/typed-drawdown";
import { fmtNum, money, pctStr } from "@/lib/format";
import { DRAWDOWN_DEFAULTS, ddRaw, type DrawdownState } from "@/tools/drawdown/fields";
import { DD_STRAT_NAMES, mixText } from "@/tools/drawdown/text";
import { CMP_LETTERS } from "./model";
import { setNavDir } from "@/lib/nav-motion";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export function DDCompare() {
  const router = useRouter();
  const names = readScenarios("drawdown").map((x) => x.name);
  const [slots, setSlots] = useState<string[]>(() => {
    const [a, b, c] = slotMemory.names;
    const s0 = names.includes(a) ? a : names[0] || "";
    const s1 = names.includes(b) && b !== s0 ? b : names.find((x) => x !== s0) || "";
    return [s0, s1, names.includes(c) ? c : ""];
  });
  const table = useRef<HTMLTableElement>(null);
  const live = useMemo(() => slots.map((name, i) => ({ i, name, r: run(name) })).filter((x) => x.r), [slots]);
  const enough = names.length >= 2;
  const rows: [string, (x: (typeof live)[number]) => React.ReactNode][] = [
    ["Strategy", (x) => DD_STRAT_NAMES[x.r!.o.strategy] || x.r!.o.strategy],
    ["Withdrawal rate", (x) => (x.r!.o.strategy === "vpw" ? "VPW at " + (x.r!.o.vpwRate || 0).toFixed(2) + "% real" : x.r!.o.initialPct.toFixed(1) + "%")],
    ["Asset mix", (x) => mixText(x.r!.o)],
    ["Periods tested", (x) => x.r!.H.total + ""],
    ["Success rate", (x) => { const s = x.r!.H.successRate; return <span className={s >= 0.95 ? "pos" : s >= 0.85 ? "mid" : "neg"}>{pctStr(s, 1)}</span>; }],
    ["Median ending balance", (x) => money(x.r!.H.medianEnd)],
    ["Worst case", (x) => money(x.r!.H.worstEnd)],
    ["Failure years", (x) => { const f = x.r!.H.failYears; return f.length ? f.slice(0, 5).join(", ") + (f.length > 5 ? "…" : "") : "None"; }],
  ];
  return (
    <div className="stack" id="tab-dd-compare">
      <Card>
        <CardHeader><CardTitle>Compare drawdown scenarios</CardTitle><CardAction><Button variant="outline" size="sm" id="ddCmpBack" onClick={() => { setNavDir("back"); router.push(compareNav.path); }}>Back</Button></CardAction></CardHeader>
        <CardContent>
          <div className="hint" id="ddCmpEmpty" hidden={enough}>{enough ? null : "You have " + (names.length ? "one saved scenario" : "no saved scenarios") +
            ". Save at least two Drawdown scenarios from the bar above, then come back to compare."}</div>
          <div className="cmpgrid" id="ddCmpPickers">
            {enough ? slots.map((name, i) => (
              <div className="cmpslot" key={i}>
                <div className="cmpkey"><i className="bg-(--swatch)" style={{ "--swatch": MULTI_COLORS[i] } as React.CSSProperties}></i>{CMP_LETTERS[i]}</div>
                <div className="field"><NativeSelect data-ddcmp={i} aria-label={"Scenario " + CMP_LETTERS[i]} value={name} onChange={(e) => {
                  const next = slots.map((x, j) => (j === i ? e.target.value : x));
                  remember(next);
                  setSlots(next);
                }}>
                  {i === 2 ? <option value="">None</option> : null}
                  {names.map((nm) => <option key={nm}>{nm}</option>)}
                </NativeSelect></div>
              </div>
            )) : null}
          </div>
          <div className="hint mt-3" id="ddCmpHelp" hidden={!enough}>Comparison reads saved scenarios only. Nothing here changes the numbers on the Drawdown Simulator tab.</div>
        </CardContent>
      </Card>
      <Card id="ddCmpChartPanel" hidden={!enough}>
        <CardHeader><CardTitle>Median portfolio balance</CardTitle><CardDescription>in today&apos;s dollars, historical backtest</CardDescription></CardHeader>
        <MultiChart id="DDC" ariaLabel="Drawdown scenarios compared" maxX={Math.max(0, ...live.map((x) => x.r!.o.years)) || 1}
          series={live.map((x) => ({ name: x.name, color: MULTI_COLORS[x.i], pts: x.r!.med }))} head={(y) => <b>Year {fmtNum(y)}</b>} />
        <Legend id="legendDDC" items={live.map((x) => [MULTI_COLORS[x.i], x.name])} />
      </Card>
      <Card id="ddCmpOutPanel" hidden={!enough}>
        <CardHeader><CardTitle>Results</CardTitle><CardAction><CsvButton table={table} label="Results" /></CardAction></CardHeader>
        <div className="swipehint">Swipe the table sideways to see every column.</div>
        <div className="scroll">
          <table id="ddCmpOutTable" ref={table}>
            <thead>{live.length ? <tr><th>Result</th>{live.map((x) => <th key={x.i}>{CMP_LETTERS[x.i] + " · " + x.name}</th>)}</tr> : null}</thead>
            <tbody>{live.length ? rows.map(([k, f]) => <tr key={k}><td>{k}</td>{live.map((x) => <td key={x.i}>{f(x)}</td>)}</tr>) : null}</tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
