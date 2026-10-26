"use client";

/* Compound growth: the same saving per month, started at different ages,
   and what each has at 65. Growth is after inflation, so every figure is
   in today's dollars. */

import { useId, useState } from "react";
import { NativeRange } from "@/components/ui/native-range";
import { Chart, fmt } from "../Chart";

export const COMPOUND = { monthly: 500, real: 0.05, end: 65, early: 25 };

/** The balance at each age, saving `monthly` from `start` until `end`. */
export function grow(start: number, monthly = COMPOUND.monthly, real = COMPOUND.real, from = 22, end = COMPOUND.end): (number | null)[] {
  const out: (number | null)[] = [];
  let b = 0;
  for (let age = from; age <= end; age++) {
    out.push(age < start ? null : b);
    if (age >= start) b = (b + monthly * 12) * (1 + real);
  }
  return out;
}

export function Compound({ label }: { label: string }) {
  const [start, setStart] = useState(35);
  const id = useId();
  const ages = Array.from({ length: COMPOUND.end - 22 + 1 }, (_, i) => 22 + i);
  const mine = grow(start), early = grow(COMPOUND.early);
  const atEnd = mine[mine.length - 1] ?? 0, put = COMPOUND.monthly * 12 * (COMPOUND.end - start);
  return (
    <>
      <Chart label={label} spec={{
        type: "line", x: ages, xLabel: "Age", y: "money",
        series: [
          { name: `Starting at ${start}`, values: mine, tone: "accent" },
          ...(start !== COMPOUND.early ? [{ name: `Starting at ${COMPOUND.early}`, values: early, tone: "muted" as const, dash: true }] : []),
        ],
      }} />
      <div className="lrn-mover">
        <label htmlFor={id}>Start saving at age</label>
        <NativeRange id={id} min={22} max={55} value={start} onChange={(e) => setStart(+e.target.value)} />
        <output htmlFor={id}>{start}</output>
      </div>
      <p className="lrn-readout">
        Saving {fmt(COMPOUND.monthly, "money", false)} per month from {start} to {COMPOUND.end}: <b>{fmt(atEnd, "money", false)}</b> at {COMPOUND.end},
        of which {fmt(put, "money", false)} is money put in and <b>{fmt(Math.max(0, atEnd - put), "money", false)}</b> is growth.
      </p>
    </>
  );
}
