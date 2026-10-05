/* A sparkline: one series as a small filled line, with an optional dashed
   level (the comfort line). From ddSpark() in src/js/app/15c-drawdown-strategies.js. */

export function Spark({ vals, line, w = 260, h = 46, color = "#e9b872" }: {
  vals: number[]; line?: number | number[]; w?: number; h?: number; color?: string;
}) {
  const pad = 3, n = vals.length;
  if (!n) return null;
  // a schedule of levels still sets the scale, but only one level is drawn
  const lv = typeof line === "number" ? line : 0;
  const hi = Math.max(...vals, ...(Array.isArray(line) ? line : [lv])) || 1, lo = 0;
  const X = (i: number) => pad + (n > 1 ? i / (n - 1) : 0.5) * (w - 2 * pad);
  const Y = (v: number) => h - pad - ((v - lo) / (hi - lo)) * (h - 2 * pad);
  const d = vals.map((v, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1)).join(" ");
  const area = d + " L" + X(n - 1).toFixed(1) + " " + (h - pad) + " L" + X(0).toFixed(1) + " " + (h - pad) + " Z";
  return (
    <svg className="ddspark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={area} fill={color} opacity=".14" />
      {lv > 0 ? <line x1={pad} x2={w - pad} y1={Y(lv).toFixed(1)} y2={Y(lv).toFixed(1)} stroke="#8b97ad" strokeWidth="1" strokeDasharray="3 3" /> : null}
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
