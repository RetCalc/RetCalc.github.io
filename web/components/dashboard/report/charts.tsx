/* The Dashboard report's own pictures, in the Guide report's print palette
   and type (tools/guide/report/charts.tsx, whose primitives and shared
   charts these sit beside): the cover's map of net worth from the first
   balance entered to the plan's end, the month's pay, the budget, saving
   year by year, the mortgage, the retirement fan and the children's years.
   Drawn at a fixed size for a US Letter sheet. */

import { money } from "@/lib/format";
import { C, Grid, Leader, StopMark, T, axis, dodge, ticks } from "@/tools/guide/report/charts";
import { rounded } from "@/tools/guide/words";
import type { DashReport } from "./model";

const ageTicks = (x0: number, x1: number, every = 5) => {
  const out: number[] = [];
  for (let g = Math.ceil(x0 / every) * every; g <= x1; g += every) out.push(g);
  return out;
};

/** Net worth from the first balance entered to the plan's end: the entries
    so far, the climb to retirement, then history's range once retired
    (every January start's spread: the middle half and eight in ten), with
    the numbered stops on the middle path. Ages are the first person's. */
export function WorthMap({ M, w = 732, h = 470 }: { M: DashReport; w?: number; h?: number }) {
  const pl = 54, pr = 12, pt = 20, pb = 26;
  const now = M.today.getFullYear() + M.today.getMonth() / 12 + (M.today.getDate() - 1) / 365;
  const ageAt = (t: number) => M.a.age! + (t - now);
  const past = M.worth.history.filter((p) => ageAt(p.t) < M.a.age! - 0.05).map((p) => ({ age: ageAt(p.t), v: p.nw }));
  const path = M.R.path.map((p) => ({ age: ageAt(p.t), v: p.v, lo: p.lo, hi: p.hi, p25: p.p25 ?? p.v, p75: p.p75 ?? p.v }));
  const ret = path.filter((p) => p.age >= M.retire - 0.01);
  const x0 = Math.min(M.age0, ...past.map((p) => p.age)), x1 = Math.max(M.end + 1, ...path.map((p) => p.age));
  const peak = Math.max(...path.map((p) => p.hi), ...past.map((p) => p.v), 1);
  const lowest = Math.min(0, ...past.map((p) => p.v), ...path.map((p) => p.v));
  const { top, list } = ticks(peak * 1.04);
  const X = (v: number) => pl + ((v - x0) / Math.max(1, x1 - x0)) * (w - pl - pr);
  const Y = (v: number) => pt + (1 - (Math.min(Math.max(v, lowest), top) - lowest) / (top - lowest)) * (h - pt - pb);
  const poly = (a: { age: number; v: number }[]) => a.map((p) => X(p.age) + "," + Y(p.v)).join(" ");
  const back = <U,>(a: U[]) => a.slice().reverse();
  const valAt = (g: number) => { const p = path.reduce((m, q) => (Math.abs(q.age - g) < Math.abs(m.age - g) ? q : m), path[0]); return p?.v ?? 0; };
  const atRet = path.find((p) => p.age >= M.retire - 0.01);
  const lastP = path[path.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label="Your net worth from your first balances to the end of the plan, with the range of historical outcomes once retired">
      <Grid list={list} Y={Y} x1={pl} x2={w - pr} />
      {lowest < 0 ? <line x1={pl} x2={w - pr} y1={Y(0)} y2={Y(0)} stroke={C.ink2} strokeWidth={1} /> : null}
      {ageTicks(x0, x1, 10).filter((g) => g > x0 + 1).map((g) => <text key={g} x={X(g)} y={h - 6} textAnchor="middle" className="rp-ax">{g}</text>)}
      {ret.length > 1 ? <>
        <polygon points={poly(ret.map((b) => ({ age: b.age, v: b.hi }))) + " " + poly(back(ret).map((b) => ({ age: b.age, v: b.lo })))} fill={C.woodsLight} />
        <polygon points={poly(ret.map((b) => ({ age: b.age, v: b.p75 }))) + " " + poly(back(ret).map((b) => ({ age: b.age, v: b.p25 })))} fill={C.woods} />
      </> : null}
      <line x1={X(M.retire)} x2={X(M.retire)} y1={pt} y2={h - pb} stroke={C.ink2} strokeDasharray="2 3" />
      {past.length ? <>
        <polyline points={poly([...past, { age: M.a.age!, v: M.worth.net }])} fill="none" stroke={C.band} strokeWidth={2.4} strokeLinejoin="round" />
        {past.map((p, i) => <circle key={i} cx={X(p.age)} cy={Y(p.v)} r={3} fill={C.band} stroke={C.white} strokeWidth={1} />)}
      </> : null}
      <polyline points={poly(path)} fill="none" stroke={C.trail} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
      {dodge(M.stops.map((s) => ({ x: X(Math.max(s.age, M.a.age!)), y: Y(valAt(s.age)) }))).map((d, i) => <g key={i}><Leader {...d} /><StopMark x={d.x} y={d.y} n={i + 1} /></g>)}
      {/* Left of retirement, when there's room for it beside the climb. */}
      {atRet && X(M.retire) - pl > 200 ? <T x={X(M.retire) - 14} y={Math.max(pt + 12, Y(atRet.v) - 16)} a="end" w={800} s={13}>{rounded(atRet.v)} net worth at {M.retire}</T> : null}
      {lastP && ret.length > 1 && lastP.hi > top * 0.12 ? <><T x={X(x1) - 4} y={Math.max(pt + 10, Y(lastP.hi) - 8)} a="end" s={10} c={C.forestText}>Best 10% of histories</T>
        <T x={X(x1) - 4} y={Math.min(h - pb - 4, Y(lastP.lo) + 16)} a="end" s={10} c={C.forestText}>Worst 10%</T></> : null}
    </svg>
  );
}

/** One bar, split into its parts, each labeled inside when there's room. */
export function SplitBar({ parts, w = 708, h = 54, label }: { parts: { t: string; v: number; color: string; ink?: string }[]; w?: number; h?: number; label?: string }) {
  const tot = parts.reduce((s, p) => s + Math.max(0, p.v), 0), X = (v: number) => (v / Math.max(1, tot)) * w;
  const top = label ? 16 : 0, shown = parts.filter((p) => p.v > 0);
  // Each part starts where the ones before it end.
  const starts = shown.map((_, i) => shown.slice(0, i).reduce((t, q) => t + X(q.v), 0));
  return (
    <svg viewBox={`0 0 ${w} ${h + top}`} width={w} height={h + top} role="img" aria-label={label ?? parts.map((p) => p.t + " " + money(p.v)).join(", ")}>
      {label ? <T x={0} y={11} w={700}>{label}</T> : null}
      {shown.map((p, i) => {
        const bw = X(p.v), x = starts[i];
        return <g key={p.t}><rect x={x} y={top} width={bw} height={h} fill={p.color} stroke={C.white} strokeWidth={1.5} />
          {bw > 64 ? <><T x={x + 7} y={top + h / 2 - 3} w={700} s={10} c={p.ink ?? C.white}>{p.t}</T><T x={x + 7} y={top + h / 2 + 12} w={800} s={11.5} c={p.ink ?? C.white}>{money(p.v)}</T></> : null}</g>;
      })}
    </svg>
  );
}

/** A list as horizontal bars: label, bar and figure. */
export function HBars({ list, w = 440, row = 26, color = C.forest, fmt = money, lw = 150 }: {
  list: { t: string; v: number; color?: string; note?: string }[]; w?: number; row?: number; color?: string; fmt?: (v: number) => string; lw?: number;
}) {
  const max = Math.max(1, ...list.map((x) => x.v)), bx = lw, bwMax = w - lw - 74, h = list.length * row + 4;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={list.map((x) => x.t + " " + fmt(x.v)).join(", ")}>
      {list.map((x, i) => {
        const y = 2 + i * row, bw = Math.max(1.5, (x.v / max) * bwMax);
        return <g key={x.t + i}>
          <T x={0} y={y + row / 2 + 3.5} w={600} s={10.5}>{x.t.length > 26 ? x.t.slice(0, 25) + "…" : x.t}</T>
          <rect x={bx} y={y + 4} width={bw} height={row - 9} fill={x.color ?? color} />
          <T x={bx + bw + 6} y={y + row / 2 + 3.5} w={800} s={10.5}>{fmt(x.v)}</T>
        </g>;
      })}
    </svg>
  );
}

/** Net worth at each balance entry: a line with its dots. */
export function WorthLine({ M, w = 430, h = 200 }: { M: DashReport; w?: number; h?: number }) {
  const H = M.worth.history, pl = 50, pr = 10, pt = 12, pb = 24;
  const lo = Math.min(0, ...H.map((p) => p.nw)), { top, list } = ticks(Math.max(...H.map((p) => p.nw), 1) * 1.05);
  const t0 = H[0].t, t1 = Math.max(H[H.length - 1].t, t0 + 0.25);
  const X = (t: number) => pl + ((t - t0) / (t1 - t0)) * (w - pl - pr), Y = (v: number) => pt + (1 - (v - lo) / (top - lo)) * (h - pt - pb);
  const yrs: number[] = [];
  for (let y = Math.ceil(t0); y <= t1; y++) yrs.push(y);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label="Net worth at each balance update">
      <Grid list={list} Y={Y} x1={pl} x2={w - pr} />
      {yrs.map((y) => <text key={y} x={X(y)} y={h - 6} textAnchor="middle" className="rp-ax">{y}</text>)}
      <polyline points={H.map((p) => X(p.t) + "," + Y(p.nw)).join(" ")} fill="none" stroke={C.trail} strokeWidth={2.4} strokeLinejoin="round" />
      {H.map((p, i) => <circle key={i} cx={X(p.t)} cy={Y(p.nw)} r={3} fill={C.trail} stroke={C.white} strokeWidth={1} />)}
    </svg>
  );
}

/** Figures by age, stacked by part, with an optional line across them. */
export function AgeStack<R extends { age: number }>({ rows, parts, line, w = 430, h = 220, fmtAxis }: {
  rows: R[]; parts: { f: (r: R) => number; color: string }[]; line?: { f: (r: R) => number; color: string; dash?: boolean }; w?: number; h?: number; fmtAxis?: (v: number) => string;
}) {
  const pl = 50, pb = 22, pt = 10, n = Math.max(1, rows.length);
  const { top, list } = ticks(Math.max(1, ...rows.map((r) => parts.reduce((t, p) => t + Math.max(0, p.f(r)), 0)), ...(line ? rows.map(line.f) : [])));
  const bw = (w - pl) / n, Y = (v: number) => pt + (1 - Math.min(v, top) / top) * (h - pt - pb), every = n > 24 ? 5 : n > 12 ? 2 : 1;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label="Each year's figures by age">
      {list.map((v) => <g key={v}><line x1={pl} x2={w} y1={Y(v)} y2={Y(v)} stroke={C.grid} strokeWidth={v ? 0.6 : 1} />
        <text x={pl - 6} y={Y(v) + 3.5} textAnchor="end" className="rp-ax">{(fmtAxis ?? axis)(v)}</text></g>)}
      {rows.map((r, i) => {
        const x = pl + i * bw;
        let acc = 0;
        return <g key={r.age}>{parts.map((p, j) => {
          const v = Math.max(0, p.f(r));
          if (v <= 0) return null;
          const el = <rect key={j} x={x + bw * 0.14} width={bw * 0.72} y={Y(acc + v)} height={Y(acc) - Y(acc + v)} fill={p.color} />;
          acc += v;
          return el;
        })}{r.age % every === 0 ? <text x={x + bw / 2} y={h - 6} textAnchor="middle" className="rp-ax">{r.age}</text> : null}</g>;
      })}
      {line ? <polyline points={rows.map((r, i) => pl + i * bw + bw / 2 + "," + Y(line.f(r))).join(" ")} fill="none" stroke={line.color} strokeWidth={1.8} strokeDasharray={line.dash === false ? undefined : "5 3"} /> : null}
    </svg>
  );
}

/** A balance by age, as a filled climb, labeled at its end. */
export function Climb({ pts, w = 430, h = 200, color = C.forest, label }: { pts: { age: number; v: number }[]; w?: number; h?: number; color?: string; label?: string }) {
  const pl = 50, pr = 70, pt = 14, pb = 24, x0 = pts[0].age, x1 = Math.max(pts[pts.length - 1].age, x0 + 1);
  const { top, list } = ticks(Math.max(...pts.map((p) => p.v), 1) * 1.05);
  const X = (v: number) => pl + ((v - x0) / (x1 - x0)) * (w - pl - pr), Y = (v: number) => pt + (1 - Math.max(0, v) / top) * (h - pt - pb);
  const line = pts.map((p) => X(p.age) + "," + Y(p.v)).join(" "), last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label="A balance by age">
      <Grid list={list} Y={Y} x1={pl} x2={w - pr} />
      <polygon points={`${X(x0)},${Y(0)} ${line} ${X(last.age)},${Y(0)}`} fill={C.woodsLight} />
      <polyline points={line} fill="none" stroke={color} strokeWidth={2.6} strokeLinejoin="round" />
      {ageTicks(x0, x1, x1 - x0 > 20 ? 10 : 5).map((g) => <text key={g} x={X(g)} y={h - 6} textAnchor="middle" className="rp-ax">{g}</text>)}
      <T x={X(last.age) + 6} y={Y(last.v) + 4} w={800} s={11.5} c={color}>{label ?? rounded(last.v)}</T>
    </svg>
  );
}

/** Lines by age, each with its color, dashed or not, labeled at the end. */
export function Lines({ series, w = 430, h = 220, fmt = rounded }: { series: { pts: { age: number; v: number }[]; color: string; dash?: boolean; label?: boolean }[]; w?: number; h?: number; fmt?: (v: number) => string }) {
  const all = series.flatMap((s) => s.pts), pl = 50, pr = 70, pt = 14, pb = 24;
  if (!all.length) return null;
  const x0 = Math.min(...all.map((p) => p.age)), x1 = Math.max(x0 + 1, ...all.map((p) => p.age));
  const { top, list } = ticks(Math.max(1, ...all.map((p) => p.v)) * 1.05);
  const X = (v: number) => pl + ((v - x0) / (x1 - x0)) * (w - pl - pr), Y = (v: number) => pt + (1 - Math.max(0, v) / top) * (h - pt - pb);
  // Two end labels that would touch move apart, the higher one up.
  const ends = series.map((s) => s.pts[s.pts.length - 1]), close = ends.length > 1 && !!ends[0] && !!ends[1] && Math.abs(Y(ends[0].v) - Y(ends[1].v)) < 14;
  const nudge = (i: number) => (!close ? 0 : ends[i].v >= ends[1 - i].v ? -8 : 8);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label="Figures by age">
      <Grid list={list} Y={Y} x1={pl} x2={w - pr} />
      {ageTicks(x0, x1, x1 - x0 > 20 ? 10 : 5).map((g) => <text key={g} x={X(g)} y={h - 6} textAnchor="middle" className="rp-ax">{g}</text>)}
      {series.map((s, i) => <polyline key={i} points={s.pts.map((p) => X(p.age) + "," + Y(p.v)).join(" ")} fill="none" stroke={s.color} strokeWidth={2.6} strokeDasharray={s.dash ? "5 4" : undefined} strokeLinejoin="round" />)}
      {series.map((s, i) => { const e = s.pts[s.pts.length - 1]; return e && s.label !== false ? <T key={"l" + i} x={X(e.age) + 6} y={Y(e.v) + 4 + nudge(i)} w={800} s={11} c={s.color}>{fmt(e.v)}</T> : null; })}
    </svg>
  );
}

/** What's owed on the mortgage at the start of each year until it's paid. */
export function OwedBars({ bal, w = 430, h = 200 }: { bal: { year: number; owed: number }[]; w?: number; h?: number }) {
  const pl = 50, pb = 22, pt = 10, list0 = bal.filter((b) => b.owed > 0), n = Math.max(1, list0.length);
  const { top, list } = ticks(Math.max(1, ...list0.map((b) => b.owed)));
  const bw = (w - pl) / n, Y = (v: number) => pt + (1 - v / top) * (h - pt - pb), every = n > 20 ? 5 : n > 10 ? 2 : 1;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label="What's owed on the mortgage each year until it's paid off">
      <Grid list={list} Y={Y} x1={pl} x2={w} />
      {list0.map((b, i) => <g key={b.year}><rect x={pl + i * bw + bw * 0.14} width={bw * 0.72} y={Y(b.owed)} height={Y(0) - Y(b.owed)} fill={C.clay} />
        {i % every === 0 ? <text x={pl + i * bw + bw / 2} y={h - 6} textAnchor="middle" className="rp-ax">{Math.floor(b.year)}</text> : null}</g>)}
    </svg>
  );
}

/** Each year of retirement across history: the balance's middle half and
    eight in ten, the middle path, and the plan's end age. */
export function Fan({ M, w = 732, h = 260, spend }: { M: DashReport; w?: number; h?: number; spend?: boolean }) {
  const B = spend ? M.hist.spendBand.map((b) => ({ ...b, p25: b.mid, p75: b.mid })) : M.hist.band;
  const pl = 54, pr = 10, pt = 12, pb = 24, x0 = M.retire, x1 = M.retire + B.length;
  const { top, list } = ticks(Math.max(1, ...B.map((b) => b.hi)) * 1.04);
  const X = (v: number) => pl + ((v - x0) / Math.max(1, x1 - x0)) * (w - pl - pr), Y = (v: number) => pt + (1 - Math.max(0, Math.min(v, top)) / top) * (h - pt - pb);
  const poly = (a: { age: number; v: number }[]) => a.map((p) => X(p.age) + "," + Y(p.v)).join(" ");
  const back = <U,>(a: U[]) => a.slice().reverse();
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={spend ? "Spending each year of retirement across history" : "Savings each year of retirement across history"}>
      <Grid list={list} Y={Y} x1={pl} x2={w - pr} />
      <polygon points={poly(B.map((b) => ({ age: b.age, v: b.hi }))) + " " + poly(back(B).map((b) => ({ age: b.age, v: b.lo })))} fill={C.woodsLight} />
      {!spend ? <polygon points={poly(B.map((b) => ({ age: b.age, v: b.p75 }))) + " " + poly(back(B).map((b) => ({ age: b.age, v: b.p25 })))} fill={C.woods} /> : null}
      <polyline points={poly(B.map((b) => ({ age: b.age, v: b.mid })))} fill="none" stroke={C.trail} strokeWidth={2.6} strokeLinejoin="round" />
      {spend ? <line x1={pl} x2={w - pr} y1={Y(M.hist.firstSpend)} y2={Y(M.hist.firstSpend)} stroke={C.ink} strokeDasharray="4 3" /> : null}
      {ageTicks(x0, x1, 5).map((g) => <text key={g} x={X(g)} y={h - 6} textAnchor="middle" className="rp-ax">{g}</text>)}
    </svg>
  );
}

const KID = [C.sand, C.clay, C.dusk, C.water];
export const kidColor = (i: number) => KID[i % 4];
/** The household by year: each of you working then retired, each child's
    childcare and college, the mortgage. */
export function Lanes({ lanes, from, to, now, w = 708 }: {
  lanes: { name: string; spans: { from: number; to: number; color: string; label?: string; hatch?: boolean }[]; marks?: { at: number; label: string }[] }[]; from: number; to: number; now?: number; w?: number;
}) {
  const pl = 120, pr = 8, rh = 34, h = 26 + lanes.length * rh, X = (v: number) => pl + ((Math.max(from, Math.min(to, v)) - from) / Math.max(1, to - from)) * (w - pl - pr);
  const marks = ageTicks(from, to, to - from > 40 ? 10 : 5);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label="Your household along the years">
      <defs><pattern id="dr-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke={C.white} strokeWidth="1.6" /></pattern></defs>
      {marks.map((g) => <g key={g}><line x1={X(g)} x2={X(g)} y1={2} y2={h - 20} stroke={C.rule} /><text x={X(g)} y={h - 6} textAnchor={X(g) > w - 20 ? "end" : "middle"} className="rp-ax">{g}</text></g>)}
      {now != null ? <line x1={X(now)} x2={X(now)} y1={0} y2={h - 20} stroke={C.band} strokeDasharray="3 3" /> : null}
      {lanes.map((l, i) => {
        const y = 6 + i * rh;
        return <g key={l.name + i}><T x={0} y={y + 15} w={700}>{l.name.length > 18 ? l.name.slice(0, 17) + "…" : l.name}</T>
          {l.spans.filter((s) => s.to > from && s.from < to).map((s, j) => { const x = X(s.from), bw = Math.max(2, X(s.to) - x); return <g key={j}>
            <rect x={x} y={y} width={bw} height={22} fill={s.color} />{s.hatch ? <rect x={x} y={y} width={bw} height={22} fill="url(#dr-hatch)" /> : null}
            {s.label && bw > s.label.length * 5.6 + 10 ? <T x={x + 6} y={y + 15} w={700} s={10} c={C.white}>{s.label}</T> : null}</g>; })}
          {(l.marks ?? []).filter((m) => m.at >= from && m.at <= to).map((m, j) => <g key={"m" + j}><circle cx={X(m.at)} cy={y + 11} r={4} fill={C.band} stroke={C.white} strokeWidth={1.2} /></g>)}
        </g>;
      })}
    </svg>
  );
}
