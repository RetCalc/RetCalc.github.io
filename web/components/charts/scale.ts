/* Axis helpers for the charts, from src/js/app/04-charts.js. */

/* Round numbers for the value axis, with a little headroom above the data.
   $0 / $500k / $1M / $1.5M reads at a glance; quarters of whatever the
   maximum happened to be ($509k, $1.02M) don't. */
export function niceAxis(lo: number, hi: number): { min: number; max: number; ticks: number[] } {
  if (!(hi > lo)) hi = lo + 1;
  const raw = (hi - lo) / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / mag;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
  const min = Math.floor(lo / step + 1e-9) * step;
  const max = Math.ceil((hi * 1.02) / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let v = min; v <= max + step / 2; v += step) ticks.push(Math.abs(v) < step / 1e6 ? 0 : v);
  return { min, max, ticks };
}

/* $1.5M, $2M, $1.25M: only the decimals the number needs. */
export function fmtAxisMoney(v: number): string {
  const a = Math.abs(v), sign = v < 0 ? "-$" : "$";
  if (a >= 1e6) return sign + +(a / 1e6).toFixed(2) + "M";
  if (a >= 1e3) return sign + +(a / 1e3).toFixed(1) + "k";
  return sign + Math.round(a);
}
