/* Lesson 11's figure: the saving schedule by age, a bar for each year, with
   today's saving every year as a dashed line to compare. Stage boundaries
   are labelled with their ages; the table under the card gives each stage
   in words and dollars, so the bars never carry the figures alone. */

import { money } from "@/lib/format";
import type { Stage } from "../schedule";

export function ScheduleBars({ list, flat }: { list: Stage[]; flat: number }) {
  if (!list.length) return null;
  const a0 = list[0].from, a1 = list[list.length - 1].to, n = a1 - a0;
  const max = Math.max(1, flat, ...list.map((s) => s.monthly));
  const pct = (v: number) => ((v / max) * 100).toFixed(2);
  const years: number[] = [];
  for (const s of list) for (let t = s.from; t < s.to; t++) years.push(s.monthly);
  return (
    <div className="gd-sched" role="img"
      aria-label={"Saving a month by age: " + list.map((s) => s.from + " to " + s.to + ", " + money(s.monthly)).join("; ") + ". Today's saving every year would be " + money(flat) + "."}>
      <div className="gd-sched-bars" aria-hidden="true" style={{ "--n": n } as React.CSSProperties}>
        {years.map((v, i) => <span key={i} style={{ "--h": pct(v) } as React.CSSProperties}></span>)}
        <i className="flat" style={{ "--h": pct(flat) } as React.CSSProperties}></i>
      </div>
      <div className="gd-sched-ax" aria-hidden="true">
        {list.map((s) => <span key={s.from} style={{ "--x": (((s.from - a0) / n) * 100).toFixed(2) } as React.CSSProperties}>{s.from}</span>)}
        <span className="end">{a1}</span>
      </div>
      <div className="gd-sched-key" aria-hidden="true"><span><s className="bar"></s>Saving a month, by age</span><span><s className="flat"></s>Today&apos;s {money(flat)} every year</span></div>
    </div>
  );
}
