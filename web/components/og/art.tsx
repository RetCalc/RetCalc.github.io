/* The link-preview cards' illustrations, one per kind of tool. They are
   pictures, not charts: no axes, no figures, just enough of each tool's
   shape to say what it does at a glance. Drawn at 580 by 534 (the card's
   art panel); anything past the right edge is cut off by the panel. The
   history fan uses the real paths from 1926 on; the rest are drawn. */

import type { HomeData } from "@/components/home/data";
import type { CardArt } from "@/lib/cards";

export const W = 580, H = 534;

const C = {
  amber: "var(--ds-amber)", sky: "var(--ds-series-sky)", teal: "var(--ds-series-teal)", lav: "var(--ds-series-lavender)",
  rose: "var(--ds-series-rose)", gray: "var(--ds-series-gray)", muted: "var(--ds-muted)", rule: "var(--ds-rule)",
  strong: "var(--ds-rule-strong)", text: "var(--ds-text)", ground: "var(--ds-ground)", raised: "var(--ds-raised)",
};

type Pt = [number, number];
const line = (pts: Pt[]) => pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join("");
/** A smooth curve through the points (Catmull-Rom as cubic Béziers). */
function smooth(pts: Pt[]): string {
  let s = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    s += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return s;
}
function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
/** The logo's arrowhead at the end of the plan line, pointing along it. */
function Arrowhead({ at, from, color = C.amber }: { at: Pt; from: Pt; color?: string }) {
  const a = (Math.atan2(at[1] - from[1], at[0] - from[0]) * 180) / Math.PI;
  return <path d="M8 0 L-12 -10 L-7 0 L-12 10 Z" fill={color} transform={`translate(${at[0]} ${at[1]}) rotate(${a.toFixed(1)})`} />;
}

export function Art({ art, data }: { art: CardArt; data: HomeData }) {
  const Pic = PICS[art];
  return <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true"><Pic data={data} /></svg>;
}

type Pic = (p: { data: HomeData }) => React.ReactNode;

/** Every retirement since 1926: the real paths, the middle 80% as a band,
    and the median as the plan line ending in the logo's arrowhead. */
const Fan: Pic = ({ data }) => {
  const lines = data.fan.lines, n = lines[0].length - 1, top = 3.4e6;
  const x = (t: number) => 34 + (t / n) * 500, y = (v: number) => H - 50 - Math.sqrt(v / top) * (H - 110);
  const q = (t: number, p: number) => { const c = lines.map((l) => l[t]).sort((a, b) => a - b); return c[Math.floor(p * (c.length - 1))]; };
  const ts = Array.from({ length: n + 1 }, (_, t) => t);
  const lo = ts.map((t): Pt => [x(t), y(q(t, 0.1))]), hi = ts.map((t): Pt => [x(t), y(q(t, 0.9))]);
  const med = ts.map((t): Pt => [x(t), y(q(t, 0.5))]);
  return (
    <>
      <path d={line(hi) + line([...lo].reverse()).replace("M", "L") + "Z"} fill={C.sky} opacity={0.13} />
      {lines.map((l, i) => <path key={i} d={line(l.map((v, t): Pt => [x(t), y(v)]))} fill="none" stroke={C.sky} strokeOpacity={0.3} strokeWidth={1.3} />)}
      <path d={smooth(med)} fill="none" stroke={C.amber} strokeWidth={5} strokeLinecap="round" />
      <circle cx={med[0][0]} cy={med[0][1]} r={7} fill={C.amber} />
      <Arrowhead at={[med[n][0] + 10, med[n][1]]} from={med[n - 1]} />
    </>
  );
};

/** Savings growing: a column a year under the plan line. */
function growthPoints(values: number[]): Pt[] {
  const max = values[values.length - 1], n = values.length - 1;
  return values.map((v, i): Pt => [40 + (i / n) * 480, H - 46 - (v / max) * (H - 150)]);
}
const Growth: Pic = ({ data }) => {
  const pts = growthPoints(data.growth), n = pts.length - 1, bw = 480 / n - 4;
  return (
    <>
      {pts.map(([px, py], i) => <rect key={i} x={px - bw / 2} y={py + 14} width={bw} height={Math.max(0, H - 46 - py - 14)} rx={3} fill={C.sky} opacity={0.18 + 0.5 * (i / n)} />)}
      <path d={smooth(pts)} fill="none" stroke={C.amber} strokeWidth={5} strokeLinecap="round" />
      <Arrowhead at={[pts[n][0] + 6, pts[n][1] - 6]} from={pts[n - 2]} />
    </>
  );
};

/** Advanced: the balance split into account types, stacked. */
const Accounts: Pic = ({ data }) => {
  const pts = growthPoints(data.growth), base = H - 46, n = pts.length - 1;
  const layer = (f: number) => pts.map(([px, py]): Pt => [px, base - (base - py) * f]);
  const area = (a: Pt[], b: Pt[]) => smooth(a) + line([...b].reverse()).replace("M", "L") + "Z";
  const l1 = layer(0.5), l2 = layer(0.8), l3 = pts, floor = pts.map(([px]): Pt => [px, base]);
  return (
    <>
      <path d={area(l1, floor)} fill={C.teal} opacity={0.75} />
      <path d={area(l2, l1)} fill={C.sky} opacity={0.65} />
      <path d={area(l3, l2)} fill={C.lav} opacity={0.6} />
      <path d={smooth(l3)} fill="none" stroke={C.amber} strokeWidth={5} strokeLinecap="round" />
      <Arrowhead at={[pts[n][0] + 6, pts[n][1] - 6]} from={pts[n - 2]} />
    </>
  );
};

/** Stages: the plan line in three stretches, each with its own pace. */
const Stages: Pic = () => {
  const pts: Pt[] = [];
  let v = 0.05;
  for (let i = 0; i <= 33; i++) { pts.push([40 + i * (480 / 33), H - 46 - v * (H - 150)]); v += i < 11 ? 0.012 : i < 22 ? 0.03 : 0.045; }
  const max = Math.min(...pts.map((p) => p[1])); const k = (H - 150) / (H - 46 - max);
  const p2 = pts.map(([px, py]): Pt => [px, H - 46 - (H - 46 - py) * k]);
  const cut = [0, 11, 22, 33], fills = [C.sky, C.teal, C.lav];
  return (
    <>
      {fills.map((f, s) => {
        const seg = p2.slice(cut[s], cut[s + 1] + 1);
        return <path key={s} d={smooth(seg) + `L${seg[seg.length - 1][0]} ${H - 46}L${seg[0][0]} ${H - 46}Z`} fill={f} opacity={0.32} />;
      })}
      {[11, 22].map((i) => <line key={i} x1={p2[i][0]} x2={p2[i][0]} y1={p2[i][1]} y2={H - 46} stroke={C.strong} strokeWidth={2} strokeDasharray="5 6" />)}
      <path d={smooth(p2)} fill="none" stroke={C.amber} strokeWidth={5} strokeLinecap="round" />
      {[11, 22].map((i) => <circle key={i} cx={p2[i][0]} cy={p2[i][1]} r={9} fill={C.ground} stroke={C.amber} strokeWidth={4} />)}
      <Arrowhead at={[p2[33][0] + 6, p2[33][1] - 6]} from={p2[31]} />
    </>
  );
};

/** The Guide: a score ring around a checklist of answered questions. */
const Guide: Pic = () => {
  const cx = 290, cy = 267, r = 196, f = 0.78, c = 2 * Math.PI * r;
  const rows = [0, 1, 2, 3];
  return (
    <>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.raised} strokeWidth={30} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.teal} strokeWidth={30} strokeLinecap="round"
        strokeDasharray={`${c * f} ${c}`} transform={`rotate(-90 ${cx} ${cy})`} />
      {rows.map((i) => {
        const y = cy - 105 + i * 70, done = i < 3;
        return (
          <g key={i}>
            <rect x={cx - 130} y={y - 26} width={260} height={52} rx={14} fill={C.raised} />
            <circle cx={cx - 100} cy={y} r={13} fill={done ? C.teal : "none"} stroke={done ? "none" : C.strong} strokeWidth={2.5} />
            {done ? <path d={`M${cx - 106} ${y} l5 5 l9 -10`} fill="none" stroke={C.ground} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" /> : null}
            <rect x={cx - 74} y={y - 5} width={[150, 120, 170, 100][i]} height={10} rx={5} fill={done ? C.strong : C.rule} />
          </g>
        );
      })}
    </>
  );
};

/** FIRE: savings climbing past the line where work becomes optional, with a flag. */
const Fire: Pic = () => {
  const pts: Pt[] = [];
  let v = 0.04;
  for (let i = 0; i <= 26; i++) { pts.push([40 + i * (500 / 26), H - 46 - v * (H - 130)]); v = v * 1.105 + 0.012; }
  const goal = H - 46 - 0.62 * (H - 130), at = pts.findIndex((p) => p[1] <= goal);
  const bw = 500 / 26 - 5;
  return (
    <>
      {pts.map(([px, py], i) => <rect key={i} x={px - bw / 2} y={py + 12} width={bw} height={Math.max(0, H - 46 - py - 12)} rx={3}
        fill={i >= at ? C.teal : C.sky} opacity={i >= at ? 0.55 : 0.25} />)}
      <line x1={20} x2={W} y1={goal} y2={goal} stroke={C.muted} strokeWidth={2} strokeDasharray="7 8" />
      <path d={smooth(pts.slice(0, 25))} fill="none" stroke={C.amber} strokeWidth={5} strokeLinecap="round" />
      <Arrowhead at={pts[24]} from={pts[23]} />
      <line x1={pts[at][0]} x2={pts[at][0]} y1={goal} y2={goal - 96} stroke={C.text} strokeWidth={4} strokeLinecap="round" />
      <path d={`M${pts[at][0] + 2} ${goal - 96} l58 18 l-58 18 Z`} fill={C.amber} />
      <circle cx={pts[at][0]} cy={goal} r={9} fill={C.amber} stroke={C.ground} strokeWidth={4} />
    </>
  );
};

/** The Bridge: an arch across the gap to 59½, built from three ways to pay,
    holding up the road. */
const Bridge: Pic = () => {
  const deck = 210, spring = 440, x0 = 96, x1 = 444, rise = spring - deck - 18;
  const at = (t: number): Pt => [x0 + (x1 - x0) * t, spring - Math.sin(Math.PI * t) * rise];
  const arc = (t0: number, t1: number) => smooth(Array.from({ length: 21 }, (_, i) => at(t0 + (t1 - t0) * (i / 20))));
  return (
    <>
      <path d={`M-20 ${deck + 8} H${x0 + 6} L${x0 - 30} ${H + 10} H-20 Z`} fill={C.raised} />
      <path d={`M${x1 - 6} ${deck + 8} H${W + 20} V${H + 10} H${x1 + 30} Z`} fill={C.raised} />
      {[0.1, 0.2, 0.3, 0.4, 0.6, 0.7, 0.8, 0.9].map((t) => {
        const [px, py] = at(t);
        return <line key={t} x1={px} x2={px} y1={deck + 6} y2={py - 10} stroke={C.strong} strokeWidth={4} strokeLinecap="round" />;
      })}
      <path d={arc(0, 0.34)} fill="none" stroke={C.sky} strokeWidth={24} strokeLinecap="round" />
      <path d={arc(0.34, 0.67)} fill="none" stroke={C.teal} strokeWidth={24} strokeLinecap="round" />
      <path d={arc(0.67, 1)} fill="none" stroke={C.lav} strokeWidth={24} strokeLinecap="round" />
      <line x1={-20} x2={W + 20} y1={deck} y2={deck} stroke={C.text} strokeWidth={8} />
      <text x={(x1 + W) / 2 - 4} y={deck + 72} textAnchor="middle" fill={C.text} fontSize={40} fontWeight={650}>59½</text>
    </>
  );
};

/** 72(t): the same payment every year until 59½, from an IRA that lasts. */
const Sepp: Pic = () => {
  const n = 9, x0 = 50, step = 46, base = H - 70;
  return (
    <>
      <path d={smooth(Array.from({ length: n + 3 }, (_, i): Pt => [x0 + i * step, 150 + i * 8])) + `L${x0 + (n + 2) * step} ${base}L${x0} ${base}Z`} fill={C.sky} opacity={0.14} />
      {Array.from({ length: n }, (_, i) => (
        <g key={i}>
          <rect x={x0 + i * step} y={base - 150} width={step - 12} height={150} rx={8} fill={C.lav} opacity={0.85} />
          <circle cx={x0 + i * step + (step - 12) / 2} cy={base - 180} r={13} fill="none" stroke={C.amber} strokeWidth={3.5} />
        </g>
      ))}
      <line x1={x0 + n * step + 10} x2={x0 + n * step + 10} y1={90} y2={base} stroke={C.text} strokeWidth={3} strokeDasharray="6 7" />
      <text x={x0 + n * step + 30} y={128} fill={C.text} fontSize={40} fontWeight={650}>59½</text>
      <line x1={20} x2={W} y1={base} y2={base} stroke={C.strong} strokeWidth={2} />
    </>
  );
};

/** Healthcare: premiums climbing until Medicare at 65, then lower. */
const Health: Pic = () => {
  const before = [170, 192, 214, 238, 262, 288, 314, 342], after = [128, 134, 142, 150];
  const base = H - 50, bw = 30, gap = 8;
  const mx = 40 + before.length * (bw + gap) + 14;
  return (
    <>
      {before.map((h, i) => <rect key={i} x={40 + i * (bw + gap)} y={base - h} width={bw} height={h} rx={6} fill={C.sky} opacity={0.4 + i * 0.05} />)}
      {after.map((h, i) => <rect key={i} x={mx + 14 + i * (bw + gap)} y={base - h} width={bw} height={h} rx={6} fill={C.teal} opacity={0.85} />)}
      <line x1={mx} x2={mx} y1={70} y2={base} stroke={C.text} strokeWidth={3} strokeDasharray="6 7" />
      <circle cx={mx} cy={92} r={34} fill={C.teal} />
      <path d={`M${mx - 15} 92 H${mx + 15} M${mx} 77 V107`} stroke={C.ground} strokeWidth={8} strokeLinecap="round" />
    </>
  );
};

/** The Optimizer: a grid of plans tried, one marked best. */
const Optimizer: Pic = () => {
  const cols = 11, rows = 10, s = 40, g = 8, x0 = 30, y0 = 22, r = rng(11);
  const best: Pt = [7, 3];
  const cells: React.ReactNode[] = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const d = Math.hypot((i - best[0]) / 6, (j - best[1]) / 5), v = Math.max(0.06, 0.95 - d * 0.75 + (r() - 0.5) * 0.22);
    const isBest = i === best[0] && j === best[1];
    cells.push(<rect key={i + "-" + j} x={x0 + i * (s + g)} y={y0 + j * (s + g)} width={s} height={s} rx={9}
      fill={isBest ? C.amber : C.teal} opacity={isBest ? 1 : v} />);
  }
  const bx = x0 + best[0] * (s + g) + s / 2, by = y0 + best[1] * (s + g) + s / 2;
  return <>{cells}<rect x={bx - s / 2 - 9} y={by - s / 2 - 9} width={s + 18} height={s + 18} rx={14} fill="none" stroke={C.amber} strokeWidth={3.5} /></>;
};

/** Roth: tax paid each year, converting (now) against not (later). */
const Roth: Pic = () => {
  const base = H - 46, bw = 15;
  return (
    <>
      {Array.from({ length: 15 }, (_, i) => {
        const none = i < 7 ? 70 : 120 + (i - 7) * 32, conv = i < 7 ? 210 : 70 + (i - 7) * 6, x = 40 + i * 34;
        return (
          <g key={i}>
            <rect x={x} y={base - none} width={bw} height={none} rx={5} fill={C.gray} opacity={0.45} />
            <rect x={x + bw + 2} y={base - conv} width={bw} height={conv} rx={5} fill={C.teal} />
          </g>
        );
      })}
    </>
  );
};

/** RMDs: required withdrawals growing every year from 73. */
const Rmd: Pic = () => {
  const base = H - 46, n = 20, bw = 18;
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const h = 90 + 330 * Math.pow(i / (n - 1), 1.4) * (1 - 0.18 * Math.pow(i / (n - 1), 4));
        return <rect key={i} x={40 + i * 25} y={base - h} width={bw} height={h} rx={6} fill={C.teal} opacity={0.35 + 0.65 * (i / n)} />;
      })}
      <path d={smooth(Array.from({ length: n }, (_, i): Pt => [49 + i * 25, base - 26 - 90 - 330 * Math.pow(i / (n - 1), 1.4) * (1 - 0.18 * Math.pow(i / (n - 1), 4))]))}
        fill="none" stroke={C.amber} strokeWidth={4} strokeLinecap="round" />
    </>
  );
};

/** Income tax: where a paycheck goes, as a ring. */
const Tax: Pic = () => {
  const cx = 290, cy = 267, r = 170, sw = 76, c = 2 * Math.PI * r;
  const parts: [number, string][] = [[0.66, C.teal], [0.17, C.sky], [0.09, C.lav], [0.08, C.rose]];
  let at = 0;
  return (
    <>
      {parts.map(([f, col], i) => {
        const seg = <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={col} strokeWidth={sw}
          strokeDasharray={`${Math.max(0, c * f - 8)} ${c}`} strokeDashoffset={-c * at} transform={`rotate(-90 ${cx} ${cy})`} />;
        at += f;
        return seg;
      })}
      <rect x={cx - 62} y={cy - 78} width={124} height={156} rx={14} fill={C.raised} />
      {[0, 1, 2, 3].map((i) => <rect key={i} x={cx - 40} y={cy - 50 + i * 26} width={[80, 60, 70, 44][i]} height={9} rx={4.5} fill={i ? C.strong : C.text} />)}
      <rect x={cx - 40} y={cy + 52} width={80} height={9} rx={4.5} fill={C.amber} />
    </>
  );
};

/** A house, as line art. */
function House({ x, y, w, h, stroke = C.strong, sw = 6 }: { x: number; y: number; w: number; h: number; stroke?: string; sw?: number }) {
  const roof = h * 0.42;
  return (
    <g fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round">
      <path d={`M${x - w * 0.08} ${y + roof} L${x + w / 2} ${y} L${x + w * 1.08} ${y + roof}`} />
      <path d={`M${x} ${y + roof - 8} V${y + h} H${x + w} V${y + roof - 8}`} />
      <path d={`M${x + w * 0.74} ${y + roof * 0.62} V${y + roof * 0.2} H${x + w * 0.86} V${y + roof * 0.85}`} />
    </g>
  );
}

/** Rent vs. buy: a house, and two paths of net worth that cross. */
const RentBuy: Pic = () => {
  const buy: Pt[] = [], rent: Pt[] = [];
  for (let i = 0; i <= 20; i++) {
    const x = 40 + i * 25;
    buy.push([x, H - 70 - (20 + 330 * Math.pow(i / 20, 1.5))]);
    rent.push([x, H - 70 - (60 + 210 * Math.pow(i / 20, 1.15))]);
  }
  return (
    <>
      <House x={150} y={70} w={280} h={300} stroke={C.rule} sw={8} />
      <path d={smooth(rent) + `L${rent[20][0]} ${H}L${rent[0][0]} ${H}Z`} fill={C.sky} opacity={0.12} />
      <path d={smooth(buy) + `L${buy[20][0]} ${H}L${buy[0][0]} ${H}Z`} fill={C.teal} opacity={0.14} />
      <path d={smooth(rent)} fill="none" stroke={C.sky} strokeWidth={5} strokeLinecap="round" />
      <path d={smooth(buy)} fill="none" stroke={C.teal} strokeWidth={5} strokeLinecap="round" />
      <circle cx={rent[20][0]} cy={rent[20][1]} r={9} fill={C.sky} />
      <circle cx={buy[20][0]} cy={buy[20][1]} r={9} fill={C.teal} />
    </>
  );
};

/** Mortgage: a house built from thirty years of payments (interest
    shrinking, principal growing), under a roof. */
const Mortgage: Pic = () => {
  const n = 30, x0 = 120, w = 340, base = H - 50, top = 250, bw = w / n - 2.5;
  return (
    <>
      <path d={`M${x0 - 34} ${top - 4} L${x0 + w / 2} ${top - 168} L${x0 + w + 34} ${top - 4}`} fill="none" stroke={C.text} strokeWidth={10} strokeLinejoin="round" strokeLinecap="round" />
      <path d={`M${x0 + w * 0.76} ${top - 92} V${top - 150} H${x0 + w * 0.88} V${top - 58}`} fill="none" stroke={C.text} strokeWidth={10} strokeLinejoin="round" />
      {Array.from({ length: n }, (_, i) => {
        const f = 0.82 - 0.68 * Math.pow(i / (n - 1), 1.6), hh = base - top, xi = x0 + i * (w / n);
        return (
          <g key={i}>
            <rect x={xi} y={top} width={bw} height={hh * (1 - f)} rx={2} fill={C.teal} />
            <rect x={xi} y={top + hh * (1 - f)} width={bw} height={hh * f} rx={2} fill={C.gray} opacity={0.45} />
          </g>
        );
      })}
    </>
  );
};

/** Budget: a month's money as blocks sized by what they take. */
const Budget: Pic = () => {
  const g = 10, x0 = 30, y0 = 30, w = 520, h = 474;
  const blocks: [number, number, number, number, string, number][] = [
    [0, 0, 0.56, 0.6, C.sky, 0.85], [0.56, 0, 0.44, 0.36, C.amber, 1], [0.56, 0.36, 0.44, 0.24, C.teal, 0.85],
    [0, 0.6, 0.32, 0.4, C.lav, 0.85], [0.32, 0.6, 0.38, 0.22, C.rose, 0.8], [0.32, 0.82, 0.38, 0.18, C.gray, 0.6], [0.7, 0.6, 0.3, 0.4, C.gray, 0.4],
  ];
  return (
    <>
      {blocks.map(([bx, by, bw, bh, col, op], i) => (
        <rect key={i} x={x0 + bx * w + g / 2} y={y0 + by * h + g / 2} width={bw * w - g} height={bh * h - g} rx={16} fill={col} opacity={op} />
      ))}
    </>
  );
};

/** College: savings climbing year by year to a graduation cap. */
const College: Pic = () => {
  const n = 18, base = H - 46, bw = 22;
  const hgt = (i: number) => 30 + 300 * Math.pow(i / (n - 1), 1.35);
  const cx = 40 + (n - 1) * 27 + bw / 2, cy = base - hgt(n - 1) - 74;
  return (
    <>
      {Array.from({ length: n }, (_, i) => <rect key={i} x={40 + i * 27} y={base - hgt(i)} width={bw} height={hgt(i)} rx={6} fill={C.teal} opacity={0.3 + 0.7 * (i / n)} />)}
      <path d={smooth(Array.from({ length: n }, (_, i): Pt => [51 + i * 27, base - hgt(i) - 22]))} fill="none" stroke={C.amber} strokeWidth={4.5} strokeLinecap="round" />
      <g transform={`translate(${cx - 34} ${cy})`}>
        <path d="M-30 6 L34 -22 L98 6 L34 34 Z" fill={C.text} />
        <path d="M6 20 V48 Q34 64 62 48 V20 L34 34 Z" fill={C.text} />
        <path d="M86 12 V48" stroke={C.amber} strokeWidth={4} strokeLinecap="round" />
        <circle cx={86} cy={52} r={6} fill={C.amber} />
      </g>
    </>
  );
};

/** Debt payoff: balances shrinking month by month to a check mark. */
const Debt: Pic = () => {
  const n = 10, base = H - 50, bw = 34, step = 46;
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const t = i / n, a = Math.max(0, 150 * (1 - t * 1.8)), b = Math.max(0, 120 * (1 - t * 1.25)), c = Math.max(0, 100 * (1 - t));
        const x = 34 + i * step;
        return (
          <g key={i}>
            <rect x={x} y={base - c} width={bw} height={c} rx={6} fill={C.sky} opacity={0.8} />
            <rect x={x} y={base - c - b - (b ? 4 : 0)} width={bw} height={b} rx={6} fill={C.lav} opacity={0.85} />
            <rect x={x} y={base - c - b - a - (a ? 8 : 0)} width={bw} height={a} rx={6} fill={C.rose} opacity={0.85} />
          </g>
        );
      })}
      <circle cx={34 + n * step + 30} cy={base - 40} r={40} fill={C.teal} />
      <path d={`M${34 + n * step + 12} ${base - 40} l12 13 l24 -26`} fill="none" stroke={C.ground} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
};

/** Backtest: a few mixes since 1926, the chosen one as the plan line. */
const Backtest: Pic = () => {
  const walk = (seed: number, drift: number, vol: number) => {
    const r = rng(seed), pts: Pt[] = [];
    let v = 0;
    for (let i = 0; i <= 60; i++) { pts.push([30 + i * (510 / 60), H - 60 - v]); v = Math.max(0, v + drift + (r() - 0.5) * vol); }
    return pts;
  };
  const cash = walk(3, 1, 4), bonds = walk(5, 2.6, 12), stocks = walk(9, 5.4, 40), mix = walk(21, 4.2, 24);
  return (
    <>
      <path d={line(stocks) + `L${stocks[60][0]} ${H}L30 ${H}Z`} fill={C.teal} opacity={0.1} />
      <path d={line(cash)} fill="none" stroke={C.gray} strokeWidth={3} />
      <path d={line(bonds)} fill="none" stroke={C.sky} strokeWidth={3} />
      <path d={line(stocks)} fill="none" stroke={C.teal} strokeWidth={3} />
      <path d={line(mix)} fill="none" stroke={C.amber} strokeWidth={5} strokeLinejoin="round" />
      <Arrowhead at={[mix[60][0] + 8, mix[60][1]]} from={mix[58]} />
    </>
  );
};

/** The tools page: six of the pictures as a mosaic. */
const Tools: Pic = ({ data }) => {
  const picks: Pic[] = [Fan, Tax, Mortgage, Guide, Budget, Fire];
  const cw = 176, ch = 241, g = 12;
  return (
    <>
      {picks.map((P, i) => {
        const x = 18 + (i % 3) * (cw + g), y = 20 + Math.floor(i / 3) * (ch + g);
        return (
          <g key={i}>
            <rect x={x} y={y} width={cw} height={ch} rx={18} fill={C.ground} />
            <svg x={x + 8} y={y + 8} width={cw - 16} height={ch - 16} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"><P data={data} /></svg>
          </g>
        );
      })}
    </>
  );
};

/** The Dashboard: a rail of pages beside three tiles: net worth climbing
    to the arrowhead, where a paycheck goes, and a readiness score with its
    rows. */
const Dashboard: Pic = () => {
  const tile = (x: number, y: number, w: number, h: number) => <rect x={x} y={y} width={w} height={h} rx={18} fill={C.ground} />;
  const net = Array.from({ length: 14 }, (_, i): Pt => [110 + i * 32, 226 - 150 * Math.pow(i / 13, 1.6) - (i % 3 === 1 ? 6 : 0)]);
  const r = 62, circ = 2 * Math.PI * r;
  const parts: [number, string][] = [[0.34, C.lav], [0.25, C.rose], [0.31, C.amber], [0.1, C.teal]];
  let at = 0;
  return (
    <>
      {tile(18, 20, 50, 494)}
      {Array.from({ length: 9 }, (_, i) => <rect key={i} x={33} y={44 + i * 50} width={20} height={20} rx={6} fill={i === 1 ? C.amber : C.strong} opacity={i === 1 ? 1 : 0.55} />)}
      {tile(80, 20, 482, 250)}
      <path d={smooth(net.map(([x, y]): Pt => [x, y - 34])) + "L" + net[13][0] + " " + (net[13][1] + 40) + smooth([...net].reverse().map(([x, y]): Pt => [x, y + 40])).replace("M", "L") + "Z"} fill={C.sky} opacity={0.14} />
      <path d={smooth(net)} fill="none" stroke={C.amber} strokeWidth={5} strokeLinecap="round" />
      <circle cx={net[0][0]} cy={net[0][1]} r={7} fill={C.amber} />
      <Arrowhead at={[net[13][0] + 10, net[13][1] - 4]} from={net[12]} />
      {tile(80, 282, 235, 232)}
      <g transform="translate(197.5 398) rotate(-90)">
        {parts.map(([f, col], i) => { const el = <circle key={i} r={r} fill="none" stroke={col} strokeWidth={26} strokeDasharray={`${f * circ - 4} ${circ}`} strokeDashoffset={-at * circ} />; at += f; return el; })}
      </g>
      {tile(327, 282, 235, 232)}
      {[0.3, 0.21, 0.16, 0.18, 0.15].map((f, i, a) => { const x0 = 349 + a.slice(0, i).reduce((s, v) => s + v, 0) * 191; return <rect key={i} x={x0} y={312} width={f * 191 - 5} height={16} rx={5} fill={i === 2 ? C.strong : C.teal} />; })}
      {Array.from({ length: 4 }, (_, i) => (
        <g key={i}>
          <circle cx={360} cy={372 + i * 34} r={8} fill="none" stroke={C.teal} strokeWidth={3} />
          <rect x={378} y={367 + i * 34} width={[120, 96, 132, 84][i]} height={10} rx={5} fill={C.strong} opacity={0.7} />
        </g>
      ))}
    </>
  );
};

/** Social Security: the check at 62, 67 and 70 as three columns, the plan
    line climbing across their tops to the arrowhead. */
const Social: Pic = () => {
  const base = H - 60, bw = 120, xs = [70, 230, 390], hs = [0.42, 0.6, 0.744];
  const top = (i: number): Pt => [xs[i] + bw / 2, base - hs[i] * (H - 140)];
  const cols = [C.sky, C.teal, C.amber];
  return (
    <>
      <line x1={30} x2={W} y1={base} y2={base} stroke={C.strong} strokeWidth={2} />
      {xs.map((x, i) => <rect key={i} x={x} y={top(i)[1]} width={bw} height={base - top(i)[1]} rx={10} fill={cols[i]} opacity={i === 2 ? 0.9 : 0.45} />)}
      <path d={smooth([[xs[0] + bw / 2, top(0)[1] - 26], [xs[1] + bw / 2, top(1)[1] - 26], [xs[2] + bw / 2 - 8, top(2)[1] - 30]])} fill="none" stroke={C.amber} strokeWidth={5} strokeLinecap="round" />
      <Arrowhead at={[xs[2] + bw / 2 + 4, top(2)[1] - 31]} from={[xs[1] + bw / 2, top(1)[1] - 26]} />
      {xs.map((x, i) => <text key={i} x={x + bw / 2} y={base + 40} textAnchor="middle" fontSize={30} fontWeight={600} fill={C.text} fontFamily="inherit">{["62", "67", "70"][i]}</text>)}
    </>
  );
};

const PICS: Record<CardArt, Pic> = {
  fan: Fan, growth: Growth, accounts: Accounts, stages: Stages, guide: Guide, fire: Fire, bridge: Bridge, sepp: Sepp,
  health: Health, optimizer: Optimizer, social: Social, roth: Roth, rmd: Rmd, tax: Tax, rentbuy: RentBuy, mortgage: Mortgage,
  budget: Budget, college: College, debt: Debt, backtest: Backtest, tools: Tools, dashboard: Dashboard,
};
