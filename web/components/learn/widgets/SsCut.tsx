"use client";

/* A benefit cut (the social-security-future lesson): a monthly benefit in
   today's dollars paid at a share of the scheduled amount. Gap per year =
   benefit × 12 × (1 − share); the savings that would cover it for life at
   a 4% withdrawal rate = gap ÷ 0.04, 25 times the gap. */

import { useId, useState } from "react";
import { NativeRange } from "@/components/ui/native-range";
import { Chart, fmt } from "../Chart";

export const CUT = { benefit: 2400, share: 78, rate: 0.04 };

/** The yearly shortfall when `benefit` per month is paid at `share`, and the savings that cover it at `rate`. */
export function cutGap(benefit: number, share: number, rate = CUT.rate): { paid: number; gap: number; savings: number } {
  const gap = benefit * 12 * (1 - share);
  return { paid: benefit * share, gap, savings: gap / rate };
}

const SHARES = Array.from({ length: 41 }, (_, i) => 60 + i);

export function SsCut({ label }: { label: string }) {
  const [share, setShare] = useState(CUT.share);
  const [benefit, setBenefit] = useState(CUT.benefit);
  const idS = useId(), idB = useId();
  const me = cutGap(benefit, share / 100);
  const money = (v: number) => fmt(v, "money", false);
  return (
    <>
      <Chart label={label} spec={{
        type: "line", x: SHARES.map((s) => s / 100), xFormat: "pct", xLabel: "Share of benefits paid", y: "money",
        series: [{ name: "Extra savings needed at 4%", values: SHARES.map((s) => cutGap(benefit, s / 100).savings), tone: "bad" }],
        marks: [{ x: share / 100, label: `${share}%: ${fmt(me.savings, "money")}` }],
      }} />
      <div className="lrn-movers">
        <div className="lrn-mover">
          <label htmlFor={idS}>Share paid</label>
          <NativeRange id={idS} min={60} max={100} step={1} value={share} onChange={(e) => setShare(+e.target.value)} />
          <output htmlFor={idS}>{share}%</output>
        </div>
        <div className="lrn-mover">
          <label htmlFor={idB}>Benefit per month</label>
          <NativeRange id={idB} min={500} max={5000} step={50} value={benefit} onChange={(e) => setBenefit(+e.target.value)} />
          <output htmlFor={idB}>{money(benefit)}</output>
        </div>
      </div>
      <p className="lrn-readout">
        {share === 100
          ? <>Paid in full, a {money(benefit)} check leaves no gap for savings to fill.</>
          : <>Paid at {share}%, a {money(benefit)} check becomes {money(me.paid)} per month, <b>{money(me.gap)} less per year</b>. Drawing that from savings at a 4% withdrawal rate takes about <b>{money(me.savings)} more saved</b>, 25 times the gap.</>}
      </p>
    </>
  );
}
