"use client";

/* Several lines on one chart (accounts side by side, or plans compared),
   with one tooltip listing every line at the year under the pointer. From
   paintMulti() in src/js/app/04-charts.js. */

import { ChartFrame, HoverMarks, MONO, XAxis, YAxis, useChartSize, valueScale } from "./ChartFrame";
import { TipRow } from "./TipRows";
import { fmtAxisMoney } from "./scale";
import { money } from "@/lib/format";

export const MULTI_COLORS = ["#e9b872", "#4fbf95", "#7d9fd6"];

export interface Series {
  name: string;
  pts: { year: number; value: number }[];
  color?: string;
  width?: number;
  dash?: string;
}

interface Props {
  id: string;
  series: Series[];
  maxX: number;
  ariaLabel: string;
  /** The tooltip's first line, for the year under the pointer. */
  head: (year: number) => React.ReactNode;
  xFmt?: (x: number) => React.ReactNode;
  yFmt?: (v: number) => string;
  /** How each line's figure reads in the tooltip. */
  valFmt?: (v: number) => string;
  /** Marked moments: a faint dashed line with its label at the top. */
  marks?: { x: number; label: string }[];
}

export function MultiChart({ id, series, maxX, ariaLabel, head, xFmt = (x) => x, yFmt = fmtAxisMoney, valFmt = money, marks = [] }: Props) {
  const size = useChartSize();
  const { W, Rp, L, T, pw, ph, fs, sw } = size;
  const live = series.filter((x) => x.pts.length);
  const colors = live.map((x, i) => x.color || MULTI_COLORS[i % MULTI_COLORS.length]);

  const vals = live.flatMap((x) => x.pts.map((p) => p.value));
  const { AX, Y } = valueScale(size, vals.length ? vals : [0]);
  const X = (y: number) => L + (y / (maxX || 1)) * pw;

  /* One hover grid across every line, so the tooltip shows them together
     even where one is shorter than another. */
  const years = [...new Set(live.flatMap((x) => x.pts.map((p) => p.year)))].sort((a, b) => a - b);
  const maps = live.map((x) => new Map(x.pts.map((p) => [p.year, p.value])));
  const grid = years.map((year) => ({ year, vals: maps.map((m) => m.get(year) ?? null) }));
  const first = (i: number) => grid[i].vals.find((v) => v != null) ?? 0;

  return (
    <ChartFrame id={id} ariaLabel={ariaLabel} size={size} xs={grid.map((g) => X(g.year))}
      tip={(i) => (
        <>
          {head(grid[i].year)}
          {grid[i].vals.map((v, k) => (v == null ? null : <TipRow key={k} color={colors[k]} label={live[k].name} value={v} fmt={valFmt} />))}
        </>
      )}>
      {(hi) => (
        <>
          <YAxis size={size} ticks={AX.ticks} Y={Y} fmt={yFmt} />
          <XAxis size={size} count={maxX} X={X} label={xFmt} />
          {AX.min < 0 ? <line x1={L} x2={W - Rp} y1={Y(0)} y2={Y(0)} style={{ stroke: "var(--axis)" }} strokeWidth={sw} opacity={.55} /> : null}
          {marks.filter((m) => m.x >= 0 && m.x <= maxX).map((m) => (
            <g key={m.x}>
              <line x1={X(m.x)} x2={X(m.x)} y1={T + fs + 4} y2={T + ph} style={{ stroke: "var(--axis)" }} strokeWidth={sw} strokeDasharray="3 4" opacity={.55} />
              <text x={X(m.x)} y={T + fs} textAnchor="middle" fontSize={fs * .9} style={{ fill: "var(--axis)" }} fontFamily={MONO}>{m.label}</text>
            </g>
          ))}
          {live.map((x, i) => (
            <path key={i} d={x.pts.map((p, k) => (k ? "L" : "M") + X(p.year) + " " + Y(p.value)).join(" ")}
              fill="none" stroke={colors[i]} strokeWidth={(x.width || 2.4) * sw} strokeLinejoin="round" strokeDasharray={x.dash} />
          ))}
          <HoverMarks size={size} x={hi != null ? X(grid[hi].year) : null} y={hi != null ? Y(first(hi)) : null} />
        </>
      )}
    </ChartFrame>
  );
}
