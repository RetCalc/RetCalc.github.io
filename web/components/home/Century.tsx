"use client";

/* The hero's picture: every calendar year of the stock market since 1926,
   after inflation, up in green and down in red. Point at (or tap) a year for
   its return and, for the years people remember, what happened. The bars
   grow in once as the page opens; reduced motion shows them as they end.
   The bars stretch with the page's width, so the year marks are HTML under
   the chart and keep their size on a phone. */

import { useState } from "react";

/* What happened, for the years people know by name. Checked against the
   returns: 2008 is the worst year on record, 1933 the best. */
const EVENTS: Record<number, string> = {
  1929: "The Great Crash begins", 1931: "Deep in the Depression", 1933: "The best year on record",
  1937: "The 1937 relapse", 1954: "The postwar boom", 1966: "A long flat stretch begins",
  1974: "The oil-shock bear market", 1987: "Black Monday", 1995: "The 1990s boom",
  2000: "The dot-com bust begins", 2008: "The financial crisis, the worst year on record",
  2020: "The pandemic year", 2022: "Inflation returns",
};

const W = 1000, H = 260;

export function Century({ start, real }: { start: number; real: number[] }) {
  const [at, setAt] = useState<number | null>(null);
  const n = real.length, end = start + n - 1;
  const top = Math.max(...real.map((v) => Math.abs(v)));
  const base = H / 2, k = (H / 2 - 4) / top, bw = W / n;
  const marks = [start, 1950, 1975, 2000, end];
  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.floor(((e.clientX - r.left) / r.width) * n);
    setAt(i >= 0 && i < n ? i : null);
  };
  const v = at == null ? 0 : real[at];
  return (
    <figure className="hm-century" data-on={at != null ? "" : undefined}>
      <div className="hm-cbars">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img"
          aria-label={`Stock returns after inflation, each year from ${start} to ${end}: ${real.filter((x) => x >= 0).length} years up, ${real.filter((x) => x < 0).length} down`}
          onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setAt(null)}>
          {real.map((x, i) => {
            const h = Math.max(1, Math.abs(x) * k);
            return <rect key={i} className={(x >= 0 ? "up" : "down") + (i === at ? " on" : "")} x={i * bw + bw * 0.14} width={bw * 0.72}
              y={x >= 0 ? base - h : base} height={h} style={{ "--i": i } as React.CSSProperties} />;
          })}
        </svg>
        {at != null ? (
          <div className="hm-ctip" style={{ "--x": `${((at + 0.5) / n) * 100}%`, "--y": `${((v >= 0 ? base - Math.abs(v) * k : base) / H) * 100}%` } as React.CSSProperties}>
            <b>{start + at} · {v > 0 ? "+" : v < 0 ? "−" : ""}{Math.abs(v).toFixed(1)}%</b>
            {EVENTS[start + at] ?? (v >= 0 ? "A year up" : "A year down")}
          </div>
        ) : null}
      </div>
      <div className="hm-cyears" aria-hidden="true">
        {marks.map((y) => <span key={y} style={{ "--x": `${((y - start + 0.5) / n) * 100}%` } as React.CSSProperties}>{y}</span>)}
      </div>
      <figcaption>
        <span className="hm-ckey"><i className="up" />Years up<i className="down" />Years down</span>
        Every year of the stock market since {start}, after inflation. Your plan is tested against all of them.
      </figcaption>
    </figure>
  );
}
