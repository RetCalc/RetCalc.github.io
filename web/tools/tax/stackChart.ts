/* The capital gain stacking chart: ordinary taxable income fills the
   brackets first and is the floor the gain sits on, so where the gain lands
   depends on how much ordinary income is underneath it. Both are drawn on one
   axis against the 0/15/20% breakpoints. From txStackChart() in
   src/js/app/11-income-tax.js; colors are the theme's variables, so it
   follows a theme switch. */
import { money } from "@/lib/format";

export const LTCG_COLORS = ["#4fbf95", "#e9b872", "#e2795f"]; // 0%, 15%, 20%

interface Stack { ltcgCut: number[]; ordTaxable: number; gainTaxable: number; ltcgBands: { amount: number }[] }

export function stackChartSvg(R: Stack): string {
  const W = 720, padL = 6, padR = 6, iw = W - padL - padR;
  const c0 = R.ltcgCut[0], c15 = R.ltcgCut[1];
  const lo = R.ordTaxable, hi = lo + R.gainTaxable;
  let max = Math.max(hi * 1.12, c0 * 1.14, 1);
  if (hi > c15) max = hi * 1.06;
  const x = (v: number) => padL + Math.max(0, Math.min(1, v / max)) * iw;
  // CSS variables only work in style, not in SVG presentation attributes.
  const dim = "style='fill:var(--dim);font-family:var(--sans)'";
  const barY = 44, barH = 40;
  let s = "";

  // faint zones behind the bar, so the bands read as territory
  const zone = (a: number, b: number, fill: string) =>
    b <= a ? "" : `<rect x='${x(a).toFixed(1)}' y='${barY}' width='${(x(b) - x(a)).toFixed(1)}' height='${barH}' fill='${fill}'/>`;
  s += zone(0, Math.min(max, c0), "rgba(79,191,149,.09)");
  s += zone(Math.min(max, c0), Math.min(max, c15), "rgba(233,184,114,.09)");
  s += zone(Math.min(max, c15), max, "rgba(226,121,95,.09)");

  // ordinary income floor
  if (lo > 0) s += `<rect x='${x(0).toFixed(1)}' y='${barY}' width='${(x(lo) - x(0)).toFixed(1)}' height='${barH}' fill='#8ba0ac' opacity='.85' rx='2'/>`;

  // the gain, segment by segment
  let cur = lo;
  R.ltcgBands.forEach((b, i) => {
    if (!(b.amount > 0)) return;
    s += `<rect x='${x(cur).toFixed(1)}' y='${barY}' width='${Math.max(1, x(cur + b.amount) - x(cur)).toFixed(1)}' height='${barH}' fill='${LTCG_COLORS[i]}' rx='2'/>`;
    cur += b.amount;
  });

  // breakpoint markers
  const mark = (v: number, label: string) => {
    if (v >= max) return "";
    const px = x(v);
    return `<line x1='${px.toFixed(1)}' y1='${barY - 12}' x2='${px.toFixed(1)}' y2='${barY + barH + 8}' style='stroke:var(--dim)' stroke-width='1' stroke-dasharray='3 3'/>` +
      `<text x='${Math.min(px + 6, W - 130).toFixed(1)}' y='${barY - 18}' font-size='11.5' ${dim}>${label} <tspan style='fill:var(--text);font-family:var(--mono)'>${money(v)}</tspan></text>`;
  };
  s += mark(c0, "0% ends at");
  s += mark(c15, "20% starts at");

  // The two edges of the stack, labeled underneath, kept inside the frame
  // and off each other.
  const xLo = x(lo), xHi = x(hi);
  const row1 = barY + barH + 26, row2 = barY + barH + 44;
  const foot = (px: number, label: string, anchor: string, y: number) =>
    `<text x='${Math.max(3, Math.min(px, W - 3)).toFixed(1)}' y='${y}' font-size='11.5' text-anchor='${anchor}' style='fill:var(--dimmer);font-family:var(--sans)'>${label}</text>`;
  const est = (t: string) => t.length * 6.0; // rough width at 11.5px
  if (lo > 0 && hi > lo) {
    const lbl1 = "ordinary income ends " + money(lo), lbl2 = "gain ends " + money(hi);
    const a2 = xHi + est(lbl2) > W - 4 ? "end" : "start";
    const left2 = a2 === "end" ? xHi - est(lbl2) : xHi;
    s += foot(xLo, lbl1, xLo - est(lbl1) < 4 ? "start" : "end", row1);
    s += foot(xHi, lbl2, a2, left2 < xLo + 6 ? row2 : row1);
  } else if (lo > 0) {
    s += foot(xLo, "ordinary income ends " + money(lo), "middle", row1);
  } else if (hi > 0) {
    const lbl = "gain ends " + money(hi);
    s += foot(xHi, lbl, xHi + est(lbl) > W - 4 ? "end" : "start", row1);
  }
  return s;
}
