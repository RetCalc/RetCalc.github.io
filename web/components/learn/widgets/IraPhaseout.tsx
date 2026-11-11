"use client";

/* IRA phase-outs (the iras lesson): modified adjusted gross income, filing
   status and who on the return has a plan at work, and how much of a
   $7,500 IRA contribution (under 50) is deductible as traditional and how
   much can go directly into a Roth, for 2026. Each limit falls in
   proportion across its range (limits.iraPhase, limits.rothPhase), rounded
   up to the next $10, and is at least $200 until the range ends: the IRS
   worksheets, as preTaxSplit applies them for the deduction. */

import { useId, useMemo, useState } from "react";
import { NativeRange } from "@/components/ui/native-range";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { NEWEST_YEAR, yearData } from "@/lib/engine";
import { Chart, fmt } from "../Chart";

type Status = "s" | "m";
/** Who on the return has a plan at work: you, only your spouse (joint), or nobody. */
type Cover = "you" | "spouse" | "none";
interface Limits { ira: { base: number }; iraPhase: { cov: Record<Status, number[]>; spouse: number[] }; rothPhase: Record<Status, number[]> }

const Y = () => yearData(NEWEST_YEAR) as { year: number; limits: Limits };

/** A limit phased out across `range` at `magi`, rounded up to $10, at least $200 until it's gone. */
function phased(limit: number, range: number[] | null, magi: number): number {
  if (!range) return limit;
  const f = Math.min(1, Math.max(0, (magi - range[0]) / (range[1] - range[0])));
  if (f >= 1) return 0;
  return Math.min(limit, Math.max(200, Math.ceil((limit * (1 - f)) / 10) * 10));
}

/** Deductible traditional IRA and direct Roth IRA room at `magi`, and the ranges used. */
export function iraRoom(magi: number, status: Status, cover: Cover) {
  const { year, limits: L } = Y(), limit = L.ira.base;
  const dRange = cover === "you" ? L.iraPhase.cov[status] : cover === "spouse" && status === "m" ? L.iraPhase.spouse : null;
  const rRange = L.rothPhase[status];
  return { year, limit, dRange, rRange, deduct: phased(limit, dRange, magi), roth: phased(limit, rRange, magi) };
}

export function IraPhaseout({ label }: { label: string }) {
  const [magi, setMagi] = useState(85000);
  const [status, setStatus] = useState<Status>("s");
  const [cover, setCover] = useState<Cover>("you");
  const id = useId();
  const c: Cover = status === "s" && cover === "spouse" ? "you" : cover;
  const p = iraRoom(magi, status, c);
  const xs = useMemo(() => Array.from({ length: 241 }, (_, i) => 40000 + i * 1000), []);
  const lines = useMemo(() => xs.map((x) => iraRoom(x, status, c)), [xs, status, c]);
  const money = (v: number) => fmt(v, "money", false);
  const range = (r: number[]) => `${money(r[0])}–${money(r[1])}`;
  return (
    <>
      <div className="lrn-mixes">
        <span className="lrn-cap">Filing</span>
        <Segmented role="group" aria-label="Filing status">
          <SegmentedItem pressed={status === "s"} onClick={() => setStatus("s")}>Single</SegmentedItem>
          <SegmentedItem pressed={status === "m"} onClick={() => setStatus("m")}>Joint</SegmentedItem>
        </Segmented>
      </div>
      <div className="lrn-mixes">
        <span className="lrn-cap">Plan at work</span>
        <Segmented role="group" aria-label="Who has a retirement plan at work">
          <SegmentedItem pressed={c === "you"} onClick={() => setCover("you")}>You</SegmentedItem>
          {status === "m" ? <SegmentedItem pressed={c === "spouse"} onClick={() => setCover("spouse")}>Spouse only</SegmentedItem> : null}
          <SegmentedItem pressed={c === "none"} onClick={() => setCover("none")}>{status === "m" ? "Neither" : "None"}</SegmentedItem>
        </Segmented>
      </div>
      <Chart label={label} spec={{
        type: "line", x: xs, xFormat: "money", xLabel: "Modified adjusted gross income", y: "money",
        series: [
          { name: "Roth IRA contribution allowed", values: lines.map((l) => l.roth), tone: "good" },
          { name: "Traditional IRA contribution you can deduct", values: lines.map((l) => l.deduct), tone: "accent" },
        ],
        marks: [{ x: magi, label: money(magi) }],
      }} />
      <div className="lrn-mover">
        <label htmlFor={id}>Income (MAGI)</label>
        <NativeRange id={id} min={40000} max={280000} step={1000} value={magi} onChange={(e) => setMagi(+e.target.value)} />
        <output htmlFor={id}>{money(magi)}</output>
      </div>
      <p className="lrn-readout">
        Of a {money(p.limit)} contribution for {p.year}, <b>{money(p.deduct)}</b> is deductible as traditional
        {p.dRange ? <> (the deduction phases out from {range(p.dRange)})</> : <> (with no plan at work on the return, at any income)</>},
        and <b>{money(p.roth)}</b> can go directly into a Roth (phasing out from {range(p.rRange)}).
        {p.roth === 0 ? <> Above the Roth range, the backdoor Roth is the way in.</>
          : p.roth < p.limit ? <> The other {money(p.limit - p.roth)} can go into a traditional IRA, deductible or not.</> : null}
      </p>
    </>
  );
}
