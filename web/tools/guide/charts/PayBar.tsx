/* Lesson 2's figure: where a month's pay goes, by the 2026 rules, before
   anything taken out for a 401(k) or health insurance. One stacked bar and
   its key, each part named with its dollars (color is never alone). */

import { money } from "@/lib/format";

export function PayBar({ P }: { P: { gross: number; federal: number; state: number; fica: number; net: number } }) {
  const parts = [
    { k: "net", label: "Take-home", v: P.net }, { k: "fed", label: "Federal tax", v: P.federal },
    { k: "st", label: "State tax", v: P.state }, { k: "fica", label: "Social Security and Medicare", v: P.fica },
  ].filter((p) => p.v > 0.5);
  const pct = (v: number) => ((v / Math.max(1, P.gross)) * 100).toFixed(2);
  return (
    <div className="gd-pay">
      <div className="gd-pay-bar" role="img" aria-label={"Of " + money(P.gross) + " a month: " + parts.map((p) => p.label.toLowerCase() + " " + money(p.v)).join(", ")}>
        {parts.map((p) => <span key={p.k} className={p.k} style={{ "--w": pct(p.v) } as React.CSSProperties}></span>)}
      </div>
      <div className="gd-pay-key" aria-hidden="true">
        {parts.map((p) => <span key={p.k}><s className={p.k}></s>{p.label} <b>{money(p.v)}</b></span>)}
        <span className="of">of {money(P.gross)} a month</span>
      </div>
    </div>
  );
}
