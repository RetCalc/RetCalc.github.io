"use client";

/* Diversifying and rebalancing: 60% US stocks and 40% 10-year Treasuries
   from the start of a chosen year to 2025, rebalanced every year, at a
   5-point band or never. The line is the stock share at each year end (the
   engine's backtest endMix, run to that year, via drift in history-data.ts);
   the never-rebalanced line stays beside it for comparison. Ending balance,
   return and deepest fall are the same backtest's, before inflation. */

import { useId, useMemo, useState } from "react";
import { NativeRange } from "@/components/ui/native-range";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { Chart, fmt } from "../Chart";
import { LAST_YEAR, drift, type RebalRule } from "./history-data";

const RULES: { id: RebalRule; text: string; long: string }[] = [
  { id: "year", text: "Yearly", long: "Rebalanced every year" },
  { id: "band", text: "5-point band", long: "Rebalanced at a 5-point band" },
  { id: "never", text: "Never", long: "Never rebalanced" },
];

export function Rebalance({ label }: { label: string }) {
  const [start, setStart] = useState(1996);
  const [rule, setRule] = useState<RebalRule>("year");
  const id = useId();
  const d = useMemo(() => drift(start, rule), [start, rule]);
  const R = RULES.find((x) => x.id === rule)!, a = d.rule, n = d.never;
  const money = (v: number) => fmt(Math.round(v / 1000) * 1000, "money", false);
  const pct = (v: number, k = 0) => `${(v * 100).toFixed(k)}%`;
  return (
    <>
      <div className="lrn-mixes">
        <span className="lrn-cap">Rebalance</span>
        <Segmented role="group" aria-label="When to rebalance">
          {RULES.map((x) => <SegmentedItem key={x.id} pressed={rule === x.id} onClick={() => setRule(x.id)}>{x.text}</SegmentedItem>)}
        </Segmented>
      </div>
      <Chart label={label} spec={{
        type: "line", x: d.x, xLabel: "Year end", y: "pct",
        levels: [{ y: 0.6, label: "60% target" }],
        series: [
          { name: `Share in stocks, ${R.long.toLowerCase()}`, values: a.share, tone: "accent" },
          ...(n ? [{ name: "Never rebalanced", values: n.share, tone: "muted" as const, dash: true }] : []),
        ],
      }} />
      <div className="lrn-mover">
        <label htmlFor={id}>Start of</label>
        <NativeRange id={id} min={1926} max={LAST_YEAR - 9} step={1} value={start} onChange={(e) => setStart(+e.target.value)} />
        <output htmlFor={id}>{start} to {LAST_YEAR}</output>
      </div>
      <p className="lrn-readout">
        {R.long}{rule === "never" ? "" : rule === "band" ? ` (${a.rebalances} times)` : ""}, $100,000 put in at the start of {start} grew to <b>{money(a.end)}</b> by the end of {LAST_YEAR}, {pct(a.cagr, 1)} per year before inflation, and finished at <b>{pct(a.share[a.share.length - 1])} stocks</b>. Its deepest fall, measured at year ends, was {pct(-a.maxDD)}.
        {n ? <> Left alone, it would have grown to <b>{money(n.end)}</b> and finished at <b>{pct(n.share[n.share.length - 1])} stocks</b>, with a deepest fall of {pct(-n.maxDD)}.</> : null}
      </p>
    </>
  );
}
