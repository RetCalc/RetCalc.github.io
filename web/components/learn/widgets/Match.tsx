"use client";

/* The employer match (the employer-match lesson): a salary, the share of
   pay contributed and one of the lesson's three match formulas, and what
   goes in per year: your own money, the employer's match, and the match
   the formula would still pay if you contributed up to its cap. Each
   formula is a list of tiers [rate, up to share of pay]; the match is the
   sum over tiers of rate × the part of your contribution rate inside the
   tier, × salary (the lesson chart's data comment). Your own money stops
   at the 2026 401(k) limit. */

import { useId, useState } from "react";
import { NativeRange } from "@/components/ui/native-range";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { NEWEST_YEAR, yearData } from "@/lib/engine";
import { Chart, fmt } from "../Chart";

type Tier = [rate: number, upTo: number];
export const MATCH_FORMULAS: { key: string; short: string; name: string; tiers: Tier[] }[] = [
  { key: "half6", short: "50% of 6%", name: "50% of the first 6%", tiers: [[0.5, 0.06]] },
  { key: "tier5", short: "100/50% of 5%", name: "100% of the first 3%, then 50% of the next 2%", tiers: [[1, 0.03], [0.5, 0.05]] },
  { key: "full4", short: "100% of 4%", name: "100% of the first 4%", tiers: [[1, 0.04]] },
];

/** The match a formula pays on a contribution of `share` of `salary`. */
function matchOn(tiers: Tier[], share: number, salary: number): number {
  let m = 0, lo = 0;
  for (const [rate, upTo] of tiers) { m += rate * Math.max(0, Math.min(share, upTo) - lo); lo = upTo; }
  return m * salary;
}

/** Own money, match collected and match left unclaimed per year. */
export function matchPicture(salary: number, share: number, tiers: Tier[]) {
  const Y = yearData(NEWEST_YEAR) as { year: number; limits: { k401: { base: number } } };
  const own = Math.min(share * salary, Y.limits.k401.base);
  const cap = tiers[tiers.length - 1][1];
  const match = matchOn(tiers, own / salary, salary), most = matchOn(tiers, cap, salary);
  return { year: Y.year, own, match, unclaimed: most - match, most, cap };
}

export function Match({ label }: { label: string }) {
  const [salary, setSalary] = useState(60000);
  const [pct, setPct] = useState(3);
  const [fi, setFi] = useState(0);
  const idS = useId(), idR = useId(), f = MATCH_FORMULAS[fi];
  const p = matchPicture(salary, pct / 100, f.tiers);
  const money = (v: number) => fmt(Math.round(v), "money", false);
  const capPct = +(p.cap * 100).toFixed(1);
  return (
    <>
      <div className="lrn-mixes">
        <span className="lrn-cap">Match</span>
        <Segmented role="group" aria-label="Match formula">
          {MATCH_FORMULAS.map((m, i) => <SegmentedItem key={m.key} pressed={fi === i} onClick={() => setFi(i)}>{m.short}</SegmentedItem>)}
        </Segmented>
      </div>
      <Chart label={label} spec={{
        type: "bar", stack: true, x: ["You put in", "Employer adds"], y: "money",
        series: [
          { name: "Paid in per year", values: [p.own, p.match], tone: "accent" },
          { name: "Match left unclaimed", values: [0, p.unclaimed], tone: "bad" },
        ],
      }} />
      <div className="lrn-movers">
        <div className="lrn-mover">
          <label htmlFor={idR}>You contribute</label>
          <NativeRange id={idR} min={0} max={15} step={0.5} value={pct} onChange={(e) => setPct(+e.target.value)} />
          <output htmlFor={idR}>{pct}% of pay</output>
        </div>
        <div className="lrn-mover">
          <label htmlFor={idS}>Salary</label>
          <NativeRange id={idS} min={20000} max={250000} step={1000} value={salary} onChange={(e) => setSalary(+e.target.value)} />
          <output htmlFor={idS}>{fmt(salary, "money", false)} per year</output>
        </div>
      </div>
      <p className="lrn-readout">
        With a match of {f.name.toLowerCase()}, you put in <b>{money(p.own)}</b> per year and the employer adds <b>{money(p.match)}</b>.{" "}
        {p.unclaimed >= 1
          ? <>Another <b>{money(p.unclaimed)}</b> per year is left unclaimed; contributing {capPct}% of pay would collect all {money(p.most)}.</>
          : <>That is the whole match. {pct > capPct ? <>The {+(pct - capPct).toFixed(1)}% above {capPct}% gets your own tax break but no more match.</> : null}</>}
        {p.own < (pct / 100) * salary - 1 ? <> Your own money stops at the {p.year} limit of {money(p.own)}.</> : null}
      </p>
    </>
  );
}
