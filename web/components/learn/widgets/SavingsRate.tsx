"use client";

/* Savings rate (the savings-rate lesson): the years from nothing saved to
   financial independence at each savings rate, worked by month as the
   lesson's table is. The rate is a share of take-home pay; what isn't
   saved is spent; the target is 25 times a year's spending (a 4%
   withdrawal rate); the balance grows at the chosen return after
   inflation. */

import { useId, useMemo, useState } from "react";
import { NativeRange } from "@/components/ui/native-range";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { Chart } from "../Chart";

const RETURNS = [0.03, 0.05, 0.07];

/** Years of saving `rate` of take-home pay until the balance is 25 times spending. */
export function yearsToFi(rate: number, real: number, multiple = 25): number {
  const target = (1 - rate) * multiple, m = Math.pow(1 + real, 1 / 12) - 1;
  let b = 0, months = 0;
  while (b < target && months < 1200) { b = b * (1 + m) + rate / 12; months++; }
  return months / 12;
}

export function SavingsRate({ label }: { label: string }) {
  const [pct, setPct] = useState(15);
  const [ri, setRi] = useState(1);
  const id = useId(), real = RETURNS[ri];
  const rates = useMemo(() => Array.from({ length: 86 }, (_, i) => 5 + i), []);
  const years = useMemo(() => rates.map((r) => yearsToFi(r / 100, real)), [rates, real]);
  const mine = yearsToFi(pct / 100, real), more = pct <= 85 ? yearsToFi((pct + 5) / 100, real) : null;
  const yrs = (v: number) => (v >= 99.9 ? "more than 100" : v < 20 ? (Math.round(v * 2) / 2).toString() : Math.round(v).toString());
  return (
    <>
      <div className="lrn-mixes">
        <span className="lrn-cap">Return after inflation</span>
        <Segmented role="group" aria-label="Return after inflation">
          {RETURNS.map((r, i) => <SegmentedItem key={r} pressed={ri === i} onClick={() => setRi(i)}>{Math.round(r * 100)}% per year</SegmentedItem>)}
        </Segmented>
      </div>
      <Chart label={label} spec={{
        type: "line", x: rates.map((r) => r / 100), xFormat: "pct", xLabel: "Share of take-home pay saved", y: "num",
        series: [{ name: "Years to financial independence", values: years, tone: "accent" }],
        marks: [{ x: pct / 100, label: `${pct}%: ${yrs(mine)} years` }],
      }} />
      <div className="lrn-mover">
        <label htmlFor={id}>Savings rate</label>
        <NativeRange id={id} min={5} max={90} step={1} value={pct} onChange={(e) => setPct(+e.target.value)} />
        <output htmlFor={id}>{pct}% of take-home</output>
      </div>
      <p className="lrn-readout">
        Saving {pct}% means living on {100 - pct}%, so the target is {+((100 - pct) / 4).toFixed(2)} years of take-home pay. Starting from nothing, that takes about <b>{yrs(mine)} years</b>.
        {more != null && mine - more >= 0.5 ? <> Saving 5 points more would take <b>{yrs(mine - more)} years</b> off.</> : null}
      </p>
    </>
  );
}
