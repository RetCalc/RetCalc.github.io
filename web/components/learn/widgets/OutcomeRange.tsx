"use client";

/* A range, not a line: Jordan's savings ($100,000 plus $1,000 per month,
   raised 3% per year) run through every monthly start in the record at a
   chosen stock share and length (historicalRuns), drawn as the 10th, 50th
   and 90th percentiles at each year end beside the steady line at that
   mix's 1926–2025 return after inflation (outcomeRange, history-data.ts). */

import { useId, useMemo, useState } from "react";
import { NativeRange } from "@/components/ui/native-range";
import { Chart, fmt } from "../Chart";
import { outcomeRange } from "./history-data";

export function OutcomeRange({ label }: { label: string }) {
  const [stock, setStock] = useState(80);
  const [years, setYears] = useState(25);
  const idS = useId(), idY = useId();
  const r = useMemo(() => outcomeRange(stock, years), [stock, years]);
  const money = (v: number) => fmt(Math.round(v / 1000) * 1000, "money", false);
  const lo = r.p10[years], mid = r.p50[years], hi = r.p90[years];
  return (
    <>
      <Chart label={label} spec={{
        type: "line", x: r.x, xLabel: "Years from now", y: "money",
        series: [
          { name: "90th percentile", values: r.p90, tone: "good" },
          { name: "Median", values: r.p50, tone: "accent" },
          { name: "10th percentile", values: r.p10, tone: "bad" },
          { name: `Steady ${(r.rate * 100).toFixed(1)}% after inflation`, values: r.steady, tone: "muted", dash: true },
        ],
      }} />
      <div className="lrn-movers">
        <div className="lrn-mover">
          <label htmlFor={idS}>Share in stocks</label>
          <NativeRange id={idS} min={0} max={100} step={10} value={stock} onChange={(e) => setStock(+e.target.value)} />
          <output htmlFor={idS}>{stock}% stocks</output>
        </div>
        <div className="lrn-mover">
          <label htmlFor={idY}>Years of saving</label>
          <NativeRange id={idY} min={5} max={40} step={1} value={years} onChange={(e) => setYears(+e.target.value)} />
          <output htmlFor={idY}>{years} years</output>
        </div>
      </div>
      <p className="lrn-readout">
        After {years} years at {stock}% stocks, 8 in 10 of the {r.count.toLocaleString("en-US")} past markets ended between <b>{money(lo)}</b> and <b>{money(hi)}</b>, with the median at <b>{money(mid)}</b>.
        {" "}The good case is {(hi / lo).toFixed(1)} times the bad case. The steady line ends at {money(r.steady[years])}, and {r.below} of the {r.count} markets ended below it.
      </p>
    </>
  );
}
