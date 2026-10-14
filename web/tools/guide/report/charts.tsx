/* The full report's pictures (direction C, .impeccable/surfaces/guide-report.md):
   the trail map of savings, the trail by age, each year's money by source,
   every historical retirement, and the pages' smaller charts. Drawn at a
   fixed size for a US Letter page in the report's own print palette, never
   the screen theme. Every figure comes from the report model. */

import { money } from "@/lib/format";
import { rounded } from "../words";
import type { PhaseId, ReportModel } from "./model";

/** The report's palette: NPS map colors, fixed for print. */
export const C = {
  ink: "var(--rp-ink)", ink2: "var(--rp-ink2)", land: "var(--rp-land)", grid: "var(--rp-grid)", rule: "var(--rp-rule)", white: "var(--rp-white)", band: "var(--rp-band)",
  forest: "var(--rp-forest)", forestText: "var(--rp-forest-text)", woods: "var(--rp-woods)", woodsLight: "var(--rp-woods-light)", trail: "var(--rp-trail)", water: "var(--rp-water)",
  sand: "var(--rp-sand)", clay: "var(--rp-clay)", dusk: "var(--rp-dusk)", sky: "var(--rp-sky)", gray: "var(--rp-gray)", ember: "var(--rp-ember)",
};

export const PHASE_COLOR: Record<PhaseId, string> = { save: C.forest, early: C.sand, medicare: C.clay, ssEarly: C.sky, ss: C.water, rmd: C.dusk };
export const SOURCE_COLOR: Record<string, string> = { ss: C.water, pension: C.dusk, trad: C.forest, roth: C.woods, brok: C.sand };
export const OUT_COLOR: Record<string, string> = { spent: C.ink, tax: C.trail, health: C.clay, pen: C.ember, surplus: C.sand };

/** $1.5M, $400K, $0: axis labels. */
export function axis(v: number): string {
  if (v >= 1e6) return "$" + (v / 1e6).toFixed(v % 1e6 ? 1 : 0) + "M";
  if (v >= 1e3) return "$" + Math.round(v / 1e3) + "K";
  return "$" + Math.round(v);
}
/** Gridline steps up to a little past `max`. */
export function ticks(max: number, n = 4) {
  const m = Math.max(1, max), mag = Math.pow(10, Math.floor(Math.log10(m / n)));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => m / s <= n + 0.5) ?? mag * 10;
  const top = Math.ceil(m / step) * step, list: number[] = [];
  for (let v = 0; v <= top + 1e-6; v += step) list.push(v);
  return { top, list };
}

/** Text in a chart: weight and size go to the stylesheet as custom properties. */
const T = ({ x, y, children, a = "start", w = 600, s = 11, c = C.ink }: { x: number; y: number; children: React.ReactNode; a?: "start" | "middle" | "end"; w?: number; s?: number; c?: string }) =>
  <text x={x} y={y} textAnchor={a} className="rp-tx" style={{ "--fw": w, "--fs": s + "px" } as React.CSSProperties} fill={c}>{children}</text>;
const Grid = ({ list, Y, x1, x2 }: { list: number[]; Y: (v: number) => number; x1: number; x2: number }) => (
  <>{list.map((v) => <g key={v}><line x1={x1} x2={x2} y1={Y(v)} y2={Y(v)} stroke={C.grid} strokeWidth={v ? 0.6 : 1} />
    <text x={x1 - 6} y={Y(v) + 3.5} textAnchor="end" className="rp-ax">{axis(v)}</text></g>)}</>
);
const StopMark = ({ x, y, n }: { x: number; y: number; n: number }) => (
  <g><circle cx={x} cy={y} r={10} fill={C.band} stroke={C.white} strokeWidth={2} />
    <text x={x} y={y + 3.6} textAnchor="middle" className="rp-stopn" fill={C.white}>{n}</text></g>
);

/** Savings from today to the plan's end: the climb, then the historical
    range (every start, and the middle eight in ten) and the middle path,
    with the numbered stops. */
export function LifeMap({ M, w = 732, h = 470 }: { M: ReportModel; w?: number; h?: number }) {
  const pl = 50, pr = 10, pt = 20, pb = 26, x0 = M.accum[0].age, x1 = M.end;
  const cap = Math.max(M.S.fv * 4, ...M.band.map((b) => b.hi)) * 1.02;
  const { top, list } = ticks(Math.min(cap, Math.max(...M.band.map((b) => b.max), M.S.fv) * 1.05));
  const X = (v: number) => pl + ((v - x0) / Math.max(1, x1 - x0)) * (w - pl - pr), Y = (v: number) => pt + (1 - Math.min(Math.max(v, 0), top) / top) * (h - pt - pb);
  const poly = (a: { age: number; v: number }[]) => a.map((p) => X(p.age) + "," + Y(p.v)).join(" ");
  const back = <T,>(a: T[]) => a.slice().reverse();
  const valAt = (g: number) => (g <= M.retire ? M.accum[Math.min(M.accum.length - 1, g - x0)]?.v ?? M.S.fv : M.band[Math.min(M.band.length - 1, g - M.retire)]?.mid ?? 0);
  const last = M.band[M.band.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label="Your savings from today to the end of the plan, with the range of historical outcomes">
      <Grid list={list} Y={Y} x1={pl} x2={w - pr} />
      {[40, 50, 60, 70, 80, 90, 100].filter((g) => g > x0 && g < x1).map((g) => <text key={g} x={X(g)} y={h - 6} textAnchor="middle" className="rp-ax">{g}</text>)}
      <polygon points={poly(M.band.map((b) => ({ age: b.age, v: b.max }))) + " " + poly(back(M.band).map((b) => ({ age: b.age, v: b.min })))} fill={C.woodsLight} />
      <polygon points={poly(M.band.map((b) => ({ age: b.age, v: b.hi }))) + " " + poly(back(M.band).map((b) => ({ age: b.age, v: b.lo })))} fill={C.woods} />
      <line x1={X(M.retire)} x2={X(M.retire)} y1={pt} y2={h - pb} stroke={C.ink2} strokeDasharray="2 3" />
      <polyline points={poly(M.accum) + " " + poly(M.band.map((b) => ({ age: b.age, v: b.mid })))} fill="none" stroke={C.trail} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
      {M.stops.map((s, i) => <StopMark key={i} x={X(s.age)} y={Y(valAt(s.age))} n={i + 1} />)}
      <T x={X(M.retire) + 14} y={Y(M.S.fv) - 14} w={800} s={13}>{rounded(M.S.fv)} at {M.retire}</T>
      {last ? <><T x={X(x1) - 4} y={Y(last.hi) - 8} a="end" s={10} c={C.forestText}>Best 10% of histories</T>
        <T x={X(x1) - 4} y={Math.min(h - pb - 4, Y(last.lo) + 16)} a="end" s={10} c={C.forestText}>Worst 10%</T></> : null}
    </svg>
  );
}

/** The trail by age: each phase of the plan as a colored stretch, with the
    numbered stops. */
export function Trail({ M, w = 708, h = 164 }: { M: ReportModel; w?: number; h?: number }) {
  const x0 = M.phases[0].from, x1 = M.end + 1, y = 82, X = (v: number) => 8 + ((v - x0) / Math.max(1, x1 - x0)) * (w - 16);
  // Labels take the first of four rows (above, below, further above,
  // further below) where they don't run into one already placed.
  const rowsY = [y - 18, y + 46, y - 36, y + 64], taken: [number, number][][] = [[], [], [], []];
  const place = M.stops.map((s, i) => {
    const tw = s.t.length * 6.3, x = X(s.age), anchor = i === 0 ? "start" : i === M.stops.length - 1 ? "end" : "middle";
    const lo = anchor === "start" ? x : anchor === "end" ? x - tw : x - tw / 2, hi = lo + tw;
    const r = [0, 1, 2, 3].find((k) => taken[k].every(([a, b]) => hi + 8 < a || lo - 8 > b)) ?? i % 4;
    taken[r].push([lo, hi]);
    return { x, anchor: anchor as "start" | "middle" | "end", y: rowsY[r] };
  });
  const marks: number[] = [];
  for (let g = Math.ceil(x0 / 5) * 5; g < x1; g += 5) marks.push(g);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label="The phases of your plan by age">
      {M.phases.map((p) => <line key={p.from} x1={X(p.from)} x2={X(p.to)} y1={y} y2={y} stroke={PHASE_COLOR[p.id]} strokeWidth={12} />)}
      {marks.map((g) => <g key={g}><line x1={X(g)} x2={X(g)} y1={y + 9} y2={y + 15} stroke={C.band} />{g % 10 === 0 ? <text x={X(g)} y={y + 28} textAnchor="middle" className="rp-ax">{g}</text> : null}</g>)}
      {M.stops.map((s, i) => <g key={i}><StopMark x={place[i].x} y={y} n={i + 1} /><T x={place[i].x} y={place[i].y} a={place[i].anchor} w={700}>{s.t}</T></g>)}
    </svg>
  );
}

/** Each year of retirement's money, stacked by where it comes from, with
    what's spent as a dashed line. */
export function IncomeBars({ M, w = 440, h = 300 }: { M: ReportModel; w?: number; h?: number }) {
  const pl = 46, pr = 10, pt = 10, pb = 24, keys = ["ss", "pension", "trad", "roth", "brok"] as const;
  const tot = (r: ReportModel["rows"][number]) => keys.reduce((t, k) => t + Math.max(0, r[k]), 0);
  const { top, list } = ticks(Math.max(...M.rows.map(tot), M.S.spend));
  const n = M.rows.length, bw = (w - pl - pr) / n, X = (i: number) => pl + i * bw, Y = (v: number) => pt + (1 - v / top) * (h - pt - pb);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label="Each year of retirement by where the money comes from">
      <Grid list={list} Y={Y} x1={pl} x2={w - pr} />
      {M.rows.map((r, i) => {
        let acc = 0;
        return <g key={i}>{keys.map((k) => {
          const v = Math.max(0, r[k]);
          if (v <= 0) return null;
          const el = <rect key={k} x={X(i) + bw * 0.12} width={bw * 0.76} y={Y(acc + v)} height={Y(acc) - Y(acc + v)} fill={SOURCE_COLOR[k]} />;
          acc += v;
          return el;
        })}{r.age % 5 === 0 ? <text x={X(i) + bw / 2} y={h - 6} textAnchor="middle" className="rp-ax">{r.age}</text> : null}</g>;
      })}
      <polyline points={M.rows.map((r, i) => X(i) + bw / 2 + "," + Y(r.spend)).join(" ")} fill="none" stroke={C.trail} strokeWidth={1.6} strokeDasharray="5 3" />
    </svg>
  );
}
export function IncomeKey({ M }: { M: ReportModel }) {
  const has = (k: "ss" | "pension" | "trad" | "roth" | "brok") => M.rows.some((r) => r[k] >= 100);
  const names: [("ss" | "pension" | "trad" | "roth" | "brok"), string][] = [["ss", "Social Security"], ["pension", "Pension"], ["trad", "Traditional accounts"], ["roth", "Roth"], ["brok", "Brokerage"]];
  return (
    <div className="rp-key">{names.filter(([k]) => has(k)).map(([k, t]) => <span key={k}><i style={{ "--sw": SOURCE_COLOR[k] } as React.CSSProperties} />{t}</span>)}
      <span><i className="dash" style={{ "--sw": C.trail } as React.CSSProperties} />{money(M.S.spend)} you spend</span></div>
  );
}

/** Every historical start: what was left at the end (or nothing), with the
    lowest point along the way. */
export function HistoryBars({ M, w = 732, h = 330 }: { M: ReportModel; w?: number; h?: number }) {
  const pl = 50, pb = 22, pt = 10, n = M.runs.length;
  const { top, list } = ticks(Math.max(...M.runs.map((r) => r.end), 1));
  const bw = (w - pl) / n, Y = (v: number) => pt + (1 - Math.min(Math.max(v, 0), top) / top) * (h - pt - pb);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label="What was left at the end of the plan for each historical starting year">
      <Grid list={list} Y={Y} x1={pl} x2={w} />
      {M.runs.map((r, i) => {
        const x = pl + i * bw;
        return <g key={r.y}>
          {r.ok ? <rect x={x + bw * 0.14} width={bw * 0.72} y={Y(r.end)} height={Y(0) - Y(r.end)} fill={r.y === M.worst.y ? C.trail : C.forest} />
            : <path d={`M${x + bw * 0.2} ${Y(0) - 7} l${bw * 0.6} 6 M${x + bw * 0.8} ${Y(0) - 7} l${-bw * 0.6} 6`} stroke={C.trail} strokeWidth={1.8} />}
          {r.ok ? <rect x={x + bw * 0.14} width={bw * 0.72} y={Y(r.low) - 1} height={2.4} fill={C.band} /> : null}
          {r.y % 10 === 6 && x + bw / 2 + 14 < w ? <text x={x + bw / 2} y={h - 6} textAnchor="middle" className="rp-ax">{r.y}</text> : null}
        </g>;
      })}
    </svg>
  );
}

/** One year's figure per bar, by age: income tax, health insurance. */
export function YearBars({ M, f, color, w = 430, h = 190, stack, ages }: {
  M: ReportModel; f: (r: ReportModel["rows"][number]) => number; color: string; w?: number; h?: number;
  stack?: { f: (r: ReportModel["rows"][number]) => number; color: string }; ages?: (age: number) => boolean;
}) {
  const rows = ages ? M.rows.filter((r) => ages(r.age)) : M.rows, pl = 46, pb = 22, pt = 8;
  const { top, list } = ticks(Math.max(...rows.map(f), 1));
  const bw = (w - pl) / Math.max(1, rows.length), Y = (v: number) => pt + (1 - v / top) * (h - pt - pb), every = rows.length > 16 ? 5 : 1;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label="Each year's figure by age">
      <Grid list={list} Y={Y} x1={pl} x2={w} />
      {rows.map((r, i) => {
        const x = pl + i * bw, under = stack ? Math.min(stack.f(r), f(r)) : 0;
        return <g key={r.age}>
          {stack && under > 0 ? <rect x={x + bw * 0.14} width={bw * 0.72} y={Y(under)} height={Y(0) - Y(under)} fill={stack.color} /> : null}
          <rect x={x + bw * 0.14} width={bw * 0.72} y={Y(f(r))} height={Math.max(0, Y(under) - Y(f(r)))} fill={color} />
          {r.age % every === 0 ? <text x={x + bw / 2} y={h - 6} textAnchor="middle" className="rp-ax">{r.age}</text> : null}
        </g>;
      })}
    </svg>
  );
}

/** What's on course against what's needed. */
export function NeedBars({ M, w = 330, h = 150 }: { M: ReportModel; w?: number; h?: number }) {
  const max = Math.max(M.S.fv, M.need) * 1.08, X = (v: number) => (v / max) * w, diff = M.S.fv - M.need;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label="Your savings at retirement against what the plan needs">
      <T x={0} y={13} w={700}>On course for at {M.retire}</T>
      <rect x={0} y={20} width={X(M.S.fv)} height={38} fill={diff >= 0 ? C.forest : C.clay} />
      <T x={8} y={44} w={800} s={15} c={C.white}>{money(M.S.fv)}</T>
      <T x={0} y={86} w={700}>What a plan like yours needs</T>
      <rect x={0.75} y={93} width={X(M.need)} height={38} fill="none" stroke={C.ink} strokeWidth={1.5} strokeDasharray="4 3" />
      <T x={8} y={117} w={800} s={15}>{money(M.need)}</T>
      <T x={Math.min(X(Math.max(M.need, M.S.fv)) + 6, w - 120)} y={h - 4} s={10} c={C.ink2}>{diff >= 0 ? money(diff) + " to spare" : money(-diff) + " short"}</T>
    </svg>
  );
}

/** Lifetime money in and out of retirement, as two stacked bars. */
export function LifetimeBars({ M, w = 708, h = 120 }: { M: ReportModel; w?: number; h?: number }) {
  const tin = M.money.in.reduce((t, x) => t + x[1], 0), X = (v: number) => (v / Math.max(1, tin)) * w;
  const row = (y: number, list: [string, number, string][], col: Record<string, string>) => {
    let x = 0;
    return list.filter((p) => p[1] >= 500).map(([t, v, k]) => {
      const bw = X(v), el = <g key={k}><rect x={x} y={y} width={bw} height={34} fill={col[k]} stroke={C.white} strokeWidth={1.5} />
        {bw > 72 ? <><T x={x + 7} y={y + 14} w={700} s={10} c={C.white}>{t}</T><T x={x + 7} y={y + 28} w={800} s={11.5} c={C.white}>{rounded(v)}</T></> : null}</g>;
      x += bw;
      return el;
    });
  };
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label="Every dollar of retirement, in and out">
      <T x={0} y={11} w={700}>In: {rounded(tin)} over {M.rows.length} years</T>
      {row(16, M.money.in, SOURCE_COLOR)}
      <T x={0} y={74} w={700}>Out</T>
      {row(80, M.money.out, OUT_COLOR)}
    </svg>
  );
}

/** The score as a ring: each area's share of its points. */
export function ScoreRing({ M }: { M: ReportModel }) {
  const r = 78, c = 2 * Math.PI * r, col = [C.forest, C.water, C.clay, C.sand, C.dusk];
  const starts = M.factors.map((_, i) => M.factors.slice(0, i).reduce((t, f) => t + (f.w / 100) * c, 0));
  return (
    <svg viewBox="0 0 200 200" width={200} height={200} role="img" aria-label={"Readiness score " + M.R.score + " out of 100"}>
      <circle cx={100} cy={100} r={r} fill="none" stroke={C.rule} strokeWidth={22} />
      {M.factors.map((f, i) => {
        const p = M.R.P[f.id]?.p ?? 0, got = (p * f.w) / 100 * c;
        return <circle key={f.id} cx={100} cy={100} r={r} fill="none" stroke={col[i]} strokeWidth={22}
          strokeDasharray={got + " " + (c - got)} strokeDashoffset={-starts[i]} transform="rotate(-90 100 100)" />;
      })}
      <T x={100} y={104} a="middle" w={800} s={44}>{M.R.score}</T>
      <T x={100} y={126} a="middle" s={12} c={C.ink2}>out of 100</T>
    </svg>
  );
}
export const RING_COLORS = [C.forest, C.water, C.clay, C.sand, C.dusk];

/** The rating bands, with where this plan sits. */
export function RatingScale({ score, w = 732 }: { score: number; w?: number }) {
  const bands: [number, number, string, string][] = [[0, 30, "Needs attention", C.trail], [30, 50, "Needs work", C.clay], [50, 70, "Getting there", C.sand], [70, 85, "Nearly there", C.woods], [85, 101, "On track", C.forest]];
  const X = (v: number) => (Math.min(v, 100) / 100) * w, sx = Math.min(w - 30, Math.max(30, X(score)));
  return (
    <svg viewBox={`0 0 ${w} 92`} width={w} height={92} role="img" aria-label={"The rating bands; your score is " + score}>
      {bands.map(([f, t, n, c]) => <g key={n}><rect x={X(f)} y={26} width={X(t) - X(f)} height={22} fill={c} stroke={C.white} strokeWidth={2} />
        <T x={X(f) + 6} y={68} w={700}>{n}</T><T x={X(f) + 6} y={83} w={500} s={10} c={C.ink2}>{t > 100 ? f + " and up" : f + " to " + (t - 1)}</T></g>)}
      <path d={`M${X(score)} 22 l-7 -10 h14 z`} fill={C.band} />
      <T x={sx} y={9} a="middle" w={800}>You, {score}</T>
    </svg>
  );
}

/* ---------- the saving schedule ---------- */
export function Stairs({ M, w = 708, h = 230 }: { M: ReportModel; w?: number; h?: number }) {
  const Ch = M.changes!, pl = 50, pr = 8, pt = 22, pb = 24, x0 = M.accum[0].age, x1 = M.retire;
  const most = Math.max(...Ch.sched.map((s) => s.monthly), Ch.monthly), { top, list } = ticks(most * 1.12, 3);
  const X = (v: number) => pl + ((v - x0) / Math.max(1, x1 - x0)) * (w - pl - pr), Y = (v: number) => pt + (1 - v / top) * (h - pt - pb);
  const marks: number[] = [];
  for (let g = Math.ceil(x0 / 5) * 5; g < x1; g += 5) marks.push(g);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label="Retirement saving each month by age">
      <Grid list={list} Y={Y} x1={pl} x2={w - pr} />
      <line x1={pl} x2={w - pr} y1={Y(Ch.monthly)} y2={Y(Ch.monthly)} stroke={C.ink} strokeDasharray="4 3" />
      {Ch.sched.map((s) => {
        const x = X(s.from), bw = X(s.to) - x, short = s.short ?? 0;
        return <g key={s.from}>
          {s.monthly > 0 ? <rect x={x + 1} y={Y(s.monthly)} width={bw - 2} height={Y(0) - Y(s.monthly)} fill={C.forest} />
            : <rect x={x + 1} y={Y(0) - 6} width={bw - 2} height={6} fill={short ? C.trail : C.gray} />}
          <T x={x + bw / 2} y={(s.monthly > 0 ? Y(s.monthly) : Y(0) - 6) - 7} a="middle" w={800} s={bw < 60 ? 10 : 12} c={short ? C.trail : C.ink}>
            {s.monthly > 0 ? money(s.monthly) : short ? "$0, " + money(short) + " short" : "$0"}</T>
        </g>;
      })}
      <T x={X(Ch.sched[0].to) + 6} y={Y(Ch.monthly) - 5} s={10}>{money(Ch.monthly)} you save today</T>
      {marks.map((g) => <text key={g} x={X(g)} y={h - 6} textAnchor="middle" className="rp-ax">{g}</text>)}
    </svg>
  );
}
export function HomeStrip({ M, w = 708 }: { M: ReportModel; w?: number }) {
  const Ch = M.changes!, pl = 50, pr = 8, x0 = M.accum[0].age, x1 = M.retire, X = (v: number) => pl + ((v - x0) / Math.max(1, x1 - x0)) * (w - pl - pr);
  const segs: { from: number; to: number; n: number }[] = [];
  Ch.house.forEach((hh) => { const l = segs[segs.length - 1]; if (l && l.n === hh.n) l.to = hh.age + 1; else segs.push({ from: hh.age, to: hh.age + 1, n: hh.n }); });
  const col = (n: number) => (n <= 2 ? C.rule : n === 3 ? C.woodsLight : C.woods);
  return (
    <svg viewBox={`0 0 ${w} 54`} width={w} height={54} role="img" aria-label="Who lives at home, by age">
      <T x={pl - 6} y={27} a="end" w={700} s={10}>Home</T>
      {segs.map((g) => <g key={g.from}><rect x={X(g.from) + 1} y={10} width={X(g.to) - X(g.from) - 2} height={26} fill={col(g.n)} />
        {X(g.to) - X(g.from) > 56 ? <T x={X(g.from) + 8} y={27} s={10.5}>{g.n} {g.n === 1 ? "person" : "people"}</T> : null}</g>)}
      {Ch.sched.filter((s) => X(s.to) - X(s.from) > 96).map((s) => <T key={s.from} x={X(s.from) + 3} y={50} w={500} s={9.5} c={C.ink2}>{s.label}</T>)}
    </svg>
  );
}
export function TwoPaths({ M, w = 430, h = 220 }: { M: ReportModel; w?: number; h?: number }) {
  const Ch = M.changes!, flat = Ch.flat!, pl = 50, pr = 10, pt = 14, pb = 24, x0 = M.accum[0].age, x1 = M.retire;
  const { top, list } = ticks(Math.max(flat.fv, M.S.fv) * 1.05);
  const X = (v: number) => pl + ((v - x0) / Math.max(1, x1 - x0)) * (w - pl - pr), Y = (v: number) => pt + (1 - v / top) * (h - pt - pb);
  const line = (p: number[]) => p.map((v, i) => X(x0 + i) + "," + Y(v)).join(" ");
  const marks: number[] = [];
  for (let g = Math.ceil(x0 / 5) * 5; g < x1; g += 5) marks.push(g);
  const higher = flat.fv >= M.S.fv;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label="Savings at retirement with and without your changes ahead">
      <Grid list={list} Y={Y} x1={pl} x2={w - pr} />
      <polyline points={line(flat.path)} fill="none" stroke={C.gray} strokeWidth={2.6} strokeDasharray="5 4" />
      <polyline points={line(M.S.path)} fill="none" stroke={C.trail} strokeWidth={2.6} />
      <T x={X(x1) - 4} y={Y(flat.fv) + (higher ? -8 : 18)} a="end" w={700} c={C.ink2}>{rounded(flat.fv)} without the changes</T>
      <T x={X(x1) - 4} y={Y(M.S.fv) + (higher ? 18 : -8)} a="end" w={800} c={C.trail}>{rounded(M.S.fv)} with them</T>
      {marks.map((g) => <text key={g} x={X(g)} y={h - 6} textAnchor="middle" className="rp-ax">{g}</text>)}
    </svg>
  );
}

/* ---------- college ---------- */
const KID_COLOR = [C.sand, C.clay, C.dusk, C.water];
export function CollegeTimeline({ M, w = 708, h0 = 40 }: { M: ReportModel; w?: number; h0?: number }) {
  const K = M.college!, pl = 150, pr = 8, x0 = M.accum[0].age, x1 = Math.max(M.retire + 4, ...K.kids.map((k) => k.to + 1));
  const rows: [string, number, number, string, string][] = [["Saving for college", x0, K.saveUntil, C.water, money(K.monthly) + "/mo"],
    ...K.kids.map((k, i): [string, number, number, string, string] => [K.kids.length > 1 ? ["First", "Second", "Third", "Fourth"][i] + " child in college" : "College", k.from, k.to, KID_COLOR[i % 4], k.from + " to " + k.to])];
  const h = h0 + rows.length * 36, X = (v: number) => pl + ((v - x0) / Math.max(1, x1 - x0)) * (w - pl - pr);
  const marks: number[] = [];
  for (let g = Math.ceil(x0 / 5) * 5; g <= x1; g += 5) marks.push(g);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label="The college years beside your own">
      <defs><pattern id="rp-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke={C.trail} strokeWidth="2.2" /></pattern></defs>
      {marks.map((g) => <g key={g}><line x1={X(g)} x2={X(g)} y1={6} y2={h - 22} stroke={C.rule} /><text x={X(g)} y={h - 6} textAnchor="middle" className="rp-ax">{g}</text></g>)}
      <rect x={X(M.retire)} y={6} width={X(x1) - X(M.retire)} height={h - 28} fill={C.land} />
      <line x1={X(M.retire)} x2={X(M.retire)} y1={0} y2={h - 22} stroke={C.ink} strokeWidth={1.5} />
      <T x={X(M.retire) + 5} y={12} w={800} s={10.5}>Retire, {M.retire}</T>
      {rows.map(([t, f, to, c, lab], i) => {
        const y = 22 + i * 36;
        return <g key={i}><T x={0} y={y + 15} w={700}>{t}</T><rect x={X(f)} y={y} width={Math.max(2, X(to) - X(f))} height={22} fill={c} />
          {i && to > M.retire && f < x1 ? <rect x={X(Math.max(f, M.retire))} y={y} width={X(to) - X(Math.max(f, M.retire))} height={22} fill="url(#rp-hatch)" /> : null}
          <T x={X(f) + 6} y={y + 15} w={700} s={10.5} c={C.white}>{lab}</T></g>;
      })}
    </svg>
  );
}
export function CollegeBars({ M, w = 430, h = 210 }: { M: ReportModel; w?: number; h?: number }) {
  const K = M.college!, list = K.kids.flatMap((k, i) => k.billsToday.map((v, j) => ({ age: k.from + j, v, i })));
  const lo = Math.min(...list.map((b) => b.age)), hi = Math.max(...list.map((b) => b.age)), ages: number[] = [];
  for (let g = lo; g <= hi; g++) ages.push(g);
  const pl = 50, pb = 24, pt = 16, { top, list: tk } = ticks(Math.max(...list.map((b) => b.v)) * 1.1, 4);
  const bw = (w - pl) / ages.length, Y = (v: number) => pt + (1 - v / top) * (h - pt - pb), every = ages.length > 16 ? 2 : 1;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label="Each year's college bill in today's dollars">
      <Grid list={tk} Y={Y} x1={pl} x2={w} />
      {ages.map((g, i) => {
        const bills = list.filter((b) => b.age === g), x = pl + i * bw;
        let acc = 0;
        return <g key={g}>{bills.map((b) => { const el = <rect key={b.i} x={x + bw * 0.14} width={bw * 0.72} y={Y(acc + b.v)} height={Y(acc) - Y(acc + b.v)} fill={KID_COLOR[b.i % 4]}
          stroke={g >= M.retire ? C.trail : "none"} strokeWidth={2} />; acc += b.v; return el; })}
          {(g - lo) % every === 0 ? <text x={x + bw / 2} y={h - 6} textAnchor="middle" className="rp-ax">{g}</text> : null}</g>;
      })}
    </svg>
  );
}
export const collegeColor = (i: number) => KID_COLOR[i % 4];

/** The report's copy of the logo, in the original brand colors on the black band. */
export function ReportMark() {
  return (
    <svg className="rp-mark" viewBox="4 4 56 56" aria-hidden="true">
      <g transform="rotate(-45 32 32)">
        <path className="steel" d="M33 7 L11.5 28.5 M33 57 L11.5 35.5" fill="none" strokeWidth="2" />
        <path className="jade" d="M33 7 C31 10 34 13 39 17 Q53 32 39 47 C34 51 31 54 33 57" fill="none" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
        <path className="gold" d="M7 32 H51" strokeWidth="3.2" strokeLinecap="round" />
        <path className="goldfill" d="M60 32 L48 25.5 L50.5 32 L48 38.5 Z M11 32 L6 25.5 H11 L18 32 Z M11 32 L6 38.5 H11 L18 32 Z" />
      </g>
    </svg>
  );
}

/* ---------- the conditional pages ---------- */
type Row = ReportModel["rows"][number];
/** Each year's figures stacked by part, with an optional line across them. */
export function StackBars({ rows, parts, line, w = 430, h = 220, max: maxIn }: {
  rows: Row[]; parts: { f: (r: Row) => number; color: string }[]; line?: { f: (r: Row) => number; color: string }; w?: number; h?: number; max?: number;
}) {
  const pl = 50, pb = 22, pt = 10, n = Math.max(1, rows.length);
  const { top, list } = ticks(maxIn ?? Math.max(1, ...rows.map((r) => parts.reduce((t, p) => t + Math.max(0, p.f(r)), 0)), ...(line ? rows.map(line.f) : [])));
  const bw = (w - pl) / n, Y = (v: number) => pt + (1 - Math.min(v, top) / top) * (h - pt - pb), every = n > 16 ? 5 : n > 10 ? 2 : 1;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label="Each year's figures by age">
      <Grid list={list} Y={Y} x1={pl} x2={w} />
      {rows.map((r, i) => {
        const x = pl + i * bw;
        let acc = 0;
        return <g key={r.age}>{parts.map((p, j) => {
          const v = Math.max(0, p.f(r));
          if (v <= 0) return null;
          const el = <rect key={j} x={x + bw * 0.14} width={bw * 0.72} y={Y(acc + v)} height={Y(acc) - Y(acc + v)} fill={p.color} />;
          acc += v;
          return el;
        })}{r.age % every === 0 || n <= 10 ? <text x={x + bw / 2} y={h - 6} textAnchor="middle" className="rp-ax">{r.age}</text> : null}</g>;
      })}
      {line ? <polyline points={rows.map((r, i) => pl + i * bw + bw / 2 + "," + Y(line.f(r))).join(" ")} fill="none" stroke={line.color} strokeWidth={1.6} strokeDasharray="5 3" /> : null}
    </svg>
  );
}

/** One person's benefit claiming at each age from 62 to 70, the plan's own age marked. */
export function ClaimLadder({ list, pick, w = 330, h = 190 }: { list: { age: number; v: number }[]; pick: number; w?: number; h?: number }) {
  const pl = 46, pb = 22, pt = 18, { top, list: tk } = ticks(Math.max(...list.map((x) => x.v / 12)) * 1.08, 3);
  const bw = (w - pl) / list.length, Y = (v: number) => pt + (1 - v / top) * (h - pt - pb);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label="The monthly benefit for each claiming age from 62 to 70">
      <Grid list={tk} Y={Y} x1={pl} x2={w} />
      {list.map((x, i) => {
        const bx = pl + i * bw, m = x.v / 12, on = x.age === pick;
        return <g key={x.age}><rect x={bx + bw * 0.16} width={bw * 0.68} y={Y(m)} height={Y(0) - Y(m)} fill={on ? C.water : C.woodsLight} />
          {on ? <T x={bx + bw / 2} y={Y(m) - 5} a="middle" w={800} s={10}>{money(m)}</T> : null}
          <text x={bx + bw / 2} y={h - 6} textAnchor="middle" className="rp-ax">{x.age}</text></g>;
      })}
    </svg>
  );
}

/** Each debt from today to the month it's cleared, in the order paid. */
export function DebtLines({ order, months, w = 708 }: { order: { desc: string; apr: number; month: number }[]; months: number; w?: number }) {
  const pl = 170, pr = 10, rh = 30, h = 26 + order.length * rh, X = (m: number) => pl + (m / Math.max(1, months)) * (w - pl - pr);
  const step = months > 60 ? 24 : months > 24 ? 12 : 6, marks: number[] = [];
  for (let m = 0; m <= months; m += step) marks.push(m);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label="When each debt is paid off">
      {marks.map((m) => <g key={m}><line x1={X(m)} x2={X(m)} y1={0} y2={h - 20} stroke={C.rule} /><text x={X(m)} y={h - 6} textAnchor="middle" className="rp-ax">{m ? (m % 12 === 0 ? m / 12 + (m === 12 ? " year" : " years") : m + " mo") : "Now"}</text></g>)}
      {order.map((d, i) => {
        const y = 4 + i * rh, hiRate = d.apr >= 8;
        return <g key={i}><T x={0} y={y + 15} w={700}>{d.desc}</T><T x={pl - 10} y={y + 15} a="end" w={500} s={10} c={C.ink2}>{d.apr.toFixed(1)}%</T>
          <rect x={X(0)} y={y} width={Math.max(2, X(d.month) - X(0))} height={20} fill={hiRate ? C.trail : C.clay} />
          {X(d.month) > w - 64 ? <T x={X(d.month) - 6} y={y + 14} a="end" w={700} s={10} c={C.white}>{d.month < 12 ? d.month + " mo" : (d.month / 12).toFixed(1) + " yrs"}</T>
            : <T x={X(d.month) + 6} y={y + 14} w={700} s={10}>{d.month < 12 ? d.month + " mo" : (d.month / 12).toFixed(1) + " yrs"}</T>}</g>;
      })}
    </svg>
  );
}
