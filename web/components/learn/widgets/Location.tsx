"use client";

/* Asset location (the asset-location lesson): $100,000 in a Roth and
   $100,000 in a taxable account, half in stocks and half in bonds, nothing
   added, and the after-tax total of the two arrangements, as the lesson's
   yield chart works it. Stocks return 7% per year, 5.5% price growth and
   1.5% qualified dividends.
     Taxable stocks: dividends taxed each year and reinvested (added to
     basis), the remaining gain taxed when sold at the end.
     Taxable bonds: interest taxed each year at the ordinary rate,
     100,000 × (1 + y(1 − t))^n. Roth: untaxed growth.
   The ordinary rate is one of the newest year's federal brackets; the rate
   on dividends and gains goes with it: 0% in the 10% and 12% brackets,
   20% in the top one, 15% between (close to the 2026 breakpoints). */

import { useId, useMemo, useState } from "react";
import { NativeRange } from "@/components/ui/native-range";
import { NEWEST_YEAR, yearData } from "@/lib/engine";
import { Chart, fmt } from "../Chart";

export const LOC = { each: 100000, price: 0.055, div: 0.015 };
const RATES = (yearData(NEWEST_YEAR) as { fed: { s: number[][] } }).fed.s.map((b) => b[1]);
export const gainRate = (t: number) => (t <= 0.12 ? 0 : t >= RATES[RATES.length - 1] ? 0.2 : 0.15);

/** The two arrangements' after-tax totals at bond yield `y`, ordinary rate `t`, over `years`. */
export function placements(y: number, t: number, years: number) {
  const g = gainRate(t);
  let v = LOC.each, basis = LOC.each;
  for (let i = 0; i < years; i++) {
    const d = v * LOC.div * (1 - g);
    v = v * (1 + LOC.price) + d; basis += d;
  }
  const taxableStocks = v - g * (v - basis);
  const rothStocks = LOC.each * Math.pow(1 + LOC.price + LOC.div, years);
  const rothBonds = LOC.each * Math.pow(1 + y, years), taxableBonds = LOC.each * Math.pow(1 + y * (1 - t), years);
  return { bondsSheltered: rothBonds + taxableStocks, stocksSheltered: rothStocks + taxableBonds };
}

/** The bond yield at which the two arrangements come out even, or null above 15%. */
export function breakEven(t: number, years: number): number | null {
  const d = (y: number) => { const p = placements(y, t, years); return p.bondsSheltered - p.stocksSheltered; };
  let lo = 0, hi = 0.15;
  if (d(lo) > 0 || d(hi) < 0) return null;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (d(m) < 0) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

export function Location({ label }: { label: string }) {
  const [y, setY] = useState(2);
  const [ti, setTi] = useState(RATES.indexOf(0.22));
  const [years, setYears] = useState(30);
  const idY = useId(), idT = useId(), idN = useId(), t = RATES[ti];
  const p = placements(y / 100, t, years);
  const even = useMemo(() => breakEven(t, years), [t, years]);
  const money = (v: number) => fmt(Math.round(v / 100) * 100, "money", false);
  const gap = p.stocksSheltered - p.bondsSheltered;
  return (
    <>
      <Chart label={label} spec={{
        type: "bar", labels: true, x: ["Bonds in the Roth, stocks taxable", "Stocks in the Roth, bonds taxable"], y: "money",
        series: [{ name: `After tax, after ${years} years`, values: [p.bondsSheltered, p.stocksSheltered], tone: "accent" }],
      }} />
      <div className="lrn-movers">
        <div className="lrn-mover">
          <label htmlFor={idY}>Bond yield</label>
          <NativeRange id={idY} min={0.5} max={7} step={0.25} value={y} onChange={(e) => setY(+e.target.value)} />
          <output htmlFor={idY}>{y}% per year</output>
        </div>
        <div className="lrn-mover">
          <label htmlFor={idT}>Tax rate on interest</label>
          <NativeRange id={idT} min={0} max={RATES.length - 1} step={1} value={ti} onChange={(e) => setTi(+e.target.value)} />
          <output htmlFor={idT}>{Math.round(t * 100)}%, gains {Math.round(gainRate(t) * 100)}%</output>
        </div>
        <div className="lrn-mover">
          <label htmlFor={idN}>Years</label>
          <NativeRange id={idN} min={5} max={40} step={1} value={years} onChange={(e) => setYears(+e.target.value)} />
          <output htmlFor={idN}>{years}</output>
        </div>
      </div>
      <p className="lrn-readout">
        {Math.abs(gap) < 500 ? <>The two arrangements come out <b>about even</b>.</>
          : gap > 0 ? <>Sheltering the stocks leaves <b>{money(gap)}</b> more.</>
          : <>Sheltering the bonds leaves <b>{money(-gap)}</b> more.</>}
        {even != null ? <> On these settings the two tie at a bond yield of about <b>{(even * 100).toFixed(1)}%</b>; above it, the bonds belong in the Roth.</> : null}
        {" "}Stocks return 7% per year, 1.5% of it dividends, and the taxable holding is sold at the end. Not adjusted for inflation.
      </p>
    </>
  );
}
