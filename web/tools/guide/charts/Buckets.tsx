/* Lesson 10's figure: the savings in their three tax buckets, each box
   with its dollars, its share and how it's taxed. */

import { money, pctStr } from "@/lib/format";
import type { buckets } from "../figures";

export function Buckets({ B }: { B: ReturnType<typeof buckets> }) {
  return (
    <div className="gd-bkt">
      {B.map((b) => (
        <div key={b.id} className={"gd-bkt-box " + b.id}>
          <div className="nm">{b.name}</div>
          <div className="v">{money(b.v)}</div>
          <div className="sh" role="img" aria-label={pctStr(b.share, 0) + " of your savings"}><span style={{ "--w": (b.share * 100).toFixed(1) } as React.CSSProperties}></span></div>
          <div className="tx">{pctStr(b.share, 0)} · {b.tax}</div>
        </div>
      ))}
    </div>
  );
}
