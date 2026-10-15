"use client";

/* A donut of parts of a whole: each slice dims the others when it's the
   active one, and the active part's label and amount take the center
   (the whole's when none is). Income Tax's taxes and the Budget's paycheck.
   The parent tracks which part is active, from the slices (data-idx) or
   from a legend beside it. Draw it inside an <svg viewBox="0 0 220 220">. */

import { HatchDefs } from "@/components/charts/HatchDefs";
import { money } from "@/lib/format";
import { svgPaint } from "@/lib/hues";

export interface DonutPart { v: number; c: string; label: string }

export function Donut({ parts, center, centerLabel, active, ids, hatch = "dnh" }: {
  parts: DonutPart[];
  /** What the center says with no part active: the whole, as text. */
  center: string;
  centerLabel: string;
  active: number | null;
  /** The center texts' ids, for tests and the share card. */
  ids?: { label?: string; value?: string };
  /** The hatch patterns' id prefix: unique per donut on a page. */
  hatch?: string;
}) {
  const R = 100, C = 110, sw = 30, circ = 2 * Math.PI * (R - sw / 2);
  const tot = parts.reduce((a, x) => a + Math.max(0, x.v), 0) || 1;
  // Where each slice starts, as a share of the ring.
  const starts = parts.map((_, i) => parts.slice(0, i).reduce((a, x) => a + Math.max(0, x.v / tot), 0));
  const pt = active != null ? parts[active] : null;
  return (
    <>
      <defs><HatchDefs prefix={hatch} colors={parts.map((p) => p.c)} /></defs>
      {parts.map((p, i) => {
        const frac = p.v / tot, off = starts[i];
        if (frac <= 0) return null;
        return (
          <circle key={i} cx={C} cy={C} r={R - sw / 2} fill="none" stroke={svgPaint(p.c, hatch)} strokeWidth={sw}
            strokeDasharray={(frac * circ).toFixed(2) + " " + circ.toFixed(2)} strokeDashoffset={(-off * circ).toFixed(2)}
            transform={`rotate(-90 ${C} ${C})`} data-idx={i}
            className={active == null || active === i ? "transition-opacity duration-150 cursor-pointer" : "transition-opacity duration-150 cursor-pointer opacity-18"} />
        );
      })}
      <text id={ids?.label} x="110" y="104" textAnchor="middle" fontSize="13" fill="var(--dim)" className="font-sans pointer-events-none">{pt ? pt.label : centerLabel}</text>
      <text id={ids?.value} x="110" y="128" textAnchor="middle" fontSize="22" fontWeight="600" fill="var(--text)" className="font-mono pointer-events-none">{pt ? money(pt.v) : center}</text>
    </>
  );
}
