"use client";

/* The tax torpedo (the retirement-income-taxes lesson): Social Security, a
   filing status, and the federal tax on the next dollar of IRA withdrawals
   at each level of withdrawals, beside the bracket rate. Each point is
   computeRetireTax at x + $1 less the same at x, everyone 67, standard
   deduction, no state tax, the newest tax year. Where benefits are being
   phased into income the next dollar pays 1.5 or 1.85 times the bracket. */

import { useId, useMemo, useState } from "react";
import { NativeRange } from "@/components/ui/native-range";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { computeRetireTax } from "@/lib/engine";
import { Chart, fmt } from "../Chart";

type Status = "s" | "m";
interface Rt { federal: number; taxableSS: number; nominalMarginal: number }

const STEP = 5000, TOP = 150000;

/** The federal return for IRA withdrawals `trad` and Social Security `ss`, everyone 67. */
function ret(trad: number, ss: number, status: Status): Rt {
  return computeRetireTax({
    status, ages: status === "m" ? [67, 67] : [67], trad, ss, roth: 0, brok: 0, gainPct: 0, pension: 0, penPublic: false, other: 0,
    state: "TX", pre: 0, dedType: "std", item: 0, _noMarginal: true,
  }) as Rt;
}

/** The tax on the next dollar withdrawn, the bracket rate, and what another $1,000 makes of Social Security, at `trad`. */
export function torpedoPoint(trad: number, ss: number, status: Status) {
  const r = ret(trad, ss, status), next = ret(trad + 1, ss, status), more = ret(trad + 1000, ss, status);
  return {
    trad, federal: r.federal, bracket: r.nominalMarginal, taxableSS: r.taxableSS,
    rate: Math.round((next.federal - r.federal) * 10000) / 10000,
    ssPulled: more.taxableSS - r.taxableSS,
  };
}

/** torpedoPoint every $5,000 from nothing to $150,000 of withdrawals. */
export function torpedoPath(ss: number, status: Status) {
  return Array.from({ length: TOP / STEP + 1 }, (_, i) => torpedoPoint(i * STEP, ss, status));
}

export function Torpedo({ label }: { label: string }) {
  const [ss, setSs] = useState(50000);
  const [trad, setTrad] = useState(50000);
  const [status, setStatus] = useState<Status>("m");
  const idS = useId(), idT = useId();
  const path = useMemo(() => torpedoPath(ss, status), [ss, status]);
  const p = torpedoPoint(trad, ss, status);
  const money = (v: number) => fmt(Math.round(v), "money", false);
  const pct = (v: number) => `${+(v * 100).toFixed(2)}%`;
  const capped = p.taxableSS >= 0.85 * ss - 0.5;
  return (
    <>
      <div className="lrn-mixes">
        <span className="lrn-cap">Filing as</span>
        <Segmented role="group" aria-label="Filing status">
          <SegmentedItem pressed={status === "s"} onClick={() => setStatus("s")}>Single</SegmentedItem>
          <SegmentedItem pressed={status === "m"} onClick={() => setStatus("m")}>Married</SegmentedItem>
        </Segmented>
      </div>
      <Chart label={label} spec={{
        type: "line", x: path.map((q) => q.trad), xFormat: "money", xLabel: "IRA withdrawals per year", y: "pct",
        series: [
          { name: "Tax on the next dollar", values: path.map((q) => q.rate), tone: "bad", step: true },
          { name: "Bracket", values: path.map((q) => q.bracket), tone: "muted", dash: true, step: true },
        ],
        marks: [{ x: trad, label: `${fmt(trad, "money")}: ${pct(p.rate)}` }],
      }} />
      <div className="lrn-movers">
        <div className="lrn-mover">
          <label htmlFor={idS}>Social Security per year</label>
          <NativeRange id={idS} min={10000} max={80000} step={1000} value={ss} onChange={(e) => setSs(+e.target.value)} />
          <output htmlFor={idS}>{money(ss)}</output>
        </div>
        <div className="lrn-mover">
          <label htmlFor={idT}>IRA withdrawals per year</label>
          <NativeRange id={idT} min={0} max={TOP} step={1000} value={trad} onChange={(e) => setTrad(+e.target.value)} />
          <output htmlFor={idT}>{money(trad)}</output>
        </div>
      </div>
      <p className="lrn-readout">
        At {money(trad)} of withdrawals the federal tax is <b>{money(p.federal)}</b>, and the next dollar withdrawn pays <b>{pct(p.rate)}</b> where the bracket is {pct(p.bracket)}.
        {p.ssPulled >= 1
          ? <> Another $1,000 from the IRA would make <b>{money(p.ssPulled)}</b> more of the Social Security taxable as well.</>
          : capped
            ? <> 85% of the benefits is already taxable, so more withdrawals can&apos;t pull in any more of it.</>
            : <> At this level more withdrawals don&apos;t make any more of the Social Security taxable.</>}
        {p.rate === 0 ? <> The deductions still cover this income.</> : null}
      </p>
    </>
  );
}
