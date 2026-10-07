/* Lesson 8's figure: the same monthly saving three ways, by age. Saved
   from now to retirement; stopped early; started late for the same number
   of years. Lines differ by dash as well as color, and the key names each
   with its dollars, so color is never alone. */

import { money } from "@/lib/format";
import type { compounding } from "../figures";

type C = NonNullable<ReturnType<typeof compounding>>;
const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace(/\.5$/, "½"));
const yrs = (n: number) => fmt(n) + (n === 1 ? " year" : " years");

export function Compound({ C }: { C: C }) {
  const [now, stop, late] = C.curves, W = 100, H = 40;
  const max = Math.max(1, ...now.path), n = now.path.length;
  const d = (p: number[]) => p.map((v, i) => (i ? "L" : "M") + ((i / Math.max(1, n - 1)) * W).toFixed(2) + "," + (H - (v / max) * (H - 2) - 1).toFixed(2)).join("");
  const kept = stop.to - stop.from;
  const words = [
    { c: now, label: "Saved from " + fmt(now.from) + " to " + fmt(now.to) },
    { c: stop, label: "Stopped at " + fmt(stop.to) + ", after " + yrs(kept) },
    { c: late, label: "Started at " + fmt(late.from) + ", " + yrs(C.gap) + " late" },
  ];
  return (
    <div className="gd-cmp" role="img" aria-label={words.map((w) => w.label + ": " + money(w.c.fv) + " at " + fmt(now.to)).join(". ") + "."}>
      <svg className="gd-cmp-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        {words.map((w) => <path key={w.c.id} className={w.c.id} d={d(w.c.path)} vectorEffect="non-scaling-stroke" />)}
      </svg>
      <div className="gd-cmp-ax" aria-hidden="true"><span>{fmt(now.from)}</span><span>{fmt(now.to)}</span></div>
      <div className="gd-cmp-key" aria-hidden="true">
        {words.map((w) => (
          <span key={w.c.id}><svg className={"sw " + w.c.id} viewBox="0 0 20 4"><line x1="0" y1="2" x2="20" y2="2" /></svg>{w.label} <b>{money(w.c.fv)}</b></span>
        ))}
      </div>
    </div>
  );
}
