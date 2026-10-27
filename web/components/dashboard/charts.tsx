"use client";

/* The Dashboard's drawings: net worth over the years, the life timeline and
   the readiness score's split bar. The two charts are drawn at the width
   they're given, so their text stays the size of the page's. */

import { useLayoutEffect, useRef, useState } from "react";
import { shortMoney } from "./format";
import type { Point } from "./model";

/** The width of the element, kept current as the window changes. */
export function useWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(280, Math.round(el.clientWidth))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function niceStep(max: number) {
  const s = Math.pow(10, Math.floor(Math.log10(Math.max(1, max) / 4)));
  return [1, 2, 2.5, 5, 10].map((k) => k * s).find((k) => max / k <= 5) ?? s * 10;
}

/** What the hover readout says for a year on the chart. */
export interface Readout { title: string; rows: [string, string][] }

/** Net worth: the entries as a solid line, the plan dotted, and in
    retirement the band 8 in 10 historical markets fell within. Pointing
    at it (or tapping) shows that year's figures. */
export function NetWorthChart({ hist, proj, marks, until, height = 270, describe }: {
  hist: { t: number; v: number; date?: string }[]; proj: Point[]; marks: { t: number; label: string }[]; until?: number; height?: number;
  describe?: (p: { t: number; v: number; lo: number; hi: number; entry?: string }) => Readout;
}) {
  const [ref, W] = useWidth(900);
  const [at, setAt] = useState<number | null>(null);
  const H = height, L = 56, R = 16, T = 18, B = 26;
  const pts = proj.filter((p) => p.t <= (until ?? Infinity));
  if (!pts.length) return <div ref={ref} />;
  const x0 = hist.length ? Math.min(hist[0].t, pts[0].t) : pts[0].t, x1 = Math.max(pts[pts.length - 1].t, x0 + 1);
  const ymax = Math.max(...pts.map((p) => p.hi), ...hist.map((h) => h.v)) * 1.05;
  const step = niceStep(ymax), top = Math.ceil(ymax / step) * step || step;
  const X = (t: number) => L + ((t - x0) / (x1 - x0)) * (W - L - R), Y = (v: number) => T + (1 - Math.max(0, v) / top) * (H - T - B);
  const span = x1 - x0, every = span > 40 ? 10 : span > 18 ? 5 : span > 6 ? 2 : 1;
  const grid: number[] = [];
  for (let v = 0; v <= top + 1; v += step) grid.push(v);
  const years: number[] = [];
  for (let y = Math.ceil(x0 / every) * every; y <= x1; y += every) years.push(y);
  const line = (arr: { t: number; v: number }[]) => arr.map((p, k) => (k ? "L" : "M") + X(p.t).toFixed(1) + " " + Y(p.v).toFixed(1)).join(" ");
  const banded = pts.filter((p) => p.hi > p.lo);
  const band = banded.length > 1
    ? line(banded.map((p) => ({ t: p.t, v: p.hi }))) + " " + banded.slice().reverse().map((p) => "L" + X(p.t).toFixed(1) + " " + Y(p.lo).toFixed(1)).join(" ") + " Z"
    : null;
  // The point under the pointer: an entry when one is close, else the plan.
  const pick = (t: number) => {
    const h = hist.reduce<(typeof hist)[number] | null>((b, p) => (Math.abs(p.t - t) < Math.abs((b?.t ?? Infinity) - t) ? p : b), null);
    if (h && Math.abs(X(h.t) - X(t)) < 10) return { t: h.t, v: h.v, lo: h.v, hi: h.v, entry: h.date };
    return pts.reduce((b, p) => (Math.abs(p.t - t) < Math.abs(b.t - t) ? p : b), pts[0]);
  };
  const hot = at != null ? pick(at) : null;
  const read = hot && describe ? describe(hot) : null;
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * W;
    setAt(x < L || x > W - R ? null : x0 + ((x - L) / (W - L - R)) * (x1 - x0));
  };
  const left = hot ? X(hot.t) > W * 0.6 : false;
  return (
    <div ref={ref} className="dsh-chartwrap">
      <svg className="dsh-chart" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Net worth: your entries and the plan ahead"
        onPointerMove={describe ? move : undefined} onPointerDown={describe ? move : undefined} onPointerLeave={() => setAt(null)}>
        {grid.map((v) => (
          <g key={v}><line className="dsh-gl" x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} /><text x={L - 8} y={Y(v) + 4} textAnchor="end">{shortMoney(v)}</text></g>
        ))}
        {years.map((y) => <text key={y} x={X(y)} y={H - 6} textAnchor="middle">{y}</text>)}
        {band ? <path className="dsh-band" d={band} /> : null}
        {marks.filter((m) => m.t >= x0 && m.t <= x1).map((m, i) => (
          <g key={m.label}><line className="dsh-mk" x1={X(m.t)} x2={X(m.t)} y1={T + 14 + i * 16} y2={H - B} />
            {/* Left of its line when it would run past the chart's edge. */}
            {X(m.t) + 5 + m.label.length * 6.6 > W - R
              ? <text className="dsh-ml" x={X(m.t) - 5} y={T + 24 + i * 16} textAnchor="end">{m.label}</text>
              : <text className="dsh-ml" x={X(m.t) + 5} y={T + 24 + i * 16}>{m.label}</text>}</g>
        ))}
        <path className="dsh-proj" d={line(pts)} />
        {hist.length > 1 ? <path className="dsh-hist" d={line(hist)} /> : null}
        {hist.map((p) => <circle key={p.t} className="dsh-pt" cx={X(p.t)} cy={Y(p.v)} r={hist.length > 1 ? 3.5 : 5} />)}
        {hot ? <g><line className="dsh-cursor" x1={X(hot.t)} x2={X(hot.t)} y1={T} y2={H - B} /><circle className="dsh-cdot" cx={X(hot.t)} cy={Y(hot.v)} r={5} /></g> : null}
      </svg>
      {read && hot ? (
        <div className={left ? "dsh-tipbox dsh-tip-l" : "dsh-tipbox dsh-tip-r"}>
          <b>{read.title}</b>
          {read.rows.map(([k, v]) => <div key={k} className="dsh-tiprow"><span>{k}</span><span>{v}</span></div>)}
        </div>
      ) : null}
    </div>
  );
}

export interface Lane {
  name: string;
  spans: { from: number; to: number; kind: "dsh-work" | "dsh-ret" | "dsh-k1" | "dsh-k2" | "dsh-k3"; label?: string }[];
  events: { at: number; label: string }[];
  /** Words above the lane at a year, in Text: "Retires 2052, age 62". */
  note?: { at: number; label: string };
  /** Words just after today's line: "Age 36". */
  lead?: string;
}

/* A label's width at the timeline's 12px, measured once the page can
   (an estimate before that), so labels can be kept from touching. */
let measureCtx: CanvasRenderingContext2D | null | undefined;
function textWidth(text: string): number {
  if (measureCtx === undefined && typeof document !== "undefined") {
    measureCtx = document.createElement("canvas").getContext("2d");
    if (measureCtx) measureCtx.font = "12px " + getComputedStyle(document.body).fontFamily;
  }
  return measureCtx ? measureCtx.measureText(text).width : text.length * 6.6;
}

/** Labels along a line, each at its own x (`end` anchors it on its right
    edge), put in the first row where it touches nothing already there:
    returns each label's row (0 nearest the line). */
function rowsFor(items: { x: number; w: number; end?: boolean }[]): number[] {
  const GAP = 10, rows: [number, number][][] = [];
  return items.map((it) => {
    const from = it.end ? it.x - it.w : it.x, to = from + it.w;
    let r = 0;
    while (rows[r]?.some(([a, b]) => from < b + GAP && to > a - GAP)) r++;
    (rows[r] ??= []).push([from, to]);
    return r;
  });
}

/** Your timeline: who's working or retired, children's college years, and
    the dates along the way, with today as the amber line. Words above and
    below each line never touch: one that would goes to a row of its own,
    and the lane grows to fit. */
export function Timeline({ lanes, from, to, now }: { lanes: Lane[]; from: number; to: number; now: number }) {
  const [ref, fit] = useWidth(1100);
  // Never narrower than its labels need; a phone scrolls it sideways.
  const W = Math.max(640, fit);
  const L = 110, R = 20, ROW = 15;
  const X = (y: number) => L + ((y - from) / (to - from)) * (W - L - R);
  const every = W < 700 ? 10 : 5, ticks: number[] = [];
  for (let y = Math.ceil((from + 1) / every) * every; y <= to; y += every) ticks.push(y);
  // Each lane's words, laid out: above the line (how old you are now, each
  // span's name, the note), below it (the dates), in year order.
  const laid = lanes.map((ln) => {
    const above: { key: string; x: number; label: string; strong?: boolean }[] = [];
    if (ln.lead) above.push({ key: "lead", x: X(now) + 8, label: ln.lead });
    ln.spans.forEach((sp) => { if (sp.label) above.push({ key: "s" + sp.kind + sp.from, x: Math.max(X(sp.from), X(now) + 6) + 2, label: sp.label }); });
    if (ln.note) above.push({ key: "note", x: X(ln.note.at), label: ln.note.label, strong: true });
    above.sort((a, b) => a.x - b.x);
    const upRows = rowsFor(above.map((a) => ({ x: a.x, w: textWidth(a.label) })));
    const evs = ln.events.slice().sort((a, b) => a.at - b.at);
    // The first date's words go left of its dot, unless that runs into the names.
    const below = evs.map((e, j) => { const w = textWidth(e.label), left = j === 0 && X(e.at) - 4 - w >= L; return { e, w, left, x: left ? X(e.at) - 4 : X(e.at) + 4 }; });
    const downRows = rowsFor(below.map((b) => ({ x: b.x, w: b.w, end: b.left })));
    const up = Math.max(0, ...upRows) + (above.length ? 1 : 0), down = Math.max(0, ...downRows) + (below.length ? 1 : 0);
    return { ln, above, upRows, below, downRows, up, down };
  });
  // Each lane's line, below the rows of words above it.
  const ys: number[] = [];
  let y0 = 26;
  for (const l of laid) { const y = y0 + 16 + Math.max(1, l.up) * ROW; ys.push(y); y0 = y + Math.max(1, l.down) * ROW + 10; }
  const H = y0 + 6;
  return (
    <div ref={ref} className="dsh-tl">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Your timeline">
        {ticks.map((y) => <text key={y} x={X(y)} y={18} textAnchor="middle">{y}</text>)}
        <line className="dsh-now" x1={X(now)} x2={X(now)} y1={26} y2={H - 8} />
        {laid.map(({ ln, above, upRows, below, downRows }, i) => {
          const y = ys[i];
          return (
            <g key={ln.name + i}>
              <text className="dsh-lbl" x={0} y={y + 4}>{ln.name}</text>
              <line className="dsh-lane" x1={L} x2={W - R} y1={y} y2={y} />
              {ln.spans.map((sp) => <line key={sp.kind + sp.from} className={"dsh-span " + sp.kind} x1={X(Math.max(from, sp.from)) + 3} x2={X(Math.min(to, sp.to)) - 3} y1={y} y2={y} />)}
              {above.map((a, k) => <text key={a.key} className={a.strong ? "dsh-strong" : undefined} x={a.x} y={y - 11 - upRows[k] * ROW}>{a.label}</text>)}
              {below.map((b, k) => (
                <g key={b.e.label}>
                  <circle className="dsh-ev" cx={X(b.e.at)} cy={y} r={5} />
                  <text x={b.x} y={y + 21 + downRows[k] * ROW} textAnchor={b.left ? "end" : "start"}>{b.e.label}</text>
                </g>
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** The readiness score's five areas side by side, each as wide as its
    weight, filled as far as it scores; an area not scored yet is hatched. */
export function SplitBar({ areas }: { areas: { w: number; p: number | null; name: string; pts?: number | null }[] }) {
  const total = areas.reduce((s, a) => s + a.w, 0), gap = 0.8;
  const widths = areas.map((a) => (a.w / total) * (100 + gap) - gap);
  const starts = widths.map((_, i) => widths.slice(0, i).reduce((s, w) => s + w + gap, 0));
  return (
    <svg className="dsh-splitbar" viewBox="0 0 100 10" preserveAspectRatio="none" role="img" aria-label={areas.map((a) => a.name + (a.p == null ? ": not scored yet" : `: ${a.pts ?? Math.round(a.p * a.w)} of ${a.w}`)).join(", ")}>
      {areas.map((a, i) => {
        const w = widths[i], at = starts[i];
        return (
          <g key={a.name}>
            <rect className={a.p == null ? "dsh-sb-na" : "dsh-sb-track"} x={at} y={0} width={w} height={10} rx={1.2} />
            {a.p == null ? null : <rect className={a.p >= 0.8 ? "dsh-sb-full" : "dsh-sb-part"} x={at} y={0} width={w * a.p} height={10} rx={1.2} />}
          </g>
        );
      })}
    </svg>
  );
}
