/* Lesson 9's figure: each of the five mixes, every ten years in a row
   since 1926, after inflation. A bar from the worst stretch to the best,
   a tick at the middle one, and a mark where the guide's assumption sits.
   The person's mix is named "yours" in words, not only drawn stronger. */

import type { MixHistory } from "../figures";

const pc = (v: number) => (v < 0 ? "−" : "") + Math.abs(v * 100).toFixed(1) + "%";

export function RangeBars({ H, cur }: { H: MixHistory[]; cur: number }) {
  const lo = Math.floor(Math.min(...H.map((h) => h.worst)) * 20) / 20, hi = Math.ceil(Math.max(...H.map((h) => h.best)) * 20) / 20;
  const x = (v: number) => (((v - lo) / (hi - lo)) * 100).toFixed(2);
  const ticks: number[] = [];
  for (let t = Math.ceil(lo * 20) / 20; t <= hi + 1e-9; t += 0.05) ticks.push(Math.round(t * 100) / 100);
  const label = H.map((h) => h.label + ": " + pc(h.worst) + " to " + pc(h.best) + " a year, middle " + pc(h.med) + ", the guide assumes " + pc(h.real)).join(". ");
  return (
    <div className="gd-rng" role="img" aria-label={"Ten-year stretches since " + H[0].first + ", a year after inflation. " + label + "."}>
      <div className="gd-rng-row head" aria-hidden="true">
        <span></span>
        <div className="tr">{ticks.map((t) => <span key={t} className="tk" style={{ "--x": x(t) } as React.CSSProperties}>{t === 0 ? "0%" : pc(t).replace(".0%", "%")}</span>)}</div>
      </div>
      {H.map((h, i) => (
        <div key={h.label} className={"gd-rng-row" + (i === cur ? " on" : "")} aria-hidden="true">
          <span className="nm"><b>{h.label}</b>{i === cur ? <em>yours</em> : null}</span>
          <div className="tr">
            <i className="zero" style={{ "--x": x(0) } as React.CSSProperties}></i>
            <span className="bar" style={{ "--a": x(h.worst), "--b": x(h.best) } as React.CSSProperties}></span>
            <i className="med" style={{ "--x": x(h.med) } as React.CSSProperties}></i>
            <i className="asm" style={{ "--x": x(h.real) } as React.CSSProperties}></i>
          </div>
        </div>
      ))}
      <div className="gd-rng-key" aria-hidden="true">
        <span><s className="bar"></s>Worst to best ten years</span><span><s className="med"></s>The middle one</span><span><s className="asm"></s>What the guide assumes</span>
      </div>
    </div>
  );
}
