"use client";

/* How much in stocks: the trade at one stock share. The chart is Jordan's
   balance after 25 years at every share from 0% to 100% (the worst start and
   the 10th, 50th and 90th percentiles of 901 monthly starts, historicalRuns),
   with the chosen share marked; the readout adds what 2008 did to $500,000
   at that mix (the engine's calendar-year return for it, backtest). */

import { useId, useMemo, useState } from "react";
import { NativeRange } from "@/components/ui/native-range";
import { Chart, fmt } from "../Chart";
import { shareOutcomes, year2008 } from "./history-data";

export function StockShare({ label }: { label: string }) {
  const [stock, setStock] = useState(80);
  const id = useId();
  const all = useMemo(() => shareOutcomes(), []);
  const at = all.find((a) => a.share === stock) ?? all[all.length - 1];
  const y08 = useMemo(() => year2008(stock), [stock]);
  const money = (v: number) => fmt(Math.round(v / 1000) * 1000, "money", false);
  return (
    <>
      <Chart label={label} spec={{
        type: "line", x: all.map((a) => a.share), xLabel: "Share in stocks (%)", y: "money",
        series: [
          { name: "Good case (1 in 10 did better)", values: all.map((a) => a.p90), tone: "good" },
          { name: "Middle case", values: all.map((a) => a.p50), tone: "accent" },
          { name: "Bad case (1 in 10 did worse)", values: all.map((a) => a.p10), tone: "bad" },
          { name: "Worst start", values: all.map((a) => a.worst), tone: "muted", dash: true },
        ],
        marks: [{ x: stock, label: `${stock}% stocks` }],
      }} />
      <div className="lrn-mover">
        <label htmlFor={id}>Share in stocks</label>
        <NativeRange id={id} min={0} max={100} step={10} value={stock} onChange={(e) => setStock(+e.target.value)} />
        <output htmlFor={id}>{stock} / {100 - stock}</output>
      </div>
      <p className="lrn-readout">
        At {stock}% stocks, Jordan ended 25 years with <b>{money(at.p10)}</b> in the bad case, <b>{money(at.p50)}</b> in the middle and <b>{money(at.p90)}</b> in the good case; the worst start, in {at.worstYear}, left {money(at.worst)}.
        {" "}The price along the way: in 2008 the same mix {y08.ret < 0 ? "lost" : "gained"} <b>{Math.abs(y08.ret * 100).toFixed(1)}%</b>, turning $500,000 into <b>{money(y08.left)}</b>.
      </p>
    </>
  );
}
