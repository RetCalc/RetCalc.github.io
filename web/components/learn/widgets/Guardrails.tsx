"use client";

/* Fixed or flexible: one January retirement, $1,000,000 in 60/40 for 30
   years, spending each year in today's dollars under guardrails (20% bands,
   cuts and raises of the chosen size) beside the same first-year amount held
   fixed and raised with inflation (runDrawdown on that start's years, via
   guardrailsVsFixed, history-data.ts). */

import { useId, useMemo, useState } from "react";
import { NativeRange } from "@/components/ui/native-range";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { Chart, fmt } from "../Chart";
import { guardrailsVsFixed } from "./history-data";

const STARTS = [1929, 1966, 1982];

export function Guardrails({ label }: { label: string }) {
  const [quarters, setQuarters] = useState(20);
  const [step, setStep] = useState(10);
  const [start, setStart] = useState(1966);
  const idR = useId(), idS = useId(), rate = quarters / 4;
  const r = useMemo(() => guardrailsVsFixed(rate, step, start), [rate, step, start]);
  const g = r.guard, f = r.fixed;
  if (!g || !f) return null;
  const money = (v: number) => fmt(v, "money", false);
  const first = rate * 10000;
  const millions = (v: number) => `$${(v / 1e6).toFixed(2)} million`;
  return (
    <>
      <div className="lrn-mixes">
        <span className="lrn-cap">Retired in</span>
        <Segmented role="group" aria-label="Year the retirement starts">
          {STARTS.map((y) => <SegmentedItem key={y} pressed={start === y} onClick={() => setStart(y)}>{y}</SegmentedItem>)}
        </Segmented>
      </div>
      <Chart label={label} spec={{
        type: "line", x: g.spend.map((_, i) => i + 1), xLabel: "Year of retirement", y: "money",
        series: [
          { name: `Fixed ${money(first)}, raised with inflation`, values: f.spend, tone: "neutral" },
          { name: `Guardrails from ${money(first)}`, values: g.spend, tone: "accent" },
        ],
      }} />
      <div className="lrn-movers">
        <div className="lrn-mover">
          <label htmlFor={idR}>Starting rate</label>
          <NativeRange id={idR} min={12} max={28} step={1} value={quarters} onChange={(e) => setQuarters(+e.target.value)} />
          <output htmlFor={idR}>{rate.toFixed(2)}% ({money(first)})</output>
        </div>
        <div className="lrn-mover">
          <label htmlFor={idS}>Each cut or raise</label>
          <NativeRange id={idS} min={5} max={25} step={5} value={step} onChange={(e) => setStep(+e.target.value)} />
          <output htmlFor={idS}>{step}%</output>
        </div>
      </div>
      <p className="lrn-readout">
        Retiring in {start}, the fixed {money(first)} {f.ranOut ? <>ran out in <b>year {f.ranOut}</b></> : <>lasted all 30 years and left <b>{money(Math.round(f.end / 1000) * 1000)}</b></>}, after spending {millions(f.total)} in all.
        {" "}Guardrails {g.cuts === 0 ? "never cut" : g.cuts === 1 ? "cut once" : `cut ${g.cuts} times`}, with the lowest year at <b>{money(Math.round(g.low))}</b>{g.high > first + 1 ? <> and the highest at {money(Math.round(g.high))}</> : null}; they spent <b>{millions(g.total)}</b> in all and {g.ranOut ? <>ran out in year {g.ranOut}</> : <>left {money(Math.round(g.end / 1000) * 1000)}</>}.
      </p>
    </>
  );
}
