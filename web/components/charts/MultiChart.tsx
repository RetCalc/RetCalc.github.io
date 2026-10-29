"use client";

/* Several lines on one chart (accounts side by side, or plans compared),
   with one tooltip listing every line at the year under the pointer. From
   paintMulti() in src/js/app/04-charts.js. */

import { ChartFrame, EndLabels, HoverMarks, MONO, pathD, XAxis, YAxis, useChartSize, valueScale } from "./ChartFrame";
import { TipRow } from "./TipRows";
import { fmtAxisMoney } from "./scale";
import { money } from "@/lib/format";
import { SERIES } from "@/lib/hues";

/* For charts of equal alternatives (Compare's saved scenarios), so none is
   amber: amber means the visitor's own plan, and these are all theirs. */
export const MULTI_COLORS: string[] = [SERIES.sky, SERIES.teal, SERIES.rose];

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
  head?: (year: number) => React.ReactNode;
  /** Or the whole tooltip, in place of the head and a line per series. */
  tip?: (year: number) => React.ReactNode;
  xFmt?: (x: number) => React.ReactNode;
  yFmt?: (v: number) => string;
  /** How each line's figure reads in the tooltip. */
  valFmt?: (v: number) => string;
  /** Marked moments: a faint dashed line with its label at the top. */
  marks?: { x: number; label: string }[];
  /** In a half-width card: drawn to a narrower size so the axis labels and
      marks keep a readable size on screen (desktop; phones are unchanged). */
  half?: boolean;
  /** Draw at exactly this many pixels (full screen). */
  px?: { w: number; h: number };
  /** Each line's name at its end (two to four lines; on by default). */
  endLabels?: boolean;
}

export function MultiChart({ id, series, maxX, ariaLabel, head, tip, xFmt = (x) => x, yFmt = fmtAxisMoney, valFmt = money, marks = [], half = false, endLabels = true, px }: Props) {
  const base = useChartSize({ px });
  const size = half && !base.narrow && !px ? { ...base, W: 600, H: 330, L: 66, fs: 13, pw: 600 - 66 - base.Rp, ph: 330 - base.T - base.B } : base;
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
      tip={(i) => tip ? tip(grid[i].year) : (
        <>
          {head?.(grid[i].year)}
          {grid[i].vals.map((v, k) => (v == null ? null : <TipRow key={k} color={colors[k]} label={live[k].name} value={v} fmt={valFmt} />))}
        </>
      )}>
      {(hi) => (
        <>
          <YAxis size={size} ticks={AX.ticks} Y={Y} fmt={yFmt} />
          <XAxis size={size} count={maxX} X={X} label={xFmt} />
          {AX.min < 0 ? <line x1={L} x2={W - Rp} y1={Y(0)} y2={Y(0)} stroke="var(--axis)" strokeWidth={sw} opacity={.55} /> : null}
          {marks.filter((m) => m.x >= 0 && m.x <= maxX).sort((a, b) => a.x - b.x).map((m, k, all) => {
            // Marks close together (break-even ages two years apart on a
            // phone) take turns on two rows so their labels don't run together.
            const mfs = half ? fs : fs * .9;
            const crowded = all.some((o, j) => j !== k && Math.abs(X(o.x) - X(m.x)) < mfs * (String(m.label).length + 1) * 0.62);
            const row = crowded && k % 2 === 1 ? 1 : 0;
            return (
              <g key={m.x}>
                <line x1={X(m.x)} x2={X(m.x)} y1={T + fs + 4 + row * mfs * 1.15} y2={T + ph} stroke="var(--axis)" strokeWidth={sw} strokeDasharray="3 4" opacity={.55} />
                <text x={X(m.x)} y={T + fs + row * mfs * 1.15} textAnchor="middle" fontSize={mfs} fill="var(--axis)" fontFamily={MONO}>{m.label}</text>
              </g>
            );
          })}
          {live.map((x, i) => (
            <path key={i} d={pathD(x.pts.map((p) => [X(p.year), Y(p.value)]))}
              fill="none" stroke={colors[i]} strokeWidth={(x.width || 2.4) * sw} strokeLinejoin="round" strokeDasharray={x.dash} />
          ))}
          {endLabels && live.length >= 2 && live.length <= 4 ? (
            <EndLabels size={size} items={live.map((x) => { const p = x.pts[x.pts.length - 1]; return { x: X(p.year), y: Y(p.value), label: x.name }; })} />
          ) : null}
          <HoverMarks size={size} x={hi != null ? X(grid[hi].year) : null} y={hi != null ? Y(first(hi)) : null} color={colors[0]} />
        </>
      )}
    </ChartFrame>
  );
}
