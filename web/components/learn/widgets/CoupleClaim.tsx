"use client";

/* Couple's claiming ages (the spouses-and-survivors lesson): Sam's PIA is
   $2,800 and Jordan's $1,000, both the same age with a full retirement age
   of 67; Sam dies at 80 and Jordan lives to 92. Each spouse's claiming age
   is chosen; ssHousehold (lib/engine/math.js) works out the household's
   Social Security each year, with Jordan's spousal top-up starting once
   both have filed and the survivor keeping the larger check (never less
   than 82.5% of Sam's PIA when Sam claimed early). Today's dollars. */

import { useId, useMemo, useState } from "react";
import { NativeRange } from "@/components/ui/native-range";
import { ssHousehold } from "@/lib/engine/typed";
import { Chart, fmt } from "../Chart";

export const COUPLE = { sam: 2800, jordan: 1000, fra: 67, samDies: 80, jordanDies: 92 };

/** The household's Social Security per month at each age from 62, and the survivor's check. */
export function couplePath(samClaim: number, jordanClaim: number) {
  const h = ssHousehold({
    pia1: COUPLE.sam, fra1: COUPLE.fra, claim1: samClaim, through1: COUPLE.samDies,
    married: true, pia2: COUPLE.jordan, fra2: COUPLE.fra, claim2: jordanClaim, through2: COUPLE.jordanDies, gap: 0,
  });
  const byAge = new Map(h.rows.map((r) => [r.age, r.total / 12]));
  const ages = Array.from({ length: COUPLE.jordanDies - 62 }, (_, i) => 62 + i);
  return { ages, monthly: ages.map((a) => byAge.get(a) ?? 0), survivor: h.survivor, total: h.total };
}

export function CoupleClaim({ label }: { label: string }) {
  const [sam, setSam] = useState(70);
  const [jordan, setJordan] = useState(62);
  const idS = useId(), idJ = useId();
  const mine = useMemo(() => couplePath(sam, jordan), [sam, jordan]);
  const early = useMemo(() => couplePath(62, jordan), [jordan]);
  const money = (v: number) => fmt(v, "money", false);
  const together = mine.monthly[COUPLE.samDies - 1 - 62];
  const widowYears = COUPLE.jordanDies - COUPLE.samDies;
  const more = mine.survivor - early.survivor;
  return (
    <>
      <Chart label={label} spec={{
        type: "line", x: mine.ages, xLabel: "Age", y: "money",
        series: [
          { name: `Sam ${sam}, Jordan ${jordan}`, values: mine.monthly, tone: "accent" },
          ...(sam !== 62 ? [{ name: `Sam 62, Jordan ${jordan}`, values: early.monthly, tone: "muted" as const, dash: true }] : []),
        ],
        marks: [{ x: COUPLE.samDies, label: "Sam dies" }],
      }} />
      <div className="lrn-movers">
        <div className="lrn-mover">
          <label htmlFor={idS}>Sam claims at</label>
          <NativeRange id={idS} min={62} max={70} value={sam} onChange={(e) => setSam(+e.target.value)} />
          <output htmlFor={idS}>{sam}</output>
        </div>
        <div className="lrn-mover">
          <label htmlFor={idJ}>Jordan claims at</label>
          <NativeRange id={idJ} min={62} max={70} value={jordan} onChange={(e) => setJordan(+e.target.value)} />
          <output htmlFor={idJ}>{jordan}</output>
        </div>
      </div>
      <p className="lrn-readout">
        Once both have claimed, the household gets <b>{money(together)} per month</b>. After Sam dies at 80, Jordan keeps <b>{money(mine.survivor)} per month</b> for {widowYears} years
        {sam === 62 ? "." : <>, {money(more)} more than if Sam had claimed at 62.</>}
        {" "}Over both lives the couple collects <b>{money(mine.total)}</b>.
        {jordan < sam ? <> Jordan&apos;s spousal top-up waits until Sam files at {sam}.</> : null}
      </p>
    </>
  );
}
