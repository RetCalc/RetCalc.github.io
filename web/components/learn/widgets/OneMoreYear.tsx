"use client";

/* One more year (the years-before-retiring lesson): savings at the earliest
   age you could retire, saving per year while you keep working, and growth
   of 4.5% per year after inflation (the Calculator's Balanced setting).
   Balance each later year = last year × 1.045 + saving. What the savings
   support = balance × the highest first-year rate, raised with inflation,
   that lasted every January start since 1927 for the years to 95
   (ddSafeByStart, 60% US stocks and 40% 10-year Treasuries, rebalanced
   yearly, no fees), rounded to 0.01%. Each later year's extra is split as
   the lesson splits it: saving and growth priced at the first age's rate,
   and fewer years to pay for = balance × the change in rate. */

import { useId, useMemo, useState } from "react";
import { NativeRange } from "@/components/ui/native-range";
import { DD_LASTS, ddOptsFromState, ddSafeByStart } from "@/lib/engine";
import { Chart, fmt } from "../Chart";

const GROWTH = 0.045, TO = 95, SHOWN = 4;

/** The highest fixed first-year rate that lasted every start, for 25 to 35 years, rounded to 0.01%. */
export function safeRates(): Record<number, number> {
  const out: Record<number, number> = {};
  for (let n = 25; n <= 35; n++) {
    const r = ddSafeByStart(ddOptsFromState({ initial: 1000000, years: n, stock: 60, rate: 4, strategy: "fixed" }), DD_LASTS) as { rate: number | null }[] | null;
    const min = Math.min(...(r ?? []).map((x) => x.rate ?? Infinity));
    out[n] = Math.round(min * 10000) / 10000;
  }
  return out;
}

export interface YearRow { age: number; balance: number; spend: number; base: number; saving: number; growth: number; fewer: number }

/** Spending supported retiring at `from` and each of the next years, and where each extra dollar comes from. */
export function oneMoreYear(balance: number, save: number, from: number, rates: Record<number, number>, shown = SHOWN): YearRow[] {
  const r0 = rates[TO - from], base = balance * r0, rows: YearRow[] = [];
  let b = balance, put = 0;
  for (let k = 0; k < shown; k++) {
    const age = from + k, r = rates[TO - age];
    rows.push({ age, balance: b, spend: b * r, base, saving: put * r0, growth: (b - balance - put) * r0, fewer: b * (r - r0) });
    b = b * (1 + GROWTH) + save; put += save;
  }
  return rows;
}

export function OneMoreYear({ label }: { label: string }) {
  const [balance, setBalance] = useState(1200000);
  const [save, setSave] = useState(30000);
  const [from, setFrom] = useState(62);
  const idB = useId(), idS = useId(), idA = useId();
  const rates = useMemo(() => safeRates(), []);
  const rows = oneMoreYear(balance, save, from, rates);
  const first = rows[0], last = rows[rows.length - 1];
  const money = (v: number) => fmt(v, "money", false);
  return (
    <>
      <Chart label={label} spec={{
        type: "bar", stack: true, labels: true, x: rows.map((r) => String(r.age)), xLabel: "Age at retirement", y: "money",
        series: [
          { name: `Retiring at ${from}`, values: rows.map((r) => r.base), tone: "neutral" },
          { name: "From more saving", values: rows.map((r) => r.saving), tone: "accent" },
          { name: "From more growth", values: rows.map((r) => r.growth), tone: "good" },
          { name: "From fewer years to pay for", values: rows.map((r) => r.fewer), tone: "muted" },
        ],
      }} />
      <div className="lrn-movers">
        <div className="lrn-mover">
          <label htmlFor={idB}>Savings at {from}</label>
          <NativeRange id={idB} min={100000} max={3000000} step={25000} value={balance} onChange={(e) => setBalance(+e.target.value)} />
          <output htmlFor={idB}>{money(balance)}</output>
        </div>
        <div className="lrn-mover">
          <label htmlFor={idS}>Saving per year</label>
          <NativeRange id={idS} min={0} max={100000} step={1000} value={save} onChange={(e) => setSave(+e.target.value)} />
          <output htmlFor={idS}>{money(save)}</output>
        </div>
        <div className="lrn-mover">
          <label htmlFor={idA}>Could retire at</label>
          <NativeRange id={idA} min={60} max={70 - SHOWN + 1} step={1} value={from} onChange={(e) => setFrom(+e.target.value)} />
          <output htmlFor={idA}>{from}</output>
        </div>
      </div>
      <p className="lrn-readout">
        Retiring at {from}, {money(balance)} supports <b>{money(first.spend)} per year</b> to {TO} ({(rates[TO - from] * 100).toFixed(2)}%).
        {" "}Working to {last.age} raises that to <b>{money(last.spend)}</b>, {Math.round((last.spend / first.spend - 1) * 100)}% more: {money(last.saving)} from more saving, {money(last.growth)} from growth and {money(last.fewer)} from fewer years to pay for.
        {" "}The first extra year alone adds <b>{money(rows[1].spend - first.spend)}</b>.
      </p>
    </>
  );
}
