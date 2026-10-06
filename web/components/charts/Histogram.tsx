"use client";

/* A histogram: one bar per bin of round width, with an optional dashed line
   at a value (the comfort line). From ddBars() in
   src/js/app/15b-drawdown-views.js. */

import { ChartFrame, MONO, type ChartSize } from "./ChartFrame";
import { fmtAxisMoney, niceAxis } from "./scale";
import { useNarrow } from "./useNarrow";
import { fmtNum } from "@/lib/format";
import { SERIES } from "@/lib/hues";

export interface Bin { lo: number; hi: number; n: number }

/** Bins of a round width (1, 2, 2.5 or 5 times a power of ten, about 24 of
    them) starting on a multiple of it, so a bar reads $5,750,000 to
    $6,000,000 rather than wherever the smallest value happened to fall. */
export function roundBins(sorted: number[]): Bin[] {
  const n = sorted.length, hi = sorted[n - 1];
  // Values that differ only by rounding are one value (the old page's axis
  // code ran away on those).
  const spread = hi - sorted[0] > Math.abs(hi) * 1e-9 ? hi - sorted[0] : 0;
  const raw = spread / 24 || Math.max(1, Math.abs(hi) * 0.01);
  const mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
  const w = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
  const lo = Math.floor(sorted[0] / w) * w, bins = Math.max(1, Math.floor((hi - lo) / w) + 1), counts = new Array(bins).fill(0);
  for (const v of sorted) counts[Math.min(bins - 1, Math.floor((v - lo) / w + 1e-9))]++;
  return counts.map((c, i) => ({ lo: lo + i * w, hi: lo + (i + 1) * w, n: c }));
}

export function Histogram({ id, bins, mark, ariaLabel, tip }: {
  id: string; bins: Bin[]; mark: number | null; ariaLabel: string; tip: (b: Bin) => React.ReactNode;
}) {
  const narrow = useNarrow();
  const W = narrow ? 470 : 900, H = narrow ? 340 : 300, L = narrow ? 50 : 60, R = narrow ? 12 : 14, T = 12, B = narrow ? 44 : 38;
  const fs = narrow ? 15 : 11, pw = W - L - R, ph = H - T - B;
  const size: ChartSize = { narrow, W, H, L, Rp: R, T, B, fs, sw: 1, pw, ph };
  if (!bins.length) return <ChartFrame id={id} ariaLabel={ariaLabel} size={size} tip={() => null}>{() => null}</ChartFrame>;
  const AX = niceAxis(0, Math.max(...bins.map((b) => b.n)) || 1);
  const x0 = bins[0].lo, x1 = bins[bins.length - 1].hi, span = (x1 - x0) || 1;
  const X = (v: number) => L + ((v - x0) / span) * pw, Y = (v: number) => T + ph - (v / AX.max) * ph;
  const gap = Math.max(1, (pw / bins.length) * 0.12);
  const ax = niceAxis(x0, x1);
  const label = (x: number, y: number, t: string, anchor: "end" | "middle", key: string | number) => (
    <text key={key} x={x} y={y} textAnchor={anchor} fontSize={fs} fill="var(--axis)" fontFamily={MONO}>{t}</text>
  );
  return (
    <ChartFrame id={id} ariaLabel={ariaLabel} size={size} tip={(i) => tip(bins[i])}
      pick={(vx) => {
        const i = bins.findIndex((b) => vx >= X(b.lo) && vx <= X(b.hi));
        return i >= 0 ? i : null;
      }}>
      {(hi) => (
        <>
          {AX.ticks.map((v) => (
            <g key={"y" + v}>
              <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="var(--grid)" strokeWidth={1} />
              {label(L - 8, Y(v) + fs / 3, fmtNum(v), "end", "t")}
            </g>
          ))}
          {bins.map((b, i) => (b.n ? (
            <rect key={i} x={X(b.lo) + gap / 2} y={Y(b.n)} width={Math.max(1, X(b.hi) - X(b.lo) - gap)} height={Math.max(0, T + ph - Y(b.n))}
              fill={SERIES.teal} opacity={0.72} rx={2} />
          ) : null))}
          {ax.ticks.filter((v) => v >= x0 - 1e-9 && v <= x1 + 1e-9).map((v) => label(X(v), H - (narrow ? 14 : 12), fmtAxisMoney(v), "middle", "x" + v))}
          {mark != null && mark >= x0 && mark <= x1 ? <>
            <line x1={X(mark)} x2={X(mark)} y1={T} y2={T + ph} stroke={SERIES.guide} strokeWidth={1.5} strokeDasharray="5 4" />
            <text x={X(mark) + 5} y={T + fs} fontSize={fs * 0.92} fill={SERIES.guide} fontFamily={MONO}>comfort line</text>
          </> : null}
          <rect x={hi != null ? X(bins[hi].lo) : 0} y={T} width={hi != null ? Math.max(1, X(bins[hi].hi) - X(bins[hi].lo)) : 0} height={ph}
            fill="var(--ds-text)" opacity={hi != null ? 0.1 : 0} rx={2} />
        </>
      )}
    </ChartFrame>
  );
}
