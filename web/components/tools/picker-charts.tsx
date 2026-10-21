/* The tool list's own chart cards: the Portfolio Backtest, Rent vs. Buy,
   College Savings and Debt Payoff. They're illustrations, not readouts: no
   figures on them. The homepage's Rent vs. Buy tile shows the blueprint too,
   drawn as it scrolls into view (styles/16-home.css).

   Their moving parts (.tp-kf) play keyframes from the stylesheet
   (styles/18-tool-picker.css) while their card has .play, as the page opens
   and again on hover, focus or a tap. Each part says when it starts and how
   long it runs (--dl, --du, in seconds at the first play's pace) and, for the
   sliders, where it moves (--fa to --fc for a fill, --a and --b for a knob).
   At rest each part is drawn as its last frame, so under reduced motion
   every chart is simply there, finished. */

type Pt = [number, number];
const d = (pts: Pt[]) => pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join("");
const scale = (d0: number, d1: number, r0: number, r1: number) => (v: number) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
const box = (w: number, h: number) => `0 0 ${w} ${h}`;
/** Seconds, from a percent of a chart's play. */
const at = (pct: number, seconds: number) => +((pct / 100) * seconds).toFixed(3) + "s";

/* ---------- Portfolio Backtest: sliders ---------- */

/** A made-up history: a fixed wobble on a steady climb. */
function wobbly(n: number, drift: number, swing: number, seed: number) {
  const out = [0];
  for (let t = 1; t < n; t++) {
    const noise = Math.sin(t * 1.7 + seed) * 0.6 + Math.sin(t * 0.43 + seed * 2.1) * 0.9 + Math.sin(t * 3.1 + seed * 0.7) * 0.35;
    out.push(out[t - 1] + drift + swing * noise * 0.18);
  }
  return out;
}
/** The sliders' three mixes, in turn: all stocks climbs steeply with big
    swings, the cautious mix creeps along, the one it settles on lands between. */
const BT_LINES = [wobbly(60, 1.0, 3.2, 1), wobbly(60, 0.32, 0.7, 4), wobbly(60, 0.66, 1.8, 7)];
/** Stocks, small value, bonds, cash, in percent, for each of the three mixes. */
const BT_MIXES = [[100, 0, 0, 0], [40, 20, 30, 10], [60, 20, 20, 0]];

/** The Backtest in miniature, without words: four sliders (stocks, small
    value, bonds, cash) glide to a new mix twice and settle; beside them the
    history redraws for each mix, the earlier ones staying as faint ghosts. */
export function BacktestSliders({ w = 340, h = 120 }) {
  const tx0 = 4, tw = 110, x0 = 144, x1 = 328, y0 = 14, y1 = 106, all = BT_LINES.flat();
  const x = scale(0, BT_LINES[0].length - 1, x0, x1), y = scale(Math.min(...all), Math.max(...all), y1, y0);
  return (
    <svg className="hm-chart" viewBox={box(w, h)} role="img" aria-label="Slide a mix of stocks, small value, bonds and cash and see what it did.">
      {["tpk-amber", "tpk-lav", "tpk-sky", "tpk-gray"].map((c, k) => {
        const cy = 18 + k * 27, [a, b, f] = BT_MIXES.map((m) => m[k] / 100);
        return (
          <g key={c} className={c}>
            <rect className="tpk-skel" x={tx0} y={cy - 13} width={30 + ((k * 13) % 20)} height={4} rx={2} />
            <line className="tpk-track" x1={tx0} x2={tx0 + tw} y1={cy} y2={cy} />
            <line className="tpk-ln tpk-thick tpk-bt-fill tp-kf" x1={tx0} x2={tx0 + tw} y1={cy} y2={cy}
              style={{ "--fa": Math.max(0.001, a), "--fb": Math.max(0.001, b), "--fc": Math.max(0.001, f) } as React.CSSProperties} />
            <circle className="tpk-knob tpk-bt-knob tp-kf" cx={tx0 + tw * f} cy={cy} r={5.5}
              style={{ "--a": +(tw * (a - f)).toFixed(2) + "px", "--b": +(tw * (b - f)).toFixed(2) + "px" } as React.CSSProperties} />
          </g>
        );
      })}
      <rect className="tpk-box" x={132} y={2} width={208} height={116} rx={9} />
      {[0, 1, 2, 3].map((k) => <line key={k} className="hm-grid-l" x1={x0} x2={x1} y1={y0 + ((y1 - y0) * k) / 3} y2={y0 + ((y1 - y0) * k) / 3} />)}
      {BT_LINES.map((l, i) => (
        <path key={i} className={`tpk-ln tpk-amber tpk-bold tpk-bt-l${i + 1} draw tp-kf`} pathLength={1} d={d(l.map((v, t): Pt => [x(t), y(v)]))} />
      ))}
    </svg>
  );
}

/* ---------- Rent vs. Buy: the blueprint ---------- */

const RB_SECONDS = 1.4;
const houseD = (x: number, gy: number, w: number, bh: number, rh: number) => `M${x} ${gy}V${gy - bh}L${x + w / 2} ${gy - bh - rh}L${x + w} ${gy - bh}V${gy}Z`;

/** A house and an apartment sketched in line on blueprint grid; then a
    measuring tape beside each rises to what that choice ends up worth. */
export function RentBuyBlueprint({ buy, rent, w = 340, h = 120 }: { buy: number; rent: number; w?: number; h?: number }) {
  const gy = h - 8, top = Math.max(buy, rent), mh = h - 18, S = RB_SECONDS;
  const tape = (x: number, v: number, cls: string, from: number) => {
    const th = mh * (v / top);
    return (
      <g>
        <rect className={"tpk-tape tpk-grow-y tp-kf " + cls} x={x} y={gy - th} width={9} height={th} rx={2}
          style={{ "--dl": at(from, S), "--du": at(36, S) } as React.CSSProperties} />
        {Array.from({ length: Math.floor(th / 8) }, (_, i) => (
          <line key={i} className="tpk-tick tpk-show tp-kf" x1={x} x2={x + (i % 2 ? 3 : 5)} y1={gy - 8 * (i + 1)} y2={gy - 8 * (i + 1)}
            style={{ "--dl": at(from + (36 * (i + 1) * 8) / th, S), "--du": at(2, S) } as React.CSSProperties} />
        ))}
      </g>
    );
  };
  return (
    <svg className="hm-chart" viewBox={box(w, h)} role="img" aria-label="Buying and renting compared: what each ends up worth.">
      {Array.from({ length: 13 }, (_, i) => <line key={"v" + i} className="tpk-blueprint" x1={10 + i * 26.6} x2={10 + i * 26.6} y1={2} y2={h - 2} />)}
      {Array.from({ length: 5 }, (_, i) => <line key={"h" + i} className="tpk-blueprint" x1={2} x2={w - 2} y1={6 + i * 27} y2={6 + i * 27} />)}
      <line className="tpk-ground" x1={20} x2={w - 20} y1={gy} y2={gy} />
      <path className="tpk-sketch tpk-sketch-buy tpk-draw draw tp-kf" pathLength={1} d={houseD(52, gy, 70, 42, 30) + `M${52 + 26} ${gy}V${gy - 24}H${52 + 44}V${gy}`}
        style={{ "--dl": "0s", "--du": at(45, S) } as React.CSSProperties} />
      <path className="tpk-sketch tpk-sketch-rent tpk-draw draw tp-kf" pathLength={1}
        d={`M206 ${gy}V${gy - 72}H${206 + 50}V${gy}M216 ${gy - 60}h10M236 ${gy - 60}h10M216 ${gy - 44}h10M236 ${gy - 44}h10M216 ${gy - 28}h10M236 ${gy - 28}h10`}
        style={{ "--dl": at(8, S), "--du": at(45, S) } as React.CSSProperties} />
      {tape(134, buy, "tpk-tape-buy", 50)}
      {tape(268, rent, "tpk-tape-rent", 56)}
    </svg>
  );
}

/* ---------- College Savings: the staircase ---------- */

const CO_SECONDS = 1.4;

/** Eighteen steps, a year of saving each, every one a little taller than the
    last (growth on the savings), climbing to a graduation cap. */
export function CollegeStairs({ w = 340, h = 120 }) {
  const n = 18, sw = (w - 90) / n, gy = h - 4, S = CO_SECONDS;
  const bal: number[] = [];
  for (let t = 0, b = 0; t < n; t++) { b = b * 1.06 + 1; bal.push(b); }
  const y = scale(0, bal[n - 1], gy, 34);
  return (
    <svg className="hm-chart" viewBox={box(w, h)} role="img" aria-label="Saving every year up to college, the balance growing a little faster each year.">
      {bal.map((v, i) => (
        <rect key={i} className="tpk-step tpk-grow-y tp-kf" x={14 + i * sw} y={y(v)} width={sw - 1.5} height={gy - y(v)} rx={1.5}
          style={{ "--dl": at((i / n) * 70, S), "--du": at(14, S) } as React.CSSProperties} />
      ))}
      <g className="tpk-cap-drop tp-kf" style={{ "--dl": at(78, S), "--du": at(22, S) } as React.CSSProperties}>
        <g transform={`translate(${w - 44} ${y(bal[n - 1]) - 6}) scale(1.5)`}>
          <path className="tpk-cap" d="M-16 0L0 -7L16 0L0 7Z" />
          <path className="tpk-cap" d="M-9 3V10Q0 14 9 10V3L0 7Z" />
          <path className="tpk-tassel" d="M14 1V11" />
          <circle className="tpk-cap" cx={14} cy={12} r={1.8} />
        </g>
      </g>
    </svg>
  );
}

/* ---------- Debt Payoff: downhill ---------- */

const DB_SECONDS = 1.4;
/** Four example debts, [balance, rate a year], paid $900 per month: minimums
    (2%, at least $25) on each, the rest on the highest rate (the avalanche). */
const DEBTS: [number, number][] = [[4200, 0.24], [9000, 0.19], [2200, 0.11], [7000, 0.07]];
function avalanche() {
  const bal = DEBTS.map(([b]) => b), rows: number[][] = [bal.slice()];
  const target = () => bal.map((_, i) => i).filter((i) => bal[i] > 0.5).sort((a, b) => DEBTS[b][1] - DEBTS[a][1])[0];
  while (bal.some((b) => b > 0.5) && rows.length < 200) {
    bal.forEach((b, i) => { bal[i] = b * (1 + DEBTS[i][1] / 12); });
    let left = 900;
    bal.forEach((b, i) => { const m = Math.min(b, Math.max(25, b * 0.02)); bal[i] -= m; left -= m; });
    while (left > 0.01) { const t = target(); if (t === undefined) break; const p = Math.min(left, bal[t]); bal[t] -= p; left -= p; }
    rows.push(bal.map((b) => Math.max(0, b)));
  }
  return rows;
}
const AV = avalanche();
const total = (r: number[]) => r.reduce((a, b) => a + b, 0);
/** The month each debt reaches zero. */
const CLEARED = DEBTS.map((_, i) => AV.findIndex((r) => r[i] <= 0.5));

/** What's owed, all of it, as one line falling to zero; a ring pops where
    each debt is paid off and a dot where the line lands. */
export function DebtDownhill({ w = 340, h = 120 }) {
  const n = AV.length - 1, S = DB_SECONDS, x = scale(0, n, 10, w - 14), y = scale(0, total(AV[0]), h - 10, 10);
  const pts = AV.map((r, t): Pt => [x(t), y(total(r))]);
  return (
    <svg className="hm-chart" viewBox={box(w, h)} role="img" aria-label="Debts paid off one by one, the total falling to zero.">
      <line className="hm-grid-l" x1={10} x2={w - 10} y1={y(0)} y2={y(0)} />
      <path className="tpk-owed tpk-show tp-kf" d={d(pts) + `L${x(n)} ${y(0)}L${x(0)} ${y(0)}Z`} style={{ "--dl": at(40, S), "--du": at(50, S) } as React.CSSProperties} />
      <path className="tpk-payoff tpk-draw draw tp-kf" pathLength={1} d={d(pts)} style={{ "--dl": "0s", "--du": at(85, S) } as React.CSSProperties} />
      {CLEARED.map((m, i) => (
        <circle key={i} className={(i === CLEARED.length - 1 || m === n ? "tpk-paid" : "tpk-ring") + " tpk-pop tp-kf"} cx={x(m)} cy={y(total(AV[m]))} r={m === n ? 5.5 : 4}
          style={{ "--dl": at((m / n) * 85, S), "--du": at(10, S) } as React.CSSProperties} />
      ))}
    </svg>
  );
}
