"use client";

/* How much each self-employed account holds (the self-employed-accounts
   lesson), for a sole proprietor with no employees, for 2026, split into
   what goes in as the employee (or as your own IRA contribution) and as
   the employer. The worksheet in the lesson's chart comment:
     SE tax = 12.4% × min(0.9235P, wage base) + 2.9% × 0.9235P
     net earnings N = P − half of SE tax
     SEP = min(20% × N, $72,000)
     solo 401(k) = min(deferral + 20% × N, $72,000) + catch-up, at most N
     SIMPLE = deferral (at most 0.9235P) + 3% × 0.9235P
     IRA = the IRA limit, at most N.
   Deferrals into a solo 401(k) or SIMPLE share the 401(k) employee limit
   with any deferral at a day job. The 401(k), IRA and FICA figures come
   from the engine; the $72,000 annual additions limit and the SIMPLE
   limits aren't in the engine's year data yet, so they are here. */

import { useId, useState } from "react";
import { NativeRange } from "@/components/ui/native-range";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { NEWEST_YEAR, yearData } from "@/lib/engine";
import { Chart, fmt } from "../Chart";

interface Y26 { year: number; fica: { ssRate: number; ssCap: number; medRate: number }; limits: { k401: { base: number; catch50: number }; ira: { base: number; catch50: number }; additions: number; simple: { base: number; catch50: number } } }

/** Each account's room for `profit`, under 50 or from 50, after `dayJob` deferred at another employer's plan. */
export function soloLimits(profit: number, over50: boolean, dayJob: number) {
  const Y = yearData(NEWEST_YEAR) as Y26, L = Y.limits, F = Y.fica;
  const se = 0.9235 * Math.max(0, profit);
  const seTax = 2 * F.ssRate * Math.min(se, F.ssCap) + 2 * F.medRate * se;
  const N = Math.max(0, profit - seTax / 2), employer = 0.2 * N;
  // The employee limit, catch-up included, is per person across every plan.
  const reg = Math.max(0, L.k401.base - dayJob), catchUp = over50 ? Math.max(0, L.k401.catch50 - Math.max(0, dayJob - L.k401.base)) : 0;
  const soloEr = Math.min(employer, L.additions);
  const soloEe = Math.max(0, Math.min(Math.min(reg + soloEr, L.additions) + catchUp, N) - soloEr);
  const simpleEe = Math.min(L.simple.base + (over50 ? L.simple.catch50 : 0), reg + catchUp, se);
  return {
    year: Y.year, N, seTax,
    accounts: [
      { name: "Solo 401(k)", own: soloEe, employer: soloEr },
      { name: "SEP IRA", own: 0, employer: Math.min(employer, L.additions) },
      { name: "SIMPLE IRA", own: simpleEe, employer: 0.03 * se },
      { name: "IRA", own: Math.min(L.ira.base + (over50 ? L.ira.catch50 : 0), N), employer: 0 },
    ],
  };
}

export function SoloLimits({ label }: { label: string }) {
  const [profit, setProfit] = useState(100000);
  const [over50, setOver50] = useState(false);
  const [dayJob, setDayJob] = useState(0);
  const idP = useId(), idD = useId();
  const p = soloLimits(profit, over50, dayJob);
  const money = (v: number) => fmt(Math.round(v), "money", false);
  const tot = p.accounts.map((a) => a.own + a.employer), [solo, sep, simple] = tot;
  return (
    <>
      <div className="lrn-mixes">
        <span className="lrn-cap">Age</span>
        <Segmented role="group" aria-label="Age at the end of the year">
          <SegmentedItem pressed={!over50} onClick={() => setOver50(false)}>Under 50</SegmentedItem>
          <SegmentedItem pressed={over50} onClick={() => setOver50(true)}>50 or older</SegmentedItem>
        </Segmented>
      </div>
      <Chart label={label} spec={{
        type: "bar", stack: true, labels: true, x: p.accounts.map((a) => a.name), y: "money",
        series: [
          { name: "As the employee, or your own", values: p.accounts.map((a) => a.own), tone: "good" },
          { name: "As the employer", values: p.accounts.map((a) => a.employer), tone: "accent" },
        ],
      }} />
      <div className="lrn-movers">
        <div className="lrn-mover">
          <label htmlFor={idP}>Net profit</label>
          <NativeRange id={idP} min={5000} max={400000} step={5000} value={profit} onChange={(e) => setProfit(+e.target.value)} />
          <output htmlFor={idP}>{fmt(profit, "money", false)} per year</output>
        </div>
        <div className="lrn-mover">
          <label htmlFor={idD}>Deferred at a day job</label>
          <NativeRange id={idD} min={0} max={24500} step={500} value={dayJob} onChange={(e) => setDayJob(+e.target.value)} />
          <output htmlFor={idD}>{fmt(dayJob, "money", false)}</output>
        </div>
      </div>
      <p className="lrn-readout">
        Half the self-employment tax ({money(p.seTax / 2)}) comes off first, leaving <b>{money(p.N)}</b> of net earnings for {p.year}.
        A solo 401(k) can take <b>{money(solo)}</b>, a SEP IRA <b>{money(sep)}</b> and a SIMPLE IRA <b>{money(simple)}</b>.
        {dayJob > 0 ? <> The {money(dayJob)} deferred at the day job comes off the employee half; the employer half is untouched.</> : null}
        {over50 ? <> At 60 to 63 the catch-ups are larger, if the plan allows them.</> : null}
      </p>
    </>
  );
}
