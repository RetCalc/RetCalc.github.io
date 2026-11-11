"use client";

/* Inflation (the todays-dollars lesson): what $100,000 still buys after
   each year at a chosen steady inflation rate, beside 3% for comparison.
   Buying power = amount ÷ (1 + inflation)^years. */

import { useId, useState } from "react";
import { NativeRange } from "@/components/ui/native-range";
import { Chart, fmt } from "../Chart";

export const INFL = { amount: 100000, years: 40, compare: 0.03 };
export const buys = (rate: number, years: number, amount = INFL.amount) => amount / Math.pow(1 + rate, years);

export function Inflation({ label }: { label: string }) {
  const [bp, setBp] = useState(300);
  const id = useId(), rate = bp / 10000;
  const years = Array.from({ length: INFL.years + 1 }, (_, i) => i);
  const at = (y: number) => fmt(Math.round(buys(rate, y) / 100) * 100, "money", false);
  const half = rate > 0 ? Math.log(2) / Math.log(1 + rate) : null;
  return (
    <>
      <Chart label={label} spec={{
        type: "line", x: years, xLabel: "Years from now", y: "money",
        series: [
          { name: `At ${+(rate * 100).toFixed(2)}% inflation`, values: years.map((y) => buys(rate, y)), tone: "accent" },
          ...(bp !== INFL.compare * 10000 ? [{ name: "At 3%", values: years.map((y) => buys(INFL.compare, y)), tone: "muted" as const, dash: true }] : []),
        ],
      }} />
      <div className="lrn-mover">
        <label htmlFor={id}>Inflation per year</label>
        <NativeRange id={id} min={0} max={1000} step={25} value={bp} onChange={(e) => setBp(+e.target.value)} />
        <output htmlFor={id}>{(rate * 100).toFixed(2)}%</output>
      </div>
      <p className="lrn-readout">
        What {fmt(INFL.amount, "money", false)} buys, in today&rsquo;s prices: <b>{at(10)}</b> after 10 years, <b>{at(20)}</b> after 20, <b>{at(30)}</b> after 30.
        {half ? <> At this rate prices double, and a fixed income loses half its buying power, in about <b>{half < 10 ? half.toFixed(1) : Math.round(half)} years</b>.</> : <> With no inflation it buys the same forever.</>}
      </p>
    </>
  );
}
