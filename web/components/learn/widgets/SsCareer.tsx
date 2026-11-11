"use client";

/* Years worked (the social-security-benefit lesson): level pay in today's
   dollars for a career of 10 to 45 years, and the benefit at full
   retirement age it earns. ssPiaFromEarnings takes the best 35 years, with
   zeros for missing ones, averages them by the month (AIME) and runs the
   result through the bend points; each bar splits that benefit into the
   90%, 32% and 15% parts, with the newest year's bend points (yearData). */

import { useId, useMemo, useState } from "react";
import { NativeRange } from "@/components/ui/native-range";
import { ssPiaFromEarnings, yearData } from "@/lib/engine/typed";
import { Chart, fmt } from "../Chart";

export interface CareerBenefit { years: number; aime: number; pia: number; p90: number; p32: number; p15: number }

/** The benefit at full retirement age for `years` at level `pay`, and its three parts. */
export function careerBenefit(pay: number, years: number): CareerBenefit {
  const { aime, pia } = ssPiaFromEarnings(Array(years).fill(pay));
  const { bend1, bend2 } = yearData().ss;
  const p90 = 0.9 * Math.min(aime, bend1);
  const p32 = 0.32 * Math.max(0, Math.min(aime, bend2) - bend1);
  const p15 = 0.15 * Math.max(0, aime - bend2);
  return { years, aime, pia, p90, p32, p15 };
}

const YEARS = Array.from({ length: 36 }, (_, i) => 10 + i);

export function SsCareer({ label }: { label: string }) {
  const [pay, setPay] = useState(75000);
  const [years, setYears] = useState(35);
  const idP = useId(), idY = useId();
  const all = useMemo(() => YEARS.map((y) => careerBenefit(pay, y)), [pay]);
  const me = all[years - 10], full = all[35 - 10], next = years < 45 ? all[years - 9] : null;
  const money = (v: number) => fmt(v, "money", false);
  return (
    <>
      <Chart label={label} spec={{
        type: "bar", stack: true, x: YEARS.map(String), xLabel: "Years worked", y: "money",
        series: [
          { name: "From the 90% part", values: all.map((b) => b.p90), tone: "good" },
          { name: "From the 32% part", values: all.map((b) => b.p32), tone: "accent" },
          { name: "From the 15% part", values: all.map((b) => b.p15), tone: "muted" },
        ],
        marks: [{ x: String(years), label: `${years} years: ${money(me.pia)}` }],
      }} />
      <div className="lrn-movers">
        <div className="lrn-mover">
          <label htmlFor={idP}>Pay per year</label>
          <NativeRange id={idP} min={10000} max={200000} step={1000} value={pay} onChange={(e) => setPay(+e.target.value)} />
          <output htmlFor={idP}>{money(pay)}</output>
        </div>
        <div className="lrn-mover">
          <label htmlFor={idY}>Years worked</label>
          <NativeRange id={idY} min={10} max={45} step={1} value={years} onChange={(e) => setYears(+e.target.value)} />
          <output htmlFor={idY}>{years}</output>
        </div>
      </div>
      <p className="lrn-readout">
        {years} years at {money(pay)} give average indexed monthly earnings of <b>{money(me.aime)}</b> and a benefit of <b>{money(me.pia)} per month</b> at full retirement age: {money(me.p90)} from the 90% part, {money(me.p32)} from the 32% part and {money(me.p15)} from the 15% part.
        {pay > yearData().fica.ssCap ? <> Pay above the {money(yearData().fica.ssCap)} wage base for 2026 doesn&apos;t count.</> : null}
        {years < 35 && next
          ? <> That is {Math.round((me.pia / full.pia) * 100)}% of the full 35-year benefit. One more year would replace a zero and add <b>{money(next.pia - me.pia)} per month</b>.</>
          : <> Years past 35 at the same pay add nothing, because only the best 35 count.</>}
      </p>
    </>
  );
}
