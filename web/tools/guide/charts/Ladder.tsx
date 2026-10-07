/* Lesson 13's figure: what a benefit pays a month at each claiming age,
   in today's dollars, for you and a spouse. The age the plan uses is named
   in words. */

import { money } from "@/lib/format";
import type { ladder } from "../figures";

type Rung = ReturnType<typeof ladder>[number];

export function Ladder({ groups }: { groups: { who: string; rows: Rung[]; claim: number }[] }) {
  const max = Math.max(1, ...groups.flatMap((g) => g.rows.map((r) => r.mo)));
  return (
    <div className="gd-lad">
      {groups.map((g) => (
        <div key={g.who} className="gd-lad-g" role="img"
          aria-label={g.who + ": " + g.rows.map((r) => money(r.mo) + " a month claiming at " + r.age).join(", ") + "."}>
          {groups.length > 1 ? <div className="who" aria-hidden="true">{g.who}</div> : null}
          {g.rows.map((r) => (
            <div key={r.age} className={"gd-lad-row" + (r.age === g.claim ? " on" : "")} aria-hidden="true">
              <span className="age">{r.age}</span>
              <span className="tr"><span className="bar" style={{ "--w": ((r.mo / max) * 100).toFixed(1) } as React.CSSProperties}></span></span>
              <span className="v"><b>{money(r.mo)}</b></span>
              <span className="pl">{r.age === g.claim ? <em>your plan</em> : null}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
