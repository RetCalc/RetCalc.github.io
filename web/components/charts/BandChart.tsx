"use client";

/* The site's main chart: one line (the plan, ending in the logo's arrowhead)
   inside a shaded band, a higher and a lower line at the band's edges, or
   percentile fans for market-history and Monte Carlo runs. Hover, or touch
   and drag on a phone, shows the year under the pointer. Ported from
   paintChart(), attachChart() and chartTouch() in src/js/app/04-charts.js,
   drawn by React instead of by hand; colors come from the theme's CSS
   variables, so it follows a theme switch. */

import { useEffect, useId, useRef, useState } from "react";
import { niceAxis, fmtAxisMoney } from "./scale";
import { useNarrow } from "./useNarrow";

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

const MONO = "ui-monospace,SF Mono,Menlo,monospace";
const v = (name: string) => ({ fill: `var(${name})` });

export function BandChart<P extends BandPoint>(props: Props<P>) {
  const { id, pts, maxX, mode = "band", ariaLabel, tip, stageMarks = [], xOffset = 0, overlay = [], traces, noLoLine, enhanced, extras } = props;
  const narrow = useNarrow();
  const uid = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ i: number; left: number; top: number } | null>(null);
  const touch = useRef({ x: 0, y: 0, axis: "", timer: undefined as ReturnType<typeof setTimeout> | undefined });

  // While scrubbing sideways, the page mustn't scroll. React's touch handlers
  // can't stop that (they're passive), so this one is added directly.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const stop = (e: TouchEvent) => {
      if (touch.current.axis === "x") e.preventDefault();
    };
    el.addEventListener("touchmove", stop, { passive: false });
    return () => el.removeEventListener("touchmove", stop);
  }, []);

  const W = narrow ? 470 : 900, H = narrow ? 400 : 340;
  const L = narrow ? 60 : 78, Rp = narrow ? 12 : 14;
  const T = narrow ? 12 : 14, B = narrow ? 34 : 30;
  const fs = narrow ? 15 : 11, sw = narrow ? 1.7 : 1;
  const pw = W - L - Rp, ph = H - T - B;

  if (!pts.length) {
    return (
      <div className="chartwrap" id={`chartWrap${id}`} ref={wrapRef}>
        <svg id={`chart${id}`} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={ariaLabel} />
        <div className="tip" />
      </div>
    );
  }

  const vals: number[] = [];
  for (const a of pts) {
    vals.push(a.base);
    if (a.hi != null) vals.push(a.hi);
    if (a.lo != null) vals.push(a.lo);
    if (a.det != null) vals.push(a.det);
  }
  // A comparison line counts toward the axis, so it never runs off the top.
  for (const ov of overlay) for (const p of ov.pts) vals.push(p.value);
  const AX = niceAxis(Math.min(0, Math.min(...vals)), Math.max(...vals));
  const span = AX.max - AX.min || 1;
  const X = (y: number) => L + (y / (maxX || 1)) * pw;
  const Y = (val: number) => T + ph - ((val - AX.min) / span) * ph;

  const line = (f: (a: P) => number) => pts.map((a, i) => (i ? "L" : "M") + X(a.year) + " " + Y(f(a))).join(" ");
  const ribbon = (top: (a: P) => number, bot: (a: P) => number) =>
    pts.map((a, i) => (i ? "L" : "M") + X(a.year) + " " + Y(top(a))).join(" ") + " " +
    pts.slice().reverse().map((a) => "L" + X(a.year) + " " + Y(bot(a))).join(" ") + " Z";

  const step = Math.max(1, Math.ceil(maxX / (narrow ? 6 : 12)));
  const xTicks: number[] = [];
  for (let y = 0; y <= maxX; y += step) xTicks.push(y);

  const g = (name: string) => `${name}${uid}`;
  const best = hover ? pts[hover.i] : null;
  const bx = best ? X(best.year) : 0;

  /* Finds the point nearest the pointer and places the tooltip beside it,
     flipped to stay inside the chart. */
  const probe = (clientX: number, clientY: number) => {
    const box = svgRef.current?.getBoundingClientRect(), wb = wrapRef.current?.getBoundingClientRect();
    if (!box?.width || !wb) return;
    const vx = ((clientX - box.left) / box.width) * W;
    let i = 0;
    pts.forEach((a, j) => {
      if (Math.abs(X(a.year) - vx) < Math.abs(X(pts[i].year) - vx)) i = j;
    });
    const tw = tipRef.current?.offsetWidth || 190, th = tipRef.current?.offsetHeight || 84;
    let left = clientX - wb.left + 16;
    if (left + tw > wb.width - 4) left = clientX - wb.left - tw - 16;
    left = Math.max(4, Math.min(left, wb.width - tw - 4));
    let top = clientY - wb.top - th - 14;
    if (top < 4) top = clientY - wb.top + 18;
    top = Math.max(4, Math.min(top, wb.height - th - 4));
    setHover({ i, left, top });
  };
  const clear = () => setHover(null);

  return (
    <div
      className="chartwrap"
      id={`chartWrap${id}`}
      ref={wrapRef}
      onMouseMove={(e) => probe(e.clientX, e.clientY)}
      onMouseLeave={clear}
      /* A touch shows the point under the finger, and the tooltip stays up
         briefly after it lifts. The first move decides: mostly vertical
         hands the gesture back to the page to scroll; mostly sideways keeps
         it here to scrub. */
      onTouchStart={(e) => {
        const t = e.touches[0];
        if (!t) return;
        clearTimeout(touch.current.timer);
        Object.assign(touch.current, { x: t.clientX, y: t.clientY, axis: "" });
        probe(t.clientX, t.clientY);
      }}
      onTouchMove={(e) => {
        const t = e.touches[0];
        if (!t) return;
        const c = touch.current;
        if (!c.axis) {
          const dx = Math.abs(t.clientX - c.x), dy = Math.abs(t.clientY - c.y);
          if (dx < 6 && dy < 6) return;
          c.axis = dy > dx ? "y" : "x";
          if (c.axis === "y") clear();
        }
        if (c.axis === "x") probe(t.clientX, t.clientY);
      }}
      onTouchEnd={() => {
        clearTimeout(touch.current.timer);
        touch.current.timer = setTimeout(clear, 2500);
      }}
    >
      <svg id={`chart${id}`} ref={svgRef} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={ariaLabel}
        style={enhanced ? { animation: "chartFadeUp .35s ease-out" } : undefined}>
        <defs>
          {([["fanOuter", .16, .02], ["fanInner", .30, .06], ["bandFill", .20, .05]] as const).map(([name, a, b]) => (
            <linearGradient key={name} id={g(name)} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4fbf95" stopOpacity={a} />
              <stop offset="100%" stopColor="#4fbf95" stopOpacity={b} />
            </linearGradient>
          ))}
          {/* The plan's own line ends in the logo's arrowhead. */}
          <marker id={g("tip")} viewBox="0 0 10 10" refX="6.5" refY="5" markerWidth="4.2" markerHeight="4.2" orient="auto">
            <path d="M0 .6 L10 5 L0 9.4 L2.6 5 Z" fill="#e9b872" />
          </marker>
          {traces?.lines.length ? <clipPath id={g("trc")}><rect x={L} y={T} width={pw} height={ph} /></clipPath> : null}
        </defs>

        {AX.ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - Rp} y1={Y(t)} y2={Y(t)} style={{ stroke: "var(--grid)" }} strokeWidth={sw} />
            <text x={L - 8} y={Y(t) + fs / 3} textAnchor="end" fontSize={fs} style={v("--axis")} fontFamily={MONO}>{fmtAxisMoney(t)}</text>
          </g>
        ))}
        {xTicks.map((y) => (
          <text key={y} x={X(y)} y={H - 10} textAnchor="middle" fontSize={fs} style={v("--axis")} fontFamily={MONO}>{y + xOffset}</text>
        ))}

        {/* Every starting year as its own faint line, under the shading. */}
        {traces?.lines.length ? (
          <g clipPath={`url(#${g("trc")})`} fill="none" stroke="#7d9fd6" strokeLinejoin="round" className="traces"
            strokeOpacity={traces.lines.length > 400 ? .055 : traces.lines.length > 60 ? .13 : .18} strokeWidth={.9 * sw}>
            {traces.lines.map((ln, k) => {
              let d = "";
              for (let i = 0; i < traces.xs.length && i < ln.length; i++) {
                const val = ln[i];
                if (val == null || !isFinite(val)) continue;
                d += (d ? "L" : "M") + X(traces.xs[i]).toFixed(1) + " " + Y(val).toFixed(1);
              }
              return d ? <path key={k} d={d} /> : null;
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
            <line x1={X(m.year)} x2={X(m.year)} y1={T} y2={T + ph} style={{ stroke: "var(--stageline)" }} strokeWidth={sw} strokeDasharray="4 4" />
            <text x={X(m.year) + 4} y={T + fs} fontSize={fs * .92} fill="#5f7583" fontFamily={MONO}>{m.label}</text>
          </g>
        ))}

        {mode === "mc" ? (
          <>
            {pts[0].det != null ? <path d={line((a) => a.det!)} fill="none" stroke="#7d9fd6" strokeWidth={1.6 * sw} strokeDasharray="5 4" /> : null}
            <path d={line((a) => a.base)} fill="none" stroke="#e9b872" strokeWidth={2.6 * sw} strokeLinejoin="round" markerEnd={`url(#${g("tip")})`} />
          </>
        ) : (
          <>
            <path d={line((a) => a.hi!)} fill="none" stroke="#4fbf95" strokeWidth={1.8 * sw} strokeLinejoin="round" opacity={.9} />
            {noLoLine ? null : <path d={line((a) => a.lo!)} fill="none" stroke="#e2795f" strokeWidth={1.8 * sw} strokeLinejoin="round" opacity={.9} />}
            <path d={line((a) => a.base)} fill="none" stroke="#e9b872" strokeWidth={2.6 * sw} strokeLinejoin="round" markerEnd={`url(#${g("tip")})`} />
          </>
        )}

        {overlay.filter((ov) => ov.pts.length).map((ov, k) => (
          <path key={k} d={ov.pts.map((p, i) => (i ? "L" : "M") + X(p.year) + " " + Y(p.value)).join(" ")}
            fill="none" style={{ stroke: ov.color || "var(--dim)" }} strokeWidth={(ov.width || 1.8) * sw}
            strokeDasharray={ov.dash || "6 5"} strokeLinejoin="round" opacity={.95} />
        ))}

        <line x1={bx} x2={bx} y1={T} y2={T + ph} stroke="#e9b872" strokeWidth={sw} opacity={best ? .4 : 0} />
        <circle cx={bx} cy={best ? Y(best.base) : 0} r={4.5 * sw} fill="#e9b872" style={{ stroke: "var(--dotstroke)" }} strokeWidth={2.5 * sw} opacity={best ? 1 : 0} />
        {enhanced ? (
          <>
            <circle cx={bx} cy={best?.hi != null ? Y(best.hi) : 0} r={4 * sw} fill="#4fbf95" style={{ stroke: "var(--dotstroke)" }} strokeWidth={2 * sw} opacity={best?.hi != null ? 1 : 0} />
            {noLoLine ? null : <circle cx={bx} cy={best?.lo != null ? Y(best.lo) : 0} r={4 * sw} fill="#e2795f" style={{ stroke: "var(--dotstroke)" }} strokeWidth={2 * sw} opacity={best?.lo != null ? 1 : 0} />}
            <circle cx={bx} cy={T + ph + B / 2} r={3 * sw} style={v("--dim")} opacity={best ? 1 : 0} />
          </>
        ) : null}
        {extras?.({ X, Y, W, T, ph, narrow, minY: AX.min, maxY: AX.max })}
      </svg>
      <div className="tip" ref={tipRef} style={hover ? { opacity: 1, left: hover.left, top: hover.top } : { opacity: 0 }}>
        {best ? tip(best) : null}
      </div>
    </div>
  );
}
