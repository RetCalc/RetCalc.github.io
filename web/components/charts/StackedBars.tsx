"use client";

/* Stacked bars, one per year, each split into colored parts, with an
   optional tick across a bar for a second figure (the Early Retirement
   Bridge draws the year's Roth conversion that way). From brPaintBars() in
   src/js/app/36-bridge.js. */

import { ChartFrame, HoverMarks, XAxis, YAxis, useChartSize } from "./ChartFrame";
import { niceAxis } from "./scale";

export interface StackBar {
  label: React.ReactNode;
  /** Each part's size, by category key. */
  parts: Record<string, number>;
  tick?: number;
}

interface Props {
  id: string;
  bars: StackBar[];
  /** The stacking order, bottom up, and each part's color. */
  cats: { k: string; c: string }[];
  ariaLabel: string;
  tip: (i: number) => React.ReactNode;
}

export function StackedBars({ id, bars, cats, ariaLabel, tip }: Props) {
  const size = useChartSize();
  const { L, T, pw, ph, sw } = size;
  const tot = bars.map((b) => Object.values(b.parts).reduce((s, v) => s + (v > 0 ? v : 0), 0));
  const AX = niceAxis(0, Math.max(0, ...tot, ...bars.map((b) => b.tick || 0)) || 1);
  const span = AX.max || 1, n = bars.length, slot = pw / (n || 1);
  const X = (i: number) => L + slot * (i + 0.5);
  const Y = (v: number) => T + ph - (v / span) * ph;
  const bw = Math.max(1.5, Math.min(slot * 0.72, 56 * sw));

  return (
    <ChartFrame id={id} ariaLabel={ariaLabel} size={size} xs={bars.map((_, i) => X(i))} tip={tip}>
      {(hi) => (
        <>
          <YAxis size={size} ticks={AX.ticks} Y={Y} />
          <XAxis size={size} count={n} last={n - 1} X={X} label={(i) => bars[i].label} />
          {bars.map((b, i) => {
            let acc = 0;
            return (
              <g key={i}>
                {cats.map((c) => {
                  const v = b.parts[c.k];
                  if (!(v > 0.5)) return null;
                  const y0 = Y(acc), y1 = Y(acc + v);
                  acc += v;
                  return <rect key={c.k} x={X(i) - bw / 2} y={y1} width={bw} height={Math.max(0.5, y0 - y1)} fill={c.c} />;
                })}
                {(b.tick || 0) > 0.5 ? (
                  <line x1={X(i) - bw / 2 - 1} x2={X(i) + bw / 2 + 1} y1={Y(b.tick!)} y2={Y(b.tick!)}
                    style={{ stroke: "var(--text)" }} strokeWidth={2 * sw} strokeLinecap="round" />
                ) : null}
              </g>
            );
          })}
          <HoverMarks size={size} x={hi != null ? X(hi) : null} y={hi != null ? Y(tot[hi]) : null} />
        </>
      )}
    </ChartFrame>
  );
}
