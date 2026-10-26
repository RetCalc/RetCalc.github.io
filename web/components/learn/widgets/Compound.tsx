"use client";

/* Compound growth (the compound-growth lesson): what a steady monthly
   amount, kept up until 65, is worth at 65 depending on the age it starts,
   beside the total put in, so the gap between the lines is the growth. The
   five investment mixes are the Calculator's, with its returns after
   inflation, and the arithmetic is its own (projectBasic, monthly), so the
   figures match the Calculator's. With a plan, the amount starts at the
   plan's monthly saving and a marker shows the reader's age. */

import { useId, useMemo, useState } from "react";
import { NativeRange } from "@/components/ui/native-range";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { RISK_LEVELS, projectBasic } from "@/lib/engine";
import { useAccount } from "@/components/account/AccountProvider";
import { useDashboard, unstarted } from "@/components/dashboard/store";
import { ageOf, contribMonth } from "@/components/dashboard/model";
import { Chart, fmt } from "../Chart";

const FROM = 20, TO = 60, END = 65;

/** What `monthly` saved from `start` to 65 comes to, in today's dollars. */
export function atEnd(start: number, monthly: number, real: number): { fv: number; invested: number } {
  const r = projectBasic({ initial: 0, contrib: monthly, period: "month", years: END - start, real, withdrawal: 0.04 }) as { fv: number; invested: number };
  return { fv: r.fv, invested: r.invested };
}

export function Compound({ label }: { label: string }) {
  const { account } = useAccount();
  const { data } = useDashboard();
  const own = !!account && !unstarted(data);
  const planMonthly = own ? contribMonth(data.profile) : null, myAge = own ? ageOf(data.profile.p1) : null;
  const [monthly, setMonthly] = useState(() => (planMonthly && planMonthly > 0 ? Math.min(3000, Math.round(planMonthly / 50) * 50) : 500));
  const [mix, setMix] = useState(2);
  const id = useId();
  const real = RISK_LEVELS[mix].real as number;
  const ages = Array.from({ length: TO - FROM + 1 }, (_, i) => FROM + i);
  const pts = useMemo(() => ages.map((a) => atEnd(a, monthly, real)), [ages, monthly, real]);
  const at = (a: number) => pts[a - FROM];
  return (
    <>
      <div className="lrn-mixes">
        <span className="lrn-cap">Investment mix</span>
        <Segmented role="group" aria-label="Investment mix">
          {RISK_LEVELS.map((r: { label: string; real: number }, i: number) => (
            <SegmentedItem key={r.label} pressed={mix === i} onClick={() => setMix(i)}>{r.label} {+(r.real * 100).toFixed(2)}%</SegmentedItem>
          ))}
        </Segmented>
      </div>
      <Chart label={label} spec={{
        type: "line", x: ages, xLabel: "Age saving starts", y: "money",
        series: [
          { name: "Balance at 65", values: pts.map((p) => p.fv), tone: "accent" },
          { name: "Total put in", values: pts.map((p) => p.invested), tone: "muted", dash: true },
        ],
        marks: myAge != null && myAge >= FROM && myAge <= TO ? [{ x: myAge, label: `You, at ${myAge}` }] : [],
      }} />
      <div className="lrn-mover">
        <label htmlFor={id}>Saving per month</label>
        <NativeRange id={id} min={100} max={3000} step={50} value={monthly} onChange={(e) => setMonthly(+e.target.value)} />
        <output htmlFor={id}>{fmt(monthly, "money", false)} per month</output>
      </div>
      <p className="lrn-readout">
        Start at 25: <b>{fmt(Math.round(at(25).fv / 1000) * 1000, "money", false)}</b>. Start at 35: <b>{fmt(Math.round(at(35).fv / 1000) * 1000, "money", false)}</b>. Start at 45: <b>{fmt(Math.round(at(45).fv / 1000) * 1000, "money", false)}</b>. In today&rsquo;s dollars, growing {+(real * 100).toFixed(2)}% per year after inflation.
      </p>
    </>
  );
}
