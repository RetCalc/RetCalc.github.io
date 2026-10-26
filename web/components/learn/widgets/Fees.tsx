"use client";

/* Fees (the fees-and-index-funds lesson): a saver's balance over 30 years
   with no fee and with the chosen yearly fee, in today's dollars. $10,000
   to start, $500 added at the end of each month, 5% per year after
   inflation before fees; the fee comes off the yearly return. */

import { useId, useState } from "react";
import { NativeRange } from "@/components/ui/native-range";
import { Chart, fmt } from "../Chart";

export const FEES = { start: 10000, monthly: 500, real: 0.05, years: 30 };

/** The balance at the end of each year, with `fee` taken from the yearly return. */
export function feePath(fee: number): number[] {
  const m = Math.pow(1 + FEES.real - fee, 1 / 12) - 1, out = [FEES.start];
  let b = FEES.start;
  for (let y = 1; y <= FEES.years; y++) {
    for (let k = 0; k < 12; k++) b = b * (1 + m) + FEES.monthly;
    out.push(b);
  }
  return out;
}

export function Fees({ label }: { label: string }) {
  const [bp, setBp] = useState(100);
  const id = useId(), fee = bp / 10000;
  const years = Array.from({ length: FEES.years + 1 }, (_, i) => i);
  const none = feePath(0), mine = feePath(fee);
  const end = mine[FEES.years], gap = none[FEES.years] - end;
  return (
    <>
      <Chart label={label} spec={{
        type: "line", x: years, xLabel: "Years invested", y: "money",
        series: [
          { name: "No fee", values: none, tone: "good" },
          { name: `A ${(fee * 100).toFixed(2)}% fee`, values: mine, tone: "bad" },
        ],
      }} />
      <div className="lrn-mover">
        <label htmlFor={id}>Yearly fee</label>
        <NativeRange id={id} min={0} max={200} step={5} value={bp} onChange={(e) => setBp(+e.target.value)} />
        <output htmlFor={id}>{(fee * 100).toFixed(2)}%</output>
      </div>
      <p className="lrn-readout">
        After {FEES.years} years, with {fmt(FEES.start + FEES.monthly * 12 * FEES.years, "money", false)} put in: <b>{fmt(end, "money", false)}</b>
        {gap > 0.5 ? <>, which is <b>{fmt(gap, "money", false)}</b> ({(gap / none[FEES.years] * 100).toFixed(1)}%) less than with no fee.</> : <>, the same as with no fee.</>}
      </p>
    </>
  );
}
