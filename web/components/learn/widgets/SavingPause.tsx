"use client";

/* A pause in saving (the children-and-the-plan lesson): a couple saving
   $1,500 per month from 32 to 65, and the same couple cutting that saving
   for a stretch of years starting at a chosen age. Worked as the lesson's
   table is: a deposit at the end of each month, monthly growth
   1.045^(1/12) (4.5% per year after inflation), in today's dollars. */

import { useId, useMemo, useState } from "react";
import { NativeRange } from "@/components/ui/native-range";
import { Chart, fmt } from "../Chart";

export const PAUSE = { monthly: 1500, from: 32, to: 65, real: 0.045 };

/** The balance at the end of each year of age, saving throughout and with saving cut to `kept` per month for `years` from `start`. */
export function pausePath(start: number, years: number, kept: number) {
  const { monthly, from, to, real } = PAUSE, m = Math.pow(1 + real, 1 / 12) - 1;
  const ages = [from], full = [0], mine = [0];
  let a = 0, b = 0;
  for (let age = from; age < to; age++) {
    const cut = age >= start && age < start + years;
    for (let k = 0; k < 12; k++) { a = a * (1 + m) + monthly; b = b * (1 + m) + (cut ? kept : monthly); }
    ages.push(age + 1); full.push(a); mine.push(b);
  }
  return { ages, full, mine };
}

export function SavingPause({ label }: { label: string }) {
  const [start, setStart] = useState(32);
  const [years, setYears] = useState(6);
  const [kept, setKept] = useState(0);
  const idS = useId(), idY = useId(), idK = useId();
  const yrs = Math.min(years, PAUSE.to - start);
  const p = useMemo(() => pausePath(start, yrs, kept), [start, yrs, kept]);
  const money = (v: number) => fmt(Math.round(v / 1000) * 1000, "money", false);
  const end = p.mine[p.mine.length - 1], full = p.full[p.full.length - 1], gap = full - end;
  const missed = (PAUSE.monthly - kept) * 12 * yrs;
  return (
    <>
      <Chart label={label} spec={{
        type: "line", x: p.ages, xLabel: "Age", y: "money",
        series: [
          { name: `${fmt(PAUSE.monthly, "money", false)} per month throughout`, values: p.full, tone: "good" },
          { name: kept > 0 ? `${fmt(kept, "money", false)} per month for ${yrs} years` : `Nothing for ${yrs} years`, values: p.mine, tone: "bad" },
        ],
        band: { from: start, to: start + yrs, label: "Saving cut" },
      }} />
      <div className="lrn-movers">
        <div className="lrn-mover">
          <label htmlFor={idS}>Cut starts at</label>
          <NativeRange id={idS} min={32} max={60} step={1} value={start} onChange={(e) => setStart(+e.target.value)} />
          <output htmlFor={idS}>age {start}</output>
        </div>
        <div className="lrn-mover">
          <label htmlFor={idY}>For</label>
          <NativeRange id={idY} min={1} max={12} step={1} value={years} onChange={(e) => setYears(+e.target.value)} />
          <output htmlFor={idY}>{yrs} {yrs === 1 ? "year" : "years"}</output>
        </div>
        <div className="lrn-mover">
          <label htmlFor={idK}>Still saving</label>
          <NativeRange id={idK} min={0} max={1500} step={50} value={kept} onChange={(e) => setKept(+e.target.value)} />
          <output htmlFor={idK}>{fmt(kept, "money", false)} per month</output>
        </div>
      </div>
      <p className="lrn-readout">
        Saving {fmt(PAUSE.monthly, "money", false)} per month throughout reaches <b>{money(full)}</b> at 65. With the cut it reaches <b>{money(end)}</b>,
        {gap >= 500 ? <> which is <b>{money(gap)}</b> less, from {fmt(missed, "money", false)} not put in.</> : <> the same.</>}
      </p>
    </>
  );
}
