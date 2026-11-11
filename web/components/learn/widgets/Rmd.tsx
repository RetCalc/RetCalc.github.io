"use client";

/* Required minimum distributions (the rmds lesson): a balance at the start
   of the first required year and a steady growth rate, and the withdrawal
   the IRS table requires each year to 100 when only the minimum is taken.
   Each year: RMD = balance on 1 January ÷ the Uniform Lifetime Table's
   divisor for the age reached that year (ultDivisor); the rest grows. */

import { useId, useState } from "react";
import { NativeRange } from "@/components/ui/native-range";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { ultDivisor } from "@/lib/engine";
import { Chart, fmt } from "../Chart";

/** The required withdrawal and the balance it's taken from, each year from `start` to 100. */
export function rmdPath(balance: number, growth: number, start: number): { age: number; balance: number; rmd: number }[] {
  const out = [];
  let b = balance;
  for (let age = start; age <= 100; age++) {
    const rmd = b / (ultDivisor(age) as number);
    out.push({ age, balance: b, rmd });
    b = (b - rmd) * (1 + growth);
  }
  return out;
}

export function Rmd({ label }: { label: string }) {
  const [balance, setBalance] = useState(1000000);
  const [g, setG] = useState(50);
  const [start, setStart] = useState(75);
  const idB = useId(), idG = useId(), growth = g / 1000;
  const path = rmdPath(balance, growth, start);
  const first = path[0], peak = path.reduce((a, b) => (b.rmd > a.rmd ? b : a)), at90 = path.find((p) => p.age === 90)!;
  const money = (v: number) => fmt(Math.round(v / 100) * 100, "money", false);
  return (
    <>
      <div className="lrn-mixes">
        <span className="lrn-cap">First required at age</span>
        <Segmented role="group" aria-label="Age the first required withdrawal is due">
          <SegmentedItem pressed={start === 73} onClick={() => setStart(73)}>73</SegmentedItem>
          <SegmentedItem pressed={start === 75} onClick={() => setStart(75)}>75</SegmentedItem>
        </Segmented>
      </div>
      <Chart label={label} spec={{
        type: "bar", x: path.map((p) => p.age), xLabel: "Age", y: "money",
        series: [{ name: "Required withdrawal", values: path.map((p) => p.rmd), tone: "accent" }],
      }} />
      <div className="lrn-movers">
        <div className="lrn-mover">
          <label htmlFor={idB}>Balance at {start}</label>
          <NativeRange id={idB} min={100000} max={3000000} step={25000} value={balance} onChange={(e) => setBalance(+e.target.value)} />
          <output htmlFor={idB}>{fmt(balance, "money", false)}</output>
        </div>
        <div className="lrn-mover">
          <label htmlFor={idG}>Growth per year</label>
          <NativeRange id={idG} min={0} max={100} step={5} value={g} onChange={(e) => setG(+e.target.value)} />
          <output htmlFor={idG}>{(growth * 100).toFixed(1)}%</output>
        </div>
      </div>
      <p className="lrn-readout">
        The first required withdrawal is <b>{money(first.rmd)}</b>, {((first.rmd / first.balance) * 100).toFixed(2)}% of the balance. At 90 it is <b>{money(at90.rmd)}</b>, {((at90.rmd / at90.balance) * 100).toFixed(2)}% of what is left.
        Taking only the minimum, the largest withdrawal comes at <b>{peak.age}</b>: {money(peak.rmd)}.
        {" "}{start === 73 ? "Withdrawals start at 73 for people born from 1951 to 1959." : "Withdrawals start at 75 for people born in 1960 or later."}
      </p>
    </>
  );
}
