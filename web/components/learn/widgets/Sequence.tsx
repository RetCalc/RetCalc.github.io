"use client";

/* Sequence-of-returns risk: one retirement three ways, the same thirty
   years of returns in different orders, and a slider that moves the five
   weak years later to show how much less they hurt there. */

import { useId, useState } from "react";
import { NativeRange } from "@/components/ui/native-range";
import { Chart } from "../Chart";
import { SEQ_AVG, SEQ_RETURNS, runSeq, shifted } from "./sequence-data";

export function Sequence({ label }: { label: string }) {
  const [shift, setShift] = useState(0);
  const id = useId();
  const bad = runSeq(shifted(shift)), good = runSeq([...SEQ_RETURNS].reverse()), even = runSeq(SEQ_RETURNS.map(() => SEQ_AVG));
  const out = bad.findIndex((b) => b <= 0);
  const x = bad.map((_, i) => i);
  return (
    <>
      <Chart label={label} spec={{
        type: "line", x, xLabel: "Years into retirement", y: "money",
        series: [
          { name: shift ? `Weak years starting in year ${shift + 1}` : "Bad years first", values: bad.map((v, i) => (out > 0 && i > out ? null : v)), tone: "bad" },
          { name: "Good years first", values: good, tone: "good" },
          { name: "Average every year", values: even, tone: "muted", dash: true },
        ],
        band: { from: shift, to: shift + 5, label: "The weak stretch" },
        marks: out > 0 ? [{ x: out, label: `Runs out, year ${out}` }] : [],
      }} />
      <div className="lrn-mover">
        <label htmlFor={id}>Move the weak years later</label>
        <NativeRange id={id} min={0} max={20} value={shift} onChange={(e) => setShift(+e.target.value)} />
        <output htmlFor={id}>{out > 0 ? `Runs out in year ${out}` : `$${(bad[30] / 1e6).toFixed(2)}M left`}</output>
      </div>
    </>
  );
}
