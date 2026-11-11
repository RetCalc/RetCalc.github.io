"use client";

/* The savings target (the spending-target lesson): spending per year after
   tax and Social Security per year, for the lesson's couple: married filing
   jointly, both 65 or older, no state income tax, all savings in
   traditional accounts. The withdrawal is solved so that withdrawal +
   Social Security − federal tax = spending, the tax from computeRetireTax
   (lib/engine/math.js) with the newest year's rules; the target is the
   withdrawal, rounded to the dollar, ÷ the withdrawal rate (25 times at
   4%). The line shows the target at each level of spending. */

import { useId, useMemo, useState } from "react";
import { NativeRange } from "@/components/ui/native-range";
import { NEWEST_YEAR, retireTax } from "@/lib/engine/typed";
import { Chart, fmt } from "../Chart";

/** Federal tax for the couple on a traditional withdrawal `w` with Social Security `ss`. */
function fedTax(w: number, ss: number): number {
  const t = retireTax({
    year: NEWEST_YEAR, status: "m", seniors: 2, trad: w, roth: 0, brok: 0, ss, pension: 0, other: 0,
    gainPct: 0, pre: 0, dedType: "std", item: 0, state: "TX",
  });
  return t.federal as number;
}

/** The gap savings must fill, the tax on the withdrawal, the withdrawal and the target. */
export function spendingTarget(spend: number, ss: number, rate = 0.04): { gap: number; tax: number; withdrawal: number; target: number } {
  const gap = Math.max(0, spend - ss);
  let w = gap;
  // Each pass adds the tax on the last guess; it settles within a few dozen.
  for (let i = 0; i < 60 && gap > 0; i++) {
    const next = gap + fedTax(w, ss);
    if (Math.abs(next - w) < 0.01) { w = next; break; }
    w = next;
  }
  const withdrawal = Math.round(w);
  return { gap, tax: withdrawal - Math.round(gap), withdrawal, target: withdrawal / rate };
}

const LEVELS = Array.from({ length: 31 }, (_, i) => 30000 + i * 5000);

export function Target({ label }: { label: string }) {
  const [spend, setSpend] = useState(72000);
  const [ss, setSs] = useState(56300);
  const [tenths, setTenths] = useState(40);
  const idS = useId(), idI = useId(), idR = useId(), rate = tenths / 1000;
  const me = spendingTarget(spend, ss, rate);
  const line = useMemo(() => LEVELS.map((v) => spendingTarget(v, ss, rate)), [ss, rate]);
  const money = (v: number) => fmt(v, "money", false);
  const multiple = +(1 / rate).toFixed(1);
  return (
    <>
      <Chart label={label} spec={{
        type: "line", x: LEVELS, xFormat: "money", xLabel: "Spending per year", y: "money",
        series: [
          { name: "Target with the tax", values: line.map((t) => t.target), tone: "accent" },
          { name: "Target for the gap alone", values: line.map((t) => t.gap / rate), tone: "muted", dash: true },
        ],
        marks: [{ x: spend, label: `${fmt(spend, "money")}: ${fmt(me.target, "money")}` }],
      }} />
      <div className="lrn-movers">
        <div className="lrn-mover">
          <label htmlFor={idS}>Spending per year</label>
          <NativeRange id={idS} min={30000} max={180000} step={1000} value={spend} onChange={(e) => setSpend(+e.target.value)} />
          <output htmlFor={idS}>{money(spend)}</output>
        </div>
        <div className="lrn-mover">
          <label htmlFor={idI}>Social Security per year</label>
          <NativeRange id={idI} min={0} max={100000} step={100} value={ss} onChange={(e) => setSs(+e.target.value)} />
          <output htmlFor={idI}>{money(ss)}</output>
        </div>
        <div className="lrn-mover">
          <label htmlFor={idR}>Withdrawal rate</label>
          <NativeRange id={idR} min={30} max={50} step={1} value={tenths} onChange={(e) => setTenths(+e.target.value)} />
          <output htmlFor={idR}>{(rate * 100).toFixed(1)}%</output>
        </div>
      </div>
      <p className="lrn-readout">
        {me.gap <= 0
          ? <>Social Security covers all {money(spend)} of spending, so savings have nothing to fill.</>
          : <>Savings must cover a gap of <b>{money(me.gap)}</b> per year. {me.tax > 0 ? <>Federal tax for {NEWEST_YEAR} adds <b>{money(me.tax)}</b>, so the withdrawal is {money(me.withdrawal)}.</> : <>At that withdrawal the couple owes no federal income tax for {NEWEST_YEAR}.</>} At {(rate * 100).toFixed(1)}%, {multiple} times the withdrawal, the target is <b>{money(me.target)}</b>.</>}
      </p>
    </>
  );
}
