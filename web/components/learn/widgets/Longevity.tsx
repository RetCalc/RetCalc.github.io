"use client";

/* How long to plan for (the how-long-to-plan-for lesson): the chance of
   reaching each later age from the age reached now, from the SSA's 2023
   period life table (2026 Trustees Report, table4c6) as the lesson's odds
   table uses it: lives at x ÷ lives at the age now, every fifth age from
   65. A couple is two people of the same age, a man and a woman, treated
   as independent: at least one alive = 1 − (1 − man) × (1 − woman); both
   alive = man × woman. */

import { useId, useState } from "react";
import { NativeRange } from "@/components/ui/native-range";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { Chart } from "../Chart";

/** Lives out of 100,000 born, at 65, 70 … 100 (SSA period life table, 2023). */
export const LIVES = {
  ages: [65, 70, 75, 80, 85, 90, 95, 100],
  man: [79084, 71916, 62797, 50785, 35529, 19063, 6333, 999],
  woman: [87399, 82374, 75248, 64606, 49469, 30504, 12612, 2758],
};

export type Who = "man" | "woman" | "couple";

/** The chance of being alive at each tabled age from `now` on: one person, or a couple's at-least-one and both. */
export function survival(now: number): { ages: number[]; man: number[]; woman: number[]; one: number[]; both: number[] } {
  const i0 = LIVES.ages.indexOf(now);
  const ages = LIVES.ages.slice(i0);
  const man = LIVES.man.slice(i0).map((l) => l / LIVES.man[i0]);
  const woman = LIVES.woman.slice(i0).map((l) => l / LIVES.woman[i0]);
  return {
    ages, man, woman,
    one: man.map((m, i) => 1 - (1 - m) * (1 - woman[i])),
    both: man.map((m, i) => m * woman[i]),
  };
}

export function Longevity({ label }: { label: string }) {
  const [now, setNow] = useState(65);
  const [plan, setPlan] = useState(95);
  const [who, setWho] = useState<Who>("couple");
  const idN = useId(), idP = useId();
  const to = Math.max(plan, now + 5);
  const s = survival(now), at = s.ages.indexOf(to);
  const chance = who === "man" ? s.man[at] : who === "woman" ? s.woman[at] : s.one[at];
  const pct = (v: number) => (v < 0.001 ? "under 0.1%" : v < 0.1 ? `${(v * 100).toFixed(1)}%` : `${Math.round(v * 100)}%`);
  const odds = chance > 0.005 && chance < 0.35 ? Math.round(1 / chance) : null;
  return (
    <>
      <div className="lrn-mixes">
        <span className="lrn-cap">Planning for</span>
        <Segmented role="group" aria-label="Who the plan is for">
          <SegmentedItem pressed={who === "man"} onClick={() => setWho("man")}>Man</SegmentedItem>
          <SegmentedItem pressed={who === "woman"} onClick={() => setWho("woman")}>Woman</SegmentedItem>
          <SegmentedItem pressed={who === "couple"} onClick={() => setWho("couple")}>Couple</SegmentedItem>
        </Segmented>
      </div>
      <Chart label={label} spec={{
        type: "line", x: s.ages, xLabel: "Age", y: "pct",
        series: who === "couple"
          ? [
            { name: "At least one alive", values: s.one, tone: "accent" },
            { name: "Both alive", values: s.both, tone: "muted", dash: true },
          ]
          : [{ name: who === "man" ? "Man alive" : "Woman alive", values: who === "man" ? s.man : s.woman, tone: "accent" }],
        marks: [{ x: to, label: `Plan to ${to}` }],
      }} />
      <div className="lrn-movers">
        <div className="lrn-mover">
          <label htmlFor={idN}>Age now</label>
          <NativeRange id={idN} min={65} max={90} step={5} value={now} onChange={(e) => setNow(+e.target.value)} />
          <output htmlFor={idN}>{now}</output>
        </div>
        <div className="lrn-mover">
          <label htmlFor={idP}>Plan to age</label>
          <NativeRange id={idP} min={70} max={100} step={5} value={to} onChange={(e) => setPlan(+e.target.value)} />
          <output htmlFor={idP}>{to}</output>
        </div>
      </div>
      <p className="lrn-readout">
        {who === "couple" ? <>For a couple both {now} now, the chance that at least one of them is alive at {to}</> : <>For a {who} of {now}, the chance of being alive at {to}</>} is <b>{pct(chance)}</b>
        {odds ? <>, about 1 in {odds}</> : null}. That is the chance of outliving a plan that runs to {to}.
        {who === "couple" ? <> The chance both are alive then is {pct(s.both[at])}.</> : null}
        {" "}The figures are for the US population as a whole, at the death rates of 2023.
      </p>
    </>
  );
}
