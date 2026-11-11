"use client";

/* Medicare's income surcharge as steps (the roth-conversions lesson): a
   modified AGI, a filing status and how many on the return are on Medicare,
   and the yearly Part B and Part D surcharge at every income, from the
   newest year's tiers (yearData().medicare.irmaa, via irmaaAnnual). Each
   line is a cliff: a dollar over it costs the whole step. The premium is
   set by income from two years earlier. */

import { useId, useMemo, useState } from "react";
import { NativeRange } from "@/components/ui/native-range";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { irmaaAnnual, irmaaTier, yearData } from "@/lib/engine";
import { Chart, fmt } from "../Chart";

type Status = "s" | "m";
interface Tier { s: number; m: number }

/** The tier lines for `status` (the income at or below which each tier applies), finite ones only. */
function lines(status: Status): number[] {
  const tiers = (yearData() as { medicare: { irmaa: { tiers: Tier[] } } }).medicare.irmaa.tiers;
  return tiers.map((t) => t[status]).filter((v) => isFinite(v));
}

/** The surcharge at `magi`, the line just below and above it, and what crossing the next one adds. */
export function irmaaPicture(magi: number, status: Status, people: number) {
  const L = lines(status), tier = irmaaTier(magi, status) as number;
  const cost = (m: number) => irmaaAnnual(m, status, people) as number;
  const now = cost(magi), below = tier > 0 ? L[tier - 1] : null, next = tier < L.length ? L[tier] : null;
  return { now, below, next, toNext: next != null ? next - magi : null, nextAdds: next != null ? cost(next + 1) - now : null, lines: L };
}

/** The surcharge as a step line: a point at nothing, at each line (the step above it starts there) and past the last. */
export function irmaaSteps(status: Status, people: number) {
  const L = lines(status), end = Math.round(L[L.length - 1] * 1.2 / 50000) * 50000;
  const x = [0, ...L.map((v) => Math.round(v)), end];
  return { x, y: x.map((v, i) => irmaaAnnual(i === 0 ? 0 : i === x.length - 1 ? end : v + 1, status, people) as number) };
}

export function IrmaaSteps({ label }: { label: string }) {
  const [magi, setMagi] = useState(219000);
  const [status, setStatus] = useState<Status>("m");
  const [both, setBoth] = useState(true);
  const id = useId(), people = status === "m" && both ? 2 : 1;
  const steps = useMemo(() => irmaaSteps(status, people), [status, people]);
  const p = irmaaPicture(magi, status, people);
  const max = status === "m" ? 850000 : 600000, at = Math.min(magi, max);
  const money = (v: number) => fmt(Math.round(v), "money", false);
  const cents = (v: number) => "$" + v.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });
  const who = people === 2 ? "two people" : "one person";
  return (
    <>
      <div className="lrn-mixes">
        <span className="lrn-cap">Filing as</span>
        <Segmented role="group" aria-label="Filing status">
          <SegmentedItem pressed={status === "s"} onClick={() => setStatus("s")}>Single</SegmentedItem>
          <SegmentedItem pressed={status === "m"} onClick={() => setStatus("m")}>Married</SegmentedItem>
        </Segmented>
      </div>
      {status === "m" ? (
        <div className="lrn-mixes">
          <span className="lrn-cap">On Medicare</span>
          <Segmented role="group" aria-label="How many on Medicare">
            <SegmentedItem pressed={!both} onClick={() => setBoth(false)}>One of you</SegmentedItem>
            <SegmentedItem pressed={both} onClick={() => setBoth(true)}>Both</SegmentedItem>
          </Segmented>
        </div>
      ) : null}
      <Chart label={label} spec={{
        type: "line", x: steps.x, xFormat: "money", xLabel: "Modified AGI two years earlier", y: "money",
        series: [{ name: "Surcharge per year", values: steps.y, tone: "bad", step: true }],
        marks: [{ x: at, label: `${fmt(at, "money")}: ${fmt(p.now, "money")}` }],
      }} />
      <div className="lrn-mover">
        <label htmlFor={id}>Modified AGI</label>
        <NativeRange id={id} min={50000} max={max} step={1000} value={at} onChange={(e) => setMagi(+e.target.value)} />
        <output htmlFor={id}>{money(at)}</output>
      </div>
      <p className="lrn-readout">
        At {money(at)} the Medicare surcharge for {who} is <b>{cents(p.now)} per year</b>, charged two years later.
        {p.below != null ? <> That&apos;s {money(at - p.below)} over the {money(p.below)} line; income {money(at - p.below)} lower would bring it down a step.</> : null}
        {p.next != null && p.nextAdds != null && p.toNext != null
          ? <> The next line is at {money(p.next)}, <b>{money(p.toNext)}</b> above this, and a dollar over it adds <b>{cents(p.nextAdds)}</b> per year.</>
          : <> This is the top step.</>}
      </p>
    </>
  );
}
