"use client";

/* Annuities and pensions: $42,000 in year one from $1,000,000 in 60/40,
   raised with inflation, with part of the savings buying an inflation-
   adjusted annuity at an assumed payout rate and the rest withdrawn at the
   rate that makes up the difference. The chart is the share of January
   starts that lasted 30 and 35 years at every annuity share from 0% to 50%
   (ddQuick with the guaranteed-income options, via annuityCurve and
   annuityPlan in history-data.ts); the readout adds the median left. */

import { useId, useMemo, useState } from "react";
import { NativeRange } from "@/components/ui/native-range";
import { Chart, fmt } from "../Chart";
import { ANNUITY_SPEND, annuityCurve, annuityPlan } from "./history-data";

export function AnnuityShare({ label }: { label: string }) {
  const [share, setShare] = useState(25);
  const [quarters, setQuarters] = useState(20);
  const idS = useId(), idP = useId(), payout = quarters / 4;
  const curve = useMemo(() => annuityCurve(payout), [payout]);
  const p = useMemo(() => annuityPlan(share, payout), [share, payout]);
  const money = (v: number) => fmt(v, "money", false);
  const lasted = (r: { successRate: number; n: number }) => `${Math.round(r.successRate * r.n)} of ${r.n}`;
  return (
    <>
      <Chart label={label} spec={{
        type: "line", x: curve.map((c) => c.share), xLabel: "Share used to buy the annuity (%)", y: "pct",
        series: [
          { name: "Lasted 30 years", values: curve.map((c) => c.s30), tone: "accent" },
          { name: "Lasted 35 years", values: curve.map((c) => c.s35), tone: "neutral" },
        ],
        marks: [{ x: share, label: `${share}% bought` }],
      }} />
      <div className="lrn-movers">
        <div className="lrn-mover">
          <label htmlFor={idS}>Share used to buy it</label>
          <NativeRange id={idS} min={0} max={50} step={5} value={share} onChange={(e) => setShare(+e.target.value)} />
          <output htmlFor={idS}>{share}% ({money(share * 10000)})</output>
        </div>
        <div className="lrn-mover">
          <label htmlFor={idP}>Payout rate</label>
          <NativeRange id={idP} min={12} max={32} step={1} value={quarters} onChange={(e) => setQuarters(+e.target.value)} />
          <output htmlFor={idP}>{payout.toFixed(2)}% per year</output>
        </div>
      </div>
      <p className="lrn-readout">
        {share > 0 ? <>The annuity pays <b>{money(p.annuity)}</b> and the investments the other {money(p.withdrawal)} ({p.rate.toFixed(2)}% of {money(1000000 - share * 10000)}). </>
          : <>All {money(ANNUITY_SPEND)} comes from the investments, {p.rate.toFixed(2)}% of $1,000,000. </>}
        The plan lasted 30 years in <b>{lasted(p.y30)}</b> starts ({(p.y30.successRate * 100).toFixed(1)}%) and 35 years in <b>{lasted(p.y35)}</b> ({(p.y35.successRate * 100).toFixed(1)}%).
        {" "}The typical amount left after 30 years was <b>{money(Math.round(p.y30.medianEnd / 1000) * 1000)}</b>, not counting the annuity, which keeps paying.
      </p>
    </>
  );
}
