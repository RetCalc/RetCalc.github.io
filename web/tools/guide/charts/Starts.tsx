/* Lesson 15's figure: the same plan started in three different years, its
   balance by age from the engine's own paths. Lines differ by dash too, and
   the key says how each ended, in words. */

import { money } from "@/lib/format";
import type { Start } from "../figures";

export function Starts({ list, retire }: { list: Start[]; retire: number }) {
  const W = 100, H = 40, n = Math.max(...list.map((s) => s.path.length));
  const max = Math.max(1, ...list.flatMap((s) => s.path));
  const d = (p: number[]) => p.map((v, i) => (i ? "L" : "M") + ((i / Math.max(1, n - 1)) * W).toFixed(2) + "," + (H - (v / max) * (H - 2) - 1).toFixed(2)).join("");
  const how = (s: Start) => (s.out != null ? "ran out at " + s.out : money(s.end) + " left at " + (retire + n - 1));
  return (
    <div className="gd-curves gd-starts" role="img" aria-label={"Your plan's savings by age from " + retire + ": " + list.map((s) => s.label + ", " + how(s)).join("; ") + "."}>
      <svg className="gd-curves-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        {list.map((s) => <path key={s.id} className={s.id} d={d(s.path)} vectorEffect="non-scaling-stroke" />)}
      </svg>
      <div className="gd-curves-ax" aria-hidden="true"><span>{retire}</span><span>{retire + n - 1}</span></div>
      <div className="gd-curves-key" aria-hidden="true">
        {list.map((s) => <span key={s.id}><svg className={"sw " + s.id} viewBox="0 0 20 4"><line x1="0" y1="2" x2="20" y2="2" /></svg>{s.label}: <b>{how(s)}</b></span>)}
      </div>
    </div>
  );
}
