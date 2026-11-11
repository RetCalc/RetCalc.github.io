"use client";

/* Gains stacking (the capital-gains lesson): ordinary income, a long-term
   gain and a filing status, and how much of the gain lands at 0%, 15% and
   20% once it sits on top of the ordinary income, for the newest tax year.
   computeRetireTax with the ordinary income as IRA withdrawals and the gain
   as a brokerage sale that is all gain; everyone 60, standard deduction, no
   state tax. Tax on the gain = federal tax with the gain less without it
   (it includes the 3.8% surtax where that applies). The next $1,000 is the
   same return with $1,000 more ordinary income. */

import { useId, useState } from "react";
import { NativeRange } from "@/components/ui/native-range";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { computeRetireTax } from "@/lib/engine";
import { Chart, fmt } from "../Chart";

type Status = "s" | "m";
interface Band { rate: number; amount: number; tax: number }
interface Rt { federal: number; fedOrdinary: number; niit: number; gainTaxable: number; ltcgBands: Band[]; ltcgCut: number[]; zeroRoom: number; ordTaxable: number }

function ret(ordinary: number, gain: number, status: Status): Rt {
  return computeRetireTax({
    status, ages: status === "m" ? [60, 60] : [60], trad: ordinary, brok: gain, gainPct: 1, ss: 0, roth: 0, pension: 0, penPublic: false, other: 0,
    state: "TX", pre: 0, dedType: "std", item: 0, _noMarginal: true,
  }) as Rt;
}

/** Where a long-term gain lands on top of `ordinary` income, the tax on it, and the cost of $1,000 more ordinary income. */
export function gainsPicture(ordinary: number, gain: number, status: Status) {
  const none = ret(ordinary, 0, status), r = ret(ordinary, gain, status), more = ret(ordinary + 1000, gain, status);
  // Gain the deduction covers (ordinary income too small to use it all up) pays nothing either.
  const covered = gain - r.gainTaxable;
  const bands = r.ltcgBands.map((b, i) => ({ rate: b.rate, amount: b.amount + (i === 0 ? covered : 0), tax: b.tax }));
  const next = more.federal - r.federal, nextOrd = more.fedOrdinary - r.fedOrdinary;
  return {
    bands, gainTax: r.federal - none.federal, niit: r.niit, zeroLine: r.ltcgCut[0], room: r.zeroRoom, ordTaxable: r.ordTaxable,
    next, nextOrd, nextGain: next - nextOrd,
  };
}

export function GainsStack({ label }: { label: string }) {
  const [ordinary, setOrdinary] = useState(100000);
  const [gain, setGain] = useState(50000);
  const [status, setStatus] = useState<Status>("m");
  const idO = useId(), idG = useId();
  const p = gainsPicture(ordinary, gain, status);
  const money = (v: number) => fmt(Math.round(v), "money", false);
  const [g0, g15, g20] = p.bands;
  return (
    <>
      <div className="lrn-mixes">
        <span className="lrn-cap">Filing as</span>
        <Segmented role="group" aria-label="Filing status">
          <SegmentedItem pressed={status === "s"} onClick={() => setStatus("s")}>Single</SegmentedItem>
          <SegmentedItem pressed={status === "m"} onClick={() => setStatus("m")}>Married</SegmentedItem>
        </Segmented>
      </div>
      <Chart label={label} spec={{
        type: "bar", labels: true, x: p.bands.map((b) => `${Math.round(b.rate * 100)}%`), xLabel: "Rate on the gain", y: "money",
        series: [
          { name: "Gain taxed at this rate", values: p.bands.map((b) => b.amount), tone: "neutral" },
          { name: "Tax on it", values: p.bands.map((b) => b.tax), tone: "bad" },
        ],
      }} />
      <div className="lrn-movers">
        <div className="lrn-mover">
          <label htmlFor={idO}>Ordinary income per year</label>
          <NativeRange id={idO} min={0} max={400000} step={2500} value={ordinary} onChange={(e) => setOrdinary(+e.target.value)} />
          <output htmlFor={idO}>{money(ordinary)}</output>
        </div>
        <div className="lrn-mover">
          <label htmlFor={idG}>Long-term gain</label>
          <NativeRange id={idG} min={0} max={750000} step={5000} value={gain} onChange={(e) => setGain(+e.target.value)} />
          <output htmlFor={idG}>{money(gain)}</output>
        </div>
      </div>
      <p className="lrn-readout">
        After the standard deduction, ordinary income fills {money(p.ordTaxable)} of taxable income and the gain sits on top.
        {" "}<b>{money(g0.amount)}</b> of the gain is taxed at 0%, <b>{money(g15.amount)}</b> at 15%{g20.amount > 0 ? <> and <b>{money(g20.amount)}</b> at 20%</> : null}.
        {" "}The tax on the gain is <b>{money(p.gainTax)}</b>{gain > 0 ? <>, {+((p.gainTax / gain) * 100).toFixed(1)}% of it</> : null}{p.niit > 0 ? <>, including {money(p.niit)} of the 3.8% surtax</> : null}.
        {" "}Another $1,000 of ordinary income would cost <b>{money(p.next)}</b>
        {p.nextGain >= 1 ? <>: {money(p.nextOrd)} on the income itself and {money(p.nextGain)} on gain it pushes into a higher rate.</> : <>.</>}
        {p.room > 0 && gain > 0 ? <> There&apos;s room for {money(p.room)} more gain at 0%.</> : null}
      </p>
    </>
  );
}
