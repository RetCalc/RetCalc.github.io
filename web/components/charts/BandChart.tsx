"use client";

/* The site's main chart: one line (the plan, ending in the logo's arrowhead)
   inside a shaded band, a higher and a lower line at the band's edges, or
   percentile fans for market-history and Monte Carlo runs. Hover, or touch
   and drag on a phone, shows the year under the pointer. Ported from
   paintChart(), attachChart() and chartTouch() in src/js/app/04-charts.js,
   drawn by React instead of by hand; colors come from the theme's CSS
   variables, so it follows a theme switch. */

import { useId } from "react";
import { ChartFrame, HoverMarks, MONO, pathD, XAxis, YAxis, useChartSize, valueScale } from "./ChartFrame";

export interface BandPoint {
  year: number;
  base: number;
  hi?: number;
  lo?: number;
  p75?: number;
  p25?: number;
  det?: number;
  [extra: string]: unknown;
}

interface Props<P extends BandPoint> {
  id: string;
  pts: P[];
  maxX: number;
  mode?: "band" | "mc";
  ariaLabel: string;
  /** The tooltip for the point under the pointer. */
  tip: (p: P) => React.ReactNode;
  stageMarks?: { year: number; label: string }[];
  xOffset?: number;
  overlay?: { pts: { year: number; value: number }[]; color?: string; dash?: string; width?: number }[];
  traces?: { xs: number[]; lines: (number | null)[][] };
  noLoLine?: boolean;
  /** Dots on the higher and lower lines and a marker on the year axis. */
  enhanced?: boolean;
  /** Extra marks drawn on top (a target line, say), placed with the chart's own scales. */
  extras?: (g: ChartGeometry) => React.ReactNode;
}

/** The chart's scales and frame, for drawing extra marks on it. */
export interface ChartGeometry {
  X: (year: number) => number; Y: (value: number) => number;
  W: number; T: number; ph: number; narrow: boolean; minY: number; maxY: number;
}


export function BandChart<P extends BandPoint>(props: Props<P>) {
  const { id, pts, maxX, mode = "band", ariaLabel, tip, stageMarks = [], xOffset = 0, overlay = [], traces, noLoLine, enhanced, extras } = props;
  const size = useChartSize();
  const uid = useId().replace(/:/g, "");
  const { narrow, W, T, B, L, pw, ph, fs, sw } = size;

  const vals: number[] = [];
  for (const a of pts) {
    vals.push(a.base);
    if (a.hi != null) vals.push(a.hi);
    if (a.lo != null) vals.push(a.lo);
    if (a.det != null) vals.push(a.det);
  }
  // A comparison line counts toward the axis, so it never runs off the top.
  for (const ov of overlay) for (const p of ov.pts) vals.push(p.value);
  const { AX, Y } = valueScale(size, vals.length ? vals : [0]);
  const X = (y: number) => L + (y / (maxX || 1)) * pw;

  const line = (f: (a: P) => number) => pathD(pts.map((a) => [X(a.year), Y(f(a))]));
  const ribbon = (top: (a: P) => number, bot: (a: P) => number) =>
    pathD([...pts.map((a) => [X(a.year), Y(top(a))] as [number, number]), ...pts.toReversed().map((a) => [X(a.year), Y(bot(a))] as [number, number])]) + "Z";
  const g = (name: string) => `${name}${uid}`;

  return (
    <ChartFrame id={id} ariaLabel={ariaLabel} size={size} xs={pts.map((a) => X(a.year))} tip={(i) => tip(pts[i])}
      fadeIn={enhanced}>
      {(hi) => {
        const best = hi != null ? pts[hi] : null;
        const bx = best ? X(best.year) : null;
        return (
          <>
            <defs>
              {([["fanOuter", .16, .02], ["fanInner", .30, .06], ["bandFill", .20, .05]] as const).map(([name, a, b]) => (
                <linearGradient key={name} id={g(name)} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-dark-jade)" stopOpacity={a} />
                  <stop offset="100%" stopColor="var(--color-dark-jade)" stopOpacity={b} />
                </linearGradient>
              ))}
              {/* The plan's own line ends in the logo's arrowhead. */}
              <marker id={g("tip")} viewBox="0 0 10 10" refX="6.5" refY="5" markerWidth="4.2" markerHeight="4.2" orient="auto">
                <path d="M0 .6 L10 5 L0 9.4 L2.6 5 Z" fill="var(--gold)" />
              </marker>
              {traces?.lines.length ? <clipPath id={g("trc")}><rect x={L} y={T} width={pw} height={ph} /></clipPath> : null}
            </defs>

            <YAxis size={size} ticks={AX.ticks} Y={Y} />
            <XAxis size={size} count={maxX} X={X} label={(y) => y + xOffset} />

            {/* Every starting year as its own faint line, under the shading. */}
            {traces?.lines.length ? (
              <g clipPath={`url(#${g("trc")})`} fill="none" stroke="var(--steel)" strokeLinejoin="round" className="traces"
                strokeOpacity={traces.lines.length > 400 ? .055 : traces.lines.length > 60 ? .13 : .18} strokeWidth={.9 * sw}>
                {traces.lines.map((ln, k) => {
                  const at: [number, number][] = [];
                  for (let i = 0; i < traces.xs.length && i < ln.length; i++) {
                    const val = ln[i];
                    if (val != null && isFinite(val)) at.push([X(traces.xs[i]), Y(val)]);
                  }
                  return at.length ? <path key={k} d={pathD(at)} /> : null;
                })}
              </g>
            ) : null}

            {mode === "mc" ? (
              <>
                <path d={ribbon((a) => a.hi!, (a) => a.lo!)} fill={`url(#${g("fanOuter")})`} />
                <path d={ribbon((a) => a.p75!, (a) => a.p25!)} fill={`url(#${g("fanInner")})`} />
              </>
            ) : (
              <path d={ribbon((a) => a.hi!, (a) => a.lo!)} fill={`url(#${g("bandFill")})`} />
            )}

            {stageMarks.map((m) => (
              <g key={m.year}>
                <line x1={X(m.year)} x2={X(m.year)} y1={T} y2={T + ph} stroke="var(--stageline)" strokeWidth={sw} strokeDasharray="4 4" />
                <text x={X(m.year) + 4} y={T + fs} fontSize={fs * .92} fill="var(--color-chart-label)" fontFamily={MONO}>{m.label}</text>
              </g>
            ))}

            {mode === "mc" ? (
              <>
                {pts[0].det != null ? <path d={line((a) => a.det!)} fill="none" stroke="var(--steel)" strokeWidth={1.6 * sw} strokeDasharray="5 4" /> : null}
                <path d={line((a) => a.base)} fill="none" stroke="var(--gold)" strokeWidth={2.6 * sw} strokeLinejoin="round" markerEnd={`url(#${g("tip")})`} />
              </>
            ) : (
              <>
                <path d={line((a) => a.hi!)} fill="none" stroke="var(--jade)" strokeWidth={1.8 * sw} strokeLinejoin="round" opacity={.9} />
                {noLoLine ? null : <path d={line((a) => a.lo!)} fill="none" stroke="var(--coral)" strokeWidth={1.8 * sw} strokeLinejoin="round" opacity={.9} />}
                <path d={line((a) => a.base)} fill="none" stroke="var(--gold)" strokeWidth={2.6 * sw} strokeLinejoin="round" markerEnd={`url(#${g("tip")})`} />
              </>
            )}

            {overlay.filter((ov) => ov.pts.length).map((ov, k) => (
              <path key={k} d={pathD(ov.pts.map((p) => [X(p.year), Y(p.value)]))}
                fill="none" stroke={ov.color || "var(--dim)"} strokeWidth={(ov.width || 1.8) * sw}
                strokeDasharray={ov.dash || "6 5"} strokeLinejoin="round" opacity={.95} />
            ))}

            <HoverMarks size={size} x={bx} y={best ? Y(best.base) : null} />
            {enhanced ? (
              <>
                <circle cx={bx ?? 0} cy={best?.hi != null ? Y(best.hi) : 0} r={4 * sw} fill="var(--jade)" stroke="var(--dotstroke)" strokeWidth={2 * sw} opacity={best?.hi != null ? 1 : 0} />
                {noLoLine ? null : <circle cx={bx ?? 0} cy={best?.lo != null ? Y(best.lo) : 0} r={4 * sw} fill="var(--coral)" stroke="var(--dotstroke)" strokeWidth={2 * sw} opacity={best?.lo != null ? 1 : 0} />}
                <circle cx={bx ?? 0} cy={T + ph + B / 2} r={3 * sw} fill="var(--dim)" opacity={best ? 1 : 0} />
              </>
            ) : null}
            {extras?.({ X, Y, W, T, ph, narrow, minY: AX.min, maxY: AX.max })}
          </>
        );
      }}
    </ChartFrame>
  );
}
