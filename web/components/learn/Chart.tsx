"use client";

/* A lesson's chart, drawn from the data written into the lesson
   (content/lessons/README.md: line, area or grouped bars, up to four
   series, optional marks and a shaded band; bars and areas can stack, and
   bars can carry their values). Pointing at the chart reads off every
   series at that point. The same figures sit in a table for screen
   readers. The drawing is laid out at the width it's shown (up to 720),
   so its labels stay their real size on a phone. */

import { useEffect, useRef, useState } from "react";
import type { ChartSpec } from "@/lib/learn/lessons";

const TONE: Record<string, string> = {
  good: "var(--ds-gain)", bad: "var(--ds-loss)", accent: "var(--ds-amber)", neutral: "var(--ds-series-sky)", muted: "var(--ds-muted)",
};
const toneOf = (t: string | undefined, i: number) => TONE[t ?? ""] ?? [TONE.accent, TONE.neutral, TONE.good, TONE.muted][i % 4];

export function fmt(v: number, y: ChartSpec["y"], short = true): string {
  // Axis labels keep one decimal (a 12.5% gridline); a read-off value keeps two.
  if (y === "pct") return `${+(v * 100).toFixed(!short ? 2 : 1)}%`;
  if (y === "money") {
    const a = Math.abs(v), s = v < 0 ? "−" : "";
    if (!short) return s + "$" + Math.round(a).toLocaleString("en-US");
    if (a >= 1e6) return s + "$" + (a / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M";
    if (a >= 1e3) return s + "$" + Math.round(a / 1e3) + "K";
    return s + "$" + Math.round(a);
  }
  return Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("en-US") : String(+v.toFixed(2));
}

/** A tidy step for about `n` gridlines over a span. */
function niceStep(span: number, n = 5): number {
  const raw = span / n, p = Math.pow(10, Math.floor(Math.log10(raw)));
  return [1, 2, 2.5, 5, 10].map((k) => k * p).find((s) => span / s <= n) ?? raw;
}

export function Chart({ spec, label }: { spec: ChartSpec; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(720);
  const [hov, setHov] = useState<number | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.min(720, Math.round(e.contentRect.width)))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = Math.round(Math.max(220, (W * 300) / 720)), L = 58, R = 18, T = 16, B = 34;
  const n = spec.x.length, bars = spec.type === "bar";
  const xText = (x: number | string) => (typeof x === "number" && spec.xFormat ? fmt(x, spec.xFormat) : String(x));
  // Stacked: each series sits on the ones before it.
  const stack = !!spec.stack && spec.type !== "line";
  const base = spec.series.map((_, k) => spec.x.map((__, i) => (stack ? spec.series.slice(0, k).reduce((a, s) => a + (s.values[i] ?? 0), 0) : 0)));
  const total = (i: number) => spec.series.reduce((a, s) => a + (s.values[i] ?? 0), 0);
  const all = stack ? spec.x.map((_, i) => total(i)) : spec.series.flatMap((s) => s.values).filter((v): v is number => v != null);
  let lo = Math.min(0, ...all, ...(spec.levels ?? []).map((l) => l.y)), hi = Math.max(0, ...all, ...(spec.levels ?? []).map((l) => l.y));
  if (hi === lo) hi = lo + 1;
  const step = niceStep(hi - lo);
  lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step - 0.01) * step;   // shares that sum to 100.01% still top out at 100%
  const numeric = !bars && spec.x.every((x) => typeof x === "number");
  const x0 = numeric ? (spec.x[0] as number) : 0, x1 = numeric ? (spec.x[n - 1] as number) : n - 1;
  const slot = (W - L - R) / n;
  const X = (i: number) => bars ? L + slot * (i + 0.5) : numeric ? L + (((spec.x[i] as number) - x0) / (x1 - x0 || 1)) * (W - L - R) : L + (i / Math.max(1, n - 1)) * (W - L - R);
  const Xv = (v: number | string) => {
    if (numeric && typeof v === "number") return L + ((v - x0) / (x1 - x0 || 1)) * (W - L - R);
    const i = spec.x.findIndex((x) => String(x) === String(v));
    return i >= 0 ? X(i) : null;
  };
  const Y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);

  // X labels: every bar's, else about seven evenly spaced.
  const widest = Math.max(...spec.x.map((x) => xText(x).length)) * 6.6 + 10;
  const every = bars ? Math.max(1, Math.ceil(widest / slot)) : Math.max(1, Math.ceil(n / (W < 480 ? 4 : 7)));
  const xl = spec.x.map((_, i) => i).filter((i) => i % every === 0 || (i === n - 1 && i % every >= every / 2));

  const paths = spec.series.map((s, k) => {
    const pts = s.values.map((v, i) => (v == null ? null : [X(i), Y(v + base[k][i])] as const));
    let d = "", prevY: number | null = null;
    pts.forEach((p) => {
      if (!p) { prevY = null; return; }
      // A step series holds each value until the next point, then jumps.
      if (prevY != null && s.step) d += "L" + p[0].toFixed(1) + " " + prevY.toFixed(1);
      d += (prevY != null ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1);
      prevY = p[1];
    });
    const first = pts.find(Boolean), last = [...pts].reverse().find(Boolean);
    // A stacked area closes along the top of the series under it.
    const under = stack && k > 0 ? spec.x.map((_, i) => i).reverse().filter((i) => s.values[i] != null).map((i) => `L${X(i).toFixed(1)} ${Y(base[k][i]).toFixed(1)}`).join("") + "Z" : null;
    const area = spec.type === "area" && first && last ? d + (under ?? `L${last[0].toFixed(1)} ${Y(Math.max(lo, 0)).toFixed(1)}L${first[0].toFixed(1)} ${Y(Math.max(lo, 0)).toFixed(1)}Z`) : null;
    return { d, area, color: toneOf(s.tone, k), dash: s.dash };
  });
  const cols = stack ? 1 : spec.series.length;
  const bw = Math.min(stack ? 44 : 28, (slot * 0.72) / cols);
  // Values over the bars, where a bar is wide enough to hold one.
  const labels = bars && !!spec.labels && (stack ? slot : bw) >= 30;

  const point = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect(), px = ((e.clientX - r.left) * W) / r.width;
    let best = 0;
    for (let i = 1; i < n; i++) if (Math.abs(X(i) - px) < Math.abs(X(best) - px)) best = i;
    setHov(best);
  };
  const tipRight = hov != null && X(hov) > W / 2;

  return (
    <div className="lrn-chart" ref={box}>
      {spec.series.length > 1 ? (
        <div className="lrn-legend">
          {spec.series.map((s, k) => <span key={s.name}><i className={bars ? "bar" : s.dash ? "dash" : undefined} style={{ "--c": toneOf(s.tone, k) } as React.CSSProperties} />{s.name}</span>)}
        </div>
      ) : null}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} onPointerMove={point} onPointerDown={point} onPointerLeave={() => setHov(null)}>
        {spec.band ? (() => {
          const a = Xv(spec.band.from), b = Xv(spec.band.to);
          if (a == null || b == null) return null;
          // Centred over the band, unless that would run past the axis or the edge.
          const half = (spec.band.label?.length ?? 0) * 3.3, mid = (a + b) / 2;
          const [lx, anchor]: [number, "start" | "end" | "middle"] = mid - half < L + 2 ? [Math.max(a, L) + 4, "start"] : mid + half > W - R ? [Math.min(b, W - R) - 4, "end"] : [mid, "middle"];
          return <g><rect className="lrn-band" x={a} y={T} width={b - a} height={H - T - B} />{spec.band.label ? <text className="lrn-bandl" x={lx} y={T + 13} textAnchor={anchor}>{spec.band.label}</text> : null}</g>;
        })() : null}
        <g className="lrn-grid">
          {Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => lo + i * step).map((v) => (
            <g key={v}><line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} className={v === 0 ? "zero" : undefined} /><text x={L - 8} y={Y(v) + 4} textAnchor="end">{fmt(v, spec.y)}</text></g>
          ))}
          {xl.map((i) => <text key={i} x={X(i)} y={H - 12} textAnchor="middle">{xText(spec.x[i])}</text>)}
          {spec.xLabel ? <text x={W - R} y={H - 0} textAnchor="end" className="lrn-xl">{spec.xLabel}</text> : null}
        </g>
        {bars && hov != null ? <rect className="lrn-hovslot" x={L + slot * hov} y={T} width={slot} height={H - T - B} /> : null}
        {bars
          ? spec.series.map((s, k) => s.values.map((v, i) => v == null ? null : (
            <rect key={`${k}-${i}`} x={stack ? X(i) - bw / 2 : X(i) - (bw * cols) / 2 + bw * k} width={stack ? bw : bw - 2}
              y={Math.min(Y(v + base[k][i]), Y(base[k][i]))} height={Math.max(0, Math.abs(Y(v + base[k][i]) - Y(base[k][i])) - (stack && k > 0 ? 1 : 0))} rx={2} fill={toneOf(s.tone, k)} />
          )))
          : paths.map((p, k) => (
            <g key={k}>
              {p.area ? <path d={p.area} fill={p.color} opacity={0.14} /> : null}
              <path d={p.d} fill="none" stroke={p.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={p.dash ? "2 5" : undefined} />
            </g>
          ))}
        {labels ? (stack
          ? spec.x.map((_, i) => <text key={i} className="lrn-barl" x={X(i)} y={Y(total(i)) - 5} textAnchor="middle">{fmt(total(i), spec.y)}</text>)
          : spec.series.map((s, k) => s.values.map((v, i) => v == null ? null : (
            <text key={`${k}-${i}`} className="lrn-barl" x={X(i) - (bw * cols) / 2 + bw * k + (bw - 2) / 2} y={v < 0 ? Y(v) + 13 : Y(v) - 5} textAnchor="middle">{fmt(v, spec.y)}</text>
          )))) : null}
        {!bars && hov != null ? (
          <g className="lrn-hov">
            <line x1={X(hov)} x2={X(hov)} y1={T} y2={H - B} />
            {spec.series.map((s, k) => s.values[hov] == null ? null : <circle key={k} cx={X(hov)} cy={Y((s.values[hov] as number) + base[k][hov])} r={4} fill={toneOf(s.tone, k)} />)}
          </g>
        ) : null}
        {(spec.levels ?? []).map((l, i) => (
          <g key={i} className="lrn-level"><line x1={L} x2={W - R} y1={Y(l.y)} y2={Y(l.y)} />{l.label ? <text x={W - R - 4} y={Y(l.y) - 5} textAnchor="end">{l.label}</text> : null}</g>
        ))}
        {(spec.marks ?? []).map((m, i) => {
          const x = Xv(m.x);
          if (x == null) return null;
          // A row lower when the band has a label, so the two don't run together.
          const y = T + 12 + (i + (spec.band?.label ? 1 : 0)) * 15, right = x > W - R - 130;
          return <g key={i} className="lrn-mark"><line x1={x} x2={x} y1={y + 4} y2={H - B} /><text x={right ? x - 5 : x + 5} y={y} textAnchor={right ? "end" : "start"}>{m.label}</text></g>;
        })}
      </svg>
      {hov != null ? (
        <div className="lrn-tip" aria-hidden="true" data-side={tipRight ? "right" : "left"} style={{ "--at": `${(tipRight ? 1 - (X(hov) - 10) / W : (X(hov) + 10) / W) * 100}%` } as React.CSSProperties}>
          <b>{spec.xLabel && typeof spec.x[hov] === "number" ? `${spec.xLabel}: ` : ""}{xText(spec.x[hov])}</b>
          {spec.series.map((s, k) => s.values[hov] == null ? null : (
            <span key={s.name}><i style={{ "--c": toneOf(s.tone, k) } as React.CSSProperties} />{s.name}<em>{fmt(s.values[hov] as number, spec.y, false)}</em></span>
          ))}
          {stack && spec.series.filter((s) => s.values[hov] != null).length > 1 ? <span className="tot">Total<em>{fmt(total(hov), spec.y, false)}</em></span> : null}
        </div>
      ) : null}
      {/* A table ignores the hidden box's size, so the box is a div around it. */}
      <div className="sr-only"><table>
        <caption>{label}</caption>
        <thead><tr><th>{spec.xLabel ?? ""}</th>{spec.series.map((s) => <th key={s.name}>{s.name}</th>)}</tr></thead>
        <tbody>{spec.x.map((x, i) => <tr key={i}><th>{xText(x)}</th>{spec.series.map((s) => <td key={s.name}>{s.values[i] == null ? "" : fmt(s.values[i] as number, spec.y, false)}</td>)}</tr>)}</tbody>
      </table></div>
    </div>
  );
}
