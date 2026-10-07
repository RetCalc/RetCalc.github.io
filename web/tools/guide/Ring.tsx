"use client";

/* The readiness score as a ring, with the number in it: the rail, the
   phone's strip and the plan card. */

import { rating } from "./calc";

/** The score as a ring, with the number in it. */
export function Ring({ score: s, size }: { score: number | null; size?: number }) {
  const r = 52, c = 2 * Math.PI * r, f = s == null ? 0 : Math.max(0, Math.min(100, s)) / 100;
  return (
    <svg className={size ? "gd-ring size-(--ring-size)" : "gd-ring"} viewBox="0 0 120 120" role="img" aria-label={s == null ? "No score yet" : "Score " + s + " out of 100"}
      style={size ? { "--ring-size": size + "px" } as React.CSSProperties : undefined}>
      <circle className="trk" cx="60" cy="60" r={r} fill="none" strokeWidth="10" />
      <circle className="val" cx="60" cy="60" r={r} fill="none" strokeWidth="10" strokeLinecap="round" stroke={rating(s).color}
        strokeDasharray={c.toFixed(1)} strokeDashoffset={(c * (1 - f)).toFixed(1)} transform="rotate(-90 60 60)" />
      <text x="60" y={s == null ? 67 : 69} textAnchor="middle" fontSize={s == null ? 22 : 32}>{s == null ? "—" : s}</text>
    </svg>
  );
}
