"use client";

/* Where each dollar goes (the where-each-dollar-goes lesson): a year of
   saving poured into the account steps in the usual order, each filled to
   its 2026 limit before the next starts, as the lesson's Jordan chart is:
   401(k) up to the match (50% of the first 6% of pay), the HSA (self-only
   limit, if there is a qualifying health plan), the IRA, the rest of the
   401(k) up to its limit, then a taxable account. Under 50, with the cash
   cushion, the debt and the emergency fund already done. */

import { useId, useState } from "react";
import { NativeRange } from "@/components/ui/native-range";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { NEWEST_YEAR, yearData } from "@/lib/engine";
import { Chart, fmt } from "../Chart";

const MATCH_RATE = 0.5, MATCH_CAP = 0.06;
/** Each step, as a readout names it. */
export const DOLLAR_STEPS = ["the 401(k) up to the match", "the HSA", "the IRA", "the 401(k) beyond the match", "a taxable account"];

/** How a year's saving fills each step, and how much room each step has. */
export function dollarOrder(yearly: number, salary: number, hsa: boolean) {
  const Y = yearData(NEWEST_YEAR) as { year: number; limits: { k401: { base: number }; ira: { base: number }; hsa: { self: number } } };
  const L = Y.limits, toMatch = Math.min(MATCH_CAP * salary, L.k401.base);
  const room = [toMatch, hsa ? L.hsa.self : 0, L.ira.base, L.k401.base - toMatch, Infinity];
  let left = yearly;
  const filled = room.map((r) => { const v = Math.min(left, r); left -= v; return v; });
  // Where each step starts, in yearly saving.
  const starts = room.reduce<number[]>((a, r, i) => (i ? [...a, a[i - 1] + room[i - 1]] : [0]), []);
  return { year: Y.year, room, filled, starts, match: MATCH_RATE * filled[0] };
}

export function DollarOrder({ label }: { label: string }) {
  const [monthly, setMonthly] = useState(1000);
  const [salary, setSalary] = useState(90000);
  const [hsa, setHsa] = useState(true);
  const idM = useId(), idS = useId();
  const p = dollarOrder(monthly * 12, salary, hsa);
  const money = (v: number) => fmt(Math.round(v), "money", false);
  const used = p.filled.map((v, i) => ({ v, name: DOLLAR_STEPS[i] })).filter((s) => s.v > 0);
  const nextUp = p.filled.findIndex((v, i) => v === 0 && p.room[i] > 0);
  const startsAt = nextUp >= 0 ? Math.round(p.starts[nextUp] / 12 / 10) * 10 : null;
  const list = used.map((s, i) => <span key={s.name}>{i ? (i === used.length - 1 ? " and " : ", ") : ""}<b>{money(s.v)}</b> to {s.name}</span>);
  return (
    <>
      <div className="lrn-mixes">
        <span className="lrn-cap">Health plan allows an HSA</span>
        <Segmented role="group" aria-label="Health plan allows an HSA">
          <SegmentedItem pressed={hsa} onClick={() => setHsa(true)}>Yes</SegmentedItem>
          <SegmentedItem pressed={!hsa} onClick={() => setHsa(false)}>No</SegmentedItem>
        </Segmented>
      </div>
      <Chart label={label} spec={{
        type: "bar", stack: true, labels: true, x: ["Match", "HSA", "IRA", "401(k) rest", "Taxable"], xLabel: "Step, in order", y: "money",
        series: [
          { name: "Filled this year", values: p.filled, tone: "accent" },
          { name: "Room left", values: p.room.map((r, i) => (isFinite(r) ? r - p.filled[i] : 0)), tone: "muted" },
        ],
      }} />
      <div className="lrn-movers">
        <div className="lrn-mover">
          <label htmlFor={idM}>Saved per month</label>
          <NativeRange id={idM} min={100} max={5000} step={50} value={monthly} onChange={(e) => setMonthly(+e.target.value)} />
          <output htmlFor={idM}>{fmt(monthly, "money", false)}</output>
        </div>
        <div className="lrn-mover">
          <label htmlFor={idS}>Salary</label>
          <NativeRange id={idS} min={30000} max={250000} step={5000} value={salary} onChange={(e) => setSalary(+e.target.value)} />
          <output htmlFor={idS}>{fmt(salary, "money", false)} per year</output>
        </div>
      </div>
      <p className="lrn-readout">
        {money(monthly * 12)} per year goes {list}. The employer adds <b>{money(p.match)}</b>
        {p.filled[0] < p.room[0] ? <>, short of the {money(MATCH_RATE * p.room[0])} a full 6% would collect</> : null}.
        {startsAt != null ? <> The next step starts above about <b>{fmt(startsAt, "money", false)}</b> per month.</> : null}
        {" "}{p.year} limits, under 50, with a match of 50% of the first 6% of pay.
      </p>
    </>
  );
}
