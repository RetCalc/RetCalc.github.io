/* The homepage's tool views: small SVG charts of what each tool shows.
   Paths marked .draw and .fade animate when their tile plays (styles/16-home.css);
   --dl and --dur set a part's delay and length. Real figures come from
   data.ts; the shapes with no figure on them (FIRE, Bridge, Healthcare,
   Optimizer, Roth, Budget) are illustrations. */

import type { HomeData } from "./data";

type Pt = [number, number];
const d = (pts: Pt[]) => pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join("");
const scale = (d0: number, d1: number, r0: number, r1: number) => (v: number) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
const money = (v: number) => "$" + Math.round(v).toLocaleString("en-US");

/** The example household's savings, age 32 to 65. */
export function GrowthChart({ values, w = 520, h = 190 }: { values: number[]; w?: number; h?: number }) {
  const fv = values[values.length - 1], b = h - 16;
  const x = scale(32, 65, 4, w - 4), y = scale(0, fv, b, 8);
  const pts = values.map((v, i): Pt => [x(32 + i), y(v)]);
  return (
    <svg className="hm-chart hm-wide-chart" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path className="hm-area fade" style={{ "--dl": ".5s" } as React.CSSProperties} d={d(pts) + `L${w - 4} ${b}L4 ${b}Z`} />
      <path className="hm-ln draw" pathLength={1} style={{ "--dur": "1.5s" } as React.CSSProperties} d={d(pts)} />
      <circle className="hm-dot fade" style={{ "--dl": "1.3s" } as React.CSSProperties} cx={x(65)} cy={y(fv)} r={4.5} />
      {[32, 45, 55, 65].map((a) => (
        <text key={a} x={x(a)} y={h - 2} textAnchor={a === 32 ? "start" : a === 65 ? "end" : "middle"}>{a === 32 ? "Age 32" : a}</text>
      ))}
    </svg>
  );
}

/** The Guide's readiness score. */
export function ScoreRing({ score = 78, label = "Nearly there" }: { score?: number; label?: string }) {
  return (
    <svg className="hm-chart" viewBox="0 0 112 112" role="img" aria-label={`Example readiness score: ${score}, ${label.toLowerCase()}`}>
      <circle className="hm-track" cx={56} cy={56} r={46} />
      <circle className="hm-score draw" pathLength={1} style={{ "--score": score / 100, "--dur": "1.6s" } as React.CSSProperties} cx={56} cy={56} r={46} transform="rotate(-90 56 56)" />
      <text className="hm-score-n" x={56} y={59} textAnchor="middle">{score}</text>
      <text className="hm-score-l" x={56} y={78} textAnchor="middle">{label}</text>
    </svg>
  );
}

/** Every January retirement since 1926 with the Drawdown Simulator's defaults. */
export function FanChart({ fan, w = 640, h = 260 }: { fan: HomeData["fan"]; w?: number; h?: number }) {
  const L = 40, R = 6, T = 8, B = 22, max = 3000000;
  const x = scale(0, 30, L, w - R), y = scale(0, max, h - B, T);
  return (
    <svg className="hm-chart hm-wide-chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Every retirement since 1926 with $1 million, 60% stocks, spending 4% a year raised with inflation. A few that began in the late 1960s ran out.">
      <defs><clipPath id="hm-fan-clip"><rect x={0} y={T - 4} width={w} height={h - T - B + 8} /></clipPath></defs>
      <g>
        {[0, 1, 2, 3].map((m) => (
          <g key={m}>
            <line className="hm-grid-l" x1={L} x2={w - R} y1={y(m * 1e6)} y2={y(m * 1e6)} />
            <text x={L - 6} y={y(m * 1e6) + 4} textAnchor="end">{m ? `$${m}M` : "$0"}</text>
          </g>
        ))}
        {[0, 10, 20, 30].map((t) => (
          <text key={t} x={x(t)} y={h - 4} textAnchor={t === 30 ? "end" : t ? "middle" : "start"}>{t ? `Year ${t}` : "Retire"}</text>
        ))}
      </g>
      <g clipPath="url(#hm-fan-clip)">
        {fan.lines.map((line, i) => (
          <path key={i} className={(fan.failed[i] ? "hm-fail" : "hm-path") + " draw"} pathLength={1}
            style={{ "--dl": (i * 0.012).toFixed(3) + "s", "--dur": "1.4s" } as React.CSSProperties} d={d(line.map((v, t): Pt => [x(t), y(v)]))} />
        ))}
      </g>
    </svg>
  );
}

/** FIRE: a portfolio rising to the number where work is optional. */
export function FireChart({ w = 340, h = 120 }) {
  const x = scale(30, 55, 8, w - 8), y = scale(0, 2.2, h - 8, 8), pts: Pt[] = [];
  let p = 0.1, at = 0;
  for (let a = 30; a <= 55; a++) { pts.push([x(a), y(p)]); if (!at && p >= 1.5) at = a; p = p * 1.06 + 0.045; }
  return (
    <svg className="hm-chart" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <line className="hm-dash" x1={8} x2={w - 8} y1={y(1.5)} y2={y(1.5)} />
      <path className="hm-ln draw" pathLength={1} d={d(pts)} />
      <circle className="hm-dot fade" style={{ "--dl": "1.3s" } as React.CSSProperties} cx={x(at)} cy={y(1.5)} r={5} />
      <text className="fade" style={{ "--dl": "1.3s" } as React.CSSProperties} x={x(at) - 8} y={y(1.5) - 10} textAnchor="end">Work optional</text>
    </svg>
  );
}

/** The Bridge: three ways to pay for the years before 59½. */
export function BridgeChart({ w = 340, h = 120 }) {
  const x = scale(52, 66, 8, w - 8);
  const rows: [string, number, number, string][] = [["Brokerage", 52, 55, "f-sky"], ["Roth ladder", 55, 59.5, "f-teal"], ["72(t)", 53, 59.5, "f-lav"]];
  return (
    <svg className="hm-chart" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      {rows.map(([n, a, b, c], i) => (
        <g key={n} className="fade" style={{ "--dl": i * 0.2 + "s" } as React.CSSProperties}>
          <rect className={c + " o-band"} x={x(a)} y={14 + i * 28} width={x(b) - x(a)} height={18} rx={5} />
          <text x={x(b) + 8} y={27 + i * 28}>{n}</text>
        </g>
      ))}
      <line className="hm-mark" x1={x(59.5)} x2={x(59.5)} y1={6} y2={h - 18} />
      <text x={x(59.5)} y={h - 4} textAnchor="middle">59½</text>
    </svg>
  );
}

/** Healthcare: monthly premiums before Medicare, then after. */
export function HealthChart({ w = 340, h = 120 }) {
  const x = scale(55, 75, 8, w - 8), y = scale(0, 1600, h - 8, 10);
  const prem: Pt[] = [[55, 820], [58, 940], [61, 1080], [64, 1220], [65, 420], [68, 440], [71, 610], [75, 640]];
  const step: Pt[] = [];
  prem.forEach(([a, v], i) => { if (i) step.push([x(a), step[step.length - 1][1]]); step.push([x(a), y(v)]); });
  step.push([x(75), y(640)]);
  return (
    <svg className="hm-chart" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path className="hm-ln hm-thin s-sky draw" pathLength={1} style={{ "--dur": "1.5s" } as React.CSSProperties} d={d(step)} />
      <line className="hm-grid-l" x1={x(65)} x2={x(65)} y1={6} y2={h - 6} />
      <text x={x(65) + 6} y={18}>Medicare at 65</text>
    </svg>
  );
}

/** The Optimizer: thousands of plans, one that leaves the most. A fixed
    scatter (seeded), worked out once. */
const CLOUD = (() => {
  const w = 340, h = 120;
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const dots: [number, number, number][] = [];
  let best: Pt = [0, 999];
  for (let i = 0; i < 360; i++) {
    const a = rnd(), b = rnd();
    const px = 10 + a * (w - 20), py = h - 8 - (Math.pow(a, 0.55) * 64 + b * 32) * (0.55 + 0.45 * Math.sin(a * 2.6));
    if (py < best[1]) best = [px, py];
    dots.push([px, py, a]);
  }
  return { w, h, dots, best };
})();

export function CloudChart() {
  const { w, h, dots, best } = CLOUD;
  return (
    <svg className="hm-chart" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      {dots.map(([px, py, a], i) => (
        <circle key={i} className="hm-cloud fade" style={{ "--dl": (a * 0.8).toFixed(2) + "s" } as React.CSSProperties} cx={px.toFixed(1)} cy={py.toFixed(1)} r={1.7} />
      ))}
      <circle className="hm-ring fade" style={{ "--dl": "1s" } as React.CSSProperties} cx={best[0]} cy={best[1]} r={9} />
      <circle className="hm-dot fade" style={{ "--dl": "1s" } as React.CSSProperties} cx={best[0]} cy={best[1]} r={4} />
    </svg>
  );
}

/** Roth: yearly tax, converting against not converting. */
export function RothChart({ w = 340, h = 130 }) {
  const bars = Array.from({ length: 16 }, (_, i) => {
    const age = 60 + i * 2;
    return { none: age < 73 ? 10 : 22 + (age - 73) * 2.4, conv: age < 73 ? 34 : 9 + (age - 73) * 0.6 };
  });
  // the tallest bar reaches just under the key
  const k = (h - 26) / Math.max(...bars.map((b) => Math.max(b.none, b.conv)));
  return (
    <svg className="hm-chart" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <Key items={[["Not converting", "f-gray"], ["Converting", "f-teal"]]} />
      {bars.map((b, i) => {
        const bx = 6 + i * (w - 12) / 16;
        return (
          <g key={i} className="fade" style={{ "--dl": i * 0.04 + "s" } as React.CSSProperties}>
            <rect className="f-gray o-soft" x={bx} y={h - 4 - b.none * k} width={7} height={b.none * k} rx={2} />
            <rect className="f-teal" x={bx + 8} y={h - 4 - b.conv * k} width={7} height={b.conv * k} rx={2} />
          </g>
        );
      })}
    </svg>
  );
}

/** Income Tax: where the example salary goes. */
export function TaxChart({ tax, w = 520, h = 140 }: { tax: HomeData["tax"]; w?: number; h?: number }) {
  const parts: [string, number, string][] = [["Take-home", tax.takeHome, "f-teal"], ["Federal", tax.federal, "f-sky"], ["FICA", tax.fica, "f-lav"], ["State", tax.state, "f-rose"]];
  const total = parts.reduce((a, p) => a + p[1], 0), x = scale(0, total, 8, w - 8);
  let at = 0;
  return (
    <svg className="hm-chart hm-wide-chart hm-tax" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <text x={8} y={16}>{money(tax.gross)} salary, single, {tax.stateName}</text>
      {parts.map(([n, v, c], i) => {
        const x0 = x(at); at += v;
        return <rect key={n} className={c + " fade"} style={{ "--dl": i * 0.18 + "s" } as React.CSSProperties} x={x0} y={30} width={Math.max(0, x(at) - x0 - 3)} height={34} rx={6} />;
      })}
      {parts.map(([n, v, c], i) => {
        const lx = 8 + i * (w - 16) / 4;
        return (
          <g key={n} className="fade" style={{ "--dl": i * 0.18 + "s" } as React.CSSProperties}>
            <rect className={c} x={lx} y={88} width={9} height={9} rx={2} />
            <text x={lx + 14} y={96.5}>{n}</text>
            <text className="hm-t-big" x={lx + 14} y={116}>{money(v)}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Rent vs. Buy: net worth each way, with the tool's defaults, and who is
    ahead at the end (or the year buying pulls ahead, when it does). */
export function RentBuyChart({ rb, w = 520, h = 150 }: { rb: HomeData["rentbuy"]; w?: number; h?: number }) {
  const n = rb.buy.length, all = [...rb.buy, ...rb.rent], lb = rb.buy[n - 1], lr = rb.rent[n - 1];
  const x = scale(0, n - 1, 8, w - 8), y = scale(Math.min(...all), Math.max(...all), h - 8, 46);
  const be = rb.breakEven;
  const [px, py, label] = be != null
    ? [x(be - 1), y(rb.buy[be - 1]), `Buying pulls ahead in year ${be}`]
    : [x(n - 1), y(Math.max(lb, lr)), `${lr > lb ? "Renting" : "Buying"} ahead by ${money(Math.abs(lr - lb))} after ${n} years`];
  return (
    <svg className="hm-chart hm-wide-chart" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <Key items={[["Buying", "f-teal"], ["Renting", "f-sky"]]} />
      <path className="hm-ln hm-thin s-sky draw" pathLength={1} style={{ "--dur": "1.5s" } as React.CSSProperties} d={d(rb.rent.map((v, i): Pt => [x(i), y(v)]))} />
      <path className="hm-ln hm-thin s-teal draw" pathLength={1} style={{ "--dur": "1.5s", "--dl": ".15s" } as React.CSSProperties} d={d(rb.buy.map((v, i): Pt => [x(i), y(v)]))} />
      <g className="fade" style={{ "--dl": "1.4s" } as React.CSSProperties}>
        <circle className="hm-dot" cx={px} cy={py} r={5} />
        <text className="hm-t-big" x={be != null ? px + 10 : px - 10} y={be != null ? py + 20 : py - 12} textAnchor={be != null ? "start" : "end"}>{label}</text>
      </g>
    </svg>
  );
}

/** Mortgage: each year's payments split into interest and principal. */
export function MortgageChart({ years, w = 340, h = 130 }: { years: HomeData["mortgage"]; w?: number; h?: number }) {
  const top = Math.max(...years.map(([i, p]) => i + p)), bw = (w - 16) / years.length, y = scale(0, top, h - 8, 22);
  return (
    <svg className="hm-chart" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <Key items={[["Interest", "f-gray"], ["Principal", "f-teal"]]} />
      {years.map(([int, pr], i) => (
        <g key={i} className="fade" style={{ "--dl": i * 0.025 + "s" } as React.CSSProperties}>
          <rect className="f-teal" x={8 + i * bw} y={y(int + pr)} width={bw - 2} height={y(int) - y(int + pr)} />
          <rect className="f-gray o-soft" x={8 + i * bw} y={y(int)} width={bw - 2} height={y(0) - y(int)} />
        </g>
      ))}
    </svg>
  );
}

/** Budget: a month's spending by category (example). */
export function BudgetChart({ w = 340, h = 130 }) {
  const cats: [string, number, string][] = [["Housing", 2800, "f-sky"], ["Saving", 1500, "f-amber"], ["Food", 1000, "f-teal"], ["Transport", 700, "f-lav"], ["Everything else", 1400, "f-gray"]];
  const x = scale(0, 2800, 0, w - 150);
  return (
    <svg className="hm-chart" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      {cats.map(([n, v, c], i) => (
        <g key={n} className="fade" style={{ "--dl": i * 0.12 + "s" } as React.CSSProperties}>
          <text x={0} y={17 + i * 25}>{n}</text>
          <rect className={c} x={104} y={6 + i * 25} width={x(v)} height={14} rx={4} />
          <text className="hm-t-ink" x={110 + x(v)} y={17 + i * 25}>{money(v)}</text>
        </g>
      ))}
    </svg>
  );
}

/* The tool list's chart cards (components/tools/ToolsBrowser.tsx) show the
   charts above, and these three for the tools the homepage has no tile for,
   drawn the same way. */

/** Portfolio Backtest: $10,000 in the tool's default mix, year by year, after inflation. */
export function BacktestChart({ bt, w = 340, h = 120 }: { bt: { first: number; last: number; mix: string; values: number[] }; w?: number; h?: number }) {
  const n = bt.values.length, end = bt.values[n - 1];
  const x = scale(0, n - 1, 8, w - 8), y = scale(0, Math.max(...bt.values), h - 18, 22);
  const pts = bt.values.map((v, i): Pt => [x(i), y(v)]);
  return (
    <svg className="hm-chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`$10,000 in ${bt.mix} in ${bt.first} grew to ${money(end)} by ${bt.last}, after inflation.`}>
      <text x={8} y={12}>$10,000 in {bt.mix}, after inflation</text>
      <line className="hm-grid-l" x1={8} x2={w - 8} y1={h - 18} y2={h - 18} />
      <path className="hm-area fade" style={{ "--dl": ".5s" } as React.CSSProperties} d={d(pts) + `L${x(n - 1)} ${h - 18}L8 ${h - 18}Z`} />
      <path className="hm-ln hm-thin draw" pathLength={1} d={d(pts)} />
      <circle className="hm-dot fade" style={{ "--dl": "1.3s" } as React.CSSProperties} cx={x(n - 1)} cy={y(end)} r={4.5} />
      <text className="hm-t-ink fade" style={{ "--dl": "1.3s" } as React.CSSProperties} x={x(n - 1) - 10} y={y(end) + 4} textAnchor="end">{money(end)}</text>
      <text x={8} y={h - 3}>{bt.first}</text>
      <text x={w - 8} y={h - 3} textAnchor="end">{bt.last}</text>
    </svg>
  );
}

/** College Savings: monthly saving building toward four years of tuition. */
export function CollegeChart({ w = 340, h = 120 }) {
  const x = scale(0, 18, 8, w - 8), y = scale(0, 1, h - 16, 30), pts: Pt[] = [];
  for (let a = 0; a <= 18; a++) pts.push([x(a), y((Math.pow(1.06, a) - 1) / (Math.pow(1.06, 18) - 1))]);
  return (
    <svg className="hm-chart" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <line className="hm-dash" x1={8} x2={w - 8} y1={y(1)} y2={y(1)} />
      <text x={8} y={y(1) - 8}>Four years of tuition</text>
      <path className="hm-area fade" style={{ "--dl": ".5s" } as React.CSSProperties} d={d(pts) + `L${x(18)} ${h - 16}L8 ${h - 16}Z`} />
      <path className="hm-ln draw" pathLength={1} d={d(pts)} />
      <circle className="hm-dot fade" style={{ "--dl": "1.3s" } as React.CSSProperties} cx={x(18)} cy={y(1)} r={5} />
      <text x={8} y={h - 2}>Birth</text>
      <text x={w - 8} y={h - 2} textAnchor="end">18</text>
    </svg>
  );
}

/** Debt Payoff: the avalanche (highest rate first) clears the debt before the snowball. */
export function DebtChart({ w = 340, h = 120 }) {
  const x = scale(0, 26, 8, w - 8), y = scale(0, 1, h - 20, 10);
  const left = (t: number, end: number, k: number) => Math.max(0, 1 - Math.pow(Math.min(1, t / end), k));
  const av: Pt[] = [], sb: Pt[] = [];
  for (let t = 0; t <= 26; t++) { if (t <= 19) av.push([x(t), y(left(t, 19, 1.6))]); sb.push([x(t), y(left(t, 24, 1.35))]); }
  return (
    <svg className="hm-chart" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <line className="hm-grid-l" x1={8} x2={w - 8} y1={y(0)} y2={y(0)} />
      <path className="hm-dash" d={d(sb)} />
      <path className="hm-ln draw" pathLength={1} d={d(av)} />
      <circle className="hm-dot fade" style={{ "--dl": "1.3s" } as React.CSSProperties} cx={x(19)} cy={y(0)} r={5} />
      <text className="fade" style={{ "--dl": "1.3s" } as React.CSSProperties} x={x(19)} y={h - 3} textAnchor="middle">Avalanche: debt-free</text>
      <text x={x(11) + 8} y={y(left(11, 24, 1.35)) - 8}>Snowball</text>
    </svg>
  );
}

function Key({ items }: { items: [string, string][] }) {
  return (
    <g>
      {items.map(([n, c], i) => (
        <g key={n}>
          <rect className={c} x={6 + i * 100} y={2} width={9} height={9} rx={2} />
          <text x={20 + i * 100} y={10.5}>{n}</text>
        </g>
      ))}
    </g>
  );
}
