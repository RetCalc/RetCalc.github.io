"use client";

/* A scatter: one dot per point, labeled where a label fits, with optional
   dashed reference lines and era markers. Hover (or touch) shows the nearest
   dot within reach. From ddScatter() and ddScatterTips() in
   src/js/app/15b-drawdown-views.js. */

import { ChartFrame, MONO, type ChartSize } from "./ChartFrame";
import { useNarrow } from "./useNarrow";
import { fmtNum } from "@/lib/format";
import { SERIES } from "@/lib/hues";

export interface ScatterPoint {
  x: number; y: number;
  label?: string | null;
  /** The plan's own point: gold, larger, labeled first. */
  cur?: boolean;
  /** Didn't meet the mark: a hollow coral ring. */
  miss?: boolean;
  color?: string;
}

interface Opts {
  xFmt?: (v: number) => string; yFmt?: (v: number) => string;
  xLabel?: string; yLabel?: string | null;
  /** Start the value axis at zero. */
  yZero?: boolean; xMin?: number;
  hLine?: { y: number; label: string } | null; vLine?: { x: number; label: string } | null;
  marks?: { x: number; label: string }[] | null;
  /** Many points: smaller, fainter dots. */
  small?: boolean;
}

/* Round gridlines for any range: about four steps of 1, 2, 2.5 or 5 times
   a power of ten. A range too narrow to read is widened around its middle. */
export function roundAxis(lo: number, hi: number) {
  if (!(hi > lo)) {
    const c = hi || 1;
    lo = c - Math.abs(c) * 0.05 - 1;
    hi = c + Math.abs(c) * 0.05 + 1;
  }
  const raw = (hi - lo) / 4, mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
  const min = Math.floor(lo / step + 1e-9) * step, max = Math.ceil(hi / step - 1e-9) * step, ticks: number[] = [];
  for (let v = min; v <= max + step / 2; v += step) ticks.push(Math.abs(v) < step / 1e6 ? 0 : v);
  return { min, max, ticks };
}

export function Scatter<P extends ScatterPoint>({ id, pts, opt = {}, ariaLabel, tip, onPick }: {
  id: string; pts: P[]; opt?: Opts; ariaLabel: string; tip: (p: P) => React.ReactNode; onPick?: (p: P) => void;
}) {
  const narrow = useNarrow();
  const W = narrow ? 470 : 900, H = narrow ? 420 : 360, L = narrow ? 62 : 78, R = narrow ? 14 : 18, T = 14, B = narrow ? 48 : 42;
  const fs = narrow ? 14 : 11, sw = narrow ? 1.6 : 1, pw = W - L - R, ph = H - T - B;
  const size: ChartSize = { narrow, W, H, L, Rp: R, T, B, fs, sw, pw, ph };
  const live = pts.filter((p) => p.x != null && p.y != null && isFinite(p.x) && isFinite(p.y));
  if (!live.length) return <ChartFrame id={id} ariaLabel={ariaLabel} size={size} tip={() => null}>{() => null}</ChartFrame>;

  const xs = live.map((p) => p.x), ys = live.map((p) => p.y);
  if (opt.vLine) xs.push(opt.vLine.x);
  if (opt.hLine) ys.push(opt.hLine.y);
  const xmin = opt.xMin != null ? opt.xMin : Math.min(...xs), xmax = Math.max(...xs);
  const pad = (xmax - xmin) * 0.06 || Math.abs(xmax) * 0.05 || 1;
  const AXx = roundAxis(opt.xMin != null ? opt.xMin : xmin - pad, xmax + pad);
  const ymin = Math.min(...ys), ymax = Math.max(...ys);
  const AXy = roundAxis(opt.yZero ? Math.min(0, ymin) : ymin - (ymax - ymin) * 0.08, ymax + (ymax - ymin) * 0.06);
  const X = (v: number) => L + ((v - AXx.min) / ((AXx.max - AXx.min) || 1)) * pw;
  const Y = (v: number) => T + ph - ((v - AXy.min) / ((AXy.max - AXy.min) || 1)) * ph;
  /* Rounded so the server's markup and the browser's match exactly: the two
     compute the last few digits differently, which React flags. */
  const at = live.map((p) => ({ p, px: Math.round(X(p.x) * 100) / 100, py: Math.round(Y(p.y) * 100) / 100 }));

  // Labels: each takes the first spot beside its dot (right, left, above,
  // below, then further out) that clears the labels already placed and the
  // dots; the plan's own goes first.
  const cw = fs * 0.58, boxes = at.map((a) => ({ x0: a.px - 6, x1: a.px + 6, y0: a.py - 6, y1: a.py + 6 }));
  const clear = (b: { x0: number; x1: number; y0: number; y1: number }) =>
    !(b.x0 < L || b.x1 > W - R || b.y0 < T || b.y1 > T + ph) && boxes.every((q) => !(b.x0 < q.x1 && b.x1 > q.x0 && b.y0 < q.y1 && b.y1 > q.y0));
  const labels: { x: number; y: number; text: string; cur?: boolean }[] = [];
  at.slice().sort((a, b) => (b.p.cur ? 1 : 0) - (a.p.cur ? 1 : 0)).forEach((a) => {
    if (!a.p.label) return;
    const w = a.p.label.length * cw, h = fs, g = 8 * sw;
    const tries = [[g, -h / 2], [-g - w, -h / 2], [-w / 2, -g - h], [-w / 2, g], [g, -h * 1.6], [g, h * 0.6],
      [-g - w, -h * 1.6], [-g - w, h * 0.6], [-w / 2, -g - h * 2.2], [-w / 2, g + h * 1.2]];
    for (const [dx, dy] of tries) {
      const b = { x0: a.px + dx, y0: a.py + dy, x1: a.px + dx + w, y1: a.py + dy + h };
      if (clear(b)) {
        boxes.push(b);
        labels.push({ x: b.x0, y: b.y1 - 2, text: a.p.label, cur: a.p.cur });
        return;
      }
    }
  });

  const text = (x: number, y: number, t: string, attrs: React.SVGProps<SVGTextElement> = {}, key?: string | number) => (
    <text key={key} x={x} y={y} fontSize={fs} fill="var(--axis)" fontFamily={MONO} {...attrs}>{t}</text>
  );

  return (
    <ChartFrame id={id} ariaLabel={ariaLabel} size={size} tip={(i) => tip(at[i].p)} onPick={onPick ? (i) => onPick(at[i].p) : undefined}
      pick={(vx, vy, k) => {
        let best = -1, bd = 1e9;
        at.forEach((a, i) => {
          const dd = (a.px - vx) ** 2 + (a.py - vy) ** 2;
          if (dd < bd) { bd = dd; best = i; }
        });
        // within about 50 pixels on screen
        return best >= 0 && bd <= 2500 * k * k ? best : null;
      }}>
      {(hi) => (
        <>
          {AXy.ticks.map((v) => (
            <g key={"y" + v}>
              <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="var(--grid)" strokeWidth={sw} />
              {text(L - 8, Y(v) + fs / 3, (opt.yFmt || fmtNum)(v), { textAnchor: "end" })}
            </g>
          ))}
          {AXx.ticks.map((v) => (
            <g key={"x" + v}>
              <line x1={X(v)} x2={X(v)} y1={T} y2={T + ph} stroke="var(--grid)" strokeWidth={sw * 0.7} opacity={0.6} />
              {text(X(v), T + ph + fs + 6, (opt.xFmt || fmtNum)(v), { textAnchor: "middle" })}
            </g>
          ))}
          {opt.xLabel ? text(W - R, H - 4, opt.xLabel, { textAnchor: "end", fontSize: fs * 0.9 }) : null}
          {opt.yLabel ? text(L + 4, T + fs, opt.yLabel, { fontSize: fs * 0.9 }) : null}
          {opt.hLine ? <>
            <line x1={L} x2={W - R} y1={Y(opt.hLine.y)} y2={Y(opt.hLine.y)} stroke={SERIES.plan} strokeWidth={1.4 * sw} strokeDasharray="6 5" opacity={0.8} />
            {text(W - R - 4, Y(opt.hLine.y) - 5, opt.hLine.label, { textAnchor: "end", style: { fill: SERIES.plan }, fontSize: fs * 0.9 })}
          </> : null}
          {opt.vLine ? <>
            <line x1={X(opt.vLine.x)} x2={X(opt.vLine.x)} y1={T} y2={T + ph} stroke={SERIES.plan} strokeWidth={1.4 * sw} strokeDasharray="6 5" opacity={0.8} />
            {text(X(opt.vLine.x) - 5, T + fs + 14, opt.vLine.label, { textAnchor: "end", style: { fill: SERIES.plan }, fontSize: fs * 0.9 })}
          </> : null}
          {(opt.marks || []).filter((m) => m.x >= AXx.min && m.x <= AXx.max).map((m) => (
            <g key={"m" + m.x}>
              <line x1={X(m.x)} x2={X(m.x)} y1={T + fs + 4} y2={T + ph} stroke="var(--axis)" strokeWidth={sw} strokeDasharray="3 4" opacity={0.55} />
              {text(X(m.x), T + fs, m.label, { textAnchor: "middle", fontSize: fs * 0.9 })}
            </g>
          ))}
          {at.map(({ p, px, py }, i) => {
            const color = p.cur ? SERIES.plan : p.miss ? SERIES.loss : p.color || SERIES.gain;
            return <circle key={i} cx={px} cy={py} r={(opt.small ? 2.6 : p.cur ? 6.5 : 5) * sw}
              fill={p.miss ? "none" : color} stroke={p.miss ? color : "var(--dotstroke)"}
              strokeWidth={(p.miss ? 1.8 : 1.5) * sw} opacity={opt.small ? 0.55 : 1} />;
          })}
          {labels.map((l, i) => text(l.x, l.y, l.text, { style: { fill: l.cur ? SERIES.plan : "var(--dim)" }, fontSize: fs * 0.95, fontWeight: l.cur ? 600 : 400 }, "l" + i))}
          <circle cx={hi != null ? at[hi].px : 0} cy={hi != null ? at[hi].py : 0} r={9 * sw} fill="none" stroke={SERIES.plan} strokeWidth={1.6 * sw} opacity={hi != null ? 1 : 0} />
        </>
      )}
    </ChartFrame>
  );
}
