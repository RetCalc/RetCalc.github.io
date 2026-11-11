"use client";

/* Traditional or Roth (the traditional-or-roth lesson): $10,000 of pay put
   toward retirement and left for 30 years at 5% per year after inflation,
   as the lesson's example. Traditional: all $10,000 goes in and the
   withdrawal is taxed at the later rate. Roth: tax at today's rate comes
   out first and the rest is never taxed again. The two match when the
   rates match. */

import { useId, useState } from "react";
import { NativeRange } from "@/components/ui/native-range";
import { Chart, fmt } from "../Chart";

export const RVT = { pay: 10000, years: 30, real: 0.05 };
const GROWTH = Math.pow(1 + RVT.real, RVT.years);
export const tradAfterTax = (later: number) => RVT.pay * GROWTH * (1 - later);
export const rothAfterTax = (now: number) => RVT.pay * (1 - now) * GROWTH;

export function RothOrTraditional({ label }: { label: string }) {
  const [now, setNow] = useState(22);
  const [later, setLater] = useState(12);
  const idN = useId(), idL = useId();
  const t = tradAfterTax(later / 100), r = rothAfterTax(now / 100), gap = Math.abs(t - r);
  return (
    <>
      <Chart label={label} spec={{
        type: "bar", labels: true, x: ["Traditional", "Roth"], y: "money",
        series: [{ name: "Spendable after tax, in 30 years", values: [t, r], tone: "accent" }],
      }} />
      <div className="lrn-movers">
        <div className="lrn-mover">
          <label htmlFor={idN}>Tax rate now</label>
          <NativeRange id={idN} min={0} max={45} step={1} value={now} onChange={(e) => setNow(+e.target.value)} />
          <output htmlFor={idN}>{now}%</output>
        </div>
        <div className="lrn-mover">
          <label htmlFor={idL}>Tax rate in retirement</label>
          <NativeRange id={idL} min={0} max={45} step={1} value={later} onChange={(e) => setLater(+e.target.value)} />
          <output htmlFor={idL}>{later}%</output>
        </div>
      </div>
      <p className="lrn-readout">
        From {fmt(RVT.pay, "money", false)} of pay: traditional leaves <b>{fmt(Math.round(t), "money", false)}</b> to spend, Roth <b>{fmt(Math.round(r), "money", false)}</b>.{" "}
        {gap < 1 ? <>With the same rate at both ends they come out <b>exactly even</b>.</>
          : t > r ? <>Traditional wins by <b>{fmt(Math.round(gap), "money", false)}</b>, because the rate later is lower than the rate now.</>
          : <>Roth wins by <b>{fmt(Math.round(gap), "money", false)}</b>, because the rate later is higher than the rate now.</>}
      </p>
    </>
  );
}
