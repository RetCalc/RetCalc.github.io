"use client";

/* A percentage fee against a flat fee (the working-with-an-advisor
   lesson): a portfolio left to grow for 30 years at 5% per year after
   inflation before costs, with nothing added or taken out, paying either a
   yearly percentage of the balance (taken from the return, as feePath in
   Fees.tsx does) or a flat fee per year in today's dollars, taken in equal
   monthly parts. Monthly growth (1 + return)^(1/12). */

import { useId, useMemo, useState } from "react";
import { NativeRange } from "@/components/ui/native-range";
import { Chart, fmt } from "../Chart";

export const ADVICE = { real: 0.05, years: 30 };

/** The balance at the end of each year under a percentage fee and under a flat fee. */
export function advisorPath(size: number, pct: number, flat: number) {
  const mp = Math.pow(1 + ADVICE.real - pct, 1 / 12) - 1, mf = Math.pow(1 + ADVICE.real, 1 / 12) - 1;
  const byPct = [size], byFlat = [size];
  let x = size, y = size;
  for (let t = 1; t <= ADVICE.years; t++) {
    for (let k = 0; k < 12; k++) { x *= 1 + mp; y = Math.max(0, y * (1 + mf) - flat / 12); }
    byPct.push(x); byFlat.push(y);
  }
  return { byPct, byFlat };
}

export function AdvisorCost({ label }: { label: string }) {
  const [size, setSize] = useState(1000000);
  const [bp, setBp] = useState(100);
  const [flat, setFlat] = useState(4500);
  const idS = useId(), idP = useId(), idF = useId(), pct = bp / 10000;
  const p = useMemo(() => advisorPath(size, pct, flat), [size, pct, flat]);
  const money = (v: number) => fmt(v, "money", false);
  const years = Array.from({ length: ADVICE.years + 1 }, (_, i) => i);
  const a = p.byPct[ADVICE.years], b = p.byFlat[ADVICE.years], gap = Math.abs(a - b);
  const pctName = `${(pct * 100).toFixed(2)}% of assets`;
  return (
    <>
      <Chart label={label} spec={{
        type: "line", x: years, xLabel: "Years", y: "money",
        series: [
          { name: pctName, values: p.byPct, tone: "bad" },
          { name: `${money(flat)} per year`, values: p.byFlat, tone: "good" },
        ],
      }} />
      <div className="lrn-movers">
        <div className="lrn-mover">
          <label htmlFor={idS}>Portfolio</label>
          <NativeRange id={idS} min={100000} max={3000000} step={50000} value={size} onChange={(e) => setSize(+e.target.value)} />
          <output htmlFor={idS}>{money(size)}</output>
        </div>
        <div className="lrn-mover">
          <label htmlFor={idP}>Percentage fee</label>
          <NativeRange id={idP} min={25} max={150} step={5} value={bp} onChange={(e) => setBp(+e.target.value)} />
          <output htmlFor={idP}>{(pct * 100).toFixed(2)}% per year</output>
        </div>
        <div className="lrn-mover">
          <label htmlFor={idF}>Flat fee</label>
          <NativeRange id={idF} min={1000} max={15000} step={500} value={flat} onChange={(e) => setFlat(+e.target.value)} />
          <output htmlFor={idF}>{money(flat)} per year</output>
        </div>
      </div>
      <p className="lrn-readout">
        In the first year {pctName} is <b>{money(size * pct)}</b> and the flat fee is <b>{money(flat)}</b>; they cost the same at a portfolio of {money(flat / pct)}.
        After {ADVICE.years} years the portfolio is <b>{money(a)}</b> with the percentage fee and <b>{money(b)}</b> with the flat fee,
        {gap < 1000 ? <> about the same.</> : <> <b>{money(gap)}</b> {a > b ? "more" : "less"} with the percentage fee.</>}
        {" "}By then the percentage fee is {money(a * pct)} per year.
      </p>
    </>
  );
}
