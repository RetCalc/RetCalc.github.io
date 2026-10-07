"use client";

/* What every chart shares: its size (larger type and thicker lines below
   640px wide), the frame that finds the point under the pointer and places
   the tooltip beside it, touch scrubbing on a phone, and the axes. From
   paintChart(), attachChart() and chartTouch() in src/js/app/04-charts.js. */

import { useEffect, useRef, useState } from "react";
import { fmtAxisMoney, niceAxis } from "./scale";
import { useNarrow } from "./useNarrow";
import { SERIES } from "@/lib/hues";

export const MONO = "ui-monospace,SF Mono,Menlo,monospace";

export function useChartSize() {
  const narrow = useNarrow();
  const W = narrow ? 470 : 900, H = narrow ? 400 : 340;
  const L = narrow ? 60 : 78, Rp = narrow ? 12 : 14, T = narrow ? 12 : 14, B = narrow ? 34 : 30;
  return { narrow, W, H, L, Rp, T, B, fs: narrow ? 15 : 11, sw: narrow ? 1.7 : 1, pw: W - L - Rp, ph: H - T - B };
}
export type ChartSize = ReturnType<typeof useChartSize>;

/** A value scale over `vals` (always including 0), as the charts draw it. */
export function valueScale(size: ChartSize, vals: number[]) {
  const AX = niceAxis(Math.min(0, Math.min(...vals)), Math.max(...vals));
  const span = AX.max - AX.min || 1;
  return { AX, Y: (v: number) => size.T + size.ph - ((v - AX.min) / span) * size.ph };
}

/** An SVG path through the points, to a tenth of a unit: finer than any
    screen shows, and a much shorter attribute. */
export function pathD(pts: [x: number, y: number][]): string {
  return pts.map(([x, y], i) => (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1)).join("");
}

/** Gridlines and their labels up the left side. */
export function YAxis({ size, ticks, Y, fmt = fmtAxisMoney }: { size: ChartSize; ticks: number[]; Y: (v: number) => number; fmt?: (v: number) => string }) {
  return (
    <>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={size.L} x2={size.W - size.Rp} y1={Y(t)} y2={Y(t)} stroke="var(--grid)" strokeWidth={size.sw} />
          <text x={size.L - 8} y={Y(t) + size.fs / 3} textAnchor="end" fontSize={size.fs} fill="var(--axis)" fontFamily={MONO}>{fmt(t)}</text>
        </g>
      ))}
    </>
  );
}

/** Labels along the bottom: about 12 across (6 on a phone), from 0 to
    `last` (which is `count` itself unless given). */
export function XAxis({ size, count, last = count, X, label, every }: { size: ChartSize; count: number; last?: number; X: (i: number) => number; label: (i: number) => React.ReactNode;
  /** Ticks only on multiples of this (12 for months shown as years). */
  every?: number }) {
  const step = every ? every * Math.max(1, Math.ceil(count / every / (size.narrow ? 6 : 12))) : Math.max(1, Math.ceil(count / (size.narrow ? 6 : 12)));
  const at: number[] = [];
  for (let i = 0; i <= last; i += step) at.push(i);
  return (
    <>
      {at.map((i) => (
        <text key={i} x={X(i)} y={size.H - 10} textAnchor="middle" fontSize={size.fs} fill="var(--axis)" fontFamily={MONO}>{label(i)}</text>
      ))}
    </>
  );
}

/** Touch scrubbing on a phone: a touch shows the point under the finger,
    and the tooltip stays up briefly after it lifts. The first move decides:
    mostly vertical hands the gesture back to the page; mostly sideways keeps
    it to scrub. From chartTouch() in src/js/app/04-charts.js. */
export function useScrub(el: React.RefObject<HTMLElement | null>, probe: (x: number, y: number) => void, clear: () => void) {
  const touch = useRef({ x: 0, y: 0, axis: "", timer: undefined as ReturnType<typeof setTimeout> | undefined });
  // While scrubbing sideways the page mustn't scroll; React's touch handlers
  // are passive and can't stop it, so this one is added directly.
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const stop = (e: TouchEvent) => {
      if (touch.current.axis === "x") e.preventDefault();
    };
    node.addEventListener("touchmove", stop, { passive: false });
    return () => node.removeEventListener("touchmove", stop);
  }, [el]);
  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      clearTimeout(touch.current.timer);
      Object.assign(touch.current, { x: t.clientX, y: t.clientY, axis: "" });
      probe(t.clientX, t.clientY);
    },
    onTouchMove: (e: React.TouchEvent) => {
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
    },
    onTouchEnd: () => {
      clearTimeout(touch.current.timer);
      touch.current.timer = setTimeout(clear, 2500);
    },
  };
}

interface FrameProps {
  id: string;
  ariaLabel: string;
  size: ChartSize;
  /** Where each point sits across the chart, in drawing units: the one
      nearest the pointer is shown. */
  xs?: number[];
  /** Or, for a chart read in two directions, which point is under the
      pointer at (x, y) in drawing units; null for none. `k` is drawing
      units per screen pixel. */
  pick?: (x: number, y: number, k: number) => number | null;
  /** A click (or tap) on the point shown. */
  onPick?: (i: number) => void;
  /** The tooltip for point i. */
  tip: (i: number) => React.ReactNode;
  fadeIn?: boolean;
  /** The drawing; `hover` is the index under the pointer, for its markers. */
  children: (hover: number | null) => React.ReactNode;
}

export function ChartFrame({ id, ariaLabel, size, xs, pick, onPick, tip, fadeIn, children }: FrameProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ i: number; left: number; top: number } | null>(null);

  /* The point nearest the pointer, and the tooltip beside it, flipped to
     stay inside the chart. */
  const probe = (clientX: number, clientY: number) => {
    const box = svgRef.current?.getBoundingClientRect(), wb = wrapRef.current?.getBoundingClientRect();
    if (!box?.width || !wb) return;
    const vx = ((clientX - box.left) / box.width) * size.W, vy = ((clientY - box.top) / box.height) * size.H;
    let i: number | null = 0;
    if (pick) i = pick(vx, vy, size.W / box.width);
    else if (xs?.length) xs.forEach((x, j) => {
      if (Math.abs(x - vx) < Math.abs(xs[i!] - vx)) i = j;
    });
    else return;
    if (i == null) {
      setHover(null);
      return;
    }
    const tw = tipRef.current?.offsetWidth || 190, th = tipRef.current?.offsetHeight || 84;
    let left = clientX - wb.left + 16;
    if (left + tw > wb.width - 4) left = clientX - wb.left - tw - 16;
    left = Math.max(4, Math.min(left, wb.width - tw - 4));
    let top = clientY - wb.top - th - 14;
    if (top < 4) top = clientY - wb.top + 18;
    top = Math.max(4, Math.min(top, wb.height - th - 4));
    setHover({ i: i!, left, top });
  };
  const clear = () => setHover(null);
  const scrub = useScrub(wrapRef, probe, clear);
  const active = hover && (pick || hover.i < (xs?.length ?? 0)) ? hover : null;

  return (
    <div
      className="chartwrap"
      id={`chartWrap${id}`}
      ref={wrapRef}
      onMouseMove={(e) => probe(e.clientX, e.clientY)}
      onMouseLeave={clear}
      onClick={() => active && onPick?.(active.i)}
      {...scrub}
    >
      <svg id={`chart${id}`} ref={svgRef} viewBox={`0 0 ${size.W} ${size.H}`} preserveAspectRatio="none" role="img" aria-label={ariaLabel} className={fadeIn ? "animate-chart-fade-up" : undefined}>
        {xs?.length || pick ? children(active ? active.i : null) : null}
      </svg>
      <div className={active ? "tip opacity-100 left-(--x) top-(--y)" : "tip opacity-0"} ref={tipRef}
        style={active ? { "--x": active.left + "px", "--y": active.top + "px" } as React.CSSProperties : undefined}>
        {active ? tip(active.i) : null}
      </div>
    </div>
  );
}

/** The hover line and dot every chart draws at the point under the pointer:
    a neutral guide line, and a dot in the color of the line it sits on. */
export function HoverMarks({ size, x, y, color = SERIES.plan }: { size: ChartSize; x: number | null; y: number | null; color?: string }) {
  return (
    <>
      <line x1={x ?? 0} x2={x ?? 0} y1={size.T} y2={size.T + size.ph} stroke={SERIES.guide} strokeWidth={size.sw} opacity={x != null ? 0.5 : 0} />
      <circle cx={x ?? 0} cy={y ?? 0} r={4.5 * size.sw} fill={color} stroke="var(--dotstroke)" strokeWidth={2.5 * size.sw} opacity={x != null ? 1 : 0} />
    </>
  );
}
