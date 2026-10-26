"use client";

/* Fees: the same savings and return, less a yearly fee, over 30 years,
   against a low-cost index fund. */

import { useId, useState } from "react";
import { NativeRange } from "@/components/ui/native-range";
import { Chart, fmt } from "../Chart";

export const FEES = { start: 100000, monthly: 500, ret: 0.07, years: 30, cheap: 0.0005 };

/** The balance at each year: the year's saving goes in, then the return less the fee. */
export function feePath(fee: number, f = FEES): number[] {
  const out = [f.start];
  let b = f.start;
  for (let y = 1; y <= f.years; y++) { b = (b + f.monthly * 12) * (1 + f.ret - fee); out.push(b); }
  return out;
}

export function Fees({ label }: { label: string }) {
  const [bp, setBp] = useState(100);
  const id = useId(), fee = bp / 10000;
  const years = Array.from({ length: FEES.years + 1 }, (_, i) => i);
  const cheap = feePath(FEES.cheap), mine = feePath(fee);
  const gap = cheap[FEES.years] - mine[FEES.years];
  return (
    <>
      <Chart label={label} spec={{
        type: "line", x: years, xLabel: "Years invested", y: "money",
        series: [
          { name: "Index fund at 0.05%", values: cheap, tone: "good" },
          { name: `Paying ${(fee * 100).toFixed(2)}% per year`, values: mine, tone: "bad" },
        ],
      }} />
      <div className="lrn-mover">
        <label htmlFor={id}>Yearly fee</label>
        <NativeRange id={id} min={5} max={200} step={5} value={bp} onChange={(e) => setBp(+e.target.value)} />
        <output htmlFor={id}>{(fee * 100).toFixed(2)}%</output>
      </div>
      <p className="lrn-readout">
        After {FEES.years} years: <b>{fmt(mine[FEES.years], "money", false)}</b> against {fmt(cheap[FEES.years], "money", false)} in the index fund.
        The fee costs <b>{fmt(Math.max(0, gap), "money", false)}</b>.
      </p>
    </>
  );
}
